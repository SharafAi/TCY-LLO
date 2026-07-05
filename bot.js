// ============================================================
//  TCY Port — Container Yard Locator Bot  (ES Modules)
// ============================================================
import { Telegraf, Markup } from 'telegraf';
import { message }          from 'telegraf/filters';
import fs   from 'fs';
import path from 'path';
import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat.js';
dayjs.extend(advancedFormat);

// ── Config ────────────────────────────────────────────────────
const BOT_TOKEN      = '8825795943:AAHRHbNQRPYct_5tMg2Q4hrpfGOKArVDPFQ';
const SUPERVISOR_ID  = 7953520542;
const STAFF_GROUP_ID = -5399708931;
const NEW_HOURS      = 24; // 🆕 tag shows for 24 hours

// ── Block / size data ─────────────────────────────────────────
const TB_SIZES = { TB1:10, TB2:16, TB3:16, TB4:10, TB5:30, TB6:40, TB7:40 };
const SIZES    = [
  { id:'20FT', label:'📦 20 FT'    },
  { id:'40FT', label:'📦 40 FT'    },
  { id:'40HC', label:'📦 40 HC'    },
  { id:'ALL',  label:'📦 All Sizes'},
];
const sizeLabel = id => SIZES.find(s=>s.id===id)?.label.replace('📦 ','') ?? id;

// ── DB key helpers ────────────────────────────────────────────
// DB key  : "CMA|20FT"
// entries : [{ block, updatedAt, addedAt }]
const makeKey   = (liner, size) => `${liner}|${size}`;
const parseKey  = key  => { const [liner,size='ALL']=key.split('|'); return {liner,size}; };
const isNewEntry= e    => (Date.now()/1000-(e.addedAt||0)) < NEW_HOURS*3600;

// ── DB ────────────────────────────────────────────────────────
const DB_PATH = './yard_layout.json';

function readDB() {
  try {
    const raw = JSON.parse(fs.readFileSync(DB_PATH,'utf8'));
    // Migrate old flat {block,updatedAt} → array format
    const out = {};
    for(const [k,v] of Object.entries(raw)){
      out[k] = Array.isArray(v) ? v : [{ block:v.block, updatedAt:v.updatedAt, addedAt:0 }];
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

// ── Broadcast ─────────────────────────────────────────────────
async function broadcast(text, md='Markdown') {
  const sent = await bot.telegram.sendMessage(STAFF_GROUP_ID, text, {parse_mode:md});
  try { await bot.telegram.pinChatMessage(STAFF_GROUP_ID, sent.message_id); }
  catch(e){ console.warn('[PIN]',e.message); }
}

// ── Menu ──────────────────────────────────────────────────────
const MENU_KB  = Markup.inlineKeyboard([
  [Markup.button.callback('📍 Set / Add Block','menu_set'),
   Markup.button.callback('🗑️ Remove Block',  'menu_remove')],
  [Markup.button.callback('📣 Announcement',   'menu_announce'),
   Markup.button.callback('🗂️ View All',       'menu_view')],
]);
const MENU_TXT = '⚓ *TCY Yard Control Panel*\n\nSelect an action:';
const BACK     = [[Markup.button.callback('← Back','menu_main')]];

// ── /start  /menu ─────────────────────────────────────────────
bot.start(async ctx => {
  try {
    if(!isSup(ctx)) return ctx.reply('👋 Type a liner name (e.g. *CMA*) to find its location.',{parse_mode:'Markdown'});
    reset(); await ctx.reply(MENU_TXT,{parse_mode:'Markdown',...MENU_KB});
  }catch(e){console.error(e.message);}
});
bot.command('menu', async ctx => {
  try { if(!isSup(ctx))return; reset(); await ctx.reply(MENU_TXT,{parse_mode:'Markdown',...MENU_KB}); }
  catch(e){console.error(e.message);}
});

// ── Back ──────────────────────────────────────────────────────
bot.action('menu_main', async ctx=>{
  try{ await ctx.answerCbQuery(); if(!isSup(ctx))return; reset(); await ctx.editMessageText(MENU_TXT,{parse_mode:'Markdown',...MENU_KB}); }
  catch(e){console.error(e.message);}
});

// ── SET step 1: ask liner name ────────────────────────────────
bot.action('menu_set', async ctx=>{
  try{
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    S={action:'awaiting_liner_name',data:{}};
    await ctx.editMessageText('📍 *Add / Update Block*\n\nType the *liner name* (e.g. `CMA`, `MSC`):',
      {parse_mode:'Markdown',...Markup.inlineKeyboard(BACK)});
  }catch(e){console.error(e.message);}
});

// ── SET step 2: size buttons (sent after liner name typed) ────
bot.action(/^sz_(.+)$/, async ctx=>{
  try{
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    S.data.size = ctx.match[1];
    // Show existing blocks for this liner+size
    const db  = readDB();
    const key = makeKey(S.data.liner, S.data.size);
    const existing = (db[key]||[]).map(e=>`• ${isNewEntry(e)?'🆕 ':''}${e.block}`).join('\n');
    const info = existing ? `\nCurrent blocks:\n${existing}\n\n_Adding a new block below:_` : '';
    const tbBtns = Object.keys(TB_SIZES).map(t=>Markup.button.callback(t,`tb_${t}`));
    await ctx.editMessageText(
      `📍 *${S.data.liner}* · *${sizeLabel(S.data.size)}*${info}\n\nSelect *terminal block*:`,
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
      `📍 *${S.data.liner}* · *${sizeLabel(S.data.size)}* · *${S.data.tb}*\n\nPick a *bay number*:`,
      {parse_mode:'Markdown',...Markup.inlineKeyboard(rows)});
  }catch(e){console.error(e.message);}
});

// ── SET step 4: bay → save ────────────────────────────────────
bot.action(/^bay_(\d+)$/, async ctx=>{
  try{
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    const {liner,size,tb}=S.data;
    if(!liner||!size||!tb) return ctx.answerCbQuery('Session expired. Use /menu.');
    const block     = `${tb}-${ctx.match[1]}`;
    const updatedAt = dayjs().format('hh:mm A');
    const addedAt   = Math.floor(Date.now()/1000);
    const db        = readDB();
    const key       = makeKey(liner,size);
    if(!db[key]) db[key]=[];
    const isAdditional = db[key].length > 0;
    db[key].push({block,updatedAt,addedAt});
    writeDB(db);
    reset();
    console.log(`[SET] ${key} += ${block}`);

    await ctx.editMessageText(
      `✅ *Block Added!*\n\n🚢 *${liner}* · ${sizeLabel(size)}\n📦 Block: *${block}*\n🕐 Time:  *${updatedAt}*`,
      {parse_mode:'Markdown'});

    const broadcastText = isAdditional
      ? `📢 *YARD UPDATE* 📢\n\n🚢 *${liner}* _(${sizeLabel(size)})_ — 🆕 *NEW BLOCK OPENED*\n📦 Zone *${block}* has started receiving containers.\n\nAll operators, please note the additional location.`
      : `📢 *YARD UPDATE* 📢\n\n🚢 *${liner}* _(${sizeLabel(size)})_ containers → zone *${block}*.\n\nAll operators, please route units accordingly.`;

    await broadcast(broadcastText);
    await ctx.reply(MENU_TXT,{parse_mode:'Markdown',...MENU_KB});
  }catch(e){console.error(e.message);}
});

// ── REMOVE ────────────────────────────────────────────────────
bot.action('menu_remove', async ctx=>{
  try{
    await ctx.answerCbQuery(); if(!isSup(ctx))return; reset();
    const db=readDB();
    // Flatten all entries into individual delete buttons
    const btns=[];
    for(const [k,entries] of Object.entries(db)){
      const {liner,size}=parseKey(k);
      for(let i=0;i<entries.length;i++){
        const e=entries[i];
        const newTag=isNewEntry(e)?'🆕 ':'';
        // callback: del_{liner}_{size}_{idx}
        btns.push([Markup.button.callback(
          `🗑 ${liner} · ${sizeLabel(size)} · ${newTag}${e.block}`,
          `del_${liner}_${size}_${i}`
        )]);
      }
    }
    if(!btns.length) return ctx.editMessageText('No blocks assigned yet.',{...Markup.inlineKeyboard(BACK)});
    btns.push(BACK[0]);
    await ctx.editMessageText('🗑️ *Remove a Block*\n\nTap a block to remove it:',
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
      {parse_mode:'Markdown',...Markup.inlineKeyboard([[Markup.button.callback('🗑 Remove Another','menu_remove'),Markup.button.callback('← Menu','menu_main')]])});
  }catch(e){console.error(e.message);}
});

// ── ANNOUNCE ─────────────────────────────────────────────────
bot.action('menu_announce', async ctx=>{
  try{
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    S={action:'awaiting_announce',data:{}};
    await ctx.editMessageText('📣 *Send Announcement*\n\nType your message:',
      {parse_mode:'Markdown',...Markup.inlineKeyboard(BACK)});
  }catch(e){console.error(e.message);}
});

// ── VIEW ALL ──────────────────────────────────────────────────
bot.action('menu_view', async ctx=>{
  try{
    await ctx.answerCbQuery(); if(!isSup(ctx))return;
    const db=readDB();
    const entries=Object.entries(db);
    // Group by liner
    const grouped={};
    for(const [k,arr] of entries){
      const {liner,size}=parseKey(k);
      if(!grouped[liner]) grouped[liner]={};
      grouped[liner][size]=arr;
    }
    let text='🗂️ *Current Yard Layout*\n\n';
    if(!entries.length){ text+='_No blocks assigned yet._'; }
    else {
      text+=Object.entries(grouped).map(([liner,sizes])=>{
        const sizeLines=Object.entries(sizes).map(([size,arr])=>{
          const blocks=arr.map(e=>`    ${isNewEntry(e)?'🆕 ':''}\`${e.block}\` _(${e.updatedAt})_`).join('\n');
          return `  📦 *${sizeLabel(size)}*\n${blocks}`;
        }).join('\n');
        return `🚢 *${liner}*\n${sizeLines}`;
      }).join('\n\n');
    }
    await ctx.editMessageText(text,{parse_mode:'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('🔄 Refresh','menu_view'),Markup.button.callback('← Menu','menu_main')]])});
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
          SIZES.slice(0,2).map(s=>Markup.button.callback(s.label,`sz_${s.id}`)),
          SIZES.slice(2).map(s=>Markup.button.callback(s.label,`sz_${s.id}`)),
          BACK[0],
        ];
        await ctx.reply(`🚢 Liner: *${S.data.liner}*\n\nSelect *container size*:`,
          {parse_mode:'Markdown',...Markup.inlineKeyboard(sizeRows)});
        return;
      }
      if(S.action==='awaiting_announce'){
        reset();
        await broadcast(text, undefined);
        await ctx.reply('✅ Announcement pinned in staff group!',MENU_KB);
        return;
      }
    }

    // Staff search
    const q=text.toUpperCase();
    const db=readDB();
    const matches=Object.entries(db).filter(([k])=>parseKey(k).liner===q);

    if(matches.length){
      let reply=`🔍 *YARD LOCATOR*\n━━━━━━━━━━━━━━━━━\n🚢 Liner: *${q}*\n`;
      for(const [k,arr] of matches){
        const {size}=parseKey(k);
        reply+=`\n📦 *${sizeLabel(size)}*\n`;
        reply+=arr.map(e=>`  ${isNewEntry(e)?'🆕 *NEW* ':''}Block: \`${e.block}\`  _(${e.updatedAt})_`).join('\n');
      }
      reply+='\n━━━━━━━━━━━━━━━━━';
      await ctx.reply(reply,{parse_mode:'Markdown'});
    } else {
      await ctx.reply(`❓ Liner *${q}* is not currently assigned.\n\nPlease check with the supervisor.`,{parse_mode:'Markdown'});
    }
  }catch(e){console.error('[TEXT]',e.message); try{await ctx.reply('❌ Error. Try again.');}catch{}}
});

// ── Launch ────────────────────────────────────────────────────
bot.launch()
  .then(async ()=>{
    console.log('[BOT] Running…');
    await bot.telegram.setMyCommands([
      {command:'menu',     description:'⚙️ Open Control Panel'},
      {command:'set',      description:'📍 Set liner block (supervisor)'},
      {command:'announce', description:'📣 Send announcement (supervisor)'},
    ]);
    console.log('[BOT] Menu button registered.');
  })
  .catch(e=>{console.error('[BOT] Failed:',e.message); process.exit(1);});

process.once('SIGINT',  ()=>bot.stop('SIGINT'));
process.once('SIGTERM', ()=>bot.stop('SIGTERM'));
