import { useState, useMemo } from 'react'
import type { Repository, ApiEndpoint } from '../../types'
import { EmptyState, RANK_STYLE, methodStyle, METHOD_STYLE } from './shared'
import DependencyGraph from './DependencyGraph'

// ─── API Surface ──────────────────────────────────────────────────────────────

const METHOD_TABS = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const
type MethodFilter = typeof METHOD_TABS[number]

function ApiSurface({ repo }: { repo: Repository }) {
  const [filter, setFilter] = useState<MethodFilter>('ALL')
  const [search, setSearch] = useState('')
  const endpoints = repo.api_endpoints ?? []

  const methodCounts = useMemo(() =>
    endpoints.reduce((acc, ep) => {
      const m = (ep.method ?? 'UNKNOWN').toUpperCase()
      acc[m] = (acc[m] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
  , [endpoints])

  const visible = useMemo(() => endpoints.filter(ep => {
    const matchM = filter === 'ALL' || (ep.method ?? '').toUpperCase() === filter
    const matchS = !search ||
      (ep.path ?? '').toLowerCase().includes(search.toLowerCase()) ||
      ep.file_path.toLowerCase().includes(search.toLowerCase())
    return matchM && matchS
  }), [endpoints, filter, search])

  const grouped = useMemo(() => {
    const map = new Map<string, ApiEndpoint[]>()
    visible.forEach(ep => {
      if (!map.has(ep.file_path)) map.set(ep.file_path, [])
      map.get(ep.file_path)!.push(ep)
    })
    return map
  }, [visible])

  if (endpoints.length === 0) return (
    <EmptyState
      icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>}
      title="No API endpoints detected"
      body="Endpoint detection works for Python (FastAPI/Flask), Node (Express), Java (Spring), and Go. Frontend-only repos and libraries will show nothing here."
    />
  )

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilter('ALL')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            filter === 'ALL'
              ? 'bg-surface-card border-surface-border text-ink shadow-sm'
              : 'border-transparent text-ink-subtle hover:text-ink hover:border-surface-border/60'
          }`}
        >
          All
          <span className="text-[10px] bg-surface-raised border border-surface-border/50 px-1.5 py-0.5 rounded-full font-mono">{endpoints.length}</span>
        </button>
        {Object.entries(methodCounts).map(([method, count]) => {
          const active = filter === method
          const style = METHOD_STYLE[method] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/25'
          return (
            <button
              key={method}
              onClick={() => setFilter(method as MethodFilter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                active ? `${style} shadow-sm` : 'border-transparent text-ink-subtle hover:text-ink hover:border-surface-border/60'
              }`}
            >
              {method}
              <span className="text-[10px] opacity-70 font-mono">{count}</span>
            </button>
          )
        })}
        <div className="sm:ml-auto relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-subtle pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search path or file…"
            className="bg-surface-raised border border-surface-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-subtle focus:outline-none focus:border-accent/60 transition-colors w-52"
          />
        </div>
      </div>

      {/* Results */}
      {grouped.size === 0 ? (
        <p className="text-sm text-ink-muted text-center py-10">No endpoints match.</p>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([filePath, eps]) => (
            <div key={filePath} className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 bg-surface-raised/50 border-b border-surface-border/60">
                <svg className="w-3.5 h-3.5 text-ink-subtle shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <code className="text-xs font-mono font-semibold text-ink flex-1 truncate">{filePath}</code>
                <span className="text-[10px] text-ink-subtle font-medium shrink-0">{eps.length} route{eps.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-surface-border/30">
                {eps.map((ep, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 group hover:bg-surface-raised/20 transition-colors">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 ${methodStyle(ep.method)}`}>
                      {ep.method ?? '?'}
                    </span>
                    <code className="text-xs font-mono text-ink flex-1 min-w-0 truncate">
                      {ep.path ?? ep.file_path}
                    </code>
                    {ep.function_name && (
                      <span className="text-[10px] font-mono text-ink-subtle shrink-0 hidden sm:block">
                        {ep.function_name}
                      </span>
                    )}
                    {ep.language && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-surface-raised border-surface-border text-ink-subtle shrink-0 hidden sm:block">
                        {ep.language}
                      </span>
                    )}
                    {ep.line && (
                      <span className="text-[10px] text-ink-subtle shrink-0 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                        L{ep.line}
                      </span>
                    )}
                    <button
                      onClick={() => navigator.clipboard.writeText(`${ep.method ?? ''} ${ep.path ?? ep.file_path}`)}
                      className="text-ink-subtle hover:text-ink transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      title="Copy"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-ink-subtle text-right">
        {visible.length} endpoint{visible.length !== 1 ? 's' : ''}
        {grouped.size > 0 && <> across {grouped.size} file{grouped.size !== 1 ? 's' : ''}</>}
      </p>
    </div>
  )
}

// ─── Dependency Row ────────────────────────────────────────────────────────────

function DepRow({ filePath, uses, usedBy }: { filePath: string; uses: string[]; usedBy: string[] }) {
  const [open, setOpen] = useState(false)
  const total  = uses.length + usedBy.length
  const isHub  = total >= 5
  const canOpen = total > 0

  // Left-border colour by role
  const borderColor =
    isHub              ? '#f97316' :
    usedBy.length > uses.length * 1.5 ? '#34d399' :
    uses.length > usedBy.length * 1.5 ? '#60a5fa' :
    '#334155'

  return (
    <div className="border-b border-surface-border/30 last:border-0">
      <button
        disabled={!canOpen}
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors
          ${canOpen ? 'hover:bg-surface-raised/30 cursor-pointer' : 'cursor-default'}`}
      >
        {/* Role accent bar */}
        <div className="w-0.5 self-stretch rounded-full shrink-0 mt-0.5"
          style={{ background: borderColor }} />

        {/* File info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono font-semibold text-ink truncate">
            {filePath.split('/').pop()}
          </p>
          <p className="text-[10px] text-ink-subtle font-mono truncate mt-0.5">{filePath}</p>

          {/* Tags row */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {isHub && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full
                bg-orange-500/15 text-orange-300 border border-orange-500/25"
                title="Many files depend on this — risky to change">
                Risky to change
              </span>
            )}
            {usedBy.length > 0 && (
              <span className="text-[9px] font-medium px-2 py-0.5 rounded-full
                bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                {usedBy.length} {usedBy.length === 1 ? 'file relies' : 'files rely'} on this
              </span>
            )}
            {uses.length > 0 && (
              <span className="text-[9px] font-medium px-2 py-0.5 rounded-full
                bg-blue-500/10 text-blue-300 border border-blue-500/20">
                relies on {uses.length} {uses.length === 1 ? 'file' : 'files'}
              </span>
            )}
            {total === 0 && (
              <span className="text-[9px] text-ink-subtle/50">No connections tracked</span>
            )}
          </div>
        </div>

        {/* Chevron */}
        {canOpen && (
          <svg className={`w-3.5 h-3.5 text-ink-subtle shrink-0 mt-0.5 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
      </button>

      {/* Expanded detail */}
      {open && canOpen && (
        <div className="mx-4 mb-3 rounded-xl border border-surface-border/50 bg-surface-raised/20 overflow-hidden">
          {usedBy.length > 0 && (
            <div className={`px-4 py-3 ${uses.length > 0 ? 'border-b border-surface-border/40' : ''}`}>
              <p className="text-[10px] font-semibold text-emerald-400 mb-2">
                These files will break if you change this one:
              </p>
              <div className="flex flex-col gap-1">
                {usedBy.map(f => (
                  <div key={f} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-surface-raised/40 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 shrink-0" />
                    <code className="text-[10px] font-mono text-slate-300 truncate">{f}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
          {uses.length > 0 && (
            <div className="px-4 py-3">
              <p className="text-[10px] font-semibold text-blue-400 mb-2">
                This file depends on these — changing them could affect it:
              </p>
              <div className="flex flex-col gap-1">
                {uses.map(f => (
                  <div key={f} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-surface-raised/40 transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500/60 shrink-0" />
                    <code className="text-[10px] font-mono text-slate-300 truncate">{f}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── System Map ───────────────────────────────────────────────────────────────

function SystemMap({ repo, view, onCheckImpact }: { repo: Repository; view: 'graph' | 'list'; onCheckImpact?: (path: string) => void }) {
  const deps = repo.dependencies
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [allCardsExpanded, setAllCardsExpanded] = useState(false)
  const PAGE = 30

  const allEntries = useMemo(() => {
    if (!deps) return []
    return Object.entries(deps)
      .sort((a, b) => (b[1].uses.length + b[1].used_by.length) - (a[1].uses.length + a[1].used_by.length))
  }, [deps])

  const entries = useMemo(() =>
    allEntries.filter(([p]) => !search || p.toLowerCase().includes(search.toLowerCase()))
  , [allEntries, search])

  const topFiles = useMemo(() => allEntries.slice(0, 3), [allEntries])
  const visible = showAll ? entries : entries.slice(0, PAGE)

  if (!deps || Object.keys(deps).length === 0) return (
    <EmptyState
      icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>}
      title="No dependency data for this repo"
      body="Dependency tracking requires Python · JavaScript · TypeScript · Java · Go."
    />
  )

  return (
    <div className="space-y-6">
      {/* Most connected files */}
      {topFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Most connected files</p>
              <p className="text-xs text-ink-muted mt-0.5">
                These files are used by the most other files in this repo.
                Changing them is risky — a bug here can break many things at once.
              </p>
            </div>
            <button
              onClick={() => setAllCardsExpanded(v => !v)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-surface-raised hover:border-surface-border/80 text-[11px] font-medium text-ink-muted hover:text-ink transition-all"
            >
              <svg className={`w-3 h-3 transition-transform duration-200 ${allCardsExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              {allCardsExpanded ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
          <div className="grid sm:grid-cols-3 gap-2.5">
            {topFiles.map(([fp, dep], i) => {
              const rank        = RANK_STYLE[i]
              const dependents  = dep.used_by.length
              const dependsOn   = dep.uses.length
              const total       = dependents + dependsOn
              const dependentPct = total > 0 ? Math.round((dependents / total) * 100) : 50
              const isHighRisk  = dependents >= 4

              return (
                <div key={fp} className="relative rounded-xl border border-surface-border bg-surface-card overflow-hidden">
                  {/* Top accent */}
                  <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${rank.accent}`} />

                  {/* Header */}
                  <div className="w-full flex items-center gap-2.5 px-3.5 pt-4 pb-3">
                    <span className={`w-6 h-6 rounded-md border text-[11px] font-black flex items-center justify-center shrink-0 ${rank.badge}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <code className="text-xs font-mono font-semibold text-ink block truncate" title={fp}>
                        {fp.split('/').pop()}
                      </code>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-emerald-400 font-medium">↑ {dependents} rely on this</span>
                        <span className="text-[10px] text-blue-400 font-medium">↓ uses {dependsOn}</span>
                        {isHighRisk && (
                          <span className="text-[9px] font-bold px-1.5 py-px rounded-full bg-red-500/10 border border-red-500/25 text-red-400">
                            High risk
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {allCardsExpanded && (
                    <div className="px-3.5 pb-3.5 space-y-2.5 border-t border-surface-border/50 pt-2.5 animate-fade-in">
                      <p className="text-[10px] text-ink-subtle font-mono truncate">{fp}</p>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] text-ink-subtle">
                          <span>others rely on it</span>
                          <span>it relies on others</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-raised overflow-hidden flex">
                          <div className="h-full bg-emerald-500/60 transition-all" style={{ width: `${dependentPct}%` }} />
                          <div className="h-full bg-blue-500/60 flex-1" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Graph view */}
      {view === 'graph' && (
        <DependencyGraph deps={deps as Record<string, { uses: string[]; used_by: string[] }>} onCheckImpact={onCheckImpact} />
      )}

      {/* List view */}
      {view === 'list' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                ↑ Imported by other files
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
                ↓ Imports other files
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-full">
                HUB ≥5 connections
              </span>
            </div>
            <div className="sm:ml-auto relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-subtle pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setShowAll(false) }}
                placeholder="Filter by file path…"
                className="bg-surface-raised border border-surface-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-subtle focus:outline-none focus:border-accent/60 transition-colors w-56"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-surface-border overflow-hidden bg-surface-card">
            {entries.length === 0
              ? <p className="text-sm text-ink-muted text-center py-10">No files match.</p>
              : <>
                {visible.map(([fp, dep]) => (
                  <DepRow key={fp} filePath={fp} uses={dep.uses ?? []} usedBy={dep.used_by ?? []} />
                ))}
                {!showAll && entries.length > PAGE && (
                  <div className="px-4 py-3 border-t border-surface-border bg-surface-raised/30">
                    <button onClick={() => setShowAll(true)} className="text-xs text-accent hover:text-ink transition-colors font-medium">
                      Show {entries.length - PAGE} more files…
                    </button>
                  </div>
                )}
              </>
            }
          </div>

          <p className="text-[11px] text-ink-subtle text-right">
            {entries.length} of {allEntries.length} file{allEntries.length !== 1 ? 's' : ''} tracked
          </p>
        </>
      )}
    </div>
  )
}

// ─── Combined panel ───────────────────────────────────────────────────────────

type SubView = 'api' | 'deps'

export default function ExplorePanel({ repo, onCheckImpact }: { repo: Repository; onCheckImpact?: (path: string) => void }) {
  const [sub, setSub] = useState<SubView>(
    (repo.api_endpoints?.length ?? 0) === 0 ? 'deps' : 'api'
  )
  const [mapView, setMapView] = useState<'graph' | 'list'>('graph')

  const subTabs: { id: SubView; label: string; count: string }[] = [
    {
      id: 'api',
      label: 'API Surface',
      count: String(repo.api_endpoints?.length ?? 0),
    },
    {
      id: 'deps',
      label: 'System Map',
      count: String(repo.dependencies ? Object.keys(repo.dependencies).length : 0),
    },
  ]

  return (
    <div className="space-y-6 pb-10">
      {/* Sub-nav row: main tabs (left) + graph/list toggle (right, System Map only) */}
      <div className="flex items-center justify-between gap-3">
        {/* Main tabs */}
        <div className="flex items-center gap-1 bg-surface-raised/50 border border-surface-border rounded-xl p-1">
          {subTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                sub === t.id
                  ? 'bg-surface-card border border-surface-border text-ink shadow-sm'
                  : 'text-ink-subtle hover:text-ink hover:bg-surface-card/50'
              }`}
            >
              {t.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${sub === t.id ? 'bg-surface-raised text-ink-muted' : 'text-ink-subtle'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Graph / List icon toggle — only visible under System Map */}
        {sub === 'deps' && (
          <div className="flex items-center gap-0.5 bg-surface-raised/50 border border-surface-border rounded-xl p-1">
            <button
              onClick={() => setMapView('graph')}
              title="Graph view"
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                mapView === 'graph'
                  ? 'bg-surface-card border border-surface-border text-ink shadow-sm'
                  : 'text-ink-subtle hover:text-ink hover:bg-surface-card/50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <circle cx="5" cy="12" r="2.5" /><circle cx="19" cy="5" r="2.5" /><circle cx="19" cy="19" r="2.5" />
                <path strokeLinecap="round" d="M7 11l10-5M7 13l10 5" />
              </svg>
            </button>
            <button
              onClick={() => setMapView('list')}
              title="List view"
              className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all ${
                mapView === 'list'
                  ? 'bg-surface-card border border-surface-border text-ink shadow-sm'
                  : 'text-ink-subtle hover:text-ink hover:bg-surface-card/50'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {sub === 'api' && <ApiSurface repo={repo} />}
      {sub === 'deps' && <SystemMap repo={repo} view={mapView} onCheckImpact={onCheckImpact} />}
    </div>
  )
}
