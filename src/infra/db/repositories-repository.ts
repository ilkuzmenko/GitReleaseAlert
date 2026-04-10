import { Pool } from "pg";
import { ReleaseInfo, RepositoryRecord } from "../../domain/models";

function mapRepository(row: Record<string, unknown>): RepositoryRecord {
  return {
    id: Number(row.id),
    owner: row.owner as string,
    name: row.name as string,
    fullName: row.full_name as string,
    lastSeenTag: row.last_seen_tag as string | null,
    lastReleasePublishedAt: row.last_release_published_at as Date | null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date
  };
}

export class RepositoriesRepository {
  constructor(private readonly db: Pool) {}

  async findByFullName(fullName: string): Promise<RepositoryRecord | null> {
    const result = await this.db.query("SELECT * FROM repositories WHERE full_name = $1 LIMIT 1", [fullName]);
    return result.rows[0] ? mapRepository(result.rows[0]) : null;
  }

  async upsert(owner: string, name: string): Promise<RepositoryRecord> {
    const fullName = `${owner}/${name}`;
    const result = await this.db.query(
      `INSERT INTO repositories(owner, name, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT(full_name)
       DO UPDATE SET owner = EXCLUDED.owner, name = EXCLUDED.name, updated_at = NOW()
       RETURNING *`,
      [owner, name, fullName]
    );
    return mapRepository(result.rows[0]);
  }

  async updateLastSeen(repositoryId: number, release: ReleaseInfo): Promise<void> {
    await this.db.query(
      `UPDATE repositories
       SET last_seen_tag = $2,
           last_release_published_at = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [repositoryId, release.tagName, release.publishedAt]
    );
  }

  async getRepositoriesWithActiveSubscriptions(): Promise<RepositoryRecord[]> {
    const result = await this.db.query(
      `SELECT r.*
       FROM repositories r
       JOIN subscriptions s ON s.repository_id = r.id
       WHERE s.is_active = true
       GROUP BY r.id
       ORDER BY r.id`
    );
    return result.rows.map(mapRepository);
  }
}
