// ============================================================
//  TCY Port — Container Yard Locator Bot
//  Runtime: Node.js 18+ (ES Modules)
//  Process manager: PM2  (pm2 start ecosystem.config.cjs)
// ============================================================

import { Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import fs   from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat.js';

dayjs.extend(advancedFormat);

// ─────────────────────────────────────────────
//  CONFIGURATION  — fill in before deploying
// ─────────────────────────────────────────────
const BOT_TOKEN      = '8825795943:AAHRHbNQRPYct_5tMg2Q4hrpfGOKArVDPFQ';
const SUPERVISOR_ID  = 7953520542;
const STAFF_GROUP_ID = -5399708931;

// ─────────────────────────────────────────────
//  LOCAL JSON DATABASE
// ─────────────────────────────────────────────
const DB_PATH = './yard_layout.json';

/**
 * Read the yard layout from disk.
 * @returns {Record<string, { block: string, updatedAt: string }>}
 */
function readDB() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Persist the yard layout object to disk atomically.
 * @param {Record<string, { block: string, updatedAt: string }>} data
 */
function writeDB(data) {
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
}

// Initialise the database file on startup if it does not exist.
if (!fs.existsSync(DB_PATH)) {
  writeDB({});
  console.log(`[DB] Created empty database at ${path.resolve(DB_PATH)}`);
} else {
  console.log(`[DB] Loaded existing database from ${path.resolve(DB_PATH)}`);
}

// ─────────────────────────────────────────────
//  BOT INITIALISATION
// ─────────────────────────────────────────────
const bot = new Telegraf(BOT_TOKEN);

// ─────────────────────────────────────────────
//  HELPER — is the sender the supervisor?
// ─────────────────────────────────────────────
function isSupervisor(ctx) {
  return ctx.from?.id === SUPERVISOR_ID;
}

// ─────────────────────────────────────────────
//  COMMAND: /set  [LINER] [BLOCK]
//  Supervisor only – save allocation + broadcast
// ─────────────────────────────────────────────
bot.command('set', async (ctx) => {
  try {
    // ── Access control ──────────────────────
    if (!isSupervisor(ctx)) {
      await ctx.reply('⛔ Unauthorised. This command is restricted to the supervisor.');
      return;
    }

    // ── Parse & validate arguments ──────────
    const parts = ctx.message.text.trim().split(/\s+/);
    // parts[0] = '/set', parts[1] = LINER, parts[2] = BLOCK
    if (parts.length < 3) {
      await ctx.reply('⚠️ Usage: /set [LINER] [BLOCK]\nExample: /set CMA TB5-3');
      return;
    }

    const liner     = parts[1].toUpperCase();
    const block     = parts[2].toUpperCase();
    const updatedAt = dayjs().format('hh:mm A');   // e.g. "10:15 PM"

    // ── Persist to database ──────────────────
    const db = readDB();
    db[liner] = { block, updatedAt };
    writeDB(db);
    console.log(`[SET] ${liner} → ${block} at ${updatedAt}`);

    // ── Confirm to supervisor ────────────────
    await ctx.reply(
      `✅ *Yard layout updated!*\n\n` +
      `🚢 Liner: *${liner}*\n` +
      `📦 Block: *${block}*\n` +
      `🕐 Time:  *${updatedAt}*`,
      { parse_mode: 'Markdown' }
    );

    // ── Broadcast to staff group ─────────────
    const broadcastText =
      `📢 *YARD UPDATE* 📢\n\n` +
      `🚢 *${liner}* containers are now being allocated to zone *${block}*.\n\n` +
      `All operators unloading barges, please route units accordingly.`;

    const sent = await ctx.telegram.sendMessage(STAFF_GROUP_ID, broadcastText, {
      parse_mode: 'Markdown',
    });

    // ── Pin the broadcast message ────────────
    await ctx.telegram.pinChatMessage(STAFF_GROUP_ID, sent.message_id, {
      disable_notification: false,
    });

    console.log(`[SET] Broadcast pinned (msg_id=${sent.message_id}) in group ${STAFF_GROUP_ID}`);
  } catch (err) {
    console.error('[SET] Error:', err.message);
    try {
      await ctx.reply('❌ An error occurred while processing the /set command. Please try again.');
    } catch { /* suppress secondary error */ }
  }
});

// ─────────────────────────────────────────────
//  COMMAND: /announce  [MESSAGE]
//  Supervisor only – raw broadcast + pin
// ─────────────────────────────────────────────
bot.command('announce', async (ctx) => {
  try {
    // ── Access control ──────────────────────
    if (!isSupervisor(ctx)) {
      await ctx.reply('⛔ Unauthorised. This command is restricted to the supervisor.');
      return;
    }

    // ── Extract message body ─────────────────
    // Strip the '/announce' prefix (and optional bot username) from the text.
    const raw      = ctx.message.text;
    const spaceIdx = raw.indexOf(' ');

    if (spaceIdx === -1 || raw.slice(spaceIdx).trim() === '') {
      await ctx.reply('⚠️ Usage: /announce [MESSAGE]\nExample: /announce Clear the driveway near TB2');
      return;
    }

    const announcement = raw.slice(spaceIdx).trim();

    // ── Broadcast to staff group ─────────────
    const sent = await ctx.telegram.sendMessage(STAFF_GROUP_ID, announcement);

    // ── Pin the announcement ─────────────────
    await ctx.telegram.pinChatMessage(STAFF_GROUP_ID, sent.message_id, {
      disable_notification: false,
    });

    await ctx.reply('✅ Announcement sent and pinned in the staff group.');
    console.log(`[ANNOUNCE] Pinned (msg_id=${sent.message_id}) in group ${STAFF_GROUP_ID}`);
  } catch (err) {
    console.error('[ANNOUNCE] Error:', err.message);
    try {
      await ctx.reply('❌ An error occurred while processing the /announce command. Please try again.');
    } catch { /* suppress secondary error */ }
  }
});

// ─────────────────────────────────────────────
//  STAFF SEARCH ENGINE
//  Plain text messages (no leading '/') → liner lookup
// ─────────────────────────────────────────────
bot.on(message('text'), async (ctx) => {
  try {
    const text = ctx.message.text.trim();

    // Ignore commands so this handler never double-fires.
    if (text.startsWith('/')) return;

    const query = text.toUpperCase();
    const db    = readDB();

    if (db[query]) {
      const { block, updatedAt } = db[query];
      await ctx.reply(
        `🔍 *YARD LOCATOR RESULT*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🚢  Liner:         *${query}*\n` +
        `📦  Target Zone:   *${block}*\n` +
        `🕐  Last Updated:  *${updatedAt}*\n` +
        `━━━━━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply(
        `❓ Liner *${query}* is not currently assigned to any zone.\n\n` +
        `Please check with the supervisor or try again later.`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (err) {
    console.error('[SEARCH] Error:', err.message);
    try {
      await ctx.reply('❌ Something went wrong while searching. Please try again.');
    } catch { /* suppress secondary error */ }
  }
});

// ─────────────────────────────────────────────
//  LAUNCH
// ─────────────────────────────────────────────
bot.launch()
  .then(() => console.log('[BOT] TCY Yard Locator Bot is running...'))
  .catch((err) => {
    console.error('[BOT] Failed to launch:', err.message);
    process.exit(1);
  });

// ─────────────────────────────────────────────
//  GRACEFUL SHUTDOWN  (PM2 / Docker friendly)
// ─────────────────────────────────────────────
process.once('SIGINT',  () => {
  console.log('[BOT] SIGINT received — shutting down gracefully...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('[BOT] SIGTERM received — shutting down gracefully...');
  bot.stop('SIGTERM');
});
