import type { Context, Scenes } from "telegraf";
import type { CabinClass, MaxStops } from "../types/flightOptions.js";

export interface AddFlightDraft {
  originCode?: string;
  destinationCode?: string;
  departureDateStart?: string;
  departureDateEnd?: string;
  // Round-trip
  returnDateStart?: string;
  returnDateEnd?: string;
  // Options
  cabinClass?: CabinClass;
  maxStops?: MaxStops;
  airlines?: string[];
  departureTimeStart?: string;
  departureTimeEnd?: string;
  passengers?: number;
  // Target
  targetPrice?: number;
  // Percentage drop threshold (1-100)
  priceDropPercent?: number;
}

export interface SearchDraft {
  originCode?: string;
  destinationCode?: string;
  departureDate?: string;
  // Round-trip
  returnDate?: string;
  // Options
  cabinClass?: CabinClass;
  maxStops?: MaxStops;
}

export interface CheapestDatesDraft {
  originCode?: string;
  destinationCode?: string;
  startDate?: string;
  endDate?: string;
  // Round-trip
  isRoundTrip?: boolean;
  tripDuration?: number;
  // Options
  cabinClass?: CabinClass;
  maxStops?: MaxStops;
}

export type BotContext = Context & Scenes.WizardContext;

export function getMessageText(ctx: BotContext): string | null {
  if (!ctx.message || !("text" in ctx.message)) {
    return null;
  }

  return ctx.message.text.trim();
}
