import { QueryResultRow } from "pg";
import { isPositivePostgresBigintId } from "../../common/postgres-bigint-id";
import { pool, QueryExecutor, withTransaction } from "../../database";
import { CreateUserDto, Currency, User } from "./user.model";

interface UserRow extends QueryResultRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  currency: Currency;
  created_at: Date;
  updated_at: Date;
}

const USER_COLUMNS = `
  id, name, email, password_hash, currency, created_at, updated_at
`;

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findById(executor: QueryExecutor, id: string): Promise<User | undefined> {
  if (!isPositivePostgresBigintId(id)) return undefined;

  const result = await executor.query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? mapUser(result.rows[0]) : undefined;
}

export const userRepository = {
  async count(): Promise<number> {
    const result = await pool.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM users");
    return result.rows[0].count;
  },

  findById(id: string): Promise<User | undefined> {
    return findById(pool, id);
  },

  async findByEmail(email: string): Promise<User | undefined> {
    const result = await pool.query<UserRow>(
      `SELECT ${USER_COLUMNS} FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    return result.rows[0] ? mapUser(result.rows[0]) : undefined;
  },

  async create(dto: CreateUserDto): Promise<User | undefined> {
    return withTransaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('tutorly:first-user', 0))"
      );
      const countResult = await client.query<{ count: number }>(
        "SELECT COUNT(*)::int AS count FROM users"
      );
      const result = await client.query<UserRow>(
        `INSERT INTO users (name, email, password_hash, currency)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO NOTHING
         RETURNING ${USER_COLUMNS}`,
        [dto.name, dto.email.toLowerCase(), dto.passwordHash, dto.currency]
      );
      const row = result.rows[0];
      if (!row) return undefined;

      if (countResult.rows[0].count === 0) {
        await client.query(
          "UPDATE students SET owner_id = $1, updated_at = now() WHERE owner_id IS NULL",
          [row.id]
        );
        await client.query(
          "UPDATE lessons SET owner_id = $1, updated_at = now() WHERE owner_id IS NULL",
          [row.id]
        );
      }

      return mapUser(row);
    });
  },
};
