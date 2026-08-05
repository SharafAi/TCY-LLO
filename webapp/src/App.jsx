import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

// ─── Constants ────────────────────────────────────────────────
const TB_SIZES = { TB1:10, TB2:16, TB3:16, TB4:10, TB5:30, TB6:40, TB7:40 }
const SIZES = [
  { id:'20FT', label:'20 FT', rf:false },
  { id:'40FT', label:'40 FT', rf:false },
  { id:'20RF', label:'20 RF', rf:true  },
  { id:'40RF', label:'40 RF', rf:true  },
]
const NEW_HOURS = 24
const IDLE_HOURS = 72   // containers idle >72h = Long Idle
const TB_ACCENT = {
  TB1:'#3b82f6', TB2:'#10b981', TB3:'#a78bfa',
  TB4:'#fb923c', TB5:'#22d3ee', TB6:'#f43f5e', TB7:'#fbbf24',
}

// Container categories
const CATEGORIES = [
  { id:'standard', label:'Standard',    icon:'📦', color:'#22d3ee',  desc:'Regular container block' },
  { id:'fresh',    label:'Fresh Empty', icon:'🟢', color:'#10b981',  desc:'Newly available empty block' },
  { id:'idle',     label:'Long Idle',   icon:'🕐', color:'#f59e0b',  desc:'Container idle >72 hours' },
]

function getTBAccent(block='') {
  const tb = Object.keys(TB_ACCENT).find(k => block.startsWith(k))
  return TB_ACCENT[tb] || '#64748b'
}
function isNew(e)    { return (Date.now()/1000 - (e.addedAt||0)) < NEW_HOURS*3600 }
function isFull(e)   { return e.full === true }
function isIdle(e)   { return !e.full && (e.category === 'idle' || (!e.category && (Date.now()/1000 - (e.addedAt||0)) > IDLE_HOURS*3600)) }
function isFresh(e)  { return !e.full && e.category === 'fresh' }
function parseKey(key) {
  const [liner, size='ALL'] = key.split('|')
  return { liner, size }
}
function getCatMeta(cat) { return CATEGORIES.find(c => c.id === cat) || CATEGORIES[0] }

// ─── apiFetch with retry + timeout ───────────────────────────
async function apiFetch(path, opts={}, retries=2, timeoutMs=12000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res  = await fetch(path, { ...opts, signal: controller.signal })
      clearTimeout(tid)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      return data
    } catch (err) {
      clearTimeout(tid)
      const isLast = attempt === retries
      if (isLast) throw err
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
    }
  }
}

// ─── Icons ───────────────────────────────────────────────────
const AnchorIcon = () => (
  <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="5" r="2"/>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v13M5 12H2a10 10 0 0018 0h-3"/>
  </svg>
)
const LockIcon = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <rect x="5" y="11" width="14" height="10" rx="2"/>
    <path strokeLinecap="round" d="M8 11V7a4 4 0 018 0v4"/>
  </svg>
)
const BoxIcon = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
  </svg>
)
const SnowIcon = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/>
  </svg>
)
const PlusIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" d="M12 5v14M5 12h14"/>
  </svg>
)
const AlertIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10"/>
    <path strokeLinecap="round" d="M12 8v4M12 16h.01"/>
  </svg>
)
const MegaphoneIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
  </svg>
)
const GridIcon = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
)
const ShipIcon = () => (
  <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l.5 2a1 1 0 001 .8h15a1 1 0 001-.8l.5-2M7 10h10l1 6H6l1-6zM12 4v6M9 4h6"/>
  </svg>
)
const SearchXIcon = () => (
  <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 10l4 4m0-4l-4 4"/>
  </svg>
)
const CheckCircleIcon = () => (
  <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
)
const TrashIcon = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
  </svg>
)
const BanIcon = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10"/>
    <path strokeLinecap="round" d="M4.93 4.93l14.14 14.14"/>
  </svg>
)

// ─── Offline Banner ───────────────────────────────────────────
function OfflineBanner({ status }) {
  if (status === 'online') return null
  return (
    <div className={`offline-banner offline-banner--${status}`}>
      <span className="offline-dot"/>
      {status === 'reconnecting'
        ? <><span className="spinner offline-spinner"/>Reconnecting to server…</>
        : '⚠️ Server unreachable — showing last known data'}
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [onDone])
  return <div className={`toast toast--${type}`}>{msg}</div>
}

// ─── Password Modal ───────────────────────────────────────────
function PasswordModal({ onSuccess, onClose }) {
  const [val, setVal] = useState('')
  const [err, setErr] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (!val) return
    setLoading(true)
    try {
      await apiFetch('/api/verify', { method: 'POST', headers: { 'x-dashboard-pass': val } })
      onSuccess(val)
    } catch { setErr(true); setVal('') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-glow"/>
        <div className="modal-logo-wrap">
          <img src="/mpl-logo-transparent.png" alt="Maldives Ports Limited" className="mpl-logo-img" style={{ height: 40 }} />
        </div>
        <h2 className="modal-title">Supervisor Gateway</h2>
        <p className="modal-sub">Enter authorized dashboard password</p>
        <input
          type="password" value={val} autoFocus
          autoComplete="off"
          onChange={e => { setVal(e.target.value); setErr(false) }}
          onKeyDown={e => e.key==='Enter' && submit()}
          placeholder="Enter password"
          className={`modal-input ${err ? 'modal-input--err' : ''}`}
        />
        {err && <p className="modal-err">Incorrect password — try again</p>}
        <button className="btn btn--primary w-full" onClick={submit} disabled={loading}>
          {loading ? <span className="spinner"/> : 'Unlock Panel'}
        </button>
        <button className="btn btn--ghost w-full" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

// ─── Block Pill ───────────────────────────────────────────────
function BlockPill({ block, full, size='md' }) {
  const color = getTBAccent(block)
  if (full) return (
    <span className={`pill pill--full pill--${size}`}>
      <span className="pill-dot" style={{background:'#f43f5e'}}/>
      <span className="pill-text">{block}</span>
      <span className="pill-tag">FULL</span>
    </span>
  )
  return (
    <span className={`pill pill--${size}`}
      style={{'--c': color, background:`${color}15`, borderColor:`${color}40`, color}}>
      <span className="pill-dot" style={{background:color}}/>
      <span className="pill-text">{block}</span>
    </span>
  )
}

// ─── Stat Card ────────────────────────────────────────────────
function StatCard({ value, label, accent }) {
  return (
    <div className="stat-card" style={{'--a': accent}}>
      <div className="stat-glow"/>
      <span className="stat-num">{value}</span>
      <span className="stat-lbl">{label}</span>
    </div>
  )
}

// ─── Size colour map ──────────────────────────────────────────
const SIZE_META = {
  '20FT': { label:'20 FT', color:'#3b82f6', bg:'rgba(59,130,246,0.08)', border:'rgba(59,130,246,0.25)', rf:false },
  '40FT': { label:'40 FT', color:'#10b981', bg:'rgba(16,185,129,0.08)', border:'rgba(16,185,129,0.25)', rf:false },
  '20RF': { label:'20 RF', color:'#22d3ee', bg:'rgba(34,211,238,0.08)', border:'rgba(34,211,238,0.25)', rf:true  },
  '40RF': { label:'40 RF', color:'#a78bfa', bg:'rgba(167,139,250,0.08)', border:'rgba(167,139,250,0.25)', rf:true  },
}

function formatBlockDate(addedAt) {
  if (!addedAt) return 'Initial Yard Setup'
  const date = new Date(addedAt * 1000)
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  })
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  let relStr = ''
  if (diffSec < 60) relStr = 'Just now'
  else if (diffSec < 3600) relStr = `${Math.floor(diffSec / 60)}m ago`
  else if (diffSec < 86400) relStr = `${Math.floor(diffSec / 3600)}h ago`
  else relStr = `${Math.floor(diffSec / 86400)}d ago`

  return `${dateStr} (${relStr})`
}

// ─── Block Detail Modal ──────────────────────────────────────
function BlockDetailModal({ blockData, onClose, password, onRefresh }) {
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  if (!blockData) return null
  const { liner, size, block, addedAt, full } = blockData

  const meta = SIZE_META[size] || { label: size, color: '#22d3ee', rf: false }
  const tbAccent = getTBAccent(block)

  function handleCopy() {
    const text = `🚢 ${liner} | ${meta.label} → Block ${block}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleMarkFull() {
    if (!password) return
    setLoading(true)
    try {
      await apiFetch('/api/markfull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dashboard-pass': password },
        body: JSON.stringify({ liner, size, block })
      })
      onRefresh()
      onClose()
    } catch {} finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box block-detail-modal">
        <div className="modal-glow" style={{ background: `radial-gradient(ellipse, ${tbAccent}40 0%, transparent 70%)` }} />
        
        <div className="detail-modal-top">
          <div>
            <span className="detail-liner-name">{liner}</span>
            <div className="detail-size-sub" style={{ color: meta.color }}>
              <span className="size-panel-icon">{meta.rf ? <SnowIcon /> : <BoxIcon />}</span>
              <span>{meta.label}</span>
              {meta.rf && <span className="rf-tag">REEFER</span>}
            </div>
          </div>
          <button className="del-x" onClick={onClose}>✕</button>
        </div>

        <div className="detail-block-card" style={{ '--bc': tbAccent, borderColor: `${tbAccent}50`, background: `${tbAccent}15` }}>
          <div className="detail-block-title">
            <span className="block-tag-dot" style={{ background: tbAccent }} />
            <span className="detail-block-num">{block}</span>
          </div>
          <span className={`badge ${full ? 'badge--red' : 'badge--green'}`}>
            {full ? 'FULL' : 'ACTIVE'}
          </span>
        </div>

        <div className="detail-info-list">
          <div className="detail-info-item">
            <span className="detail-info-label">Assigned / Started</span>
            <span className="detail-info-val">{formatBlockDate(addedAt)}</span>
          </div>
          <div className="detail-info-item">
            <span className="detail-info-label">Terminal Zone</span>
            <span className="detail-info-val">{block.split('-')[0]} Yard Section</span>
          </div>
        </div>

        <div className="detail-modal-actions">
          <button className="btn btn--primary w-full" onClick={handleCopy}>
            {copied ? '✓ Location Copied!' : 'Copy Location Info'}
          </button>
          {password && !full && (
            <button className="btn btn--danger-sm w-full" onClick={handleMarkFull} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Mark Block as FULL'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Yard Map Overview ────────────────────────────────────────
function YardMapView({ db, onBlockSelect }) {
  const tbMap = { TB1:[], TB2:[], TB3:[], TB4:[], TB5:[], TB6:[], TB7:[] }
  for (const [k, arr] of Object.entries(db)) {
    const { liner, size } = parseKey(k)
    for (const e of arr) {
      const tb = Object.keys(tbMap).find(t => e.block.startsWith(t))
      if (tb) tbMap[tb].push({ liner, size, ...e })
    }
  }

  return (
    <div className="yard-map-grid">
      {Object.entries(tbMap).map(([tbName, items]) => {
        const accent = TB_ACCENT[tbName] || '#22d3ee'
        const activeItems = items.filter(e => !isFull(e))
        return (
          <div key={tbName} className="tb-map-card" style={{ '--tbc': accent }}>
            <div className="tb-map-card-top">
              <div className="tb-map-title">
                <span className="tb-map-dot" style={{ background: accent }} />
                <span className="tb-map-name">{tbName}</span>
                <span className="tb-map-max">Max {TB_SIZES[tbName]} Bays</span>
              </div>
              <span className="chip-count">{activeItems.length} Active</span>
            </div>

            <div className="tb-map-items">
              {items.length === 0 ? (
                <span className="no-blocks-text">No active allocations</span>
              ) : (
                items.map((item, idx) => (
                  <div key={idx}
                    className={`tb-map-item ${isFull(item) ? 'tb-map-item--full' : ''}`}
                    onClick={() => onBlockSelect(item)}>
                    <span className="tb-map-item-liner">{item.liner}</span>
                    <span className="tb-map-item-block" style={{ color: accent }}>{item.block}</span>
                    <span className="tb-map-item-size">{item.size}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Staff View ───────────────────────────────────────────────
function StaffView({ db, onAdminClick, password, onRefresh }) {
  const [q, setQ] = useState('')
  const [sizeFilter, setSizeFilter] = useState('ALL')
  const [staffTab, setStaffTab] = useState('locator') // 'locator' | 'yardmap'
  const [selectedBlock, setSelectedBlock] = useState(null)
  const inputRef = useRef(null)

  const grouped = {}
  for (const [k, arr] of Object.entries(db)) {
    const { liner, size } = parseKey(k)
    if (!grouped[liner]) grouped[liner] = {}
    grouped[liner][size] = arr
  }

  const allLiners = Object.keys(grouped).sort()
  const query = q.trim().toUpperCase()

  const filtered = allLiners.filter(liner => {
    if (query && !liner.includes(query)) return false
    if (sizeFilter !== 'ALL') {
      const sizes = grouped[liner]
      if (!sizes[sizeFilter] || sizes[sizeFilter].length === 0) return false
    }
    return true
  })

  const totalBlocks  = Object.values(db).flat().length
  const activeBlocks = Object.values(db).flat().filter(e=>!isFull(e)).length
  const fullBlocks   = totalBlocks - activeBlocks

  return (
    <div className="screen screen--dark">
      {/* Header with official MPL Logo */}
      <header className="top-bar">
        <div className="top-bar-brand">
          <div className="mpl-logo-wrap">
            <img src="/mpl-logo-transparent.png" alt="Maldives Ports Limited" className="mpl-logo-img" />
          </div>
          <div className="brand-text-group">
            <span className="brand-org">MALDIVES PORTS LIMITED</span>
            <h1 className="brand-name">TCY Yard Locator</h1>
          </div>
        </div>
        <div className="top-bar-right">
          <button className="icon-btn" onClick={onAdminClick} title="Supervisor Gateway">
            <LockIcon/>
          </button>
        </div>
      </header>

      {/* Hero Search */}
      <div className="hero-search">
        {staffTab === 'locator' ? (
          <>
            <p className="hero-label">Find container block</p>
            <div className="search-wrap">
              <svg className="search-ico" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input ref={inputRef} type="text" value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Type liner name — CMA, MSC…"
                className="search-field"
              />
              {q && <button className="search-x" onClick={() => { setQ(''); inputRef.current?.focus() }}>✕</button>}
            </div>

            {/* Quick Size Filters */}
            <div className="size-filter-row">
              <button className={`size-filter-chip ${sizeFilter==='ALL'?'size-filter-chip--active':''}`}
                onClick={()=>setSizeFilter('ALL')}>
                <GridIcon/> All Sizes
              </button>
              {SIZES.map(s => (
                <button key={s.id}
                  className={`size-filter-chip ${sizeFilter===s.id?'size-filter-chip--active':''}`}
                  onClick={()=>setSizeFilter(s.id)}>
                  {s.rf ? <SnowIcon/> : <BoxIcon/>} {s.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="hero-map-header">
            <p className="hero-label">Terminal Overview</p>
            <h2 className="hero-map-title">Yard Section Map (TB1 - TB7)</h2>
          </div>
        )}

        {/* Mini stats */}
        <div className="mini-stats">
          <span className="mini-stat"><span className="mini-dot" style={{background:'#22d3ee'}}/>{allLiners.length} liners</span>
          <span className="mini-stat"><span className="mini-dot" style={{background:'#10b981'}}/>{activeBlocks} active</span>
          <span className="mini-stat"><span className="mini-dot" style={{background:'#f43f5e'}}/>{fullBlocks} full</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="results-area">
        {staffTab === 'yardmap' ? (
          <YardMapView db={db} onBlockSelect={setSelectedBlock} />
        ) : (
          <>
            {allLiners.length === 0 && (
              <div className="empty">
                <div className="empty-ico"><ShipIcon/></div>
                <p className="empty-t">No active liners</p>
                <p className="empty-s">Contact supervisor to configure yard blocks</p>
              </div>
            )}
            {allLiners.length > 0 && filtered.length === 0 && (
              <div className="empty">
                <div className="empty-ico"><SearchXIcon/></div>
                <p className="empty-t">No match found</p>
                <p className="empty-s">No liner matches your search or size filter</p>
              </div>
            )}

            <div className="liner-grid">
              {filtered.map(liner => {
                const sizes = grouped[liner]
                const allBlocks = Object.values(sizes).flat()
                const hasActive = allBlocks.some(e => !isFull(e))
                return (
                  <div key={liner} className={`liner-card ${!hasActive?'liner-card--dead':''}`}>
                    <div className="liner-card-shine"/>
                    {/* Liner header */}
                    <div className="liner-card-top">
                      <div className="liner-name-row">
                        <span className="liner-tag">{liner}</span>
                        <span className="liner-sub">Shipping Line</span>
                      </div>
                      <div className="liner-badges">
                        {!hasActive && <span className="badge badge--red">ALL FULL</span>}
                        {hasActive && isNew(allBlocks.find(e=>!isFull(e))) && (
                          <span className="badge badge--green">NEW</span>
                        )}
                      </div>
                    </div>

                    {/* Size panels */}
                    <div className="size-panels">
                      {Object.entries(sizes)
                        .filter(([sizeId]) => sizeFilter==='ALL' || sizeId===sizeFilter)
                        .map(([sizeId, arr]) => {
                        const meta = SIZE_META[sizeId] || { label:sizeId, color:'#64748b', bg:'rgba(100,116,139,0.08)', border:'rgba(100,116,139,0.25)', rf:false }
                        const activeArr  = arr.filter(e => !isFull(e))
                        const fullArr    = arr.filter(e =>  isFull(e))
                        return (
                          <div key={sizeId} className="size-panel"
                            style={{'--sc': meta.color, '--sbg': meta.bg, '--sborder': meta.border}}>
                            {/* Size header bar */}
                            <div className="size-panel-header">
                              <div className="size-panel-label">
                                <span className="size-panel-icon">
                                  {meta.rf ? <SnowIcon/> : <BoxIcon/>}
                                </span>
                                <span className="size-panel-name">{meta.label}</span>
                                {meta.rf && <span className="rf-tag">REEFER</span>}
                              </div>
                              <span className="size-panel-count">{activeArr.length} active</span>
                            </div>
                            {/* Blocks */}
                            <div className="size-panel-blocks">
                              {activeArr.length === 0 && fullArr.length === 0 && (
                                <span className="no-blocks-text">No blocks assigned</span>
                              )}

                              {/* Fresh Empty category */}
                              {activeArr.filter(e => isFresh(e)).length > 0 && (
                                <div className="cat-section cat-section--fresh">
                                  <span className="cat-section-label">🟢 Fresh Empty</span>
                                  <div className="cat-section-blocks">
                                    {activeArr.filter(e => isFresh(e)).map((e,i) => (
                                      <div key={`fr${i}`} className="block-tag block-tag--fresh" style={{'--bc': getTBAccent(e.block)}}
                                        onClick={() => setSelectedBlock({ liner, size: sizeId, block: e.block, addedAt: e.addedAt, full: false, category: e.category })}>
                                        <span className="block-tag-dot"/>
                                        <span className="block-tag-name">{e.block}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Long Idle category */}
                              {activeArr.filter(e => isIdle(e)).length > 0 && (
                                <div className="cat-section cat-section--idle">
                                  <span className="cat-section-label">🕐 Long Idle</span>
                                  <div className="cat-section-blocks">
                                    {activeArr.filter(e => isIdle(e)).map((e,i) => (
                                      <div key={`id${i}`} className="block-tag block-tag--idle" style={{'--bc': getTBAccent(e.block)}}
                                        onClick={() => setSelectedBlock({ liner, size: sizeId, block: e.block, addedAt: e.addedAt, full: false, category: e.category })}>
                                        <span className="block-tag-dot"/>
                                        <span className="block-tag-name">{e.block}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Standard blocks */}
                              {activeArr.filter(e => !isFresh(e) && !isIdle(e)).map((e,i) => (
                                <div key={i} className="block-tag block-tag--active" style={{'--bc': getTBAccent(e.block)}}
                                  onClick={() => setSelectedBlock({ liner, size: sizeId, block: e.block, addedAt: e.addedAt, full: false })}>
                                  <span className="block-tag-dot"/>
                                  <span className="block-tag-name">{e.block}</span>
                                </div>
                              ))}

                              {fullArr.map((e,i) => (
                                <div key={`f${i}`} className="block-tag block-tag--full"
                                  onClick={() => setSelectedBlock({ liner, size: sizeId, block: e.block, addedAt: e.addedAt, full: true })}>
                                  <span className="block-tag-dot"/>
                                  <span className="block-tag-name">{e.block}</span>
                                  <span className="block-tag-full">FULL</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {filtered.length > 0 && (
              <p className="results-count">{filtered.length} liner{filtered.length!==1?'s':''} shown</p>
            )}
          </>
        )}
      </div>

      {/* Block Details Modal */}
      {selectedBlock && (
        <BlockDetailModal
          blockData={selectedBlock}
          onClose={() => setSelectedBlock(null)}
          password={password}
          onRefresh={onRefresh}
        />
      )}

      {/* Bottom Port Tools Dock */}
      <nav className="bottom-tools-dock">
        <button className={`dock-btn ${staffTab==='locator'?'dock-btn--active':''}`}
          onClick={()=>setStaffTab('locator')}>
          <BoxIcon/>
          <span>Block Locator</span>
        </button>
        <button className={`dock-btn ${staffTab==='yardmap'?'dock-btn--active':''}`}
          onClick={()=>setStaffTab('yardmap')}>
          <GridIcon/>
          <span>Yard Map</span>
        </button>
      </nav>
    </div>
  )
}


// ─── Admin Panel ──────────────────────────────────────────────
function AdminPanel({ password, db, onRefresh, onLogout }) {
  const [liner,           setLiner]           = useState('')
  const [size,            setSize]            = useState('20FT')
  const [tb,              setTb]              = useState('TB1')
  const [bay,             setBay]             = useState('1')
  const [category,        setCategory]        = useState('standard')
  const [loading,         setLoading]         = useState(false)
  const [toast,           setToast]           = useState(null)
  const [announceText,    setAnnounceText]    = useState('')
  const [activeTab,       setActiveTab]       = useState('set')
  const [adminFilter,     setAdminFilter]     = useState('')
  const [adminSizeFilter, setAdminSizeFilter] = useState('ALL')

  function showToast(msg, type='success') { setToast({ msg, type }) }
  function handleErr(err) {
    showToast(err.message, 'error')
    if (err.message === 'Unauthorized') onLogout()
  }

  const H = { 'Content-Type':'application/json', 'x-dashboard-pass': password }

  async function handleSet(e) {
    e.preventDefault()
    const name = liner.trim().toUpperCase()
    if (!name) return
    setLoading(true)
    try {
      await apiFetch('/api/set', { method:'POST', headers:H,
        body: JSON.stringify({ liner:name, size, block:`${tb}-${bay}`, category }) })
      showToast(`${name} · ${size} → ${tb}-${bay} set & pinned!`)
      setLiner(''); setTb('TB1'); setBay('1'); setCategory('standard')
      onRefresh()
    } catch(err) { handleErr(err) }
    finally { setLoading(false) }
  }


  async function handleMarkFull(liner, size, block) {
    if (!confirm(`Mark ${liner} · ${block} as FULL?\nThis will notify the staff group.`)) return
    setLoading(true)
    try {
      await apiFetch('/api/markfull', { method:'POST', headers:H,
        body: JSON.stringify({ liner, size, block }) })
      showToast(`${liner} · ${block} marked FULL — staff notified`)
      onRefresh()
    } catch(err) { handleErr(err) }
    finally { setLoading(false) }
  }

  async function handleDelete(liner, size, block) {
    if (!confirm(`Remove block ${block} from ${liner}?`)) return
    try {
      await apiFetch(`/api/block?liner=${liner}&size=${size}&block=${block}`,
        { method:'DELETE', headers:H })
      showToast(`${block} removed`)
      onRefresh()
    } catch(err) { handleErr(err) }
  }

  async function handleAnnounce(e) {
    e.preventDefault()
    if (!announceText.trim()) return
    setLoading(true)
    try {
      await apiFetch('/api/announce', { method:'POST', headers:H,
        body: JSON.stringify({ message: announceText }) })
      showToast('Announcement pinned in staff group!')
      setAnnounceText('')
    } catch(err) { handleErr(err) }
    finally { setLoading(false) }
  }

  const bayCount = TB_SIZES[tb]

  // Flatten DB
  const allEntries = []
  for (const [k, arr] of Object.entries(db)) {
    const { liner: l, size: s } = parseKey(k)
    for (const e of arr) allEntries.push({ liner:l, size:s, ...e })
  }
  const active = allEntries.filter(e => !isFull(e))
  const full   = allEntries.filter(e =>  isFull(e))

  const filterQuery = adminFilter.trim().toUpperCase()

  const filteredActive = active.filter(e => {
    if (adminSizeFilter !== 'ALL' && e.size !== adminSizeFilter) return false
    if (!filterQuery) return true
    return e.liner.includes(filterQuery) || e.block.includes(filterQuery) || e.size.includes(filterQuery)
  })

  const filteredAll = allEntries.filter(e => {
    if (adminSizeFilter !== 'ALL' && e.size !== adminSizeFilter) return false
    if (!filterQuery) return true
    return e.liner.includes(filterQuery) || e.block.includes(filterQuery) || e.size.includes(filterQuery)
  })

  // Group active blocks by liner
  const activeGroupedByLiner = {}
  for (const item of filteredActive) {
    if (!activeGroupedByLiner[item.liner]) activeGroupedByLiner[item.liner] = []
    activeGroupedByLiner[item.liner].push(item)
  }

  const TABS = [
    { id:'set',      Icon: PlusIcon,      label:'Add Block'  },
    { id:'full',     Icon: BanIcon,       label:'Quick Actions' },
    { id:'announce', Icon: MegaphoneIcon, label:'Announce'   },
    { id:'view',     Icon: GridIcon,      label:'Master List' },
  ]

  return (
    <div className="screen screen--dark">
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}

      {/* Header */}
      <header className="top-bar">
        <div className="top-bar-brand">
          <div className="mpl-logo-wrap">
            <img src="/mpl-logo-transparent.png" alt="Maldives Ports Limited" className="mpl-logo-img" />
          </div>
          <div className="brand-text-group">
            <span className="brand-org">MALDIVES PORTS LIMITED</span>
            <h1 className="brand-name">Supervisor Control</h1>
          </div>
        </div>
        <div className="top-bar-right">
          <button className="logout-btn" onClick={onLogout}>Sign Out</button>
        </div>
      </header>

      {/* Stats */}
      <div className="stats-strip">
        <StatCard value={allEntries.length} label="Total"  accent="#22d3ee"/>
        <StatCard value={active.length}     label="Active" accent="#10b981"/>
        <StatCard value={full.length}       label="Full"   accent="#f43f5e"/>
        <StatCard value={Object.keys(db).map(k=>parseKey(k).liner).filter((v,i,a)=>a.indexOf(v)===i).length} label="Liners" accent="#a78bfa"/>
      </div>

      {/* Tabs */}
      <div className="tab-strip">
        {TABS.map(t => (
          <button key={t.id} className={`tab ${activeTab===t.id?'tab--on':''}`}
            onClick={() => setActiveTab(t.id)}>
            <span className="tab-icon"><t.Icon/></span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="admin-body">

        {/* ── ADD BLOCK ── */}
        {activeTab==='set' && (
          <div className="glass-card">
            <h2 className="section-title"><PlusIcon/> Add / Update Block</h2>
            <form onSubmit={handleSet} className="form-stack">
              <div className="field">
                <label className="field-lbl">Liner Name</label>
                <input value={liner}
                  onChange={e => setLiner(e.target.value.toUpperCase())}
                  placeholder="e.g. CMA, MSC, LILY"
                  className="field-inp" required />
              </div>
              <div className="field">
                <label className="field-lbl">Container Size</label>
                <div className="size-grid">
                  {SIZES.map(s => (
                    <button type="button" key={s.id}
                      className={`size-btn ${size===s.id?'size-btn--on':''}`}
                      onClick={() => setSize(s.id)}>
                      <span className="size-btn-icon">{s.rf ? <SnowIcon/> : <BoxIcon/>}</span>
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="two-col">
                <div className="field">
                  <label className="field-lbl">Terminal Block</label>
                  <select value={tb} onChange={e => { setTb(e.target.value); setBay('1') }}
                    className="field-inp field-sel">
                    {Object.keys(TB_SIZES).map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-lbl">Bay Number</label>
                  <select value={bay} onChange={e => setBay(e.target.value)}
                    className="field-inp field-sel">
                    {Array.from({ length: bayCount }, (_,i) => (
                      <option key={i+1} value={i+1}>{i+1}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label className="field-lbl">Container Category</label>
                <div className="cat-grid">
                  {CATEGORIES.map(c => (
                    <button type="button" key={c.id}
                      className={`cat-btn ${category===c.id?'cat-btn--on':''}`}
                      style={{'--cc': c.color}}
                      onClick={() => setCategory(c.id)}>
                      <span className="cat-btn-icon">{c.icon}</span>
                      <span className="cat-btn-label">{c.label}</span>
                      <span className="cat-btn-desc">{c.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="preview-box">
                <span className="preview-lbl">Preview block:</span>
                <BlockPill block={`${tb}-${bay}`} full={false} size="lg"/>
                <span className="cat-preview-tag" style={{background: `${getCatMeta(category).color}20`, color: getCatMeta(category).color, borderColor: `${getCatMeta(category).color}40`}}>
                  {getCatMeta(category).icon} {getCatMeta(category).label}
                </span>
              </div>
              <button type="submit" disabled={loading} className="btn btn--primary w-full">
                {loading ? <span className="spinner"/> : <><MegaphoneIcon/> Set & Broadcast to Staff</>}
              </button>

            </form>
          </div>
        )}

        {/* ── QUICK ACTIONS (MARK FULL / CLEAR) ── */}
        {activeTab==='full' && (
          <div className="glass-card">
            <div className="card-header-row mb12">
              <div>
                <h2 className="section-title mb0"><BanIcon/> Quick Block Actions</h2>
                <p className="section-sub">Mark active blocks FULL or remove completed allocations.</p>
              </div>
              <span className="chip-count">{filteredActive.length} Active</span>
            </div>

            {/* Size Categorization Filter Chips */}
            <div className="size-filter-row mb12">
              <button className={`size-filter-chip ${adminSizeFilter==='ALL'?'size-filter-chip--active':''}`}
                onClick={()=>setAdminSizeFilter('ALL')}>
                <GridIcon/> All Sizes
              </button>
              {SIZES.map(s => (
                <button key={s.id}
                  className={`size-filter-chip ${adminSizeFilter===s.id?'size-filter-chip--active':''}`}
                  onClick={()=>setAdminSizeFilter(s.id)}>
                  {s.rf ? <SnowIcon/> : <BoxIcon/>} {s.label}
                </button>
              ))}
            </div>

            {/* Search Filter Input */}
            <div className="search-wrap mb16">
              <svg className="search-ico" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input type="text" value={adminFilter}
                onChange={e => setAdminFilter(e.target.value)}
                placeholder="Filter by liner or block (e.g. CMA, TB2)..."
                className="search-field"
              />
              {adminFilter && <button className="search-x" onClick={()=>setAdminFilter('')}>✕</button>}
            </div>

            {filteredActive.length === 0 ? (
              <div className="empty-inline"><CheckCircleIcon/> No active blocks match size/filter</div>
            ) : (
              <div className="admin-liner-groups">
                {Object.entries(activeGroupedByLiner).map(([linerName, items]) => {
                  // Sub-group items by container size
                  const sizeGroups = items.reduce((acc, it) => {
                    if (!acc[it.size]) acc[it.size] = []
                    acc[it.size].push(it)
                    return acc
                  }, {})

                  return (
                    <div key={linerName} className="admin-liner-group">
                      <div className="admin-liner-header">
                        <span className="liner-tag">{linerName}</span>
                        <span className="chip-count">{items.length} block{items.length!==1?'s':''}</span>
                      </div>

                      <div className="admin-size-subgroups">
                        {Object.entries(sizeGroups).map(([sizeId, sizeItems]) => {
                          const meta = SIZE_META[sizeId] || { label: sizeId, color: '#22d3ee' }
                          return (
                            <div key={sizeId} className="admin-size-subgroup" style={{ '--sc': meta.color }}>
                              <div className="admin-size-subgroup-header" style={{ color: meta.color }}>
                                <span className="size-panel-icon">{meta.rf ? <SnowIcon/> : <BoxIcon/>}</span>
                                <span className="size-panel-name">{meta.label}</span>
                                <span className="chip-count">{sizeItems.length}</span>
                              </div>
                              <div className="entry-list">
                                {sizeItems.map((e, i) => (
                                  <div key={i} className="entry-row">
                                    <div className="entry-meta">
                                      <span className="entry-date">{formatBlockDate(e.addedAt)}</span>
                                    </div>
                                    <BlockPill block={e.block} full={false}/>
                                    <div className="entry-actions">
                                      <button disabled={loading}
                                        onClick={() => handleMarkFull(e.liner, e.size, e.block)}
                                        className="btn btn--danger-sm">
                                        Mark FULL
                                      </button>
                                      <button onClick={() => handleDelete(e.liner, e.size, e.block)}
                                        className="del-x" title="Delete Block"><TrashIcon/></button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ANNOUNCE ── */}
        {activeTab==='announce' && (
          <div className="glass-card">
            <h2 className="section-title"><MegaphoneIcon/> Broadcast Announcement</h2>
            <p className="section-sub">Message will be pinned in the staff Telegram group.</p>
            <form onSubmit={handleAnnounce} className="form-stack">
              <textarea value={announceText}
                onChange={e => setAnnounceText(e.target.value)}
                placeholder="Type your announcement…"
                rows={5} className="field-inp field-ta"/>
              <button type="submit" disabled={loading || !announceText.trim()}
                className="btn btn--violet w-full">
                {loading ? <span className="spinner"/> : <><MegaphoneIcon/> Pin in Staff Group</>}
              </button>
            </form>
          </div>
        )}

        {/* ── VIEW ALL / MASTER LIST ── */}
        {activeTab==='view' && (
          <div className="glass-card">
            <div className="card-header-row mb12">
              <div>
                <h2 className="section-title mb0"><GridIcon/> Master Allocation List</h2>
                <p className="section-sub">Manage all active and full terminal blocks.</p>
              </div>
              <span className="chip-count">{filteredAll.length} blocks</span>
            </div>

            {/* Size Categorization Filter Chips */}
            <div className="size-filter-row mb12">
              <button className={`size-filter-chip ${adminSizeFilter==='ALL'?'size-filter-chip--active':''}`}
                onClick={()=>setAdminSizeFilter('ALL')}>
                <GridIcon/> All Sizes
              </button>
              {SIZES.map(s => (
                <button key={s.id}
                  className={`size-filter-chip ${adminSizeFilter===s.id?'size-filter-chip--active':''}`}
                  onClick={()=>setAdminSizeFilter(s.id)}>
                  {s.rf ? <SnowIcon/> : <BoxIcon/>} {s.label}
                </button>
              ))}
            </div>

            {/* Search Filter Input */}
            <div className="search-wrap mb16">
              <svg className="search-ico" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input type="text" value={adminFilter}
                onChange={e => setAdminFilter(e.target.value)}
                placeholder="Search allocations..."
                className="search-field"
              />
              {adminFilter && <button className="search-x" onClick={()=>setAdminFilter('')}>✕</button>}
            </div>

            {filteredAll.length === 0 ? (
              <div className="empty-inline">No blocks match size or search.</div>
            ) : (
              <div className="entry-list">
                {filteredAll.map((e,i) => (
                  <div key={i} className={`entry-row ${isFull(e)?'entry-row--full':''}`}>
                    <div className="entry-meta">
                      <span className="entry-liner">{e.liner}</span>
                      <span className="entry-size"><span className="entry-size-icon">{e.size.includes('RF') ? <SnowIcon/> : <BoxIcon/>}</span> {SIZES.find(s=>s.id===e.size)?.label||e.size}</span>
                      <span className="entry-date">{formatBlockDate(e.addedAt)}</span>
                    </div>
                    <BlockPill block={e.block} full={isFull(e)}/>
                    <div className="entry-actions">
                      {!isFull(e) && (
                        <button disabled={loading}
                          onClick={() => handleMarkFull(e.liner, e.size, e.block)}
                          className="btn btn--danger-sm">
                          FULL
                        </button>
                      )}
                      <button onClick={() => handleDelete(e.liner,e.size,e.block)}
                        className="del-x" title="Remove"><TrashIcon/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────
export default function App() {
  const [db,            setDb]           = useState({})
  const [view,          setView]         = useState('staff')
  const [showModal,     setShowModal]    = useState(false)
  const [password,      setPassword]     = useState(sessionStorage.getItem('tcy-pass')||'')
  const [connStatus,    setConnStatus]   = useState('online') // 'online'|'reconnecting'|'offline'
  const failRef = useRef(0)

  const fetchDB = useCallback(async () => {
    setConnStatus(s => s === 'online' ? 'online' : 'reconnecting')
    try {
      const data = await apiFetch('/api/layout')
      setDb(data)
      failRef.current = 0
      setConnStatus('online')
    } catch {
      failRef.current += 1
      setConnStatus(failRef.current >= 2 ? 'offline' : 'reconnecting')
    }
  }, [])

  useEffect(() => {
    fetchDB()
    const id = setInterval(fetchDB, 30_000)
    return () => clearInterval(id)
  }, [fetchDB])

  async function handleAdminClick() {
    if (!password) {
      setShowModal(true)
      return
    }
    try {
      await apiFetch('/api/verify', { method: 'POST', headers: { 'x-dashboard-pass': password } })
      setView('admin')
    } catch {
      handleLogout()
      setShowModal(true)
    }
  }

  function handleSuccess(pass) {
    setPassword(pass)
    sessionStorage.setItem('tcy-pass', pass)
    setShowModal(false)
    setView('admin')
  }

  function handleLogout() {
    setPassword('')
    sessionStorage.removeItem('tcy-pass')
    setView('staff')
  }

  return (
    <>
      <OfflineBanner status={connStatus}/>
      {showModal && <PasswordModal onSuccess={handleSuccess} onClose={() => setShowModal(false)}/>}
      {view==='staff' ? (
        <StaffView db={db} onAdminClick={handleAdminClick} password={password} onRefresh={fetchDB}/>
      ) : (
        <AdminPanel password={password} db={db} onRefresh={fetchDB} onLogout={handleLogout}/>
      )}
    </>
  )
}
