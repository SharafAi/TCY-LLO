// ============================================================
//  TCY Port — Admin API + Static File Server  (Express)
//  Run alongside bot.js via PM2 ecosystem
// ============================================================

import express           from 'express';
import { fileURLToPath } from 'url';
import fs                from 'fs';
import path              from 'path';
import { Telegraf }      from 'telegraf';
import dayjs             from 'dayjs';
import advancedFormat    from 'dayjs/plugin/advancedFormat.js';

dayjs.extend(advancedFormat);

// ─────────────────────────────────────────────
//  CONFIG  (must match bot.js)
// ─────────────────────────────────────────────
const BOT_TOKEN      = '8825795943:AAHRHbNQRPYct_5tMg2Q4hrpfGOKArVDPFQ';
const STAFF_GROUP_ID = -5399708931;
const DASHBOARD_PORT = 3000;
const DASHBOARD_PASS = 'tcy2024';   // ← change this password

// ─────────────────────────────────────────────
//  SHARED DB
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

if (!fs.existsSync(DB_PATH)) writeDB({});

// ─────────────────────────────────────────────
//  TELEGRAM CLIENT (send-only)
// ─────────────────────────────────────────────
const telegram = new Telegraf(BOT_TOKEN).telegram;

async function broadcastAndPin(text, parseMode = 'Markdown') {
  const sent = await telegram.sendMessage(STAFF_GROUP_ID, text, { parse_mode: parseMode });
  await telegram.pinChatMessage(STAFF_GROUP_ID, sent.message_id, { disable_notification: false });
  return sent;
}

// ─────────────────────────────────────────────
//  EXPRESS APP
// ─────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Password middleware (write endpoints only) ──
function auth(req, res, next) {
  const pass = req.headers['x-dashboard-pass'] || req.query.pass;
  if (pass !== DASHBOARD_PASS) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ── PUBLIC: get all liner assignments (staff can read) ──
app.get('/api/layout', (req, res) => {
  res.json(readDB());
});

// ── PROTECTED: set / update a liner ──────────
app.post('/api/set', auth, async (req, res) => {
  try {
    const liner     = (req.body.liner || '').toUpperCase().trim();
    const block     = (req.body.block || '').toUpperCase().trim();
    if (!liner || !block) return res.status(400).json({ error: 'liner and block are required' });

    const updatedAt = dayjs().format('hh:mm A');
    const db        = readDB();
    db[liner]       = { block, updatedAt };
    writeDB(db);

    await broadcastAndPin(
      `📢 *YARD UPDATE* 📢\n\n` +
      `🚢 *${liner}* containers are now being allocated to zone *${block}*.\n\n` +
      `All operators unloading barges, please route units accordingly.`
    );

    res.json({ success: true, liner, block, updatedAt });
  } catch (err) {
    console.error('[DASHBOARD /set]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PROTECTED: delete a liner ─────────────────
app.delete('/api/liner/:liner', auth, (req, res) => {
  try {
    const liner = req.params.liner.toUpperCase();
    const db    = readDB();
    if (!db[liner]) return res.status(404).json({ error: 'Liner not found' });
    delete db[liner];
    writeDB(db);
    res.json({ success: true, deleted: liner });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PROTECTED: send announcement ──────────────
app.post('/api/announce', auth, async (req, res) => {
  try {
    const text = (req.body.message || '').trim();
    if (!text) return res.status(400).json({ error: 'message is required' });
    await broadcastAndPin(text, undefined);
    res.json({ success: true });
  } catch (err) {
    console.error('[DASHBOARD /announce]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Serve the React webapp (built to /public) ─
const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');

if (fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get('*', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
} else {
  app.get('*', (_req, res) =>
    res.send('<h2>Run <code>cd webapp && npm install && npm run build</code> first.</h2>')
  );
}

app.listen(DASHBOARD_PORT, () => {
  console.log(`[DASHBOARD] Running at http://localhost:${DASHBOARD_PORT}`);
});

// ─────────────────────────────────────────────
//  GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────
process.once('SIGINT',  () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));
