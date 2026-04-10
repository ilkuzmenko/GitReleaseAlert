import { Pool } from "pg";
import { SubscriptionRecord, SubscriptionView } from "../../domain/models";

function mapSubscription(row: Record<string, unknown>): SubscriptionRecord {
  return {
    id: Number(row.id),
    email: row.email as string,
    repositoryId: Number(row.repository_id),
    isActive: row.is_active as boolean,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date
  };
}

export class SubscriptionsRepository {
  constructor(private readonly db: Pool) {}

  async createOrActivate(email: string, repositoryId: number): Promise<SubscriptionRecord> {
    const result = await this.db.query(
      `INSERT INTO subscriptions(email, repository_id, is_active)
       VALUES($1, $2, true)
       ON CONFLICT(email, repository_id)
       DO UPDATE SET is_active = true, updated_at = NOW()
       RETURNING *`,
      [email, repositoryId]
    );
    return mapSubscription(result.rows[0]);
  }

  async listAll(): Promise<SubscriptionView[]> {
    const result = await this.db.query(
      `SELECT s.id, s.email, s.is_active, s.created_at, r.full_name
       FROM subscriptions s
       JOIN repositories r ON r.id = s.repository_id
       WHERE s.is_active = true
       ORDER BY s.id ASC`
    );
    return result.rows.map((row: Record<string, unknown>) => ({
      id: Number(row.id),
      email: row.email as string,
      repository: row.full_name as string,
      isActive: row.is_active as boolean,
      createdAt: new Date(row.created_at as string).toISOString()
    }));
  }

  async deactivate(id: number): Promise<boolean> {
    const result = await this.db.query(
      `UPDATE subscriptions
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND is_active = true`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getActiveEmailsByRepositoryId(repositoryId: number): Promise<string[]> {
    const result = await this.db.query(
      `SELECT email FROM subscriptions WHERE repository_id = $1 AND is_active = true`,
      [repositoryId]
    );
    return result.rows.map((row: { email: string }) => row.email);
  }
}
