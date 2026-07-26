import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

// ─── Constants ────────────────────────────────────────────────
const TB_SIZES = { TB1:10, TB2:16, TB3:16, TB4:10, TB5:30, TB6:40, TB7:40 }
const SIZES = [
  { id:'20FT', label:'20 FT',   emoji:'📦' },
  { id:'40FT', label:'40 FT',   emoji:'📦' },
  { id:'20RF', label:'20 RF',   emoji:'❄️' },
  { id:'40RF', label:'40 RF',   emoji:'❄️' },
]
const NEW_HOURS = 24
const TB_ACCENT = {
  TB1:'#3b82f6', TB2:'#10b981', TB3:'#a78bfa',
  TB4:'#fb923c', TB5:'#22d3ee', TB6:'#f43f5e', TB7:'#fbbf24',
}

function getTBAccent(block='') {
  const tb = Object.keys(TB_ACCENT).find(k => block.startsWith(k))
  return TB_ACCENT[tb] || '#64748b'
}
function isNew(e)  { return (Date.now()/1000 - (e.addedAt||0)) < NEW_HOURS*3600 }
function isFull(e) { return e.full === true }
function parseKey(key) {
  const [liner, size='ALL'] = key.split('|')
  return { liner, size }
}

async function apiFetch(path, opts={}) {
  const res  = await fetch(path, opts)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// ─── Anchor icon ─────────────────────────────────────────────
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
    setLoading(true)
    try {
      await apiFetch('/api/layout', { headers: { 'x-dashboard-pass': val } })
      onSuccess(val)
    } catch { setErr(true); setVal('') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-glow"/>
        <div className="modal-icon-wrap"><AnchorIcon/></div>
        <h2 className="modal-title">Supervisor Access</h2>
        <p className="modal-sub">Enter your dashboard password</p>
        <input
          type="password" value={val} autoFocus
          onChange={e => { setVal(e.target.value); setErr(false) }}
          onKeyDown={e => e.key==='Enter' && submit()}
          placeholder="••••••••"
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

// ─── Staff View ───────────────────────────────────────────────
function StaffView({ db, onAdminClick }) {
  const [q, setQ] = useState('')
  const inputRef = useRef(null)

  const grouped = {}
  for (const [k, arr] of Object.entries(db)) {
    const { liner, size } = parseKey(k)
    if (!grouped[liner]) grouped[liner] = {}
    grouped[liner][size] = arr
  }

  const allLiners = Object.keys(grouped).sort()
  const query = q.trim().toUpperCase()
  const filtered = query ? allLiners.filter(l => l.includes(query)) : allLiners

  const totalBlocks  = Object.values(db).flat().length
  const activeBlocks = Object.values(db).flat().filter(e=>!isFull(e)).length
  const fullBlocks   = totalBlocks - activeBlocks

  return (
    <div className="screen screen--dark">
      {/* Header */}
      <header className="top-bar">
        <div className="top-bar-brand">
          <div className="brand-logo"><AnchorIcon/></div>
          <div>
            <h1 className="brand-name">TCY YARD</h1>
            <p className="brand-sub">Container Locator</p>
          </div>
        </div>
        <button className="icon-btn" onClick={onAdminClick} title="Supervisor login">
          <LockIcon/>
        </button>
      </header>

      {/* Hero Search */}
      <div className="hero-search">
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

        {/* Mini stats */}
        <div className="mini-stats">
          <span className="mini-stat"><span className="mini-dot" style={{background:'#22d3ee'}}/>{allLiners.length} liners</span>
          <span className="mini-stat"><span className="mini-dot" style={{background:'#10b981'}}/>{activeBlocks} active</span>
          <span className="mini-stat"><span className="mini-dot" style={{background:'#f43f5e'}}/>{fullBlocks} full</span>
        </div>
      </div>

      {/* Results */}
      <div className="results-area">
        {allLiners.length === 0 && (
          <div className="empty">
            <div className="empty-ico">🚢</div>
            <p className="empty-t">No active liners</p>
            <p className="empty-s">Contact the supervisor to configure yard blocks</p>
          </div>
        )}
        {allLiners.length > 0 && filtered.length === 0 && (
          <div className="empty">
            <div className="empty-ico">🔍</div>
            <p className="empty-t">No match for "{query}"</p>
            <p className="empty-s">This liner is not currently assigned</p>
          </div>
        )}

        <div className="liner-grid">
          {filtered.map(liner => {
            const sizes = grouped[liner]
            const allBlocks = Object.values(sizes).flat()
            const hasActive = allBlocks.some(e => !isFull(e))
            const firstColor = getTBAccent(allBlocks[0]?.block||'')
            return (
              <div key={liner} className={`liner-card ${!hasActive?'liner-card--dead':''}`}
                style={{'--c': hasActive ? firstColor : '#64748b'}}>
                <div className="liner-card-shine"/>
                <div className="liner-card-top">
                  <span className="liner-tag">{liner}</span>
                  {!hasActive && <span className="badge badge--red">ALL FULL</span>}
                  {hasActive && isNew(allBlocks.find(e=>!isFull(e))) && (
                    <span className="badge badge--green">NEW</span>
                  )}
                </div>
                {Object.entries(sizes).map(([size, arr]) => (
                  <div key={size} className="size-section">
                    <span className="size-chip">
                      {size.includes('RF') ? '❄️' : '📦'} {SIZES.find(s=>s.id===size)?.label||size}
                    </span>
                    <div className="pill-row">
                      {arr.map((e,i) => <BlockPill key={i} block={e.block} full={isFull(e)}/>)}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {filtered.length > 0 && (
          <p className="results-count">{filtered.length} liner{filtered.length!==1?'s':''} shown</p>
        )}
      </div>
    </div>
  )
}

// ─── Admin Panel ──────────────────────────────────────────────
function AdminPanel({ password, db, onRefresh, onLogout }) {
  const [liner,        setLiner]        = useState('')
  const [size,         setSize]         = useState('20FT')
  const [tb,           setTb]           = useState('TB1')
  const [bay,          setBay]          = useState('1')
  const [loading,      setLoading]      = useState(false)
  const [toast,        setToast]        = useState(null)
  const [announceText, setAnnounceText] = useState('')
  const [activeTab,    setActiveTab]    = useState('set')

  function showToast(msg, type='success') { setToast({ msg, type }) }

  const H = { 'Content-Type':'application/json', 'x-dashboard-pass': password }

  async function handleSet(e) {
    e.preventDefault()
    const name = liner.trim().toUpperCase()
    if (!name) return
    setLoading(true)
    try {
      await apiFetch('/api/set', { method:'POST', headers:H,
        body: JSON.stringify({ liner:name, size, block:`${tb}-${bay}` }) })
      showToast(`✅ ${name} · ${size} → ${tb}-${bay} set & pinned!`)
      setLiner(''); setTb('TB1'); setBay('1')
      onRefresh()
    } catch(err) { showToast(err.message,'error') }
    finally { setLoading(false) }
  }

  async function handleMarkFull(liner, size, block) {
    if (!confirm(`Mark ${liner} · ${block} as FULL?\nThis will notify the staff group.`)) return
    setLoading(true)
    try {
      await apiFetch('/api/markfull', { method:'POST', headers:H,
        body: JSON.stringify({ liner, size, block }) })
      showToast(`🔴 ${liner} · ${block} marked FULL — staff notified`)
      onRefresh()
    } catch(err) { showToast(err.message,'error') }
    finally { setLoading(false) }
  }

  async function handleDelete(liner, size, block) {
    if (!confirm(`Remove block ${block} from ${liner}?`)) return
    try {
      await apiFetch(`/api/block?liner=${liner}&size=${size}&block=${block}`,
        { method:'DELETE', headers:H })
      showToast(`🗑️ ${block} removed`)
      onRefresh()
    } catch(err) { showToast(err.message,'error') }
  }

  async function handleAnnounce(e) {
    e.preventDefault()
    if (!announceText.trim()) return
    setLoading(true)
    try {
      await apiFetch('/api/announce', { method:'POST', headers:H,
        body: JSON.stringify({ message: announceText }) })
      showToast('📣 Announcement pinned in staff group!')
      setAnnounceText('')
    } catch(err) { showToast(err.message,'error') }
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

  const TABS = [
    { id:'set',      icon:'➕', label:'Add Block'  },
    { id:'full',     icon:'🔴', label:'Mark Full'  },
    { id:'announce', icon:'📣', label:'Announce'   },
    { id:'view',     icon:'🗂️', label:'All Blocks' },
  ]

  return (
    <div className="screen screen--dark">
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}

      {/* Header */}
      <header className="top-bar">
        <div className="top-bar-brand">
          <div className="brand-logo brand-logo--gold"><AnchorIcon/></div>
          <div>
            <h1 className="brand-name">ADMIN</h1>
            <p className="brand-sub">Supervisor Control</p>
          </div>
        </div>
        <button className="logout-btn" onClick={onLogout}>Sign Out</button>
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
            <span>{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="admin-body">

        {/* ── ADD BLOCK ── */}
        {activeTab==='set' && (
          <div className="glass-card">
            <h2 className="section-title">➕ Add / Update Block</h2>
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
                      <span>{s.emoji}</span>
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
              <div className="preview-box">
                <span className="preview-lbl">Preview block:</span>
                <BlockPill block={`${tb}-${bay}`} full={false} size="lg"/>
              </div>
              <button type="submit" disabled={loading} className="btn btn--primary w-full">
                {loading ? <span className="spinner"/> : '📢 Set & Broadcast to Staff'}
              </button>
            </form>
          </div>
        )}

        {/* ── MARK FULL ── */}
        {activeTab==='full' && (
          <div className="glass-card">
            <h2 className="section-title">🔴 Mark Block as Full</h2>
            <p className="section-sub">Staff group is notified automatically when a block is marked full.</p>
            {active.length === 0 ? (
              <div className="empty-inline">✅ No active blocks — all caught up!</div>
            ) : (
              <div className="entry-list">
                {active.map((e,i) => (
                  <div key={i} className="entry-row">
                    <div className="entry-meta">
                      <span className="entry-liner">{e.liner}</span>
                      <span className="entry-size">{e.size.includes('RF')?'❄️':'📦'} {SIZES.find(s=>s.id===e.size)?.label||e.size}</span>
                    </div>
                    <BlockPill block={e.block} full={false}/>
                    <button disabled={loading}
                      onClick={() => handleMarkFull(e.liner,e.size,e.block)}
                      className="btn btn--danger-sm">
                      Mark Full
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ANNOUNCE ── */}
        {activeTab==='announce' && (
          <div className="glass-card">
            <h2 className="section-title">📣 Broadcast Announcement</h2>
            <p className="section-sub">Message will be pinned in the staff Telegram group.</p>
            <form onSubmit={handleAnnounce} className="form-stack">
              <textarea value={announceText}
                onChange={e => setAnnounceText(e.target.value)}
                placeholder="Type your announcement…"
                rows={5} className="field-inp field-ta"/>
              <button type="submit" disabled={loading || !announceText.trim()}
                className="btn btn--violet w-full">
                {loading ? <span className="spinner"/> : '📣 Pin in Staff Group'}
              </button>
            </form>
          </div>
        )}

        {/* ── VIEW ALL ── */}
        {activeTab==='view' && (
          <div className="glass-card">
            <div className="card-header-row">
              <h2 className="section-title mb0">🗂️ All Allocations</h2>
              <span className="chip-count">{allEntries.length} blocks</span>
            </div>
            {allEntries.length === 0 ? (
              <div className="empty-inline">No blocks configured yet.</div>
            ) : (
              <div className="entry-list">
                {allEntries.map((e,i) => (
                  <div key={i} className={`entry-row ${isFull(e)?'entry-row--full':''}`}>
                    <div className="entry-meta">
                      <span className="entry-liner">{e.liner}</span>
                      <span className="entry-size">{e.size.includes('RF')?'❄️':'📦'} {SIZES.find(s=>s.id===e.size)?.label||e.size}</span>
                    </div>
                    <BlockPill block={e.block} full={isFull(e)}/>
                    <button onClick={() => handleDelete(e.liner,e.size,e.block)}
                      className="del-x" title="Remove">✕</button>
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

  const fetchDB = useCallback(async () => {
    try { setDb(await apiFetch('/api/layout')) } catch {}
  }, [])

  useEffect(() => {
    fetchDB()
    const id = setInterval(fetchDB, 30_000)
    return () => clearInterval(id)
  }, [fetchDB])

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
      {showModal && <PasswordModal onSuccess={handleSuccess} onClose={() => setShowModal(false)}/>}
      {view==='staff' ? (
        <StaffView db={db} onAdminClick={() => password ? setView('admin') : setShowModal(true)}/>
      ) : (
        <AdminPanel password={password} db={db} onRefresh={fetchDB} onLogout={handleLogout}/>
      )}
    </>
  )
}
