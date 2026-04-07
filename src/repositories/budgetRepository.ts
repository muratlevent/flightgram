import type Database from "better-sqlite3";

export interface UserBudgetRow {
  user_id: string;
  budget_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

interface RawUserBudgetRow {
  user_id: string;
  budget_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

function mapUserBudgetRow(row: RawUserBudgetRow): UserBudgetRow {
  return {
    user_id: row.user_id,
    budget_amount: Number(row.budget_amount),
    currency: row.currency,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class BudgetRepository {
  constructor(private readonly db: Database.Database) {}

  /**
   * Get the budget for a user (if set).
   */
  async getBudget(userId: string): Promise<UserBudgetRow | null> {
    const row = this.db
      .prepare(`
        SELECT *
        FROM user_budgets
        WHERE user_id = ?
      `)
      .get(userId) as RawUserBudgetRow | undefined;

    return row ? mapUserBudgetRow(row) : null;
  }

  /**
   * Set or update the budget for a user.
   * Uses UPSERT to insert or replace existing budget.
   */
  async setBudget(
    userId: string,
    budgetAmount: number,
    currency: string,
  ): Promise<UserBudgetRow> {
    const now = new Date().toISOString();

    this.db
      .prepare(`
        INSERT INTO user_budgets (user_id, budget_amount, currency, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          budget_amount = excluded.budget_amount,
          currency = excluded.currency,
          updated_at = excluded.updated_at
      `)
      .run(userId, budgetAmount, currency, now, now);

    const budget = await this.getBudget(userId);
    if (!budget) {
      throw new Error("Failed to set budget: no row returned.");
    }

    return budget;
  }

  /**
   * Clear (delete) the budget for a user.
   * Returns true if a budget was deleted, false if none existed.
   */
  async clearBudget(userId: string): Promise<boolean> {
    const result = this.db
      .prepare(`
        DELETE FROM user_budgets
        WHERE user_id = ?
      `)
      .run(userId);

    return result.changes > 0;
  }

  /**
   * Get all users who have a budget set.
   * Used by PriceMonitorService to check budget alerts.
   */
  async getAllBudgets(): Promise<UserBudgetRow[]> {
    const rows = this.db
      .prepare(`
        SELECT *
        FROM user_budgets
      `)
      .all() as RawUserBudgetRow[];

    return rows.map(mapUserBudgetRow);
  }
}
