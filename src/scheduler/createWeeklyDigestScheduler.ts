import cron, { type ScheduledTask } from "node-cron";

import { WeeklyDigestService } from "../services/weeklyDigestService.js";

export function createWeeklyDigestScheduler(
  weeklyDigestService: WeeklyDigestService,
  cronExpression: string,
): ScheduledTask {
  return cron.schedule(
    cronExpression,
    async () => {
      console.info(
        `[scheduler] Weekly digest started at ${new Date().toISOString()}.`,
      );

      try {
        await weeklyDigestService.sendWeeklyDigests();
        console.info("[scheduler] Weekly digest completed successfully.");
      } catch (error) {
        console.error("[scheduler] Weekly digest failed", error);
      }
    },
    {
      name: "weekly-flight-digest",
    },
  );
}
