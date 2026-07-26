# TCY Yard Locator — AI Design & Code Intelligence

> Read this file before making ANY changes to the webapp, bot, or dashboard.

---

## 🎨 Design System (UI/UX Pro Max Standard)

### Color Palette
```
Background:    #080c14   (deep navy — never pure black)
Surface 1:     #0e1420   (card backgrounds)
Surface 2:     #131b2a   (input backgrounds)
Border muted:  rgba(255,255,255,0.07)
Border normal: rgba(255,255,255,0.12)
Text primary:  #f1f5f9
Text sub:      #94a3b8
Text muted:    #64748b

Accent cyan:   #22d3ee   (primary brand color)
Green:         #10b981   (active / success)
Red:           #f43f5e   (full / error / danger)
Violet:        #a78bfa   (announce / secondary)
Gold:          #fbbf24   (admin / supervisor)
```

### Typography
- **Headings / Labels / Badges**: `Space Grotesk` (Google Fonts, weights 400/500/600/700)
- **Body / Inputs / Paragraphs**: `DM Sans` (Google Fonts, weights 400/500/700)
- Never use system fonts. Always import from Google Fonts.

### Block Terminal Color Map
```js
TB1 → #3b82f6  (blue)
TB2 → #10b981  (green)
TB3 → #a78bfa  (violet)
TB4 → #fb923c  (orange)
TB5 → #22d3ee  (cyan)
TB6 → #f43f5e  (red)
TB7 → #fbbf24  (gold)
```

### Design Rules (Non-Negotiable)
1. **Dark mode only** — background is always `#080c14`
2. **No plain flat colors** — use gradients on CTAs (`linear-gradient(135deg,...)`)
3. **Glassmorphism cards** — `backdrop-filter: blur(16px)` on sticky headers
4. **Glow effects** — active elements emit a soft box-shadow glow matching their color
5. **Micro-animations** — all interactive elements have `transition: all .2s`
6. **Pill badges** — block identifiers use colored pill components, never plain text
7. **Left accent borders** — liner cards use `border-left: 3px solid var(--c)`
8. **Stat cards** — top glow bar using `box-shadow` matching accent color
9. **Modal animations** — use `slideUp` keyframe + `backdrop-filter: blur(8px)` overlay
10. **Toast notifications** — fixed top center, slide-in animation, auto-dismiss 3.2s

---

## 🏗️ Project Architecture

```
TCY_LLO/
├── bot.js              # Telegram bot (Node ESM)
├── dashboard.js        # Express API server (port 3000)
├── yard_layout.json    # Live data store (array-based per liner+size key)
├── webapp/
│   ├── src/
│   │   ├── App.jsx     # All UI components (Staff + Admin views)
│   │   └── App.css     # Full design system (CSS custom properties)
│   └── dist/           # Built to ../public/
└── public/             # Static files served by dashboard.js
```

### Data Schema (`yard_layout.json`)
```json
{
  "CMA|20FT": [
    { "block": "TB2-3", "addedAt": 1720000000, "full": false }
  ]
}
```
Key format: `{LINER}|{SIZE}` where SIZE ∈ `[20FT, 40FT, 20RF, 40RF]`

### Terminal Block Sizes
```js
TB1: 10 bays  |  TB2: 16 bays  |  TB3: 16 bays  |  TB4: 10 bays
TB5: 30 bays  |  TB6: 40 bays  |  TB7: 40 bays
```

---

## 🔌 API Endpoints (dashboard.js)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/layout` | No | Full yard data |
| POST | `/api/set` | Yes | Add/update block |
| POST | `/api/markfull` | Yes | Mark block full + broadcast |
| DELETE | `/api/block` | Yes | Remove block |
| POST | `/api/announce` | Yes | Send announcement |
| POST | `/api/deploy` | Webhook | GitHub auto-deploy |
| GET | `/api/health` | No | Server status |

Auth header: `x-dashboard-pass: tcy2024`

---

## 🤖 Bot Commands

| Command | Access | Description |
|---------|--------|-------------|
| `/start` | All | Welcome message |
| `/help` | All | Command list |
| `/status` | All | Full yard overview |
| `/menu` | Supervisor only | Admin control panel |
| Type liner name | All | Search by liner |

Supervisor IDs are configured in `bot.js` via `SUPERVISOR_IDS` array.

---

## 🚀 Deployment

**VPS Path**: `/root/TCY-LLO`  
**PM2 Processes**:
- `tcy-yard-bot` (id: 3) → `bot.js`
- `tcy-dashboard` (id: 4) → `dashboard.js`

**Deploy command** (after git push, auto-triggered via GitHub webhook):
```bash
cd /root/TCY-LLO && git pull && npm install && cd webapp && npm install && npm run build && cd .. && pm2 restart all
```

**GitHub Webhook**: POST to `http://VPS_IP:3000/api/deploy`  
**Webhook Secret**: `tcy-deploy-2024`

---

## ✅ Code Standards

- **Runtime**: Node.js ESM (`"type": "module"` in package.json)
- **Timezone**: Always use `Indian/Maldives` (UTC+5) via `dayjs`
- **Express version**: v5 — use `'/{*splat}'` not `'*'` for catch-all routes
- **React**: v18 with Vite build (no SSR)
- **No Tailwind** — use vanilla CSS with CSS custom properties only
- **No TypeScript** — plain JavaScript throughout
