import {
  BudgetRepository,
  type UserBudgetRow,
} from "../repositories/budgetRepository.js";

export class BudgetService {
  constructor(private readonly budgetRepository: BudgetRepository) {}

  /**
   * Get the user's current budget.
   */
  async getBudget(userId: string): Promise<UserBudgetRow | null> {
    return this.budgetRepository.getBudget(userId);
  }

  /**
   * Set or update the user's budget.
   */
  async setBudget(
    userId: string,
    budgetAmount: number,
    currency: string,
  ): Promise<UserBudgetRow> {
    return this.budgetRepository.setBudget(userId, budgetAmount, currency);
  }

  /**
   * Clear the user's budget.
   */
  async clearBudget(userId: string): Promise<boolean> {
    return this.budgetRepository.clearBudget(userId);
  }

  /**
   * Get all user budgets (for price monitoring).
   */
  async getAllBudgets(): Promise<UserBudgetRow[]> {
    return this.budgetRepository.getAllBudgets();
  }

  /**
   * Format budget info for display.
   */
  formatBudgetMessage(budget: UserBudgetRow): string {
    const lines = [
      "Your current budget alert:",
      "",
      `Amount: ${budget.budget_amount} ${budget.currency}`,
      `Set on: ${new Date(budget.created_at).toLocaleDateString()}`,
      "",
      "You'll be alerted when ANY tracked flight drops below this price.",
      "",
      "Commands:",
      "/budget - Update or clear your budget",
    ];

    return lines.join("\n");
  }

  /**
   * Format the "no budget set" message.
   */
  formatNoBudgetMessage(): string {
    return [
      "You don't have a budget alert set.",
      "",
      "Set a budget to get notified when ANY of your tracked flights drops below a certain price.",
      "",
      "Use /budget to set one now.",
    ].join("\n");
  }
}
