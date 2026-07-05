# TCY Port — Container Yard Locator Bot

A lightweight, production-ready Telegram bot for port yard management.  
Built with **Node.js 18+ (ES Modules)** and [Telegraf v4](https://telegraf.js.org/).

---

## Project Structure

```
TCY_LLO/
├── bot.js                  # Main bot application
├── ecosystem.config.cjs    # PM2 process manager config
├── package.json
├── yard_layout.json        # Auto-created on first run (live database)
└── logs/                   # Auto-created by PM2
    ├── out.log
    └── err.log
```

---

## Quick Start

### 1. Configure the bot

Open `bot.js` and fill in the three constants at the top:

```js
const BOT_TOKEN      = 'YOUR_BOT_TOKEN_HERE';   // from @BotFather
const SUPERVISOR_ID  = 123456789;                // your Telegram user ID
const STAFF_GROUP_ID = -1001234567890;           // negative ID of the staff group
```

> **Tip:** Use [@userinfobot](https://t.me/userinfobot) to find your Telegram user ID.  
> Use [@RawDataBot](https://t.me/RawDataBot) or add the bot to the group and send a message to find the group ID.

### 2. Give the bot admin rights in the staff group

The bot must be a **group administrator** with the **Pin Messages** permission so it can pin yard update alerts automatically.

### 3. Install dependencies

```bash
npm install
```

### 4. Run locally (development)

```bash
npm run dev
```

### 5. Deploy on VPS with PM2

```bash
# Install PM2 globally if not already installed
npm install -g pm2

# Create the log directory
mkdir -p logs

# Start the bot
pm2 start ecosystem.config.cjs

# Save the PM2 process list so it survives reboots
pm2 save

# Enable PM2 to start on system boot
pm2 startup
# (run the command PM2 outputs)
```

---

## Bot Commands & Usage

### Supervisor Commands

| Command | Example | Description |
|---|---|---|
| `/set [LINER] [BLOCK]` | `/set CMA TB5-3` | Updates yard allocation, broadcasts + pins in staff group |
| `/announce [MESSAGE]` | `/announce Clear driveway near TB2` | Sends a raw announcement, pins it in staff group |

### Staff Usage (any chat with the bot)

Just send the **liner name** as plain text:

```
CMA
```

The bot will reply with the current zone and last-updated time.

---

## Data Schema (`yard_layout.json`)

```json
{
  "CMA":   { "block": "TB5-3", "updatedAt": "10:15 PM" },
  "MSC":   { "block": "TB2-1", "updatedAt": "08:30 AM" },
  "EVERGREEN": { "block": "TB7-6", "updatedAt": "02:45 PM" }
}
```

---

## PM2 Useful Commands

```bash
pm2 list                   # Show all running processes
pm2 logs tcy-yard-bot      # Tail live logs
pm2 restart tcy-yard-bot   # Restart the bot
pm2 stop tcy-yard-bot      # Stop the bot
pm2 delete tcy-yard-bot    # Remove from PM2 list
```
