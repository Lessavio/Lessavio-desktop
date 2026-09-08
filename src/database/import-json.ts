import "../load-env";
import fs from "fs";
import path from "path";
import { PoolClient, QueryResultRow } from "pg";
import { isPositivePostgresBigintId } from "../common/postgres-bigint-id";
import { LESSON_STATUSES, LessonStatus } from "../modules/lesson/lesson.model";
import { closeDatabase, pool } from "./index";

interface ImportedUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  currency: "UAH";
  createdAt: Date;
  updatedAt: Date;
}

interface ImportedStudent {
  id: string;
  ownerId: string | null;
  firstName: string;
  lastName: string | null;
  defaultLessonPrice: number;
  phone: string | null;
  notes: string | null;
  color: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ImportedLesson {
  id: string;
  ownerId: string | null;
  studentId: string;
  startsAt: Date;
  durationMinutes: number;
  price: number;
  status: LessonStatus;
  isPaid: boolean;
  paidAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ExistingUserRow extends QueryResultRow {
  id: string;
  email: string;
}

interface ImportCounts {
  users: number;
  students: number;
  lessons: number;
}

const IMPORT_LOCK_ID = 7_421_983_402;
const dataDirectory = path.resolve(__dirname, "../../data");

function invalidImportData(): never {
  throw new Error("Invalid JSON import data");
}

function readCollection(name: string): unknown[] {
  const parsed: unknown = JSON.parse(
    fs.readFileSync(path.join(dataDirectory, `${name}.json`), "utf8")
  );
  if (!Array.isArray(parsed)) invalidImportData();
  return parsed;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return invalidImportData();
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string") return invalidImportData();
  return value;
}

function nullableString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return requiredString(value);
}

function requiredId(value: unknown): string {
  if (!isPositivePostgresBigintId(value)) return invalidImportData();
  return value;
}

function legacyOwnerId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requiredId(value);
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") return invalidImportData();
  return value;
}

function requiredPrice(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return invalidImportData();
  }
  return value;
}

function requiredDuration(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 15 ||
    value > 480
  ) {
    return invalidImportData();
  }
  return value;
}

function requiredDate(value: unknown): Date {
  const text = requiredString(value);
  const result = new Date(text);
  if (Number.isNaN(result.getTime())) return invalidImportData();
  return result;
}

function nullableDate(value: unknown): Date | null {
  if (value === undefined || value === null) return null;
  return requiredDate(value);
}

function requiredStatus(value: unknown): LessonStatus {
  if (typeof value !== "string" || !LESSON_STATUSES.includes(value as LessonStatus)) {
    return invalidImportData();
  }
  return value as LessonStatus;
}

function assertUniqueIds(collection: string, values: { id: string }[]): void {
  const ids = new Set<string>();
  for (const value of values) {
    if (ids.has(value.id)) throw new Error(`Duplicate ID in ${collection}: ${value.id}`);
    ids.add(value.id);
  }
}

function validateUsers(values: unknown[]): ImportedUser[] {
  const users = values.map((value): ImportedUser => {
    const user = asRecord(value);
    const currency = requiredString(user.currency);
    if (currency !== "UAH") return invalidImportData();

    return {
      id: requiredId(user.id),
      name: requiredString(user.name),
      email: requiredString(user.email).trim().toLowerCase(),
      passwordHash: requiredString(user.passwordHash),
      currency,
      createdAt: requiredDate(user.createdAt),
      updatedAt: requiredDate(user.updatedAt),
    };
  });

  const userIdByEmail = new Map<string, string>();
  for (const user of users) {
    const existingId = userIdByEmail.get(user.email);
    if (existingId !== undefined && existingId !== user.id) invalidImportData();
    userIdByEmail.set(user.email, user.id);
  }

  return users;
}

function validateStudents(values: unknown[]): ImportedStudent[] {
  return values.map((value): ImportedStudent => {
    const student = asRecord(value);
    return {
      id: requiredId(student.id),
      ownerId: legacyOwnerId(student.ownerId),
      firstName: requiredString(student.firstName),
      lastName: nullableString(student.lastName),
      defaultLessonPrice: requiredPrice(student.defaultLessonPrice),
      phone: nullableString(student.phone),
      notes: nullableString(student.notes),
      color: requiredString(student.color),
      archived: requiredBoolean(student.archived),
      createdAt: requiredDate(student.createdAt),
      updatedAt: requiredDate(student.updatedAt),
    };
  });
}

function validateLessons(values: unknown[]): ImportedLesson[] {
  return values.map((value): ImportedLesson => {
    const lesson = asRecord(value);
    return {
      id: requiredId(lesson.id),
      ownerId: legacyOwnerId(lesson.ownerId),
      studentId: requiredId(lesson.studentId),
      startsAt: requiredDate(lesson.startsAt),
      durationMinutes: requiredDuration(lesson.durationMinutes),
      price: requiredPrice(lesson.price),
      status: requiredStatus(lesson.status),
      isPaid: requiredBoolean(lesson.isPaid),
      paidAt: nullableDate(lesson.paidAt),
      notes: nullableString(lesson.notes),
      createdAt: requiredDate(lesson.createdAt),
      updatedAt: requiredDate(lesson.updatedAt),
    };
  });
}

function validateImportGraph(
  users: ImportedUser[],
  students: ImportedStudent[],
  lessons: ImportedLesson[]
): void {
  assertUniqueIds("users", users);
  assertUniqueIds("students", students);
  assertUniqueIds("lessons", lessons);

  const userIds = new Set(users.map((user) => user.id));
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const hasOwnerlessRecords = students.some((student) => student.ownerId === null)
    || lessons.some((lesson) => lesson.ownerId === null);

  if (users.length > 0 && hasOwnerlessRecords) {
    throw new Error("Ownerless records cannot be imported together with users");
  }

  for (const student of students) {
    if (student.ownerId !== null && !userIds.has(student.ownerId)) {
      throw new Error(`Student ${student.id} references an unknown owner`);
    }
  }

  for (const lesson of lessons) {
    const student = studentsById.get(lesson.studentId);
    if (!student) throw new Error(`Lesson ${lesson.id} references an unknown student`);
    if (lesson.ownerId !== student.ownerId) {
      throw new Error(`Lesson ${lesson.id} owner does not match its student`);
    }
  }
}

async function isDatabaseEmpty(client: PoolClient): Promise<boolean> {
  const result = await client.query<{ is_empty: boolean }>(`
    SELECT
      NOT EXISTS (SELECT 1 FROM users)
      AND NOT EXISTS (SELECT 1 FROM students)
      AND NOT EXISTS (SELECT 1 FROM lessons) AS is_empty
  `);
  return result.rows[0].is_empty;
}

async function ensureNoForceEmailConflicts(
  client: PoolClient,
  users: ImportedUser[]
): Promise<void> {
  if (users.length === 0) return;

  const userIdByEmail = new Map(users.map((user) => [user.email, user.id]));
  const result = await client.query<ExistingUserRow>(
    "SELECT id, email FROM users WHERE email = ANY($1::text[])",
    [users.map((user) => user.email)]
  );
  if (result.rows.some((row) => userIdByEmail.get(row.email) !== row.id)) {
    throw new Error("JSON import conflicts with existing users");
  }
}

async function importUsers(client: PoolClient, users: ImportedUser[]): Promise<void> {
  for (const user of users) {
    await client.query(
      `INSERT INTO users
        (id, name, email, password_hash, currency, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         password_hash = EXCLUDED.password_hash,
         currency = EXCLUDED.currency,
         created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at`,
      [
        user.id,
        user.name,
        user.email,
        user.passwordHash,
        user.currency,
        user.createdAt,
        user.updatedAt,
      ]
    );
  }
}

async function importStudents(client: PoolClient, students: ImportedStudent[]): Promise<void> {
  for (const student of students) {
    await client.query(
      `INSERT INTO students
        (id, owner_id, first_name, last_name, default_lesson_price, phone, notes,
         color, archived, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         owner_id = EXCLUDED.owner_id,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         default_lesson_price = EXCLUDED.default_lesson_price,
         phone = EXCLUDED.phone,
         notes = EXCLUDED.notes,
         color = EXCLUDED.color,
         archived = EXCLUDED.archived,
         created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at`,
      [
        student.id,
        student.ownerId,
        student.firstName,
        student.lastName,
        student.defaultLessonPrice,
        student.phone,
        student.notes,
        student.color,
        student.archived,
        student.createdAt,
        student.updatedAt,
      ]
    );
  }
}

async function importLessons(client: PoolClient, lessons: ImportedLesson[]): Promise<void> {
  for (const lesson of lessons) {
    await client.query(
      `INSERT INTO lessons
        (id, owner_id, student_id, starts_at, duration_minutes, price, status,
         is_paid, paid_at, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET
         owner_id = EXCLUDED.owner_id,
         student_id = EXCLUDED.student_id,
         starts_at = EXCLUDED.starts_at,
         duration_minutes = EXCLUDED.duration_minutes,
         price = EXCLUDED.price,
         status = EXCLUDED.status,
         is_paid = EXCLUDED.is_paid,
         paid_at = EXCLUDED.paid_at,
         notes = EXCLUDED.notes,
         created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at`,
      [
        lesson.id,
        lesson.ownerId,
        lesson.studentId,
        lesson.startsAt,
        lesson.durationMinutes,
        lesson.price,
        lesson.status,
        lesson.isPaid,
        lesson.paidAt,
        lesson.notes,
        lesson.createdAt,
        lesson.updatedAt,
      ]
    );
  }
}

async function resetIdentitySequences(client: PoolClient): Promise<void> {
  for (const table of ["users", "students", "lessons"]) {
    await client.query(
      `SELECT setval(
         pg_get_serial_sequence($1, 'id'),
         COALESCE(sequence_state.max_id, 1),
         sequence_state.max_id IS NOT NULL
       )
       FROM (SELECT MAX(id) AS max_id FROM ${table}) AS sequence_state`,
      [table]
    );
  }
}

export async function importJson(force = false): Promise<ImportCounts> {
  const users = validateUsers(readCollection("users"));
  const students = validateStudents(readCollection("students"));
  const lessons = validateLessons(readCollection("lessons"));
  validateImportGraph(users, students, lessons);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [IMPORT_LOCK_ID]);
    await client.query("LOCK TABLE users, students, lessons IN ACCESS EXCLUSIVE MODE");
    if (!force && !(await isDatabaseEmpty(client))) {
      throw new Error("Database is not empty; use --force to upsert");
    }
    if (force) await ensureNoForceEmailConflicts(client, users);
    await importUsers(client, users);
    await importStudents(client, students);
    await importLessons(client, lessons);
    await resetIdentitySequences(client);
    await client.query("COMMIT");
    return { users: users.length, students: students.length, lessons: lessons.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  importJson(process.argv.includes("--force"))
    .then((counts) => console.log(JSON.stringify(counts)))
    .catch(() => {
      console.error("JSON import failed");
      process.exitCode = 1;
    })
    .finally(closeDatabase);
}
