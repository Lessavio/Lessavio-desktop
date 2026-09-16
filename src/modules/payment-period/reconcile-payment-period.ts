import { PoolClient, QueryResultRow } from "pg";

interface ReconciliationPeriodRow extends QueryResultRow {
  id: string;
  student_id: string;
  amount: string;
  starts_at: Date;
  ends_at: Date;
  paid_at: Date;
}

export async function reconcilePaymentPeriod(
  client: PoolClient,
  ownerId: string,
  periodId: string
): Promise<boolean> {
  const result = await client.query<ReconciliationPeriodRow>(
    `SELECT id, student_id, amount, starts_at, ends_at, paid_at
     FROM payment_periods
     WHERE owner_id = $1 AND id = $2
     FOR UPDATE`,
    [ownerId, periodId]
  );
  const period = result.rows[0];
  if (!period) return false;

  await client.query(
    `UPDATE lessons
     SET payment_period_id = NULL,
         is_paid = false,
         paid_at = NULL,
         updated_at = now()
     WHERE owner_id = $1 AND payment_period_id = $2`,
    [ownerId, periodId]
  );

  await client.query(
    `WITH candidates AS (
       SELECT lesson.id,
              SUM(lesson.price) OVER (
                ORDER BY lesson.starts_at, lesson.id
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
              ) AS cumulative_price
       FROM lessons AS lesson
       WHERE lesson.owner_id = $1
         AND lesson.student_id = $2
         AND lesson.starts_at >= $3
         AND lesson.starts_at < $4
         AND lesson.status <> 'cancelled'
         AND NOT (lesson.is_paid AND lesson.payment_period_id IS NULL)
     ), allocated AS (
       SELECT id
       FROM candidates
       WHERE cumulative_price <= $5::numeric
     )
     UPDATE lessons AS lesson
     SET payment_period_id = $6,
         is_paid = true,
         paid_at = $7,
         updated_at = now()
     FROM allocated
     WHERE lesson.owner_id = $1 AND lesson.id = allocated.id`,
    [
      ownerId,
      period.student_id,
      period.starts_at,
      period.ends_at,
      period.amount,
      period.id,
      period.paid_at,
    ]
  );

  return true;
}
