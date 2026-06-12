import { useState, useRef, useEffect } from 'react'
import { reposApi } from '../../api/repos'
import type { Repository, RepoComposition } from '../../types'
import { EmptyState, SectionLabel, techColor, STEP_ACCENTS } from './shared'

type NavTab = 'explore' | 'change' | 'evaluate' | 'ask'

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

// ─── Repo identity ────────────────────────────────────────────────────────────

function IdentityCard({ repo }: { repo: Repository }) {
  const repoShortName = repo.github_url.replace('https://github.com/', '')
  const summary = repo.summary

  return (
    <div className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden">
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

      {summary?.purpose && (
        <div className="mx-6 mb-5 rounded-xl bg-surface-raised/40 border border-surface-border/60 px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-subtle mb-2">What this codebase does</p>
          <p className="text-sm leading-relaxed text-ink">{summary.purpose}</p>
          {summary.stack && summary.stack.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-surface-border/50">
              {summary.stack.map(t => (
                <span key={t} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${techColor(t)}`}>{t}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Codebase anatomy (composition) ───────────────────────────────────────────

const PIE_PALETTE = [
  { hex: '#3b82f6', dot: 'bg-blue-400',    text: 'text-blue-300'    },
  { hex: '#10b981', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  { hex: '#8b5cf6', dot: 'bg-violet-400',  text: 'text-violet-300'  },
  { hex: '#f59e0b', dot: 'bg-amber-400',   text: 'text-amber-300'   },
  { hex: '#ec4899', dot: 'bg-pink-400',    text: 'text-pink-300'    },
  { hex: '#06b6d4', dot: 'bg-cyan-400',    text: 'text-cyan-300'    },
  { hex: '#f97316', dot: 'bg-orange-400',  text: 'text-orange-300'  },
  { hex: '#64748b', dot: 'bg-slate-400',   text: 'text-slate-300'   },
]

// ─── Donut chart (pure SVG, no chart lib) ─────────────────────────────────────

interface DonutSegment { name: string; count: number; hex: string; textClass: string }

function Donut({ segments, centerValue, centerLabel, hoverIdx, onHover }: {
  segments: DonutSegment[]
  centerValue: string
  centerLabel: string
  hoverIdx: number | null
  onHover: (idx: number | null) => void
}) {
  const SIZE = 172
  const THICKNESS = 26
  const HOVER_GROW = 5
  // Reserve the hover growth inside the viewBox so thickened slices never clip
  const r = (SIZE - THICKNESS) / 2 - HOVER_GROW
  const C = 2 * Math.PI * r
  const total = segments.reduce((s, x) => s + x.count, 0)
  if (total === 0) return null

  const hovered = hoverIdx !== null ? segments[hoverIdx] : null

  let acc = 0
  return (
    <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
        {segments.map((seg, i) => {
          const frac = seg.count / total
          const dash = frac * C
          const offset = -acc
          acc += dash
          const isHovered = hoverIdx === i
          const isDimmed = hoverIdx !== null && !isHovered
          return (
            <circle
              key={seg.name}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              fill="none"
              stroke={seg.hex}
              strokeWidth={isHovered ? THICKNESS + HOVER_GROW : THICKNESS}
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={offset}
              opacity={isDimmed ? 0.3 : 1}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              className="transition-all duration-200 cursor-pointer"
            />
          )
        })}
      </svg>
      {/* Center label — swaps to slice details on hover */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
        {hovered ? (
          <>
            <p className={`text-sm font-bold leading-tight truncate max-w-full ${hovered.textClass}`}>{hovered.name}</p>
            <p className="text-xl font-bold text-ink leading-none tabular-nums mt-1">
              {Math.round((hovered.count / total) * 100)}%
            </p>
            <p className="text-[10px] text-ink-subtle mt-1 tabular-nums">
              {hovered.count.toLocaleString()} block{hovered.count !== 1 ? 's' : ''}
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-ink leading-none tabular-nums">{centerValue}</p>
            <p className="text-[10px] text-ink-subtle mt-1">{centerLabel}</p>
          </>
        )}
      </div>
    </div>
  )
}

const ROLE_META: Record<string, { label: string; blurb: string; dot: string; text: string; border: string; bg: string }> = {
  controller: { label: 'Controllers', blurb: 'Receive requests & route them',  dot: 'bg-blue-400',    text: 'text-blue-300',    border: 'border-blue-500/25',    bg: 'bg-blue-500/8'    },
  service:    { label: 'Services',    blurb: 'Business logic & orchestration', dot: 'bg-violet-400',  text: 'text-violet-300',  border: 'border-violet-500/25',  bg: 'bg-violet-500/8'  },
  repository: { label: 'Data access', blurb: 'Database queries & persistence', dot: 'bg-emerald-400', text: 'text-emerald-300', border: 'border-emerald-500/25', bg: 'bg-emerald-500/8' },
  utility:    { label: 'Utilities',   blurb: 'Helpers & shared code',          dot: 'bg-amber-400',   text: 'text-amber-300',   border: 'border-amber-500/25',   bg: 'bg-amber-500/8'   },
  model:      { label: 'Models',      blurb: 'Data structures & schemas',      dot: 'bg-cyan-400',    text: 'text-cyan-300',    border: 'border-cyan-500/25',    bg: 'bg-cyan-500/8'    },
  test:       { label: 'Tests',       blurb: 'Automated test code',            dot: 'bg-pink-400',    text: 'text-pink-300',    border: 'border-pink-500/25',    bg: 'bg-pink-500/8'    },
}

const FALLBACK_ROLE_META = {
  label: '', blurb: 'Other indexed code', dot: 'bg-slate-400', text: 'text-slate-300', border: 'border-surface-border', bg: 'bg-surface-raised/40',
}

const CHUNK_TYPE_LABEL: Record<string, [string, string]> = {
  function: ['function', 'functions'],
  class:    ['class', 'classes'],
  endpoint: ['endpoint', 'endpoints'],
  doc:      ['doc block', 'doc blocks'],
  raw:      ['other block', 'other blocks'],
}

function CompositionSection({ comp, loading }: { comp: RepoComposition | null; loading: boolean }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (loading) return (
    <div className="h-full flex flex-col">
      <SectionLabel>Codebase anatomy</SectionLabel>
      <div className="flex-1 rounded-2xl border border-surface-border bg-surface-card p-6 space-y-5">
        <div className="flex items-center gap-6">
          <div className="w-[172px] h-[172px] skeleton rounded-full shrink-0" />
          <div className="flex-1 space-y-2.5">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-3.5 skeleton rounded-lg" />)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[1, 2].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}
        </div>
      </div>
    </div>
  )

  if (!comp || comp.total_chunks === 0) return null

  const langTotal = comp.languages.reduce((s, l) => s + l.count, 0)

  // Top 6 languages + everything else folded into "other". The backend may also
  // emit its own "other" bucket, so merge by name to avoid a duplicate slice.
  const merged = new Map<string, number>()
  comp.languages.forEach((l, i) => {
    const name = i < 6 ? l.name : 'other'
    merged.set(name, (merged.get(name) ?? 0) + l.count)
  })
  const langSegments = Array.from(merged.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], i) => ({
      name,
      count,
      palette: name === 'other' ? PIE_PALETTE[7] : PIE_PALETTE[i % PIE_PALETTE.length],
    }))

  const roleTotal = comp.roles.reduce((s, r) => s + r.count, 0)

  const typeSummary = comp.chunk_types
    .map(t => {
      const [one, many] = CHUNK_TYPE_LABEL[t.name.toLowerCase()] ?? [t.name, `${t.name}s`]
      return `${t.count.toLocaleString()} ${t.count === 1 ? one : many}`
    })
    .join(' · ')

  return (
    <div className="h-full flex flex-col">
      <SectionLabel>Codebase anatomy</SectionLabel>
      <div className="flex-1 rounded-2xl border border-surface-border bg-surface-card p-6 flex flex-col gap-6">

        {/* Donut + language legend */}
        {langTotal > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Donut
              segments={langSegments.map(s => ({ name: s.name, count: s.count, hex: s.palette.hex, textClass: s.palette.text }))}
              centerValue={comp.total_chunks.toLocaleString()}
              centerLabel="code blocks"
              hoverIdx={hoverIdx}
              onHover={setHoverIdx}
            />
            <div className="w-full sm:w-auto sm:min-w-[180px] sm:max-w-[230px] min-w-0 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-ink-subtle mb-2 px-1.5">Languages</p>
              {langSegments.map((seg, i) => {
                const pct = Math.round((seg.count / langTotal) * 100)
                const isHovered = hoverIdx === i
                const isDimmed = hoverIdx !== null && !isHovered
                return (
                  <div
                    key={seg.name}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    className={`flex items-center gap-2.5 px-1.5 py-1 rounded-lg cursor-default transition-all duration-150 ${
                      isHovered ? 'bg-surface-raised/60' : ''
                    } ${isDimmed ? 'opacity-40' : ''}`}
                  >
                    <span className={`rounded-sm shrink-0 transition-all duration-150 ${seg.palette.dot} ${isHovered ? 'w-3 h-3' : 'w-2.5 h-2.5'}`} />
                    <span className={`text-xs font-semibold ${seg.palette.text} flex-1 truncate`}>{seg.name}</span>
                    <span className="text-[11px] text-ink-muted tabular-nums">{seg.count.toLocaleString()}</span>
                    <span className="text-xs font-bold text-ink tabular-nums w-10 text-right">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Architectural roles */}
        {roleTotal > 0 && (
          <div className="border-t border-surface-border/50 pt-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-subtle mb-2.5">
              Architectural roles
              <span className="ml-2 normal-case font-medium tracking-normal text-ink-subtle/70">how the code splits by responsibility</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {comp.roles.map(role => {
                const meta = ROLE_META[role.name.toLowerCase()] ?? {
                  ...FALLBACK_ROLE_META,
                  label: role.name.charAt(0).toUpperCase() + role.name.slice(1),
                }
                const pct = Math.round((role.count / roleTotal) * 100)
                return (
                  <div key={role.name} className={`rounded-xl border ${meta.border} ${meta.bg} px-3.5 py-3`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                      <p className={`text-xs font-bold ${meta.text}`}>{meta.label}</p>
                      <span className="ml-auto text-[11px] font-bold text-ink tabular-nums">{pct}%</span>
                    </div>
                    <p className="text-[10px] text-ink-subtle mt-1 leading-snug">{meta.blurb}</p>
                    <p className="text-[10px] text-ink-muted mt-1.5 tabular-nums">{role.count.toLocaleString()} blocks</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer facts — pinned to the card bottom so columns align */}
        <p className="text-[11px] text-ink-subtle border-t border-surface-border/50 pt-3 mt-auto">
          <span className="font-semibold text-ink-muted">{comp.total_files.toLocaleString()} files indexed</span>
          {typeSummary && <> — made up of {typeSummary}.</>}
        </p>
      </div>
    </div>
  )
}

// ─── Architecture + entry points ──────────────────────────────────────────────

function StructureSection({ repo }: { repo: Repository }) {
  const summary = repo.summary
  if (!summary) return (
    <EmptyState
      icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>}
      title="Summary not generated"
      body="The repository summary failed to generate. Use Ask AI to explore this codebase directly."
    />
  )

  return (
    <div className="space-y-6">
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
  )
}

// ─── Learning-path text parsing ───────────────────────────────────────────────

// Paths like src/context/github/ or filenames like GithubReducer.js / tailwind.config.js
const FILE_TOKEN_RE = /(?:[\w@-]+\/)+[\w.@-]*|\b[\w.-]+\.(?:jsx?|tsx?|py|java|go|rb|php|rs|json|css|scss|html?|md|ya?ml|toml|sql)\b/g

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map(s => s.trim())
    .filter(Boolean)
}

/** Inline file mention — simple highlighted text, with the same hover actions as FileChip. */
function InlineFileRef({ f, repoName, onAskAI, onCheckImpact }: {
  f: string
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
    <span className="relative inline" onMouseEnter={show} onMouseLeave={hide}>
      <code className="font-mono text-[0.9em] text-emerald-300 bg-emerald-500/10 rounded px-1 py-px">
        {f}
      </code>
      {hovered && (onAskAI || onCheckImpact) && (
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

/** Render a sentence with file mentions upgraded to highlighted, hoverable text. */
function renderWithFileChips(
  text: string,
  repoName: string,
  onAskAI?: (q: string) => void,
  onCheckImpact?: (path: string) => void,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(FILE_TOKEN_RE)) {
    const idx = m.index ?? 0
    let tok = m[0]
    const trail = tok.match(/[.,;:]+$/)?.[0] ?? ''
    if (trail) tok = tok.slice(0, -trail.length)
    // Guard against prose like "and/or": require a dot, a trailing slash, or a deep path
    const isFileLike = tok.includes('.') || tok.endsWith('/') || (tok.match(/\//g)?.length ?? 0) >= 2
    if (!isFileLike || tok.length < 4) continue
    nodes.push(text.slice(last, idx))
    nodes.push(
      <InlineFileRef
        key={`${tok}-${idx}`}
        f={tok}
        repoName={repoName}
        onAskAI={onAskAI}
        onCheckImpact={onCheckImpact}
      />
    )
    if (trail) nodes.push(trail)
    last = idx + m[0].length
  }
  nodes.push(text.slice(last))
  return nodes
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
      {/* Learning path hero — sentence-per-row flow with actionable file chips */}
      {guide.learning_path && (() => {
        const sentences = splitSentences(guide.learning_path)
        return (
          <div className="relative rounded-2xl overflow-hidden border border-emerald-500/25">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 via-transparent to-teal-500/5 pointer-events-none" />
            <div className="relative p-6">
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Suggested starting point</p>
                  <p className="text-[11px] text-ink-subtle mt-0.5">Hover any file to ask the AI about it or check its impact</p>
                </div>
              </div>

              {/* Reading flow — one dedicated row per bullet */}
              <div className="space-y-1.5">
                {sentences.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 px-3.5 py-2.5 rounded-xl bg-surface-raised/30 border border-surface-border/40 hover:border-emerald-500/25 transition-colors"
                  >
                    <span className="w-5 h-5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </span>
                    <p className="text-sm text-ink-muted leading-relaxed flex-1 min-w-0">
                      {renderWithFileChips(s, repo.name, onAskAI, onCheckImpact)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

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

// ─── Quick actions ────────────────────────────────────────────────────────────

function ActionCard({ icon, title, description, cta, color, ctaColor, onClick }: {
  icon: React.ReactNode
  title: string
  description: string
  cta: string
  color: string
  ctaColor: string
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
      <p className={`text-xs font-semibold mt-4 transition-colors ${ctaColor} group-hover:opacity-80`}>
        {cta} →
      </p>
    </button>
  )
}

function QuickActions({ onNavigate }: { onNavigate: (tab: NavTab) => void }) {
  return (
    <div>
      <SectionLabel>Where to go next</SectionLabel>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ActionCard
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" /></svg>}
          title="Ask a question"
          description="Ask anything about this codebase and get answers backed by the actual source code."
          cta="Open Ask AI"
          color="bg-pink-500/10 border-pink-500/25 text-pink-400"
          ctaColor="text-pink-400"
          onClick={() => onNavigate('ask')}
        />
        <ActionCard
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>}
          title="Find code instantly"
          description="Describe what you're looking for and get the exact files — free, no question quota used."
          cta="Open Code Search"
          color="bg-cyan-500/10 border-cyan-500/25 text-cyan-400"
          ctaColor="text-cyan-400"
          onClick={() => onNavigate('explore')}
        />
        <ActionCard
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>}
          title="See what breaks if you change something"
          description="Type any function or file — instantly see every other file that depends on it."
          cta="Open Impact"
          color="bg-amber-500/10 border-amber-500/25 text-amber-400"
          ctaColor="text-amber-400"
          onClick={() => onNavigate('change')}
        />
        <ActionCard
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          title="Check if AI answers are trustworthy"
          description="Run a quick test to see how accurately the AI finds the right code for your questions."
          cta="Run Evaluation"
          color="bg-violet-500/10 border-violet-500/25 text-violet-400"
          ctaColor="text-violet-400"
          onClick={() => onNavigate('evaluate')}
        />
      </div>
    </div>
  )
}

// ─── Combined panel ───────────────────────────────────────────────────────────

interface Props {
  repo: Repository
  onAskAI?: (q: string) => void
  onCheckImpact?: (path: string) => void
  onNavigate?: (tab: NavTab) => void
}

export default function UnderstandPanel({ repo, onAskAI, onCheckImpact, onNavigate }: Props) {
  const [comp, setComp] = useState<RepoComposition | null>(null)
  const [compLoading, setCompLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setCompLoading(true)
    reposApi.getComposition(repo.id)
      .then(c => { if (!cancelled) setComp(c) })
      .catch(() => { /* anatomy card simply hides on failure */ })
      .finally(() => { if (!cancelled) setCompLoading(false) })
    return () => { cancelled = true }
  }, [repo.id])

  const showAnatomy = compLoading || (!!comp && comp.total_chunks > 0)

  return (
    <div className="space-y-8 pb-10">
      <IdentityCard repo={repo} />

      {/* Two columns: structure (left) · anatomy donut (right) — stretched to equal height */}
      <div className={`grid gap-6 ${showAnatomy ? 'lg:grid-cols-2' : ''}`}>
        <StructureSection repo={repo} />
        {showAnatomy && <CompositionSection comp={comp} loading={compLoading} />}
      </div>

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

      {onNavigate && <QuickActions onNavigate={onNavigate} />}
    </div>
  )
}
