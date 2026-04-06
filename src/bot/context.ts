import type { Context, Scenes } from "telegraf";

export interface AddFlightDraft {
  originCode?: string;
  destinationCode?: string;
  departureDateStart?: string;
  departureDateEnd?: string;
  targetPrice?: number;
}

export type BotContext = Context & Scenes.WizardContext;

export function getMessageText(ctx: BotContext): string | null {
  if (!ctx.message || !("text" in ctx.message)) {
    return null;
  }

  return ctx.message.text.trim();
}
