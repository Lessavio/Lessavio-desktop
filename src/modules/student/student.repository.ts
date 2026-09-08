import { QueryResultRow } from "pg";
import { isPositivePostgresBigintId } from "../../common/postgres-bigint-id";
import { pool, QueryExecutor, withTransaction } from "../../database";
import { CreateStudentDto, Student, UpdateStudentDto } from "./student.model";

interface StudentRow extends QueryResultRow {
  id: string;
  owner_id: string;
  first_name: string;
  last_name: string | null;
  default_lesson_price: string;
  phone: string | null;
  notes: string | null;
  color: string;
  archived: boolean;
  created_at: Date;
  updated_at: Date;
}

const STUDENT_COLUMNS = `
  id, owner_id, first_name, last_name, default_lesson_price, phone, notes,
  color, archived, created_at, updated_at
`;

function mapStudent(row: StudentRow): Student {
  return {
    id: row.id,
    ownerId: row.owner_id,
    firstName: row.first_name,
    lastName: row.last_name,
    defaultLessonPrice: Number(row.default_lesson_price),
    phone: row.phone,
    notes: row.notes,
    color: row.color,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findById(
  executor: QueryExecutor,
  ownerId: string,
  id: string
): Promise<Student | undefined> {
  if (!isPositivePostgresBigintId(ownerId) || !isPositivePostgresBigintId(id)) {
    return undefined;
  }

  const result = await executor.query<StudentRow>(
    `SELECT ${STUDENT_COLUMNS} FROM students WHERE owner_id = $1 AND id = $2`,
    [ownerId, id]
  );
  return result.rows[0] ? mapStudent(result.rows[0]) : undefined;
}

export const studentRepository = {
  async findAll(ownerId: string, includeArchived = false): Promise<Student[]> {
    if (!isPositivePostgresBigintId(ownerId)) return [];

    const result = await pool.query<StudentRow>(
      `SELECT ${STUDENT_COLUMNS}
       FROM students
       WHERE owner_id = $1 AND ($2::boolean OR NOT archived)`,
      [ownerId, includeArchived]
    );
    return result.rows
      .map(mapStudent)
      .sort((a, b) => a.firstName.localeCompare(b.firstName, "ru"));
  },

  findById(ownerId: string, id: string): Promise<Student | undefined> {
    return findById(pool, ownerId, id);
  },

  async create(ownerId: string, dto: CreateStudentDto): Promise<Student> {
    if (!isPositivePostgresBigintId(ownerId)) throw new Error("Invalid owner ID");

    const result = await pool.query<StudentRow>(
      `INSERT INTO students
        (owner_id, first_name, last_name, default_lesson_price, phone, notes, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${STUDENT_COLUMNS}`,
      [
        ownerId,
        dto.firstName,
        dto.lastName,
        dto.defaultLessonPrice,
        dto.phone,
        dto.notes,
        dto.color,
      ]
    );
    return mapStudent(result.rows[0]);
  },

  async update(
    ownerId: string,
    id: string,
    dto: UpdateStudentDto
  ): Promise<Student | undefined> {
    if (!isPositivePostgresBigintId(ownerId) || !isPositivePostgresBigintId(id)) {
      return undefined;
    }

    const columnByField: Record<keyof UpdateStudentDto, string> = {
      firstName: "first_name",
      lastName: "last_name",
      defaultLessonPrice: "default_lesson_price",
      phone: "phone",
      notes: "notes",
      color: "color",
      archived: "archived",
    };
    const entries = Object.entries(dto) as [keyof UpdateStudentDto, unknown][];
    const values: unknown[] = [ownerId, id];
    const assignments = entries.map(([field, value], index) => {
      values.push(value);
      return `${columnByField[field]} = $${index + 3}`;
    });
    const result = await pool.query<StudentRow>(
      `UPDATE students
       SET ${assignments.join(", ")}, updated_at = now()
       WHERE owner_id = $1 AND id = $2
       RETURNING ${STUDENT_COLUMNS}`,
      values
    );
    return result.rows[0] ? mapStudent(result.rows[0]) : undefined;
  },

  async deleteIfNoLessons(
    ownerId: string,
    id: string
  ): Promise<"deleted" | "hasLessons" | "notFound"> {
    if (!isPositivePostgresBigintId(ownerId) || !isPositivePostgresBigintId(id)) {
      return "notFound";
    }

    return withTransaction(async (client) => {
      const student = await client.query(
        "SELECT id FROM students WHERE owner_id = $1 AND id = $2 FOR UPDATE",
        [ownerId, id]
      );
      if (student.rowCount !== 1) return "notFound";

      const lessons = await client.query<{ exists: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM lessons WHERE owner_id = $1 AND student_id = $2) AS exists",
        [ownerId, id]
      );
      if (lessons.rows[0].exists) return "hasLessons";

      await client.query("DELETE FROM students WHERE owner_id = $1 AND id = $2", [ownerId, id]);
      return "deleted";
    });
  },

  async claimOwnerless(ownerId: string): Promise<number> {
    if (!isPositivePostgresBigintId(ownerId)) return 0;

    const result = await pool.query(
      "UPDATE students SET owner_id = $1, updated_at = now() WHERE owner_id IS NULL",
      [ownerId]
    );
    return result.rowCount ?? 0;
  },
};
