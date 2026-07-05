// ============================================================
//  TCY Port — Admin Control Panel  (Express server)
//  Run alongside bot.js via PM2 ecosystem
// ============================================================

import express      from 'express';
import fs           from 'fs';
import path         from 'path';
import { Telegraf } from 'telegraf';
import dayjs        from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat.js';

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

// ── Simple password middleware ───────────────
function auth(req, res, next) {
  const pass = req.headers['x-dashboard-pass'] || req.query.pass;
  if (pass !== DASHBOARD_PASS) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── API: get all liner assignments ───────────
app.get('/api/layout', auth, (req, res) => {
  res.json(readDB());
});

// ── API: set / update a liner ────────────────
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

// ── API: delete a liner ──────────────────────
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

// ── API: send announcement ───────────────────
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

// ── Serve the dashboard UI ───────────────────
app.get('*', (req, res) => {
  res.send(HTML);
});

app.listen(DASHBOARD_PORT, () => {
  console.log(`[DASHBOARD] Control panel running at http://localhost:${DASHBOARD_PORT}`);
});

// ─────────────────────────────────────────────
//  GRACEFUL SHUTDOWN
// ─────────────────────────────────────────────
process.once('SIGINT',  () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));

// ─────────────────────────────────────────────
//  DASHBOARD HTML  (self-contained)
// ─────────────────────────────────────────────
const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>TCY Yard Control Panel</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#0a0d14;--surface:#111827;--surface2:#1a2235;--border:#1e2d45;
    --accent:#3b82f6;--accent2:#60a5fa;--green:#10b981;--red:#ef4444;
    --amber:#f59e0b;--text:#e2e8f0;--muted:#64748b;--radius:12px;
  }
  body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh}

  /* LOGIN */
  #login-screen{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .login-card{background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:48px 40px;width:100%;max-width:400px;text-align:center}
  .login-card .logo{font-size:40px;margin-bottom:16px}
  .login-card h1{font-size:22px;font-weight:700;margin-bottom:6px}
  .login-card p{color:var(--muted);font-size:14px;margin-bottom:32px}
  .login-card input{width:100%;padding:14px 16px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:15px;outline:none;text-align:center;letter-spacing:4px;margin-bottom:16px;transition:.2s}
  .login-card input:focus{border-color:var(--accent)}
  .btn-primary{width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;transition:.2s}
  .btn-primary:hover{background:var(--accent2)}
  .err-msg{color:var(--red);font-size:13px;margin-top:10px;display:none}

  /* APP */
  #app{display:none}
  header{background:var(--surface);border-bottom:1px solid var(--border);padding:16px 32px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;backdrop-filter:blur(10px)}
  .header-left{display:flex;align-items:center;gap:14px}
  .header-left .icon{width:40px;height:40px;background:linear-gradient(135deg,var(--accent),#8b5cf6);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px}
  .header-left h1{font-size:18px;font-weight:700}
  .header-left span{font-size:12px;color:var(--muted);display:block;margin-top:1px}
  .status-dot{width:8px;height:8px;background:var(--green);border-radius:50%;display:inline-block;margin-right:6px;animation:pulse 2s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  .btn-logout{background:transparent;border:1px solid var(--border);color:var(--muted);padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;transition:.2s}
  .btn-logout:hover{border-color:var(--red);color:var(--red)}

  main{padding:32px;max-width:1100px;margin:0 auto;display:grid;gap:28px}

  .section-title{font-size:13px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:16px}

  /* CARDS */
  .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:24px}
  .card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}
  .card-header h2{font-size:16px;font-weight:600}

  /* FORMS */
  .form-row{display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end}
  .form-group{display:flex;flex-direction:column;gap:6px}
  .form-group label{font-size:12px;font-weight:500;color:var(--muted)}
  .form-group input,.form-group textarea{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:11px 14px;color:var(--text);font-size:14px;font-family:inherit;outline:none;transition:.2s;width:100%}
  .form-group input:focus,.form-group textarea:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(59,130,246,.1)}
  .form-group textarea{resize:vertical;min-height:90px}
  .btn{padding:11px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:.2s;white-space:nowrap}
  .btn-set{background:var(--accent);color:#fff}
  .btn-set:hover{background:var(--accent2)}
  .btn-announce{background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;width:100%}
  .btn-announce:hover{opacity:.9}
  .btn-del{background:transparent;border:1px solid var(--border);color:var(--muted);padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;transition:.2s}
  .btn-del:hover{border-color:var(--red);color:var(--red);background:rgba(239,68,68,.05)}

  /* TABLE */
  .table-wrap{overflow-x:auto;border-radius:10px;border:1px solid var(--border)}
  table{width:100%;border-collapse:collapse}
  thead th{background:var(--surface2);padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
  tbody tr{border-top:1px solid var(--border);transition:.15s}
  tbody tr:hover{background:var(--surface2)}
  tbody td{padding:14px 16px;font-size:14px;vertical-align:middle}
  .liner-badge{background:linear-gradient(135deg,rgba(59,130,246,.15),rgba(139,92,246,.15));border:1px solid rgba(59,130,246,.3);color:var(--accent2);padding:4px 10px;border-radius:6px;font-size:13px;font-weight:700;letter-spacing:.05em}
  .block-badge{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);color:#34d399;padding:4px 10px;border-radius:6px;font-size:13px;font-weight:600}
  .empty-state{text-align:center;padding:48px 24px;color:var(--muted)}
  .empty-state .empty-icon{font-size:40px;margin-bottom:12px}
  .empty-state p{font-size:14px}

  /* TOAST */
  #toast{position:fixed;bottom:24px;right:24px;padding:14px 20px;border-radius:10px;font-size:14px;font-weight:500;z-index:999;transform:translateY(80px);opacity:0;transition:.3s;max-width:320px}
  #toast.show{transform:translateY(0);opacity:1}
  #toast.success{background:#065f46;border:1px solid #10b981;color:#a7f3d0}
  #toast.error{background:#7f1d1d;border:1px solid #ef4444;color:#fca5a5}

  /* STAT STRIP */
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px}
  .stat{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:18px;display:flex;align-items:center;gap:14px}
  .stat-icon{font-size:24px}
  .stat-val{font-size:22px;font-weight:700}
  .stat-lbl{font-size:12px;color:var(--muted);margin-top:2px}

  @media(max-width:600px){
    .form-row{grid-template-columns:1fr}
    main{padding:16px}
    header{padding:14px 16px}
  }
</style>
</head>
<body>

<!-- LOGIN -->
<div id="login-screen">
  <div class="login-card">
    <div class="logo">⚓</div>
    <h1>TCY Yard Control</h1>
    <p>Enter your access password to continue</p>
    <input type="password" id="pass-input" placeholder="••••••••" onkeydown="if(event.key==='Enter')doLogin()"/>
    <button class="btn-primary" onclick="doLogin()">Access Dashboard</button>
    <div class="err-msg" id="err-msg">Incorrect password. Try again.</div>
  </div>
</div>

<!-- APP -->
<div id="app">
  <header>
    <div class="header-left">
      <div class="icon">⚓</div>
      <div>
        <h1>TCY Yard Control Panel</h1>
        <span><span class="status-dot"></span>Bot Online · Staff Group Active</span>
      </div>
    </div>
    <button class="btn-logout" onclick="logout()">Log Out</button>
  </header>

  <main>
    <!-- STATS -->
    <div class="stats" id="stats-strip">
      <div class="stat"><div class="stat-icon">🚢</div><div><div class="stat-val" id="stat-liners">—</div><div class="stat-lbl">Active Liners</div></div></div>
      <div class="stat"><div class="stat-icon">📦</div><div><div class="stat-val" id="stat-zones">—</div><div class="stat-lbl">Zones in Use</div></div></div>
      <div class="stat"><div class="stat-icon">🕐</div><div><div class="stat-val" id="stat-updated">—</div><div class="stat-lbl">Last Updated</div></div></div>
    </div>

    <!-- SET LOCATION -->
    <div class="card">
      <div class="card-header"><h2>📍 Update Yard Location</h2></div>
      <div class="form-row">
        <div class="form-group">
          <label>Liner Name</label>
          <input type="text" id="inp-liner" placeholder="e.g. CMA" style="text-transform:uppercase"/>
        </div>
        <div class="form-group">
          <label>Block / Zone</label>
          <input type="text" id="inp-block" placeholder="e.g. TB5-3" style="text-transform:uppercase"/>
        </div>
        <button class="btn btn-set" onclick="setLiner()">📢 Set &amp; Broadcast</button>
      </div>
      <p style="margin-top:12px;font-size:12px;color:var(--muted)">This will update the database and immediately pin an alert in the staff group.</p>
    </div>

    <!-- ANNOUNCE -->
    <div class="card">
      <div class="card-header"><h2>📣 Send Announcement</h2></div>
      <div class="form-group" style="margin-bottom:12px">
        <label>Message</label>
        <textarea id="inp-announce" placeholder="Type your announcement here..."></textarea>
      </div>
      <button class="btn btn-announce" onclick="sendAnnounce()">📣 Broadcast &amp; Pin in Staff Group</button>
    </div>

    <!-- YARD TABLE -->
    <div class="card">
      <div class="card-header">
        <h2>🗂️ Current Yard Layout</h2>
        <button class="btn btn-set" style="font-size:13px;padding:8px 16px" onclick="loadLayout()">↻ Refresh</button>
      </div>
      <div id="table-container"></div>
    </div>
  </main>
</div>

<div id="toast"></div>

<script>
let PASS = '';

function doLogin() {
  PASS = document.getElementById('pass-input').value;
  fetch('/api/layout?pass=' + encodeURIComponent(PASS))
    .then(r => {
      if (r.status === 401) throw new Error('bad');
      return r.json();
    })
    .then(() => {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      loadLayout();
    })
    .catch(() => {
      document.getElementById('err-msg').style.display = 'block';
      document.getElementById('pass-input').value = '';
    });
}

function logout() {
  PASS = '';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('pass-input').value = '';
}

function headers() {
  return { 'Content-Type': 'application/json', 'x-dashboard-pass': PASS };
}

function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  setTimeout(() => t.className = '', 3000);
}

function loadLayout() {
  fetch('/api/layout?pass=' + encodeURIComponent(PASS), { headers: headers() })
    .then(r => r.json())
    .then(data => {
      renderTable(data);
      const liners = Object.keys(data);
      const zones  = [...new Set(liners.map(l => data[l].block))];
      document.getElementById('stat-liners').textContent  = liners.length;
      document.getElementById('stat-zones').textContent   = zones.length;
      const last = liners.sort((a,b)=>data[b].updatedAt>data[a].updatedAt?1:-1)[0];
      document.getElementById('stat-updated').textContent = last ? data[last].updatedAt : '—';
    });
}

function renderTable(data) {
  const keys = Object.keys(data);
  const wrap = document.getElementById('table-container');
  if (!keys.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No liners assigned yet. Use the form above to add one.</p></div>';
    return;
  }
  let rows = keys.map(liner => \`
    <tr>
      <td><span class="liner-badge">\${liner}</span></td>
      <td><span class="block-badge">\${data[liner].block}</span></td>
      <td style="color:var(--muted);font-size:13px">\${data[liner].updatedAt}</td>
      <td><button class="btn-del" onclick="deleteLiner('\${liner}')">✕ Remove</button></td>
    </tr>
  \`).join('');
  wrap.innerHTML = \`
    <div class="table-wrap">
      <table>
        <thead><tr><th>Liner</th><th>Block / Zone</th><th>Last Updated</th><th>Action</th></tr></thead>
        <tbody>\${rows}</tbody>
      </table>
    </div>
  \`;
}

function setLiner() {
  const liner = document.getElementById('inp-liner').value.trim().toUpperCase();
  const block = document.getElementById('inp-block').value.trim().toUpperCase();
  if (!liner || !block) { toast('Enter both liner and block.', 'error'); return; }
  fetch('/api/set', { method:'POST', headers: headers(), body: JSON.stringify({ liner, block }) })
    .then(r => r.json())
    .then(d => {
      if (d.error) { toast(d.error, 'error'); return; }
      toast(\`✅ \${liner} → \${block} set & pinned in staff group!\`);
      document.getElementById('inp-liner').value = '';
      document.getElementById('inp-block').value = '';
      loadLayout();
    })
    .catch(() => toast('Network error', 'error'));
}

function deleteLiner(liner) {
  if (!confirm(\`Remove \${liner} from yard layout?\`)) return;
  fetch('/api/liner/' + liner, { method:'DELETE', headers: headers() })
    .then(r => r.json())
    .then(d => {
      if (d.error) { toast(d.error, 'error'); return; }
      toast(\`🗑️ \${liner} removed.\`);
      loadLayout();
    });
}

function sendAnnounce() {
  const message = document.getElementById('inp-announce').value.trim();
  if (!message) { toast('Type a message first.', 'error'); return; }
  fetch('/api/announce', { method:'POST', headers: headers(), body: JSON.stringify({ message }) })
    .then(r => r.json())
    .then(d => {
      if (d.error) { toast(d.error, 'error'); return; }
      toast('📣 Announcement pinned in staff group!');
      document.getElementById('inp-announce').value = '';
    })
    .catch(() => toast('Network error', 'error'));
}
</script>
</body>
</html>`;
