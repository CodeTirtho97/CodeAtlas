import { useState, useEffect, useRef, useCallback } from 'react'
import { reposApi } from '../../api/repos'
import type { EvalReport, EvalStatus, EvalStep, QuestionResult } from '../../types'
import Spinner from '../Spinner'

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

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
    what_it_means: 'The AI finds the right code most of the time. A few edge cases may produce less accurate answers. Check the failed tests below to see which endpoints.',
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

// ─── Hover tooltip (info icon) ────────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <svg className="w-3 h-3 text-ink-subtle hover:text-ink-muted cursor-help transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 w-52 px-3 py-2 rounded-lg border border-surface-border bg-surface-card shadow-xl text-[10px] font-normal normal-case tracking-normal text-ink-muted leading-relaxed">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45 bg-surface-card border-r border-b border-surface-border" />
        </span>
      )}
    </span>
  )
}

const RECALL_TIP = "How often the correct file shows up anywhere in the AI's top 5 search results. Higher is better."
const MRR_TIP = 'Mean Reciprocal Rank: rewards ranking the correct file higher up. 100% means it was always the #1 result.'

// Plain-words explanation of each retrieval mode, shown on the comparison cards.
const MODE_DESC: Record<string, string> = {
  hybrid: 'Blends keyword and meaning search. Usually the most accurate.',
  dense:  'Searches by meaning using embeddings, finding related concepts rather than exact words.',
  sparse: 'Searches by keywords, matching the exact terms found in your code.',
}

// ─── Question row ─────────────────────────────────────────────────────────────

// HTTP-verb colours so the endpoint chip reads as a live route, not a grey label.
const METHOD_CLR: Record<string, string> = {
  GET:    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  POST:   'bg-blue-500/15 text-blue-300 border-blue-500/30',
  PUT:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
  PATCH:  'bg-purple-500/15 text-purple-300 border-purple-500/30',
  DELETE: 'bg-red-500/15 text-red-300 border-red-500/30',
}
const methodColor = (m: string) =>
  METHOD_CLR[m.toUpperCase()] ?? 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30'

function QuestionRow({ r, onAskAI }: { r: QuestionResult; onAskAI?: (q: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  const rankLabel = r.hit && r.rank
    ? r.rank === 1 ? 'found immediately' : `found at #${r.rank}`
    : 'not found'

  // Endpoint is "METHOD /path" — split so the verb can be colour-coded.
  const sp = r.endpoint.indexOf(' ')
  const method = sp === -1 ? r.endpoint : r.endpoint.slice(0, sp)
  const path = sp === -1 ? '' : r.endpoint.slice(sp + 1)

  return (
    <div className={`border-b border-surface-border/40 last:border-0 transition-colors ${!r.hit ? 'hover:bg-red-500/3' : 'hover:bg-surface-raised/20'}`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 text-left"
      >
        {/* status icon */}
        <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${r.hit ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-red-500/15 border border-red-500/30'}`}>
          {r.hit ? (
            <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </span>

        {/* endpoint chip — coloured method verb + bright path */}
        {r.endpoint && (
          <span className="hidden sm:flex items-center gap-1.5 shrink-0 max-w-[190px]">
            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${methodColor(method)}`}>
              {method}
            </span>
            {path && (
              <code className="text-[11px] font-mono font-semibold text-ink truncate">{path}</code>
            )}
          </span>
        )}

        {/* the question — fills the middle so the row uses the full width */}
        <p className="flex-1 min-w-0 text-xs font-medium italic text-violet-300/70 truncate" title={r.question}>
          {r.question}
        </p>

        {/* expected file — right side, hidden on narrow screens */}
        <span className="hidden md:flex items-center gap-1.5 shrink-0 text-[10px] text-ink-subtle">
          <span className="opacity-70">expects</span>
          <code className="text-[10px] bg-surface-raised border border-surface-border/60 px-1.5 py-0.5 rounded text-ink-muted">
            {r.expected_file.split('/').pop()}
          </code>
        </span>

        {/* status label */}
        <span className={`shrink-0 text-[10px] font-semibold w-[104px] text-right ${r.hit ? 'text-emerald-400' : 'text-red-400'}`}>
          {rankLabel}
        </span>

        {/* Ask AI — misses only */}
        {!r.hit && onAskAI && (
          <button
            onClick={e => { e.stopPropagation(); onAskAI(r.question) }}
            title="Ask AI this question to debug the miss"
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-pink-500/10 border border-pink-500/25 text-pink-300 text-[10px] font-semibold hover:bg-pink-500/20 transition-all"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
            </svg>
            Ask AI
          </button>
        )}

        {/* chevron */}
        <svg className={`w-3.5 h-3.5 text-ink-subtle shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mx-5 mb-3 rounded-xl border border-surface-border bg-surface-raised/30 p-4 space-y-3 animate-fade-in">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-subtle mb-1">What the AI was asked</p>
            <p className="text-xs italic text-violet-300/70">"{r.question}"</p>
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

// ─── Progress stepper ─────────────────────────────────────────────────────────

const EVAL_STEPS: { key: EvalStep; label: string; hint: string }[] = [
  {
    key: 'questions',
    label: 'Building the question set',
    hint: 'Each of your API endpoints becomes a natural-language question with a known correct source file. These are the answer key.',
  },
  {
    key: 'retrieval',
    label: 'Searching the code',
    hint: 'Every question is run through the retriever to see whether the right file shows up in the top 5 results (Recall@5).',
  },
  {
    key: 'ablation',
    label: 'Comparing search modes',
    hint: 'The same questions are replayed through dense, sparse, and hybrid search to prove which retrieval strategy performs best.',
  },
  {
    key: 'generation',
    label: 'Checking answer quality',
    hint: 'For a few sampled questions the AI generates a real answer, and we verify it cites the correct file (citation precision).',
  },
]

const _STEP_ORDER: EvalStep[] = ['questions', 'retrieval', 'ablation', 'generation', 'done']

function EvalProgress({ progress }: { progress: EvalStatus | null }) {
  const pct = progress?.progress_pct ?? 0
  const step = progress?.step ?? 'questions'
  const activeIdx = Math.max(0, _STEP_ORDER.indexOf(step))
  const isDone = step === 'done'

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-card p-6">
      <div className="flex items-center gap-3 mb-1">
        <Spinner size="sm" className="border-violet-400/40 border-t-violet-400" />
        <h3 className="text-sm font-semibold text-ink">Running quality check…</h3>
        <span className="ml-auto text-sm font-bold tabular-nums text-violet-400">{pct}%</span>
      </div>
      <p className="text-[11px] text-ink-subtle leading-relaxed mb-3">
        We probe the retriever with questions built from your API endpoints and measure how
        reliably it surfaces the correct source file. This runs in four stages:
      </p>
      <p className="text-xs font-medium text-violet-300/90 mb-5">
        {progress?.message || 'Starting…'}
      </p>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-surface-raised overflow-hidden mb-6">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-500 ease-out"
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>

      {/* Steps */}
      <ol className="space-y-3">
        {EVAL_STEPS.map((s, i) => {
          const done = isDone || i < activeIdx
          const active = !isDone && i === activeIdx
          return (
            <li key={s.key} className="flex items-start gap-3">
              <span
                className={`mt-0.5 w-5 h-5 shrink-0 rounded-full flex items-center justify-center border transition-colors ${
                  done
                    ? 'bg-emerald-500/15 border-emerald-500/30'
                    : active
                    ? 'bg-violet-500/15 border-violet-500/40'
                    : 'bg-surface-raised border-surface-border'
                }`}
              >
                {done ? (
                  <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : active ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-subtle/40" />
                )}
              </span>
              <div className="min-w-0">
                <p className={`text-xs font-semibold ${done ? 'text-ink-muted' : active ? 'text-ink' : 'text-ink-subtle'}`}>
                  {s.label}
                </p>
                <p className="text-[10px] text-ink-subtle leading-relaxed">{s.hint}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ─── First-run intro (what it does + warning + CTA) ───────────────────────────

function EvalIntro({ onRun }: { onRun: () => void }) {
  return (
    <div className="space-y-5">
      {/* What you'll get */}
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          {
            title: 'A trust score for AI answers',
            body: 'A letter grade (A–F) and a Recall@5 percentage showing how often the AI looks in the right source file when you ask about your code.',
          },
          {
            title: 'Where it falls short',
            body: 'A per-question breakdown of which endpoints the AI found and which it missed, so you know exactly where answers may be unreliable.',
          },
        ].map(c => (
          <div key={c.title} className="rounded-2xl border border-surface-border bg-surface-card p-5">
            <p className="text-sm font-semibold text-ink mb-1.5">{c.title}</p>
            <p className="text-xs text-ink-muted leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="rounded-2xl border border-surface-border bg-surface-card p-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-subtle mb-4">How the check works</p>
        <ol className="space-y-3">
          {EVAL_STEPS.map((s, i) => (
            <li key={s.key} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-lg bg-violet-500/10 border border-violet-500/25 text-violet-300 text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink">{s.label}</p>
                <p className="text-[11px] text-ink-subtle leading-relaxed">{s.hint}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Heads-up before spending API calls */}
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 flex items-start gap-3">
        <svg className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <div>
          <p className="text-xs font-semibold text-amber-300">Before you run it</p>
          <p className="text-[11px] text-ink-muted leading-relaxed mt-0.5">
            A full evaluation takes roughly <span className="font-semibold text-ink">30–60 seconds</span> and makes
            several AI model calls (it asks and answers a handful of questions), so it counts toward your API usage.
            Run it when you actually want a fresh quality check. The result is cached afterward, so you won't need to
            run it again unless the code changes.
          </p>
        </div>
      </div>

      {/* Primary CTA */}
      <div className="flex justify-center pt-1">
        <button
          onClick={onRun}
          className="px-6 py-3 rounded-xl bg-violet-500 hover:bg-violet-400 text-white text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
          </svg>
          Run Evaluation
        </button>
      </div>
    </div>
  )
}

// ─── Re-run confirmation modal ────────────────────────────────────────────────

function RerunConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onCancel])

  const facts: { color: string; icon: React.ReactNode; text: React.ReactNode }[] = [
    {
      color: 'text-blue-400',
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />,
      text: <><span className="font-bold text-blue-300">~30–60 seconds</span> to run.</>,
    },
    {
      color: 'text-violet-400',
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />,
      text: <>Spends <span className="font-bold text-violet-300">several AI API calls</span> from your daily quota.</>,
    },
    {
      color: 'text-amber-400',
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />,
      text: <>If quota runs out, <span className="font-bold text-amber-300">answer-quality scores get skipped</span>.</>,
    },
    {
      color: 'text-emerald-400',
      icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
      text: <>Current results <span className="font-bold text-emerald-300">stay until done</span>, then cached.</>,
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl border border-surface-border bg-surface-card shadow-2xl animate-fade-in">
        <div className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/[0.12] border border-amber-500/25 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-ink">Run the full evaluation again?</h3>
          </div>

          <ul className="mt-4 space-y-2.5">
            {facts.map((f, i) => (
              <li key={i} className="flex items-center gap-2.5">
                <svg className={`w-4 h-4 shrink-0 ${f.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  {f.icon}
                </svg>
                <p className="text-xs text-ink-muted">{f.text}</p>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-end gap-2 mt-5">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-surface-border text-ink-muted hover:text-ink hover:bg-surface-raised text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-400 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              Run anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EvalDashboard({ repoId, onAskAI }: { repoId: string; onAskAI?: (q: string) => void }) {
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<EvalStatus | null>(null)
  const [report, setReport] = useState<EvalReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [noEndpoints, setNoEndpoints] = useState(false)
  const [initialising, setInitialising] = useState(true)
  const [confirmRerun, setConfirmRerun] = useState(false)  // gate Re-Evaluate behind a warning

  // Guards async loops from updating state after unmount / repo switch.
  const cancelledRef = useRef(false)

  const isNoEndpointsError = (msg: string) =>
    msg.toLowerCase().includes('no api endpoints') || msg.toLowerCase().includes('cannot build')

  const POLL_MS = 1500
  const MAX_POLL_MS = 5 * 60 * 1000  // give up after 5 minutes

  // Launch an eval and poll its status until it finishes, streaming progress to the UI.
  const runAndPoll = useCallback(async () => {
    setError(null)
    setNoEndpoints(false)
    setLoading(true)
    setProgress({ status: 'running', progress_pct: 0, step: 'questions', message: 'Starting…' })

    try {
      await reposApi.runEval(repoId)  // launches background job (may 400 if no endpoints)
    } catch (e: any) {
      if (cancelledRef.current) return
      const msg = e.response?.data?.detail || 'Evaluation failed. Please try again.'
      if (isNoEndpointsError(msg)) setNoEndpoints(true)
      else setError(msg)
      setLoading(false)
      setProgress(null)
      return
    }

    const startedAt = Date.now()
    while (!cancelledRef.current) {
      await sleep(POLL_MS)
      if (cancelledRef.current) return

      let st: EvalStatus
      try {
        st = await reposApi.getEvalStatus(repoId)
      } catch {
        // Transient network/poll error — keep trying until the timeout.
        if (Date.now() - startedAt > MAX_POLL_MS) {
          setError('Evaluation timed out. Please try again.')
          break
        }
        continue
      }
      if (cancelledRef.current) return
      setProgress(st)

      if (st.status === 'completed') {
        try {
          const data = await reposApi.getEvalResult(repoId)
          if (!cancelledRef.current && data) setReport(data)
        } catch {
          if (!cancelledRef.current) setError('Evaluation finished but results could not be loaded.')
        }
        break
      }
      if (st.status === 'failed') {
        const msg = st.error || 'Evaluation failed. Please try again.'
        if (isNoEndpointsError(msg)) setNoEndpoints(true)
        else setError(msg)
        break
      }
      if (Date.now() - startedAt > MAX_POLL_MS) {
        setError('Evaluation is taking longer than expected. Please try again.')
        break
      }
    }

    if (!cancelledRef.current) {
      setLoading(false)
      setProgress(null)
    }
  }, [repoId])

  // On (re)mount or repo switch: load any cached result. We do NOT auto-run —
  // an eval is slow and spends API calls, so the user kicks it off explicitly
  // from the intro screen.
  useEffect(() => {
    cancelledRef.current = false
    // Reset state for the new repo
    setReport(null)
    setError(null)
    setNoEndpoints(false)
    setProgress(null)
    setLoading(false)
    setInitialising(true)

    const init = async () => {
      try {
        const cached = await reposApi.getEvalResult(repoId)
        if (cancelledRef.current) return
        if (cached) setReport(cached)
        setInitialising(false)
      } catch {
        if (!cancelledRef.current) setInitialising(false)
      }
    }
    init()

    return () => { cancelledRef.current = true }
  }, [repoId, runAndPoll])

  const handleRerun = () => { setConfirmRerun(false); runAndPoll() }

  const recallPct = report ? Math.round(report.recall_at_5 * 100) : null
  const health = recallPct !== null ? getHealthGrade(recallPct) : null

  // Delta vs the previous run (present once the eval has been run at least twice)
  const prevPct = report?.previous ? Math.round(report.previous.recall_at_5 * 100) : null
  const deltaPts = recallPct !== null && prevPct !== null ? recallPct - prevPct : null
  const prevRanAt = report?.previous?.ran_at
    ? new Date(report.previous.ran_at).toLocaleDateString()
    : null

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
        Quality evaluation works by testing whether the AI can find the right file for each API endpoint. This repository has no detected API endpoints, so it's likely a frontend, library, or documentation-only project.
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
              Uses your API endpoints as test cases. Each one has a known correct file, so we can
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
              onClick={() => setConfirmRerun(true)}
              disabled={loading}
              title="Runs the full check again (takes ~30–60s and uses several AI API calls)"
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
      </div>

      {/* ── First-run intro: explain + warn, hides once a report exists ── */}
      {!report && !loading && <EvalIntro onRun={handleRerun} />}

      {/* ── Live progress (stepped) — centred, ~half width ── */}
      {loading && (
        <div className="flex justify-center">
          <div className="w-full md:w-2/3 lg:w-1/2">
            <EvalProgress progress={progress} />
          </div>
        </div>
      )}

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
                  {deltaPts !== null && (
                    <span
                      title={prevRanAt ? `Previous run: ${prevPct}% on ${prevRanAt}` : `Previous run: ${prevPct}%`}
                      className={`inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full border text-[10px] font-bold tabular-nums ${
                        deltaPts > 0 ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                        : deltaPts < 0 ? 'bg-red-500/10 border-red-500/25 text-red-400'
                        : 'bg-surface-raised border-surface-border text-ink-subtle'
                      }`}
                    >
                      {deltaPts > 0 ? (
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                      ) : deltaPts < 0 ? (
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                      ) : (
                        <span className="font-black leading-none">=</span>
                      )}
                      {deltaPts > 0 ? `+${deltaPts}` : deltaPts} pts vs last run
                    </span>
                  )}
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
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
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
              hint="Higher means the AI's first instinct is correct, so answers will be more focused and direct."
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
            <MetricCard
              label="Citation Precision"
              value={report.citation_precision !== null && report.citation_precision !== undefined
                ? `${Math.round(report.citation_precision * 100)}%`
                : '—'}
              sub="answers cited the right file"
              color={report.citation_precision !== null && report.citation_precision !== undefined
                ? report.citation_precision >= 0.75 ? 'text-emerald-400'
                  : report.citation_precision >= 0.5 ? 'text-amber-400'
                  : 'text-red-400'
                : 'text-ink-subtle'}
              hint="Fraction of generated answers that explicitly cited the correct source file. Requires a generation-quality eval run."
            />
          </div>

          {/* ── Ablation cards ── */}
          {report.ablation && report.ablation.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-semibold text-ink">Search Mode Comparison</p>
                <span className="text-[10px] text-ink-subtle">Hybrid is the mode in use; dense &amp; sparse are shown only for comparison</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {report.ablation.map(a => {
                  const pct = Math.round(a.recall_at_5 * 100)
                  const isActive = a.mode.toLowerCase().includes('hybrid')
                  const col = pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400'
                  const modeDesc = MODE_DESC[a.mode.toLowerCase()] ?? ''
                  return (
                    <div
                      key={a.mode}
                      className={`rounded-2xl border bg-surface-card p-5 transition-colors ${
                        isActive ? 'border-pink-500/40 ring-1 ring-pink-500/15' : 'border-surface-border'
                      }`}
                    >
                      {/* mode + "in use" status (a live-status badge, not a selectable tab) */}
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <span className="font-mono text-sm font-bold text-ink capitalize">{a.mode}</span>
                        {isActive && (
                          <span
                            title="This is the search mode the app actually uses. The others are run only to compare."
                            className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide bg-pink-500/15 text-pink-300 border border-pink-500/25 px-2 py-0.5 rounded-full"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
                            In use
                          </span>
                        )}
                      </div>

                      {/* Recall@5 hero + plain-words mode description */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`text-4xl font-bold leading-none tabular-nums ${col}`}>{pct}%</p>
                          <div className="flex items-center gap-1 mt-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-ink-subtle">Recall@5</span>
                            <InfoTip text={RECALL_TIP} />
                          </div>
                        </div>
                        {modeDesc && (
                          <p className="text-[10px] text-ink-subtle leading-relaxed text-right max-w-[55%] pt-0.5">
                            {modeDesc}
                          </p>
                        )}
                      </div>

                      {/* secondary metrics */}
                      <div className="border-t border-surface-border/60 mt-4 pt-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-[11px] text-ink-muted">
                            MRR <InfoTip text={MRR_TIP} />
                          </span>
                          <span className="text-xs font-semibold text-ink tabular-nums">{(a.mrr * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-ink-muted">Passed</span>
                          <span className="text-xs font-semibold text-ink tabular-nums">{a.passed} / {a.total_questions}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Failed questions ── */}
          {failedResults.length > 0 && (
            <div className="rounded-2xl border border-red-500/20 bg-surface-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-red-500/20 bg-red-500/5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <p className="text-sm font-semibold text-ink">Missed</p>
                  </div>
                  <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">
                    The correct file was <span className="font-semibold text-red-300">not in the AI's top 5 results</span> for these questions, so answers about them may be guessed or unreliable.
                  </p>
                </div>
                <span className="shrink-0 text-lg font-bold text-red-300 bg-red-500/15 border border-red-500/30 px-3.5 py-1.5 rounded-xl tabular-nums leading-none">
                  {failedResults.length}
                </span>
              </div>
              <div className="divide-y divide-surface-border/40">
                {failedResults.map((r, i) => <QuestionRow key={i} r={r} onAskAI={onAskAI} />)}
              </div>
            </div>
          )}

          {/* ── Passed questions ── */}
          {passedResults.length > 0 && (
            <div className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-surface-border bg-surface-raised/40 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <p className="text-sm font-semibold text-ink">Passed</p>
                  </div>
                  <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">
                    The AI <span className="font-semibold text-emerald-300">surfaced the correct file within its top 5 results</span>, so answers about these are well-grounded in real code.
                  </p>
                </div>
                <span className="shrink-0 text-lg font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl tabular-nums leading-none">
                  {passedResults.length}
                </span>
              </div>
              <div className="divide-y divide-surface-border/40">
                {passedResults.map((r, i) => <QuestionRow key={i} r={r} />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Re-run confirmation modal */}
      {confirmRerun && (
        <RerunConfirmModal onConfirm={handleRerun} onCancel={() => setConfirmRerun(false)} />
      )}
    </div>
  )
}
