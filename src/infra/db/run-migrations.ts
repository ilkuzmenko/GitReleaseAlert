import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

async function resolveMigrationDir(): Promise<string> {
  const candidates = [
    path.join(__dirname, "migrations"),
    path.join(process.cwd(), "src/infra/db/migrations")
  ];

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) {
        return candidate;
      }
    } catch {}
  }

  throw new Error("Migrations directory not found");
}

export async function runMigrations(db: Pool): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const migrationDir = await resolveMigrationDir();
  const files = (await fs.readdir(migrationDir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const alreadyApplied = await db.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [file]);
    if (alreadyApplied.rowCount) {
      continue;
    }

    const sql = await fs.readFile(path.join(migrationDir, file), "utf8");
    await db.query("BEGIN");
    try {
      await db.query(sql);
      await db.query("INSERT INTO schema_migrations(filename) VALUES ($1)", [file]);
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    }
  }
}
