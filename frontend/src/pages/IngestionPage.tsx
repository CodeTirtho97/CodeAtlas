import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { reposApi } from '../api/repos'
import type { IngestionStatus, Repository } from '../types'
import StageList, { STAGES } from '../components/ingestion/StageList'

function categoriseError(msg: string): {
  icon: React.ReactNode
  title: string
  explanation: string
  action: string
} {
  const m = msg.toLowerCase()

  if (m.includes('not found') || m.includes('public') || m.includes('url')) return {
    icon: (
      <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
    title: 'Repository not accessible',
    explanation: msg,
    action: 'Double-check the GitHub URL and make sure the repository is public.',
  }

  if (m.includes('access denied') || m.includes('permission') || m.includes('authentication')) return {
    icon: (
      <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: 'Access denied',
    explanation: msg,
    action: 'Only public repositories are supported. Private repos cannot be indexed.',
  }

  if (m.includes('empty') || m.includes('no indexable') || m.includes('no code') || m.includes('unsupported')) return {
    icon: (
      <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
      </svg>
    ),
    title: 'Nothing to index',
    explanation: msg,
    action: 'Try a repository with source code in a supported language (JS, TS, Python, Go, Java).',
  }

  if (m.includes('embedding') || m.includes('vector') || m.includes('gemini') || m.includes('unavailable') || m.includes('temporarily')) return {
    icon: (
      <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    title: 'Service temporarily unavailable',
    explanation: msg,
    action: 'This is a temporary issue on our end. Wait a minute and try again.',
  }

  if (m.includes('timeout') || m.includes('timed out') || m.includes('connection')) return {
    icon: (
      <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Connection timed out',
    explanation: msg,
    action: 'The request took too long. Try again — it usually works on a second attempt.',
  }

  return {
    icon: (
      <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    ),
    title: 'Indexing failed',
    explanation: msg,
    action: 'Something went wrong on our end. Please try again.',
  }
}

function ErrorCard({ message, repoShortName }: { message: string; repoShortName: string | null }) {
  const { icon, title, explanation, action } = categoriseError(message)
  return (
    <div className="py-2">
      {/* Icon */}
      <div className="w-12 h-12 rounded-2xl bg-red-500/8 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      {/* Title */}
      <h2 className="text-sm font-bold text-ink text-center mb-1">{title}</h2>
      {repoShortName && (
        <p className="text-[10px] font-mono text-ink-subtle/50 text-center mb-3">{repoShortName}</p>
      )}
      {/* Explanation */}
      <p className="text-xs text-ink-muted leading-relaxed text-center mb-3">{explanation}</p>
      {/* What to do */}
      <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2.5 mb-5">
        <svg className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <p className="text-[11px] text-amber-300/90 leading-relaxed">{action}</p>
      </div>
      {/* Actions */}
      <div className="flex gap-2">
        <Link
          to="/"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-surface-border/60 bg-surface-raised/40 hover:bg-surface-raised text-xs font-medium text-ink-muted hover:text-ink transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>
        <Link
          to="/"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/30 text-xs font-semibold text-accent transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Try again
        </Link>
      </div>
    </div>
  )
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
}

export default function IngestionPage() {
  const { jobId, repoId } = useParams<{ jobId: string; repoId: string }>()
  const navigate = useNavigate()

  const [status, setStatus]               = useState<IngestionStatus | null>(null)
  const [fatalError, setFatalError]       = useState<string | null>(null)
  const [cancelled, setCancelled]         = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling]       = useState(false)
  const [repo, setRepo]                   = useState<Repository | null>(null)
  const [elapsed, setElapsed]             = useState(0)
  const [displayPct, setDisplayPct]       = useState(0)

  const navigatedRef    = useRef(false)
  const intervalRef     = useRef<number | null>(null)
  const startTimeRef    = useRef<number | null>(null)
  const elapsedTimerRef = useRef<number | null>(null)
  const targetPctRef    = useRef(0)
  const displayPctRef   = useRef(0)

  // Fetch repo identity on mount
  useEffect(() => {
    if (!repoId) return
    reposApi.get(repoId).then(setRepo).catch(() => {})
  }, [repoId])

  // Elapsed timer
  useEffect(() => {
    elapsedTimerRef.current = window.setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
    }, 1000)
    return () => { if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current) }
  }, [])

  // Smooth animated percentage counter
  useEffect(() => {
    const anim = window.setInterval(() => {
      if (displayPctRef.current < targetPctRef.current) {
        const step = Math.max(1, Math.ceil((targetPctRef.current - displayPctRef.current) / 6))
        const next = Math.min(displayPctRef.current + step, targetPctRef.current)
        displayPctRef.current = next
        setDisplayPct(next)
      }
    }, 50)
    return () => clearInterval(anim)
  }, [])

  // Polling
  useEffect(() => {
    const poll = async () => {
      if (!jobId || navigatedRef.current) return
      try {
        const s = await reposApi.getIngestionStatus(jobId)
        setStatus(s)

        if (startTimeRef.current === null) startTimeRef.current = Date.now()
        targetPctRef.current = s.progress_pct

        if (s.status === 'cancelled') {
          clearInterval(intervalRef.current!)
          setCancelled(true)
        } else if (s.status === 'completed' && !navigatedRef.current) {
          navigatedRef.current = true
          clearInterval(intervalRef.current!)
          targetPctRef.current = displayPctRef.current = 100
          setDisplayPct(100)
          if (repoId) { try { const r = await reposApi.get(repoId); setRepo(r) } catch {} }
          setTimeout(() => navigate(`/dashboard/${repoId}`, { replace: true }), 3200)
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

  const handleCancel = async () => {
    if (!jobId || cancelling) return
    setCancelling(true)
    try {
      await reposApi.cancelIngestion(jobId)
      clearInterval(intervalRef.current!)
      setCancelled(true)
    } catch {
      // If cancel fails, polling will still pick up the cancelled status
    } finally {
      setCancelling(false)
      setConfirmCancel(false)
    }
  }

  const pct       = status?.progress_pct ?? 0
  const completed = status?.status === 'completed'
  const isRunning = !completed && !fatalError && !cancelled
  const message   = status?.progress_message ?? 'Queuing…'
  const activeIdx = completed
    ? STAGES.length
    : (STAGES.findIndex(s => pct < s.maxPct) === -1 ? STAGES.length - 1 : STAGES.findIndex(s => pct < s.maxPct))

  const repoShortName   = repo?.github_url?.replace('https://github.com/', '') ?? null
  const repoDisplayName = repoShortName?.split('/')[1] ?? repoShortName

  // ── Cancelled state ────────────────────────────────────────────────────────
  if (cancelled) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-raised border border-surface-border/60 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-ink-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-ink mb-2">Indexing cancelled</h1>
          <p className="text-sm text-ink-muted leading-relaxed mb-2">
            The pipeline was stopped and your repository slot has been freed.
          </p>
          {repoShortName && (
            <p className="text-[11px] font-mono text-ink-subtle/60 mb-6">{repoShortName}</p>
          )}
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface-raised hover:bg-surface-border border border-surface-border/60 text-sm font-medium text-ink transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">

      {/* ── Branding ── */}
      <div className="mb-6 text-center select-none">
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-7 h-7 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            {isRunning && <span className="absolute inset-0 rounded-2xl border border-accent/40 animate-ping opacity-25" />}
            {completed && <span className="absolute inset-0 rounded-2xl border-2 border-emerald-500/50" />}
          </div>
        </div>
        <h1 className="text-xl font-semibold text-ink">Analyzing repository</h1>
        <p className="text-sm text-ink-muted mt-1">Building your knowledge base — usually 2–5 minutes</p>
      </div>

      {/* ── Repo identity card ── */}
      {repoShortName && (
        <div className="w-full max-w-md mb-4 px-4 py-3 rounded-xl bg-surface-raised/50 border border-surface-border/50 flex items-center gap-3 animate-fade-in">
          <div className="w-8 h-8 rounded-lg bg-surface-raised border border-surface-border/50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-ink-subtle/60" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink truncate">{repoDisplayName}</p>
            <p className="text-[11px] text-ink-subtle/70 font-mono truncate">{repoShortName}</p>
          </div>
          <div className={`shrink-0 flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-lg border ${
            completed  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : fatalError ? 'bg-red-500/10 text-red-400 border-red-500/20'
            : 'bg-accent/10 text-accent border-accent/20'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${completed ? 'bg-emerald-400' : fatalError ? 'bg-red-400' : 'bg-accent animate-pulse'}`} />
            {completed ? 'Indexed' : fatalError ? 'Failed' : 'Indexing…'}
          </div>
        </div>
      )}

      {/* ── Main progress card ── */}
      <div className="w-full max-w-md card p-5">
        {!fatalError ? (
          <>
            <div className="flex items-center justify-between mb-2 gap-3">
              <span className="text-xs text-ink-muted truncate flex-1">
                {completed ? 'Analysis complete — redirecting…' : message}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {isRunning && elapsed > 0 && (
                  <span className="text-[10px] text-ink-subtle/60 font-mono tabular-nums">{formatElapsed(elapsed)}</span>
                )}
                <span className={`text-sm font-mono font-bold tabular-nums transition-colors duration-300 ${completed ? 'text-emerald-400' : 'text-accent'}`}>
                  {displayPct}%
                </span>
              </div>
            </div>

            <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden mb-5">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${completed ? 'bg-emerald-500' : 'bg-accent'}`}
                style={{ width: `${Math.max(displayPct, 2)}%` }}
              />
            </div>

            <StageList activeIdx={activeIdx} completed={completed} />

            {/* Completion summary */}
            {completed && (
              <div className="mt-5 pt-4 border-t border-surface-border/40 animate-fade-in">
                <div className="flex items-center justify-center gap-2.5 mb-4">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-ink">Knowledge base built!</p>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="rounded-lg bg-surface-raised/50 border border-surface-border/50 px-2 py-2.5 text-center">
                    <p className="text-base font-bold text-ink tabular-nums">{repo?.chunk_count ? repo.chunk_count.toLocaleString() : '—'}</p>
                    <p className="text-[9px] text-ink-subtle uppercase tracking-wider mt-0.5">Chunks</p>
                  </div>
                  <div className="rounded-lg bg-surface-raised/50 border border-surface-border/50 px-2 py-2.5 text-center">
                    <p className="text-base font-bold text-ink tabular-nums">{formatElapsed(elapsed)}</p>
                    <p className="text-[9px] text-ink-subtle uppercase tracking-wider mt-0.5">Time</p>
                  </div>
                  <div className="rounded-lg bg-surface-raised/50 border border-surface-border/50 px-2 py-2.5 text-center">
                    <p className="text-base font-bold text-ink">{STAGES.length}/{STAGES.length}</p>
                    <p className="text-[9px] text-ink-subtle uppercase tracking-wider mt-0.5">Stages</p>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-ink-muted">
                  <svg className="w-3.5 h-3.5 animate-spin text-accent shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading dashboard…
                </div>
              </div>
            )}
          </>
        ) : (
          <ErrorCard message={fatalError!} repoShortName={repoShortName} />
        )}
      </div>

      {/* ── Cancel button — shown below the card while running ── */}
      {isRunning && (
        <div className="w-full max-w-md mt-4">
          {!confirmCancel ? (
            <button
              onClick={() => setConfirmCancel(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-surface-border/50 text-xs font-medium text-ink-subtle hover:text-red-400 hover:border-red-500/50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel indexing
            </button>
          ) : (
            <div className="rounded-xl border border-surface-border/60 bg-surface-raised/40 px-4 py-3.5 animate-fade-in">
              <p className="text-xs font-semibold text-ink mb-0.5">Stop indexing?</p>
              <p className="text-[11px] text-ink-muted mb-3 leading-relaxed">
                The pipeline will be stopped and your repository slot will be freed immediately.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-semibold text-red-400 transition-colors disabled:opacity-50"
                >
                  {cancelling ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {cancelling ? 'Stopping…' : 'Yes, stop it'}
                </button>
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="flex-1 py-2 rounded-lg border border-surface-border/60 text-xs font-medium text-ink-muted hover:text-ink hover:border-surface-border transition-colors"
                >
                  Keep going
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
