// ============================================================
//  TCY Port — Container Yard Locator Bot
//  Runtime: Node.js 18+ (ES Modules)
//  Process manager: PM2  (pm2 start ecosystem.config.cjs)
// ============================================================

import { Telegraf, Markup } from 'telegraf';
import { message }          from 'telegraf/filters';
import fs                   from 'fs';
import path                 from 'path';
import dayjs                from 'dayjs';
import advancedFormat       from 'dayjs/plugin/advancedFormat.js';

dayjs.extend(advancedFormat);

// ─────────────────────────────────────────────
//  CONFIGURATION
// ─────────────────────────────────────────────
const BOT_TOKEN      = '8825795943:AAHRHbNQRPYct_5tMg2Q4hrpfGOKArVDPFQ';
const SUPERVISOR_ID  = 7953520542;
const STAFF_GROUP_ID = -5399708931;

// ─────────────────────────────────────────────
//  BLOCK DATA
// ─────────────────────────────────────────────
const TB_SIZES = { TB1: 10, TB2: 16, TB3: 16, TB4: 10, TB5: 30, TB6: 40, TB7: 40 };

// ─────────────────────────────────────────────
//  LOCAL JSON DATABASE
// ─────────────────────────────────────────────
const DB_PATH = './yard_layout.json';

function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return {}; }
}

function writeDB(data) {
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
}

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
//  SUPERVISOR STATE  (for multi-step flows)
// ─────────────────────────────────────────────
// state: null | 'awaiting_liner_name' | 'awaiting_announce'
// data:  { liner?, tb? }
let supState = { action: null, data: {} };

function resetState() { supState = { action: null, data: {} }; }

function isSupervisor(ctx) { return ctx.from?.id === SUPERVISOR_ID; }

// ─────────────────────────────────────────────
//  MAIN MENU KEYBOARD
// ─────────────────────────────────────────────
function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📍 Set Liner Location', 'menu_set'),
     Markup.button.callback('🗑️  Remove Liner',      'menu_remove')],
    [Markup.button.callback('📣 Send Announcement',  'menu_announce'),
     Markup.button.callback('🗂️  View All Liners',   'menu_view')],
  ]);
}

function mainMenuText() {
  return `⚓ *TCY Yard Control Panel*\n\nSelect an action below:`;
}

// ─────────────────────────────────────────────
//  BROADCAST HELPER
// ─────────────────────────────────────────────
async function broadcastAndPin(text, parseMode = 'Markdown') {
  const sent = await bot.telegram.sendMessage(STAFF_GROUP_ID, text, { parse_mode: parseMode });
  await bot.telegram.pinChatMessage(STAFF_GROUP_ID, sent.message_id, { disable_notification: false });
  return sent;
}

// ─────────────────────────────────────────────
//  /start & /menu — show control panel
// ─────────────────────────────────────────────
bot.start(async (ctx) => {
  try {
    if (!isSupervisor(ctx)) {
      return ctx.reply('👋 Welcome! Just type a liner name (e.g. *CMA*) to find its yard location.', { parse_mode: 'Markdown' });
    }
    resetState();
    await ctx.reply(mainMenuText(), { parse_mode: 'Markdown', ...mainMenuKeyboard() });
  } catch (err) { console.error('[/start]', err.message); }
});

bot.command('menu', async (ctx) => {
  try {
    if (!isSupervisor(ctx)) return;
    resetState();
    await ctx.reply(mainMenuText(), { parse_mode: 'Markdown', ...mainMenuKeyboard() });
  } catch (err) { console.error('[/menu]', err.message); }
});

// ─────────────────────────────────────────────
//  BUTTON: 📍 Set Liner Location
// ─────────────────────────────────────────────
bot.action('menu_set', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    if (!isSupervisor(ctx)) return;
    supState = { action: 'awaiting_liner_name', data: {} };
    await ctx.editMessageText(
      '📍 *Set Liner Location*\n\nType the *liner name* (e.g. `CMA`, `MSC`, `LILY`):',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('← Back', 'menu_main')]]) }
    );
  } catch (err) { console.error('[menu_set]', err.message); }
});

// ─────────────────────────────────────────────
//  BUTTON: 🗑️ Remove Liner
// ─────────────────────────────────────────────
bot.action('menu_remove', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    if (!isSupervisor(ctx)) return;
    resetState();
    const db    = readDB();
    const liners = Object.keys(db);

    if (!liners.length) {
      return ctx.editMessageText('🗂️ No liners are currently assigned.\n\nNothing to remove.', {
        ...Markup.inlineKeyboard([[Markup.button.callback('← Back', 'menu_main')]])
      });
    }

    // Build one button per liner
    const rows = [];
    for (let i = 0; i < liners.length; i += 3) {
      rows.push(
        liners.slice(i, i + 3).map(l =>
          Markup.button.callback(`🗑 ${l} (${db[l].block})`, `del_${l}`)
        )
      );
    }
    rows.push([Markup.button.callback('← Back', 'menu_main')]);

    await ctx.editMessageText('🗑️ *Remove a Liner*\n\nTap a liner to remove it:', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(rows),
    });
  } catch (err) { console.error('[menu_remove]', err.message); }
});

// Handle delete callbacks: del_CMA, del_MSC, etc.
bot.action(/^del_(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    if (!isSupervisor(ctx)) return;
    const liner = ctx.match[1];
    const db    = readDB();
    delete db[liner];
    writeDB(db);
    console.log(`[DEL] ${liner} removed`);
    await ctx.editMessageText(`✅ *${liner}* has been removed from the yard layout.`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🗑️ Remove Another', 'menu_remove'),
         Markup.button.callback('← Main Menu',       'menu_main')],
      ]),
    });
  } catch (err) { console.error('[del_*]', err.message); }
});

// ─────────────────────────────────────────────
//  BUTTON: 📣 Send Announcement
// ─────────────────────────────────────────────
bot.action('menu_announce', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    if (!isSupervisor(ctx)) return;
    supState = { action: 'awaiting_announce', data: {} };
    await ctx.editMessageText(
      '📣 *Send Announcement*\n\nType your announcement message and send it:',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('← Back', 'menu_main')]]) }
    );
  } catch (err) { console.error('[menu_announce]', err.message); }
});

// ─────────────────────────────────────────────
//  BUTTON: 🗂️ View All Liners
// ─────────────────────────────────────────────
bot.action('menu_view', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    if (!isSupervisor(ctx)) return;
    const db     = readDB();
    const entries = Object.entries(db);

    let text = '🗂️ *Current Yard Layout*\n\n';
    if (!entries.length) {
      text += '_No liners assigned yet._';
    } else {
      text += entries.map(([l, v]) => `🚢 *${l}* → \`${v.block}\` _(${v.updatedAt})_`).join('\n');
    }

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'menu_view'),
         Markup.button.callback('← Main Menu', 'menu_main')],
      ]),
    });
  } catch (err) { console.error('[menu_view]', err.message); }
});

// ─────────────────────────────────────────────
//  BUTTON: ← Back to Main Menu
// ─────────────────────────────────────────────
bot.action('menu_main', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    if (!isSupervisor(ctx)) return;
    resetState();
    await ctx.editMessageText(mainMenuText(), { parse_mode: 'Markdown', ...mainMenuKeyboard() });
  } catch (err) { console.error('[menu_main]', err.message); }
});

// ─────────────────────────────────────────────
//  TB BLOCK SELECTION  (step 2 of set flow)
// ─────────────────────────────────────────────
bot.action(/^tb_(.+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    if (!isSupervisor(ctx)) return;
    const tb    = ctx.match[1];
    const count = TB_SIZES[tb];
    supState.data.tb = tb;
    supState.action  = 'awaiting_bay';

    // Build bay number buttons in rows of 5
    const rows = [];
    for (let i = 1; i <= count; i += 5) {
      rows.push(
        Array.from({ length: Math.min(5, count - i + 1) }, (_, j) =>
          Markup.button.callback(`${i + j}`, `bay_${i + j}`)
        )
      );
    }
    rows.push([Markup.button.callback('← Back', 'menu_set')]);

    await ctx.editMessageText(
      `📍 *${tb} selected*\n\nNow choose the *bay number*:`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) }
    );
  } catch (err) { console.error('[tb_*]', err.message); }
});

// ─────────────────────────────────────────────
//  BAY SELECTION  (step 3 of set flow)
// ─────────────────────────────────────────────
bot.action(/^bay_(\d+)$/, async (ctx) => {
  try {
    await ctx.answerCbQuery();
    if (!isSupervisor(ctx)) return;
    const bay   = ctx.match[1];
    const liner = supState.data.liner;
    const tb    = supState.data.tb;
    if (!liner || !tb) {
      return ctx.answerCbQuery('Session expired. Use /menu to start again.');
    }
    const block     = `${tb}-${bay}`;
    const updatedAt = dayjs().format('hh:mm A');
    const db        = readDB();
    db[liner]       = { block, updatedAt };
    writeDB(db);
    resetState();
    console.log(`[SET] ${liner} → ${block} at ${updatedAt}`);

    await ctx.editMessageText(
      `✅ *Done!*\n\n🚢 Liner: *${liner}*\n📦 Block: *${block}*\n🕐 Time:  *${updatedAt}*\n\nBroadcasting to staff group…`,
      { parse_mode: 'Markdown' }
    );

    await broadcastAndPin(
      `📢 *YARD UPDATE* 📢\n\n` +
      `🚢 *${liner}* containers are now being allocated to zone *${block}*.\n\n` +
      `All operators unloading barges, please route units accordingly.`
    );

    await ctx.reply(mainMenuText(), { parse_mode: 'Markdown', ...mainMenuKeyboard() });
  } catch (err) { console.error('[bay_*]', err.message); }
});

// ─────────────────────────────────────────────
//  TEXT MESSAGE HANDLER
//  Handles both supervisor flow steps & staff search
// ─────────────────────────────────────────────
bot.on(message('text'), async (ctx) => {
  try {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return;

    // ── Supervisor multi-step flow ───────────
    if (isSupervisor(ctx)) {

      if (supState.action === 'awaiting_liner_name') {
        const liner = text.toUpperCase();
        supState.data.liner = liner;
        supState.action     = 'awaiting_tb';

        const tbButtons = Object.keys(TB_SIZES).map(tb =>
          Markup.button.callback(tb, `tb_${tb}`)
        );
        const rows = [tbButtons.slice(0, 4), tbButtons.slice(4), [Markup.button.callback('← Back', 'menu_set')]];

        await ctx.reply(
          `🚢 Liner: *${liner}*\n\nNow select the *terminal block*:`,
          { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) }
        );
        return;
      }

      if (supState.action === 'awaiting_announce') {
        const announcement = text;
        resetState();
        await broadcastAndPin(announcement, undefined);
        await ctx.reply('✅ Announcement pinned in staff group!', mainMenuKeyboard());
        return;
      }
    }

    // ── Staff liner search ────────────────────
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
        `❓ Liner *${query}* is not currently assigned to any zone.\n\nPlease check with the supervisor or try again later.`,
        { parse_mode: 'Markdown' }
      );
    }
  } catch (err) {
    console.error('[TEXT]', err.message);
    try { await ctx.reply('❌ Something went wrong. Please try again.'); } catch {}
  }
});

// ─────────────────────────────────────────────
//  Legacy slash commands (still work)
// ─────────────────────────────────────────────
bot.command('set', async (ctx) => {
  try {
    if (!isSupervisor(ctx)) { await ctx.reply('⛔ Unauthorised.'); return; }
    const parts = ctx.message.text.trim().split(/\s+/);
    if (parts.length < 3) { await ctx.reply('⚠️ Usage: /set [LINER] [BLOCK]'); return; }
    const liner     = parts[1].toUpperCase();
    const block     = parts[2].toUpperCase();
    const updatedAt = dayjs().format('hh:mm A');
    const db        = readDB();
    db[liner]       = { block, updatedAt };
    writeDB(db);
    await ctx.reply(`✅ *${liner}* → *${block}* saved!`, { parse_mode: 'Markdown' });
    const sent = await bot.telegram.sendMessage(STAFF_GROUP_ID,
      `📢 *YARD UPDATE* 📢\n\n🚢 *${liner}* containers are now being allocated to zone *${block}*.\n\nAll operators unloading barges, please route units accordingly.`,
      { parse_mode: 'Markdown' }
    );
    await bot.telegram.pinChatMessage(STAFF_GROUP_ID, sent.message_id);
  } catch (err) { console.error('[/set]', err.message); }
});

bot.command('announce', async (ctx) => {
  try {
    if (!isSupervisor(ctx)) { await ctx.reply('⛔ Unauthorised.'); return; }
    const raw = ctx.message.text;
    const idx = raw.indexOf(' ');
    if (idx === -1) { await ctx.reply('⚠️ Usage: /announce [MESSAGE]'); return; }
    const announcement = raw.slice(idx).trim();
    const sent = await bot.telegram.sendMessage(STAFF_GROUP_ID, announcement);
    await bot.telegram.pinChatMessage(STAFF_GROUP_ID, sent.message_id);
    await ctx.reply('✅ Announced & pinned.');
  } catch (err) { console.error('[/announce]', err.message); }
});

// ─────────────────────────────────────────────
//  LAUNCH
// ─────────────────────────────────────────────
bot.launch()
  .then(() => console.log('[BOT] TCY Yard Locator Bot is running…'))
  .catch((err) => { console.error('[BOT] Failed to launch:', err.message); process.exit(1); });

process.once('SIGINT',  () => { console.log('[BOT] Stopping…'); bot.stop('SIGINT'); });
process.once('SIGTERM', () => { console.log('[BOT] Stopping…'); bot.stop('SIGTERM'); });
