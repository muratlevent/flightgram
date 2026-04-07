import { Scenes, Telegraf, session } from "telegraf";

import type { BudgetService } from "../services/budgetService.js";
import { FlightSearchService } from "../services/flightSearchService.js";
import { PriceHistoryService } from "../services/priceHistoryService.js";
import { TrackedFlightService } from "../services/trackedFlightService.js";
import type { BotContext } from "./context.js";
import { createAddFlightScene } from "./scenes/addFlightScene.js";
import { createBudgetScene } from "./scenes/budgetScene.js";
import { createCheapestDatesScene } from "./scenes/cheapestDatesScene.js";
import { createDeleteFlightScene } from "./scenes/deleteFlightScene.js";
import { createHistoryScene } from "./scenes/historyScene.js";
import { createSearchScene } from "./scenes/searchScene.js";
import { formatTrackedFlightList } from "./formatters.js";

interface CreateBotOptions {
  token: string;
  trackedFlightService: TrackedFlightService;
  flightSearchService: FlightSearchService;
  priceHistoryService: PriceHistoryService;
  budgetService: BudgetService;
}

export function createBot(options: CreateBotOptions): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(options.token);
  const addFlightScene = createAddFlightScene(options.trackedFlightService);
  const budgetScene = createBudgetScene(options.budgetService);
  const cheapestDatesScene = createCheapestDatesScene(options.flightSearchService);
  const deleteFlightScene = createDeleteFlightScene(options.trackedFlightService);
  const historyScene = createHistoryScene(
    options.priceHistoryService,
    (userId) => options.trackedFlightService.listActiveTrackedFlights(userId),
  );
  const searchScene = createSearchScene(options.flightSearchService);
  const stage = new Scenes.Stage<BotContext>([
    addFlightScene,
    budgetScene,
    cheapestDatesScene,
    deleteFlightScene,
    historyScene,
    searchScene,
  ]);

  bot.use(session());
  bot.use(stage.middleware());

  bot.start(async (ctx) => {
    await options.trackedFlightService.registerUser(
      String(ctx.from.id),
      ctx.from.username ?? null,
    );

    await ctx.reply(
      [
        "Welcome to Flightgram.",
        "Use /search to search for flights (one-time).",
        "Use /cheapest to find the cheapest travel dates.",
        "Use /add to create a new flight price tracker.",
        "Use /list to see your active trackers.",
        "Use /history to view price history for a tracker.",
        "Use /budget to set a budget alert for all flights.",
        "Use /delete to remove a tracker.",
        "Use /cancel to stop the current conversation.",
      ].join("\n"),
    );
  });

  bot.command("add", async (ctx) => ctx.scene.enter("add-flight"));

  bot.command("search", async (ctx) => ctx.scene.enter("search-flight"));

  bot.command("cheapest", async (ctx) => ctx.scene.enter("cheapest-dates"));

  bot.command("list", async (ctx) => {
    const trackedFlights =
      await options.trackedFlightService.listActiveTrackedFlights(
        String(ctx.from.id),
      );

    if (trackedFlights.length === 0) {
      await ctx.reply(
        "You do not have any active tracked flights yet. Use /add to create one.",
      );
      return;
    }

    await ctx.reply(`Your active tracked flights:\n\n${formatTrackedFlightList(trackedFlights)}`);
  });

  bot.command("delete", async (ctx) => ctx.scene.enter("delete-flight"));

  bot.command("history", async (ctx) => ctx.scene.enter("price-history"));

  bot.command("budget", async (ctx) => ctx.scene.enter("budget"));

  bot.command("cancel", async (ctx) => {
    await ctx.reply("There is no active conversation to cancel right now.");
  });

  bot.catch(async (error, ctx) => {
    console.error("[bot] Unhandled bot error", error);
    await ctx.reply("Something went wrong while processing your request.");
  });

  return bot;
}
