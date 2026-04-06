import { Scenes } from "telegraf";

import { TrackedFlightService } from "../../services/trackedFlightService";
import type { BotContext } from "../context";
import { formatTrackedFlightList, formatTrackedFlightSummary } from "../formatters";
import { getMessageText } from "../context";

export const DELETE_FLIGHT_SCENE_ID = "delete-flight";

export function createDeleteFlightScene(
  trackedFlightService: TrackedFlightService,
): Scenes.WizardScene<BotContext> {
  const scene = new Scenes.WizardScene<BotContext>(
    DELETE_FLIGHT_SCENE_ID,
    async (ctx) => {
      const trackedFlights = await trackedFlightService.listActiveTrackedFlights(
        String(ctx.from?.id),
      );

      if (trackedFlights.length === 0) {
        await ctx.reply("You do not have any active tracked flights to delete.");
        return ctx.scene.leave();
      }

      await ctx.reply(
        `Send the tracking ID you want to delete.\n\n${formatTrackedFlightList(trackedFlights)}`,
      );
      return ctx.wizard.next();
    },
    async (ctx) => {
      const text = getMessageText(ctx);

      if (!text) {
        await ctx.reply("Please send the tracking ID as text.");
        return;
      }

      const deletedFlight = await trackedFlightService.deleteTrackedFlight(
        String(ctx.from?.id),
        text,
      );

      if (!deletedFlight) {
        await ctx.reply(
          "I could not find an active tracked flight with that ID. Send another ID or /cancel.",
        );
        return;
      }

      await ctx.reply(
        `Tracking deleted successfully.\n\n${formatTrackedFlightSummary(deletedFlight)}`,
      );

      return ctx.scene.leave();
    },
  );

  scene.command("cancel", async (ctx) => {
    await ctx.reply("Delete flow cancelled.");
    return ctx.scene.leave();
  });

  return scene;
}
