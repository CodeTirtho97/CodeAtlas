const FEATURES = [
  // ── Sidebar order: Overview → Understand → Explore → Ask AI → Impact Area → Evaluate ──
  {
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/8 border-cyan-500/20',
    iconBg: 'bg-cyan-500/10',
    icon: (
      <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    ),
    tab: 'Overview',
    title: 'Repo Intelligence Dashboard',
    desc: 'At-a-glance stats — chunk count, endpoint count, tracked imports, entry points — plus purpose summary, stack chips, and architecture description.',
  },
  {
    color: 'text-blue-400',
    bg: 'bg-blue-500/8 border-blue-500/20',
    iconBg: 'bg-blue-500/10',
    icon: (
      <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    tab: 'Understand',
    title: 'Auto Onboarding Guide',
    desc: 'Prioritised reading path, key services, and core workflows — generated the moment ingestion completes.',
  },
  {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/8 border-emerald-500/20',
    iconBg: 'bg-emerald-500/10',
    icon: (
      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
    tab: 'Explore',
    title: 'API Map + Dependency Graph',
    desc: 'Every endpoint extracted via Tree-sitter. Dependency map rendered as an interactive cluster graph — click any node to focus its connections.',
  },
  {
    color: 'text-pink-400',
    bg: 'bg-pink-500/8 border-pink-500/20',
    iconBg: 'bg-pink-500/10',
    icon: (
      <svg className="w-4 h-4 text-pink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
      </svg>
    ),
    tab: 'Ask AI',
    title: 'Architecture Q&A',
    desc: 'Ask anything in plain English. Every answer cites the exact file, function, and line range it drew from — no hallucination, no guessing.',
  },
  {
    color: 'text-amber-400',
    bg: 'bg-amber-500/8 border-amber-500/20',
    iconBg: 'bg-amber-500/10',
    icon: (
      <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    tab: 'Impact',
    title: 'Change Impact Analysis',
    desc: 'Type any function, class, or file. Get every file that transitively depends on it — so you know what will break before touching a single line.',
  },
  {
    color: 'text-violet-400',
    bg: 'bg-violet-500/8 border-violet-500/20',
    iconBg: 'bg-violet-500/10',
    icon: (
      <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    tab: 'Evaluate',
    title: 'AI Answer Quality Check',
    desc: 'Runs a retrieval benchmark (Recall@5 + MRR) against auto-generated golden questions. Shows whether the AI is finding the right code — with a health grade.',
  },
]

export default function FeaturesUnlockedSection() {
  return (
    <section className="border-b border-surface-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle mb-2">What indexing unlocks</p>
        <h2 className="text-xl font-bold text-ink mb-2">6 dashboard tabs, all powered by the pipeline</h2>
        <p className="text-xs text-ink-muted mb-8 max-w-2xl">
          The ingestion pipeline runs once. Every tab below reads from the resulting vectors, dependency graph, and metadata — no re-processing per query.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map(f => (
            <div key={f.tab} className={`rounded-2xl border p-5 flex flex-col gap-3 ${f.bg}`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${f.iconBg}`}>
                  {f.icon}
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${f.color}`}>{f.tab}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink mb-1">{f.title}</p>
                <p className="text-[11px] text-ink-muted leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
