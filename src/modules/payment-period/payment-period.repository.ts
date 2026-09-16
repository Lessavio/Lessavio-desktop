import { PoolClient, QueryResultRow } from "pg";
import { isPositivePostgresBigintId } from "../../common/postgres-bigint-id";
import { pool, withTransaction } from "../../database";
import { CreatePaymentPeriodDto, PaymentEntry, PaymentPeriod } from "./payment-period.model";
import { reconcilePaymentPeriod } from "./reconcile-payment-period";

interface PaymentPeriodRow extends QueryResultRow {
  id: string;
  owner_id: string;
  student_id: string;
  month: string;
  time_zone: string;
  amount: string;
  starts_at: Date;
  ends_at: Date;
  paid_at: Date;
  created_at: Date;
  updated_at: Date;
}

interface PaymentEntryRow extends QueryResultRow {
  id: string;
  owner_id: string;
  student_id: string;
  payment_period_id: string;
  amount: string;
  paid_at: Date;
  created_at: Date;
  updated_at: Date;
}

interface PaymentPeriodPaymentRow extends PaymentPeriodRow {
  payment_id: string | null;
  payment_owner_id: string | null;
  payment_student_id: string | null;
  payment_period_id: string | null;
  payment_amount: string | null;
  payment_paid_at: Date | null;
  payment_created_at: Date | null;
  payment_updated_at: Date | null;
}

const PAYMENT_PERIOD_COLUMNS = `
  id, owner_id, student_id, month, time_zone, amount,
  starts_at, ends_at, paid_at, created_at, updated_at
`;

const PAYMENT_ENTRY_COLUMNS = `
  id, owner_id, student_id, payment_period_id, amount,
  paid_at, created_at, updated_at
`;

function mapPaymentEntry(row: PaymentEntryRow): PaymentEntry {
  return {
    id: row.id,
    ownerId: row.owner_id,
    studentId: row.student_id,
    paymentPeriodId: row.payment_period_id,
    amount: Number(row.amount),
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPaymentPeriod(
  row: PaymentPeriodRow,
  payments: PaymentEntry[] = []
): PaymentPeriod {
  return {
    id: row.id,
    ownerId: row.owner_id,
    studentId: row.student_id,
    month: row.month,
    timeZone: row.time_zone,
    amount: Number(row.amount),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payments,
  };
}

async function findById(
  client: PoolClient,
  ownerId: string,
  id: string
): Promise<PaymentPeriod | undefined> {
  const periodResult = await client.query<PaymentPeriodRow>(
    `SELECT ${PAYMENT_PERIOD_COLUMNS}
     FROM payment_periods
     WHERE owner_id = $1 AND id = $2`,
    [ownerId, id]
  );
  const period = periodResult.rows[0];
  if (!period) return undefined;

  const paymentsResult = await client.query<PaymentEntryRow>(
    `SELECT ${PAYMENT_ENTRY_COLUMNS}
     FROM payment_entries
     WHERE owner_id = $1 AND payment_period_id = $2
     ORDER BY paid_at DESC, id DESC`,
    [ownerId, id]
  );
  return mapPaymentPeriod(period, paymentsResult.rows.map(mapPaymentEntry));
}

async function refreshAmount(
  client: PoolClient,
  ownerId: string,
  periodId: string
): Promise<void> {
  await client.query(
    `UPDATE payment_periods AS period
     SET amount = (
           SELECT COALESCE(SUM(entry.amount), 0)
           FROM payment_entries AS entry
           WHERE entry.owner_id = $1 AND entry.payment_period_id = $2
         ),
         updated_at = now()
     WHERE period.owner_id = $1 AND period.id = $2`,
    [ownerId, periodId]
  );
}

interface CreatePaymentPeriodResult {
  period?: PaymentPeriod;
  studentActive: boolean;
  conflict?: "duplicate" | "overlap";
}

interface UpdatePaymentResult {
  period?: PaymentPeriod;
  periodFound: boolean;
  paymentFound: boolean;
}

type DeletePaymentResult =
  | "deleted"
  | "period_not_found"
  | "payment_not_found"
  | "last_payment";

export const paymentPeriodRepository = {
  async findAll(ownerId: string): Promise<PaymentPeriod[]> {
    if (!isPositivePostgresBigintId(ownerId)) return [];

    const result = await pool.query<PaymentPeriodPaymentRow>(
      `SELECT
         period.id, period.owner_id, period.student_id, period.month,
         period.time_zone, period.amount, period.starts_at, period.ends_at,
         period.paid_at, period.created_at, period.updated_at,
         entry.id AS payment_id,
         entry.owner_id AS payment_owner_id,
         entry.student_id AS payment_student_id,
         entry.payment_period_id,
         entry.amount AS payment_amount,
         entry.paid_at AS payment_paid_at,
         entry.created_at AS payment_created_at,
         entry.updated_at AS payment_updated_at
       FROM payment_periods AS period
       LEFT JOIN payment_entries AS entry
         ON entry.owner_id = period.owner_id
        AND entry.student_id = period.student_id
        AND entry.payment_period_id = period.id
       WHERE period.owner_id = $1
       ORDER BY period.month DESC, period.starts_at DESC, period.id DESC,
                entry.paid_at DESC NULLS LAST, entry.id DESC`,
      [ownerId]
    );
    const periods: PaymentPeriod[] = [];
    const periodsById = new Map<string, PaymentPeriod>();
    for (const row of result.rows) {
      let period = periodsById.get(row.id);
      if (!period) {
        period = mapPaymentPeriod(row);
        periodsById.set(row.id, period);
        periods.push(period);
      }
      if (
        row.payment_id
        && row.payment_owner_id
        && row.payment_student_id
        && row.payment_period_id
        && row.payment_amount !== null
        && row.payment_paid_at
        && row.payment_created_at
        && row.payment_updated_at
      ) {
        period.payments.push({
          id: row.payment_id,
          ownerId: row.payment_owner_id,
          studentId: row.payment_student_id,
          paymentPeriodId: row.payment_period_id,
          amount: Number(row.payment_amount),
          paidAt: row.payment_paid_at,
          createdAt: row.payment_created_at,
          updatedAt: row.payment_updated_at,
        });
      }
    }
    return periods;
  },

  async create(
    ownerId: string,
    dto: CreatePaymentPeriodDto
  ): Promise<CreatePaymentPeriodResult> {
    if (!isPositivePostgresBigintId(ownerId)) throw new Error("Invalid owner ID");
    if (!isPositivePostgresBigintId(dto.studentId)) throw new Error("Invalid student ID");

    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerId]);
      const student = await client.query<{ id: string }>(
        `SELECT id
         FROM students
         WHERE owner_id = $1 AND id = $2 AND NOT archived
         FOR UPDATE`,
        [ownerId, dto.studentId]
      );
      if (!student.rows[0]) return { studentActive: false };

      const conflict = await client.query<{ month: string }>(
        `SELECT month
         FROM payment_periods
         WHERE owner_id = $1
           AND student_id = $2
           AND (month = $3 OR (starts_at < $5 AND ends_at > $4))
         ORDER BY (month = $3) DESC
         LIMIT 1`,
        [ownerId, dto.studentId, dto.month, dto.startsAt, dto.endsAt]
      );
      if (conflict.rows[0]) {
        return {
          studentActive: true,
          conflict: conflict.rows[0].month === dto.month ? "duplicate" : "overlap",
        };
      }

      const result = await client.query<PaymentPeriodRow>(
        `INSERT INTO payment_periods
          (owner_id, student_id, month, time_zone, amount, starts_at, ends_at)
         VALUES ($1, $2, $3, $4, 0, $5, $6)
         RETURNING ${PAYMENT_PERIOD_COLUMNS}`,
        [ownerId, dto.studentId, dto.month, dto.timeZone, dto.startsAt, dto.endsAt]
      );
      const row = result.rows[0];

      await client.query(
        `INSERT INTO payment_entries
          (owner_id, student_id, payment_period_id, amount, paid_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [ownerId, dto.studentId, row.id, dto.amount, row.paid_at]
      );
      await refreshAmount(client, ownerId, row.id);
      await reconcilePaymentPeriod(client, ownerId, row.id);

      return {
        period: await findById(client, ownerId, row.id),
        studentActive: true,
      };
    });
  },

  async addPayment(
    ownerId: string,
    periodId: string,
    amount: number
  ): Promise<PaymentPeriod | undefined> {
    if (!isPositivePostgresBigintId(ownerId) || !isPositivePostgresBigintId(periodId)) {
      return undefined;
    }

    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerId]);
      const period = await client.query<{ student_id: string }>(
        `SELECT student_id
         FROM payment_periods
         WHERE owner_id = $1 AND id = $2
         FOR UPDATE`,
        [ownerId, periodId]
      );
      if (!period.rows[0]) return undefined;

      await client.query(
        `INSERT INTO payment_entries
          (owner_id, student_id, payment_period_id, amount)
         VALUES ($1, $2, $3, $4)`,
        [ownerId, period.rows[0].student_id, periodId, amount]
      );
      await refreshAmount(client, ownerId, periodId);
      await reconcilePaymentPeriod(client, ownerId, periodId);
      return findById(client, ownerId, periodId);
    });
  },

  async updatePayment(
    ownerId: string,
    periodId: string,
    paymentId: string,
    amount: number
  ): Promise<UpdatePaymentResult> {
    if (!isPositivePostgresBigintId(ownerId) || !isPositivePostgresBigintId(periodId)) {
      return { periodFound: false, paymentFound: false };
    }

    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerId]);
      const period = await client.query<{ id: string }>(
        `SELECT id
         FROM payment_periods
         WHERE owner_id = $1 AND id = $2
         FOR UPDATE`,
        [ownerId, periodId]
      );
      if (!period.rows[0]) return { periodFound: false, paymentFound: false };
      if (!isPositivePostgresBigintId(paymentId)) {
        return { periodFound: true, paymentFound: false };
      }

      const payment = await client.query<{ id: string }>(
        `SELECT id
         FROM payment_entries
         WHERE owner_id = $1 AND payment_period_id = $2 AND id = $3
         FOR UPDATE`,
        [ownerId, periodId, paymentId]
      );
      if (!payment.rows[0]) return { periodFound: true, paymentFound: false };

      await client.query(
        `UPDATE payment_entries
         SET amount = $4, updated_at = now()
         WHERE owner_id = $1 AND payment_period_id = $2 AND id = $3`,
        [ownerId, periodId, paymentId, amount]
      );
      await refreshAmount(client, ownerId, periodId);
      await reconcilePaymentPeriod(client, ownerId, periodId);
      return {
        period: await findById(client, ownerId, periodId),
        periodFound: true,
        paymentFound: true,
      };
    });
  },

  async deletePayment(
    ownerId: string,
    periodId: string,
    paymentId: string
  ): Promise<DeletePaymentResult> {
    if (!isPositivePostgresBigintId(ownerId) || !isPositivePostgresBigintId(periodId)) {
      return "period_not_found";
    }

    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerId]);
      const period = await client.query<{ id: string }>(
        `SELECT id
         FROM payment_periods
         WHERE owner_id = $1 AND id = $2
         FOR UPDATE`,
        [ownerId, periodId]
      );
      if (!period.rows[0]) return "period_not_found";
      if (!isPositivePostgresBigintId(paymentId)) return "payment_not_found";

      const payments = await client.query<{ id: string }>(
        `SELECT id
         FROM payment_entries
         WHERE owner_id = $1 AND payment_period_id = $2
         FOR UPDATE`,
        [ownerId, periodId]
      );
      if (!payments.rows.some((payment) => payment.id === paymentId)) {
        return "payment_not_found";
      }
      if (payments.rows.length === 1) return "last_payment";

      await client.query(
        `DELETE FROM payment_entries
         WHERE owner_id = $1 AND payment_period_id = $2 AND id = $3`,
        [ownerId, periodId, paymentId]
      );
      await refreshAmount(client, ownerId, periodId);
      await reconcilePaymentPeriod(client, ownerId, periodId);
      return "deleted";
    });
  },

  async delete(ownerId: string, id: string): Promise<boolean> {
    if (!isPositivePostgresBigintId(ownerId) || !isPositivePostgresBigintId(id)) {
      return false;
    }

    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerId]);
      const period = await client.query<{ id: string }>(
        "SELECT id FROM payment_periods WHERE owner_id = $1 AND id = $2 FOR UPDATE",
        [ownerId, id]
      );
      if (!period.rows[0]) return false;

      await client.query(
        `UPDATE lessons
         SET payment_period_id = NULL,
             is_paid = false,
             paid_at = NULL,
             updated_at = now()
         WHERE owner_id = $1 AND payment_period_id = $2`,
        [ownerId, id]
      );
      const result = await client.query(
        "DELETE FROM payment_periods WHERE owner_id = $1 AND id = $2",
        [ownerId, id]
      );
      return result.rowCount === 1;
    });
  },
};
