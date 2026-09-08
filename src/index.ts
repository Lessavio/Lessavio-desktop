import "./load-env";
import { Server } from "http";
import { app } from "./app";
import { config } from "./config";
import { closeDatabase } from "./database";
import { runMigrations } from "./database/migrate";

let server: Server | undefined;

async function start(): Promise<void> {
  await runMigrations();
  server = app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
  });
}

function shutdown(): void {
  if (!server) {
    closeDatabase().finally(() => process.exit(0));
    return;
  }

  server.close(() => {
    closeDatabase()
      .catch((error: unknown) => console.error("Database shutdown failed", error))
      .finally(() => process.exit(0));
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

start().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : "Server startup failed");
  await closeDatabase().catch(() => undefined);
  process.exit(1);
});
