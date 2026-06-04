import React from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

export const TECH_COLORS: Record<string, string> = {
  python:     'bg-blue-500/15 text-blue-300 border-blue-500/20',
  javascript: 'bg-yellow-400/15 text-yellow-300 border-yellow-400/20',
  typescript: 'bg-sky-400/15 text-sky-300 border-sky-400/20',
  react:      'bg-cyan-400/15 text-cyan-300 border-cyan-400/20',
  fastapi:    'bg-teal-400/15 text-teal-300 border-teal-400/20',
  nodejs:     'bg-green-500/15 text-green-300 border-green-500/20',
  express:    'bg-zinc-400/15 text-zinc-300 border-zinc-400/20',
  html:       'bg-orange-400/15 text-orange-300 border-orange-400/20',
  css:        'bg-blue-300/15 text-blue-200 border-blue-300/20',
  go:         'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  java:       'bg-orange-500/15 text-orange-400 border-orange-500/20',
  docker:     'bg-sky-500/15 text-sky-400 border-sky-500/20',
  postgresql: 'bg-indigo-400/15 text-indigo-300 border-indigo-400/20',
  mongodb:    'bg-green-400/15 text-green-300 border-green-400/20',
  redis:      'bg-red-400/15 text-red-300 border-red-400/20',
  graphql:    'bg-pink-400/15 text-pink-300 border-pink-400/20',
}

export const METHOD_STYLE: Record<string, string> = {
  GET:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  POST:   'bg-blue-500/10 text-blue-400 border-blue-500/25',
  PUT:    'bg-amber-500/10 text-amber-400 border-amber-500/25',
  DELETE: 'bg-red-500/10 text-red-400 border-red-500/25',
  PATCH:  'bg-purple-500/10 text-purple-400 border-purple-500/25',
}

export const RANK_STYLE = [
  { badge: 'bg-amber-500/20 border-amber-500/40 text-amber-300',    accent: 'from-amber-500/70 to-amber-400/20',   label: 'text-amber-400'  },
  { badge: 'bg-slate-400/15 border-slate-400/30 text-slate-300',    accent: 'from-slate-400/60 to-slate-400/15',   label: 'text-slate-400'  },
  { badge: 'bg-orange-600/20 border-orange-500/30 text-orange-400', accent: 'from-orange-600/60 to-orange-500/15', label: 'text-orange-400' },
]

export const STEP_ACCENTS = [
  { border: 'border-blue-500/50',    bg: 'bg-blue-500/10',    text: 'text-blue-400'    },
  { border: 'border-violet-500/50',  bg: 'bg-violet-500/10',  text: 'text-violet-400'  },
  { border: 'border-emerald-500/50', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  { border: 'border-amber-500/50',   bg: 'bg-amber-500/10',   text: 'text-amber-400'   },
  { border: 'border-pink-500/50',    bg: 'bg-pink-500/10',    text: 'text-pink-400'    },
  { border: 'border-cyan-500/50',    bg: 'bg-cyan-500/10',    text: 'text-cyan-400'    },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function techColor(tech: string) {
  return TECH_COLORS[tech.toLowerCase().replace(/[\s\-_.]/g, '')] ??
    'bg-violet-400/15 text-violet-300 border-violet-400/20'
}

export function methodStyle(m: string | null) {
  return METHOD_STYLE[(m ?? '').toUpperCase()] ??
    'bg-zinc-500/10 text-zinc-400 border-zinc-500/25'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function Sk({ h = 'h-4', w = 'w-full' }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} skeleton rounded-lg`} />
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in pt-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-20 skeleton rounded-xl" />)}
      </div>
      <div className="space-y-3">
        <Sk h="h-3" w="w-24" />
        <Sk h="h-6" w="w-3/4" />
        <Sk />
        <Sk w="w-5/6" />
        <div className="flex gap-2 pt-1">
          {[1, 2, 3, 4].map(i => <Sk key={i} h="h-7" w="w-20" />)}
        </div>
      </div>
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

export function EmptyState({
  icon, title, body,
}: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
      <div className="w-14 h-14 rounded-2xl bg-surface-raised border border-surface-border flex items-center justify-center text-ink-subtle mb-4">
        {icon}
      </div>
      <p className="text-sm font-semibold text-ink mb-1">{title}</p>
      <p className="text-xs text-ink-muted leading-relaxed max-w-xs">{body}</p>
    </div>
  )
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle mb-3 flex items-center gap-2">
      <span className="w-4 h-px bg-gradient-to-r from-ink-subtle to-transparent inline-block" />
      {children}
    </p>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

export function StatCard({ value, label, description, icon, accent, iconBg, footer, isEmpty }: {
  value: number | string
  label: string
  description: string
  icon: React.ReactNode
  accent: string
  iconBg: string
  footer?: React.ReactNode
  isEmpty?: boolean
}) {
  return (
    <div className="relative rounded-2xl border border-surface-border bg-surface-card overflow-hidden flex flex-col">
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${accent}`} />
      <div className="flex flex-col gap-3 p-5 flex-1">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className={`text-2xl font-bold leading-none tracking-tight ${isEmpty ? 'text-ink-subtle' : 'text-ink'}`}>
            {value}
          </p>
          <p className="text-[12px] font-semibold text-ink-muted mt-1.5">{label}</p>
          <p className="text-[11px] text-ink-subtle mt-0.5 leading-snug">{description}</p>
        </div>
      </div>
      {footer && (
        <div className="px-5 pb-4 pt-0">
          <div className="border-t border-surface-border/50 pt-3">
            {footer}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CommandMetric ────────────────────────────────────────────────────────────

export function CommandMetric({
  label, value, tone = 'text-ink',
}: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-surface-border/70 bg-surface-raised/40 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">{label}</p>
      <p className={`mt-2 text-lg font-bold tracking-tight ${tone}`}>{value}</p>
    </div>
  )
}

// ─── QuickActionCard ──────────────────────────────────────────────────────────

export function QuickActionCard({
  eyebrow, title, body, cta, accent, onClick,
}: {
  eyebrow: string
  title: string
  body: string
  cta: string
  accent: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl border border-surface-border bg-surface-card p-5 hover:border-surface-border/90 hover:-translate-y-0.5 transition-all"
    >
      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${accent}`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6-6m6 6l-6 6" />
        </svg>
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle">{eyebrow}</p>
      <p className="mt-2 text-base font-bold text-ink">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
      <p className="mt-4 text-xs font-semibold text-ink group-hover:text-pink-300 transition-colors">{cta}</p>
    </button>
  )
}

// ─── FileList ─────────────────────────────────────────────────────────────────

export function FileList({ files, emptyMsg }: { files: string[]; emptyMsg: string }) {
  if (!files.length) return <p className="text-xs text-ink-subtle italic">{emptyMsg}</p>
  return (
    <ul className="space-y-1">
      {files.map(f => (
        <li key={f} className="flex items-center gap-2 text-xs font-mono text-ink-muted bg-surface-raised/60 px-3 py-1.5 rounded-lg border border-surface-border/40">
          <span className="w-1.5 h-1.5 rounded-full bg-ink-subtle shrink-0" />
          {f}
        </li>
      ))}
    </ul>
  )
}
