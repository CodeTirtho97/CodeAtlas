import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { chatApi } from '../../api/chat'
import type { Repository, ChatSession, ChatMessage, SourceCitation, StreamEvent } from '../../types'
import Spinner from '../Spinner'

const SUGGESTED_QUESTIONS = [
  'Where should I start?',
  'How does the architecture work?',
  'What are the main API endpoints?',
  'How is data stored?',
]

interface Props {
  repoId: string
  repo: Repository
  onRateLimitsChange?: (limits: { today: number; session: number }) => void
  initialQuestion?: string
}

export default function AskAIWorkspace({ repoId, repo, onRateLimitsChange, initialQuestion }: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sourcesOpen, setSourcesOpen] = useState<Record<string, boolean>>({})
  const [rateLimits, setRateLimits] = useState({ today: 0, session: 0 })
  const [inspectedMessageId, setInspectedMessageId] = useState<string | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [userExpandedEvidence, setUserExpandedEvidence] = useState(false)
  const [previewOpen, setPreviewOpen] = useState<Record<string, boolean>>({})
  const [streamingMsg, setStreamingMsg] = useState<{ content: string; sources: SourceCitation[] } | null>(null)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [])

  // Pre-fill the input when navigated from another tab — user submits manually
  useEffect(() => {
    if (initialQuestion) {
      setQuestion(initialQuestion)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [initialQuestion])

  useEffect(() => {
    const loadSessions = async () => {
      try {
        const loaded = await chatApi.getSessions(repoId)
        setSessions(loaded)
        if (loaded.length > 0) {
          setActiveSessionId(loaded[0].id)
        } else if (initialQuestion) {
          // No sessions + incoming question — silently create one so Send is enabled
          const newSession = await chatApi.createSession(repoId)
          setSessions([newSession])
          setActiveSessionId(newSession.id)
        }
      } catch (err) {
        console.error('Failed to load sessions', err)
      } finally {
        setLoadingSessions(false)
      }
    }
    loadSessions()
  // initialQuestion captured at mount via closure — intentionally omitted from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId])

  useEffect(() => {
    if (!activeSessionId) { setMessages([]); return }
    const loadMessages = async () => {
      try {
        const loaded = await chatApi.getMessages(activeSessionId)
        setMessages(loaded)
        const latestAssistant = [...loaded].reverse().find(m => m.role === 'assistant')
        setInspectedMessageId(latestAssistant?.id ?? null)
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

    const tempId = `temp-${Date.now()}`
    setMessages(prev => [...prev, {
      id: tempId, session_id: activeSessionId, role: 'user' as const,
      content: q, created_at: new Date().toISOString(),
    }])
    setQuestion('')
    if (inputRef.current) inputRef.current.style.height = ''
    setStreamingMsg(null)
    scrollToBottom()

    setLoading(true)
    setError(null)

    // Accumulate in local vars — avoids stale-closure issues inside the event callback
    let accContent = ''
    let accSources: SourceCitation[] = []
    // Scalar captures for done-event fields (avoids TS narrowing-to-never on let objects)
    let doneMsgId = `asst-${Date.now()}`
    let doneUserMsgId = tempId
    let doneQuestionsToday = 0
    let doneQuestionsInSession = 0

    try {
      await chatApi.streamAsk(activeSessionId, q, (evt: StreamEvent) => {
        if (evt.type === 'sources') {
          accSources = evt.sources
          setStreamingMsg({ content: '', sources: accSources })
          if (accSources.length > 0) setEvidenceOpen(true)
          scrollToBottom()
        } else if (evt.type === 'token') {
          accContent += evt.content
          setStreamingMsg({ content: accContent, sources: accSources })
          scrollToBottom()
        } else if (evt.type === 'done') {
          doneMsgId = evt.message_id
          doneUserMsgId = evt.user_message_id
          doneQuestionsToday = evt.questions_today
          doneQuestionsInSession = evt.questions_in_session
        }
      })

      setMessages(prev => [
        ...prev.filter(m => m.id !== tempId),
        { id: doneUserMsgId, session_id: activeSessionId, role: 'user' as const,      content: q,           created_at: new Date().toISOString() },
        { id: doneMsgId,     session_id: activeSessionId, role: 'assistant' as const, content: accContent, sources: accSources, created_at: new Date().toISOString() },
      ])
      setInspectedMessageId(doneMsgId)
      setStreamingMsg(null)

      const newLimits = { today: doneQuestionsToday, session: doneQuestionsInSession }
      setRateLimits(newLimits)
      onRateLimitsChange?.(newLimits)

      if (doneQuestionsInSession === 1) {
        try {
          const updated = await chatApi.getSessions(repoId)
          setSessions(updated)
        } catch {
          setSessions(prev => prev.map(s =>
            s.id === activeSessionId
              ? { ...s, message_count: 1, title: q.length > 45 ? q.slice(0, 45) + '…' : q }
              : s
          ))
        }
      } else {
        setSessions(prev => prev.map(s =>
          s.id === activeSessionId ? { ...s, message_count: doneQuestionsInSession } : s
        ))
      }
      scrollToBottom()
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setStreamingMsg(null)
      setQuestion(q)
      const status: number = err.status ?? err.response?.status
      const detail: string = err.message ?? err.response?.data?.detail ?? ''
      if (status === 429) {
        if (detail.includes('Daily limit'))   setError('daily_limit')
        else if (detail.includes('Session limit')) setError('session_limit')
        else setError(detail || 'Rate limit reached.')
      } else {
        setError(detail || 'Failed to send message')
      }
    } finally {
      setLoading(false)
    }
  }

  const charCount = question.length
  const charOk = charCount >= 1 && charCount <= 1000
  const atLimit = rateLimits.session >= 15 || rateLimits.today >= 30
  const latestAssistant = [...messages].reverse().find(m => m.role === 'assistant')
  const inspectedMessage = messages.find(m => m.id === inspectedMessageId && m.role === 'assistant') ?? latestAssistant
  const inspectedSources = inspectedMessage?.sources ?? streamingMsg?.sources ?? []

  return (
    <div className="h-full flex flex-col">
      {/* 3-col workspace — evidence panel width controlled by state */}
      <div className={`flex-1 grid grid-cols-1 min-h-0 overflow-hidden rounded-2xl border border-surface-border bg-surface-card transition-all duration-300 ease-out ${
        evidenceOpen
          ? 'xl:grid-cols-[180px_minmax(0,1fr)_260px]'
          : 'xl:grid-cols-[180px_minmax(0,1fr)]'
      }`}>

        {/* Left: Sessions rail */}
        <div className="overflow-hidden flex flex-col border-r border-surface-border">

          {/* New Chat — solid fill button with hover */}
          <div className="p-3 border-b border-surface-border">
            <button
              onClick={handleNewSession}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 active:bg-pink-700 active:scale-95 text-white text-xs font-bold transition-all shadow-sm shadow-pink-900/40"
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Chat
            </button>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {loadingSessions ? (
              <div className="flex items-center justify-center py-8 transition-opacity duration-200">
                <Spinner size="sm" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center animate-fade-in">
                <p className="text-xs font-medium text-ink-muted">No chats yet</p>
                <p className="text-[11px] text-ink-subtle mt-1">Click New Chat to start</p>
              </div>
            ) : <div className="space-y-2 animate-fade-in">{sessions.map(s => {
              const isActive = activeSessionId === s.id
              const countColor = s.message_count >= 13 ? 'text-red-400' : s.message_count >= 10 ? 'text-yellow-400' : 'text-ink-muted'
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSessionId(s.id)}
                  className={`group w-full flex flex-col gap-1.5 px-3 py-2.5 rounded-xl text-left transition-all border ${
                    isActive
                      ? 'border-pink-400/50'
                      : 'border-surface-border hover:border-pink-400/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className={`text-xs font-semibold leading-snug line-clamp-2 flex-1 ${isActive ? 'text-white' : 'text-ink'}`}>
                      {s.title}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteConfirm(s.id) }}
                      className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-all mt-0.5"
                      title="Delete chat"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <span className={`text-[10px] font-medium tabular-nums ${countColor}`}>
                    {s.message_count}/15 msgs
                  </span>
                </button>
              )
            })}</div>}
          </div>
        </div>

        {/* Center: Chat */}
        <div className="bg-surface-card overflow-hidden flex flex-col border-t border-surface-border xl:border-t-0 xl:border-r">
          {!activeSessionId && !loadingSessions ? (
            <div className="flex items-center justify-center h-full animate-fade-in">
              <div className="text-center">
                <p className="text-sm text-ink-muted">Select or create a chat to start</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-surface-border/50 bg-surface-raised/50 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink truncate">
                  {sessions.find(s => s.id === activeSessionId)?.title || 'Chat'}
                </p>
                {/* Evidence panel toggle — hidden when panel is open, with tooltip */}
                {!evidenceOpen && (
                  <div className="relative group hidden xl:block">
                    <button
                      onClick={() => { setEvidenceOpen(true); setUserExpandedEvidence(true) }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-surface-border text-ink-muted hover:text-ink hover:border-surface-border/80 text-[11px] font-semibold transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      Evidence
                      {inspectedSources.length > 0 && (
                        <span className="text-[10px] font-bold bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded-full">
                          {inspectedSources.length}
                        </span>
                      )}
                    </button>
                    {/* Info tooltip on button */}
                    <div className="hidden group-hover:block absolute right-0 top-8 w-56 bg-surface-card border border-surface-border rounded-xl p-3 text-[11px] text-ink-muted leading-relaxed z-20 shadow-2xl shadow-black/60">
                      Shows the exact code files and chunks the AI cited to generate each answer. Click any AI reply to inspect its sources.
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 flex flex-col">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full">
                    <p className="text-sm text-ink-muted mb-6">Try asking about this codebase:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {SUGGESTED_QUESTIONS.map(q => (
                        <button
                          key={q}
                          onClick={() => { setQuestion(q); setTimeout(() => inputRef.current?.focus(), 0) }}
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
                        <div
                          onClick={() => { if (m.role === 'assistant') setInspectedMessageId(m.id) }}
                          className={`${m.role === 'user' ? 'max-w-xs' : 'max-w-2xl'} ${m.role === 'user' ? 'bg-surface-raised' : 'bg-surface-card'} border ${m.role === 'assistant' && inspectedMessage?.id === m.id ? 'border-pink-500/40 shadow-[0_0_0_1px_rgba(236,72,153,0.15)]' : 'border-surface-border'} rounded-2xl ${m.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'} px-4 py-3 break-words ${m.role === 'assistant' ? 'cursor-pointer transition-colors hover:border-pink-500/30' : ''}`}
                        >
                          <div className={m.role === 'user' ? 'text-sm text-ink break-words' : 'ai-response'}>
                            {m.role === 'user' ? m.content : <ReactMarkdown>{m.content}</ReactMarkdown>}
                          </div>
                          {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-surface-border">
                              <button
                                onClick={() => setSourcesOpen(prev => ({ ...prev, [m.id]: !prev[m.id] }))}
                                className="flex items-center gap-2 text-[10px] font-medium text-ink-muted hover:text-ink transition-colors"
                              >
                                <svg className={`w-3 h-3 transition-transform ${sourcesOpen[m.id] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                                {m.sources.length} source{m.sources.length !== 1 ? 's' : ''}
                              </button>
                              {sourcesOpen[m.id] && (
                                <div className="mt-2 space-y-1">
                                  {m.sources.map((s, i) => (
                                    <div key={i} className="text-[10px] text-ink-muted px-2 py-1 bg-surface-raised rounded border border-surface-border/50">
                                      <code className="block truncate">{s.file_path}</code>
                                      {s.line_start && <span className="text-ink-subtle">L{s.line_start}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {/* Thinking dots — only while waiting for first token */}
                    {loading && !streamingMsg && (
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
                    {/* Streaming bubble — live token-by-token render */}
                    {streamingMsg && (
                      <div className="flex justify-start items-end gap-3">
                        <div className="w-8 h-8 rounded-xl bg-pink-500/15 border border-pink-500/20 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
                          </svg>
                        </div>
                        <div className="max-w-2xl bg-surface-card border border-pink-500/40 shadow-[0_0_0_1px_rgba(236,72,153,0.15)] rounded-2xl rounded-tl-sm px-4 py-3">
                          {streamingMsg.content ? (
                            <div className="ai-response">
                              <ReactMarkdown>{streamingMsg.content}</ReactMarkdown>
                              <span className="inline-block w-2 h-4 ml-0.5 bg-pink-400 animate-pulse rounded-sm align-text-bottom opacity-80" />
                            </div>
                          ) : (
                            <p className="text-[11px] text-pink-300/60 font-medium italic">Retrieving sources…</p>
                          )}
                          {streamingMsg.sources.length > 0 && (
                            <div className="mt-2.5 pt-2.5 border-t border-surface-border">
                              <span className="text-[10px] font-medium text-ink-muted">
                                {streamingMsg.sources.length} source{streamingMsg.sources.length !== 1 ? 's' : ''} retrieved
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="border-t border-surface-border/50 bg-surface-raised/50">

                {/* Next-prompt chips — short label shown, full question fills textarea on click */}
                {messages.length > 0 && !atLimit && (
                  <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-1">
                    <span className="text-[11px] italic text-ink-subtle/60 select-none mr-0.5">Try asking about:</span>
                    {([
                      { label: 'Main request flow',  question: `Trace the main request flow in ${repo.name}` },
                      { label: 'Best entry points',  question: 'Which files are the best entry points for a new developer?' },
                      { label: 'Auth layer impact',   question: 'What breaks if I change the auth layer?' },
                      { label: 'Most connected files',  question: 'Which file has the most dependencies? Walk me through it.' },
                    ] as const).map(({ label, question: q }) => (
                      <button
                        key={label}
                        title={q}
                        onClick={() => {
                          setQuestion(q)
                          setTimeout(() => {
                            const el = inputRef.current
                            if (el) { el.style.height = ''; el.focus() }
                          }, 0)
                        }}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-full border border-pink-500/30 bg-pink-500/8 text-pink-300 hover:bg-pink-500/18 hover:border-pink-400/50 hover:text-pink-200 transition-all"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="px-4 py-3">
                {error === 'daily_limit' && (
                  <div className="mb-3 flex items-start gap-2.5 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                    <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                    <div>
                      <p className="font-semibold text-red-400">Daily limit reached (30/day)</p>
                      <p className="text-red-400/70 mt-0.5">Your question is saved above. Come back tomorrow — limits reset at midnight UTC.</p>
                    </div>
                  </div>
                )}
                {error === 'session_limit' && (
                  <div className="mb-3 flex items-start gap-2.5 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
                    <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                    <div>
                      <p className="font-semibold text-amber-400">Session limit reached (15/session)</p>
                      <p className="text-amber-400/70 mt-0.5">Your question is saved above.</p>
                      <button
                        onClick={async () => { setError(null); await handleNewSession() }}
                        className="mt-1.5 flex items-center gap-1 text-amber-300 font-semibold hover:text-amber-200 transition-colors"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                        Start a new session and continue
                      </button>
                    </div>
                  </div>
                )}
                {error && error !== 'daily_limit' && error !== 'session_limit' && (
                  <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</div>
                )}
                {atLimit && (
                  <div className="mb-3 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded px-3 py-2">
                    {rateLimits.session >= 15 ? '15 messages per session reached' : '30 questions per day reached'}
                  </div>
                )}
                <div className="flex items-stretch gap-2">
                  {/* Textarea — fixed 2-row height */}
                  <div className={`flex-1 rounded-xl border transition-colors ${atLimit ? 'border-surface-border/40 opacity-60' : 'border-surface-border focus-within:border-pink-500/50 focus-within:ring-1 focus-within:ring-pink-500/20'} bg-surface-raised`}>
                    <textarea
                      ref={inputRef}
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      onFocus={() => { if (!userExpandedEvidence) setEvidenceOpen(false) }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
                      placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
                      rows={2}
                      disabled={loading || atLimit}
                      className="w-full h-full bg-transparent px-4 py-2.5 text-sm text-ink placeholder-ink-subtle focus:outline-none resize-none overflow-hidden disabled:opacity-50"
                    />
                  </div>
                  {/* Send button — same height as textarea, icon + label stacked */}
                  <button
                    onClick={() => handleSubmit()}
                    disabled={loading || !charOk || atLimit || !activeSessionId}
                    className={`flex flex-col items-center justify-center gap-1 px-4 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                      loading || !charOk || atLimit || !activeSessionId
                        ? 'bg-surface-raised border border-surface-border/50 text-ink-subtle cursor-not-allowed'
                        : `bg-pink-500 hover:bg-pink-400 active:scale-95 text-white shadow-sm shadow-pink-500/30 cursor-pointer ${question && messages.length === 0 ? 'ring-2 ring-pink-400/60 ring-offset-1 ring-offset-surface-card animate-pulse' : ''}`
                    }`}
                  >
                    {loading ? (
                      <>
                        <svg className="w-5 h-5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" fill="none" />
                          <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                        </svg>
                        <span>Send</span>
                      </>
                    )}
                  </button>
                </div>
                {/* Hint when question is pre-filled and no messages yet */}
                {question && messages.length === 0 && !loading && (
                  <p className="text-[11px] text-pink-400/70 mt-2 flex items-center gap-1.5">
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Question ready — click <strong className="font-semibold">Send</strong> to get your answer.
                  </p>
                )}
                {/* Char count below — only when approaching limit */}
                {charCount > 800 && (
                  <p className={`text-[10px] font-mono text-right mt-1 ${charCount > 900 ? 'text-yellow-400' : 'text-ink-subtle'}`}>
                    {charCount}/1000
                  </p>
                )}
                </div>{/* end px-4 py-3 */}
              </div>
            </>
          )}
        </div>

        {/* Right: Evidence Panel — slide-in/out animation */}
        {evidenceOpen && (
          <aside className="hidden xl:flex flex-col overflow-hidden border-l border-surface-border" style={{
            animation: 'slideInRight 300ms cubic-bezier(0.4, 0, 0.2, 1) forwards'
          }}>

            {/* Header */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-surface-border bg-surface-raised/40">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-ink">Evidence</p>
                {inspectedSources.length > 0 && (
                  <span className="text-[10px] font-bold bg-pink-500/15 text-pink-300 border border-pink-500/25 px-1.5 py-0.5 rounded-full">
                    {inspectedSources.length} sources
                  </span>
                )}
              </div>
              {/* Collapse button */}
              <button
                onClick={() => { setEvidenceOpen(false); setUserExpandedEvidence(false) }}
                className="p-1.5 rounded-lg text-ink-subtle hover:text-ink hover:bg-surface-raised transition-all hover:scale-110"
                title="Close evidence panel"
              >
                <svg className="w-4 h-4 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

              {/* 1. Answer preview — first; shows live streaming content if no persisted message */}
              {(inspectedMessage || streamingMsg) && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted mb-3">Answer Preview</p>
                  <div className="rounded-xl border border-pink-500/20 bg-pink-500/5 px-3 py-3">
                    <p className="text-[11px] leading-relaxed text-ink-muted line-clamp-3">
                      {inspectedMessage?.content ?? streamingMsg?.content ?? ''}
                      {!inspectedMessage && streamingMsg && (
                        <span className="inline-block w-1.5 h-3 ml-0.5 bg-pink-400/70 animate-pulse rounded-sm align-text-bottom" />
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* 2. Cited sources — compact list rows */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted mb-2">
                  Cited Sources
                </p>
                {inspectedSources.length > 0 ? (
                  <div className="space-y-2">
                    {inspectedSources.map((source, index) => {
                      const fileName = source.file_path.split('/').pop() ?? source.file_path
                      const ct = source.chunk_type?.toLowerCase() ?? ''
                      const { border, badge, label, linkColor } =
                        ct === 'function' ? { border: 'border-l-pink-400',    badge: 'bg-pink-500/15 text-pink-300 border-pink-500/30',         label: 'Function', linkColor: 'text-pink-400' }
                        : ct === 'class'  ? { border: 'border-l-violet-400',  badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',   label: 'Class',    linkColor: 'text-violet-400' }
                        : ct === 'module' ? { border: 'border-l-blue-400',    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',         label: 'Module',   linkColor: 'text-blue-400' }
                        : ct === 'raw'    ? { border: 'border-l-yellow-400',  badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',   label: 'Raw',      linkColor: 'text-yellow-400' }
                        :                  { border: 'border-l-emerald-400',  badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', label: ct || 'File', linkColor: 'text-emerald-400' }
                      const previewKey = `${source.file_path}-${index}`
                      const isPreviewOpen = !!previewOpen[previewKey]
                      const githubHref = `${repo.github_url}/blob/HEAD/${source.file_path}${source.line_start ? `#L${source.line_start}${source.line_end ? `-L${source.line_end}` : ''}` : ''}`
                      return (
                        <div
                          key={previewKey}
                          className={`rounded-xl bg-surface-raised/30 border border-surface-border border-l-2 ${border} overflow-hidden`}
                        >
                          {/* Card header row */}
                          <div className="flex items-center gap-2 pl-3 pr-2 py-2.5">
                            {/* Left: filename + path + symbol */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <p className="text-[11px] font-semibold text-ink truncate leading-tight">{fileName}</p>
                              </div>
                              <p className="text-[9px] text-ink-subtle font-mono truncate mt-0.5">{source.file_path}</p>
                              {source.function_name && (
                                <p className="text-[9px] text-pink-300/80 truncate mt-0.5">{source.function_name}</p>
                              )}
                            </div>
                            {/* Right: badges + actions */}
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {source.line_start && source.line_end && (
                                <span className="text-[8px] font-mono font-bold bg-surface-raised border border-surface-border px-1.5 py-0.5 rounded text-ink-muted">
                                  L{source.line_start}–{source.line_end}
                                </span>
                              )}
                              {ct && (
                                <span className={`text-[8px] font-bold uppercase tracking-wide border px-1.5 py-0.5 rounded ${badge}`}>
                                  {label}
                                </span>
                              )}
                            </div>
                            {/* Action buttons */}
                            <div className="flex items-center gap-1 shrink-0 ml-1">
                              {source.chunk_preview && (
                                <button
                                  onClick={() => setPreviewOpen(prev => ({ ...prev, [previewKey]: !prev[previewKey] }))}
                                  title={isPreviewOpen ? 'Hide code' : 'Show code'}
                                  className={`p-1 rounded-md transition-all ${isPreviewOpen ? `${linkColor} bg-surface-raised` : 'text-ink-subtle hover:text-ink hover:bg-surface-raised'}`}
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                                  </svg>
                                </button>
                              )}
                              <a
                                href={githubHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open in GitHub"
                                className={`p-1 rounded-md text-ink-subtle hover:${linkColor} hover:bg-surface-raised transition-all`}
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                </svg>
                              </a>
                            </div>
                          </div>
                          {/* Collapsible code preview */}
                          {isPreviewOpen && source.chunk_preview && (
                            <div className="border-t border-surface-border/50">
                              <pre className="text-[10px] font-mono text-ink-muted leading-relaxed px-3 py-2.5 overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto bg-surface-raised/20">
                                {source.chunk_preview}
                              </pre>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : inspectedMessage ? (
                  <p className="text-[11px] text-ink-muted border border-dashed border-surface-border rounded-xl px-3 py-4 text-center">
                    No sources attached to this answer.
                  </p>
                ) : (
                  <p className="text-[11px] text-ink-muted border border-dashed border-surface-border rounded-xl px-3 py-4 text-center leading-relaxed">
                    Click any AI reply in the chat to inspect its sources.
                  </p>
                )}
              </div>

            </div>
          </aside>
        )}
      </div>

      {/* Delete confirm modal */}
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
