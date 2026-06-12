// ─── Shared navigation data for the dashboard ────────────────────────────────
// Imported by Sidebar, MobileNav, and DashboardPage.

export type TabId = 'understand' | 'explore' | 'change' | 'evaluate' | 'ask'

export interface NavItem {
  id: TabId
  label: string
  sublabel: string
  accent?: boolean
  icon: React.ReactNode
}

export const NAV: { group?: string; items: NavItem[] }[] = [
  {
    group: 'Discover',
    items: [
      {
        id: 'understand',
        label: 'Understand',
        sublabel: 'What is this repo & where to start?',
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
        ),
      },
      {
        id: 'explore',
        label: 'Explore',
        sublabel: 'What endpoints & files exist?',
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        ),
      },
    ],
  },
  {
    group: 'Investigate',
    items: [
      {
        id: 'ask',
        label: 'Ask AI',
        sublabel: 'Get answers from the actual code',
        accent: true,
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
          </svg>
        ),
      },
    ],
  },
  {
    group: 'Decide',
    items: [
      {
        id: 'change',
        label: 'Impact',
        sublabel: 'What breaks if you change this?',
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        ),
      },
      {
        id: 'evaluate',
        label: 'Evaluate',
        sublabel: 'Are AI answers trustworthy?',
        icon: (
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
        ),
      },
    ],
  },
]

export const ALL_ITEMS: NavItem[] = NAV.flatMap(g => g.items)

// Per-tab color config — used by Sidebar for active/hover states
export const TAB_COLORS: Record<TabId, {
  rowActive:      string
  iconActive:     string
  iconColor:      string
  headingColor:   string
  labelActive:    string
  sublabelActive: string
  pill:           string
  hoverRow:       string
  hoverIcon:      string
}> = {
  understand: {
    rowActive:      'bg-violet-500/35 border border-violet-400/55',
    iconActive:     'bg-violet-500/45 border border-violet-400/60',
    iconColor:      'text-violet-200',
    headingColor:   'text-violet-400',
    labelActive:    'text-white',
    sublabelActive: 'text-violet-300',
    pill:           'bg-violet-400',
    hoverRow:       'hover:bg-surface-raised/50',
    hoverIcon:      'group-hover:bg-surface-raised group-hover:border-surface-border/60',
  },
  explore: {
    rowActive:      'bg-cyan-500/30 border border-cyan-400/50',
    iconActive:     'bg-cyan-500/40 border border-cyan-400/55',
    iconColor:      'text-cyan-200',
    headingColor:   'text-cyan-400',
    labelActive:    'text-white',
    sublabelActive: 'text-cyan-300',
    pill:           'bg-cyan-400',
    hoverRow:       'hover:bg-surface-raised/50',
    hoverIcon:      'group-hover:bg-surface-raised group-hover:border-surface-border/60',
  },
  change: {
    rowActive:      'bg-amber-500/30 border border-amber-400/50',
    iconActive:     'bg-amber-500/40 border border-amber-400/55',
    iconColor:      'text-amber-200',
    headingColor:   'text-amber-400',
    labelActive:    'text-white',
    sublabelActive: 'text-amber-300',
    pill:           'bg-amber-400',
    hoverRow:       'hover:bg-surface-raised/50',
    hoverIcon:      'group-hover:bg-surface-raised group-hover:border-surface-border/60',
  },
  evaluate: {
    rowActive:      'bg-emerald-500/30 border border-emerald-400/50',
    iconActive:     'bg-emerald-500/40 border border-emerald-400/55',
    iconColor:      'text-emerald-200',
    headingColor:   'text-emerald-400',
    labelActive:    'text-white',
    sublabelActive: 'text-emerald-300',
    pill:           'bg-emerald-400',
    hoverRow:       'hover:bg-surface-raised/50',
    hoverIcon:      'group-hover:bg-surface-raised group-hover:border-surface-border/60',
  },
  ask: {
    rowActive:      'bg-pink-500/45 border border-pink-400/65 shadow-md shadow-pink-500/25',
    iconActive:     'bg-pink-500/60 border border-pink-400/70',
    iconColor:      'text-pink-100',
    headingColor:   'text-pink-400',
    labelActive:    'text-white',
    sublabelActive: 'text-pink-200',
    pill:           'bg-pink-300',
    hoverRow:       'hover:bg-pink-500/30 hover:border-pink-400/45',
    hoverIcon:      'group-hover:bg-pink-500/35 group-hover:border-pink-400/50',
  },
}

export const PAGE_META: Record<TabId, { title: string; description: string }> = {
  understand: { title: 'Understand',     description: 'What this repo does, how the code is composed, and the path to learn it.' },
  explore:    { title: 'Explore',        description: 'Search the code, browse the API surface, and trace dependencies across files.' },
  change:     { title: 'Impact',          description: 'Type any function, class, or file to see exactly what breaks if you change it — dependents, routes, and tests to run.' },
  evaluate:   { title: 'Evaluate',       description: 'Measure how accurately the retrieval layer finds the right code for endpoint questions.' },
  ask:        { title: 'Ask AI',         description: 'Investigate the codebase in natural language and inspect citations behind every answer.' },
}
