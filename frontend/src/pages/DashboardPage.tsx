import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { reposApi } from '../api/repos'
import { chatApi } from '../api/chat'
import type { Repository, ApiEndpoint, ChatSession, ChatMessage } from '../types'
import Header from '../components/Header'
import Spinner from '../components/Spinner'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'guide' | 'api' | 'deps'

// ─── Tech badge colours ───────────────────────────────────────────────────────

const TECH_COLORS: Record<string, string> = {
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

function techColor(tech: string) {
  return TECH_COLORS[tech.toLowerCase().replace(/[\s\-_.]/g, '')] ?? 'bg-violet-400/15 text-violet-300 border-violet-400/20'
}

// ─── Method colours ───────────────────────────────────────────────────────────

const METHOD_STYLE: Record<string, string> = {
  GET:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
  POST:   'bg-blue-500/10 text-blue-400 border-blue-500/25',
  PUT:    'bg-amber-500/10 text-amber-400 border-amber-500/25',
  DELETE: 'bg-red-500/10 text-red-400 border-red-500/25',
  PATCH:  'bg-purple-500/10 text-purple-400 border-purple-500/25',
}
function methodStyle(m: string | null) {
  return METHOD_STYLE[(m ?? '').toUpperCase()] ?? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/25'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ h = 'h-4', w = 'w-full' }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} skeleton rounded-lg`} />
}
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in pt-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-20 skeleton rounded-xl" />)}
      </div>
      <div className="space-y-3">
        <Sk h="h-3" w="w-24" /><Sk h="h-6" w="w-3/4" /><Sk /><Sk w="w-5/6" />
        <div className="flex gap-2 pt-1">{[1,2,3,4].map(i => <Sk key={i} h="h-7" w="w-20" />)}</div>
      </div>
    </div>
  )
}

// ─── Shared empty state ───────────────────────────────────────────────────────

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
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

// ─── Tab 1: Overview ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle mb-3 flex items-center gap-2">
      <span className="w-4 h-px bg-gradient-to-r from-ink-subtle to-transparent inline-block" />
      {children}
    </p>
  )
}

function StatCard({ value, label, description, icon, accent, iconBg, footer, isEmpty }: {
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

function OverviewTab({ repo }: { repo: Repository }) {
  const summary = repo.summary
  const endpoints = repo.api_endpoints ?? []
  const endpointCount = endpoints.length
  const depCount = repo.dependencies ? Object.keys(repo.dependencies).length : 0
  const langCount = summary?.stack?.length ?? 0

  // Method breakdown for API endpoints footer
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
    <div className="space-y-8 pb-10">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Chunks */}
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

        {/* Technologies */}
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

        {/* API endpoints */}
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

        {/* Dep-tracked files */}
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
          body="The repository summary failed to generate. Use the Ask AI tab to explore this codebase directly."
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

          {/* Entry points + Architecture side by side */}
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

// ─── Tab 2: Ask AI ────────────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  'Where should I start?',
  'How does the architecture work?',
  'What are the main API endpoints?',
  'How is data stored?',
]

function AskAITab({ repoId, onRateLimitsChange }: { repoId: string; onRateLimitsChange?: (limits: { today: number; session: number }) => void }) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sourcesOpen, setSourcesOpen] = useState<Record<string, boolean>>({})
  const [rateLimits, setRateLimits] = useState({ today: 0, session: 0 })

  const [loadingSessions, setLoadingSessions] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // Load sessions on tab open
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const loaded = await chatApi.getSessions(repoId)
        setSessions(loaded)
        if (loaded.length > 0 && !activeSessionId) {
          setActiveSessionId(loaded[0].id)
        }
      } catch (err) {
        console.error('Failed to load sessions', err)
      } finally {
        setLoadingSessions(false)
      }
    }
    loadSessions()
  }, [repoId])

  // Load messages for active session
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([])
      return
    }
    const loadMessages = async () => {
      try {
        const loaded = await chatApi.getMessages(activeSessionId)
        setMessages(loaded)
        scrollToBottom()
      } catch (err) {
        console.error('Failed to load messages', err)
      }
    }
    loadMessages()
  }, [activeSessionId])

  const handleNewSession = async () => {
    try {
      const newSession = await chatApi.createSession(repoId)
      setSessions(prev => [newSession, ...prev])
      setActiveSessionId(newSession.id)
      setError(null)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create session')
    }
  }

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await chatApi.deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter(s => s.id !== sessionId)
        setActiveSessionId(remaining.length > 0 ? remaining[0].id : null)
      }
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete session', err)
    }
  }

  const handleSubmit = async () => {
    const q = question.trim()
    if (!q || loading || !activeSessionId) return

    // Optimistically show user message immediately
    const tempId = `temp-${Date.now()}`
    const optimisticMsg: ChatMessage = {
      id: tempId,
      session_id: activeSessionId,
      role: 'user',
      content: q,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])
    setQuestion('')
    scrollToBottom()

    setLoading(true)
    setError(null)
    try {
      const res = await chatApi.ask(activeSessionId, q)

      // Replace optimistic message with real one, append AI response
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempId),
        res.question_message,
        res.answer_message,
      ])

      // Update rate limits
      const newLimits = { today: res.questions_today, session: res.questions_in_session }
      setRateLimits(newLimits)
      onRateLimitsChange?.(newLimits)

      // Update session in list
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId
          ? { ...s, message_count: res.questions_in_session }
          : s
      ))

      scrollToBottom()
    } catch (err: any) {
      // Remove optimistic message on failure so user can retry
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setQuestion(q)
      const detail = err.response?.data?.detail
      setError(detail || 'Failed to send message')
    } finally {
      setLoading(false)
    }
  }

  const charCount = question.length
  const charOk = charCount >= 1 && charCount <= 1000
  const atLimit = rateLimits.session >= 15 || rateLimits.today >= 30

  return (
    <div className="grid grid-cols-[280px_1fr] gap-0 h-full">
      {/* Sidebar: Sessions */}
      <div className="bg-surface-raised/50 overflow-hidden flex flex-col border-r border-surface-border">
        <div className="p-4 border-b border-surface-border/50 bg-surface-raised/50">
          <button
            onClick={handleNewSession}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-pink-600/70 hover:bg-pink-600 active:bg-pink-700 text-white text-xs font-bold transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingSessions ? (
            <div className="flex items-center justify-center h-full">
              <Spinner size="sm" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 text-center">
              <svg className="w-8 h-8 text-ink-muted mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-2m0 0l-4 2m4-2v2m6-12h.01M7 20h10a2 2 0 002-2V9a2 2 0 00-2-2H7a2 2 0 00-2 2v9a2 2 0 002 2z"/>
              </svg>
              <p className="text-xs text-ink-muted">No chats yet</p>
              <p className="text-[10px] text-ink-subtle mt-1">Start a new chat to begin</p>
            </div>
          ) : (
            <div className="space-y-1.5 p-3">
              {sessions.map(s => {
                // Truncate title to 2-4 words with ellipsis
                const words = s.title.split(' ')
                const truncatedTitle = words.slice(0, Math.min(4, words.length)).join(' ')
                const hasEllipsis = words.length > 4

                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSessionId(s.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left ${
                      activeSessionId === s.id
                        ? 'border-accent/40 bg-accent/10 text-ink font-medium'
                        : 'border-surface-border/40 bg-surface-raised/20 text-ink-muted hover:text-ink hover:border-surface-border/60 hover:bg-surface-raised/40'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium truncate block">
                        {truncatedTitle}{hasEllipsis ? '...' : ''}
                      </span>
                    </div>
                    <span className={`text-[10px] whitespace-nowrap shrink-0 ${s.message_count >= 13 ? 'text-red-400' : s.message_count >= 10 ? 'text-yellow-400' : 'text-ink-subtle'}`}>
                      {s.message_count}/15 asked
                    </span>
                    {activeSessionId === s.id && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setDeleteConfirm(s.id)
                        }}
                        className="ml-2 p-1 text-ink-subtle hover:text-red-400 transition-colors shrink-0"
                        title="Delete chat"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main: Chat window */}
      <div className="bg-surface-card overflow-hidden flex flex-col">
        {!activeSessionId ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-sm text-ink-muted">Select or create a chat to start</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="px-6 py-4 border-b border-surface-border/50 bg-surface-raised/50">
              <p className="text-sm font-semibold text-ink">
                {sessions.find(s => s.id === activeSessionId)?.title || 'Chat'}
              </p>
            </div>

            {/* Messages & Suggestions */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 flex flex-col">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-sm text-ink-muted mb-6">Try asking about this codebase:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {SUGGESTED_QUESTIONS.map(q => (
                      <button
                        key={q}
                        onClick={() => {
                          setQuestion(q)
                          setTimeout(() => inputRef.current?.focus(), 0)
                        }}
                        className="text-xs px-3 py-2 rounded-lg border border-surface-border/60 bg-surface-raised/30 text-ink-muted hover:text-ink hover:border-pink-500/40 hover:bg-pink-500/5 transition-all text-left"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map(m => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/20 flex items-center justify-center shrink-0 mr-3">
                        <svg className="w-4 h-4 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
                        </svg>
                      </div>
                    )}

                    <div className={`${m.role === 'user' ? 'max-w-xs' : 'max-w-2xl'} ${m.role === 'user' ? 'bg-surface-raised' : 'bg-surface-card'} border border-surface-border rounded-2xl ${m.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'} px-4 py-3 break-words`}>
                      <div className={m.role === 'user' ? 'text-sm text-ink break-words' : 'ai-response'}>
                        {m.role === 'user' ? (
                          m.content
                        ) : (
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        )}
                      </div>

                      {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-surface-border">
                          <button
                            onClick={() => setSourcesOpen(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                            className="flex items-center gap-2 text-[10px] font-medium text-ink-muted hover:text-ink transition-colors"
                          >
                            <svg className={`w-3 h-3 transition-transform ${sourcesOpen[m.id] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                            </svg>
                            {m.sources.length} source{m.sources.length !== 1 ? 's' : ''}
                          </button>
                          {sourcesOpen[m.id] && (
                            <div className="mt-2 space-y-1">
                              {m.sources.map((s, i) => (
                                <div key={i} className="text-[10px] text-ink-muted px-2 py-1 bg-surface-raised rounded border border-surface-border/50">
                                  <code className="block truncate">{s.file_path}</code>
                                  {s.line_start && <span className="text-ink-subtle">{s.line_start}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  ))}

                  {/* Typing indicator */}
                  {loading && (
                    <div className="flex justify-start items-end gap-3">
                      <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
                        </svg>
                      </div>
                      <div className="bg-surface-card border border-pink-500/20 rounded-2xl rounded-tl-sm px-5 py-3.5 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-pink-400 dot-wave" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 rounded-full bg-pink-400 dot-wave" style={{ animationDelay: '180ms' }} />
                          <span className="w-2 h-2 rounded-full bg-pink-400 dot-wave" style={{ animationDelay: '360ms' }} />
                        </div>
                        <span className="text-[10px] text-pink-400/60 font-medium tracking-wide thinking-label">
                          Thinking…
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="px-6 py-4 border-t border-surface-border/50 bg-surface-raised/50">
              {error && (
                <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                  {error}
                </div>
              )}
              {atLimit && (
                <div className="mb-3 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded px-3 py-2">
                  {rateLimits.session >= 15 ? '15 messages per session reached' : '30 questions per day reached'}
                </div>
              )}
              <div className={`rounded-xl border transition-colors ${atLimit ? 'border-surface-border/40 opacity-60' : 'border-surface-border focus-within:border-pink-500/50 focus-within:ring-1 focus-within:ring-pink-500/20'} bg-surface-raised overflow-hidden`}>
                <textarea
                  ref={inputRef}
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
                  placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
                  rows={1}
                  disabled={loading || atLimit}
                  className="w-full bg-transparent px-4 pt-3 pb-2 text-sm text-ink placeholder-ink-subtle focus:outline-none resize-none disabled:opacity-50"
                />
                <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                  <span className={`text-[10px] font-mono transition-colors ${charCount > 900 ? 'text-yellow-400' : 'text-ink-subtle'}`}>
                    {charCount > 0 ? `${charCount}/1000` : ''}
                  </span>
                  <button
                    onClick={handleSubmit}
                    disabled={loading || !charOk || atLimit || !activeSessionId}
                    title={loading ? 'Thinking…' : atLimit ? 'Rate limit reached' : !activeSessionId ? 'Select a chat first' : !charOk ? 'Type a message to send' : 'Send (Enter)'}
                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      loading || !charOk || atLimit || !activeSessionId
                        ? 'bg-surface-card text-ink-subtle border border-surface-border/50 cursor-not-allowed'
                        : 'bg-pink-500 hover:bg-pink-400 active:scale-95 text-white shadow-sm shadow-pink-500/30 cursor-pointer'
                    }`}
                  >
                    {loading ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" fill="none" />
                          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Thinking…
                      </>
                    ) : (
                      <>
                        Send
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-6 max-w-sm">
            <p className="text-sm font-semibold text-ink mb-4">Delete this chat?</p>
            <p className="text-xs text-ink-muted mb-6">All messages will be removed. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-surface-border text-ink text-sm hover:bg-surface-raised transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSession(deleteConfirm)}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-white text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab 3: Guide ─────────────────────────────────────────────────────────────

const STEP_ACCENTS = [
  { border: 'border-blue-500/50',    bg: 'bg-blue-500/10',    text: 'text-blue-400'    },
  { border: 'border-violet-500/50',  bg: 'bg-violet-500/10',  text: 'text-violet-400'  },
  { border: 'border-emerald-500/50', bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  { border: 'border-amber-500/50',   bg: 'bg-amber-500/10',   text: 'text-amber-400'   },
  { border: 'border-pink-500/50',    bg: 'bg-pink-500/10',    text: 'text-pink-400'    },
  { border: 'border-cyan-500/50',    bg: 'bg-cyan-500/10',    text: 'text-cyan-400'    },
]

function GuideTab({ repo }: { repo: Repository }) {
  const guide = repo.onboarding

  if (!guide) return (
    <EmptyState
      icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"/></svg>}
      title="Onboarding guide not available"
      body="The guide generation failed for this repo. Switch to the Ask AI tab and ask 'Where should I start?' for a personalized walkthrough."
    />
  )

  return (
    <div className="space-y-10 pb-10">

      {/* ── Learning steps ── */}
      {guide.steps && guide.steps.length > 0 && (
        <div>
          <SectionLabel>Learning steps</SectionLabel>
          <div className="relative space-y-3 mt-1">
            {/* Connector line */}
            <div className="absolute left-[19px] top-10 bottom-10 w-px bg-gradient-to-b from-surface-border via-surface-border/40 to-transparent pointer-events-none" />

            {guide.steps.map((step, i) => {
              const accent = STEP_ACCENTS[i % STEP_ACCENTS.length]
              const num = step.order ?? i + 1
              return (
                <div key={num} className="relative flex gap-4 group">
                  {/* Badge */}
                  <div className={`w-10 h-10 rounded-xl border-2 ${accent.border} ${accent.bg} flex items-center justify-center text-sm font-bold ${accent.text} shrink-0 z-10 relative transition-all group-hover:scale-105`}>
                    {num}
                  </div>
                  {/* Card */}
                  <div className="flex-1 min-w-0 rounded-2xl border border-surface-border bg-surface-card p-5 group-hover:border-surface-border/80 transition-colors">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${accent.text} opacity-70`}>Step {num}</span>
                    <p className="text-sm font-bold text-ink mt-1 mb-2 leading-snug">{step.title}</p>
                    {step.description && (
                      <p className="text-xs text-ink-muted leading-relaxed mb-4">{step.description}</p>
                    )}
                    {step.files && step.files.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {step.files.map(f => (
                          <span key={f} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${accent.border} ${accent.bg} text-[11px] font-mono ${accent.text}`}>
                            <svg className="w-3 h-3 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
                            </svg>
                            {f}
                          </span>
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

      {/* ── Core workflows ── */}
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Suggested learning path ── */}
      {guide.learning_path && (
        <div>
          <SectionLabel>Suggested learning path</SectionLabel>
          <div className="relative rounded-2xl overflow-hidden border border-emerald-500/25">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/8 via-transparent to-teal-500/5 pointer-events-none" />
            <div className="relative flex gap-4 p-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"/>
                </svg>
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Where to begin</p>
                <p className="text-sm text-ink-muted leading-relaxed">{guide.learning_path}</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── Tab 4: API Map ───────────────────────────────────────────────────────────

const METHOD_TABS = ['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const
type MethodFilter = typeof METHOD_TABS[number]

function ApiMapTab({ repo }: { repo: Repository }) {
  const [filter, setFilter] = useState<MethodFilter>('ALL')
  const [search, setSearch] = useState('')
  const endpoints = repo.api_endpoints ?? []

  const methodCounts = useMemo(() =>
    endpoints.reduce((acc, ep) => {
      const m = (ep.method ?? 'UNKNOWN').toUpperCase()
      acc[m] = (acc[m] ?? 0) + 1; return acc
    }, {} as Record<string, number>)
  , [endpoints])

  const visible = useMemo(() => endpoints.filter(ep => {
    const matchM = filter === 'ALL' || (ep.method ?? '').toUpperCase() === filter
    const matchS = !search || (ep.path ?? '').toLowerCase().includes(search.toLowerCase()) || ep.file_path.toLowerCase().includes(search.toLowerCase())
    return matchM && matchS
  }), [endpoints, filter, search])

  const grouped = useMemo(() => {
    const map = new Map<string, ApiEndpoint[]>()
    visible.forEach(ep => { if (!map.has(ep.file_path)) map.set(ep.file_path, []); map.get(ep.file_path)!.push(ep) })
    return map
  }, [visible])

  if (endpoints.length === 0) return (
    <EmptyState
      icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg>}
      title="No API endpoints detected"
      body="Endpoint detection works for Python (FastAPI/Flask), Node (Express), Java (Spring), and Go. Frontend-only repos, Chrome extensions, and libraries will show nothing here."
    />
  )

  return (
    <div className="space-y-5 pb-10">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* ALL pill */}
        <button
          onClick={() => setFilter('ALL')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            filter === 'ALL'
              ? 'bg-surface-card border-surface-border text-ink shadow-sm'
              : 'border-transparent text-ink-subtle hover:text-ink hover:border-surface-border/60'
          }`}
        >
          All
          <span className="text-[10px] bg-surface-raised border border-surface-border/50 px-1.5 py-0.5 rounded-full font-mono">{endpoints.length}</span>
        </button>

        {/* Per-method pills */}
        {Object.entries(methodCounts).map(([method, count]) => {
          const active = filter === method
          return (
            <button
              key={method}
              onClick={() => setFilter(active ? 'ALL' : method as MethodFilter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                active
                  ? methodStyle(method) + ' shadow-sm'
                  : 'border-surface-border/60 bg-surface-card text-ink-muted hover:text-ink hover:border-surface-border'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-current' : 'bg-ink-subtle/50'}`} />
              {method}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${active ? 'bg-current/20' : 'bg-surface-raised'}`}>{count}</span>
            </button>
          )
        })}

        {/* Search */}
        <div className="sm:ml-auto relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-subtle pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
          </svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search path or file…"
            className="bg-surface-raised border border-surface-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-subtle focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors w-52"
          />
        </div>
      </div>

      {/* ── Endpoint groups ── */}
      {visible.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-ink-muted text-sm">No endpoints match this filter.</div>
      ) : (
        <div className="space-y-3">
          {Array.from(grouped.entries()).map(([filePath, eps]) => (
            <div key={filePath} className="rounded-2xl border border-surface-border overflow-hidden bg-surface-card">
              {/* File header */}
              <div className="flex items-center gap-2.5 px-4 py-3 bg-surface-raised/70 border-b border-surface-border">
                <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
                  </svg>
                </div>
                <code className="text-xs font-mono text-ink font-semibold flex-1 truncate">{filePath}</code>
                <span className="text-[10px] font-semibold text-ink-subtle bg-surface-card border border-surface-border/60 px-2 py-0.5 rounded-full">
                  {eps.length} route{eps.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Endpoint rows */}
              <div className="divide-y divide-surface-border/50">
                {eps.map((ep, i) => {
                  const m = (ep.method ?? 'UNKNOWN').toUpperCase()
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-raised/30 transition-colors group">
                      {/* Method badge */}
                      <span className={`shrink-0 text-[10px] font-black px-2.5 py-1 rounded-lg border font-mono tracking-wider min-w-[52px] text-center ${methodStyle(m)}`}>
                        {m}
                      </span>

                      {/* Path */}
                      <code className="text-sm font-mono text-ink flex-1 min-w-0 truncate">
                        {ep.path ?? <span className="text-ink-subtle italic">unknown path</span>}
                      </code>

                      {/* Meta: function + line */}
                      <div className="hidden sm:flex items-center gap-2 shrink-0">
                        {ep.function_name && (
                          <span className="text-[11px] font-mono text-ink-subtle bg-surface-raised border border-surface-border/60 px-2 py-0.5 rounded-md opacity-60 group-hover:opacity-100 transition-opacity">
                            {ep.function_name}()
                          </span>
                        )}
                        {ep.line > 0 && (
                          <span className="text-[10px] font-mono text-ink-subtle bg-surface-raised border border-surface-border/60 px-2 py-0.5 rounded-md">
                            L{ep.line}
                          </span>
                        )}
                      </div>

                      {/* Copy */}
                      <button
                        onClick={() => navigator.clipboard.writeText(ep.path ?? '')}
                        title="Copy path"
                        className="shrink-0 p-1.5 rounded-lg text-ink-subtle opacity-0 group-hover:opacity-100 hover:text-ink hover:bg-surface-raised transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"/>
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer count */}
      <p className="text-[11px] text-ink-subtle text-right">
        {visible.length} of {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''}
        {grouped.size > 0 && <> across {grouped.size} file{grouped.size !== 1 ? 's' : ''}</>}
      </p>
    </div>
  )
}

// ─── Tab 5: Dependencies ──────────────────────────────────────────────────────

const RANK_STYLE = [
  { badge: 'bg-amber-500/20 border-amber-500/40 text-amber-300',  accent: 'from-amber-500/70 to-amber-400/20',  label: 'text-amber-400'  },
  { badge: 'bg-slate-400/15 border-slate-400/30 text-slate-300',  accent: 'from-slate-400/60 to-slate-400/15',  label: 'text-slate-400'  },
  { badge: 'bg-orange-600/20 border-orange-500/30 text-orange-400', accent: 'from-orange-600/60 to-orange-500/15', label: 'text-orange-400' },
]

function DepRow({ filePath, uses, usedBy }: { filePath: string; uses: string[]; usedBy: string[] }) {
  const [open, setOpen] = useState(false)
  const total = uses.length + usedBy.length
  const isHub = total >= 5
  const canOpen = total > 0

  return (
    <div className="border-b border-surface-border/40 last:border-0">
      <button
        disabled={!canOpen}
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${canOpen ? 'hover:bg-surface-raised/40 cursor-pointer group' : 'cursor-default opacity-60'}`}
      >
        {/* Chevron */}
        <svg className={`w-3.5 h-3.5 text-ink-subtle shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''} ${!canOpen ? 'opacity-0' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
        </svg>

        {/* File path */}
        <code className="text-xs font-mono text-ink flex-1 min-w-0 truncate">{filePath}</code>

        {/* Badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isHub && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25 tracking-wide">HUB</span>
          )}
          {usedBy.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
              <span className="text-[9px]">↑</span>{usedBy.length}
            </span>
          )}
          {uses.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
              <span className="text-[9px]">↓</span>{uses.length}
            </span>
          )}
        </div>
      </button>

      {open && canOpen && (
        <div className="mx-4 mb-3 mt-0.5 rounded-xl border border-surface-border overflow-hidden animate-fade-in">
          {usedBy.length > 0 && (
            <div className="px-4 py-3 border-b border-surface-border/50">
              <p className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">
                <span className="w-3 h-px bg-emerald-500/50 inline-block"/>
                Imported by · {usedBy.length} file{usedBy.length !== 1 ? 's' : ''}
              </p>
              <div className="flex flex-col gap-1">
                {usedBy.map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-emerald-500/50 shrink-0"/>
                    <code className="text-[11px] font-mono text-ink-muted">{f}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
          {uses.length > 0 && (
            <div className="px-4 py-3">
              <p className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">
                <span className="w-3 h-px bg-blue-500/50 inline-block"/>
                Imports · {uses.length} file{uses.length !== 1 ? 's' : ''}
              </p>
              <div className="flex flex-col gap-1">
                {uses.map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-blue-500/50 shrink-0"/>
                    <code className="text-[11px] font-mono text-ink-muted">{f}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DepsTab({ repo }: { repo: Repository }) {
  const deps = repo.dependencies
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const PAGE = 30

  const allEntries = useMemo(() => {
    if (!deps) return []
    return Object.entries(deps)
      .sort((a, b) => (b[1].uses.length + b[1].used_by.length) - (a[1].uses.length + a[1].used_by.length))
  }, [deps])

  const entries = useMemo(() =>
    allEntries.filter(([p]) => !search || p.toLowerCase().includes(search.toLowerCase()))
  , [allEntries, search])

  const topFiles = useMemo(() => allEntries.slice(0, 3), [allEntries])
  const visible = showAll ? entries : entries.slice(0, PAGE)

  if (!deps || Object.keys(deps).length === 0) return (
    <EmptyState
      icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/></svg>}
      title="No dependency data for this repo"
      body="Dependency tracking requires Python · JavaScript · TypeScript · Java · Go. This repo appears to use other languages or has no cross-file imports."
    />
  )

  return (
    <div className="space-y-6 pb-10">

      {/* ── Top 3 cards ── */}
      {topFiles.length > 0 && (
        <div>
          <SectionLabel>Most connected files</SectionLabel>
          <div className="grid sm:grid-cols-3 gap-3">
            {topFiles.map(([fp, dep], i) => {
              const total = dep.uses.length + dep.used_by.length
              const rank = RANK_STYLE[i]
              const usedByPct = total > 0 ? Math.round((dep.used_by.length / total) * 100) : 0
              return (
                <div key={fp} className="relative rounded-2xl border border-surface-border bg-surface-card overflow-hidden flex flex-col">
                  {/* top accent */}
                  <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${rank.accent}`} />
                  <div className="p-5 flex flex-col gap-3 flex-1">
                    {/* Rank + total */}
                    <div className="flex items-center justify-between">
                      <span className={`w-7 h-7 rounded-lg border text-xs font-black flex items-center justify-center ${rank.badge}`}>
                        {i + 1}
                      </span>
                      <span className={`text-xl font-bold tracking-tight ${rank.label}`}>{total}
                        <span className="text-xs font-normal text-ink-subtle ml-1">links</span>
                      </span>
                    </div>

                    {/* File name + path */}
                    <div>
                      <code className="text-sm font-mono font-semibold text-ink block truncate" title={fp}>
                        {fp.split('/').pop()}
                      </code>
                      <p className="text-[10px] text-ink-subtle font-mono truncate mt-0.5">{fp}</p>
                    </div>

                    {/* Stat chips */}
                    <div className="flex gap-2">
                      {dep.used_by.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg">
                          ↑ {dep.used_by.length} import it
                        </span>
                      )}
                      {dep.uses.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg">
                          ↓ {dep.uses.length} imported
                        </span>
                      )}
                    </div>

                    {/* Ratio bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] text-ink-subtle">
                        <span>imported by</span>
                        <span>imports</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-raised overflow-hidden flex">
                        <div className="h-full bg-emerald-500/60 transition-all" style={{ width: `${usedByPct}%` }} />
                        <div className="h-full bg-blue-500/60 flex-1" />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Legend + search toolbar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            ↑ Imported by other files
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
            ↓ Imports other files
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-full">
            HUB ≥5 connections
          </span>
        </div>

        {/* Search */}
        <div className="sm:ml-auto relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-subtle pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
          </svg>
          <input
            type="text" value={search}
            onChange={e => { setSearch(e.target.value); setShowAll(false) }}
            placeholder="Filter by file path…"
            className="bg-surface-raised border border-surface-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink placeholder-ink-subtle focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors w-56"
          />
        </div>
      </div>

      {/* ── File list ── */}
      <div className="rounded-2xl border border-surface-border overflow-hidden bg-surface-card">
        {entries.length === 0
          ? <p className="text-sm text-ink-muted text-center py-10">No files match.</p>
          : <>
              {visible.map(([fp, dep]) => (
                <DepRow key={fp} filePath={fp} uses={dep.uses ?? []} usedBy={dep.used_by ?? []} />
              ))}
              {!showAll && entries.length > PAGE && (
                <div className="px-4 py-3 border-t border-surface-border bg-surface-raised/30">
                  <button
                    onClick={() => setShowAll(true)}
                    className="text-xs text-accent hover:text-ink transition-colors font-medium"
                  >
                    Show {entries.length - PAGE} more files…
                  </button>
                </div>
              )}
            </>
        }
      </div>

      <p className="text-[11px] text-ink-subtle text-right">
        {entries.length} of {allEntries.length} file{allEntries.length !== 1 ? 's' : ''} tracked
      </p>
    </div>
  )
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

interface TabDef { id: TabId; label: string; icon: React.ReactNode; special?: boolean }

const TABS: TabDef[] = [
  {
    id: 'overview', label: 'Overview',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>,
  },
  {
    id: 'guide', label: 'Guide',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"/></svg>,
  },
  {
    id: 'api', label: 'API Map',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg>,
  },
  {
    id: 'deps', label: 'Dependencies',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/></svg>,
  },
]

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { repoId } = useParams<{ repoId: string }>()
  const navigate = useNavigate()
  const [repo, setRepo] = useState<Repository | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const [rateLimits, setRateLimits] = useState({ today: 0, session: 0 })

  useEffect(() => {
    if (!repoId) return
    setLoading(true)
    reposApi.get(repoId)
      .then(setRepo)
      .catch(err => setError(err.response?.status === 404 ? 'Repository not found.' : 'Failed to load repository.'))
      .finally(() => setLoading(false))
  }, [repoId])

  if (loading) return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6"><DashboardSkeleton /></main>
    </div>
  )

  if (error || !repo) return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-red-400 mb-4">{error ?? 'Repository not found.'}</p>
          <Link to="/" className="text-xs text-ink-muted hover:text-ink transition-colors">← Back to home</Link>
        </div>
      </main>
    </div>
  )

  if (repo.status === 'pending' || repo.status === 'running') return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header repoName={repo.name} repoUrl={repo.github_url} />
      <main className="flex-1 flex items-center justify-center p-8 text-center">
        <div><Spinner size="lg" className="mx-auto mb-4" /><p className="text-sm text-ink-muted">Still indexing…</p></div>
      </main>
    </div>
  )

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header repoName={repo.name} repoUrl={repo.github_url} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Repo hero header */}
        <div className="mb-6">
          {/* Back nav */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-xs font-semibold text-ink-muted hover:text-ink bg-surface-raised hover:bg-surface-border border border-surface-border hover:border-surface-border/80 px-3 py-1.5 rounded-lg transition-all mb-5 group"
          >
            <svg className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            All repositories
          </button>

          {/* Identity row */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-surface-raised border border-surface-border flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-ink-muted" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-ink leading-tight truncate">
                  {repo.github_url.replace('https://github.com/', '')}
                </h1>
                <a
                  href={repo.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-ink-subtle hover:text-blue-400 transition-colors font-mono flex items-center gap-1 mt-0.5"
                >
                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/>
                  </svg>
                  {repo.github_url}
                </a>
              </div>
            </div>

            {/* Right: status + stats */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Indexed
              </span>
              {repo.chunk_count > 0 && (
                <span className="text-[11px] font-medium text-ink-muted bg-surface-raised border border-surface-border px-2.5 py-1 rounded-full">
                  {repo.chunk_count.toLocaleString()} chunks
                </span>
              )}
              {repo.summary?.stack?.slice(0, 3).map(t => (
                <span key={t} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${techColor(t)}`}>{t}</span>
              ))}
              {(repo.summary?.stack?.length ?? 0) > 3 && (
                <span className="text-[11px] text-ink-subtle bg-surface-raised border border-surface-border px-2.5 py-1 rounded-full">
                  +{(repo.summary?.stack?.length ?? 0) - 3} more
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-3 mb-6">
          {/* Pill segment control */}
          <div className="flex items-center gap-0.5 bg-surface-raised/60 border border-surface-border rounded-xl p-1 overflow-x-auto flex-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-all duration-200 shrink-0 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-surface-card border border-surface-border text-ink shadow-sm'
                    : 'text-ink-subtle hover:text-ink hover:bg-surface-card/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Ask AI button */}
          <button
            onClick={() => setChatModalOpen(true)}
            title="Open Ask AI chat"
            className="group flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl shrink-0 text-white transition-all duration-200
              bg-gradient-to-br from-pink-500 to-pink-600
              hover:from-pink-400 hover:to-pink-500
              shadow-md shadow-pink-500/25 hover:shadow-lg hover:shadow-pink-500/35
              active:scale-95"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
            </svg>
            Ask AI
          </button>
        </div>

        {/* Tab content */}
        <div className="animate-fade-in" key={activeTab}>
          {activeTab === 'overview' && <OverviewTab repo={repo} />}
          {activeTab === 'guide'    && <GuideTab repo={repo} />}
          {activeTab === 'api'      && <ApiMapTab repo={repo} />}
          {activeTab === 'deps'     && <DepsTab repo={repo} />}
        </div>
      </main>

      {/* Ask AI Modal */}
      {chatModalOpen && repoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-card border border-surface-border rounded-2xl w-full max-w-6xl h-[85vh] overflow-hidden flex flex-col shadow-2xl shadow-black/60 animate-slide-up">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-surface-border bg-surface-raised/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-pink-500/15 border border-pink-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-ink">Ask AI</h2>
                  <p className="text-xs text-ink-subtle">Instant answers from your indexed codebase</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Daily counter */}
                <span className={`text-[11px] font-medium px-2.5 py-1 rounded-md border whitespace-nowrap transition-colors ${
                  rateLimits.today >= 28
                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                    : rateLimits.today >= 20
                    ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
                    : 'bg-surface-raised border-surface-border/50 text-ink-muted'
                }`} title="Prompts asked today across all chats (max 30 per day)">
                  <span className="font-bold">{rateLimits.today}</span>
                  <span className="opacity-60">/30</span>
                  <span className="ml-1 opacity-70">today</span>
                </span>
                <button
                  onClick={() => setChatModalOpen(false)}
                  className="p-1.5 rounded-lg text-ink-subtle hover:text-ink hover:bg-surface-raised transition-colors"
                  title="Close chat"
                >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
              </div>
            </div>

            {/* Modal content */}
            <div className="flex-1 overflow-hidden">
              <AskAITab repoId={repoId} onRateLimitsChange={setRateLimits} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
