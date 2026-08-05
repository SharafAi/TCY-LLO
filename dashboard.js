// ============================================================
//  TCY Port — Admin API + Static File Server  (Express)
//  Timezone: Maldives (UTC+5)   |  version 2.0
// ============================================================

import express           from 'express';
import { fileURLToPath } from 'url';
import fs                from 'fs';
import path              from 'path';
import crypto            from 'crypto';
import { execSync }      from 'child_process';
import { Telegraf }      from 'telegraf';
import dayjs             from 'dayjs';
import utc               from 'dayjs/plugin/utc.js';
import timezone          from 'dayjs/plugin/timezone.js';
import advancedFormat    from 'dayjs/plugin/advancedFormat.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);
const TZ = 'Indian/Maldives';

// ─────────────────────────────────────────────
//  CONFIG  (must match bot.js)
// ─────────────────────────────────────────────
const BOT_TOKEN      = '8825795943:AAHRHbNQRPYct_5tMg2Q4hrpfGOKArVDPFQ';
const STAFF_GROUP_ID = -5399708931;
const DASHBOARD_PORT  = 3000;
const DASHBOARD_PASS  = 'tcy2024';        // ← change this
const WEBHOOK_SECRET  = 'tcy-deploy-2024'; // ← set same in GitHub webhook

const DIV = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';

const SIZES    = [
  { id:'20FT', label:'20 FT'  },
  { id:'40FT', label:'40 FT'  },
  { id:'20RF', label:'20 RF ❄️'  },
  { id:'40RF', label:'40 RF ❄️'  },
];
const sizeLabel = id => SIZES.find(s=>s.id===id)?.label ?? id;
const sizeEmoji = id => id.includes('RF') ? '❄️' : '📦';

// ─────────────────────────────────────────────
//  SHARED DB  (array-entry format)
// ─────────────────────────────────────────────
const DB_PATH = './yard_layout.json';

function readDB() {
  try {
    const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    const out = {};
    for(const [k,v] of Object.entries(raw)){
      out[k] = Array.isArray(v) ? v : [{ block:v.block, addedAt:0, full:false }];
    }
    return out;
  } catch { return {}; }
}

function writeDB(data) {
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
}

if (!fs.existsSync(DB_PATH)) writeDB({});

const makeKey  = (liner, size) => `${liner}|${size}`;
const parseKey = key => { const [liner,size='ALL']=key.split('|'); return {liner,size}; };

// ─────────────────────────────────────────────
//  TELEGRAM CLIENT (send-only)
// ─────────────────────────────────────────────
const telegram = new Telegraf(BOT_TOKEN).telegram;

async function broadcastAndPin(text, parseMode = 'Markdown') {
  const sent = await telegram.sendMessage(STAFF_GROUP_ID, text, { parse_mode: parseMode });
  try {
    await telegram.pinChatMessage(STAFF_GROUP_ID, sent.message_id, { disable_notification: false });
  } catch(e){ console.warn('[PIN]', e.message); }
  return sent;
}

// ─────────────────────────────────────────────
//  EXPRESS APP
// ─────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Auth middleware (write endpoints) ────────
function auth(req, res, next) {
  const pass = req.headers['x-dashboard-pass'] || req.query.pass;
  if (pass !== DASHBOARD_PASS) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── PROTECTED: verify admin password ─────────
app.post('/api/verify', auth, (req, res) => {
  res.json({ ok: true });
});

// ── PUBLIC: get full layout ─────────────────
app.get('/api/layout', (req, res) => {
  res.json(readDB());
});

// ── PROTECTED: add a block to liner+size ────
app.post('/api/set', auth, async (req, res) => {
  try {
    const liner    = (req.body.liner    || '').toUpperCase().trim();
    const size     = (req.body.size     || '20FT').toUpperCase().trim();
    const block    = (req.body.block    || '').toUpperCase().trim();
    const category = (req.body.category || 'standard').toLowerCase().trim();
    if (!liner || !block) return res.status(400).json({ error: 'liner and block are required' });

    const addedAt = Math.floor(Date.now()/1000);
    const db      = readDB();
    const key     = makeKey(liner, size);
    if (!db[key]) db[key] = [];
    const isAdditional = db[key].filter(e=>!e.full).length > 0;
    db[key].push({ block, addedAt, full: false, category });
    writeDB(db);

    const broadcastText = isAdditional
      ? `📢 *YARD UPDATE*\n${DIV}\n🚢 *${liner}*  •  ${sizeEmoji(size)} *${sizeLabel(size)}*\n\n🆕 Additional block opened: *${block}*\n\n_All operators, please note the new location._`
      : `📢 *YARD UPDATE*\n${DIV}\n🚢 *${liner}*  •  ${sizeEmoji(size)} *${sizeLabel(size)}*\n\n📦 Containers routing to block *${block}*\n\n_All operators, route units accordingly._`;

    await broadcastAndPin(broadcastText);
    res.json({ success: true, liner, size, block, addedAt });
  } catch (err) {
    console.error('[DASHBOARD /set]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PROTECTED: mark a block as full ─────────
app.post('/api/markfull', auth, async (req, res) => {
  try {
    const liner = (req.body.liner || '').toUpperCase().trim();
    const size  = (req.body.size  || '20FT').toUpperCase().trim();
    const block = (req.body.block || '').toUpperCase().trim();
    if (!liner || !block) return res.status(400).json({ error: 'liner and block are required' });

    const key = makeKey(liner, size);
    const db  = readDB();
    if (!db[key]) return res.status(404).json({ error: 'Key not found' });

    const entry = db[key].find(e => e.block === block);
    if (!entry) return res.status(404).json({ error: 'Block not found' });
    if (entry.full) return res.status(400).json({ error: 'Already marked full' });

    entry.full   = true;
    entry.fullAt = Math.floor(Date.now()/1000);
    writeDB(db);

    const next = db[key].find(e => e.block !== block && !e.full);
    let broadcastText =
      `🔴 *BLOCK FULL*\n${DIV}\n🚢 *${liner}*  •  ${sizeEmoji(size)} *${sizeLabel(size)}*\n\n` +
      `🔴 Block *${block}* is now *FULL*.\n`;
    if (next) broadcastText += `\n➡️ Continue to block *${next.block}*\n`;
    else broadcastText += `\n⚠️ *No additional blocks available.* Contact supervisor.\n`;
    broadcastText += `\n_All operators, please update accordingly._`;

    await broadcastAndPin(broadcastText);
    res.json({ success: true, liner, size, block });
  } catch (err) {
    console.error('[DASHBOARD /markfull]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PROTECTED: remove a single block entry ───
app.delete('/api/block', auth, (req, res) => {
  try {
    const liner = (req.query.liner || '').toUpperCase().trim();
    const size  = (req.query.size  || '20FT').toUpperCase().trim();
    const block = (req.query.block || '').toUpperCase().trim();
    const key   = makeKey(liner, size);
    const db    = readDB();
    if (!db[key]) return res.status(404).json({ error: 'Key not found' });
    const before = db[key].length;
    db[key] = db[key].filter(e => e.block !== block);
    if (!db[key].length) delete db[key];
    writeDB(db);
    if (db[key]?.length === before && before > 0) return res.status(404).json({ error: 'Block not found' });
    res.json({ success: true, deleted: block });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PROTECTED: delete entire liner+size key ──
app.delete('/api/liner/:liner', auth, (req, res) => {
  try {
    const liner = req.params.liner.toUpperCase();
    const size  = (req.query.size || '').toUpperCase();
    const db    = readDB();
    if (size) {
      const key = makeKey(liner, size);
      if (!db[key]) return res.status(404).json({ error: 'Not found' });
      delete db[key];
    } else {
      const keys = Object.keys(db).filter(k => parseKey(k).liner === liner);
      if (!keys.length) return res.status(404).json({ error: 'Liner not found' });
      keys.forEach(k => delete db[k]);
    }
    writeDB(db);
    res.json({ success: true, deleted: liner });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PROTECTED: send announcement ─────────────
app.post('/api/announce', auth, async (req, res) => {
  try {
    const text = (req.body.message || '').trim();
    if (!text) return res.status(400).json({ error: 'message is required' });
    await broadcastAndPin(`📣 *ANNOUNCEMENT*\n${DIV}\n${text}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[DASHBOARD /announce]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GitHub Webhook → Auto Deploy ─────────────
app.post('/api/deploy', express.raw({ type: 'application/json' }), (req, res) => {
  // Verify GitHub signature
  const sig = req.headers['x-hub-signature-256'] || '';
  const expected = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    console.warn('[DEPLOY] Invalid signature — rejected');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = JSON.parse(req.body.toString());
  const branch  = (payload.ref || '').replace('refs/heads/', '');

  if (branch !== 'main') {
    console.log(`[DEPLOY] Push to "${branch}" — ignored (only main triggers deploy)`);
    return res.json({ skipped: true, branch });
  }

  console.log('[DEPLOY] ✅ Push to main detected — deploying…');
  res.json({ ok: true, message: 'Deploy started' });

  // Run async so response returns immediately
  setTimeout(() => {
    try {
      const __dir = path.dirname(fileURLToPath(import.meta.url));
      const opts  = { cwd: __dir, stdio: 'inherit' };

      console.log('[DEPLOY] git pull…');
      execSync('git pull --ff-only', opts);

      console.log('[DEPLOY] npm install…');
      execSync('npm install --omit=dev', opts);

      console.log('[DEPLOY] Building webapp…');
      execSync('cd webapp && npm install && npm run build', opts);

      console.log('[DEPLOY] Restarting PM2…');
      execSync('pm2 restart all', opts);

      console.log('[DEPLOY] 🚀 Deploy complete!');
    } catch (err) {
      console.error('[DEPLOY] ❌ Deploy failed:', err.message);
    }
  }, 200);
});

// ── Health check ─────────────────────────────

app.get('/api/health', (req, res) => {
  const db = readDB();
  const total  = Object.values(db).flat().length;
  const full   = Object.values(db).flat().filter(e=>e.full).length;
  res.json({
    status: 'ok',
    totalBlocks: total,
    fullBlocks: full,
    activeBlocks: total - full,
    timezone: TZ,
    serverTime: dayjs().tz(TZ).format('YYYY-MM-DD HH:mm:ss'),
  });
});

// ── Serve the React webapp (built to /public) ─
const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');

if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
} else {
  app.get('/{*splat}', (_req, res) =>
    res.send('<h2>Run <code>cd webapp &amp;&amp; npm install &amp;&amp; npm run build</code> first.</h2>')
  );
}


app.listen(DASHBOARD_PORT, () => {
  console.log(`[DASHBOARD] Running at http://localhost:${DASHBOARD_PORT}  (TZ: ${TZ})`);
});

// ─────────────────────────────────────────────
//  GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────
process.once('SIGINT',  () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));
