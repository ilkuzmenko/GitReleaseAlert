import dotenv from "dotenv";

dotenv.config();

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: env("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/release_alert"),
  githubToken: process.env.GITHUB_TOKEN ?? "",
  scanIntervalMs: Number(process.env.SCAN_INTERVAL_MS ?? 60000),
  smtpHost: env("SMTP_HOST", "localhost"),
  smtpPort: Number(process.env.SMTP_PORT ?? 1025),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFrom: env("SMTP_FROM", "alerts@example.com"),
  apiKey: process.env.API_KEY ?? ""
};
