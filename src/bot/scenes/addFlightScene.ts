import { Scenes } from "telegraf";

import { env } from "../../config/env.js";
import { TrackedFlightService } from "../../services/trackedFlightService.js";
import {
  isSkip,
  normalizeAirportCode,
  normalizeCurrencyCode,
  parseAirlines,
  parseCabinClass,
  parseDateRange,
  parseMaxStops,
  parsePassengers,
  parsePositivePrice,
  parseTimeWindow,
} from "../../services/validation.js";
import {
  CABIN_CLASS_EMOJIS,
  CABIN_CLASS_LABELS,
  MAX_STOPS_EMOJIS,
  MAX_STOPS_LABELS,
} from "../../types/flightOptions.js";
import type { AddFlightDraft, BotContext } from "../context.js";
import { formatTrackedFlightSummary } from "../formatters.js";
import { getMessageText } from "../context.js";

export const ADD_FLIGHT_SCENE_ID = "add-flight";

/**
 * Wizard steps:
 * 0. Ask origin
 * 1. Ask destination
 * 2. Ask departure date/range
 * 3. Ask return date (round-trip) - OPTIONAL
 * 4. Ask cabin class - OPTIONAL
 * 5. Ask max stops - OPTIONAL
 * 6. Ask airlines - OPTIONAL
 * 7. Ask departure time window - OPTIONAL
 * 8. Ask passengers - OPTIONAL
 * 9. Ask target price
 * 10. Ask currency - then create
 */

export function createAddFlightScene(
  trackedFlightService: TrackedFlightService,
): Scenes.WizardScene<BotContext> {
  const scene = new Scenes.WizardScene<BotContext>(
    ADD_FLIGHT_SCENE_ID,

    // Step 0: Ask origin
    async (ctx) => {
      await ctx.reply(
        "Let's track a flight!\n\n" +
        "Send the 3-letter origin airport code.\n" +
        "Example: IST"
      );
      return ctx.wizard.next();
    },

    // Step 1: Process origin, ask destination
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
        "Send the 3-letter destination airport code.\n" +
        "Example: LHR"
      );
      return ctx.wizard.next();
    },

    // Step 2: Process destination, ask departure date
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send a text airport code.");
        return;
      }

      const destinationCode = normalizeAirportCode(text);
      if (!destinationCode) {
        await ctx.reply("Destination must be a valid 3-letter IATA code. Example: LHR");
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
        "- Date range: 2026-05-01 to 2026-05-15"
      );
      return ctx.wizard.next();
    },

    // Step 3: Process departure date, ask return date
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
          "Dates cannot be in the past."
        );
        return;
      }

      const draft = ctx.wizard.state as AddFlightDraft;
      draft.departureDateStart = dateRange.start;
      draft.departureDateEnd = dateRange.end;

      await ctx.reply(
        "Is this a round-trip? Send the return date or range.\n\n" +
        "Examples:\n" +
        "- Single date: 2026-05-10\n" +
        "- Date range: 2026-05-10 to 2026-05-20\n\n" +
        "Type 'skip' for one-way flight."
      );
      return ctx.wizard.next();
    },

    // Step 4: Process return date, ask cabin class
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send the return date or 'skip'.");
        return;
      }

      const draft = ctx.wizard.state as AddFlightDraft;

      if (!isSkip(text)) {
        const returnRange = parseDateRange(text);
        if (!returnRange) {
          await ctx.reply(
            "Invalid date format. Use YYYY-MM-DD or 'YYYY-MM-DD to YYYY-MM-DD'.\n" +
            "Type 'skip' for one-way flight."
          );
          return;
        }

        // Validate return is after departure
        if (returnRange.start < (draft.departureDateStart ?? "")) {
          await ctx.reply("Return date must be after departure date. Try again.");
          return;
        }

        draft.returnDateStart = returnRange.start;
        draft.returnDateEnd = returnRange.end;
      }

      // Build cabin class options
      const cabinOptions = Object.entries(CABIN_CLASS_LABELS)
        .map(([key, label], i) => `${i + 1}. ${CABIN_CLASS_EMOJIS[key as keyof typeof CABIN_CLASS_EMOJIS]} ${label}`)
        .join("\n");

      await ctx.reply(
        "Select cabin class:\n\n" +
        cabinOptions + "\n\n" +
        "Send a number (1-4) or type 'skip' for Economy."
      );
      return ctx.wizard.next();
    },

    // Step 5: Process cabin class, ask max stops
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send a cabin class selection or 'skip'.");
        return;
      }

      const draft = ctx.wizard.state as AddFlightDraft;

      if (!isSkip(text)) {
        const cabinClass = parseCabinClass(text);
        if (!cabinClass) {
          await ctx.reply("Invalid selection. Send 1-4 or type 'skip'.");
          return;
        }
        draft.cabinClass = cabinClass;
      }

      // Build max stops options
      const stopsOptions = Object.entries(MAX_STOPS_LABELS)
        .map(([key, label], i) => `${i + 1}. ${MAX_STOPS_EMOJIS[key as keyof typeof MAX_STOPS_EMOJIS]} ${label}`)
        .join("\n");

      await ctx.reply(
        "Select maximum stops:\n\n" +
        stopsOptions + "\n\n" +
        "Send a number (1-4) or type 'skip' for any."
      );
      return ctx.wizard.next();
    },

    // Step 6: Process max stops, ask airlines
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send a stops selection or 'skip'.");
        return;
      }

      const draft = ctx.wizard.state as AddFlightDraft;

      if (!isSkip(text)) {
        const maxStops = parseMaxStops(text);
        if (!maxStops) {
          await ctx.reply("Invalid selection. Send 1-4 or type 'skip'.");
          return;
        }
        draft.maxStops = maxStops;
      }

      await ctx.reply(
        "Filter by airlines? Send airline codes separated by commas.\n\n" +
        "Examples:\n" +
        "- TK, LH, BA\n" +
        "- TK\n\n" +
        "Type 'skip' for all airlines."
      );
      return ctx.wizard.next();
    },

    // Step 7: Process airlines, ask time window
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send airline codes or 'skip'.");
        return;
      }

      const draft = ctx.wizard.state as AddFlightDraft;

      if (!isSkip(text)) {
        const airlines = parseAirlines(text);
        if (!airlines) {
          await ctx.reply(
            "Invalid airline codes. Use 2-3 letter IATA codes separated by commas.\n" +
            "Example: TK, LH, BA\n" +
            "Type 'skip' for all airlines."
          );
          return;
        }
        draft.airlines = airlines;
      }

      await ctx.reply(
        "Filter by departure time? Send time window.\n\n" +
        "Examples:\n" +
        "- 06-20 (6am to 8pm)\n" +
        "- 08-14 (8am to 2pm)\n\n" +
        "Type 'skip' for any time."
      );
      return ctx.wizard.next();
    },

    // Step 8: Process time window, ask passengers
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send a time window or 'skip'.");
        return;
      }

      const draft = ctx.wizard.state as AddFlightDraft;

      if (!isSkip(text)) {
        const timeWindow = parseTimeWindow(text);
        if (!timeWindow) {
          await ctx.reply(
            "Invalid time window. Use HH-HH format (e.g., 06-20).\n" +
            "Type 'skip' for any time."
          );
          return;
        }
        // Parse into start/end
        const [start, end] = timeWindow.split("-");
        draft.departureTimeStart = start;
        draft.departureTimeEnd = end;
      }

      await ctx.reply(
        "How many passengers? Send a number (1-9).\n\n" +
        "Type 'skip' for 1 passenger."
      );
      return ctx.wizard.next();
    },

    // Step 9: Process passengers, ask target price
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send passenger count or 'skip'.");
        return;
      }

      const draft = ctx.wizard.state as AddFlightDraft;

      if (!isSkip(text)) {
        const passengers = parsePassengers(text);
        if (!passengers) {
          await ctx.reply(
            "Invalid passenger count. Send a number between 1-9.\n" +
            "Type 'skip' for 1 passenger."
          );
          return;
        }
        draft.passengers = passengers;
      }

      // Show summary of what we have so far
      const summaryParts = [
        `Route: ${draft.originCode} -> ${draft.destinationCode}`,
        `Departure: ${draft.departureDateStart}${draft.departureDateEnd !== draft.departureDateStart ? ` to ${draft.departureDateEnd}` : ""}`,
      ];
      
      if (draft.returnDateStart) {
        summaryParts.push(`Return: ${draft.returnDateStart}${draft.returnDateEnd !== draft.returnDateStart ? ` to ${draft.returnDateEnd}` : ""}`);
      }

      await ctx.reply(
        "Almost done!\n\n" +
        summaryParts.join("\n") + "\n\n" +
        `Send your target price in ${env.defaultCurrency}.\n` +
        "Example: 120"
      );
      return ctx.wizard.next();
    },

    // Step 10: Process target price, ask currency
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
        `Send the 3-letter currency code.\n` +
        `Example: ${env.defaultCurrency}\n\n` +
        `Type 'skip' to use ${env.defaultCurrency}.`
      );
      return ctx.wizard.next();
    },

    // Step 11: Process currency, create flight
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send the currency code or 'skip'.");
        return;
      }

      const draft = ctx.wizard.state as AddFlightDraft;
      
      let currencyCode = env.defaultCurrency;
      if (!isSkip(text)) {
        const parsed = normalizeCurrencyCode(text);
        if (!parsed) {
          await ctx.reply(
            `Currency must be a valid 3-letter code. Example: ${env.defaultCurrency}\n` +
            "Type 'skip' to use the default."
          );
          return;
        }
        currencyCode = parsed;
      }

      // Validate we have required fields
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

      try {
        const trackedFlight = await trackedFlightService.createTrackedFlight({
          userId: String(ctx.from?.id),
          username: ctx.from?.username ?? null,
          originCode: draft.originCode,
          destinationCode: draft.destinationCode,
          departureDateStart: draft.departureDateStart,
          departureDateEnd: draft.departureDateEnd,
          returnDateStart: draft.returnDateStart,
          returnDateEnd: draft.returnDateEnd,
          cabinClass: draft.cabinClass,
          maxStops: draft.maxStops,
          airlines: draft.airlines,
          departureTimeStart: draft.departureTimeStart,
          departureTimeEnd: draft.departureTimeEnd,
          passengers: draft.passengers,
          targetPrice: draft.targetPrice,
          currency: currencyCode,
        });

        await ctx.reply(
          "Tracking created successfully!\n\n" +
          formatTrackedFlightSummary(trackedFlight)
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await ctx.reply(`Failed to create tracking: ${errorMessage}`);
      }

      return ctx.scene.leave();
    },
  );

  scene.command("cancel", async (ctx) => {
    await ctx.reply("Flight creation cancelled.");
    return ctx.scene.leave();
  });

  return scene;
}
