import { Scenes } from "telegraf";

import { env } from "../../config/env";
import { TrackedFlightService } from "../../services/trackedFlightService";
import {
  normalizeAirportCode,
  normalizeCurrencyCode,
  parseDateRange,
  parsePositivePrice,
} from "../../services/validation";
import type { AddFlightDraft, BotContext } from "../context";
import { formatTrackedFlightSummary } from "../formatters";
import { getMessageText } from "../context";

export const ADD_FLIGHT_SCENE_ID = "add-flight";

export function createAddFlightScene(
  trackedFlightService: TrackedFlightService,
): Scenes.WizardScene<BotContext> {
  const scene = new Scenes.WizardScene<BotContext>(
    ADD_FLIGHT_SCENE_ID,
    async (ctx) => {
      await ctx.reply("Send the 3-letter origin airport code. Example: IST");
      return ctx.wizard.next();
    },
    async (ctx) => {
      const text = getMessageText(ctx);

      if (!text) {
        await ctx.reply("Please send a text airport code.");
        return;
      }

      const originCode = normalizeAirportCode(text);

      if (!originCode) {
        await ctx.reply("Origin must be a valid 3-letter IATA code. Example: IST");
        return;
      }

      const draft = ctx.wizard.state as AddFlightDraft;
      draft.originCode = originCode;

      await ctx.reply(
        "Send the 3-letter destination airport code. Example: LHR",
      );
      return ctx.wizard.next();
    },
    async (ctx) => {
      const text = getMessageText(ctx);

      if (!text) {
        await ctx.reply("Please send a text airport code.");
        return;
      }

      const destinationCode = normalizeAirportCode(text);

      if (!destinationCode) {
        await ctx.reply(
          "Destination must be a valid 3-letter IATA code. Example: LHR",
        );
        return;
      }

      const draft = ctx.wizard.state as AddFlightDraft;

      if (draft.originCode === destinationCode) {
        await ctx.reply("Origin and destination cannot be the same airport.");
        return;
      }

      draft.destinationCode = destinationCode;

      await ctx.reply(
        "Send the departure date or date range.\n\n" +
          "Examples:\n" +
          "- Single date: 2026-05-01\n" +
          "- Date range: 2026-05-01 to 2026-05-15",
      );
      return ctx.wizard.next();
    },
    async (ctx) => {
      const text = getMessageText(ctx);

      if (!text) {
        await ctx.reply("Please send the departure date as text.");
        return;
      }

      const dateRange = parseDateRange(text);

      if (!dateRange) {
        await ctx.reply(
          "Invalid date format. Use YYYY-MM-DD for a single date, " +
            "or 'YYYY-MM-DD to YYYY-MM-DD' for a range.\n" +
            "Dates cannot be in the past.",
        );
        return;
      }

      const draft = ctx.wizard.state as AddFlightDraft;
      draft.departureDateStart = dateRange.start;
      draft.departureDateEnd = dateRange.end;

      await ctx.reply(
        `Send your target price in ${env.defaultCurrency}. Example: 120`,
      );
      return ctx.wizard.next();
    },
    async (ctx) => {
      const text = getMessageText(ctx);

      if (!text) {
        await ctx.reply("Please send the target price as text.");
        return;
      }

      const targetPrice = parsePositivePrice(text);

      if (!targetPrice) {
        await ctx.reply("Target price must be a positive number. Example: 120");
        return;
      }

      const draft = ctx.wizard.state as AddFlightDraft;
      draft.targetPrice = targetPrice;

      await ctx.reply(
        `Send the 3-letter currency code for your target price. Example: ${env.defaultCurrency}`,
      );
      return ctx.wizard.next();
    },
    async (ctx) => {
      const text = getMessageText(ctx);

      if (!text) {
        await ctx.reply("Please send the target currency code as text.");
        return;
      }

      const draft = ctx.wizard.state as AddFlightDraft;
      const currencyCode =
        text.trim().toUpperCase() === "DEFAULT"
          ? env.defaultCurrency
          : normalizeCurrencyCode(text);

      if (!currencyCode) {
        await ctx.reply(
          `Currency must be a valid 3-letter code. Example: ${env.defaultCurrency}`,
        );
        return;
      }

      if (
        !draft.originCode ||
        !draft.destinationCode ||
        !draft.departureDateStart ||
        !draft.departureDateEnd ||
        !draft.targetPrice
      ) {
        await ctx.reply("The current draft is incomplete. Please start again with /add.");
        return ctx.scene.leave();
      }

      const trackedFlight = await trackedFlightService.createTrackedFlight({
        userId: String(ctx.from?.id),
        username: ctx.from?.username ?? null,
        originCode: draft.originCode,
        destinationCode: draft.destinationCode,
        departureDateStart: draft.departureDateStart,
        departureDateEnd: draft.departureDateEnd,
        targetPrice: draft.targetPrice,
        currency: currencyCode,
      });

      await ctx.reply(
        `Tracking created successfully.\n\n${formatTrackedFlightSummary(trackedFlight)}`,
      );

      return ctx.scene.leave();
    },
  );

  scene.command("cancel", async (ctx) => {
    await ctx.reply("Flight creation cancelled.");
    return ctx.scene.leave();
  });

  return scene;
}
