import type Database from "better-sqlite3";

import type { UserRow } from "../types/flight";

export class UserRepository {
  constructor(private readonly db: Database.Database) {}

  async upsertUser(
    telegramId: string,
    username?: string | null,
  ): Promise<UserRow> {
    const upsertUserStatement = this.db.prepare(`
      INSERT INTO users (telegram_id, username)
      VALUES (?, ?)
      ON CONFLICT(telegram_id) DO UPDATE SET
        username = excluded.username
    `);

    upsertUserStatement.run(telegramId, username ?? null);

    const selectUserStatement = this.db.prepare(`
      SELECT telegram_id, username, created_at
      FROM users
      WHERE telegram_id = ?
    `);
    const user = selectUserStatement.get(telegramId) as UserRow | undefined;

    if (!user) {
      throw new Error("Failed to upsert user: no row returned.");
    }

    return {
      ...user,
      username: user.username ?? null,
    };
  }
}
