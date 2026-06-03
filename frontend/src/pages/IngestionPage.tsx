import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { reposApi } from '../api/repos'
import type { IngestionStatus } from '../types'

const STAGES: { label: string; detail: string; maxPct: number }[] = [
  { label: 'Cloning repository',      detail: 'Fetching source code from GitHub',       maxPct: 15  },
  { label: 'Parsing code',            detail: 'AST analysis with Tree-sitter',           maxPct: 50  },
  { label: 'Generating embeddings',   detail: 'Vectorising chunks via Google AI',        maxPct: 75  },
  { label: 'Indexing to Qdrant',      detail: 'Storing vectors + dependency graph',      maxPct: 88  },
  { label: 'Generating insights',     detail: 'LLM summary · onboarding · endpoints',   maxPct: 100 },
]

function StageRow({
  label,
  detail,
  done,
  active,
}: {
  label: string
  detail: string
  done: boolean
  active: boolean
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${
        active ? 'bg-accent/10 border border-accent/20' : ''
      }`}
    >
      {/* Status indicator */}
      <div className="shrink-0 w-5 h-5 flex items-center justify-center">
        {done ? (
          /* Solid green check */
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : active ? (
          /* Spinning arc ring */
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 20 20" fill="none">
            {/* Track */}
            <circle cx="10" cy="10" r="8" stroke="#2F81F7" strokeOpacity="0.2" strokeWidth="2" />
            {/* Arc — roughly 75% of the circle */}
            <path
              d="M10 2 a8 8 0 1 1 -7.6 5.6"
              stroke="#2F81F7"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        ) : (
          /* Inactive dot */
          <div className="w-5 h-5 rounded-full bg-surface-raised flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-ink-subtle rounded-full" />
          </div>
        )}
      </div>

      {/* Labels */}
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium transition-colors duration-300 ${
          done   ? 'text-emerald-400 line-through decoration-emerald-400/40' :
          active ? 'text-ink'                                                 :
                   'text-ink-subtle'
        }`}>
          {label}
        </p>
        {active && (
          <p className="text-xs text-ink-muted mt-0.5 animate-fade-in">{detail}</p>
        )}
      </div>

      {/* Active stage badge */}
      {active && (
        <span className="shrink-0 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20 animate-fade-in">
          running
        </span>
      )}
    </div>
  )
}

export default function IngestionPage() {
  const { jobId, repoId } = useParams<{ jobId: string; repoId: string }>()
  const navigate = useNavigate()
  const [status, setStatus] = useState<IngestionStatus | null>(null)
  const [fatalError, setFatalError] = useState<string | null>(null)
  const navigatedRef = useRef(false)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    const poll = async () => {
      if (!jobId || navigatedRef.current) return
      try {
        const s = await reposApi.getIngestionStatus(jobId)
        setStatus(s)

        if (s.status === 'completed' && !navigatedRef.current) {
          navigatedRef.current = true
          clearInterval(intervalRef.current!)
          setTimeout(() => navigate(`/dashboard/${repoId}`, { replace: true }), 900)
        } else if (s.status === 'failed') {
          clearInterval(intervalRef.current!)
          setFatalError(s.error || 'Ingestion failed. Please try again.')
        }
      } catch {
        clearInterval(intervalRef.current!)
        setFatalError('Lost connection to server. Refresh the page to retry.')
      }
    }

    poll()
    intervalRef.current = window.setInterval(poll, 2000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [jobId, repoId, navigate])

  const pct       = status?.progress_pct ?? 0
  const completed = status?.status === 'completed'
  const message   = status?.progress_message ?? 'Queuing...'

  // Determine which stage is active
  const activeIdx = completed
    ? STAGES.length           // everything done
    : (STAGES.findIndex(s => pct < s.maxPct) === -1 ? STAGES.length - 1 : STAGES.findIndex(s => pct < s.maxPct))

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">

      {/* Branding */}
      <div className="mb-8 text-center select-none">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            {!fatalError && !completed && (
              <span className="absolute inset-0 rounded-2xl border border-accent/40 animate-ping opacity-25" />
            )}
          </div>
        </div>
        <h1 className="text-xl font-semibold text-ink">Analyzing repository</h1>
        <p className="text-sm text-ink-muted mt-1">Building your knowledge base — usually 2–5 minutes</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-md card p-5">
        {!fatalError ? (
          <>
            {/* Progress header */}
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs text-ink-muted truncate pr-3">
                {completed ? 'Analysis complete — redirecting…' : message}
              </span>
              <span className={`text-sm font-mono font-semibold shrink-0 ${
                completed ? 'text-emerald-400' : 'text-ink'
              }`}>
                {pct}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden mb-5">
              <div
                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                  completed ? 'bg-emerald-500' : 'bg-accent'
                }`}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>

            {/* Stages */}
            <div className="space-y-1">
              {STAGES.map((stage, i) => (
                <StageRow
                  key={stage.label}
                  label={stage.label}
                  detail={stage.detail}
                  done={i < activeIdx || completed}
                  active={i === activeIdx && !completed}
                />
              ))}
            </div>

            {completed && (
              <div className="mt-4 flex items-center justify-center gap-2 py-2 text-sm text-emerald-400 animate-fade-in">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Dashboard loading…
              </div>
            )}
          </>
        ) : (
          /* Error state */
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-ink mb-1">Ingestion failed</h2>
            <p className="text-xs text-ink-muted mb-6 leading-relaxed">{fatalError}</p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-raised hover:bg-surface-border text-sm text-ink transition-colors"
            >
              ← Back to home
            </Link>
          </div>
        )}
      </div>

      {/* Tip */}
      {!fatalError && !completed && (
        <p className="mt-6 text-xs text-ink-subtle text-center max-w-xs animate-fade-in">
          Large repositories may take longer. You can close this tab and check back later.
        </p>
      )}
    </div>
  )
}
