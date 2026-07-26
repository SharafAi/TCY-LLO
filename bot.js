// ============================================================
//  TCY Port — Container Yard Locator Bot  (ES Modules)
//  Timezone: Maldives (UTC+5)  |  version 2.0
// ============================================================
import { Telegraf, Markup } from 'telegraf';
import { message }          from 'telegraf/filters';
import fs   from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import utc  from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import advancedFormat from 'dayjs/plugin/advancedFormat.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);
const TZ = 'Indian/Maldives'; // UTC+5

// ── Config ────────────────────────────────────────────────────
const BOT_TOKEN      = '8825795943:AAHRHbNQRPYct_5tMg2Q4hrpfGOKArVDPFQ';
const SUPERVISOR_ID  = 7953520542;
const STAFF_GROUP_ID = -5399708931;
const NEW_HOURS      = 24; // 🆕 tag shows for 24 hours

// ── Block / size data ─────────────────────────────────────────
const TB_SIZES = { TB1:10, TB2:16, TB3:16, TB4:10, TB5:30, TB6:40, TB7:40 };
const SIZES    = [
  { id:'20FT', label:'20 FT'  },
  { id:'40FT', label:'40 FT'  },
  { id:'20RF', label:'20 RF ❄️'  },
  { id:'40RF', label:'40 RF ❄️'  },
];
const sizeLabel  = id => SIZES.find(s=>s.id===id)?.label ?? id;
const sizeEmoji  = id => id.includes('RF') ? '❄️' : '📦';

// ── DB key helpers ────────────────────────────────────────────
const makeKey   = (liner, size) => `${liner}|${size}`;
const parseKey  = key  => { const [liner,size='ALL']=key.split('|'); return {liner,size}; };
const isNewEntry= e    => (Date.now()/1000-(e.addedAt||0)) < NEW_HOURS*3600;
const isFullEntry= e   => e.full === true;

// ── DB ────────────────────────────────────────────────────────
const DB_PATH = './yard_layout.json';

function readDB() {
  try {
    const raw = JSON.parse(fs.readFileSync(DB_PATH,'utf8'));
    const out = {};
    for(const [k,v] of Object.entries(raw)){
      out[k] = Array.isArray(v) ? v : [{ block:v.block, updatedAt:v.updatedAt, addedAt:0, full:false }];
    }
    return out;
  } catch { return {}; }
}

function writeDB(d) {
  const t=DB_PATH+'.tmp';
  fs.writeFileSync(t,JSON.stringify(d,null,2),'utf8');
  fs.renameSync(t,DB_PATH);
}

if (!fs.existsSync(DB_PATH)) { writeDB({}); console.log('[DB] Created'); }
else console.log('[DB] Loaded from', path.resolve(DB_PATH));

// ── Bot ───────────────────────────────────────────────────────
const bot = new Telegraf(BOT_TOKEN);

// ── Session ───────────────────────────────────────────────────
let S = { action:null, data:{} };
const reset  = () => { S={action:null,data:{}}; };
const isSup  = ctx => ctx.from?.id === SUPERVISOR_ID;

// ── Divider / formatting ──────────────────────────────────────
const DIV = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

// ── Broadcast ─────────────────────────────────────────────────
async function broadcast(text, md='Markdown') {
  const sent = await bot.telegram.sendMessage(STAFF_GROUP_ID, text, {parse_mode:md});
  try { await bot.telegram.pinChatMessage(STAFF_GROUP_ID, sent.message_id); }
  catch(e){ console.warn('[PIN]',e.message); }
}

// ── Build yard status text (reused in /status and view_all) ───
function buildStatusText(db) {
  const entries = Object.entries(db);
  if (!entries.length) return '_No active yard assignments._';

  const grouped = {};
  for(const [k,arr] of entries){
    const {liner,size} = parseKey(k);
    if(!grouped[liner]) grouped[liner]={};
    grouped[liner][size]=arr;
  }

  const lines = [];
  for(const [liner, sizes] of Object.entries(grouped)){
    lines.push(`🚢 *${liner}*`);
    for(const [size, arr] of Object.entries(sizes)){
      lines.push(`  ${sizeEmoji(size)} *${sizeLabel(size)}*`);
      for(const e of arr){
        const newTag  = isNewEntry(e)  ? ' 🆕' : '';
        const fullTag = isFullEntry(e) ? ' 🔴 FULL' : '';
        const strike  = isFullEntry(e) ? '~' : '';
        lines.push(`    └ ${strike}\`${e.block}\`${strike}${newTag}${fullTag}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

// ── Main Menu ─────────────────────────────────────────────────
const MENU_KB = Markup.inlineKeyboard([
  [Markup.button.callback('➕  Add Block',     'menu_set'),
   Markup.button.callback('🔴  Mark Full',      'menu_markfull')],
  [Markup.button.callback('🗑️  Remove Block',   'menu_remove'),
   Markup.button.callback('📋  View Yard',      'menu_view')],
  [Markup.button.callback('📣  Announcement',   'menu_announce'),
   Markup.button.callback('🔄  Refresh',        'menu_refresh')],
]);

function menuText(db) {
  const count  = Object.values(db).flat().length;
  const full   = Object.values(db).flat().filter(e=>e.full).length;
  const active = count - full;
  return (
    `🏗️ *TCY Yard Control Panel*\n${DIV}\n` +
    `📦 Active Blocks: *${active}*    🔴 Full: *${full}*\n` +
    `${DIV}\n_Select an action:_`
  );
}

const BACK = [[Markup.button.callback('← Back to Menu','menu_main')]];

// ── /start  /menu ─────────────────────────────────────────────
bot.start(async ctx => {
  try {
    if(!isSup(ctx)) return ctx.reply(
      `👋 *Welcome to TCY Yard Locator*\n${DIV}\nType a liner name \\(e\\.g\\. *CMA*, *MSC*\\) to find its yard block\\.`,
      {parse_mode:'MarkdownV2'}
    );
    const db = readDB();
    reset();
    await ctx.reply(menuText(db),{parse_mode:'Markdown',...MENU_KB});
  }catch(e){console.error(e.message);}
});

bot.command('menu', async ctx => {
  try {
    if(!isSup(ctx))return;
    const db = readDB();
    reset();
    await ctx.reply(menuText(db),{parse_mode:'Markdown',...MENU_KB});
  } catch(e){console.error(e.message);}
});

// ── /status — quick public yard view ─────────────────────────
bot.command('status', async ctx => {
  try {
    const db   = readDB();
    const text = `📋 *TCY YARD STATUS*\n${DIV}\n${buildStatusText(db)}\n${DIV}`;
    await ctx.reply(text, {parse_mode:'Markdown'});
  } catch(e){console.error(e.message);}
});

// ── /help ─────────────────────────────────────────────────────
bot.command('help', async ctx => {
  await ctx.reply(
    `ℹ️ *TCY Yard Locator — Help*\n${DIV}\n` +
    `Simply type a *liner name* to find its block.\n\n` +
    `*Examples:*\n` +
    `• Type \`CMA\` → see CMA blocks\n` +
    `• Type \`MSC\` → see MSC blocks\n\n` +
    `*Supervisor Commands:*\n` +
    `/menu — Open control panel\n` +
    `/status — View full yard status\n`,
    {parse_mode:'Markdown'}
  );
});

// ── Back / Refresh ────────────────────────────────────────────
bot.action('menu_main', async ctx=>{
  try{
    await ctx.answerCbQuery();
    if(!isSup(ctx))return;
    const db = readDB();
    reset();
    await ctx.editMessageText(menuText(db),{parse_mode:'Markdown',...MENU_KB});
  }catch(e){console.error(e.message);}
});

bot.action('menu_refresh', async ctx=>{
  try{
    await ctx.answerCbQuery('✅ Refreshed');
    if(!isSup(ctx))return;
    const db = readDB();
    await ctx.editMessageText(menuText(db),{parse_mode:'Markdown',...MENU_KB});
  }catch(e){console.error(e.message);}
});

// ── SET step 1: ask liner name ────────────────────────────────
bot.action('menu_set', async ctx=>{
  try{
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    S={action:'awaiting_liner_name',data:{}};
    await ctx.editMessageText(
      `➕ *Add / Update Block*\n${DIV}\nType the *liner name*:\n_e.g._ \`CMA\`, \`MSC\`, \`LILY\``,
      {parse_mode:'Markdown',...Markup.inlineKeyboard(BACK)});
  }catch(e){console.error(e.message);}
});

// ── SET step 2: size buttons ──────────────────────────────────
bot.action(/^sz_(.+)$/, async ctx=>{
  try{
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    S.data.size = ctx.match[1];
    const db    = readDB();
    const key   = makeKey(S.data.liner, S.data.size);
    const existing = (db[key]||[]).map(e=>{
      const fullTag = e.full ? ' 🔴' : '';
      const newTag  = isNewEntry(e) ? ' 🆕' : '';
      return `  • \`${e.block}\`${newTag}${fullTag}`;
    }).join('\n');
    const info = existing ? `\n\n*Current blocks:*\n${existing}\n` : '';
    const tbBtns = Object.keys(TB_SIZES).map(t=>Markup.button.callback(t,`tb_${t}`));
    await ctx.editMessageText(
      `➕ *${S.data.liner}* › ${sizeEmoji(S.data.size)} *${sizeLabel(S.data.size)}*${info}\n\nSelect *terminal block*:`,
      {parse_mode:'Markdown',...Markup.inlineKeyboard([tbBtns.slice(0,4),tbBtns.slice(4),BACK[0]])});
  }catch(e){console.error(e.message);}
});

// ── SET step 3: TB ────────────────────────────────────────────
bot.action(/^tb_(.+)$/, async ctx=>{
  try{
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    S.data.tb = ctx.match[1];
    const count=TB_SIZES[S.data.tb];
    const rows=[];
    for(let i=1;i<=count;i+=5) rows.push(Array.from({length:Math.min(5,count-i+1)},(_,j)=>Markup.button.callback(`${i+j}`,`bay_${i+j}`)));
    rows.push(BACK[0]);
    await ctx.editMessageText(
      `➕ *${S.data.liner}* › *${sizeLabel(S.data.size)}* › *${S.data.tb}*\n\nPick a *bay number*:`,
      {parse_mode:'Markdown',...Markup.inlineKeyboard(rows)});
  }catch(e){console.error(e.message);}
});

// ── SET step 4: bay → save ────────────────────────────────────
bot.action(/^bay_(\d+)$/, async ctx=>{
  try{
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    const {liner,size,tb}=S.data;
    if(!liner||!size||!tb) return ctx.answerCbQuery('Session expired. Use /menu.');
    const block   = `${tb}-${ctx.match[1]}`;
    const addedAt = Math.floor(Date.now()/1000);
    const db      = readDB();
    const key     = makeKey(liner,size);
    if(!db[key]) db[key]=[];
    const isAdditional = db[key].filter(e=>!e.full).length > 0;
    db[key].push({block, addedAt, full:false});
    writeDB(db);
    reset();
    console.log(`[SET] ${key} += ${block}`);

    await ctx.editMessageText(
      `✅ *Block Added*\n${DIV}\n🚢 *${liner}*  •  ${sizeEmoji(size)} ${sizeLabel(size)}\n📦 Block: *${block}*`,
      {parse_mode:'Markdown'});

    const broadcastText = isAdditional
      ? `📢 *YARD UPDATE*\n${DIV}\n🚢 *${liner}*  •  ${sizeEmoji(size)} *${sizeLabel(size)}*\n\n🆕 Additional block opened: *${block}*\n\n_All operators, please note the new location._`
      : `📢 *YARD UPDATE*\n${DIV}\n🚢 *${liner}*  •  ${sizeEmoji(size)} *${sizeLabel(size)}*\n\n📦 Containers routing to block *${block}*\n\n_All operators, route units accordingly._`;

    await broadcast(broadcastText);
    const db2 = readDB();
    await ctx.reply(menuText(db2),{parse_mode:'Markdown',...MENU_KB});
  }catch(e){console.error(e.message);}
});

// ── MARK FULL ─────────────────────────────────────────────────
bot.action('menu_markfull', async ctx=>{
  try{
    await ctx.answerCbQuery(); if(!isSup(ctx))return; reset();
    const db=readDB();
    const btns=[];
    for(const [k,entries] of Object.entries(db)){
      const {liner,size}=parseKey(k);
      for(let i=0;i<entries.length;i++){
        const e=entries[i];
        if(e.full) continue; // skip already full
        btns.push([Markup.button.callback(
          `📦 ${liner} · ${sizeLabel(size)} · ${e.block}`,
          `markfull_${liner}_${size}_${i}`
        )]);
      }
    }
    if(!btns.length){
      return ctx.editMessageText('✅ No active blocks to mark as full.',{...Markup.inlineKeyboard(BACK)});
    }
    btns.push(BACK[0]);
    await ctx.editMessageText(
      `🔴 *Mark Block as Full*\n${DIV}\nSelect a block to mark as full:\n_Staff will be notified automatically._`,
      {parse_mode:'Markdown',...Markup.inlineKeyboard(btns)});
  }catch(e){console.error(e.message);}
});

bot.action(/^markfull_([^_]+)_([^_]+)_(\d+)$/, async ctx=>{
  try{
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    const liner=ctx.match[1], size=ctx.match[2], idx=parseInt(ctx.match[3]);
    const key=makeKey(liner,size);
    const db=readDB();
    if(!db[key]||!db[key][idx]) return ctx.answerCbQuery('Entry not found.');
    const entry = db[key][idx];
    if(entry.full) return ctx.answerCbQuery('Already marked full.');
    entry.full = true;
    entry.fullAt = Math.floor(Date.now()/1000);
    writeDB(db);
    console.log(`[FULL] ${key}[${idx}] = ${entry.block}`);

    // Find next available block for same liner+size
    const next = db[key]?.find((e,i)=>i!==idx && !e.full);

    let broadcastText =
      `🔴 *BLOCK FULL*\n${DIV}\n` +
      `🚢 *${liner}*  •  ${sizeEmoji(size)} *${sizeLabel(size)}*\n\n` +
      `🔴 Block *${entry.block}* is now *FULL*.\n`;

    if(next){
      broadcastText += `\n➡️ Continue to block *${next.block}*\n`;
    } else {
      broadcastText += `\n⚠️ *No additional blocks available.* Contact supervisor.\n`;
    }
    broadcastText += `\n_All operators, please update accordingly._`;

    await ctx.editMessageText(
      `✅ *${liner} · ${sizeLabel(size)} · ${entry.block}* marked as FULL.`,
      {parse_mode:'Markdown',...Markup.inlineKeyboard([[
        Markup.button.callback('🔴 Mark Another','menu_markfull'),
        Markup.button.callback('← Menu','menu_main')
      ]])});

    await broadcast(broadcastText);
  }catch(e){console.error(e.message);}
});

// ── REMOVE ────────────────────────────────────────────────────
bot.action('menu_remove', async ctx=>{
  try{
    await ctx.answerCbQuery(); if(!isSup(ctx))return; reset();
    const db=readDB();
    const btns=[];
    for(const [k,entries] of Object.entries(db)){
      const {liner,size}=parseKey(k);
      for(let i=0;i<entries.length;i++){
        const e=entries[i];
        const fullTag = e.full ? '🔴 ' : '';
        const newTag  = isNewEntry(e) && !e.full ? '🆕 ' : '';
        btns.push([Markup.button.callback(
          `✕  ${liner} · ${sizeLabel(size)} · ${fullTag}${newTag}${e.block}`,
          `del_${liner}_${size}_${i}`
        )]);
      }
    }
    if(!btns.length) return ctx.editMessageText('No blocks assigned yet.',{...Markup.inlineKeyboard(BACK)});
    btns.push(BACK[0]);
    await ctx.editMessageText(
      `🗑️ *Remove a Block*\n${DIV}\nTap a block to permanently remove it:`,
      {parse_mode:'Markdown',...Markup.inlineKeyboard(btns)});
  }catch(e){console.error(e.message);}
});

bot.action(/^del_([^_]+)_([^_]+)_(\d+)$/, async ctx=>{
  try{
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    const liner=ctx.match[1], size=ctx.match[2], idx=parseInt(ctx.match[3]);
    const key=makeKey(liner,size);
    const db=readDB();
    if(!db[key]||!db[key][idx]) return ctx.answerCbQuery('Entry not found.');
    const removed=db[key].splice(idx,1)[0];
    if(!db[key].length) delete db[key];
    writeDB(db);
    await ctx.editMessageText(
      `✅ Removed *${liner} · ${sizeLabel(size)} · ${removed.block}*`,
      {parse_mode:'Markdown',...Markup.inlineKeyboard([[
        Markup.button.callback('🗑️ Remove Another','menu_remove'),
        Markup.button.callback('← Menu','menu_main')
      ]])});
  }catch(e){console.error(e.message);}
});

// ── ANNOUNCE ─────────────────────────────────────────────────
bot.action('menu_announce', async ctx=>{
  try{
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    S={action:'awaiting_announce',data:{}};
    await ctx.editMessageText(
      `📣 *Send Announcement*\n${DIV}\nType your message to broadcast to the staff group:`,
      {parse_mode:'Markdown',...Markup.inlineKeyboard(BACK)});
  }catch(e){console.error(e.message);}
});

// ── VIEW ALL ──────────────────────────────────────────────────
bot.action('menu_view', async ctx=>{
  try{
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    const db=readDB();
    const text = `📋 *Full Yard Status*\n${DIV}\n${buildStatusText(db)}\n${DIV}`;
    await ctx.editMessageText(text,{parse_mode:'Markdown',
      ...Markup.inlineKeyboard([[
        Markup.button.callback('🔄 Refresh','menu_view'),
        Markup.button.callback('← Menu','menu_main')
      ]])});
  }catch(e){console.error(e.message);}
});

// ── TEXT HANDLER ──────────────────────────────────────────────
bot.on(message('text'), async ctx=>{
  try{
    const text=ctx.message.text.trim();
    if(text.startsWith('/')) return;

    // Supervisor flow
    if(isSup(ctx)){
      if(S.action==='awaiting_liner_name'){
        S.data.liner=text.toUpperCase();
        S.action='awaiting_size';
        const sizeRows=[
          SIZES.slice(0,2).map(s=>Markup.button.callback(`${sizeEmoji(s.id)} ${s.label}`,`sz_${s.id}`)),
          SIZES.slice(2).map(s=>Markup.button.callback(`${sizeEmoji(s.id)} ${s.label}`,`sz_${s.id}`)),
          BACK[0],
        ];
        await ctx.reply(
          `🚢 *${S.data.liner}*\n${DIV}\nSelect *container size*:`,
          {parse_mode:'Markdown',...Markup.inlineKeyboard(sizeRows)});
        return;
      }
      if(S.action==='awaiting_announce'){
        reset();
        await broadcast(`📣 *ANNOUNCEMENT*\n${DIV}\n${text}`);
        const db = readDB();
        await ctx.reply('✅ Announcement pinned in staff group!');
        await ctx.reply(menuText(db),{parse_mode:'Markdown',...MENU_KB});
        return;
      }
    }

    // Staff search
    const q=text.toUpperCase();
    const db=readDB();
    const matches=Object.entries(db).filter(([k])=>parseKey(k).liner===q);

    if(matches.length){
      const activeBlocks = matches.flatMap(([k,arr])=>arr.filter(e=>!e.full).map(e=>({...e,...parseKey(k)})));
      const fullBlocks   = matches.flatMap(([k,arr])=>arr.filter(e=>e.full ).map(e=>({...e,...parseKey(k)})));

      let reply = `🔍 *YARD LOCATOR*\n${DIV}\n🚢 *${q}*\n\n`;

      // Group active by size
      const bySizeActive = {};
      for(const e of activeBlocks){
        if(!bySizeActive[e.size]) bySizeActive[e.size]=[];
        bySizeActive[e.size].push(e);
      }
      if(Object.keys(bySizeActive).length){
        for(const [size, arr] of Object.entries(bySizeActive)){
          reply += `${sizeEmoji(size)} *${sizeLabel(size)}*\n`;
          for(const e of arr){
            const newTag = isNewEntry(e) ? '  🆕 New' : '';
            reply += `  📦 Block \`${e.block}\`${newTag}\n`;
          }
          reply += '\n';
        }
      }

      if(fullBlocks.length){
        reply += `🔴 *Full Blocks* _(no longer accepting)_\n`;
        for(const e of fullBlocks){
          reply += `  ~~\`${e.block}\`~~ · ${sizeLabel(e.size)}\n`;
        }
        reply += '\n';
      }

      reply += DIV;
      await ctx.reply(reply,{parse_mode:'Markdown'});
    } else {
      await ctx.reply(
        `❓ *${q}* is not currently assigned.\n${DIV}\n_Contact the supervisor for assistance._`,
        {parse_mode:'Markdown'});
    }
  }catch(e){console.error('[TEXT]',e.message); try{await ctx.reply('❌ Error. Please try again.');}catch{}}
});

// ── Launch ────────────────────────────────────────────────────
bot.launch()
  .then(async ()=>{
    console.log('[BOT] Running… (Timezone: Maldives UTC+5)');
    await bot.telegram.setMyCommands([
      {command:'menu',   description:'⚙️ Open Control Panel (supervisor)'},
      {command:'status', description:'📋 View current yard status'},
      {command:'help',   description:'ℹ️ How to use this bot'},
    ]);
    console.log('[BOT] Commands registered.');
  })
  .catch(e=>{console.error('[BOT] Failed:',e.message); process.exit(1);});

process.once('SIGINT',  ()=>bot.stop('SIGINT'));
process.once('SIGTERM', ()=>bot.stop('SIGTERM'));
