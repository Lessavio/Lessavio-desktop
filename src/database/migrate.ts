import "../load-env";
import { closeDatabase, pool } from "./index";
import { migrations } from "./migrations";

const MIGRATION_LOCK_ID = 7_421_983_401;

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version integer PRIMARY KEY,
        name text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const applied = await client.query<{ version: number }>(
      "SELECT version FROM schema_migrations"
    );
    const appliedVersions = new Set(applied.rows.map((row) => row.version));

    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue;
      await client.query(migration.sql);
      await client.query(
        "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
        [migration.version, migration.name]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log("Database migrations completed");
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Database migration failed");
      process.exitCode = 1;
    })
    .finally(closeDatabase);
}
