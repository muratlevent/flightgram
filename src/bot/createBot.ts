import { Scenes, Telegraf, session } from "telegraf";

import { TrackedFlightService } from "../services/trackedFlightService.js";
import type { BotContext } from "./context.js";
import { createAddFlightScene } from "./scenes/addFlightScene.js";
import { createDeleteFlightScene } from "./scenes/deleteFlightScene.js";
import { formatTrackedFlightList } from "./formatters.js";

interface CreateBotOptions {
  token: string;
  trackedFlightService: TrackedFlightService;
}

export function createBot(options: CreateBotOptions): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(options.token);
  const addFlightScene = createAddFlightScene(options.trackedFlightService);
  const deleteFlightScene = createDeleteFlightScene(options.trackedFlightService);
  const stage = new Scenes.Stage<BotContext>([
    addFlightScene,
    deleteFlightScene,
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
        "Use /add to create a new flight price tracker.",
        "Use /list to see your active trackers.",
        "Use /delete to remove a tracker.",
        "Use /cancel to stop the current conversation.",
      ].join("\n"),
    );
  });

  bot.command("add", async (ctx) => ctx.scene.enter("add-flight"));

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

  bot.command("cancel", async (ctx) => {
    await ctx.reply("There is no active conversation to cancel right now.");
  });

  bot.catch(async (error, ctx) => {
    console.error("[bot] Unhandled bot error", error);
    await ctx.reply("Something went wrong while processing your request.");
  });

  return bot;
}
