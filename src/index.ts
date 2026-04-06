import { createBot } from "./bot/createBot.js";
import { closeDatabase, db, databasePath } from "./config/database.js";
import { env } from "./config/env.js";
import { FliProvider } from "./providers/fliProvider.js";
import { PriceAlertRepository } from "./repositories/priceAlertRepository.js";
import { PriceHistoryRepository } from "./repositories/priceHistoryRepository.js";
import { TrackedFlightRepository } from "./repositories/trackedFlightRepository.js";
import { UserRepository } from "./repositories/userRepository.js";
import { createPriceCheckScheduler } from "./scheduler/createPriceCheckScheduler.js";
import { FlightSearchService } from "./services/flightSearchService.js";
import { PriceMonitorService } from "./services/priceMonitorService.js";
import { TelegramNotificationService } from "./services/telegramNotificationService.js";
import { TrackedFlightService } from "./services/trackedFlightService.js";

async function main(): Promise<void> {
  const userRepository = new UserRepository(db);
  const trackedFlightRepository = new TrackedFlightRepository(db);
  const priceHistoryRepository = new PriceHistoryRepository(db);
  const priceAlertRepository = new PriceAlertRepository(db);
  const trackedFlightService = new TrackedFlightService(
    userRepository,
    trackedFlightRepository,
    env.defaultCurrency,
  );

  const fliProvider = new FliProvider({
    currency: env.defaultCurrency,
    fliPath: env.fliPath,
    timeoutMs: env.fliTimeoutMs,
  });

  const flightSearchService = new FlightSearchService([fliProvider]);

  const bot = createBot({
    token: env.telegramBotToken,
    trackedFlightService,
    flightSearchService,
  });
  const notificationService = new TelegramNotificationService(bot.telegram);
  const priceMonitorService = new PriceMonitorService(
    trackedFlightRepository,
    priceHistoryRepository,
    priceAlertRepository,
    notificationService,
    [fliProvider],
  );

  await bot.launch();

  const scheduler = createPriceCheckScheduler(
    priceMonitorService,
    env.priceCheckCron,
  );

  console.info(`[bootstrap] Bot started with provider: ${fliProvider.name}`);
  console.info(`[bootstrap] Scheduler expression: ${env.priceCheckCron}`);
  console.info(`[bootstrap] SQLite database path: ${databasePath}`);

  const shutdown = async (signal: string): Promise<void> => {
    console.info(`[bootstrap] Received ${signal}. Shutting down.`);
    await Promise.resolve(scheduler.stop());
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
