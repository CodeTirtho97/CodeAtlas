import { useState, useEffect } from 'react'
import { reposApi } from '../../api/repos'
import type { ImpactResult, RiskLevel } from '../../types'
import Spinner from '../Spinner'
import { methodStyle } from './shared'

interface CachedAnalysis {
  symbol: string
  result: ImpactResult
  ts: number
}

const CACHE_KEY = (repoId: string) => `impact_history_${repoId}`
const MAX_CACHE = 5
const TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function loadCache(repoId: string): CachedAnalysis[] {
  try {
    const all: CachedAnalysis[] = JSON.parse(localStorage.getItem(CACHE_KEY(repoId)) ?? '[]')
    const fresh = all.filter(e => Date.now() - e.ts < TTL_MS)
    if (fresh.length !== all.length)
      localStorage.setItem(CACHE_KEY(repoId), JSON.stringify(fresh))
    return fresh
  } catch { return [] }
}

function saveToCache(repoId: string, entry: CachedAnalysis) {
  const existing = loadCache(repoId).filter(e => e.symbol !== entry.symbol)
  localStorage.setItem(CACHE_KEY(repoId), JSON.stringify([entry, ...existing].slice(0, MAX_CACHE)))
}

// ─── Risk config ──────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskLevel, {
  label: string
  description: string
  border: string
  bg: string
  text: string
  bar: string
  barWidth: string
  badgeBg: string
}> = {
  high: {
    label: 'High Risk',
    description: 'This change has broad reach. Several modules depend on it directly or transitively. Proceed carefully and run the full test surface.',
    border: 'border-red-500/30',
    bg: 'bg-red-500/8',
    text: 'text-red-400',
    bar: 'bg-red-500',
    barWidth: 'w-[85%]',
    badgeBg: 'bg-red-500/15 border-red-500/30 text-red-400',
  },
  medium: {
    label: 'Medium Risk',
    description: 'Moderate blast radius. A few direct dependents exist and some transitive exposure. Review the affected files and run targeted tests.',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/8',
    text: 'text-amber-400',
    bar: 'bg-amber-400',
    barWidth: 'w-[50%]',
    badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
  },
  low: {
    label: 'Low Risk',
    description: 'Limited impact. Few or no direct dependents found. Standard review process should suffice.',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/8',
    text: 'text-emerald-400',
    bar: 'bg-emerald-500',
    barWidth: 'w-[18%]',
    badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
  },
}

// ─── Impact stat chip ─────────────────────────────────────────────────────────

function ImpactStat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-surface-raised border border-surface-border min-w-[72px]">
      <span className={`text-xl font-bold leading-none ${value > 0 ? accent : 'text-ink-subtle'}`}>{value}</span>
      <span className="text-[10px] text-ink-subtle font-medium text-center leading-tight">{label}</span>
    </div>
  )
}

// ─── Checklist item ───────────────────────────────────────────────────────────

function CheckItem({ file, checked, onToggle }: { file: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border transition-all text-left ${
        checked
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-surface-border/50 bg-surface-raised/40 hover:border-surface-border/80'
      }`}
    >
      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
        checked ? 'bg-emerald-500 border-emerald-500' : 'border-surface-border bg-surface-raised'
      }`}>
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </div>
      <code className={`text-xs font-mono flex-1 truncate transition-colors ${checked ? 'text-emerald-400 line-through opacity-70' : 'text-ink-muted'}`}>
        {file}
      </code>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  repoId:         string
  onAskAI?:       (question: string) => void
  defaultSymbol?: string
}

export default function ImpactWorkbench({ repoId, onAskAI, defaultSymbol }: Props) {
  const [symbol, setSymbol] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImpactResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checkedTests, setCheckedTests] = useState<Record<string, boolean>>({})
  const [depsExpanded, setDepsExpanded] = useState<'direct' | 'transitive' | null>('direct')
  const [history, setHistory] = useState<CachedAnalysis[]>(() => loadCache(repoId))

  // Pre-fill input when navigated from graph/explore — user analyzes manually
  useEffect(() => {
    if (defaultSymbol) {
      setSymbol(defaultSymbol)
      setResult(null)
      setError(null)
    }
  }, [defaultSymbol])

  const handleAnalyze = async () => {
    const sym = symbol.trim()  // capture now — avoid stale closure after async call
    if (!sym) return
    setLoading(true)
    setResult(null)
    setError(null)
    setCheckedTests({})
    setDepsExpanded('direct')
    try {
      const data = await reposApi.analyzeImpact(repoId, sym)
      setResult(data)
      const entry: CachedAnalysis = { symbol: sym, result: data, ts: Date.now() }
      saveToCache(repoId, entry)
      setHistory(loadCache(repoId))
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Analysis failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const toggleTest = (file: string) => {
    setCheckedTests(prev => ({ ...prev, [file]: !prev[file] }))
  }

  const rc = result ? RISK_CONFIG[result.risk] : null
  const checkedCount = Object.values(checkedTests).filter(Boolean).length
  const preFilled = !!defaultSymbol && !!symbol && !result && !loading

  return (
    <div className="space-y-6 pb-10">

      {/* ── Input card ── */}
      <div className="rounded-2xl border border-surface-border bg-surface-card p-5">
        <div className="flex gap-2">
          <input
            value={symbol}
            onChange={e => setSymbol(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            placeholder="e.g. authenticate_user, AuthService, routes/auth.py"
            className="flex-1 px-3.5 py-2.5 text-sm rounded-xl bg-surface-raised border border-surface-border text-ink placeholder:text-ink-subtle focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/20 transition-colors"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !symbol.trim()}
            className={`px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-2 shrink-0 ${preFilled ? 'ring-2 ring-orange-400/60 ring-offset-1 ring-offset-surface-card animate-pulse' : ''}`}
          >
            {loading
              ? <Spinner size="sm" className="border-white/40 border-t-white" />
              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            }
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
        {preFilled && (
          <p className="text-[11px] text-orange-400/80 mt-2.5 flex items-center gap-1.5">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            File path pre-filled — click <strong className="font-semibold">Analyze</strong> to check its impact.
          </p>
        )}
        {error && (
          <p className="text-xs text-red-400 mt-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
        )}
        {loading && (
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
            <span className="inline-flex gap-0.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
            Tracing dependency graph…
          </div>
        )}
      </div>

      {/* ── History cards — always visible so saved results are accessible ── */}
      {history.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-subtle">Previous analyses</p>
            <span className="text-[10px] text-ink-subtle/50">· saved for 24h</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {history.map(h => {
              const rc = RISK_CONFIG[h.result.risk]
              return (
                <button
                  key={h.symbol + h.ts}
                  onClick={() => { setSymbol(h.symbol); setResult(h.result); setCheckedTests({}); setDepsExpanded('direct') }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-surface-border bg-surface-card hover:border-orange-500/30 hover:bg-orange-500/5 transition-all group"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${rc.bar}`} />
                  <code className="text-xs font-mono text-ink-muted group-hover:text-ink transition-colors">{h.symbol}</code>
                  <span className={`text-[10px] font-bold ${rc.text}`}>{rc.label}</span>
                  <span className="text-[10px] text-ink-subtle">{h.result.total_impact} files</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Empty / idle state ── */}
      {!result && !loading && (
        <div className="space-y-4">
          {/* How it works — only before the very first check and when no path is pre-filled */}
          {history.length === 0 && !preFilled && (
          <div className="rounded-2xl border border-surface-border bg-surface-card p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-subtle mb-4">How it works</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  step: '1',
                  color: 'text-orange-400',
                  bg: 'bg-orange-500/10 border-orange-500/20',
                  title: 'Type a symbol',
                  body: "Enter any indexed function, class, or file path — not just API endpoints. Any symbol in your codebase you're about to change.",
                },
                {
                  step: '2',
                  color: 'text-amber-400',
                  bg: 'bg-amber-500/10 border-amber-500/20',
                  title: 'See what breaks',
                  body: 'Instantly see every file, module, and API endpoint that depends on what you typed — directly or indirectly.',
                },
                {
                  step: '3',
                  color: 'text-emerald-400',
                  bg: 'bg-emerald-500/10 border-emerald-500/20',
                  title: 'Know what to test',
                  body: 'Get a checklist of test files to run before merging, so nothing slips through.',
                },
              ].map(({ step, color, bg, title, body }) => (
                <div key={step} className={`rounded-xl border ${bg} p-4 flex flex-col gap-2`}>
                  <span className={`text-2xl font-black leading-none ${color}`}>{step}</span>
                  <p className="text-sm font-semibold text-ink">{title}</p>
                  <p className="text-xs text-ink-muted leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Simple hint for returning users */}
          {history.length > 0 && (
            <div className="flex items-end justify-center px-6" style={{ minHeight: '180px', paddingBottom: '15px' }}>
              <p className="text-center leading-relaxed italic">
                <span className="text-xs text-ink-subtle">Type a </span>
                <span className="text-xs font-semibold text-ink-muted">function, class, or file</span>
                <span className="text-xs text-ink-subtle"> — get back every </span>
                <span className="text-xs font-semibold text-ink-muted">file that depends on it</span>
                <span className="text-xs text-ink-subtle">,</span>
                <br />
                <span className="text-xs text-ink-subtle">every </span>
                <span className="text-xs font-semibold text-ink-muted">API route that's affected</span>
                <span className="text-xs text-ink-subtle">, and a </span>
                <span className="text-xs font-semibold text-ink-muted">checklist of tests</span>
                <span className="text-xs text-ink-subtle"> to run before you merge.</span>
              </p>
            </div>
          )}

          {/* Example searches — only for first-time users with no pre-fill */}
          {history.length === 0 && !preFilled && <div className="rounded-2xl border border-surface-border bg-surface-card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-subtle mb-3">Try an example</p>
            <div className="flex flex-wrap gap-2">
              {[
                'authenticate_user',
                'AuthService',
                'routes/auth.py',
                'validateToken',
                'database.py',
                'UserModel',
              ].map(example => (
                <button
                  key={example}
                  onClick={() => setSymbol(example)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-border bg-surface-raised hover:border-orange-500/40 hover:bg-orange-500/5 text-xs font-mono text-ink-muted hover:text-orange-300 transition-all"
                >
                  <svg className="w-3 h-3 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  {example}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-ink-subtle mt-3">Click any example to prefill the search, then hit Analyze.</p>
          </div>}
        </div>
      )}

      {result && rc && (
        <>
          {/* ── Source of change ── */}
          <div className={`rounded-2xl border ${rc.border} ${rc.bg} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl border ${rc.border} ${rc.bg} flex items-center justify-center shrink-0`}>
                  <svg className={`w-5 h-5 ${rc.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${rc.text} mb-1`}>Source of change</p>
                  <p className="text-base font-bold text-ink">
                    <code className="font-mono">{result.symbol}</code>
                  </p>
                  {result.matched_file && (
                    <p className={`text-xs font-mono mt-1 ${rc.text} opacity-80`}>{result.matched_file}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1.5 rounded-full border text-xs font-bold ${rc.badgeBg}`}>
                  {rc.label}
                </span>
                <span className="px-3 py-1.5 rounded-full border border-surface-border bg-surface-raised text-xs font-medium text-ink-muted">
                  {result.total_impact} file{result.total_impact !== 1 ? 's' : ''} affected
                </span>
              </div>
            </div>

            {/* Risk bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-ink-subtle font-medium">Blast radius</span>
                <span className={`text-[10px] font-bold ${rc.text}`}>{rc.label}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-raised overflow-hidden">
                <div className={`h-full ${rc.bar} ${rc.barWidth} rounded-full transition-all duration-700`} />
              </div>
            </div>

            {/* Summary */}
            <p className={`mt-4 text-sm leading-relaxed ${rc.text} opacity-90`}>{result.summary}</p>
            <p className="mt-2 text-xs text-ink-muted leading-relaxed">{rc.description}</p>
          </div>

          {/* ── Impact stats ── */}
          <div className="flex flex-wrap gap-2">
            <ImpactStat label="Total files" value={result.total_impact} accent="text-orange-400" />
            <ImpactStat label="Direct" value={result.direct_dependents.length} accent="text-red-400" />
            <ImpactStat label="Transitive" value={result.transitive_dependents.length} accent="text-amber-400" />
            <ImpactStat label="Endpoints" value={result.affected_endpoints.length} accent="text-blue-400" />
            <ImpactStat label="Tests" value={result.tests_to_run.length} accent="text-violet-400" />
          </div>

          {/* ── Dependency chain + Surfaces ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Left: Dependency chain */}
            <div className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-surface-border bg-surface-raised/50">
                <p className="text-xs font-semibold text-ink">Dependency Chain</p>
                <p className="text-[10px] text-ink-muted mt-0.5">Files that break if this symbol changes</p>
              </div>

              {/* Direct */}
              <div>
                <button
                  onClick={() => setDepsExpanded(prev => prev === 'direct' ? null : 'direct')}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-raised/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                    <span className="text-xs font-semibold text-ink">Direct dependents</span>
                    <span className="text-[10px] text-red-400 font-bold">{result.direct_dependents.length}</span>
                  </div>
                  <svg className={`w-3.5 h-3.5 text-ink-subtle transition-transform ${depsExpanded === 'direct' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {depsExpanded === 'direct' && (
                  <div className="px-5 pb-3 border-b border-surface-border/50">
                    {result.direct_dependents.length === 0 ? (
                      <p className="text-xs text-ink-subtle italic py-2">No direct dependents found.</p>
                    ) : (
                      <div className="space-y-1">
                        {result.direct_dependents.map(f => (
                          <div key={f} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/5 border border-red-500/15">
                            <span className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                            <code className="text-xs font-mono text-ink-muted flex-1 truncate">{f}</code>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Arrow */}
              {result.transitive_dependents.length > 0 && (
                <div className="flex items-center gap-2 px-5 py-2">
                  <div className="w-full h-px bg-surface-border/60" />
                  <span className="text-[10px] text-ink-subtle whitespace-nowrap">cascades to</span>
                  <div className="w-full h-px bg-surface-border/60" />
                </div>
              )}

              {/* Transitive */}
              <div>
                <button
                  onClick={() => setDepsExpanded(prev => prev === 'transitive' ? null : 'transitive')}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-raised/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-xs font-semibold text-ink">Transitive dependents</span>
                    <span className="text-[10px] text-amber-400 font-bold">{result.transitive_dependents.length}</span>
                  </div>
                  <svg className={`w-3.5 h-3.5 text-ink-subtle transition-transform ${depsExpanded === 'transitive' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {depsExpanded === 'transitive' && (
                  <div className="px-5 pb-3">
                    {result.transitive_dependents.length === 0 ? (
                      <p className="text-xs text-ink-subtle italic py-2">No transitive dependents found.</p>
                    ) : (
                      <div className="space-y-1">
                        {result.transitive_dependents.map(f => (
                          <div key={f} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
                            <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                            <code className="text-xs font-mono text-ink-muted flex-1 truncate">{f}</code>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Affected surfaces */}
            <div className="space-y-4">
              {/* Endpoints */}
              <div className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-surface-border bg-surface-raised/50">
                  <p className="text-xs font-semibold text-ink">
                    API Endpoints Touched
                    <span className="ml-2 text-[10px] text-blue-400 font-bold">{result.affected_endpoints.length}</span>
                  </p>
                  <p className="text-[10px] text-ink-muted mt-0.5">Routes that will need testing or review</p>
                </div>
                <div className="p-3">
                  {result.affected_endpoints.length === 0 ? (
                    <p className="text-xs text-ink-subtle italic text-center py-4">No API endpoints affected.</p>
                  ) : (
                    <div className="space-y-2">
                      {result.affected_endpoints.map((ep, i) => (
                        <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-surface-raised/50 border border-surface-border/50 group hover:border-blue-500/30 transition-colors">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 ${methodStyle(ep.method)}`}>
                            {ep.method ?? '?'}
                          </span>
                          <code className="text-xs font-mono text-ink flex-1 min-w-0 truncate">
                            {ep.path ?? ep.file_path}
                          </code>
                          {ep.function_name && (
                            <span className="text-[10px] text-ink-subtle font-mono shrink-0 hidden group-hover:block">
                              {ep.function_name}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tests checklist */}
              <div className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-surface-border bg-surface-raised/50 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-ink">
                      Tests to Run
                      <span className="ml-2 text-[10px] text-violet-400 font-bold">{result.tests_to_run.length}</span>
                    </p>
                    <p className="text-[10px] text-ink-muted mt-0.5">Check off as you verify each test passes</p>
                  </div>
                  {result.tests_to_run.length > 0 && (
                    <span className="text-[10px] text-ink-subtle font-medium">
                      {checkedCount}/{result.tests_to_run.length} done
                    </span>
                  )}
                </div>
                <div className="p-3">
                  {result.tests_to_run.length === 0 ? (
                    <p className="text-xs text-ink-subtle italic text-center py-4">No test files in affected set.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {result.tests_to_run.map(f => (
                        <CheckItem
                          key={f}
                          file={f}
                          checked={!!checkedTests[f]}
                          onToggle={() => toggleTest(f)}
                        />
                      ))}
                    </div>
                  )}
                  {checkedCount === result.tests_to_run.length && result.tests_to_run.length > 0 && (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs text-emerald-400 font-medium">All tests verified</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Next steps ── */}
          <div className="rounded-2xl border border-surface-border bg-surface-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle mb-4">Next steps</p>
            <div className="flex flex-wrap gap-2">
              {onAskAI && (
                <button
                  onClick={() => onAskAI(`Why does changing "${result.symbol}" have ${rc.label.toLowerCase()} impact? Trace the full dependency chain from ${result.matched_file ?? result.symbol} and explain which modules are most tightly coupled to it.`)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pink-500/10 border border-pink-500/25 text-pink-300 text-xs font-semibold hover:bg-pink-500/20 hover:border-pink-500/40 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
                  </svg>
                  Ask AI why
                </button>
              )}
              {onAskAI && result.affected_endpoints.length > 0 && (
                <button
                  onClick={() => onAskAI(`Explain how the ${result.affected_endpoints.length} affected API endpoint${result.affected_endpoints.length !== 1 ? 's' : ''} use "${result.symbol}". What request flows go through this code?`)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-300 text-xs font-semibold hover:bg-blue-500/20 hover:border-blue-500/40 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  Review impacted APIs
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
