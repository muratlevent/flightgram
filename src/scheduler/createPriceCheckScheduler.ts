import cron, { type ScheduledTask } from "node-cron";

import { PriceMonitorService } from "../services/priceMonitorService.js";

export function createPriceCheckScheduler(
  priceMonitorService: PriceMonitorService,
  cronExpression: string,
): ScheduledTask {
  return cron.schedule(
    cronExpression,
    async () => {
      console.info(
        `[scheduler] Price check cycle started at ${new Date().toISOString()}.`,
      );

      try {
        await priceMonitorService.runCycle();
      } catch (error) {
        console.error("[scheduler] Price check cycle failed", error);
      }
    },
    {
      name: "flight-price-check",
    },
  );
}
