const nodeEnv = process.env.NODE_ENV || "development";
const configuredSessionSecret = process.env.SESSION_SECRET;

if (nodeEnv === "production" && !configuredSessionSecret) {
  throw new Error("SESSION_SECRET is required when NODE_ENV=production");
}

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv,
  sessionSecret: configuredSessionSecret || "tutorly-development-session-secret",
  isProduction: nodeEnv === "production",
};
