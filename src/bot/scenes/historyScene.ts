import { Scenes } from "telegraf";

import type { PriceHistoryService } from "../../services/priceHistoryService.js";
import type { TrackedFlightRow } from "../../types/flight.js";
import type { BotContext } from "../context.js";
import { formatTrackedFlightList } from "../formatters.js";
import { getMessageText } from "../context.js";

export const HISTORY_SCENE_ID = "price-history";

interface HistorySceneState {
  flights?: TrackedFlightRow[];
}

export function createHistoryScene(
  priceHistoryService: PriceHistoryService,
  listActiveFlights: (userId: string) => Promise<TrackedFlightRow[]>,
): Scenes.WizardScene<BotContext> {
  const scene = new Scenes.WizardScene<BotContext>(
    HISTORY_SCENE_ID,
    async (ctx) => {
      const userId = String(ctx.from?.id);
      const flights = await listActiveFlights(userId);

      if (flights.length === 0) {
        await ctx.reply(
          "You do not have any active tracked flights. Use /add to create one.",
        );
        return ctx.scene.leave();
      }

      // Store flights in scene state for quick lookup
      (ctx.scene.state as HistorySceneState).flights = flights;

      await ctx.reply(
        `Send the tracking ID to view price history.\n\n${formatTrackedFlightList(flights)}`,
      );
      return ctx.wizard.next();
    },
    async (ctx) => {
      const text = getMessageText(ctx);

      if (!text) {
        await ctx.reply("Please send the tracking ID as text.");
        return;
      }

      const userId = String(ctx.from?.id);

      // Try to get history for the provided ID
      const result = await priceHistoryService.getFlightHistory(text, userId, 14);

      if (!result) {
        await ctx.reply(
          "I could not find an active tracked flight with that ID. Send another ID or /cancel.",
        );
        return;
      }

      const message = priceHistoryService.formatHistoryMessage(result);
      await ctx.reply(message, { parse_mode: "HTML" });

      return ctx.scene.leave();
    },
  );

  scene.command("cancel", async (ctx) => {
    await ctx.reply("History view cancelled.");
    return ctx.scene.leave();
  });

  return scene;
}
