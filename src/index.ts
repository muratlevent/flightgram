import { createBot } from "./bot/createBot.js";
import { closeDatabase, db, databasePath } from "./config/database.js";
import { env } from "./config/env.js";
import { FliProvider } from "./providers/fliProvider.js";
import { BudgetRepository } from "./repositories/budgetRepository.js";
import { PriceAlertRepository } from "./repositories/priceAlertRepository.js";
import { PriceHistoryRepository } from "./repositories/priceHistoryRepository.js";
import { TrackedFlightRepository } from "./repositories/trackedFlightRepository.js";
import { UserRepository } from "./repositories/userRepository.js";
import { createPriceCheckScheduler } from "./scheduler/createPriceCheckScheduler.js";
import { createWeeklyDigestScheduler } from "./scheduler/createWeeklyDigestScheduler.js";
import { BudgetService } from "./services/budgetService.js";
import { FlightSearchService } from "./services/flightSearchService.js";
import { PriceHistoryService } from "./services/priceHistoryService.js";
import { PriceMonitorService } from "./services/priceMonitorService.js";
import { TelegramNotificationService } from "./services/telegramNotificationService.js";
import { TrackedFlightService } from "./services/trackedFlightService.js";
import { WeeklyDigestService } from "./services/weeklyDigestService.js";

async function main(): Promise<void> {
  const userRepository = new UserRepository(db);
  const trackedFlightRepository = new TrackedFlightRepository(db);
  const priceHistoryRepository = new PriceHistoryRepository(db);
  const priceAlertRepository = new PriceAlertRepository(db);
  const budgetRepository = new BudgetRepository(db);
  const trackedFlightService = new TrackedFlightService(
    userRepository,
    trackedFlightRepository,
    env.defaultCurrency,
  );

  const budgetService = new BudgetService(budgetRepository);

  const fliProvider = new FliProvider({
    currency: env.defaultCurrency,
    fliPath: env.fliPath,
    timeoutMs: env.fliTimeoutMs,
  });

  const flightSearchService = new FlightSearchService([fliProvider]);

  const priceHistoryService = new PriceHistoryService(
    trackedFlightRepository,
    priceHistoryRepository,
  );

  const bot = createBot({
    token: env.telegramBotToken,
    trackedFlightService,
    flightSearchService,
    priceHistoryService,
    budgetService,
  });
  const notificationService = new TelegramNotificationService(bot.telegram);
  const priceMonitorService = new PriceMonitorService(
    trackedFlightRepository,
    priceHistoryRepository,
    priceAlertRepository,
    budgetRepository,
    notificationService,
    [fliProvider],
  );

  await bot.launch();

  const scheduler = createPriceCheckScheduler(
    priceMonitorService,
    env.priceCheckCron,
  );

  const weeklyDigestService = new WeeklyDigestService(
    trackedFlightRepository,
    priceHistoryRepository,
    bot.telegram,
  );
  const weeklyDigestScheduler = createWeeklyDigestScheduler(
    weeklyDigestService,
    env.weeklyDigestCron,
  );

  console.info(`[bootstrap] Bot started with provider: ${fliProvider.name}`);
  console.info(`[bootstrap] Scheduler expression: ${env.priceCheckCron}`);
  console.info(`[bootstrap] Weekly digest expression: ${env.weeklyDigestCron}`);
  console.info(`[bootstrap] SQLite database path: ${databasePath}`);

  const shutdown = async (signal: string): Promise<void> => {
    console.info(`[bootstrap] Received ${signal}. Shutting down.`);
    await Promise.resolve(scheduler.stop());
    await Promise.resolve(weeklyDigestScheduler.stop());
    bot.stop(signal);
    closeDatabase();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch((error) => {
  console.error("[bootstrap] Fatal startup error", error);
  process.exit(1);
});
