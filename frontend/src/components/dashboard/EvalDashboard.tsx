import { useState, useEffect } from 'react'
import { reposApi } from '../../api/repos'
import type { EvalReport, QuestionResult } from '../../types'
import Spinner from '../Spinner'

// ─── Health grade ─────────────────────────────────────────────────────────────

function getHealthGrade(recallPct: number): {
  grade: string
  label: string
  color: string
  barColor: string
  headline: string
  what_it_means: string
  action: string | null
} {
  if (recallPct >= 90) return {
    grade: 'A',
    label: 'Excellent',
    color: 'text-emerald-400',
    barColor: 'bg-emerald-500',
    headline: 'AI answers are well-grounded in your code.',
    what_it_means: 'When you ask a question about your codebase, the AI finds the right source file almost every time. You can trust the answers it gives.',
    action: null,
  }
  if (recallPct >= 75) return {
    grade: 'B',
    label: 'Good',
    color: 'text-blue-400',
    barColor: 'bg-blue-500',
    headline: 'AI answers are mostly reliable.',
    what_it_means: 'The AI finds the right code most of the time. A few edge cases may produce less accurate answers — check the failed tests below to see which endpoints.',
    action: 'Review the failed tests below to see which endpoints are missing.',
  }
  if (recallPct >= 60) return {
    grade: 'C',
    label: 'Fair',
    color: 'text-amber-400',
    barColor: 'bg-amber-400',
    headline: 'AI answers may sometimes be off.',
    what_it_means: 'The AI is finding the right code about two-thirds of the time. Answers about missed endpoints may be vague or incorrect.',
    action: 'Try re-indexing the repo. If it persists, some files may not have been indexed.',
  }
  if (recallPct >= 40) return {
    grade: 'D',
    label: 'Poor',
    color: 'text-orange-400',
    barColor: 'bg-orange-400',
    headline: 'AI answers are frequently unreliable.',
    what_it_means: 'The AI is struggling to find the right source files for many questions. Answers may be guessed rather than grounded in real code.',
    action: 'Re-index the repository. If the problem continues, check that the repo was cloned successfully.',
  }
  return {
    grade: 'F',
    label: 'Critical',
    color: 'text-red-400',
    barColor: 'bg-red-500',
    headline: 'AI answers cannot be trusted.',
    what_it_means: 'The index is either empty or broken. Almost none of the questions are finding the right code, so answers are likely hallucinated.',
    action: 'Delete and re-index the repository. Check that indexing completed without errors.',
  }
}

// ─── Metric card ─────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, color, hint,
}: { label: string; value: string; sub: string; color: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-card p-5 flex flex-col gap-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-ink-subtle">{label}</p>
      <p className={`text-3xl font-bold leading-none ${color}`}>{value}</p>
      <p className="text-xs text-ink-muted">{sub}</p>
      {hint && <p className="text-[10px] text-ink-subtle leading-relaxed border-t border-surface-border/50 pt-2 mt-0.5">{hint}</p>}
    </div>
  )
}

// ─── Question row ─────────────────────────────────────────────────────────────

function QuestionRow({ r }: { r: QuestionResult }) {
  const [expanded, setExpanded] = useState(false)

  const rankLabel = r.hit && r.rank
    ? r.rank === 1 ? 'found immediately' : `found at result #${r.rank}`
    : 'not found'

  return (
    <div className={`border-b border-surface-border/40 last:border-0 transition-colors ${!r.hit ? 'hover:bg-red-500/3' : 'hover:bg-surface-raised/20'}`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-3 px-5 py-3.5 text-left"
      >
        <div className="mt-0.5 shrink-0">
          {r.hit ? (
            <span className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </span>
          ) : (
            <span className="w-5 h-5 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[10px] font-bold bg-surface-raised border border-surface-border text-ink-muted px-2 py-0.5 rounded font-mono">
              {r.endpoint}
            </span>
            <span className={`text-[10px] font-semibold ${r.hit ? 'text-emerald-400' : 'text-red-400'}`}>
              {rankLabel}
            </span>
          </div>
          <p className="text-xs text-ink-muted">
            Asked about <span className="font-medium text-ink">{r.endpoint}</span> — expected AI to find <code className="text-[11px] bg-surface-raised px-1 py-0.5 rounded">{r.expected_file.split('/').pop()}</code>
          </p>
        </div>

        <svg className={`w-3.5 h-3.5 text-ink-subtle shrink-0 transition-transform mt-1 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mx-5 mb-3 rounded-xl border border-surface-border bg-surface-raised/30 p-4 space-y-3 animate-fade-in">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-subtle mb-1">What the AI was asked</p>
            <p className="text-xs text-ink-muted italic">"{r.question}"</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-subtle mb-1">Correct file</p>
              <code className={`text-[11px] font-mono ${r.hit ? 'text-emerald-400' : 'text-red-400'}`}>{r.expected_file}</code>
            </div>
            {r.retrieved_files && r.retrieved_files.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ink-subtle mb-1">What AI actually looked at</p>
                <div className="space-y-0.5">
                  {r.retrieved_files.slice(0, 5).map((f, i) => (
                    <code key={i} className={`text-[11px] font-mono block truncate ${f === r.expected_file ? 'text-emerald-400' : 'text-ink-subtle'}`}>
                      {i + 1}. {f}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EvalDashboard({ repoId }: { repoId: string }) {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<EvalReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noEndpoints, setNoEndpoints] = useState(false)
  const [initialising, setInitialising] = useState(true)

  const isNoEndpointsError = (msg: string) =>
    msg.toLowerCase().includes('no api endpoints') || msg.toLowerCase().includes('cannot build')

  // On first mount: load cached result; if none exists, auto-trigger the run
  useEffect(() => {
    const init = async () => {
      try {
        const cached = await reposApi.getEvalResult(repoId)
        if (cached) {
          setReport(cached)
          setInitialising(false)
        } else {
          setInitialising(false)
          setLoading(true)
          try {
            const data = await reposApi.runEval(repoId)
            setReport(data)
          } catch (e: any) {
            const msg = e.response?.data?.detail ?? 'Evaluation failed. Please try again.'
            if (isNoEndpointsError(msg)) setNoEndpoints(true)
            else setError(msg)
          } finally {
            setLoading(false)
          }
        }
      } catch {
        setInitialising(false)
      }
    }
    init()
  }, [repoId])

  const handleRerun = async () => {
    setLoading(true)
    setError(null)
    setNoEndpoints(false)
    try {
      const data = await reposApi.runEval(repoId)
      setReport(data)
    } catch (e: any) {
      const msg = e.response?.data?.detail ?? 'Evaluation failed. Please try again.'
      if (isNoEndpointsError(msg)) setNoEndpoints(true)
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const recallPct = report ? Math.round(report.recall_at_5 * 100) : null
  const health = recallPct !== null ? getHealthGrade(recallPct) : null

  const failedResults = report ? report.results.filter(r => !r.hit) : []
  const passedResults = report ? report.results.filter(r => r.hit) : []

  // "Gets it first try" = fraction of hits that landed at rank 1
  const firstTryPct = report && report.passed > 0
    ? Math.round((report.results.filter(r => r.rank === 1).length / report.total_questions) * 100)
    : 0

  if (initialising) return (
    <div className="flex items-center justify-center py-20">
      <Spinner size="md" />
    </div>
  )

  if (noEndpoints) return (
    <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-surface-raised border border-surface-border/60 flex items-center justify-center mb-5">
        <svg className="w-7 h-7 text-ink-subtle/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
        </svg>
      </div>
      <h2 className="text-sm font-semibold text-ink mb-2">Not applicable for this project</h2>
      <p className="text-xs text-ink-muted leading-relaxed mb-4">
        Quality evaluation works by testing whether the AI can find the right file for each API endpoint. This repository has no detected API endpoints — it's likely a frontend, library, or documentation-only project.
      </p>
      <div className="w-full rounded-xl bg-surface-raised/50 border border-surface-border/50 px-4 py-3 text-left mb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-subtle mb-1.5">What you can do instead</p>
        <ul className="space-y-1.5">
          {[
            'Use Ask AI to explore how the codebase is structured',
            'Check Understand for a learning path through the code',
            'Use Explore to browse files and dependencies',
          ].map(tip => (
            <li key={tip} className="flex items-start gap-2 text-[11px] text-ink-muted">
              <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-[10px] text-ink-subtle/50">
        Evaluation is designed for backend services with identifiable API routes.
      </p>
    </div>
  )

  return (
    <div className="space-y-6 pb-10">

      {/* ── Header card ── */}
      <div className="rounded-2xl border border-surface-border bg-surface-card p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-ink">AI Answer Quality Check</h3>
            <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
              Tests whether the AI can find the right source code when you ask questions about this repo.
              Uses your API endpoints as test cases — each one has a known correct file, so we can
              measure how often the AI looks in the right place.
            </p>
            {report?.ran_at && (
              <p className="text-[10px] text-ink-subtle mt-1.5">
                Last run: {new Date(report.ran_at).toLocaleString()}
              </p>
            )}
          </div>
          {report && (
            <button
              onClick={handleRerun}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-2 shrink-0"
            >
              {loading
                ? <Spinner size="sm" className="border-white/40 border-t-white" />
                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
              }
              {loading ? 'Testing…' : 'Re-Evaluate'}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-400 mt-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
        {loading && (
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
            <span className="inline-flex gap-0.5">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
            Asking questions and checking the results…
          </div>
        )}
      </div>

      {report && health && recallPct !== null && (
        <>
          {/* ── Health hero ── */}
          <div className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className={`text-6xl font-black leading-none ${health.color} tabular-nums`}>
                    {health.grade}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ink-subtle">Answer Quality</p>
                    <p className={`text-2xl font-bold mt-1 ${health.color}`}>{health.label}</p>
                    <p className="text-xs text-ink-muted mt-1 max-w-sm leading-relaxed">{health.headline}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-4xl font-bold tabular-nums ${health.color}`}>{recallPct}%</p>
                  <p className="text-[10px] text-ink-subtle mt-1">found the right file</p>
                </div>
              </div>

              {/* Plain English explanation */}
              <div className="mt-4 rounded-xl bg-surface-raised/50 border border-surface-border/50 px-4 py-3">
                <p className="text-xs text-ink-muted leading-relaxed">{health.what_it_means}</p>
                {health.action && (
                  <p className="text-xs text-amber-400 mt-2 font-medium">
                    → {health.action}
                  </p>
                )}
              </div>

              {/* Health bar */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-[10px] text-ink-subtle mb-1.5">
                  <span>0%</span>
                  <div className="flex gap-4">
                    <span className="text-red-400">F &lt;40</span>
                    <span className="text-orange-400">D 40–59</span>
                    <span className="text-amber-400">C 60–74</span>
                    <span className="text-blue-400">B 75–89</span>
                    <span className="text-emerald-400">A ≥90</span>
                  </div>
                  <span>100%</span>
                </div>
                <div className="relative h-3 w-full rounded-full bg-surface-raised overflow-hidden">
                  <div className="absolute inset-0 flex">
                    <div className="h-full bg-red-500/15" style={{ width: '40%' }} />
                    <div className="h-full bg-orange-400/15" style={{ width: '20%' }} />
                    <div className="h-full bg-amber-400/15" style={{ width: '15%' }} />
                    <div className="h-full bg-blue-500/15" style={{ width: '15%' }} />
                    <div className="h-full bg-emerald-500/15 flex-1" />
                  </div>
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full ${health.barColor} transition-all duration-700 ease-out`}
                    style={{ width: `${recallPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Metrics ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="Finds Right File"
              value={`${recallPct}%`}
              sub="of questions answered correctly"
              color={health.color}
              hint="When you ask about an endpoint, does the AI look at the file that actually implements it?"
            />
            <MetricCard
              label="Gets It First"
              value={`${firstTryPct}%`}
              sub="right file was the top result"
              color={firstTryPct >= 60 ? 'text-emerald-400' : firstTryPct >= 40 ? 'text-amber-400' : 'text-red-400'}
              hint="Higher means the AI's first instinct is correct — answers will be more focused and direct."
            />
            <MetricCard
              label="Passed"
              value={`${report.passed}/${report.total_questions}`}
              sub="test cases"
              color="text-ink"
              hint={report.passed === report.total_questions
                ? 'All tests passed.'
                : `${report.total_questions - report.passed} endpoint${report.total_questions - report.passed !== 1 ? 's' : ''} not found correctly.`}
            />
            <MetricCard
              label="Tests Run"
              value={String(report.total_questions)}
              sub="API endpoints tested"
              color="text-ink"
              hint="Each test asks a natural-language question about one of your API endpoints and checks whether the AI finds the right file."
            />
          </div>

          {/* ── Failed questions ── */}
          {failedResults.length > 0 && (
            <div className="rounded-2xl border border-red-500/20 bg-surface-card overflow-hidden">
              <div className="px-5 py-3 border-b border-red-500/20 bg-red-500/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <p className="text-xs font-semibold text-ink">Missed</p>
                  <span className="text-[10px] text-red-400 font-bold">{failedResults.length}</span>
                </div>
                <p className="text-[10px] text-ink-muted">AI couldn't find the right file for these endpoints</p>
              </div>
              <div className="divide-y divide-surface-border/40">
                {failedResults.map((r, i) => <QuestionRow key={i} r={r} />)}
              </div>
            </div>
          )}

          {/* ── Passed questions ── */}
          {passedResults.length > 0 && (
            <div className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden">
              <div className="px-5 py-3 border-b border-surface-border bg-surface-raised/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <p className="text-xs font-semibold text-ink">Passed</p>
                  <span className="text-[10px] text-emerald-400 font-bold">{passedResults.length}</span>
                </div>
                <p className="text-[10px] text-ink-muted">Right file found within top 5 results</p>
              </div>
              <div className="divide-y divide-surface-border/40">
                {passedResults.map((r, i) => <QuestionRow key={i} r={r} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
