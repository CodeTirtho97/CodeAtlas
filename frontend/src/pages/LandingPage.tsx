import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { reposApi } from '../api/repos'
import type { Repository } from '../types'
import Header from '../components/Header'
import Badge from '../components/Badge'
import Spinner from '../components/Spinner'
import client from '../api/client'

// ─── Delete Confirmation Modal ────────────────────────────────────────────────
function DeleteModal({
  repoName,
  onConfirm,
  onCancel,
  deleting,
}: {
  repoName: string
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Focus cancel on mount, close on Escape
  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

      {/* Dialog */}
      <div
        className="relative w-full max-w-sm card p-6 shadow-2xl shadow-black/60 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
        </div>

        {/* Text */}
        <div className="text-center mb-6">
          <h3 className="text-base font-semibold text-ink mb-2">Delete repository?</h3>
          <p className="text-sm text-ink-muted mb-1">
            You're about to delete{' '}
            <span className="font-mono font-medium text-ink">{repoName}</span>.
          </p>
          <p className="text-xs text-ink-subtle leading-relaxed">
            All indexed chunks, embeddings, and Q&A history will be permanently removed. This cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 rounded-lg bg-surface-raised hover:bg-surface-border text-sm text-ink transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-sm font-medium text-red-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {deleting ? (
              <>
                <Spinner size="sm" />
                Deleting…
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Repo Card ────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  completed: { border: 'border-emerald-500/20', glow: 'hover:shadow-emerald-500/10', icon: 'text-emerald-400', badgeVariant: 'green' as const },
  failed:    { border: 'border-red-500/20',     glow: 'hover:shadow-red-500/10',     icon: 'text-red-400',     badgeVariant: 'red'   as const },
  running:   { border: 'border-yellow-500/20',  glow: 'hover:shadow-yellow-500/10',  icon: 'text-yellow-400',  badgeVariant: 'yellow' as const },
  pending:   { border: 'border-surface-border', glow: '',                             icon: 'text-ink-subtle',  badgeVariant: 'gray'  as const },
}

function RepoCard({
  repo,
  onDelete,
  onOpen,
}: {
  repo: Repository
  onDelete: (id: string) => void
  onOpen: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const cfg = STATUS_CONFIG[repo.status] ?? STATUS_CONFIG.pending
  const clickable = repo.status === 'completed'

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

  const endpoints = repo.api_endpoints?.length ?? 0
  const getTechColor = (tech: string): string => {
    const t = tech.toLowerCase().replace(/[\s\-_.]/g, '')
    const colors: Record<string, string> = {
      python:              'bg-blue-500/15 text-blue-300 border-blue-500/25',
      javascript:          'bg-yellow-400/15 text-yellow-300 border-yellow-400/25',
      typescript:          'bg-sky-400/15 text-sky-300 border-sky-400/25',
      react:               'bg-cyan-400/15 text-cyan-300 border-cyan-400/25',
      react18:             'bg-cyan-400/15 text-cyan-300 border-cyan-400/25',
      nextjs:              'bg-zinc-300/15 text-zinc-200 border-zinc-300/25',
      vuejs:               'bg-emerald-400/15 text-emerald-300 border-emerald-400/25',
      angular:             'bg-red-500/15 text-red-300 border-red-500/25',
      svelte:              'bg-orange-500/15 text-orange-300 border-orange-500/25',
      fastapi:             'bg-teal-400/15 text-teal-300 border-teal-400/25',
      flask:               'bg-gray-400/15 text-gray-300 border-gray-400/25',
      django:              'bg-green-600/15 text-green-300 border-green-600/25',
      nodejs:              'bg-green-500/15 text-green-300 border-green-500/25',
      node:                'bg-green-500/15 text-green-300 border-green-500/25',
      express:             'bg-zinc-400/15 text-zinc-300 border-zinc-400/25',
      java:                'bg-orange-500/15 text-orange-300 border-orange-500/25',
      java17:              'bg-orange-500/15 text-orange-300 border-orange-500/25',
      springboot:          'bg-lime-500/15 text-lime-300 border-lime-500/25',
      springboot32:        'bg-lime-500/15 text-lime-300 border-lime-500/25',
      go:                  'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
      rust:                'bg-orange-600/15 text-orange-300 border-orange-600/25',
      cpp:                 'bg-blue-600/15 text-blue-300 border-blue-600/25',
      'c++':               'bg-blue-600/15 text-blue-300 border-blue-600/25',
      c:                   'bg-blue-700/15 text-blue-300 border-blue-700/25',
      ruby:                'bg-red-400/15 text-red-300 border-red-400/25',
      php:                 'bg-violet-400/15 text-violet-300 border-violet-400/25',
      html:                'bg-orange-400/15 text-orange-300 border-orange-400/25',
      css:                 'bg-blue-300/15 text-blue-200 border-blue-300/25',
      sass:                'bg-pink-400/15 text-pink-300 border-pink-400/25',
      tailwindcss:         'bg-teal-300/15 text-teal-200 border-teal-300/25',
      postgresql:          'bg-indigo-400/15 text-indigo-300 border-indigo-400/25',
      mysql:               'bg-blue-400/15 text-blue-300 border-blue-400/25',
      mongodb:             'bg-green-400/15 text-green-300 border-green-400/25',
      redis:               'bg-red-400/15 text-red-300 border-red-400/25',
      sqlite:              'bg-sky-300/15 text-sky-200 border-sky-300/25',
      docker:              'bg-sky-500/15 text-sky-400 border-sky-500/25',
      kubernetes:          'bg-blue-500/15 text-blue-300 border-blue-500/25',
      graphql:             'bg-pink-400/15 text-pink-300 border-pink-400/25',
      chromextension:      'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
      chromeextensionapis: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
      chromeextension:     'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
      'chromeextension(manifestv3)': 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
      manifestv3:          'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
      gemini:              'bg-purple-400/15 text-purple-300 border-purple-400/25',
      geminiapi:           'bg-purple-400/15 text-purple-300 border-purple-400/25',
      openai:              'bg-emerald-400/15 text-emerald-300 border-emerald-400/25',
      qdrant:              'bg-pink-500/15 text-pink-300 border-pink-500/25',
      axios:               'bg-violet-400/15 text-violet-300 border-violet-400/25',
      vite:                'bg-purple-400/15 text-purple-300 border-purple-400/25',
      webpack:             'bg-blue-400/15 text-blue-300 border-blue-400/25',
      gradle:              'bg-teal-400/15 text-teal-300 border-teal-400/25',
      maven:               'bg-red-500/15 text-red-300 border-red-500/25',
    }
    return colors[t] || 'bg-violet-400/15 text-violet-300 border-violet-400/25'
  }

  return (
    <>
      <div
        className={`
          group relative rounded-2xl border bg-surface-card overflow-hidden
          transition-all duration-200 flex flex-col h-full
          ${cfg.border}
          ${!clickable ? 'opacity-75' : 'hover:border-surface-border/60 hover:shadow-lg'}
        `}
      >
        {/* Header: Title + Status Badge */}
        <div className="px-5 pt-5 pb-3 border-b border-surface-border/50 bg-surface-raised/30">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0 flex-1">
              <h3 className={`font-bold text-base truncate ${
                repo.status === 'completed' ? 'text-emerald-100' :
                repo.status === 'failed'    ? 'text-red-300'     :
                repo.status === 'running'   ? 'text-yellow-200'  : 'text-ink'
              }`}>{repo.name}</h3>
              <p className="text-xs text-ink-muted truncate font-mono mt-0.5">
                {repo.github_url.replace('https://github.com/', '')}
              </p>
            </div>
            <Badge variant={cfg.badgeVariant} dot>
              {repo.status}
            </Badge>
          </div>
        </div>

        {/* Content: Purpose + Tech Stack */}
        <div className="px-5 py-4 flex-1 space-y-4">
          {/* Purpose */}
          {repo.summary?.purpose && (
            <p className="text-xs text-ink-muted leading-relaxed line-clamp-3">
              {repo.summary.purpose}
            </p>
          )}

          {/* Tech Stack */}
          {(repo.summary?.stack && repo.summary.stack.length > 0) && (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Stack</p>
              <div className="flex flex-wrap gap-1.5">
                {repo.summary.stack.slice(0, 4).map(tech => (
                  <span
                    key={tech}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${getTechColor(tech)}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 shrink-0" />
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-surface-border/50">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Chunks</p>
              <p className="text-sm font-mono text-accent">{repo.chunk_count.toLocaleString()}</p>
            </div>
            {endpoints > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Endpoints</p>
                <p className="text-sm font-mono text-accent">{endpoints}</p>
              </div>
            )}
          </div>

          {/* Status messages for incomplete repos */}
          {repo.status === 'failed' && !repo.summary?.stack && (
            <div className="mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400">Indexing failed. Please try again.</p>
            </div>
          )}
          {(repo.status === 'pending' || repo.status === 'running') && (
            <div className="mt-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-xs text-yellow-400">Indexing in progress…</p>
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="px-5 py-4 border-t border-surface-border/50 bg-surface-raised/20 flex items-center gap-2">
          {clickable ? (
            <>
              <button
                onClick={() => onOpen(repo.id)}
                className="flex-1 px-3 py-2 rounded-lg bg-accent hover:bg-accent/80 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                View
              </button>
              <button
                onClick={() => setShowModal(true)}
                disabled={deleting}
                className="p-2 rounded-lg text-ink-subtle hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Delete repository"
              >
                {deleting ? (
                  <Spinner size="sm" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowModal(true)}
              disabled={deleting}
              className="p-2 rounded-lg text-ink-subtle hover:text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
              title="Delete repository"
            >
              {deleting ? (
                <Spinner size="sm" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          )}
        </div>
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

// ─── URL Input Form ───────────────────────────────────────────────────────────
function AnalyzeForm({ onSubmit, disabled }: { onSubmit: (url: string) => void; disabled?: boolean }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const cleaned = url.trim()
    if (!cleaned.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/)) {
      setError('Enter a valid GitHub URL: https://github.com/owner/repo')
      return
    }
    onSubmit(cleaned)
    setUrl('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError('') }}
            placeholder="https://github.com/owner/repository"
            className="w-full bg-surface-raised border border-surface-border rounded-lg py-2.5 pl-9 pr-4 text-sm text-ink placeholder-ink-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={disabled || !url.trim()}
          className="px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shrink-0"
        >
          Analyze
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  )
}

// ─── Feature Cards ────────────────────────────────────────────────────────────
const FEATURES = [
  {
    accent: 'from-blue-500/20 to-blue-600/5',
    border: 'border-blue-500/20',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    tag: 'Step-by-step',
    title: 'Auto Onboarding Guide',
    desc: 'Know exactly where to start. A prioritised reading path, key services, and core workflows — generated from your repo structure the moment ingestion completes.',
  },
  {
    accent: 'from-purple-500/20 to-purple-600/5',
    border: 'border-purple-500/20',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
      </svg>
    ),
    tag: 'AST-powered',
    title: 'API Endpoint Discovery',
    desc: 'Every route, controller, and HTTP method extracted automatically via Tree-sitter — no annotations, no manual tagging, no guesswork.',
  },
  {
    accent: 'from-emerald-500/20 to-emerald-600/5',
    border: 'border-emerald-500/20',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
    tag: 'NetworkX',
    title: 'Dependency Graph',
    desc: 'See exactly what imports what. File-level adjacency shows which modules are most connected — so you touch the right files first.',
  },
  {
    accent: 'from-orange-500/20 to-orange-600/5',
    border: 'border-orange-500/20',
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-400',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    tag: 'Hybrid RAG',
    title: 'Architecture-Aware Q&A',
    desc: 'Ask anything in plain English. Answers are grounded in your actual code — every response cites the exact file, function, and line range it drew from.',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [repos, setRepos] = useState<Repository[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [limitError, setLimitError] = useState('')

  useEffect(() => {
    if (isAuthenticated) {
      setLoadingRepos(true)
      reposApi.list()
        .then(setRepos)
        .finally(() => setLoadingRepos(false))
    }
  }, [isAuthenticated])

  const handleLogin = async () => {
    const r = await client.get('/auth/login')
    window.location.href = r.data.auth_url
  }

  const handleAnalyze = async (url: string) => {
    if (repos.length >= 3) {
      setLimitError('You have reached the 3-repository limit. Delete one to add another.')
      return
    }
    setSubmitting(true)
    setLimitError('')
    try {
      const job = await reposApi.ingest(url)
      navigate(`/ingest/${job.job_id}/${job.repository_id}`)
    } catch (err: any) {
      setLimitError(err.response?.data?.detail || 'Failed to start ingestion. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteRepo = (id: string) => {
    setRepos((prev) => prev.filter((r) => r.id !== id))
  }

  const atLimit = repos.length >= 3

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="border-b border-surface-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
            {/* Logo mark */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-accent fill-none stroke-current" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold mb-6 leading-[1.15] tracking-tight">
              <span className="text-ink block">Onboard Developers To Codebase</span>
              <span className="text-gradient block">in minutes, not days.</span>
            </h1>

            <p className="text-ink-muted text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed space-y-1">
              Paste a GitHub URL. CodeAtlas auto-generates your{' '}
              <strong className="text-ink font-medium">onboarding guide</strong>,{' '}
              <strong className="text-ink font-medium">API map</strong>, and{' '}
              <strong className="text-ink font-medium">dependency graph</strong> — then answers
              architecture questions with exact source citations.
            </p>

            {!isAuthenticated ? (
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={handleLogin}
                  className="inline-flex items-center gap-2.5 bg-white text-gray-900 hover:bg-gray-100 font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  Sign in with GitHub
                </button>
                <p className="text-xs text-ink-subtle">Free · Public repositories only · No credit card</p>
              </div>
            ) : (
              /* Authenticated: show URL input */
              <div className="max-w-xl mx-auto">
                {atLimit ? (
                  <div className="text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3">
                    Repository limit reached (3/3). Delete one below to analyze a new repo.
                  </div>
                ) : (
                  <>
                    <AnalyzeForm onSubmit={handleAnalyze} disabled={submitting} />
                    {limitError && (
                      <p className="mt-2 text-xs text-red-400">{limitError}</p>
                    )}
                    {submitting && (
                      <div className="flex items-center justify-center gap-2 mt-3 text-sm text-ink-muted">
                        <Spinner size="sm" /> Starting ingestion...
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── User's Repos ─────────────────────────────────────────────── */}
        {isAuthenticated && (
          <section id="your-repos" className="border-t border-surface-border">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

              {/* Section header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-base font-semibold text-ink">Your repositories</h2>
                  <p className="text-xs text-ink-subtle mt-0.5">
                    {repos.length === 0
                      ? 'No repositories indexed yet'
                      : `${repos.length} of 3 slots used`}
                  </p>
                </div>
                {/* Slot indicators */}
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                        i < repos.length ? 'bg-accent' : 'bg-surface-raised border border-surface-border'
                      }`}
                    />
                  ))}
                  <span className="text-xs text-ink-subtle ml-1">{repos.length}/3</span>
                </div>
              </div>

              {loadingRepos ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2].map(i => (
                    <div key={i} className="rounded-xl border border-surface-border bg-surface-card p-5 h-28 skeleton" />
                  ))}
                </div>
              ) : repos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-surface-border bg-surface-card/50 py-14 text-center">
                  <div className="w-12 h-12 rounded-xl bg-surface-raised border border-surface-border flex items-center justify-center mx-auto mb-4">
                    <svg className="w-5 h-5 text-ink-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-ink-muted">No repositories yet</p>
                  <p className="text-xs text-ink-subtle mt-1">Paste a GitHub URL above to get started</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {repos.map(repo => (
                    <RepoCard
                      key={repo.id}
                      repo={repo}
                      onDelete={handleDeleteRepo}
                      onOpen={id => navigate(`/dashboard/${id}`)}
                    />
                  ))}
                  {/* Empty slot placeholder */}
                  {repos.length < 3 && !atLimit && (
                    <div className="rounded-xl border border-dashed border-surface-border bg-surface-card/30 p-5 flex flex-col items-center justify-center gap-2 text-center min-h-[110px]">
                      <div className="w-8 h-8 rounded-lg bg-surface-raised flex items-center justify-center">
                        <svg className="w-4 h-4 text-ink-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                      </div>
                      <p className="text-xs text-ink-subtle">Add a repository above</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Features ─────────────────────────────────────────────────── */}
        <section className="border-t border-surface-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center mb-12">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-subtle mb-3">
                What you get automatically
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-ink">
                Everything a new developer needs.
                <span className="text-gradient"> Nothing manual.</span>
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className={`relative rounded-xl border ${f.border} bg-gradient-to-b ${f.accent} p-5 flex flex-col gap-4 overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20`}
                >
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-lg ${f.iconBg} flex items-center justify-center ${f.iconColor} shrink-0`}>
                    {f.icon}
                  </div>

                  {/* Text */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="text-sm font-semibold text-ink">{f.title}</h3>
                    </div>
                    <p className="text-xs text-ink-muted leading-relaxed">{f.desc}</p>
                  </div>

                  {/* Tag */}
                  <div className={`self-start text-[10px] font-mono font-medium px-2 py-0.5 rounded-full ${f.iconBg} ${f.iconColor} border ${f.border}`}>
                    {f.tag}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-surface-card border-t border-surface-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left: logo + tagline */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="text-sm font-bold text-ink">CodeAtlas</span>
            <span className="text-surface-border">·</span>
            <span className="text-xs text-ink-subtle">AI-powered repository intelligence</span>
          </div>

          {/* Right: nav + author */}
          <div className="flex items-center gap-5 text-xs text-ink-subtle">
            <Link to="/architecture" className="hover:text-ink transition-colors">How it works?</Link>
            <span className="text-surface-border">·</span>
            <a
              href="https://github.com/CodeTirtho97"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-ink transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              @CodeTirtho97
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
