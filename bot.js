// ============================================================
//  TCY Port — Container Yard Locator Bot  (ES Modules)
// ============================================================

import { Telegraf, Markup } from 'telegraf';
import { message }          from 'telegraf/filters';
import fs                   from 'fs';
import path                 from 'path';
import dayjs                from 'dayjs';
import advancedFormat       from 'dayjs/plugin/advancedFormat.js';

dayjs.extend(advancedFormat);

// ── Config ────────────────────────────────────────────────────
const BOT_TOKEN      = '8825795943:AAHRHbNQRPYct_5tMg2Q4hrpfGOKArVDPFQ';
const SUPERVISOR_ID  = 7953520542;
const STAFF_GROUP_ID = -5399708931;

// ── Block data ────────────────────────────────────────────────
const TB_SIZES = { TB1:10, TB2:16, TB3:16, TB4:10, TB5:30, TB6:40, TB7:40 };

// ── Container sizes ───────────────────────────────────────────
const SIZES = [
  { id:'20FT',  label:"📦 20 FT"      },
  { id:'40FT',  label:"📦 40 FT"      },
  { id:'40HC',  label:"📦 40 HC"      },
  { id:'ALL',   label:"📦 All Sizes"  },
];

function sizeLabel(id) {
  return SIZES.find(s => s.id === id)?.label.replace('📦 ','') ?? id;
}

// ── Key helpers  (liner|size  e.g. "CMA|20FT") ───────────────
function makeKey(liner, size) { return `${liner}|${size}`; }

function parseKey(key) {
  const [liner, size = 'ALL'] = key.split('|');
  return { liner, size };
}

// ── DB ────────────────────────────────────────────────────────
const DB_PATH = './yard_layout.json';
function readDB()     { try { return JSON.parse(fs.readFileSync(DB_PATH,'utf8')); } catch { return {}; } }
function writeDB(d)   { const t=DB_PATH+'.tmp'; fs.writeFileSync(t,JSON.stringify(d,null,2),'utf8'); fs.renameSync(t,DB_PATH); }
if (!fs.existsSync(DB_PATH)) { writeDB({}); console.log('[DB] Created'); }
else console.log('[DB] Loaded from', path.resolve(DB_PATH));

// ── Bot ───────────────────────────────────────────────────────
const bot = new Telegraf(BOT_TOKEN);

// ── Supervisor session ────────────────────────────────────────
let S = { action: null, data: {} };
function reset() { S = { action: null, data: {} }; }
function isSup(ctx) { return ctx.from?.id === SUPERVISOR_ID; }

// ── Broadcast helper ──────────────────────────────────────────
async function broadcast(text, md='Markdown') {
  const sent = await bot.telegram.sendMessage(STAFF_GROUP_ID, text, { parse_mode: md });
  try { await bot.telegram.pinChatMessage(STAFF_GROUP_ID, sent.message_id); }
  catch (e) { console.warn('[PIN]', e.message); }
  return sent;
}

// ── Main menu ─────────────────────────────────────────────────
const MENU_KB = Markup.inlineKeyboard([
  [Markup.button.callback('📍 Set Liner Location','menu_set'),
   Markup.button.callback('🗑️ Remove Liner',      'menu_remove')],
  [Markup.button.callback('📣 Announcement',       'menu_announce'),
   Markup.button.callback('🗂️ View All Liners',   'menu_view')],
]);
const MENU_TXT = '⚓ *TCY Yard Control Panel*\n\nSelect an action:';

bot.start(async ctx => {
  try {
    if (!isSup(ctx)) return ctx.reply('👋 Type a liner name (e.g. *CMA*) to find its location.', {parse_mode:'Markdown'});
    reset(); await ctx.reply(MENU_TXT, {parse_mode:'Markdown',...MENU_KB});
  } catch(e){console.error('[/start]',e.message);}
});
bot.command('menu', async ctx => {
  try {
    if (!isSup(ctx)) return;
    reset(); await ctx.reply(MENU_TXT, {parse_mode:'Markdown',...MENU_KB});
  } catch(e){console.error('[/menu]',e.message);}
});

// ── BACK ──────────────────────────────────────────────────────
bot.action('menu_main', async ctx => {
  try { await ctx.answerCbQuery(); if(!isSup(ctx))return; reset(); await ctx.editMessageText(MENU_TXT,{parse_mode:'Markdown',...MENU_KB}); }
  catch(e){console.error('[back]',e.message);}
});

// ── SET: step 1 — ask liner name ──────────────────────────────
bot.action('menu_set', async ctx => {
  try {
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    S = {action:'awaiting_liner_name', data:{}};
    await ctx.editMessageText('📍 *Set Liner Location*\n\nType the *liner name* (e.g. `CMA`, `MSC`):',
      {parse_mode:'Markdown',...Markup.inlineKeyboard([[Markup.button.callback('← Back','menu_main')]])});
  } catch(e){console.error('[menu_set]',e.message);}
});

// ── SET: step 2 — size selection (inline buttons) ─────────────
bot.action(/^sz_(.+)$/, async ctx => {
  try {
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    S.data.size   = ctx.match[1];
    S.action      = 'awaiting_tb';
    const tbBtns  = Object.keys(TB_SIZES).map(t => Markup.button.callback(t,`tb_${t}`));
    await ctx.editMessageText(
      `📍 *${S.data.liner}* · *${sizeLabel(S.data.size)}*\n\nSelect the *terminal block*:`,
      {parse_mode:'Markdown',...Markup.inlineKeyboard([tbBtns.slice(0,4), tbBtns.slice(4), [Markup.button.callback('← Back','menu_set')]])});
  } catch(e){console.error('[sz_*]',e.message);}
});

// ── SET: step 3 — TB selection ────────────────────────────────
bot.action(/^tb_(.+)$/, async ctx => {
  try {
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    const tb    = ctx.match[1];
    S.data.tb   = tb;
    S.action    = 'awaiting_bay';
    const count = TB_SIZES[tb];
    const rows  = [];
    for (let i=1; i<=count; i+=5) rows.push(Array.from({length:Math.min(5,count-i+1)},(_,j)=>Markup.button.callback(`${i+j}`,`bay_${i+j}`)));
    rows.push([Markup.button.callback('← Back','menu_set')]);
    await ctx.editMessageText(
      `📍 *${S.data.liner}* · *${sizeLabel(S.data.size)}* · *${tb}*\n\nPick a *bay number*:`,
      {parse_mode:'Markdown',...Markup.inlineKeyboard(rows)});
  } catch(e){console.error('[tb_*]',e.message);}
});

// ── SET: step 4 — bay → save & broadcast ─────────────────────
bot.action(/^bay_(\d+)$/, async ctx => {
  try {
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    const {liner,size,tb} = S.data;
    if(!liner||!size||!tb) return ctx.answerCbQuery('Session expired. Use /menu.');
    const bay       = ctx.match[1];
    const block     = `${tb}-${bay}`;
    const updatedAt = dayjs().format('hh:mm A');
    const db        = readDB();
    db[makeKey(liner,size)] = {block, updatedAt};
    writeDB(db);
    reset();
    console.log(`[SET] ${liner}|${size} → ${block}`);

    await ctx.editMessageText(
      `✅ *Saved!*\n\n🚢 *${liner}* · ${sizeLabel(size)}\n📦 Block: *${block}*\n🕐 Time:  *${updatedAt}*`,
      {parse_mode:'Markdown'});

    await broadcast(
      `📢 *YARD UPDATE* 📢\n\n🚢 *${liner}* _(${sizeLabel(size)})_ containers → zone *${block}*\n\nAll operators, please route units accordingly.`
    );
    await ctx.reply(MENU_TXT, {parse_mode:'Markdown',...MENU_KB});
  } catch(e){console.error('[bay_*]',e.message);}
});

// ── REMOVE ────────────────────────────────────────────────────
bot.action('menu_remove', async ctx => {
  try {
    await ctx.answerCbQuery(); if(!isSup(ctx))return; reset();
    const db   = readDB();
    const keys = Object.keys(db);
    if(!keys.length) return ctx.editMessageText('No liners assigned yet.',{...Markup.inlineKeyboard([[Markup.button.callback('← Back','menu_main')]])});
    const rows = [];
    for(let i=0;i<keys.length;i+=2) {
      rows.push(keys.slice(i,i+2).map(k=>{
        const {liner,size}=parseKey(k);
        return Markup.button.callback(`🗑 ${liner} · ${sizeLabel(size)} (${db[k].block})`,`del_${k}`);
      }));
    }
    rows.push([Markup.button.callback('← Back','menu_main')]);
    await ctx.editMessageText('🗑️ *Remove a Liner*\n\nTap to remove:',{parse_mode:'Markdown',...Markup.inlineKeyboard(rows)});
  } catch(e){console.error('[menu_remove]',e.message);}
});

bot.action(/^del_(.+)$/, async ctx => {
  try {
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    const key = ctx.match[1];
    const {liner,size} = parseKey(key);
    const db  = readDB();
    delete db[key];
    writeDB(db);
    await ctx.editMessageText(
      `✅ *${liner} · ${sizeLabel(size)}* removed.`,
      {parse_mode:'Markdown',...Markup.inlineKeyboard([[Markup.button.callback('🗑 Remove Another','menu_remove'),Markup.button.callback('← Menu','menu_main')]])});
  } catch(e){console.error('[del_*]',e.message);}
});

// ── ANNOUNCE ──────────────────────────────────────────────────
bot.action('menu_announce', async ctx => {
  try {
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    S = {action:'awaiting_announce',data:{}};
    await ctx.editMessageText('📣 *Send Announcement*\n\nType your message:',
      {parse_mode:'Markdown',...Markup.inlineKeyboard([[Markup.button.callback('← Back','menu_main')]])});
  } catch(e){console.error('[announce]',e.message);}
});

// ── VIEW ALL ──────────────────────────────────────────────────
bot.action('menu_view', async ctx => {
  try {
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    const db      = readDB();
    const entries = Object.entries(db);
    let text      = '🗂️ *Current Yard Layout*\n\n';
    if(!entries.length) { text += '_No liners assigned yet._'; }
    else {
      // Group by liner
      const grouped = {};
      for(const [k,v] of entries) {
        const {liner,size} = parseKey(k);
        if(!grouped[liner]) grouped[liner]=[];
        grouped[liner].push({size, ...v});
      }
      text += Object.entries(grouped).map(([liner,rows])=>
        `🚢 *${liner}*\n`+rows.map(r=>`  • ${sizeLabel(r.size)} → \`${r.block}\` _(${r.updatedAt})_`).join('\n')
      ).join('\n\n');
    }
    await ctx.editMessageText(text,{parse_mode:'Markdown',...Markup.inlineKeyboard([[Markup.button.callback('🔄 Refresh','menu_view'),Markup.button.callback('← Menu','menu_main')]])});
  } catch(e){console.error('[view]',e.message);}
});

// ── TEXT HANDLER (supervisor flow + staff search) ─────────────
bot.on(message('text'), async ctx => {
  try {
    const text = ctx.message.text.trim();
    if(text.startsWith('/')) return;

    // Supervisor multi-step
    if(isSup(ctx)) {
      if(S.action==='awaiting_liner_name') {
        S.data.liner = text.toUpperCase();
        S.action     = 'awaiting_size';
        const sizeRows = [
          SIZES.slice(0,2).map(s=>Markup.button.callback(s.label,`sz_${s.id}`)),
          SIZES.slice(2).map(s=>Markup.button.callback(s.label,`sz_${s.id}`)),
          [Markup.button.callback('← Back','menu_set')],
        ];
        await ctx.reply(
          `🚢 Liner: *${S.data.liner}*\n\nSelect *container size*:`,
          {parse_mode:'Markdown',...Markup.inlineKeyboard(sizeRows)});
        return;
      }
      if(S.action==='awaiting_announce') {
        reset();
        await broadcast(text, undefined);
        await ctx.reply('✅ Announcement pinned in staff group!',MENU_KB);
        return;
      }
    }

    // Staff search
    const query = text.toUpperCase();
    const db    = readDB();
    // Find all entries where liner matches query
    const matches = Object.entries(db).filter(([k])=>{
      const {liner} = parseKey(k);
      return liner === query;
    });

    if(matches.length) {
      let reply = `🔍 *YARD LOCATOR*\n\n━━━━━━━━━━━━━━━━━\n🚢 Liner: *${query}*\n\n`;
      reply += matches.map(([k,v])=>{
        const {size} = parseKey(k);
        return `📦 *${sizeLabel(size)}* → \`${v.block}\`\n🕐 Updated: _${v.updatedAt}_`;
      }).join('\n\n');
      reply += '\n━━━━━━━━━━━━━━━━━';
      await ctx.reply(reply, {parse_mode:'Markdown'});
    } else {
      await ctx.reply(
        `❓ Liner *${query}* is not currently assigned.\n\nPlease check with the supervisor or try again later.`,
        {parse_mode:'Markdown'});
    }
  } catch(e){console.error('[TEXT]',e.message); try{await ctx.reply('❌ Error. Try again.');}catch{}}
});

// ── Launch ────────────────────────────────────────────────────
bot.launch()
  .then(async () => {
    console.log('[BOT] Running…');
    // Register commands → shows the blue "Menu" button bottom-left in Telegram
    await bot.telegram.setMyCommands([
      { command: 'menu',     description: '⚙️ Open Control Panel' },
      { command: 'set',      description: '📍 Set liner location (supervisor)' },
      { command: 'announce', description: '📣 Send announcement (supervisor)' },
    ]);
    console.log('[BOT] Commands registered — Menu button active.');
  })
  .catch(e=>{console.error('[BOT] Launch failed:',e.message); process.exit(1);});

process.once('SIGINT',  ()=>bot.stop('SIGINT'));
process.once('SIGTERM', ()=>bot.stop('SIGTERM'));
