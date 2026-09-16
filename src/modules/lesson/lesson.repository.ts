import { QueryResultRow } from "pg";
import { isPositivePostgresBigintId } from "../../common/postgres-bigint-id";
import { pool, QueryExecutor, withTransaction } from "../../database";
import { reconcilePaymentPeriod } from "../payment-period/reconcile-payment-period";
import {
  CreateLessonDto,
  CreateLessonSeriesLessonDto,
  CreateLessonSeriesResult,
  Lesson,
  LessonFilters,
  LessonStatus,
  UpdateLessonDto,
} from "./lesson.model";

interface LessonRow extends QueryResultRow {
  id: string;
  owner_id: string;
  student_id: string;
  starts_at: Date;
  duration_minutes: number;
  price: string;
  status: LessonStatus;
  is_paid: boolean;
  paid_at: Date | null;
  payment_period_id: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateLessonResult {
  lesson?: Lesson;
  conflict: boolean;
}

const LESSON_COLUMNS = `
  id, owner_id, student_id, starts_at, duration_minutes, price, status,
  is_paid, paid_at, payment_period_id, notes, created_at, updated_at
`;

function mapLesson(row: LessonRow): Lesson {
  return {
    id: row.id,
    ownerId: row.owner_id,
    studentId: row.student_id,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    price: Number(row.price),
    status: row.status,
    isPaid: row.is_paid,
    paidAt: row.paid_at,
    paymentPeriodId: row.payment_period_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findById(
  executor: QueryExecutor,
  ownerId: string,
  id: string
): Promise<Lesson | undefined> {
  if (!isPositivePostgresBigintId(ownerId) || !isPositivePostgresBigintId(id)) {
    return undefined;
  }

  const result = await executor.query<LessonRow>(
    `SELECT ${LESSON_COLUMNS} FROM lessons WHERE owner_id = $1 AND id = $2`,
    [ownerId, id]
  );
  return result.rows[0] ? mapLesson(result.rows[0]) : undefined;
}

async function hasConflict(
  executor: QueryExecutor,
  ownerId: string,
  startsAt: Date,
  durationMinutes: number,
  excludeId?: string
): Promise<boolean> {
  if (!isPositivePostgresBigintId(ownerId)) return false;
  const safeExcludeId = excludeId === undefined || isPositivePostgresBigintId(excludeId)
    ? excludeId
    : undefined;
  const result = await executor.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM lessons
       WHERE owner_id = $1
         AND status <> 'cancelled'
         AND ($4::bigint IS NULL OR id <> $4::bigint)
         AND starts_at < $2::timestamptz + ($3 * interval '1 minute')
         AND starts_at + (duration_minutes * interval '1 minute') > $2::timestamptz
     ) AS exists`,
    [ownerId, startsAt, durationMinutes, safeExcludeId ?? null]
  );
  return result.rows[0].exists;
}

interface CoveringPaymentPeriod extends QueryResultRow {
  id: string;
  paid_at: Date;
}

async function findCoveringPaymentPeriod(
  executor: QueryExecutor,
  ownerId: string,
  studentId: string,
  startsAt: Date,
  status: LessonStatus
): Promise<CoveringPaymentPeriod | undefined> {
  if (status === "cancelled") return undefined;

  const result = await executor.query<CoveringPaymentPeriod>(
    `SELECT id, paid_at
     FROM payment_periods
     WHERE owner_id = $1
       AND student_id = $2
       AND starts_at <= $3
       AND ends_at > $3
     ORDER BY starts_at DESC, id DESC
     LIMIT 1`,
    [ownerId, studentId, startsAt]
  );
  return result.rows[0];
}

export const lessonRepository = {
  async findAll(ownerId: string, filters: LessonFilters = {}): Promise<Lesson[]> {
    if (!isPositivePostgresBigintId(ownerId)) return [];
    if (filters.studentId !== undefined && !isPositivePostgresBigintId(filters.studentId)) {
      return [];
    }

    const clauses = ["owner_id = $1"];
    const values: unknown[] = [ownerId];
    if (filters.from) {
      values.push(filters.from);
      clauses.push(`starts_at >= $${values.length}`);
    }
    if (filters.to) {
      values.push(filters.to);
      clauses.push(`starts_at < $${values.length}`);
    }
    if (filters.studentId !== undefined) {
      values.push(filters.studentId);
      clauses.push(`student_id = $${values.length}`);
    }
    if (filters.status) {
      values.push(filters.status);
      clauses.push(`status = $${values.length}`);
    }
    const result = await pool.query<LessonRow>(
      `SELECT ${LESSON_COLUMNS}
       FROM lessons
       WHERE ${clauses.join(" AND ")}
       ORDER BY starts_at ASC`,
      values
    );
    return result.rows.map(mapLesson);
  },

  findById(ownerId: string, id: string): Promise<Lesson | undefined> {
    return findById(pool, ownerId, id);
  },

  async hasForStudent(ownerId: string, studentId: string): Promise<boolean> {
    if (!isPositivePostgresBigintId(ownerId) || !isPositivePostgresBigintId(studentId)) {
      return false;
    }

    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM lessons WHERE owner_id = $1 AND student_id = $2
       ) AS exists`,
      [ownerId, studentId]
    );
    return result.rows[0].exists;
  },

  hasConflict(
    ownerId: string,
    startsAt: Date,
    durationMinutes: number,
    excludeId?: string
  ): Promise<boolean> {
    return hasConflict(pool, ownerId, startsAt, durationMinutes, excludeId);
  },

  async createMany(
    ownerId: string,
    lesson: CreateLessonSeriesLessonDto,
    occurrenceStartsAt: Date[]
  ): Promise<CreateLessonSeriesResult> {
    if (!isPositivePostgresBigintId(ownerId)) throw new Error("Invalid owner ID");
    if (!isPositivePostgresBigintId(lesson.studentId)) {
      return { lessons: [], studentActive: false, conflict: false };
    }

    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerId]);
      const student = await client.query<{ id: string }>(
        `SELECT id
         FROM students
         WHERE owner_id = $1 AND id = $2 AND NOT archived
         FOR UPDATE`,
        [ownerId, lesson.studentId]
      );
      if (!student.rows[0]) {
        return { lessons: [], studentActive: false, conflict: false };
      }

      const conflict = await client.query<{ exists: boolean }>(
        `WITH candidates AS (
           SELECT candidate.starts_at,
                  candidate.starts_at + ($2::integer * interval '1 minute') AS ends_at,
                  candidate.ordinality
           FROM unnest($3::timestamptz[]) WITH ORDINALITY
             AS candidate(starts_at, ordinality)
         )
         SELECT EXISTS (
           SELECT 1
           FROM candidates AS candidate
           JOIN lessons AS existing
             ON existing.owner_id = $1
            AND existing.status <> 'cancelled'
            AND existing.starts_at < candidate.ends_at
            AND existing.starts_at + (existing.duration_minutes * interval '1 minute')
                > candidate.starts_at
           UNION ALL
           SELECT 1
           FROM candidates AS earlier
           JOIN candidates AS later
             ON earlier.ordinality < later.ordinality
            AND earlier.starts_at < later.ends_at
            AND earlier.ends_at > later.starts_at
         ) AS exists`,
        [ownerId, lesson.durationMinutes, occurrenceStartsAt]
      );
      if (conflict.rows[0].exists) {
        return { lessons: [], studentActive: true, conflict: true };
      }

      const inserted = await client.query<{ id: string }>(
        `INSERT INTO lessons
          (owner_id, student_id, starts_at, duration_minutes, price, status,
           is_paid, paid_at, payment_period_id, notes)
         SELECT $1, $2, candidate.starts_at, $3, $4, 'scheduled',
                false, NULL, NULL, $5
         FROM unnest($6::timestamptz[]) WITH ORDINALITY
           AS candidate(starts_at, ordinality)
         ORDER BY candidate.ordinality
         RETURNING id`,
        [
          ownerId,
          lesson.studentId,
          lesson.durationMinutes,
          lesson.price,
          lesson.notes,
          occurrenceStartsAt,
        ]
      );
      const lessonIds = inserted.rows.map((row) => row.id);

      const periods = await client.query<{ id: string }>(
        `SELECT DISTINCT period.id
         FROM payment_periods AS period
         JOIN lessons AS inserted_lesson
           ON inserted_lesson.owner_id = period.owner_id
          AND inserted_lesson.student_id = period.student_id
          AND inserted_lesson.starts_at >= period.starts_at
          AND inserted_lesson.starts_at < period.ends_at
         WHERE period.owner_id = $1
           AND inserted_lesson.id = ANY($2::bigint[])
         ORDER BY period.id`,
        [ownerId, lessonIds]
      );
      for (const period of periods.rows) {
        await reconcilePaymentPeriod(client, ownerId, period.id);
      }

      const lessons = await client.query<LessonRow>(
        `SELECT ${LESSON_COLUMNS}
         FROM lessons
         WHERE owner_id = $1 AND id = ANY($2::bigint[])
         ORDER BY starts_at ASC, id ASC`,
        [ownerId, lessonIds]
      );
      return {
        lessons: lessons.rows.map(mapLesson),
        studentActive: true,
        conflict: false,
      };
    });
  },

  async create(ownerId: string, dto: CreateLessonDto): Promise<Lesson | undefined> {
    if (!isPositivePostgresBigintId(ownerId)) throw new Error("Invalid owner ID");
    if (!isPositivePostgresBigintId(dto.studentId)) throw new Error("Invalid student ID");

    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerId]);
      if (
        dto.status !== "cancelled" &&
        (await hasConflict(client, ownerId, dto.startsAt, dto.durationMinutes))
      ) {
        return undefined;
      }
      const result = await client.query<LessonRow>(
        `INSERT INTO lessons
          (owner_id, student_id, starts_at, duration_minutes, price, status,
           is_paid, paid_at, payment_period_id, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9)
         RETURNING ${LESSON_COLUMNS}`,
        [
          ownerId,
          dto.studentId,
          dto.startsAt,
          dto.durationMinutes,
          dto.price,
          dto.status,
          dto.isPaid,
          dto.isPaid ? new Date() : null,
          dto.notes,
        ]
      );
      const period = await findCoveringPaymentPeriod(
        client,
        ownerId,
        dto.studentId,
        dto.startsAt,
        dto.status
      );
      if (period) await reconcilePaymentPeriod(client, ownerId, period.id);
      return findById(client, ownerId, result.rows[0].id);
    });
  },

  async update(ownerId: string, id: string, dto: UpdateLessonDto): Promise<UpdateLessonResult> {
    if (!isPositivePostgresBigintId(ownerId) || !isPositivePostgresBigintId(id)) {
      return { conflict: false };
    }
    if (dto.studentId !== undefined && !isPositivePostgresBigintId(dto.studentId)) {
      throw new Error("Invalid student ID");
    }

    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerId]);
      const current = await findById(client, ownerId, id);
      if (!current) return { conflict: false };

      const studentId = dto.studentId ?? current.studentId;
      const startsAt = dto.startsAt ?? current.startsAt;
      const durationMinutes = dto.durationMinutes ?? current.durationMinutes;
      const status = dto.status ?? current.status;
      if (
        status !== "cancelled" &&
        (await hasConflict(client, ownerId, startsAt, durationMinutes, id))
      ) {
        return { conflict: true };
      }

      const oldPaymentPeriodId = current.paymentPeriodId;
      const oldCoveringPeriod = await findCoveringPaymentPeriod(
        client,
        ownerId,
        current.studentId,
        current.startsAt,
        current.status
      );
      const manualIsPaid = dto.isPaid
        ?? (current.paymentPeriodId === null && current.isPaid);
      const keepsManualTimestamp = manualIsPaid
        && current.paymentPeriodId === null
        && current.isPaid;
      const manualPaidAt = manualIsPaid
        ? (keepsManualTimestamp ? current.paidAt ?? new Date() : new Date())
        : null;
      const columnByField: Record<string, string> = {
        studentId: "student_id",
        startsAt: "starts_at",
        durationMinutes: "duration_minutes",
        price: "price",
        status: "status",
        notes: "notes",
      };
      const entries = (Object.entries(dto) as [keyof UpdateLessonDto, unknown][])
        .filter(([field]) => field !== "isPaid");
      const values: unknown[] = [ownerId, id];
      const assignments = entries.map(([field, value]) => {
        values.push(value);
        return `${columnByField[field]} = $${values.length}`;
      });
      values.push(null);
      assignments.push(`payment_period_id = $${values.length}`);
      values.push(manualIsPaid);
      assignments.push(`is_paid = $${values.length}`);
      values.push(manualPaidAt);
      assignments.push(`paid_at = $${values.length}`);
      assignments.push("updated_at = now()");
      const result = await client.query<LessonRow>(
        `UPDATE lessons
         SET ${assignments.join(", ")}
         WHERE owner_id = $1 AND id = $2
         RETURNING ${LESSON_COLUMNS}`,
        values
      );
      if (!result.rows[0]) return { conflict: false };

      const periodIds = new Set<string>();
      if (oldPaymentPeriodId) periodIds.add(oldPaymentPeriodId);
      if (oldCoveringPeriod) periodIds.add(oldCoveringPeriod.id);
      const finalPeriod = await findCoveringPaymentPeriod(
        client,
        ownerId,
        studentId,
        startsAt,
        status
      );
      if (finalPeriod) periodIds.add(finalPeriod.id);
      for (const periodId of periodIds) {
        await reconcilePaymentPeriod(client, ownerId, periodId);
      }
      return {
        lesson: await findById(client, ownerId, id),
        conflict: false,
      };
    });
  },

  async delete(ownerId: string, id: string): Promise<boolean> {
    if (!isPositivePostgresBigintId(ownerId) || !isPositivePostgresBigintId(id)) {
      return false;
    }

    return withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerId]);
      const lesson = await findById(client, ownerId, id);
      if (!lesson) return false;
      const coveringPeriod = await findCoveringPaymentPeriod(
        client,
        ownerId,
        lesson.studentId,
        lesson.startsAt,
        lesson.status
      );

      const result = await client.query(
        "DELETE FROM lessons WHERE owner_id = $1 AND id = $2",
        [ownerId, id]
      );
      if (result.rowCount !== 1) return false;
      const periodId = lesson.paymentPeriodId ?? coveringPeriod?.id;
      if (periodId) {
        await reconcilePaymentPeriod(client, ownerId, periodId);
      }
      return true;
    });
  },

  async claimOwnerless(ownerId: string): Promise<number> {
    if (!isPositivePostgresBigintId(ownerId)) return 0;

    const result = await pool.query(
      "UPDATE lessons SET owner_id = $1, updated_at = now() WHERE owner_id IS NULL",
      [ownerId]
    );
    return result.rowCount ?? 0;
  },
};
