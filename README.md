# Flightgram

Flightgram is a Telegram bot for tracking flight prices. Set up alerts for your desired routes with flexible filters, and get notified when prices drop below your target.

Designed for self-hosted use on a personal laptop or small VPS. Uses a local SQLite database.

## Features

### Core Functionality
- **Price Tracking**: Monitor flight prices on a configurable schedule
- **Smart Alerts**: Get notified when prices drop to or below your target
- **Date Range Search**: Track flexible dates and find the cheapest day to fly
- **Alert Cooldown**: Prevents spam with 24-hour cooldown (bypassed if price drops further)

### Flight Search Options
- **Round-Trip Support**: Track both one-way and round-trip flights
- **Cabin Class Selection**: Economy, Premium Economy, Business, or First Class
- **Direct Flight Filter**: Non-stop only, max 1 stop, or max 2+ stops
- **Airline Filter**: Restrict search to specific airlines (e.g., TK, LH, BA)
- **Departure Time Window**: Filter by departure time (e.g., 6am-8pm)
- **Multiple Passengers**: Track prices for 1-9 passengers

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and register user |
| `/add` | Start the flight tracking wizard |
| `/list` | Show all your active trackers |
| `/delete` | Remove a tracked flight |
| `/cancel` | Cancel the current conversation |

## Flight Tracking Wizard

When you use `/add`, the bot guides you through a multi-step wizard:

### Step 1: Origin Airport
```
Send the 3-letter origin airport code.
Example: IST
```

### Step 2: Destination Airport
```
Send the 3-letter destination airport code.
Example: LHR
```

### Step 3: Departure Date
```
Send the departure date or date range.

Examples:
- Single date: 2026-05-01
- Date range: 2026-05-01 to 2026-05-15
```

### Step 4: Return Date (Optional)
```
Is this a round-trip? Send the return date or range.

Examples:
- Single date: 2026-05-10
- Date range: 2026-05-10 to 2026-05-20

Type 'skip' for one-way flight.
```

### Step 5: Cabin Class (Optional)
```
Select cabin class:

1. Economy
2. Premium Economy
3. Business
4. First Class

Send a number (1-4) or type 'skip' for Economy.
```

### Step 6: Maximum Stops (Optional)
```
Select maximum stops:

1. Any
2. Non-stop only
3. Max 1 stop
4. Max 2+ stops

Send a number (1-4) or type 'skip' for any.
```

### Step 7: Airlines (Optional)
```
Filter by airlines? Send airline codes separated by commas.

Examples:
- TK, LH, BA
- TK

Type 'skip' for all airlines.
```

### Step 8: Departure Time (Optional)
```
Filter by departure time? Send time window.

Examples:
- 06-20 (6am to 8pm)
- 08-14 (8am to 2pm)

Type 'skip' for any time.
```

### Step 9: Passengers (Optional)
```
How many passengers? Send a number (1-9).

Type 'skip' for 1 passenger.
```

### Step 10: Target Price
```
Send your target price in USD.
Example: 120
```

### Step 11: Currency
```
Send the 3-letter currency code.
Example: USD

Type 'skip' to use the default.
```

## Price Alert Format

When a price drops to or below your target, you'll receive an alert like this:

```
Price alert triggered.
Route: IST -> LHR
Date range: 2026-05-01 to 2026-05-15
Cheapest date: 2026-05-08
Return: 2026-05-15
Class: Business
Passengers: 2
Best price: $450.00
Target price: $500.00
Provider: fli
Booking link: https://www.google.com/travel/flights?...
```

## Stack

- TypeScript on Node.js
- Telegraf for the Telegram bot
- SQLite with `better-sqlite3` for local storage
- node-cron for the scheduler
- [fli](https://github.com/punitarani/fli) for Google Flights data

## Project Structure

```text
src/
  bot/            Telegram bot setup and scenes
    scenes/       Wizard scenes (add, delete)
    context.ts    Bot context and draft types
    formatters.ts Flight display formatting
    createBot.ts  Bot initialization
  config/         Environment and SQLite setup
  providers/      Flight data provider (fli)
  repositories/   Data access layer
  scheduler/      Cron job setup
  services/       Business logic
  types/          Shared application types
database/
  schema.sql      SQLite schema
  migrations/     Database migrations
```

## Prerequisites

1. **Node.js 18+**

2. **Install fli** (Python CLI for Google Flights):
   ```bash
   pipx install flights
   ```

3. **Verify fli is working**:
   ```bash
   fli flights JFK LAX 2026-05-01 --format json
   ```

4. **Create a Telegram Bot**:
   - Message [@BotFather](https://t.me/BotFather) on Telegram
   - Send `/newbot` and follow the prompts
   - Copy the bot token

## Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/flightgram.git
cd flightgram

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Telegram bot token

# Build
npm run build

# Run
npm run start
```

For development:
```bash
npm run dev
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token from @BotFather | (required) |
| `DATABASE_PATH` | Path to SQLite database file | `./data/flightgram.db` |
| `PRICE_CHECK_CRON` | Cron expression for price checks | `*/30 * * * *` |
| `DEFAULT_CURRENCY` | Currency code for prices | `USD` |
| `FLI_PATH` | Path to fli CLI binary | `fli` |
| `FLI_TIMEOUT_MS` | Timeout for fli commands (ms) | `60000` |

### Cron Expression Examples

| Expression | Description |
|------------|-------------|
| `*/30 * * * *` | Every 30 minutes (default) |
| `0 * * * *` | Every hour |
| `0 */6 * * *` | Every 6 hours |
| `0 8,20 * * *` | At 8am and 8pm |

## How It Works

1. **User creates a tracker** via the `/add` wizard
2. **Bot saves configuration** to SQLite database
3. **Scheduler runs periodically** (default: every 30 minutes)
4. **For each active tracker**:
   - If date range: queries each date and finds the cheapest
   - Applies all filters (cabin class, stops, airlines, time, passengers)
   - Records price in history table
5. **If price <= target**:
   - Checks if alert should be sent (cooldown logic)
   - Sends Telegram notification with booking link
   - Records alert in database

## Database Schema

### Tables

- `users` - Telegram user information
- `tracked_flights` - Active flight trackers with all filters
- `price_history` - Historical price data for each tracker
- `price_alerts` - Record of sent alerts

### Migrations

When upgrading, run migrations in order:
```bash
sqlite3 ./data/flightgram.db < database/migrations/001_add_date_range.sql
sqlite3 ./data/flightgram.db < database/migrations/002_add_flight_options.sql
```

## Deployment

### Systemd Service (Linux VPS)

1. Create service file at `/etc/systemd/system/flightgram.service`:
```ini
[Unit]
Description=Flightgram Telegram Bot
After=network.target

[Service]
Type=simple
User=flightgram
WorkingDirectory=/opt/flightgram
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

2. Enable and start:
```bash
sudo systemctl enable flightgram
sudo systemctl start flightgram
```

### Environment Setup for Production

```bash
export TELEGRAM_BOT_TOKEN="your-token-here"
export DATABASE_PATH="/opt/flightgram/data/flightgram.db"
export PRICE_CHECK_CRON="0 */2 * * *"  # Every 2 hours
export DEFAULT_CURRENCY="USD"
```

### Backup

Back up the SQLite database regularly:
```bash
sqlite3 /opt/flightgram/data/flightgram.db ".backup /backups/flightgram-$(date +%Y%m%d).db"
```

## Limitations

- **No "Anywhere" destination**: The fli CLI requires specific 3-letter IATA airport codes for both origin and destination
- **Date range limit**: Maximum 14 days in a date range to avoid excessive API calls
- **Rate limiting**: Be mindful of Google Flights rate limits; don't set cron too aggressively
- **Single provider**: Currently only supports fli/Google Flights

## Troubleshooting

### "fli CLI not found"
Make sure fli is installed and in your PATH:
```bash
pipx install flights
which fli  # Should output the path
```

### "No flights found"
- Verify airport codes are valid 3-letter IATA codes
- Check that dates are in the future
- Try removing filters to see if flights exist

### Bot not responding
- Check that `TELEGRAM_BOT_TOKEN` is set correctly
- Ensure the bot is running (`npm run start`)
- Check logs for errors

## About fli

[fli](https://github.com/punitarani/fli) is a Python library and CLI that provides programmatic access to Google Flights data through reverse engineering. Unlike web scraping solutions, it directly interacts with Google Flights' API, making it fast and reliable.

Key capabilities used by Flightgram:
- One-way and round-trip searches (`--return`)
- Cabin class selection (`--class`)
- Stop preferences (`--stops`)
- Airline filtering (`--airlines`)
- Departure time window (`--time`)
- Multiple passengers (`--passengers`)
- JSON output (`--format json`)
- Sorting by price (`--sort CHEAPEST`)

## License

MIT
