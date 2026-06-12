import { useState, useMemo } from 'react'
import { reposApi } from '../../api/repos'
import type { Repository, ApiEndpoint, CodeSearchHit } from '../../types'
import { EmptyState, RANK_STYLE, methodStyle, METHOD_STYLE } from './shared'
import DependencyGraph, { RoleLegend } from './DependencyGraph'
import Spinner from '../Spinner'

// ─── Code Search (retrieval-only, no LLM quota) ───────────────────────────────

const SEARCH_EXAMPLES = [
  'where is authentication handled',
  'database connection setup',
  'error handling middleware',
  'how are requests validated',
]

// Same chunk-type colour language as the Ask AI Evidence panel
const HIT_TYPE_STYLE: Record<string, { border: string; badge: string; label: string }> = {
  function: { border: 'border-l-pink-400',    badge: 'bg-pink-500/15 text-pink-300 border-pink-500/30',         label: 'Function' },
  class:    { border: 'border-l-violet-400',  badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',   label: 'Class'    },
  endpoint: { border: 'border-l-emerald-400', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', label: 'Endpoint' },
  module:   { border: 'border-l-blue-400',    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',         label: 'Module'   },
  raw:      { border: 'border-l-yellow-400',  badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',   label: 'Docs'     },
  doc:      { border: 'border-l-yellow-400',  badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',   label: 'Docs'     },
}
const HIT_TYPE_FALLBACK = { border: 'border-l-cyan-400', badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', label: 'Code' }

function ResultCard({ hit, rank, githubUrl, onAskAI, onCheckImpact, repoName }: {
  hit: CodeSearchHit
  rank: number
  githubUrl: string
  repoName: string
  onAskAI?: (q: string) => void
  onCheckImpact?: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const symbolName = hit.function_name || hit.class_name
  const fileName = hit.file_path.split('/').pop() ?? hit.file_path
  const style = HIT_TYPE_STYLE[hit.chunk_type?.toLowerCase() ?? ''] ?? HIT_TYPE_FALLBACK
  const githubHref = `${githubUrl}/blob/HEAD/${hit.file_path}${hit.line_start ? `#L${hit.line_start}${hit.line_end ? `-L${hit.line_end}` : ''}` : ''}`
  const canExpand = !!hit.chunk_preview

  return (
    <div
      onClick={() => canExpand && setExpanded(v => !v)}
      className={`rounded-xl bg-surface-card border border-l-2 border-surface-border ${style.border} overflow-hidden
                  hover:bg-surface-raised/40 transition-colors ${canExpand ? 'cursor-pointer' : ''}`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2.5 pl-3 pr-2 py-2.5">
        <span className="w-5 h-5 rounded-md bg-surface-raised border border-surface-border text-ink-subtle text-[10px] font-bold flex items-center justify-center shrink-0 tabular-nums">
          {rank}
        </span>

        {/* File identity */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
            <p className="text-xs font-semibold text-ink leading-tight">{fileName}</p>
            {symbolName && (
              <code className="text-[10px] font-mono text-cyan-300/90">
                {hit.class_name && !hit.function_name ? 'class ' : ''}{symbolName}
              </code>
            )}
          </div>
          <p className="text-[10px] text-ink-subtle font-mono truncate mt-0.5">{hit.file_path}</p>
        </div>

        {/* Badges — full labels, no abbreviations */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          {hit.line_start && (
            <span className="flex items-center gap-1 text-[10px] font-mono font-semibold bg-surface-raised border border-surface-border px-2 py-1 rounded-md text-ink-muted">
              <svg className="w-3 h-3 text-ink-subtle shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
              {hit.line_end && hit.line_end !== hit.line_start
                ? `Lines ${hit.line_start}–${hit.line_end}`
                : `Line ${hit.line_start}`}
            </span>
          )}
          <span className={`text-[10px] font-bold uppercase tracking-wide border px-2 py-1 rounded-md ${style.badge}`}>
            {style.label}
          </span>
          {hit.architectural_role && (
            <span className="text-[10px] font-semibold border px-2 py-1 rounded-md bg-surface-raised border-surface-border text-ink-muted capitalize">
              {hit.architectural_role}
            </span>
          )}
        </div>

        {/* Actions — always visible, same icon-button style as the Evidence panel */}
        <div className="flex items-center gap-0.5 shrink-0 ml-1">
          {canExpand && (
            <button
              onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
              title={expanded ? 'Hide code' : 'Show code'}
              className={`p-1.5 rounded-md transition-all ${expanded ? 'text-cyan-300 bg-surface-raised' : 'text-ink-subtle hover:text-ink hover:bg-surface-raised'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            </button>
          )}
          {onAskAI && (
            <button
              onClick={e => { e.stopPropagation(); onAskAI(`Explain ${symbolName ? `${symbolName} in ` : ''}${hit.file_path} in ${repoName}. What does it do and how is it used?`) }}
              title="Ask AI to explain this"
              className="p-1.5 rounded-md text-ink-subtle hover:text-pink-300 hover:bg-pink-500/10 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
              </svg>
            </button>
          )}
          {onCheckImpact && (
            <button
              onClick={e => { e.stopPropagation(); onCheckImpact(hit.file_path) }}
              title="Check what breaks if this changes"
              className="p-1.5 rounded-md text-ink-subtle hover:text-orange-300 hover:bg-orange-500/10 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </button>
          )}
          <a
            href={githubHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            title="Open exact lines on GitHub"
            className="p-1.5 rounded-md text-ink-subtle hover:text-ink hover:bg-surface-raised transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        </div>
      </div>

      {/* Why this matched — one-line LLM justification */}
      {hit.reason && (
        <div className="px-3 pb-2.5 -mt-0.5">
          <p className="text-[11px] text-ink-muted leading-relaxed pl-[30px]">
            <span className="font-semibold text-cyan-300/90">Why this matched · </span>
            {hit.reason}
          </p>
        </div>
      )}

      {/* Collapsible code preview — closed by default; clicks inside don't collapse it */}
      {expanded && hit.chunk_preview && (
        <div className="border-t border-surface-border/50 cursor-auto" onClick={e => e.stopPropagation()}>
          <pre className="text-[11px] font-mono text-ink-muted leading-relaxed px-4 py-3 overflow-x-auto whitespace-pre max-h-64 overflow-y-auto bg-surface-raised/20">
            {hit.chunk_preview}
          </pre>
        </div>
      )}
    </div>
  )
}

function CodeSearch({ repo, onAskAI, onCheckImpact }: {
  repo: Repository
  onAskAI?: (q: string) => void
  onCheckImpact?: (path: string) => void
}) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<CodeSearchHit[] | null>(null)
  const [lastQuery, setLastQuery] = useState('')
  const [showWeak, setShowWeak] = useState(false)

  const runSearch = async (q?: string) => {
    const text = (q ?? query).trim()
    if (text.length < 3) return
    if (q) setQuery(q)
    setLoading(true)
    setError(null)
    setShowWeak(false)
    try {
      const data = await reposApi.searchCode(repo.id, text)
      setResults(data.results)
      setLastQuery(text)
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Split by relevance relative to the best hit — weaker tail hides behind a toggle
  // instead of always padding the list to a fixed 10.
  const bestScore = results?.[0]?.score ?? 0
  const strongHits = (results ?? []).filter(r => r.score >= bestScore * 0.55)
  const weakHits   = (results ?? []).filter(r => r.score <  bestScore * 0.55)

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="rounded-2xl border border-surface-border bg-surface-card p-5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runSearch()}
              placeholder="Describe what you're looking for — e.g. where passwords are hashed"
              className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl bg-surface-raised border border-surface-border text-ink placeholder:text-ink-subtle focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
            />
          </div>
          <button
            onClick={() => runSearch()}
            disabled={loading || query.trim().length < 3}
            className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-2 shrink-0"
          >
            {loading
              ? <Spinner size="sm" className="border-white/40 border-t-white" />
              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            }
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
        <p className="text-[10px] text-ink-subtle mt-2.5 flex items-center gap-1.5">
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          Searches code meaning, not just keywords — and uses none of your daily AI quota.
        </p>
        {error && (
          <p className="text-xs text-red-400 mt-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>

      {/* Idle state — example queries */}
      {results === null && !loading && (
        <div className="rounded-2xl border border-surface-border bg-surface-card p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-subtle mb-3">Try a search</p>
          <div className="flex flex-wrap gap-2">
            {SEARCH_EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => runSearch(ex)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-surface-raised hover:border-cyan-500/40 hover:bg-cyan-500/5 text-xs text-ink-muted hover:text-cyan-300 transition-all"
              >
                <svg className="w-3 h-3 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                {ex}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-ink-subtle mt-3">
            Results link straight to Ask AI for an explanation, or to Impact to see what depends on the file.
          </p>
        </div>
      )}

      {/* Results */}
      {results !== null && !loading && (
        results.length === 0 ? (
          <EmptyState
            icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>}
            title="No matching code found"
            body={`Nothing in this repo matched "${lastQuery}". Try describing the behaviour differently or use a function name.`}
          />
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-ink-muted">
                <span className="font-semibold text-ink">{strongHits.length}</span> relevant match{strongHits.length !== 1 ? 'es' : ''} for
                <span className="italic text-ink"> "{lastQuery}"</span>
              </p>
              <p className="text-[10px] text-ink-subtle">ranked by relevance</p>
            </div>

            {strongHits.map((hit, i) => (
              <ResultCard
                key={`${hit.file_path}-${i}`}
                hit={hit}
                rank={i + 1}
                githubUrl={repo.github_url}
                repoName={repo.name}
                onAskAI={onAskAI}
                onCheckImpact={onCheckImpact}
              />
            ))}

            {/* Weaker tail — hidden by default */}
            {weakHits.length > 0 && (
              <>
                <button
                  onClick={() => setShowWeak(v => !v)}
                  className="w-full flex items-center gap-3 py-2 group"
                >
                  <div className="flex-1 h-px bg-surface-border/60" />
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-ink-subtle group-hover:text-ink transition-colors whitespace-nowrap">
                    <svg className={`w-3 h-3 transition-transform ${showWeak ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                    {showWeak ? 'Hide' : 'Show'} {weakHits.length} weaker match{weakHits.length !== 1 ? 'es' : ''}
                  </span>
                  <div className="flex-1 h-px bg-surface-border/60" />
                </button>
                {showWeak && weakHits.map((hit, i) => (
                  <ResultCard
                    key={`${hit.file_path}-weak-${i}`}
                    hit={hit}
                    rank={strongHits.length + i + 1}
                    githubUrl={repo.github_url}
                    repoName={repo.name}
                    onAskAI={onAskAI}
                    onCheckImpact={onCheckImpact}
                  />
                ))}
              </>
            )}
          </div>
        )
      )}
    </div>
  )
}

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

function DepRow({ filePath, uses, usedBy, repoName, onAskAI, onCheckImpact }: {
  filePath: string
  uses: string[]
  usedBy: string[]
  repoName: string
  onAskAI?: (q: string) => void
  onCheckImpact?: (path: string) => void
}) {
  const [open, setOpen] = useState(false)
  const total  = uses.length + usedBy.length
  const isHub  = total >= 5
  const canOpen = total > 0

  // Left-border colour by role — same vocabulary as the graph legend
  const borderColor =
    isHub              ? '#f97316' :
    usedBy.length > uses.length * 1.5 ? '#34d399' :
    uses.length > usedBy.length * 1.5 ? '#60a5fa' :
    '#334155'

  return (
    <div className="border-b border-surface-border/30 last:border-0">
      <div
        onClick={canOpen ? () => setOpen(v => !v) : undefined}
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
                Hub · risky to change
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

        {/* Actions — same icon buttons as Code Search results */}
        <div className="flex items-center gap-0.5 shrink-0">
          {onAskAI && (
            <button
              onClick={e => { e.stopPropagation(); onAskAI(`Explain ${filePath} in ${repoName}. What does it do and how does it fit into the architecture?`) }}
              title="Ask AI to explain this file"
              className="p-1.5 rounded-md text-ink-subtle hover:text-pink-300 hover:bg-pink-500/10 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
              </svg>
            </button>
          )}
          {onCheckImpact && (
            <button
              onClick={e => { e.stopPropagation(); onCheckImpact(filePath) }}
              title="Check what breaks if this changes"
              className="p-1.5 rounded-md text-ink-subtle hover:text-orange-300 hover:bg-orange-500/10 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </button>
          )}
        </div>

        {/* Chevron */}
        {canOpen && (
          <svg className={`w-3.5 h-3.5 text-ink-subtle shrink-0 mt-2 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>

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

function SystemMap({ repo, view, onAskAI, onCheckImpact, graphFocus, onFocusFile }: {
  repo: Repository
  view: 'graph' | 'list'
  onAskAI?: (q: string) => void
  onCheckImpact?: (path: string) => void
  graphFocus?: { path: string; ts: number } | null
  onFocusFile?: (path: string) => void
}) {
  const deps = repo.dependencies
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const PAGE = 30

  const askAboutFile = onAskAI
    ? (f: string) => onAskAI(`Explain ${f} in ${repo.name}. What does it do and how does it fit into the architecture?`)
    : undefined

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
    <div className="space-y-4">
      {/* Toolbar: top hubs (click to focus in graph) + shared search */}
      <div className="flex flex-wrap items-center gap-3">
        {topFiles.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-[10px] font-bold uppercase tracking-widest text-ink-subtle mr-0.5"
              title="The most connected files in this repo — changing them is risky"
            >
              Top hubs
            </span>
            {topFiles.map(([fp, dep], i) => (
              <button
                key={fp}
                onClick={() => onFocusFile?.(fp)}
                title={`${fp} — ${dep.used_by.length} rely on this · uses ${dep.uses.length}. Click to focus it in the graph.`}
                className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg border border-surface-border bg-surface-card hover:border-orange-500/40 hover:bg-orange-500/5 transition-all group"
              >
                <span className={`w-5 h-5 rounded-md border text-[10px] font-black flex items-center justify-center shrink-0 ${RANK_STYLE[i].badge}`}>
                  {i + 1}
                </span>
                <code className="text-[11px] font-mono text-ink-muted group-hover:text-ink transition-colors">
                  {fp.split('/').pop()}
                </code>
                <span className="text-[10px] text-ink-subtle tabular-nums">{dep.uses.length + dep.used_by.length}</span>
              </button>
            ))}
          </div>
        )}
        <div className="sm:ml-auto relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-subtle pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowAll(false) }}
            placeholder="Search files in this map…"
            className="bg-surface-raised border border-surface-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-subtle focus:outline-none focus:border-accent/60 transition-colors w-56"
          />
          {search && (
            <button onClick={() => { setSearch(''); setShowAll(false) }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink">✕</button>
          )}
        </div>
      </div>

      {/* Graph view */}
      {view === 'graph' && (
        <DependencyGraph
          deps={deps as Record<string, { uses: string[]; used_by: string[] }>}
          search={search}
          onCheckImpact={onCheckImpact}
          onAskFile={askAboutFile}
          focusFile={graphFocus}
        />
      )}

      {/* List view */}
      {view === 'list' && (
        <>
          <div className="px-1">
            <RoleLegend />
          </div>

          <div className="rounded-2xl border border-surface-border overflow-hidden bg-surface-card">
            {entries.length === 0
              ? <p className="text-sm text-ink-muted text-center py-10">No files match.</p>
              : <>
                {visible.map(([fp, dep]) => (
                  <DepRow
                    key={fp}
                    filePath={fp}
                    uses={dep.uses ?? []}
                    usedBy={dep.used_by ?? []}
                    repoName={repo.name}
                    onAskAI={onAskAI}
                    onCheckImpact={onCheckImpact}
                  />
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

type SubView = 'search' | 'api' | 'deps'

export default function ExplorePanel({ repo, onAskAI, onCheckImpact }: {
  repo: Repository
  onAskAI?: (q: string) => void
  onCheckImpact?: (path: string) => void
}) {
  const [sub, setSub] = useState<SubView>('search')
  const [mapView, setMapView] = useState<'graph' | 'list'>('graph')
  const [graphFocus, setGraphFocus] = useState<{ path: string; ts: number } | null>(null)

  // Top-hub chip click: ensure graph view, then focus that node (ts re-triggers repeats)
  const focusInGraph = (path: string) => {
    setMapView('graph')
    setGraphFocus({ path, ts: Date.now() })
  }

  const subTabs: { id: SubView; label: string; count?: string; icon?: React.ReactNode }[] = [
    {
      id: 'search',
      label: 'Code Search',
      icon: (
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
      ),
    },
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
              {t.icon}
              {t.label}
              {t.count !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${sub === t.id ? 'bg-surface-raised text-ink-muted' : 'text-ink-subtle'}`}>
                  {t.count}
                </span>
              )}
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

      {sub === 'search' && <CodeSearch repo={repo} onAskAI={onAskAI} onCheckImpact={onCheckImpact} />}
      {sub === 'api' && <ApiSurface repo={repo} />}
      {sub === 'deps' && (
        <SystemMap
          repo={repo}
          view={mapView}
          onAskAI={onAskAI}
          onCheckImpact={onCheckImpact}
          graphFocus={graphFocus}
          onFocusFile={focusInGraph}
        />
      )}
    </div>
  )
}
