import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  // No default in production: a predictable secret would let anyone forge tokens.
  jwtSecret: required("JWT_SECRET", process.env.NODE_ENV === "production" ? undefined : "dev-only-secret"),
  mlServiceUrl: process.env.ML_SERVICE_URL ?? "http://localhost:8000",
  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "smart_electricity",
  },
};

if (process.env.NODE_ENV === "production" && (config.jwtSecret.length < 32 || config.jwtSecret === "dev-only-secret")) {
  throw new Error("JWT_SECRET must contain at least 32 characters in production");
}
