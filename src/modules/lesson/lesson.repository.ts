import { QueryResultRow } from "pg";
import { isPositivePostgresBigintId } from "../../common/postgres-bigint-id";
import { pool, QueryExecutor, withTransaction } from "../../database";
import {
  CreateLessonDto,
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
  is_paid, paid_at, notes, created_at, updated_at
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
      const paidAt = dto.isPaid ? new Date() : null;
      const result = await client.query<LessonRow>(
        `INSERT INTO lessons
          (owner_id, student_id, starts_at, duration_minutes, price, status,
           is_paid, paid_at, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING ${LESSON_COLUMNS}`,
        [
          ownerId,
          dto.studentId,
          dto.startsAt,
          dto.durationMinutes,
          dto.price,
          dto.status,
          dto.isPaid,
          paidAt,
          dto.notes,
        ]
      );
      return mapLesson(result.rows[0]);
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

      const startsAt = dto.startsAt ?? current.startsAt;
      const durationMinutes = dto.durationMinutes ?? current.durationMinutes;
      const status = dto.status ?? current.status;
      if (
        status !== "cancelled" &&
        (await hasConflict(client, ownerId, startsAt, durationMinutes, id))
      ) {
        return { conflict: true };
      }

      const paidAt = dto.isPaid === undefined
        ? current.paidAt
        : dto.isPaid
          ? current.paidAt ?? new Date()
          : null;
      const columnByField: Record<keyof UpdateLessonDto, string> = {
        studentId: "student_id",
        startsAt: "starts_at",
        durationMinutes: "duration_minutes",
        price: "price",
        status: "status",
        isPaid: "is_paid",
        notes: "notes",
      };
      const entries = Object.entries(dto) as [keyof UpdateLessonDto, unknown][];
      const values: unknown[] = [ownerId, id];
      const assignments = entries.map(([field, value], index) => {
        values.push(value);
        return `${columnByField[field]} = $${index + 3}`;
      });
      values.push(paidAt);
      const result = await client.query<LessonRow>(
        `UPDATE lessons
         SET ${assignments.join(", ")}, paid_at = $${values.length}, updated_at = now()
         WHERE owner_id = $1 AND id = $2
         RETURNING ${LESSON_COLUMNS}`,
        values
      );
      return { lesson: result.rows[0] ? mapLesson(result.rows[0]) : undefined, conflict: false };
    });
  },

  async delete(ownerId: string, id: string): Promise<boolean> {
    if (!isPositivePostgresBigintId(ownerId) || !isPositivePostgresBigintId(id)) {
      return false;
    }

    const result = await pool.query(
      "DELETE FROM lessons WHERE owner_id = $1 AND id = $2",
      [ownerId, id]
    );
    return result.rowCount === 1;
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
