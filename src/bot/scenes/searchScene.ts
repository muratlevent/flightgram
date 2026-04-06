import { Scenes } from "telegraf";

import { env } from "../../config/env.js";
import { FlightSearchService } from "../../services/flightSearchService.js";
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
  type FlightSearchOptions,
} from "../../types/flightOptions.js";
import type { SearchDraft, BotContext } from "../context.js";
import { getMessageText } from "../context.js";
import { formatMoney, formatRoute } from "../../services/formatting.js";

export const SEARCH_SCENE_ID = "search-flight";

/**
 * Quick search wizard - simplified flow for one-time search:
 * 0. Ask origin
 * 1. Ask destination
 * 2. Ask departure date (single date only)
 * 3. Ask return date - OPTIONAL
 * 4. Ask cabin class - OPTIONAL
 * 5. Ask max stops - OPTIONAL
 * 6. Execute search and show results
 */

export function createSearchScene(
  flightSearchService: FlightSearchService,
): Scenes.WizardScene<BotContext> {
  const scene = new Scenes.WizardScene<BotContext>(
    SEARCH_SCENE_ID,

    // Step 0: Ask origin
    async (ctx) => {
      await ctx.reply(
        "Quick flight search!\n\n" +
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

      const draft = ctx.wizard.state as SearchDraft;
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

      const draft = ctx.wizard.state as SearchDraft;
      if (draft.originCode === destinationCode) {
        await ctx.reply("Origin and destination cannot be the same airport.");
        return;
      }

      draft.destinationCode = destinationCode;

      await ctx.reply(
        "Send the departure date.\n" +
        "Format: YYYY-MM-DD\n" +
        "Example: 2026-05-01"
      );
      return ctx.wizard.next();
    },

    // Step 3: Process departure date, ask return date
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send the departure date.");
        return;
      }

      const departureDate = normalizeDepartureDate(text);
      if (!departureDate) {
        await ctx.reply(
          "Invalid date format. Use YYYY-MM-DD.\n" +
          "Date cannot be in the past."
        );
        return;
      }

      const draft = ctx.wizard.state as SearchDraft;
      draft.departureDate = departureDate;

      await ctx.reply(
        "Return date? (for round-trip pricing)\n" +
        "Format: YYYY-MM-DD\n\n" +
        "Type 'skip' for one-way search."
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

      const draft = ctx.wizard.state as SearchDraft;

      if (!isSkip(text)) {
        const returnDate = normalizeDepartureDate(text);
        if (!returnDate) {
          await ctx.reply(
            "Invalid date format. Use YYYY-MM-DD.\n" +
            "Type 'skip' for one-way search."
          );
          return;
        }

        if (returnDate < (draft.departureDate ?? "")) {
          await ctx.reply("Return date must be after departure date. Try again.");
          return;
        }

        draft.returnDate = returnDate;
      }

      // Build cabin class options
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

    // Step 5: Process cabin class, ask max stops
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send a cabin class or 'skip'.");
        return;
      }

      const draft = ctx.wizard.state as SearchDraft;

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

    // Step 6: Process max stops, execute search
    async (ctx) => {
      const text = getMessageText(ctx);
      if (!text) {
        await ctx.reply("Please send a stops selection or 'skip'.");
        return;
      }

      const draft = ctx.wizard.state as SearchDraft;

      if (!isSkip(text)) {
        const maxStops = parseMaxStops(text);
        if (!maxStops) {
          await ctx.reply("Invalid selection. Send 1-4 or type 'skip'.");
          return;
        }
        draft.maxStops = maxStops;
      }

      // Validate required fields
      if (!draft.originCode || !draft.destinationCode || !draft.departureDate) {
        await ctx.reply("Search data incomplete. Please try again with /search.");
        return ctx.scene.leave();
      }

      // Show searching message
      await ctx.reply(
        `Searching ${formatRoute(draft.originCode, draft.destinationCode)} ` +
        `on ${draft.departureDate}...`
      );

      // Build search options
      const searchOptions: FlightSearchOptions = {};
      
      if (draft.returnDate) {
        searchOptions.returnDate = draft.returnDate;
      }
      if (draft.cabinClass) {
        searchOptions.cabinClass = draft.cabinClass;
      }
      if (draft.maxStops) {
        searchOptions.maxStops = draft.maxStops;
      }

      try {
        const result = await flightSearchService.search(
          draft.originCode,
          draft.destinationCode,
          draft.departureDate,
          env.defaultCurrency,
          searchOptions,
        );

        if (!result.cheapest) {
          await ctx.reply(
            "No flights found for this route and date.\n\n" +
            "Try:\n" +
            "- Different dates\n" +
            "- Removing filters (cabin class, stops)\n" +
            "- Different airports"
          );
          return ctx.scene.leave();
        }

        // Format results
        const lines = [
          "Search Results",
          "",
          `Route: ${formatRoute(draft.originCode, draft.destinationCode)}`,
          `Departure: ${draft.departureDate}`,
        ];

        if (draft.returnDate) {
          lines.push(`Return: ${draft.returnDate}`);
        }

        if (draft.cabinClass) {
          lines.push(`Class: ${CABIN_CLASS_EMOJIS[draft.cabinClass]} ${CABIN_CLASS_LABELS[draft.cabinClass]}`);
        }

        if (draft.maxStops && draft.maxStops !== "ANY") {
          lines.push(`Stops: ${MAX_STOPS_LABELS[draft.maxStops]}`);
        }

        lines.push("");
        lines.push(`Best Price: ${formatMoney(result.cheapest.price, result.cheapest.currency)}`);
        lines.push(`Provider: ${result.cheapest.providerName}`);

        if (result.cheapest.deepLink) {
          lines.push("");
          lines.push(`Book: ${result.cheapest.deepLink}`);
        }

        lines.push("");
        lines.push("Use /add to track this route and get price alerts!");

        await ctx.reply(lines.join("\n"));
      } catch (error) {
        console.error("[search] Search failed", error);
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
