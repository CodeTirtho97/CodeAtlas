import { useState, useRef } from 'react'
import type { Repository } from '../../types'
import { EmptyState, SectionLabel, StatCard, techColor, STEP_ACCENTS } from './shared'

// ─── File chip with isolated hover tooltip ────────────────────────────────────

function FileChip({ f, accent, repoName, onAskAI, onCheckImpact }: {
  f: string
  accent: typeof STEP_ACCENTS[number]
  repoName: string
  onAskAI?: (q: string) => void
  onCheckImpact?: (path: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    setHovered(true)
  }
  const hide = () => {
    hideTimer.current = setTimeout(() => setHovered(false), 120)
  }

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      {/* Chip */}
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${accent.border} ${accent.bg} text-[11px] font-mono ${accent.text} cursor-default`}>
        <svg className="w-3 h-3 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        {f}
      </span>

      {/* Tooltip — onMouseEnter/Leave keep it alive while mouse travels the gap */}
      {hovered && (
        <span
          onMouseEnter={show}
          onMouseLeave={hide}
          className="absolute bottom-full left-0 mb-1.5 z-20 flex items-center gap-1 px-1.5 py-1 rounded-lg border border-surface-border bg-surface-card shadow-xl whitespace-nowrap"
        >
          {onAskAI && (
            <button
              onClick={() => onAskAI(`Explain ${f} in ${repoName}. What does it do and how does it fit into the architecture?`)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-pink-300 hover:bg-pink-500/15 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
              </svg>
              Ask AI
            </button>
          )}
          {onAskAI && onCheckImpact && <span className="w-px h-3.5 bg-surface-border shrink-0" />}
          {onCheckImpact && (
            <button
              onClick={() => onCheckImpact(f)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-orange-300 hover:bg-orange-500/15 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              Check Impact
            </button>
          )}
        </span>
      )}
    </span>
  )
}

// ─── Overview section ─────────────────────────────────────────────────────────

function OverviewSection({ repo }: { repo: Repository }) {
  const summary = repo.summary
  const endpoints = repo.api_endpoints ?? []
  const endpointCount = endpoints.length
  const depCount = repo.dependencies ? Object.keys(repo.dependencies).length : 0
  const langCount = summary?.stack?.length ?? 0

  const methodCounts = endpoints.reduce((acc, ep) => {
    const m = (ep.method ?? 'OTHER').toUpperCase()
    acc[m] = (acc[m] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  const topMethods = Object.entries(methodCounts).slice(0, 3)

  const METHOD_COLOR: Record<string, string> = {
    GET:    'text-emerald-400 bg-emerald-500/10',
    POST:   'text-blue-400 bg-blue-500/10',
    PUT:    'text-amber-400 bg-amber-500/10',
    DELETE: 'text-red-400 bg-red-500/10',
    PATCH:  'text-purple-400 bg-purple-500/10',
  }

  return (
    <div className="space-y-8">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          value={repo.chunk_count.toLocaleString()}
          label="Chunks indexed"
          description="Code segments embedded & searchable by AI"
          accent="bg-gradient-to-r from-blue-500/80 to-blue-400/30"
          iconBg="bg-blue-500/10"
          icon={<svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75M3.75 10.125v3.75" /></svg>}
          footer={
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
              <span className="text-[10px] text-blue-400 font-medium">Ready for AI queries</span>
            </div>
          }
        />
        <StatCard
          value={langCount || '—'}
          isEmpty={!langCount}
          label="Technologies"
          description="Languages & frameworks detected in source"
          accent="bg-gradient-to-r from-violet-500/80 to-violet-400/30"
          iconBg="bg-violet-500/10"
          icon={<svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>}
          footer={
            summary?.stack && summary.stack.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {summary.stack.slice(0, 3).map(t => (
                  <span key={t} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${techColor(t)}`}>{t}</span>
                ))}
                {summary.stack.length > 3 && (
                  <span className="text-[9px] text-ink-subtle px-1.5 py-0.5">+{summary.stack.length - 3}</span>
                )}
              </div>
            ) : (
              <span className="text-[10px] text-ink-subtle">No stack data available</span>
            )
          }
        />
        <StatCard
          value={endpointCount || '—'}
          isEmpty={!endpointCount}
          label="API endpoints"
          description="Mapped routes across all source files"
          accent="bg-gradient-to-r from-emerald-500/80 to-emerald-400/30"
          iconBg="bg-emerald-500/10"
          icon={<svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>}
          footer={
            topMethods.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {topMethods.map(([m, n]) => (
                  <span key={m} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${METHOD_COLOR[m] ?? 'text-ink-subtle bg-surface-raised'}`}>
                    {m} <span className="opacity-70">×{n}</span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[10px] text-ink-subtle">Supports FastAPI · Express · Spring · Go</span>
            )
          }
        />
        <StatCard
          value={depCount || '—'}
          isEmpty={!depCount}
          label="Dep. tracked files"
          description="Files with mapped import relationships"
          accent="bg-gradient-to-r from-amber-500/80 to-amber-400/30"
          iconBg="bg-amber-500/10"
          icon={<svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" /></svg>}
          footer={
            depCount > 0 ? (
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-[10px] text-amber-400 font-medium">Dependency graph built</span>
              </div>
            ) : (
              <span className="text-[10px] text-ink-subtle">Supports JS · TS · Python · Go · Java</span>
            )
          }
        />
      </div>

      {!summary ? (
        <EmptyState
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>}
          title="Summary not generated"
          body="The repository summary failed to generate. Use Ask AI to explore this codebase directly."
        />
      ) : (
        <>
          {/* Purpose */}
          <div>
            <SectionLabel>What this repo does</SectionLabel>
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-5 py-4">
              <p className="text-base sm:text-lg text-ink leading-relaxed font-medium">{summary.purpose}</p>
            </div>
          </div>

          {/* Tech stack */}
          {summary.stack && summary.stack.length > 0 && (
            <div>
              <SectionLabel>Tech stack</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {summary.stack.map(tech => (
                  <span key={tech} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${techColor(tech)}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Entry points + Architecture */}
          <div className="grid sm:grid-cols-2 gap-6">
            {summary.entry_points && summary.entry_points.length > 0 && (
              <div>
                <SectionLabel>Entry points</SectionLabel>
                <div className="space-y-1.5">
                  {summary.entry_points.map((ep, i) => (
                    <div key={ep} className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-surface-raised border border-surface-border group hover:border-emerald-500/30 transition-colors">
                      <span className="text-[10px] font-bold text-emerald-500/60 font-mono w-4 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      <svg className="w-3.5 h-3.5 text-ink-subtle shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <code className="text-xs font-mono text-ink-muted flex-1 truncate group-hover:text-ink transition-colors">{ep}</code>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/50 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {summary.architecture && (
              <div>
                <SectionLabel>Architecture</SectionLabel>
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                  <p className="text-sm text-ink-muted leading-relaxed">{summary.architecture}</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Guide section ────────────────────────────────────────────────────────────

function GuideSection({ repo, onAskAI, onCheckImpact }: { repo: Repository; onAskAI?: (q: string) => void; onCheckImpact?: (path: string) => void }) {
  const guide = repo.onboarding

  if (!guide) return (
    <EmptyState
      icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" /></svg>}
      title="Onboarding guide not available"
      body="Switch to Ask AI and ask 'Where should I start?' for a personalized walkthrough."
    />
  )

  return (
    <div className="space-y-8">
      {/* Learning path hero */}
      {guide.learning_path && (
        <div className="relative rounded-2xl overflow-hidden border border-emerald-500/25">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 via-transparent to-teal-500/5 pointer-events-none" />
          <div className="relative flex gap-4 p-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Suggested starting point</p>
              <p className="text-sm text-ink-muted leading-relaxed">{guide.learning_path}</p>
            </div>
          </div>
        </div>
      )}

      {/* Steps */}
      {guide.steps && guide.steps.length > 0 && (
        <div>
          <SectionLabel>Learning steps</SectionLabel>
          <div className="space-y-3 mt-1">
            {guide.steps.map((step, i) => {
              const accent = STEP_ACCENTS[i % STEP_ACCENTS.length]
              const num = step.order ?? i + 1
              return (
                <div key={num} className="flex gap-4 group">
                  <div className={`w-10 h-10 rounded-xl border-2 ${accent.border} ${accent.bg} flex items-center justify-center text-sm font-bold ${accent.text} shrink-0 transition-all group-hover:scale-105`}>
                    {num}
                  </div>
                  <div className="flex-1 min-w-0 rounded-2xl border border-surface-border bg-surface-card p-5 group-hover:border-surface-border/80 transition-colors">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${accent.text} opacity-70`}>Step {num}</span>
                    <p className="text-sm font-bold text-ink mt-1 mb-2 leading-snug">{step.title}</p>
                    {step.description && (
                      <p className="text-xs text-ink-muted leading-relaxed mb-4">{step.description}</p>
                    )}
                    {step.files && step.files.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {step.files.map(f => (
                          (onAskAI || onCheckImpact) ? (
                            <FileChip
                              key={f}
                              f={f}
                              accent={accent}
                              repoName={repo.name}
                              onAskAI={onAskAI}
                              onCheckImpact={onCheckImpact}
                            />
                          ) : (
                            <span key={f} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${accent.border} ${accent.bg} text-[11px] font-mono ${accent.text}`}>
                              <svg className="w-3 h-3 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                              {f}
                            </span>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Core workflows */}
      {guide.core_workflows && guide.core_workflows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <SectionLabel>Core workflows</SectionLabel>
            <span className="text-[10px] text-ink-subtle font-medium -mt-3">
              {guide.core_workflows.length} flow{guide.core_workflows.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-3">
            {guide.core_workflows.map((wf, i) => (
              <div key={i} className="flex gap-4 items-start px-5 py-4 rounded-2xl bg-surface-card border border-surface-border hover:border-violet-500/30 transition-colors group">
                <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/25 flex items-center justify-center text-[11px] font-bold text-violet-400 shrink-0 mt-0.5 group-hover:bg-violet-500/20 transition-colors">
                  {i + 1}
                </div>
                <p className="text-sm text-ink-muted leading-relaxed flex-1">{wf}</p>
                {onAskAI && (
                  <button
                    onClick={() => onAskAI(`Walk me through the "${wf}" flow in ${repo.name}. Which files are involved and in what order?`)}
                    title="Ask AI about this workflow"
                    className="shrink-0 opacity-0 group-hover:opacity-100 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/25 text-violet-300 text-[10px] font-semibold hover:bg-violet-500/20 transition-all"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
                    </svg>
                    Ask AI
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Combined panel ───────────────────────────────────────────────────────────

export default function UnderstandPanel({ repo, onAskAI, onCheckImpact }: { repo: Repository; onAskAI?: (q: string) => void; onCheckImpact?: (path: string) => void }) {
  return (
    <div className="space-y-10 pb-10">
      <OverviewSection repo={repo} />

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-gradient-to-r from-surface-border/80 to-transparent" />
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-surface-border bg-surface-raised/50">
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Learning Path</span>
        </div>
        <div className="flex-1 h-px bg-gradient-to-l from-surface-border/80 to-transparent" />
      </div>

      <GuideSection repo={repo} onAskAI={onAskAI} onCheckImpact={onCheckImpact} />
    </div>
  )
}
