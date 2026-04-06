import type { Telegram } from "telegraf";

import type { PriceHistoryRepository } from "../repositories/priceHistoryRepository.js";
import type { TrackedFlightRepository } from "../repositories/trackedFlightRepository.js";
import type { TrackedFlightRow } from "../types/flight.js";
import {
  CABIN_CLASS_EMOJIS,
  CABIN_CLASS_LABELS,
} from "../types/flightOptions.js";
import { formatMoney, formatRoute } from "./formatting.js";

interface TrackerDigestInfo {
  tracker: TrackedFlightRow;
  currentPrice: number | null;
  priceWeekAgo: number | null;
  trend: "up" | "down" | "stable" | "unknown";
  trendPercent: number | null;
}

export class WeeklyDigestService {
  private static readonly TREND_THRESHOLD_PERCENT = 1; // Less than 1% = stable

  constructor(
    private readonly trackedFlightRepository: TrackedFlightRepository,
    private readonly priceHistoryRepository: PriceHistoryRepository,
    private readonly telegram: Telegram,
  ) {}

  /**
   * Send weekly digest to all users with active trackers.
   */
  async sendWeeklyDigests(): Promise<void> {
    // First, deactivate expired trackers
    const expiredCount = await this.trackedFlightRepository.deactivateExpiredFlights();
    if (expiredCount > 0) {
      console.info(`[weekly-digest] Deactivated ${expiredCount} expired tracker(s).`);
    }

    const allActiveTrackers = await this.trackedFlightRepository.listAllActiveFlights();

    if (allActiveTrackers.length === 0) {
      console.info("[weekly-digest] No active trackers found. Skipping digest.");
      return;
    }

    // Group trackers by user
    const trackersByUser = new Map<string, TrackedFlightRow[]>();
    for (const tracker of allActiveTrackers) {
      const userTrackers = trackersByUser.get(tracker.user_id) ?? [];
      userTrackers.push(tracker);
      trackersByUser.set(tracker.user_id, userTrackers);
    }

    console.info(
      `[weekly-digest] Sending digests to ${trackersByUser.size} user(s) with ${allActiveTrackers.length} total tracker(s).`,
    );

    // Send digest to each user
    for (const [userId, trackers] of trackersByUser) {
      try {
        await this.sendDigestToUser(userId, trackers);
      } catch (error) {
        console.error(`[weekly-digest] Failed to send digest to user ${userId}:`, error);
      }
    }
  }

  private async sendDigestToUser(
    userId: string,
    trackers: TrackedFlightRow[],
  ): Promise<void> {
    // Gather price info for each tracker
    const digestInfos: TrackerDigestInfo[] = await Promise.all(
      trackers.map((tracker) => this.gatherTrackerInfo(tracker)),
    );

    const message = this.formatDigestMessage(digestInfos);
    await this.telegram.sendMessage(userId, message, { parse_mode: "HTML" });
  }

  private async gatherTrackerInfo(tracker: TrackedFlightRow): Promise<TrackerDigestInfo> {
    const [latestPrice, priceWeekAgo] = await Promise.all([
      this.priceHistoryRepository.getLatestPriceForFlight(tracker.id),
      this.priceHistoryRepository.getPriceFromDaysAgo(tracker.id, 7),
    ]);

    const currentPrice = latestPrice?.price ?? null;
    const weekAgoPrice = priceWeekAgo?.price ?? null;

    let trend: "up" | "down" | "stable" | "unknown" = "unknown";
    let trendPercent: number | null = null;

    if (currentPrice !== null && weekAgoPrice !== null && weekAgoPrice > 0) {
      trendPercent = ((currentPrice - weekAgoPrice) / weekAgoPrice) * 100;

      if (Math.abs(trendPercent) < WeeklyDigestService.TREND_THRESHOLD_PERCENT) {
        trend = "stable";
      } else if (trendPercent > 0) {
        trend = "up";
      } else {
        trend = "down";
      }
    }

    return {
      tracker,
      currentPrice,
      priceWeekAgo: weekAgoPrice,
      trend,
      trendPercent,
    };
  }

  private formatDigestMessage(infos: TrackerDigestInfo[]): string {
    const lines: string[] = [
      "<b>Weekly Flight Price Summary</b>",
      "",
    ];

    for (let i = 0; i < infos.length; i++) {
      const info = infos[i];
      const { tracker, currentPrice, trend, trendPercent } = info;

      // Route header
      const routeStr = formatRoute(tracker.origin_code, tracker.destination_code);
      lines.push(`<b>${i + 1}. ${routeStr}</b>`);

      // Dates
      const isDateRange = tracker.departure_date_start !== tracker.departure_date_end;
      if (isDateRange) {
        lines.push(`   Dates: ${tracker.departure_date_start} to ${tracker.departure_date_end}`);
      } else {
        lines.push(`   Date: ${tracker.departure_date_start}`);
      }

      // Return date for round-trip
      if (tracker.return_date_start) {
        const returnRange =
          tracker.return_date_start === tracker.return_date_end
            ? tracker.return_date_start
            : `${tracker.return_date_start} to ${tracker.return_date_end}`;
        lines.push(`   Return: ${returnRange}`);
      }

      // Cabin class if not economy
      if (tracker.cabin_class && tracker.cabin_class !== "ECONOMY") {
        const emoji = CABIN_CLASS_EMOJIS[tracker.cabin_class];
        const label = CABIN_CLASS_LABELS[tracker.cabin_class];
        lines.push(`   Class: ${emoji} ${label}`);
      }

      // Current price and target
      if (currentPrice !== null) {
        const priceStr = formatMoney(currentPrice, tracker.currency);
        const targetStr = formatMoney(tracker.target_price, tracker.currency);

        // Trend indicator
        let trendEmoji = "";
        let trendText = "";
        if (trend === "down" && trendPercent !== null) {
          trendEmoji = "↓";
          trendText = ` (${Math.abs(trendPercent).toFixed(1)}% down)`;
        } else if (trend === "up" && trendPercent !== null) {
          trendEmoji = "↑";
          trendText = ` (${Math.abs(trendPercent).toFixed(1)}% up)`;
        } else if (trend === "stable") {
          trendEmoji = "→";
          trendText = " (stable)";
        }

        lines.push(`   Current: ${priceStr} ${trendEmoji}${trendText}`);
        lines.push(`   Target: ${targetStr}`);

        // Price vs target status
        if (currentPrice <= tracker.target_price) {
          lines.push("   Status: Below target!");
        } else {
          const abovePercent = ((currentPrice - tracker.target_price) / tracker.target_price) * 100;
          lines.push(`   Status: ${abovePercent.toFixed(0)}% above target`);
        }
      } else {
        lines.push("   Current: No price data yet");
        lines.push(`   Target: ${formatMoney(tracker.target_price, tracker.currency)}`);
      }

      // Add empty line between trackers
      if (i < infos.length - 1) {
        lines.push("");
      }
    }

    // Footer
    lines.push("");
    lines.push(`<i>Tracking ${infos.length} flight(s). Use /list to manage.</i>`);

    return lines.join("\n");
  }
}
