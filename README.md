# Flightgram

Flightgram is an English-only Telegram bot for tracking flight prices. Users add a route, departure date, and target price, and the system checks prices on a schedule. When the best available fare drops to or below the target price, the bot sends an alert.

The app is designed for self-hosted use on a personal laptop or a small VPS. It uses a local SQLite database file.

## Stack

- TypeScript on Node.js
- Telegraf for the Telegram bot
- SQLite with `better-sqlite3` for local storage
- node-cron for the scheduler
- [fli](https://github.com/punitarani/fli) for Google Flights data

## Project structure

```text
src/
  bot/            Telegram bot setup and scenes
  config/         Environment and SQLite setup
  providers/      Flight data provider (fli)
  repositories/   Data access layer
  scheduler/      Cron job setup
  services/       Business logic
  types/          Shared application types
database/
  schema.sql      SQLite schema
```

## Prerequisites

1. **Install fli** (Python CLI for Google Flights):
   ```bash
   pipx install flights
   ```

2. **Verify fli is working**:
   ```bash
   fli flights JFK LAX 2026-05-01 --format json
   ```

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your Telegram bot token
npm run build
```

The SQLite database file and tables are created automatically on startup. Then run:

```bash
npm run dev
```

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token from @BotFather | (required) |
| `DATABASE_PATH` | Path to SQLite database file | `./data/flightgram.db` |
| `PRICE_CHECK_CRON` | Cron expression for price checks | `*/30 * * * *` |
| `DEFAULT_CURRENCY` | Currency code for prices | `USD` |
| `FLI_PATH` | Path to fli CLI binary | `fli` |
| `FLI_TIMEOUT_MS` | Timeout for fli commands (ms) | `60000` |

## How it works

1. User sends `/track IST JFK 2026-06-15 500 USD` to the bot
2. Bot saves the tracker to SQLite
3. Every 30 minutes (configurable), the scheduler runs fli to check current prices
4. If the price drops to or below the target, the bot sends a Telegram alert
5. Alerts are suppressed for 24 hours unless a lower price is found

## Deployment

For a small VPS deployment:

- `DATABASE_PATH=/opt/flightgram/data/flightgram.db`
- Run the bot with `systemd`
- Back up the `.db` file periodically
- Use [deploy/flightgram.service.example](deploy/flightgram.service.example) as a starting point
- Use [backup-db.sh](scripts/backup-db.sh) for simple SQLite backups

Make sure `fli` is installed and accessible in the PATH for the service user.

## About fli

[fli](https://github.com/punitarani/fli) is a Python library and CLI that provides programmatic access to Google Flights data through reverse engineering. Unlike web scraping solutions, it directly interacts with Google Flights' API, making it fast and reliable.

Key features:
- Direct API access (no browser automation)
- One-way and round-trip searches
- Cabin class selection
- Airline filtering
- Stop preferences

## License

MIT
