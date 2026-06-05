import { useEffect, useState } from 'react'

export const STAGES: { label: string; detail: string; context: string; maxPct: number }[] = [
  {
    label: 'Cloning repository',
    detail: 'Fetching source code from GitHub',
    context: 'We download a clean snapshot of your repo so every file can be read and indexed without needing your credentials again.',
    maxPct: 15,
  },
  {
    label: 'Parsing code',
    detail: 'AST analysis with Tree-sitter',
    context: 'Tree-sitter parses each file into an abstract syntax tree, extracting exact function, class, and module boundaries with precise line numbers.',
    maxPct: 50,
  },
  {
    label: 'Generating embeddings',
    detail: 'Vectorising chunks via Google AI',
    context: 'Each code chunk is turned into a vector so the AI finds semantically related code — not just keyword matches.',
    maxPct: 75,
  },
  {
    label: 'Indexing to Qdrant',
    detail: 'Storing vectors + dependency graph',
    context: 'Vectors and file dependency relationships are stored in Qdrant, enabling fast hybrid search across your entire codebase.',
    maxPct: 88,
  },
  {
    label: 'Generating insights',
    detail: 'LLM summary · onboarding · endpoints',
    context: 'An LLM reads the parsed structure to write a plain-English summary, onboarding guide, and a complete map of every API endpoint.',
    maxPct: 100,
  },
]

const STAGE_ICONS = [
  // Clone
  <svg key="clone" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>,
  // Parse
  <svg key="parse" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
  </svg>,
  // Embed
  <svg key="embed" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
  </svg>,
  // Index
  <svg key="index" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
  </svg>,
  // Insights
  <svg key="insights" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>,
]

interface Props {
  activeIdx: number
  completed: boolean
}

export default function StageList({ activeIdx, completed }: Props) {
  const [cascading, setCascading] = useState(false)

  useEffect(() => {
    if (completed) {
      const t = setTimeout(() => setCascading(true), 80)
      return () => clearTimeout(t)
    } else {
      setCascading(false)
    }
  }, [completed])

  return (
    <div className="relative">
      <style>{`
        @keyframes stageShimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        @keyframes checkPop {
          0%   { transform: scale(0);    opacity: 0; }
          55%  { transform: scale(1.28); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes connectorFill {
          from { transform: scaleY(0); }
          to   { transform: scaleY(1); }
        }
      `}</style>

      {STAGES.map((stage, i) => {
        const isDone    = completed || i < activeIdx
        const isActive  = !completed && i === activeIdx
        const isLast    = i === STAGES.length - 1
        const connectorFilled = completed || i < activeIdx

        return (
          <div key={stage.label} className="flex gap-3">

            {/* ── Left: icon + connector ── */}
            <div className="flex flex-col items-center" style={{ width: 24, minWidth: 24 }}>
              {/* Stage icon / status indicator */}
              <div className="relative z-10 shrink-0">
                {isDone ? (
                  <div
                    className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center"
                    style={cascading ? {
                      animationName: 'checkPop',
                      animationDuration: '0.35s',
                      animationTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                      animationDelay: `${i * 90}ms`,
                      animationFillMode: 'backwards',
                    } : undefined}
                  >
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : isActive ? (
                  <div className="relative">
                    <div className="w-6 h-6 rounded-full bg-accent/15 border-2 border-accent/50 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    </div>
                    <span
                      className="absolute inset-0 rounded-full border border-accent/50 animate-ping"
                      style={{ opacity: 0.35 }}
                    />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-surface-raised border border-surface-border/50 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-ink-subtle/30" />
                  </div>
                )}
              </div>

              {/* Connector line to next stage */}
              {!isLast && (
                <div className="flex-1 w-0.5 my-1.5 rounded-full bg-surface-border/40 relative overflow-hidden" style={{ minHeight: 16 }}>
                  <div
                    className={`absolute inset-0 rounded-full origin-top transition-transform duration-700 ease-in-out ${
                      connectorFilled ? 'bg-emerald-500/60' : 'bg-transparent'
                    }`}
                    style={{ transform: connectorFilled ? 'scaleY(1)' : 'scaleY(0)' }}
                  />
                </div>
              )}
            </div>

            {/* ── Right: content ── */}
            <div className={`flex-1 min-w-0 ${!isLast ? 'pb-4' : 'pb-0'}`}>
              {isActive ? (
                /* Active stage — spotlight card */
                <div
                  className="relative rounded-xl border border-accent/25 bg-accent/[0.06] p-3.5 overflow-hidden"
                  style={{ boxShadow: '0 0 20px rgba(47,129,247,0.07), 0 0 0 1px rgba(47,129,247,0.10)' }}
                >
                  {/* Shimmer sweep */}
                  <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                    <div
                      className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
                      style={{ animation: 'stageShimmer 2.6s ease-in-out infinite', left: '-33%' }}
                    />
                  </div>

                  <div className="relative">
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-accent/60">{STAGE_ICONS[i]}</span>
                        <p className="text-sm font-semibold text-ink">{stage.label}</p>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20 animate-pulse">
                        running
                      </span>
                    </div>
                    {/* Technical detail */}
                    <p className="text-[11px] text-accent/55 font-mono mb-2.5">{stage.detail}</p>
                    {/* Plain-English context */}
                    <p className="text-[11px] text-ink-muted leading-relaxed border-t border-accent/10 pt-2.5">
                      {stage.context}
                    </p>
                  </div>
                </div>
              ) : (
                /* Done or pending — compact row */
                <div className="flex items-center gap-2 h-6">
                  <span className={isDone ? 'text-emerald-500/50' : 'text-ink-subtle/25'}>
                    {STAGE_ICONS[i]}
                  </span>
                  <p className={`text-sm font-medium transition-colors duration-300 ${
                    isDone ? 'text-emerald-400/75' : 'text-ink-subtle/40'
                  }`}>
                    {stage.label}
                  </p>
                </div>
              )}
            </div>

          </div>
        )
      })}
    </div>
  )
}
