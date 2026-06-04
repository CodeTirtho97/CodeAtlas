import type { Repository } from '../../types'
import { techColor } from './shared'

type TabId = 'overview' | 'understand' | 'explore' | 'change' | 'evaluate' | 'ask'

interface Props {
  repo: Repository
  onNavigate: (tab: TabId) => void
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, sub }: {
  icon: React.ReactNode; value: string | number; label: string; sub?: string
}) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-card px-5 py-4 flex items-start gap-4">
      <div className="w-9 h-9 rounded-xl bg-surface-raised border border-surface-border flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-ink leading-none">{value}</p>
        <p className="text-xs font-semibold text-ink-muted mt-1">{label}</p>
        {sub && <p className="text-[10px] text-ink-subtle mt-0.5 leading-relaxed">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Quick action card ────────────────────────────────────────────────────────

function ActionCard({ icon, title, description, cta, color, onClick }: {
  icon: React.ReactNode
  title: string
  description: string
  cta: string
  color: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl border border-surface-border bg-surface-card p-5
                 hover:border-surface-border/80 hover:-translate-y-0.5 transition-all duration-150 w-full"
    >
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${color}`}>
        {icon}
      </div>
      <p className="text-sm font-bold text-ink">{title}</p>
      <p className="text-xs leading-relaxed text-ink-muted mt-1.5">{description}</p>
      <p className={`text-xs font-semibold mt-4 transition-colors ${color.includes('pink') ? 'text-pink-400' : color.includes('amber') ? 'text-amber-400' : color.includes('violet') ? 'text-violet-400' : 'text-cyan-400'} group-hover:opacity-80`}>
        {cta} →
      </p>
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function OverviewPanel({ repo, onNavigate }: Props) {
  const endpoints  = repo.api_endpoints ?? []
  const depEntries = Object.entries(repo.dependencies ?? {})
  const repoShortName = repo.github_url.replace('https://github.com/', '')

  const hottestDep = depEntries
    .map(([file, dep]) => ({ file, total: (dep.used_by?.length ?? 0) + (dep.uses?.length ?? 0) }))
    .sort((a, b) => b.total - a.total)[0]

  const methodCounts = endpoints.reduce((acc, ep) => {
    const m = (ep.method ?? 'OTHER').toUpperCase()
    acc[m] = (acc[m] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topMethods = Object.entries(methodCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  return (
    <div className="space-y-6 pb-8">

      {/* ── Repo identity ── */}
      <div className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden">

        {/* Header row */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-surface-raised border border-surface-border flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-ink-muted" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-ink truncate">{repoShortName}</h1>
              <a href={repo.github_url} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-ink-subtle hover:text-blue-400 transition-colors font-mono flex items-center gap-1 mt-0.5">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                {repo.github_url}
              </a>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400
                           bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Indexed
          </span>
        </div>

        {/* Purpose */}
        {repo.summary?.purpose && (
          <div className="mx-6 mb-5 rounded-xl bg-surface-raised/40 border border-surface-border/60 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-ink-subtle mb-2">What this codebase does</p>
            <p className="text-sm leading-relaxed text-ink">{repo.summary.purpose}</p>
            {repo.summary.stack && repo.summary.stack.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-surface-border/50">
                {repo.summary.stack.map(t => (
                  <span key={t} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${techColor(t)}`}>{t}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>}
          value={repo.chunk_count.toLocaleString()}
          label="Code blocks read"
          sub="Functions, classes & files the AI has understood"
        />
        <StatCard
          icon={<svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>}
          value={endpoints.length}
          label="API endpoints found"
          sub={topMethods.length ? topMethods.map(([m, n]) => `${n} ${m}`).join(' · ') : 'No routes detected'}
        />
        <StatCard
          icon={<svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>}
          value={depEntries.length}
          label="Files with tracked imports"
          sub={hottestDep ? `Most connected: ${hottestDep.file.split('/').pop()}` : 'No dependency data'}
        />
        <StatCard
          icon={<svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>}
          value={repo.summary?.entry_points?.length ?? 0}
          label="Entry points"
          sub="Where the app starts — main files, routes, index"
        />
      </div>

      {/* ── Architecture ── */}
      {repo.summary?.architecture && (
        <div className="rounded-2xl border border-surface-border bg-surface-card px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1 h-4 rounded-full bg-violet-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-ink-subtle">How it's built</p>
          </div>
          <p className="text-sm text-ink leading-relaxed">{repo.summary.architecture}</p>
        </div>
      )}

      {/* ── Entry points ── */}
      {repo.summary?.entry_points && repo.summary.entry_points.length > 0 && (
        <div className="rounded-2xl border border-surface-border bg-surface-card px-6 py-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 rounded-full bg-emerald-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-ink-subtle">Entry points</p>
            <span className="ml-auto text-[10px] text-ink-subtle">
              Where the app starts
            </span>
          </div>
          <div className="space-y-2">
            {repo.summary.entry_points.map((ep, i) => (
              <div key={ep} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-surface-raised/50
                                       border border-surface-border/50 hover:border-emerald-500/20 transition-colors">
                <span className="text-[10px] font-bold text-emerald-500/50 font-mono shrink-0 w-4 text-right">
                  {i + 1}
                </span>
                <svg className="w-3.5 h-3.5 text-ink-subtle shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <code className="text-xs font-mono text-ink-muted flex-1 truncate">{ep}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick actions ── */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-ink-subtle mb-3">Where to go next</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <ActionCard
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" /></svg>}
            title="Ask a question"
            description="Ask anything about this codebase and get answers backed by the actual source code."
            cta="Open Ask AI"
            color="bg-pink-500/10 border-pink-500/25 text-pink-400"
            onClick={() => onNavigate('ask')}
          />
          <ActionCard
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>}
            title="See what breaks if you change something"
            description="Type any function or file — instantly see every other file that depends on it."
            cta="Open Impact Area"
            color="bg-amber-500/10 border-amber-500/25 text-amber-400"
            onClick={() => onNavigate('change')}
          />
          <ActionCard
            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            title="Check if AI answers are trustworthy"
            description="Run a quick test to see how accurately the AI finds the right code for your questions."
            cta="Run Evaluation"
            color="bg-violet-500/10 border-violet-500/25 text-violet-400"
            onClick={() => onNavigate('evaluate')}
          />
        </div>
      </div>

    </div>
  )
}
