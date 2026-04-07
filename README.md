# Flightgram

Flightgram is a Telegram bot for tracking flight prices. Set up alerts for your desired routes with flexible filters, and get notified when prices drop below your target.

Designed for self-hosted use on a personal laptop or small VPS. Uses a local SQLite database.

## Features

### Core Functionality
- **Price Tracking**: Monitor flight prices on a configurable schedule (default: every 30 minutes)
- **Smart Alerts**: Get notified when prices drop to or below your target
- **Date Range Search**: Track flexible dates and find the cheapest day to fly
- **Alert Cooldown**: Prevents spam with 24-hour cooldown (bypassed if price drops further)
- **Auto-Disable Expired Trackers**: Trackers are automatically disabled once departure date passes

### Flight Search Options
- **Round-Trip Support**: Track both one-way and round-trip flights
- **Cabin Class Selection**: Economy, Premium Economy, Business, or First Class
- **Direct Flight Filter**: Non-stop only, max 1 stop, or max 2+ stops
- **Airline Filter**: Restrict search to specific airlines (e.g., TK, LH, BA)
- **Departure Time Window**: Filter by departure time (e.g., 6am-8pm)
- **Multiple Passengers**: Track prices for 1-9 passengers
- **Flexible Dates**: Expand search ±3 days around selected dates

### Advanced Features
- **Quick Search** (`/search`): One-time flight search without creating a tracker
- **Cheapest Dates Finder** (`/cheapest`): Find the cheapest travel dates in a date range
- **Price Drop Percentage Alert**: Get alerted when price drops X% from the initial recorded price
- **Budget Alerts** (`/budget`): Set a global budget threshold - get alerts for ANY flight under budget
- **Price History Chart** (`/history`): View ASCII sparkline visualization of price trends
- **Weekly Summary Digest**: Automatic weekly summary of all your trackers (Sundays 10am)
- **Duplicate Route Detection**: Bot warns if you already have a similar tracker

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and register user |
| `/add` | Start the flight tracking wizard |
| `/search` | Quick one-time flight search (no tracker created) |
| `/cheapest` | Find cheapest dates in a date range |
| `/list` | Show all your active trackers |
| `/history` | View price history chart for a tracker |
| `/budget` | Set, view, or clear your global budget alert |
| `/delete` | Remove a tracked flight |
| `/cancel` | Cancel the current conversation |

## Quick Start

### Prerequisites

Before you begin, make sure you have:

1. **Node.js 20 or later** - [Download here](https://nodejs.org/)
   ```bash
   # Check your version
   node --version  # Should be v20.0.0 or higher
   ```

2. **Python 3.8+ with pipx** - Required for the fli CLI
   ```bash
   # Install pipx if you don't have it
   # macOS:
   brew install pipx
   pipx ensurepath
   
   # Ubuntu/Debian:
   sudo apt install pipx
   pipx ensurepath
   
   # Windows (with Python installed):
   python -m pip install --user pipx
   python -m pipx ensurepath
   ```

3. **Install fli** (Python CLI for Google Flights):
   ```bash
   pipx install flights
   ```

4. **Verify fli is working**:
   ```bash
   fli flights JFK LAX 2026-05-01 --format json
   ```
   You should see JSON output with flight data. If you get an error, try restarting your terminal.

5. **Create a Telegram Bot**:
   - Open Telegram and message [@BotFather](https://t.me/BotFather)
   - Send `/newbot`
   - Choose a name for your bot (e.g., "My Flight Tracker")
   - Choose a username for your bot (must end in `bot`, e.g., `myflights_bot`)
   - **Copy the bot token** - you'll need this later (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/flightgram.git
cd flightgram

# 2. Install dependencies
npm install

# 3. Create your configuration file
cp .env.example .env

# 4. Edit .env with your favorite editor and add your bot token
# For example:
nano .env
# or
code .env
```

Edit the `.env` file and replace `your_telegram_bot_token` with your actual bot token:

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
```

```bash
# 5. Build the project
npm run build

# 6. Start the bot
npm run start
```

That's it! Open Telegram, find your bot, and send `/start`.

### Development Mode

For development with hot-reload:
```bash
npm run dev
```

## About SQLite

**You do NOT need to install SQLite separately.** 

Flightgram uses the `better-sqlite3` npm package, which includes pre-compiled SQLite binaries. The database file is created automatically when you first start the bot.

- Default database location: `./data/flightgram.db`
- The `data/` folder is created automatically if it doesn't exist
- All tables are created automatically on first run

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token from @BotFather | **(required)** |
| `DATABASE_PATH` | Path to SQLite database file | `./data/flightgram.db` |
| `PRICE_CHECK_CRON` | Cron expression for price checks | `*/30 * * * *` (every 30 min) |
| `WEEKLY_DIGEST_CRON` | Cron expression for weekly summary | `0 10 * * 0` (Sunday 10am) |
| `DEFAULT_CURRENCY` | Default currency code for prices | `USD` |
| `FLI_PATH` | Path to fli CLI binary | `fli` |
| `FLI_TIMEOUT_MS` | Timeout for fli commands (ms) | `60000` |

### Cron Expression Examples

| Expression | Description |
|------------|-------------|
| `*/30 * * * *` | Every 30 minutes (default) |
| `0 * * * *` | Every hour |
| `0 */6 * * *` | Every 6 hours |
| `0 8,20 * * *` | At 8am and 8pm daily |
| `0 10 * * 0` | Every Sunday at 10am |

## Flight Tracking Wizard (`/add`)

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

### Step 11: Price Drop Percentage (Optional)
```
Alert when price drops X% from initial price?
Send a number (1-100).

Example: 20 (alert when price drops 20%)

Type 'skip' to only use target price alerts.
```

### Step 12: Flexible Dates (Optional)
```
Enable flexible dates? This expands your search ±3 days.

1. Yes
2. No

Type 'skip' for No.
```

### Step 13: Currency
```
Send the 3-letter currency code.
Example: USD

Type 'skip' to use the default.
```

## Quick Search (`/search`)

Perform a one-time flight search without creating a tracker:

```
/search
```

The bot asks for:
1. Origin (e.g., IST)
2. Destination (e.g., LHR)
3. Departure date (e.g., 2026-05-01)
4. Return date (or skip for one-way)
5. Cabin class (or skip)
6. Max stops (or skip)

Results show the top 5 cheapest flights with prices and booking links.

## Cheapest Dates Finder (`/cheapest`)

Find the cheapest dates to fly within a date range:

```
/cheapest
```

The bot asks for:
1. Origin (e.g., IST)
2. Destination (e.g., JFK)
3. Date range (e.g., 2026-05-01 to 2026-05-31)
4. Return date/range (optional)
5. Cabin class (optional)

Results show the cheapest date(s) to fly with prices.

## Budget Alerts (`/budget`)

Set a global budget threshold to get alerts for ANY flight under your budget:

```
/budget
```

Options:
- **Set budget**: Enter amount (e.g., "500" or "500 EUR")
- **View budget**: See your current budget setting
- **Clear budget**: Remove budget alerts

When any of your tracked flights drops below your budget, you get an extra alert!

## Price History (`/history`)

View a visual history of price changes for any tracker:

```
/history
```

Shows an ASCII sparkline chart of price trends over time:

```
Price History: IST -> LHR
Last 30 days | Range: $245 - $380

  $380 |    *
  $340 |  **  *
  $300 | *  ** *
  $260 |       **
  $245 |         *** <-- Current
       +------------------
        30 days ago    Now

Current: $245.00 | Initial: $320.00 (-23.4%)
```

## Weekly Summary Digest

Every Sunday at 10am (configurable), you receive an automatic summary:

```
Weekly Flight Summary

You have 3 active trackers:

1. IST -> LHR (May 1-15)
   Current: $245 | Target: $300
   Trend: -15% from last week

2. IST -> JFK (Jun 10-20)  
   Current: $520 | Target: $450
   Trend: +5% from last week

3. AMS -> BCN (Jul 1)
   Current: $89 | Target: $100
   Trend: No change

Budget: $500 USD
1 flight is under budget!
```

## Price Alert Format

When a price drops to or below your target, you'll receive an alert like this:

```
Price Alert!

Route: IST -> LHR
Date range: 2026-05-01 to 2026-05-15
Cheapest date: 2026-05-08
Return: 2026-05-15
Class: Business
Passengers: 2

Best price: $450.00
Target price: $500.00
Drop: -10% from initial ($500)

[Book Now]
```

## Project Structure

```text
src/
  bot/            Telegram bot setup and scenes
    scenes/       Wizard scenes (add, delete, search, etc.)
    context.ts    Bot context and draft types
    formatters.ts Flight display formatting
    createBot.ts  Bot initialization
  config/         Environment and SQLite setup
  providers/      Flight data provider (fli)
  repositories/   Data access layer
  scheduler/      Cron job setup
  services/       Business logic
    weeklyDigestService.ts   Weekly summary
    priceHistoryService.ts   Price history charts
    budgetService.ts         Budget alerts
  types/          Shared application types
database/
  schema.sql      Full SQLite schema
  migrations/     Database migrations
```

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `users` | Telegram user information |
| `tracked_flights` | Active flight trackers with all filters |
| `price_history` | Historical price data for each tracker |
| `price_alerts` | Record of sent alerts |
| `user_budgets` | Per-user global budget thresholds |

### Fresh Install vs. Existing Database

**Fresh install:** The bot automatically creates all tables on first run. No action needed.

**Upgrading an existing database:** If you're upgrading from an earlier version, run migrations in order:

```bash
# Check which migrations you need (look at dates in your database)
ls database/migrations/

# Run any migrations you haven't applied yet, in order:
sqlite3 ./data/flightgram.db < database/migrations/001_add_date_range.sql
sqlite3 ./data/flightgram.db < database/migrations/002_add_flight_options.sql
sqlite3 ./data/flightgram.db < database/migrations/003_add_price_drop_percent.sql
sqlite3 ./data/flightgram.db < database/migrations/004_add_flexible_dates.sql
sqlite3 ./data/flightgram.db < database/migrations/005_add_user_budgets.sql
```

## Deployment

### Running with PM2 (Recommended)

PM2 keeps your bot running and restarts it if it crashes:

```bash
# Install PM2 globally
npm install -g pm2

# Start the bot
pm2 start dist/index.js --name flightgram

# View logs
pm2 logs flightgram

# Restart
pm2 restart flightgram

# Stop
pm2 stop flightgram

# Auto-start on system reboot
pm2 startup
pm2 save
```

### Systemd Service (Linux VPS)

1. Create service file at `/etc/systemd/system/flightgram.service`:

```ini
[Unit]
Description=Flightgram Telegram Bot
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/flightgram
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
sudo systemctl status flightgram
```

### Environment Setup for Production

Create a `.env` file in your production directory:

```bash
TELEGRAM_BOT_TOKEN="your-token-here"
DATABASE_PATH="/opt/flightgram/data/flightgram.db"
PRICE_CHECK_CRON="0 */2 * * *"  # Every 2 hours
WEEKLY_DIGEST_CRON="0 10 * * 0"  # Sunday 10am
DEFAULT_CURRENCY="USD"
```

### Backup

Back up the SQLite database regularly:

```bash
# Manual backup
cp ./data/flightgram.db ./backups/flightgram-$(date +%Y%m%d).db

# Or use SQLite's backup command
sqlite3 ./data/flightgram.db ".backup ./backups/flightgram-$(date +%Y%m%d).db"
```

## Troubleshooting

### "fli: command not found"

Make sure fli is installed and in your PATH:

```bash
pipx install flights
pipx ensurepath

# Restart your terminal, then verify:
which fli  # Should output a path like ~/.local/bin/fli
```

If `which fli` returns nothing, add pipx to your PATH manually:

```bash
# Add to ~/.bashrc or ~/.zshrc:
export PATH="$HOME/.local/bin:$PATH"

# Then reload:
source ~/.bashrc  # or source ~/.zshrc
```

### "No flights found"

- Verify airport codes are valid 3-letter IATA codes (IST, JFK, LHR, etc.)
- Check that dates are in the future
- Try removing filters (cabin class, stops, airlines) to see if flights exist
- Some routes may not have flights on certain days

### Bot not responding

1. Check that `TELEGRAM_BOT_TOKEN` is set correctly in `.env`
2. Make sure the bot is running: `npm run start`
3. Check for errors in the console output
4. Verify your bot token is valid by visiting: `https://api.telegram.org/bot<YOUR_TOKEN>/getMe`

### Database errors

If you see "table already exists" or schema errors:

```bash
# Option 1: Reset the database (WARNING: deletes all data)
rm ./data/flightgram.db
npm run start  # Creates fresh database

# Option 2: Run missing migrations
sqlite3 ./data/flightgram.db < database/migrations/005_add_user_budgets.sql
```

### "SQLITE_BUSY" errors

If running multiple instances, only run one bot instance per database file.

## Limitations

- **No "Anywhere" destination**: The fli CLI requires specific 3-letter IATA airport codes
- **Date range limit**: Maximum 14 days in a date range to avoid excessive API calls
- **Rate limiting**: Be mindful of Google Flights rate limits; don't set cron too aggressively
- **Single provider**: Currently only supports fli/Google Flights
- **No multi-city**: fli CLI doesn't support native multi-city searches

## Stack

- **TypeScript** on **Node.js 20+**
- **Telegraf** for the Telegram bot
- **SQLite** with `better-sqlite3` for local storage (no separate install needed)
- **node-cron** for the scheduler
- **[fli](https://github.com/punitarani/fli)** for Google Flights data

## About fli

[fli](https://github.com/punitarani/fli) is a Python library and CLI that provides programmatic access to Google Flights data. Unlike web scraping solutions, it directly interacts with Google Flights' API, making it fast and reliable.

Key capabilities used by Flightgram:
- One-way and round-trip searches (`--return`)
- Cabin class selection (`--class`)
- Stop preferences (`--stops`)
- Airline filtering (`--airlines`)
- Departure time window (`--time`)
- Multiple passengers (`--passengers`)
- Date range search (`fli dates`)
- JSON output (`--format json`)
- Sorting by price (`--sort CHEAPEST`)

## License

MIT
