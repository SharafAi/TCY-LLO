import { useState, useEffect, useCallback } from 'react'

// ─── Block data ───────────────────────────────────────────────
const TB_SIZES = { TB1: 10, TB2: 16, TB3: 16, TB4: 10, TB5: 30, TB6: 40, TB7: 40 }

const TB_COLORS = {
  TB1: { badge: 'bg-blue-100 border-blue-300 text-blue-900',   dot: 'bg-blue-500' },
  TB2: { badge: 'bg-emerald-100 border-emerald-300 text-emerald-900', dot: 'bg-emerald-500' },
  TB3: { badge: 'bg-violet-100 border-violet-300 text-violet-900',   dot: 'bg-violet-500' },
  TB4: { badge: 'bg-orange-100 border-orange-300 text-orange-900',   dot: 'bg-orange-500' },
  TB5: { badge: 'bg-cyan-100 border-cyan-300 text-cyan-900',         dot: 'bg-cyan-500' },
  TB6: { badge: 'bg-rose-100 border-rose-300 text-rose-900',         dot: 'bg-rose-500' },
  TB7: { badge: 'bg-amber-100 border-amber-300 text-amber-900',      dot: 'bg-amber-500' },
}

function getColor(block = '') {
  const tb = Object.keys(TB_COLORS).find(k => block.startsWith(k))
  return TB_COLORS[tb] || { badge: 'bg-gray-100 border-gray-300 text-gray-900', dot: 'bg-gray-400' }
}

// ─── API helpers ─────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  const res = await fetch(path, opts)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

// ─── Password modal ───────────────────────────────────────────
function PasswordModal({ onSuccess, onClose }) {
  const [val, setVal] = useState('')
  const [err, setErr] = useState(false)

  async function submit() {
    try {
      await apiFetch(`/api/layout`, { headers: { 'x-dashboard-pass': val } })
      onSuccess(val)
    } catch {
      setErr(true)
      setVal('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6">
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">🔐</div>
          <h2 className="text-xl font-bold text-slate-900">Supervisor Access</h2>
          <p className="text-sm text-slate-500 mt-1">Enter your admin password</p>
        </div>
        <input
          type="password"
          value={val}
          autoFocus
          onChange={e => { setVal(e.target.value); setErr(false) }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Password"
          className={`w-full border-2 rounded-xl px-4 py-3 text-center text-lg tracking-widest outline-none mb-3 ${err ? 'border-red-400 bg-red-50' : 'border-slate-200 focus:border-blue-500'}`}
        />
        {err && <p className="text-red-500 text-sm text-center mb-3">Incorrect password</p>}
        <button onClick={submit} className="w-full bg-slate-900 text-white font-semibold py-3 rounded-xl hover:bg-slate-700 transition mb-2">
          Enter
        </button>
        <button onClick={onClose} className="w-full text-slate-400 text-sm py-2 hover:text-slate-600 transition">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Staff view ────────────────────────────────────────────────
function StaffView({ liners, onAdminClick }) {
  const [q, setQ] = useState('')
  const entries = Object.entries(liners)
  const filtered = q.trim()
    ? entries.filter(([liner]) => liner.includes(q.trim().toUpperCase()))
    : entries

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white px-4 py-4 flex items-center justify-between sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚓</span>
          <div>
            <h1 className="font-black text-base leading-tight">TCY YARD LOCATOR</h1>
            <p className="text-slate-400 text-xs">Container Block Finder</p>
          </div>
        </div>
        <button
          onClick={onAdminClick}
          className="text-slate-400 hover:text-white transition p-2 rounded-lg hover:bg-slate-700"
          title="Supervisor login"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </button>
      </header>

      {/* Search */}
      <div className="px-4 pt-5 pb-3 bg-slate-900">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search liner… e.g. CMA, MSC"
            className="w-full pl-12 pr-4 py-4 rounded-xl text-lg font-semibold bg-white border-2 border-slate-200 outline-none focus:border-blue-500 uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">✕</button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 px-4 py-4 space-y-3">
        {entries.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">🚢</div>
            <p className="font-semibold text-slate-600">No active liners configured.</p>
            <p className="text-sm mt-1">Please contact the supervisor.</p>
          </div>
        )}

        {entries.length > 0 && filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <div className="text-4xl mb-3">🔍</div>
            <p className="font-semibold">No match for "<span className="text-slate-700">{q.toUpperCase()}</span>"</p>
            <p className="text-sm mt-1">This liner is not currently assigned.</p>
          </div>
        )}

        {filtered.map(([liner, { block, updatedAt }]) => {
          const color = getColor(block)
          return (
            <div key={liner} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${color.dot}`} />
                <span className="font-black text-2xl text-slate-900 tracking-wide">{liner}</span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`font-black text-xl px-4 py-1.5 rounded-lg border-2 ${color.badge}`}>
                  {block}
                </span>
                <span className="text-xs text-slate-400">{updatedAt}</span>
              </div>
            </div>
          )
        })}

        {filtered.length > 0 && (
          <p className="text-center text-xs text-slate-400 pt-2">
            {filtered.length} liner{filtered.length !== 1 ? 's' : ''} shown
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Admin panel ───────────────────────────────────────────────
function AdminPanel({ password, liners, onRefresh, onLogout }) {
  const [liner, setLiner] = useState('')
  const [tb, setTb] = useState('TB1')
  const [bay, setBay] = useState('1')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [editLiner, setEditLiner] = useState(null) // liner being edited
  const [announceText, setAnnounceText] = useState('')

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const authHeaders = { 'Content-Type': 'application/json', 'x-dashboard-pass': password }

  async function handleSet(e) {
    e.preventDefault()
    const name = (editLiner || liner).trim().toUpperCase()
    if (!name) return
    const block = `${tb}-${bay}`
    setLoading(true)
    try {
      await apiFetch('/api/set', { method: 'POST', headers: authHeaders, body: JSON.stringify({ liner: name, block }) })
      showToast(`✅ ${name} → ${block} set & pinned in group!`)
      setLiner(''); setTb('TB1'); setBay('1'); setEditLiner(null)
      onRefresh()
    } catch (err) { showToast(err.message, 'error') }
    finally { setLoading(false) }
  }

  async function handleDelete(name) {
    if (!confirm(`Remove ${name}?`)) return
    try {
      await apiFetch(`/api/liner/${name}`, { method: 'DELETE', headers: authHeaders })
      showToast(`🗑️ ${name} removed.`)
      onRefresh()
    } catch (err) { showToast(err.message, 'error') }
  }

  async function handleAnnounce(e) {
    e.preventDefault()
    if (!announceText.trim()) return
    setLoading(true)
    try {
      await apiFetch('/api/announce', { method: 'POST', headers: authHeaders, body: JSON.stringify({ message: announceText }) })
      showToast('📣 Announcement pinned!')
      setAnnounceText('')
    } catch (err) { showToast(err.message, 'error') }
    finally { setLoading(false) }
  }

  function startEdit(name, block) {
    setEditLiner(name)
    const [tbPart, bayPart] = block.split('-')
    setTb(tbPart)
    setBay(bayPart)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const bayCount = TB_SIZES[tb]
  const entries = Object.entries(liners)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-4 right-4 z-50 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg text-center ${toast.type === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="bg-slate-900 text-white px-4 py-4 flex items-center justify-between sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <div>
            <h1 className="font-black text-base leading-tight">ADMIN PANEL</h1>
            <p className="text-slate-400 text-xs">Supervisor Control</p>
          </div>
        </div>
        <button onClick={onLogout} className="text-slate-400 hover:text-white text-sm border border-slate-600 rounded-lg px-3 py-1.5 transition hover:border-slate-400">
          Log Out
        </button>
      </header>

      <div className="px-4 py-5 space-y-5 max-w-lg mx-auto">

        {/* Set Liner Form */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            {editLiner ? (
              <>✏️ Editing: <span className="text-blue-600">{editLiner}</span>
                <button onClick={() => { setEditLiner(null); setLiner(''); }} className="ml-auto text-xs text-slate-400 hover:text-slate-600">Cancel</button>
              </>
            ) : '📍 Add / Update Location'}
          </h2>
          <form onSubmit={handleSet} className="space-y-3">
            {!editLiner && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Liner Name</label>
                <input
                  value={liner}
                  onChange={e => setLiner(e.target.value.toUpperCase())}
                  placeholder="e.g. CMA, MSC, LILY"
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 font-bold text-lg uppercase outline-none focus:border-blue-500"
                  required
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Terminal Block</label>
                <select value={tb} onChange={e => { setTb(e.target.value); setBay('1') }}
                  className="w-full border-2 border-slate-200 rounded-xl px-3 py-3 font-bold text-base outline-none focus:border-blue-500 bg-white">
                  {Object.keys(TB_SIZES).map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Bay Number</label>
                <select value={bay} onChange={e => setBay(e.target.value)}
                  className="w-full border-2 border-slate-200 rounded-xl px-3 py-3 font-bold text-base outline-none focus:border-blue-500 bg-white">
                  {Array.from({ length: bayCount }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <span className="text-xs text-slate-500">Selected block: </span>
              <span className={`font-black text-lg px-3 py-0.5 rounded-lg border ${getColor(`${tb}-${bay}`).badge}`}>{tb}-{bay}</span>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-700 transition disabled:opacity-50 text-base">
              {loading ? 'Saving…' : `📢 Set & Broadcast to Group`}
            </button>
          </form>
        </div>

        {/* Announce */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="font-bold text-slate-900 mb-4">📣 Send Announcement</h2>
          <form onSubmit={handleAnnounce} className="space-y-3">
            <textarea
              value={announceText}
              onChange={e => setAnnounceText(e.target.value)}
              placeholder="Type your announcement…"
              rows={3}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 resize-none"
            />
            <button type="submit" disabled={loading || !announceText.trim()}
              className="w-full bg-violet-600 text-white font-bold py-3 rounded-xl hover:bg-violet-700 transition disabled:opacity-50">
              📣 Pin in Staff Group
            </button>
          </form>
        </div>

        {/* Current Allocations */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900">🗂️ Current Allocations</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-semibold">{entries.length} liners</span>
          </div>
          {entries.length === 0 ? (
            <p className="text-center text-slate-400 py-8 text-sm">No liners added yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map(([name, { block, updatedAt }]) => {
                const color = getColor(block)
                return (
                  <div key={name} className="flex items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color.dot}`} />
                      <span className="font-black text-slate-900 text-lg">{name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`font-bold text-sm px-2.5 py-1 rounded-lg border ${color.badge}`}>{block}</span>
                      <button onClick={() => startEdit(name, block)}
                        className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50 transition">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(name)}
                        className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50 transition">
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Root App ─────────────────────────────────────────────────

export default function App() {
  const [liners, setLiners] = useState({})
  const [view, setView] = useState('staff') // 'staff' | 'admin'
  const [showPassModal, setShowPassModal] = useState(false)
  const [password, setPassword] = useState(sessionStorage.getItem('tcy-admin-pass') || '')

  const fetchLiners = useCallback(async () => {
    try {
      const data = await apiFetch('/api/layout')
      setLiners(data)
    } catch { /* silent fail */ }
  }, [])

  useEffect(() => {
    fetchLiners()
    const id = setInterval(fetchLiners, 30_000)
    return () => clearInterval(id)
  }, [fetchLiners])

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
          liners={liners}
          onAdminClick={() => password ? setView('admin') : setShowPassModal(true)}
        />
      ) : (
        <AdminPanel
          password={password}
          liners={liners}
          onRefresh={fetchLiners}
          onLogout={handleLogout}
        />
      )}
    </>
  )
}
