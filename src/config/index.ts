import "../load-env";

const nodeEnv = process.env.NODE_ENV || "development";
const configuredSessionSecret = process.env.SESSION_SECRET;
const configuredDatabaseUrl = process.env.DATABASE_URL;

if (nodeEnv === "production" && !configuredSessionSecret) {
  throw new Error("SESSION_SECRET is required when NODE_ENV=production");
}

if (!configuredDatabaseUrl) {
  throw new Error("DATABASE_URL is required. Set it in .env.local or .env");
}

const databaseUrl = configuredDatabaseUrl.replace(
  /([?&])sslmode=(prefer|require|verify-ca)(?=&|$)/,
  "$1sslmode=verify-full"
);

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv,
  databaseUrl,
  sessionSecret: configuredSessionSecret || "tutorly-development-session-secret",
  isProduction: nodeEnv === "production",
};
