const FEATURES = [
  // ── Sidebar order: Understand → Explore → Ask AI → Impact → Evaluate ──
  {
    color: 'text-violet-400',
    bg: 'bg-violet-500/8 border-violet-500/20',
    iconBg: 'bg-violet-500/10',
    icon: (
      <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0118 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    tab: 'Understand',
    title: 'Repo Intelligence + Onboarding',
    desc: 'Purpose, tech stack and entry points; a codebase-composition breakdown by language and architectural role; and an auto-generated learning path — all the moment ingestion completes.',
  },
  {
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/8 border-cyan-500/20',
    iconBg: 'bg-cyan-500/10',
    icon: (
      <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
    tab: 'Explore',
    title: 'Code Search · API Surface · System Map',
    desc: 'Semantic code search (uses no question quota), the API surface grouped by resource, and an interactive dependency graph — click any node to focus its connections.',
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
    title: 'Cited Architecture Q&A',
    desc: 'Ask anything in plain English. Answers stream live with inline [N] citations to the exact file, function, and line range — inspectable in the Evidence panel.',
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
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/8 border-emerald-500/20',
    iconBg: 'bg-emerald-500/10',
    icon: (
      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    tab: 'Evaluate',
    title: 'AI Answer Quality Check',
    desc: 'Runs a retrieval benchmark (Recall@5 + MRR) against auto-generated golden questions, with a health grade and a dense/sparse/hybrid search-mode comparison.',
  },
]

export default function FeaturesUnlockedSection() {
  return (
    <section className="border-b border-surface-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle mb-2">What indexing unlocks</p>
        <h2 className="text-xl font-bold text-ink mb-2">5 dashboard tabs, all powered by the pipeline</h2>
        <p className="text-xs text-ink-muted mb-8 max-w-2xl">
          The ingestion pipeline runs once. Every tab below reads from the resulting vectors, dependency graph, and metadata — no re-processing per query.
        </p>

        {/* Flex-wrap + centering so the 5th-card row (2 cards) centres under the
            row of 3 above it, instead of sitting lopsided to the left. */}
        <div className="flex flex-wrap justify-center gap-3">
          {FEATURES.map(f => (
            <div key={f.tab} className={`w-full sm:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)] rounded-2xl border p-5 flex flex-col gap-3 ${f.bg}`}>
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
