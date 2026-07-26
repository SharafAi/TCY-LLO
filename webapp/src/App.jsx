import { useState, useEffect, useCallback } from 'react'
import './App.css'

// ─── Constants ────────────────────────────────────────────────
const TB_SIZES = { TB1:10, TB2:16, TB3:16, TB4:10, TB5:30, TB6:40, TB7:40 }
const SIZES = [
  { id:'20FT', label:'20 FT',   emoji:'📦' },
  { id:'40FT', label:'40 FT',   emoji:'📦' },
  { id:'20RF', label:'20 RF ❄️', emoji:'❄️' },
  { id:'40RF', label:'40 RF ❄️', emoji:'❄️' },
]
const NEW_HOURS = 24

const TB_COLORS = {
  TB1:'#3b82f6', TB2:'#10b981', TB3:'#8b5cf6',
  TB4:'#f97316', TB5:'#06b6d4', TB6:'#ef4444', TB7:'#f59e0b',
}

function getTBColor(block='') {
  const tb = Object.keys(TB_COLORS).find(k => block.startsWith(k))
  return TB_COLORS[tb] || '#64748b'
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

// ─── Toast ────────────────────────────────────────────────────
function Toast({ msg, type }) {
  return (
    <div className={`toast toast--${type}`}>
      {msg}
    </div>
  )
}

// ─── Password Modal ───────────────────────────────────────────
function PasswordModal({ onSuccess, onClose }) {
  const [val, setVal] = useState('')
  const [err, setErr] = useState(false)

  async function submit() {
    try {
      await apiFetch('/api/layout', { headers: { 'x-dashboard-pass': val } })
      onSuccess(val)
    } catch {
      setErr(true); setVal('')
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-icon">🔐</div>
        <h2 className="modal-title">Supervisor Access</h2>
        <p className="modal-sub">Enter your admin password</p>
        <input
          type="password" value={val} autoFocus
          onChange={e => { setVal(e.target.value); setErr(false) }}
          onKeyDown={e => e.key==='Enter' && submit()}
          placeholder="Password"
          className={`modal-input ${err ? 'modal-input--err' : ''}`}
        />
        {err && <p className="modal-err">Incorrect password</p>}
        <button className="btn btn--dark w-full" onClick={submit}>Enter</button>
        <button className="btn btn--ghost w-full mt-2" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

// ─── Block Badge ──────────────────────────────────────────────
function BlockBadge({ block, full }) {
  const color = getTBColor(block)
  return (
    <span className={`block-badge ${full ? 'block-badge--full' : ''}`}
      style={full ? {} : { background: color+'18', borderColor: color+'55', color }}>
      {full && <span className="block-badge-dot full-dot"/>}
      {block}
      {full && <span className="full-label">FULL</span>}
    </span>
  )
}

// ─── Staff View ───────────────────────────────────────────────
function StaffView({ db, onAdminClick }) {
  const [q, setQ] = useState('')

  // Group by liner
  const grouped = {}
  for (const [k, arr] of Object.entries(db)) {
    const { liner, size } = parseKey(k)
    if (!grouped[liner]) grouped[liner] = {}
    grouped[liner][size] = arr
  }

  const allLiners = Object.keys(grouped).sort()
  const filtered = q.trim()
    ? allLiners.filter(l => l.includes(q.trim().toUpperCase()))
    : allLiners

  return (
    <div className="screen">
      <header className="header">
        <div className="header-brand">
          <span className="header-icon">⚓</span>
          <div>
            <h1 className="header-title">TCY YARD LOCATOR</h1>
            <p className="header-sub">Container Block Finder</p>
          </div>
        </div>
        <button className="icon-btn" onClick={onAdminClick} title="Supervisor">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </button>
      </header>

      <div className="search-bar">
        <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input type="text" value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search liner… e.g. CMA, MSC"
          className="search-input"
        />
        {q && <button className="search-clear" onClick={() => setQ('')}>✕</button>}
      </div>

      <div className="content">
        {allLiners.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🚢</div>
            <p className="empty-title">No active liners configured</p>
            <p className="empty-sub">Please contact the supervisor</p>
          </div>
        )}
        {allLiners.length > 0 && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <p className="empty-title">No match for "{q.toUpperCase()}"</p>
            <p className="empty-sub">This liner is not currently assigned</p>
          </div>
        )}

        {filtered.map(liner => {
          const sizes = grouped[liner]
          const allBlocks = Object.values(sizes).flat()
          const hasActive = allBlocks.some(e => !isFull(e))
          return (
            <div key={liner} className={`liner-card ${!hasActive ? 'liner-card--allfull' : ''}`}>
              <div className="liner-card-header">
                <span className="liner-name">{liner}</span>
                {!hasActive && <span className="full-chip">ALL FULL</span>}
              </div>
              {Object.entries(sizes).map(([size, arr]) => (
                <div key={size} className="size-row">
                  <span className="size-label">
                    {size.includes('RF') ? '❄️' : '📦'} {SIZES.find(s=>s.id===size)?.label || size}
                  </span>
                  <div className="block-list">
                    {arr.map((e, i) => (
                      <div key={i} className="block-item">
                        <BlockBadge block={e.block} full={isFull(e)} />
                        {isNew(e) && !isFull(e) && <span className="new-chip">NEW</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        })}

        {filtered.length > 0 && (
          <p className="result-count">{filtered.length} liner{filtered.length !== 1 ? 's' : ''} shown</p>
        )}
      </div>
    </div>
  )
}

// ─── Admin Panel ──────────────────────────────────────────────
function AdminPanel({ password, db, onRefresh, onLogout }) {
  const [liner,       setLiner]       = useState('')
  const [size,        setSize]        = useState('20FT')
  const [tb,          setTb]          = useState('TB1')
  const [bay,         setBay]         = useState('1')
  const [loading,     setLoading]     = useState(false)
  const [toast,       setToast]       = useState(null)
  const [announceText,setAnnounceText]= useState('')
  const [activeTab,   setActiveTab]   = useState('set') // 'set' | 'full' | 'announce'

  function showToast(msg, type='success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const authHeaders = { 'Content-Type':'application/json', 'x-dashboard-pass': password }

  async function handleSet(e) {
    e.preventDefault()
    const name = liner.trim().toUpperCase()
    if (!name) return
    const block = `${tb}-${bay}`
    setLoading(true)
    try {
      await apiFetch('/api/set', { method:'POST', headers: authHeaders,
        body: JSON.stringify({ liner: name, size, block }) })
      showToast(`✅ ${name} · ${size} → ${block} set & pinned!`)
      setLiner(''); setTb('TB1'); setBay('1')
      onRefresh()
    } catch (err) { showToast(err.message, 'error') }
    finally { setLoading(false) }
  }

  async function handleMarkFull(liner, size, block) {
    setLoading(true)
    try {
      await apiFetch('/api/markfull', { method:'POST', headers: authHeaders,
        body: JSON.stringify({ liner, size, block }) })
      showToast(`🔴 ${liner} · ${block} marked as FULL`)
      onRefresh()
    } catch (err) { showToast(err.message, 'error') }
    finally { setLoading(false) }
  }

  async function handleDelete(liner, size, block) {
    if (!confirm(`Remove block ${block} for ${liner}?`)) return
    try {
      await apiFetch(`/api/block?liner=${liner}&size=${size}&block=${block}`,
        { method:'DELETE', headers: authHeaders })
      showToast(`🗑️ ${block} removed`)
      onRefresh()
    } catch (err) { showToast(err.message, 'error') }
  }

  async function handleAnnounce(e) {
    e.preventDefault()
    if (!announceText.trim()) return
    setLoading(true)
    try {
      await apiFetch('/api/announce', { method:'POST', headers: authHeaders,
        body: JSON.stringify({ message: announceText }) })
      showToast('📣 Announcement pinned!')
      setAnnounceText('')
    } catch (err) { showToast(err.message, 'error') }
    finally { setLoading(false) }
  }

  const bayCount = TB_SIZES[tb]

  // Flatten db for display
  const allEntries = []
  for (const [k, arr] of Object.entries(db)) {
    const { liner: l, size: s } = parseKey(k)
    for (const e of arr) allEntries.push({ liner: l, size: s, ...e })
  }
  const activeEntries = allEntries.filter(e => !isFull(e))
  const fullEntries   = allEntries.filter(e =>  isFull(e))

  const stats = {
    total:  allEntries.length,
    active: activeEntries.length,
    full:   fullEntries.length,
  }

  return (
    <div className="screen">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      <header className="header">
        <div className="header-brand">
          <span className="header-icon">⚙️</span>
          <div>
            <h1 className="header-title">ADMIN PANEL</h1>
            <p className="header-sub">Supervisor Control</p>
          </div>
        </div>
        <button className="btn btn--outline-sm" onClick={onLogout}>Log Out</button>
      </header>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-num">{stats.total}</span>
          <span className="stat-lbl">Total Blocks</span>
        </div>
        <div className="stat-card stat-card--green">
          <span className="stat-num">{stats.active}</span>
          <span className="stat-lbl">Active</span>
        </div>
        <div className="stat-card stat-card--red">
          <span className="stat-num">{stats.full}</span>
          <span className="stat-lbl">Full</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {[['set','➕ Add Block'],['full','🔴 Mark Full'],['announce','📣 Announce']].map(([id,label])=>(
          <button key={id} className={`tab-btn ${activeTab===id?'tab-btn--active':''}`}
            onClick={()=>setActiveTab(id)}>{label}</button>
        ))}
      </div>

      <div className="content">

        {/* ── ADD BLOCK TAB ── */}
        {activeTab==='set' && (
          <div className="card">
            <h2 className="card-title">➕ Add / Update Block</h2>
            <form onSubmit={handleSet} className="form">
              <div className="field">
                <label className="field-label">Liner Name</label>
                <input value={liner}
                  onChange={e => setLiner(e.target.value.toUpperCase())}
                  placeholder="e.g. CMA, MSC, LILY"
                  className="field-input" required />
              </div>
              <div className="field">
                <label className="field-label">Container Size</label>
                <div className="size-grid">
                  {SIZES.map(s => (
                    <button type="button" key={s.id}
                      className={`size-opt ${size===s.id ? 'size-opt--active' : ''}`}
                      onClick={() => setSize(s.id)}>
                      {s.emoji} {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid-2">
                <div className="field">
                  <label className="field-label">Terminal Block</label>
                  <select value={tb} onChange={e => { setTb(e.target.value); setBay('1') }}
                    className="field-input">
                    {Object.keys(TB_SIZES).map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Bay Number</label>
                  <select value={bay} onChange={e => setBay(e.target.value)}
                    className="field-input">
                    {Array.from({ length: bayCount }, (_, i) => (
                      <option key={i+1} value={i+1}>{i+1}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="preview-row">
                <span className="preview-label">Selected block:</span>
                <BlockBadge block={`${tb}-${bay}`} full={false} />
              </div>
              <button type="submit" disabled={loading} className="btn btn--dark w-full">
                {loading ? 'Saving…' : '📢 Set & Broadcast to Group'}
              </button>
            </form>
          </div>
        )}

        {/* ── MARK FULL TAB ── */}
        {activeTab==='full' && (
          <div className="card">
            <h2 className="card-title">🔴 Mark Block as Full</h2>
            {activeEntries.length === 0 ? (
              <p className="empty-sub" style={{textAlign:'center',padding:'2rem 0'}}>
                No active blocks to mark as full.
              </p>
            ) : (
              <div className="block-table">
                {activeEntries.map((e, i) => (
                  <div key={i} className="block-row">
                    <div className="block-row-info">
                      <span className="block-row-liner">{e.liner}</span>
                      <span className="block-row-size">
                        {e.size.includes('RF')?'❄️':'📦'} {SIZES.find(s=>s.id===e.size)?.label||e.size}
                      </span>
                    </div>
                    <BlockBadge block={e.block} full={false} />
                    <button
                      onClick={() => handleMarkFull(e.liner, e.size, e.block)}
                      disabled={loading}
                      className="btn btn--red-sm">
                      Mark Full
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ANNOUNCE TAB ── */}
        {activeTab==='announce' && (
          <div className="card">
            <h2 className="card-title">📣 Send Announcement</h2>
            <form onSubmit={handleAnnounce} className="form">
              <textarea value={announceText}
                onChange={e => setAnnounceText(e.target.value)}
                placeholder="Type your announcement…"
                rows={4} className="field-input field-textarea" />
              <button type="submit" disabled={loading || !announceText.trim()}
                className="btn btn--violet w-full">
                📣 Pin in Staff Group
              </button>
            </form>
          </div>
        )}

        {/* ── CURRENT ALLOCATIONS ── */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title mb-0">🗂️ Current Allocations</h2>
            <span className="chip">{allEntries.length} blocks</span>
          </div>
          {allEntries.length === 0 ? (
            <p className="empty-sub" style={{textAlign:'center',padding:'2rem 0'}}>No blocks added yet.</p>
          ) : (
            <div className="alloc-list">
              {allEntries.map((e, i) => (
                <div key={i} className={`alloc-row ${isFull(e)?'alloc-row--full':''}`}>
                  <div className="alloc-info">
                    <span className="alloc-liner">{e.liner}</span>
                    <span className="alloc-size">{e.size.includes('RF')?'❄️':'📦'} {SIZES.find(s=>s.id===e.size)?.label||e.size}</span>
                  </div>
                  <BlockBadge block={e.block} full={isFull(e)} />
                  <button onClick={() => handleDelete(e.liner, e.size, e.block)}
                    className="del-btn" title="Remove">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Root App ─────────────────────────────────────────────────
export default function App() {
  const [db,           setDb]           = useState({})
  const [view,         setView]         = useState('staff')
  const [showPassModal,setShowPassModal] = useState(false)
  const [password,     setPassword]     = useState(sessionStorage.getItem('tcy-admin-pass') || '')

  const fetchDB = useCallback(async () => {
    try { setDb(await apiFetch('/api/layout')) } catch {}
  }, [])

  useEffect(() => {
    fetchDB()
    const id = setInterval(fetchDB, 30_000)
    return () => clearInterval(id)
  }, [fetchDB])

  function handleAdminSuccess(pass) {
    setPassword(pass)
    sessionStorage.setItem('tcy-admin-pass', pass)
    setShowPassModal(false)
    setView('admin')
  }

  function handleLogout() {
    setPassword('')
    sessionStorage.removeItem('tcy-admin-pass')
    setView('staff')
  }

  return (
    <>
      {showPassModal && (
        <PasswordModal
          onSuccess={handleAdminSuccess}
          onClose={() => setShowPassModal(false)}
        />
      )}
      {view === 'staff' ? (
        <StaffView
          db={db}
          onAdminClick={() => password ? setView('admin') : setShowPassModal(true)}
        />
      ) : (
        <AdminPanel
          password={password}
          db={db}
          onRefresh={fetchDB}
          onLogout={handleLogout}
        />
      )}
    </>
  )
}
