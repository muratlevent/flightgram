import { Scenes } from "telegraf";

import { env } from "../../config/env.js";
import { FlightSearchService } from "../../services/flightSearchService.js";
import { formatMoney, formatRoute } from "../../services/formatting.js";
import {
  isSkip,
  normalizeAirportCode,
  normalizeDepartureDate,
  parseCabinClass,
  parseMaxStops,
} from "../../services/validation.js";
import {
  CABIN_CLASS_EMOJIS,
  CABIN_CLASS_LABELS,
  MAX_STOPS_EMOJIS,
  MAX_STOPS_LABELS,
  type CheapestDatesOptions,
} from "../../types/flightOptions.js";
import type { CheapestDatesDraft, BotContext } from "../context.js";
import { getMessageText } from "../context.js";

export const CHEAPEST_DATES_SCENE_ID = "cheapest-dates";

/**
 * Cheapest dates wizard - find the cheapest dates in a range:
 * 0. Ask origin
 * 1. Ask destination
 * 2. Ask start date
 * 3. Ask end date
 * 4. Ask round-trip or one-way
 * 5. Ask trip duration (if round-trip)
 * 6. Ask cabin class - OPTIONAL
 * 7. Ask max stops - OPTIONAL
 * 8. Execute search and show results
 */

export function createCheapestDatesScene(
  flightSearchService: FlightSearchService,
): Scenes.WizardScene<BotContext> {
  const scene = new Scenes.WizardScene<BotContext>(
    CHEAPEST_DATES_SCENE_ID,

    // Step 0: Ask origin
    async (ctx) => {
      await ctx.reply(
        "Find the cheapest travel dates!\n\n" +
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

      const draft = ctx.wizard.state as CheapestDatesDraft;
      draft.originCode = originCode;

      await ctx.reply(
        "Send the 3-letter destination airport code.\n" +
        "Example: LHR"
      );
      return ctx.wizard.next();
    },

    // Step 2: Process destination, ask start date
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

      const draft = ctx.wizard.state as CheapestDatesDraft;
      if (draft.originCode === destinationCode) {
        await ctx.reply("Origin and destination cannot be the same airport.");
        return;
      }

      draft.destinationCode = destinationCode;

      await ctx.reply(
        "Start of date range to search.\n" +
        "Format: YYYY-MM-DD\n" +
        "Example: 2026-05-01"
      );
      return ctx.wizard.next();
    },

    // Step 3: Process start date, ask end date
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send the start date.");
        return;
      }

      const startDate = normalizeDepartureDate(text);
      if (!startDate) {
        await ctx.reply(
          "Invalid date format. Use YYYY-MM-DD.\n" +
          "Date cannot be in the past."
        );
        return;
      }

      const draft = ctx.wizard.state as CheapestDatesDraft;
      draft.startDate = startDate;

      await ctx.reply(
        "End of date range to search.\n" +
        "Format: YYYY-MM-DD\n" +
        "Example: 2026-06-30"
      );
      return ctx.wizard.next();
    },

    // Step 4: Process end date, ask round-trip
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send the end date.");
        return;
      }

      const endDate = normalizeDepartureDate(text);
      if (!endDate) {
        await ctx.reply("Invalid date format. Use YYYY-MM-DD.");
        return;
      }

      const draft = ctx.wizard.state as CheapestDatesDraft;
      if (endDate < (draft.startDate ?? "")) {
        await ctx.reply("End date must be after start date. Try again.");
        return;
      }

      draft.endDate = endDate;

      await ctx.reply(
        "Search type:\n\n" +
        "1. One-way\n" +
        "2. Round-trip\n\n" +
        "Send 1 or 2."
      );
      return ctx.wizard.next();
    },

    // Step 5: Process trip type, ask duration or cabin class
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send 1 or 2.");
        return;
      }

      const draft = ctx.wizard.state as CheapestDatesDraft;
      const choice = text.trim();

      if (choice === "1") {
        draft.isRoundTrip = false;
        // Skip duration, go to cabin class
        const cabinOptions = Object.entries(CABIN_CLASS_LABELS)
          .map(([key, label], i) => `${i + 1}. ${CABIN_CLASS_EMOJIS[key as keyof typeof CABIN_CLASS_EMOJIS]} ${label}`)
          .join("\n");

        await ctx.reply(
          "Cabin class?\n\n" +
          cabinOptions + "\n\n" +
          "Send 1-4 or type 'skip' for Economy."
        );
        // Skip the duration step
        ctx.wizard.cursor = 6;
        return ctx.wizard.next();
      } else if (choice === "2") {
        draft.isRoundTrip = true;
        await ctx.reply(
          "Trip duration in days?\n" +
          "Example: 7\n\n" +
          "Type 'skip' for flexible return."
        );
        return ctx.wizard.next();
      } else {
        await ctx.reply("Invalid selection. Send 1 for one-way or 2 for round-trip.");
        return;
      }
    },

    // Step 6: Process trip duration (round-trip only), ask cabin class
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send trip duration or 'skip'.");
        return;
      }

      const draft = ctx.wizard.state as CheapestDatesDraft;

      if (!isSkip(text)) {
        const duration = parseInt(text.trim(), 10);
        if (isNaN(duration) || duration < 1 || duration > 90) {
          await ctx.reply("Duration must be 1-90 days. Try again or type 'skip'.");
          return;
        }
        draft.tripDuration = duration;
      }

      // Ask cabin class
      const cabinOptions = Object.entries(CABIN_CLASS_LABELS)
        .map(([key, label], i) => `${i + 1}. ${CABIN_CLASS_EMOJIS[key as keyof typeof CABIN_CLASS_EMOJIS]} ${label}`)
        .join("\n");

      await ctx.reply(
        "Cabin class?\n\n" +
        cabinOptions + "\n\n" +
        "Send 1-4 or type 'skip' for Economy."
      );
      return ctx.wizard.next();
    },

    // Step 7: Process cabin class, ask max stops
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send a cabin class or 'skip'.");
        return;
      }

      const draft = ctx.wizard.state as CheapestDatesDraft;

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
        "Maximum stops?\n\n" +
        stopsOptions + "\n\n" +
        "Send 1-4 or type 'skip' for any."
      );
      return ctx.wizard.next();
    },

    // Step 8: Process max stops, execute search
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send a stops selection or 'skip'.");
        return;
      }

      const draft = ctx.wizard.state as CheapestDatesDraft;

      if (!isSkip(text)) {
        const maxStops = parseMaxStops(text);
        if (!maxStops) {
          await ctx.reply("Invalid selection. Send 1-4 or type 'skip'.");
          return;
        }
        draft.maxStops = maxStops;
      }

      // Validate required fields
      if (!draft.originCode || !draft.destinationCode || !draft.startDate || !draft.endDate) {
        await ctx.reply("Search data incomplete. Please try again with /cheapest.");
        return ctx.scene.leave();
      }

      // Show searching message
      const tripType = draft.isRoundTrip ? "round-trip" : "one-way";
      await ctx.reply(
        `Searching cheapest ${tripType} dates for ` +
        `${formatRoute(draft.originCode, draft.destinationCode)}\n` +
        `Date range: ${draft.startDate} to ${draft.endDate}...`
      );

      // Build search options
      const searchOptions: CheapestDatesOptions = {
        isRoundTrip: draft.isRoundTrip,
        tripDuration: draft.tripDuration,
        cabinClass: draft.cabinClass,
        maxStops: draft.maxStops,
        limit: 10, // Show top 10 options
      };

      try {
        const result = await flightSearchService.searchCheapestDates(
          draft.originCode,
          draft.destinationCode,
          draft.startDate,
          draft.endDate,
          env.defaultCurrency,
          searchOptions,
        );

        if (!result || result.options.length === 0) {
          await ctx.reply(
            "No flights found for this route and date range.\n\n" +
            "Try:\n" +
            "- Wider date range\n" +
            "- Removing filters (cabin class, stops)\n" +
            "- Different airports"
          );
          return ctx.scene.leave();
        }

        // Format results
        const lines = [
          "Cheapest Travel Dates",
          "",
          `Route: ${formatRoute(draft.originCode, draft.destinationCode)}`,
          `Range: ${draft.startDate} to ${draft.endDate}`,
          `Type: ${draft.isRoundTrip ? "Round-trip" : "One-way"}`,
        ];

        if (draft.tripDuration) {
          lines.push(`Duration: ${draft.tripDuration} days`);
        }

        if (draft.cabinClass) {
          lines.push(`Class: ${CABIN_CLASS_EMOJIS[draft.cabinClass]} ${CABIN_CLASS_LABELS[draft.cabinClass]}`);
        }

        if (draft.maxStops && draft.maxStops !== "ANY") {
          lines.push(`Stops: ${MAX_STOPS_LABELS[draft.maxStops]}`);
        }

        lines.push("");
        lines.push("Top Options:");
        lines.push("");

        result.options.forEach((option, index) => {
          const price = formatMoney(option.price, option.currency);
          if (option.returnDate) {
            lines.push(`${index + 1}. ${option.departureDate} - ${option.returnDate}: ${price}`);
          } else {
            lines.push(`${index + 1}. ${option.departureDate}: ${price}`);
          }
        });

        lines.push("");
        lines.push("Use /search to get details for a specific date.");
        lines.push("Use /add to track prices for this route.");

        await ctx.reply(lines.join("\n"));
      } catch (error) {
        console.error("[cheapest-dates] Search failed", error);
        await ctx.reply("Search failed. Please try again later.");
      }

      return ctx.scene.leave();
    },
  );

  scene.command("cancel", async (ctx) => {
    await ctx.reply("Search cancelled.");
    return ctx.scene.leave();
  });

  return scene;
}
