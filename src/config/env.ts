import dotenv from "dotenv";

dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  telegramBotToken: getRequiredEnv("TELEGRAM_BOT_TOKEN"),
  databasePath: getOptionalEnv("DATABASE_PATH", "./data/flightgram.db"),
  priceCheckCron: getOptionalEnv("PRICE_CHECK_CRON", "*/30 * * * *"),
  defaultCurrency: getOptionalEnv("DEFAULT_CURRENCY", "USD").toUpperCase(),

  // fli CLI configuration
  fliPath: getOptionalEnv("FLI_PATH", "fli"),
  fliTimeoutMs: Number.parseInt(
    getOptionalEnv("FLI_TIMEOUT_MS", "60000"),
    10,
  ),
};
