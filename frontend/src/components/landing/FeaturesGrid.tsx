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
    tag: 'Interactive graph',
    title: 'Dependency Map',
    desc: 'Visual graph of every import relationship, split into cluster tabs. Click any file to focus its connections, search across all modules, and instantly spot the highest-risk files to change.',
  },
  {
    accent: 'from-orange-500/20 to-orange-600/5',
    border: 'border-orange-500/20',
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-400',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
      </svg>
    ),
    tag: 'Hybrid RAG',
    title: 'Architecture-Aware Q&A',
    desc: 'Ask anything in plain English. Answers are grounded in your actual code — every response cites the exact file, function, and line range it drew from.',
  },
  {
    accent: 'from-amber-500/20 to-amber-600/5',
    border: 'border-amber-500/20',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    tag: 'Static analysis',
    title: 'Impact',
    desc: "Type any function, class, or file and instantly see every other file that depends on it. Know exactly what will break before you make a single change.",
  },
  {
    accent: 'from-violet-500/20 to-violet-600/5',
    border: 'border-violet-500/20',
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-400',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    tag: 'Retrieval eval',
    title: 'AI Answer Quality Check',
    desc: 'Auto-runs on first visit. See how accurately the AI retrieves the right code — with a health grade, so you know when to trust answers and when to dig deeper.',
  },
]

export default function FeaturesGrid() {
  return (
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className={`relative rounded-xl border ${f.border} bg-gradient-to-b ${f.accent} p-5 flex flex-col gap-4 overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20`}
            >
              <div className={`w-9 h-9 rounded-lg ${f.iconBg} flex items-center justify-center ${f.iconColor} shrink-0`}>
                {f.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-ink mb-1.5">{f.title}</h3>
                <p className="text-xs text-ink-muted leading-relaxed">{f.desc}</p>
              </div>
              <div className={`self-start text-[10px] font-mono font-medium px-2 py-0.5 rounded-full ${f.iconBg} ${f.iconColor} border ${f.border}`}>
                {f.tag}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
