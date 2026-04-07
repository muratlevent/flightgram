import { Markup, Scenes } from "telegraf";

import type { BudgetService } from "../../services/budgetService.js";
import type { BotContext } from "../context.js";
import { getMessageText } from "../context.js";

export const BUDGET_SCENE_ID = "budget";

interface BudgetSceneState {
  action?: "set" | "clear";
  budgetAmount?: number;
}

const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "TRY"];

export function createBudgetScene(
  budgetService: BudgetService,
): Scenes.WizardScene<BotContext> {
  const scene = new Scenes.WizardScene<BotContext>(
    BUDGET_SCENE_ID,
    // Step 0: Show current budget and ask what to do
    async (ctx) => {
      const userId = String(ctx.from?.id);
      const budget = await budgetService.getBudget(userId);

      if (budget) {
        await ctx.reply(
          [
            `Your current budget: ${budget.budget_amount} ${budget.currency}`,
            "",
            "What would you like to do?",
          ].join("\n"),
          Markup.inlineKeyboard([
            [Markup.button.callback("Update budget", "budget_set")],
            [Markup.button.callback("Clear budget", "budget_clear")],
            [Markup.button.callback("Cancel", "budget_cancel")],
          ]),
        );
      } else {
        await ctx.reply(
          [
            "You don't have a budget alert set yet.",
            "",
            "Set a budget to get notified when ANY tracked flight drops below your target price.",
            "",
            "Would you like to set one?",
          ].join("\n"),
          Markup.inlineKeyboard([
            [Markup.button.callback("Set budget", "budget_set")],
            [Markup.button.callback("Cancel", "budget_cancel")],
          ]),
        );
      }

      return ctx.wizard.next();
    },
    // Step 1: Handle action selection or budget amount input
    async (ctx) => {
      const state = ctx.scene.state as BudgetSceneState;

      // If action is already set (from callback), we're collecting budget amount
      if (state.action === "set") {
        const text = getMessageText(ctx);

        if (!text) {
          await ctx.reply("Please enter a budget amount (e.g., 500).");
          return;
        }

        const amount = Number.parseFloat(text.replace(/,/g, ""));

        if (Number.isNaN(amount) || amount <= 0) {
          await ctx.reply(
            "Please enter a valid positive number (e.g., 500 or 1000.50).",
          );
          return;
        }

        state.budgetAmount = amount;

        await ctx.reply(
          "Select currency:",
          Markup.inlineKeyboard([
            SUPPORTED_CURRENCIES.map((cur) =>
              Markup.button.callback(cur, `currency_${cur}`),
            ),
          ]),
        );

        return ctx.wizard.next();
      }

      // Shouldn't reach here normally (callbacks handle navigation)
      await ctx.reply("Please select an option from the buttons above.");
    },
    // Step 2: Handle currency selection and save
    async (ctx) => {
      // Currency is handled by callback, this step is a placeholder
      await ctx.reply("Please select a currency from the buttons above.");
    },
  );

  // Handle action callbacks
  scene.action("budget_set", async (ctx) => {
    await ctx.answerCbQuery();
    (ctx.scene.state as BudgetSceneState).action = "set";
    await ctx.reply("Enter your budget amount (e.g., 500):");
  });

  scene.action("budget_clear", async (ctx) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from?.id);
    const cleared = await budgetService.clearBudget(userId);

    if (cleared) {
      await ctx.reply("Your budget alert has been cleared.");
    } else {
      await ctx.reply("You didn't have a budget set.");
    }

    return ctx.scene.leave();
  });

  scene.action("budget_cancel", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply("Budget setup cancelled.");
    return ctx.scene.leave();
  });

  // Handle currency selection
  for (const currency of SUPPORTED_CURRENCIES) {
    scene.action(`currency_${currency}`, async (ctx) => {
      await ctx.answerCbQuery();

      const state = ctx.scene.state as BudgetSceneState;
      const userId = String(ctx.from?.id);

      if (!state.budgetAmount) {
        await ctx.reply("Something went wrong. Please start over with /budget.");
        return ctx.scene.leave();
      }

      const budget = await budgetService.setBudget(
        userId,
        state.budgetAmount,
        currency,
      );

      await ctx.reply(
        [
          "Budget alert set!",
          "",
          `Amount: ${budget.budget_amount} ${budget.currency}`,
          "",
          "You'll be notified when any of your tracked flights drops below this price.",
        ].join("\n"),
      );

      return ctx.scene.leave();
    });
  }

  scene.command("cancel", async (ctx) => {
    await ctx.reply("Budget setup cancelled.");
    return ctx.scene.leave();
  });

  return scene;
}
