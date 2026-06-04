import { useState } from 'react'
import { reposApi } from '../../api/repos'
import type { Repository } from '../../types'
import Spinner from '../Spinner'
import DeleteModal from './DeleteModal'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  completed: { border: 'border-emerald-500/25', accent: 'bg-emerald-500', badgeVariant: 'green'  as const },
  failed:    { border: 'border-red-500/25',     accent: 'bg-red-500',     badgeVariant: 'red'    as const },
  running:   { border: 'border-yellow-500/25',  accent: 'bg-yellow-500',  badgeVariant: 'yellow' as const },
  pending:   { border: 'border-surface-border', accent: 'bg-surface-border', badgeVariant: 'gray' as const },
}

function techColor(tech: string): string {
  const t = tech.toLowerCase().replace(/[\s\-_.]/g, '')
  const map: Record<string, string> = {
    python:       'bg-blue-500/15 text-blue-300 border-blue-500/25',
    javascript:   'bg-yellow-400/15 text-yellow-300 border-yellow-400/25',
    typescript:   'bg-sky-400/15 text-sky-300 border-sky-400/25',
    react:        'bg-cyan-400/15 text-cyan-300 border-cyan-400/25',
    react18:      'bg-cyan-400/15 text-cyan-300 border-cyan-400/25',
    nextjs:       'bg-zinc-300/15 text-zinc-200 border-zinc-300/25',
    vuejs:        'bg-emerald-400/15 text-emerald-300 border-emerald-400/25',
    angular:      'bg-red-500/15 text-red-300 border-red-500/25',
    fastapi:      'bg-teal-400/15 text-teal-300 border-teal-400/25',
    flask:        'bg-gray-400/15 text-gray-300 border-gray-400/25',
    django:       'bg-green-600/15 text-green-300 border-green-600/25',
    nodejs:       'bg-green-500/15 text-green-300 border-green-500/25',
    node:         'bg-green-500/15 text-green-300 border-green-500/25',
    express:      'bg-zinc-400/15 text-zinc-300 border-zinc-400/25',
    java:         'bg-orange-500/15 text-orange-300 border-orange-500/25',
    java17:       'bg-orange-500/15 text-orange-300 border-orange-500/25',
    springboot:   'bg-lime-500/15 text-lime-300 border-lime-500/25',
    springboot32: 'bg-lime-500/15 text-lime-300 border-lime-500/25',
    go:           'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
    rust:         'bg-orange-600/15 text-orange-300 border-orange-600/25',
    ruby:         'bg-red-400/15 text-red-300 border-red-400/25',
    php:          'bg-violet-400/15 text-violet-300 border-violet-400/25',
    html:         'bg-orange-400/15 text-orange-300 border-orange-400/25',
    css:          'bg-blue-300/15 text-blue-200 border-blue-300/25',
    tailwindcss:  'bg-teal-300/15 text-teal-200 border-teal-300/25',
    postgresql:   'bg-indigo-400/15 text-indigo-300 border-indigo-400/25',
    mongodb:      'bg-green-400/15 text-green-300 border-green-400/25',
    redis:        'bg-red-400/15 text-red-300 border-red-400/25',
    docker:       'bg-sky-500/15 text-sky-400 border-sky-500/25',
    graphql:      'bg-pink-400/15 text-pink-300 border-pink-400/25',
    gemini:       'bg-purple-400/15 text-purple-300 border-purple-400/25',
    geminiapi:    'bg-purple-400/15 text-purple-300 border-purple-400/25',
    openai:       'bg-emerald-400/15 text-emerald-300 border-emerald-400/25',
    qdrant:       'bg-pink-500/15 text-pink-300 border-pink-500/25',
    vite:         'bg-purple-400/15 text-purple-300 border-purple-400/25',
    gradle:       'bg-teal-400/15 text-teal-300 border-teal-400/25',
    maven:        'bg-red-500/15 text-red-300 border-red-500/25',
    chromeextension: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    manifestv3:   'bg-amber-400/15 text-amber-300 border-amber-400/25',
  }
  return map[t] || 'bg-violet-400/15 text-violet-300 border-violet-400/25'
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  repo: Repository
  onDelete: (id: string) => void
  onOpen: (id: string) => void
}

export default function RepoCard({ repo, onDelete, onOpen }: Props) {
  const [deleting, setDeleting] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const cfg = STATUS_CONFIG[repo.status] ?? STATUS_CONFIG.pending
  const clickable = repo.status === 'completed'
  const endpoints = repo.api_endpoints?.length ?? 0
  const repoShortName = repo.github_url.replace('https://github.com/', '')

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    try {
      await reposApi.delete(repo.id)
      onDelete(repo.id)
    } catch {
      setDeleting(false)
      setShowModal(false)
    }
  }

  return (
    <>
      <div className={`group relative rounded-2xl border bg-surface-card overflow-hidden flex flex-col transition-all duration-200
        ${cfg.border}
        ${clickable ? 'hover:shadow-xl hover:shadow-black/25 hover:-translate-y-1' : 'opacity-70'}`}
      >
        {/* Status accent line */}
        <div className={`h-0.5 w-full ${cfg.accent} opacity-80`} />

        {/* Delete button — appears on hover, top-right corner */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowModal(true) }}
          disabled={deleting}
          title="Delete repository"
          className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg
                     text-ink-subtle hover:text-red-400 hover:bg-red-500/10 transition-all duration-150"
        >
          {deleting
            ? <Spinner size="sm" />
            : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )
          }
        </button>

        {/* Card body */}
        <div className="px-5 pt-4 pb-5 flex-1 flex flex-col gap-3.5">

          {/* Identity */}
          <div className="flex items-start gap-3 pr-6">
            <div className="w-8 h-8 rounded-lg bg-surface-raised border border-surface-border flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-3.5 h-3.5 text-ink-subtle" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-ink truncate">{repo.name}</h3>
                {repo.status === 'completed' && (
                  <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {(repo.status === 'running' || repo.status === 'pending') && (
                  <svg className="w-4 h-4 text-yellow-400 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                )}
                {repo.status === 'failed' && (
                  <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <p className="text-[11px] text-ink-subtle font-mono truncate mt-0.5">{repoShortName}</p>
            </div>
          </div>

          {/* Purpose description */}
          {repo.summary?.purpose && (
            <p className="text-xs text-ink-muted leading-relaxed line-clamp-2">{repo.summary.purpose}</p>
          )}

          {/* Stack chips — no label needed */}
          {repo.summary?.stack && repo.summary.stack.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {repo.summary.stack.slice(0, 4).map(tech => (
                <span key={tech} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${techColor(tech)}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75 shrink-0" />
                  {tech}
                </span>
              ))}
              {repo.summary.stack.length > 4 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium text-ink-subtle border-surface-border bg-surface-raised/50">
                  +{repo.summary.stack.length - 4}
                </span>
              )}
            </div>
          )}

          {/* Stats — plain English, with icons */}
          {repo.status === 'completed' && (
            <div className="flex items-center gap-4 pt-3 border-t border-surface-border/50 mt-auto">
              <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                </svg>
                <span className="font-semibold text-ink">{repo.chunk_count.toLocaleString()}</span>
                <span>blocks</span>
              </span>
              {endpoints > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                  <span className="font-semibold text-ink">{endpoints}</span>
                  <span>endpoints</span>
                </span>
              )}
            </div>
          )}

          {/* Status banners */}
          {repo.status === 'failed' && (
            <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 mt-auto">
              <p className="text-xs text-red-400">Indexing failed — delete and try again.</p>
            </div>
          )}
          {(repo.status === 'pending' || repo.status === 'running') && (
            <div className="px-3 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 mt-auto flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse shrink-0" />
              <p className="text-xs text-yellow-400">Indexing in progress…</p>
            </div>
          )}
        </div>

        {/* CTA footer */}
        {clickable && (
          <div className="px-5 pb-5">
            <button
              onClick={() => onOpen(repo.id)}
              className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent/85 text-white text-xs font-semibold
                         transition-colors flex items-center justify-center gap-2"
            >
              Open Dashboard
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <DeleteModal
          repoName={repo.name}
          deleting={deleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowModal(false)}
        />
      )}
    </>
  )
}
