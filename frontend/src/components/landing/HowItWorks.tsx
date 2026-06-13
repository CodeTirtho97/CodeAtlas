const STEPS = [
  {
    num: '1',
    title: 'Paste a GitHub URL',
    desc: 'Drop in any public repository. No setup, no config, no credit card.',
    grad: 'bg-gradient-to-br from-blue-500 to-blue-600',
    shadow: 'shadow-blue-500/30',
  },
  {
    num: '2',
    title: 'We index it once',
    desc: 'CodeAtlas clones, AST-parses, embeds, and maps every dependency and endpoint — in the background with live progress. Usually a couple of minutes.',
    grad: 'bg-gradient-to-br from-violet-500 to-violet-600',
    shadow: 'shadow-violet-500/30',
  },
  {
    num: '3',
    title: 'Explore the dashboards',
    desc: 'Land in an interactive workspace: ask questions, trace impact, and learn the codebase — all grounded in real source, never guessed.',
    grad: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    shadow: 'shadow-emerald-500/30',
  },
]

const TABS = [
  {
    name: 'Understand',
    blurb: 'Purpose, tech stack, and a learning path to orient fast.',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    ),
  },
  {
    name: 'Explore',
    blurb: 'Semantic code search, the API surface, and a dependency graph.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    ),
  },
  {
    name: 'Ask AI',
    blurb: 'Plain-English answers, cited to exact files and line ranges.',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10 border-pink-500/20',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
    ),
  },
  {
    name: 'Impact',
    blurb: 'See every file that would break before you change one.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    ),
  },
  {
    name: 'Evaluate',
    blurb: 'A trust score for how reliably the AI finds the right code.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    ),
  },
]

export default function HowItWorks() {
  return (
    <section className="border-t border-surface-border">
      <style>{`
        /* Token travels along the line, pausing (dwelling) at each of the 3 nodes
           (line spans node1→node3, so node2 sits at 50%). */
        @keyframes hiw-travel { 0%, 10% { left: 0%; } 40%, 50% { left: 50%; } 80%, 100% { left: 100%; } }
        /* Fade out before the loop snaps back to the start. */
        @keyframes hiw-fade   { 0%, 4% { opacity: 0; } 8%, 92% { opacity: 1; } 100% { opacity: 0; } }
        /* The carried icon morphs URL → indexed docs → dashboard as it passes nodes. */
        @keyframes hiw-ic1 { 0%, 24% { opacity: 1; } 32%, 100% { opacity: 0; } }
        @keyframes hiw-ic2 { 0%, 30% { opacity: 0; } 40%, 60% { opacity: 1; } 70%, 100% { opacity: 0; } }
        @keyframes hiw-ic3 { 0%, 68% { opacity: 0; } 78%, 100% { opacity: 1; } }
        .hiw-token { animation: hiw-travel 7.5s ease-in-out infinite, hiw-fade 7.5s ease-in-out infinite; }
        .hiw-ic1 { animation: hiw-ic1 7.5s ease-in-out infinite; }
        .hiw-ic2 { animation: hiw-ic2 7.5s ease-in-out infinite; }
        .hiw-ic3 { animation: hiw-ic3 7.5s ease-in-out infinite; }
      `}</style>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-subtle mb-3">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-ink">
            From a URL to understanding <span className="text-gradient">in minutes</span>
          </h2>
        </div>

        {/* ── 3-step timeline ── */}
        <div className="relative">
          {/* connecting line + a single glow that flows step-to-step (wide screens) */}
          <div className="hidden sm:block absolute top-7 left-[16.66%] right-[16.66%] h-0.5 rounded-full bg-gradient-to-r from-blue-500/30 via-violet-500/40 to-emerald-500/30">
            {/* A token that morphs URL → indexed docs → dashboard as it passes each node */}
            <span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 hiw-token">
              <span className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-surface-card border border-surface-border shadow-lg shadow-black/40">
                {/* 1 · URL / link */}
                <svg className="absolute w-4 h-4 text-blue-300 hiw-ic1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                </svg>
                {/* 2 · indexed docs / layers */}
                <svg className="absolute w-4 h-4 text-violet-300 hiw-ic2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 14.25l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
                </svg>
                {/* 3 · dashboard grid */}
                <svg className="absolute w-4 h-4 text-emerald-300 hiw-ic3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </span>
            </span>
          </div>

          <div className="grid sm:grid-cols-3 gap-x-6 gap-y-10">
            {STEPS.map(s => (
              <div key={s.num} className="relative flex flex-col items-center text-center">
                <div className={`relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-lg ${s.grad} ${s.shadow}`}>
                  {s.num}
                </div>
                <h3 className="text-sm font-semibold text-ink mt-5 mb-1.5">{s.title}</h3>
                <p className="text-xs text-ink-muted leading-relaxed max-w-[16rem]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Then: the 5 dashboards ── */}
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-subtle text-center mt-12 mb-5">
          Then explore 5 dashboards
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {TABS.map(t => (
            <div key={t.name} className="rounded-xl border border-surface-border bg-surface-card p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${t.bg} ${t.color}`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    {t.icon}
                  </svg>
                </span>
                <span className={`text-xs font-bold ${t.color}`}>{t.name}</span>
              </div>
              <p className="text-[11px] text-ink-muted leading-relaxed">{t.blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
