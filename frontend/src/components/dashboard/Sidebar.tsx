import type { Repository } from '../../types'
import { NAV, TAB_COLORS, type TabId } from './nav'

interface Props {
  repo: Repository
  activeTab: TabId
  onTabChange: (id: TabId) => void
  onBack: () => void
  rateLimits: { today: number; session: number }
}

export default function Sidebar({ repo, activeTab, onTabChange, onBack, rateLimits }: Props) {
  const shortName = repo.github_url.replace('https://github.com/', '')
  const repoDisplayName = shortName.split('/')[1] || shortName

  return (
    <aside className="w-72 shrink-0 flex flex-col border-r border-surface-border/50 overflow-y-auto">

      {/* Back — blue to stand out as a navigation link */}
      <div className="px-5 pt-5 pb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors group"
        >
          <svg className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All repositories
        </button>
      </div>

      {/* Repo identity — very subdued, just enough context */}
      <div className="px-4 pb-5">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <div className="w-7 h-7 rounded-md bg-surface-raised/40 border border-surface-border/30 flex items-center justify-center shrink-0">
            <svg className="w-3.5 h-3.5 text-ink-subtle/60" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-ink-muted truncate">{repoDisplayName}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1 h-1 rounded-full bg-emerald-500/70 shrink-0" />
              <span className="text-[10px] text-emerald-600/80 font-medium">Indexed</span>
              <span className="text-[10px] text-ink-subtle/60">· {repo.chunk_count.toLocaleString()} chunks</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pb-3 space-y-1">
        {NAV.map((section, si) => (
          <div key={si}>
            {/* Group label */}
            {section.group ? (
              <div className="flex items-center gap-3 px-2 pt-5 pb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-subtle/70 shrink-0">
                  {section.group}
                </span>
                <div className="flex-1 h-px bg-surface-border/50" />
              </div>
            ) : (
              si > 0 && <div className="h-2" />
            )}

            <div className="space-y-1">
              {section.items.map(item => {
                const isActive = activeTab === item.id
                const isAsk = item.id === 'ask'
                const colors = TAB_COLORS[item.id]
                const hasUsage = isAsk && rateLimits.today > 0
                const remaining = 30 - rateLimits.today

                if (isAsk) {
                  // ── Unified Ask AI chip ────────────────────────────────────
                  return (
                    <div
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={[
                        'group w-full flex flex-col rounded-xl cursor-pointer transition-all duration-150 overflow-hidden',
                        isActive
                          ? colors.rowActive
                          : 'bg-transparent border-2 border-pink-400/70 hover:bg-pink-500/10 hover:border-pink-400/90',
                      ].join(' ')}
                    >
                      {/* Top ~3/4: icon + label row */}
                      <div className="flex items-center gap-3.5 px-3 pt-3.5 pb-3">
                        <div className={[
                          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all',
                          isActive ? colors.iconActive : `bg-surface-raised/50 border border-surface-border/50 ${colors.hoverIcon}`,
                        ].join(' ')}>
                          <span className={`transition-colors ${isActive ? colors.iconColor : 'text-pink-400'}`}>
                            {item.icon}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold leading-tight transition-colors ${isActive ? colors.labelActive : 'text-pink-300'}`}>
                            {item.label}
                          </p>
                          <p className={`text-[11px] mt-0.5 leading-tight truncate transition-colors ${isActive ? colors.sublabelActive : 'text-pink-400/70'}`}>
                            {item.sublabel}
                          </p>
                        </div>
                        {isActive && (
                          <div className={`w-1.5 h-7 rounded-full shrink-0 ${colors.pill}`} />
                        )}
                      </div>

                      {/* Horizontal divider + bottom usage strip (~1/4 height) */}
                      {hasUsage && (
                        <>
                          <div className="h-px bg-black/30" />
                          <div className="flex items-center justify-between px-3 py-1.5 bg-black/25">
                            <span className={`text-[10px] font-semibold tabular-nums ${remaining <= 5 ? 'text-red-400' : remaining <= 10 ? 'text-yellow-400' : 'text-pink-200'}`}>
                              AI Prompts Remaining Today:&nbsp;
                              <span className="font-bold">{remaining}</span>
                            </span>
                            <div className="flex flex-col items-end shrink-0 ml-2">
                              <span className="text-[8px] text-slate-400 leading-tight">Renews</span>
                              <span className="text-[8px] text-slate-400 leading-tight">12AM IST</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )
                }

                // ── Regular nav button for all other items ─────────────────
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={[
                      'group w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-left transition-all duration-150',
                      isActive
                        ? colors.rowActive
                        : `border border-transparent ${colors.hoverRow}`,
                    ].join(' ')}
                  >
                    <div className={[
                      'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all',
                      isActive ? colors.iconActive : `bg-surface-raised/50 border border-surface-border/50 ${colors.hoverIcon}`,
                    ].join(' ')}>
                      <span className={`transition-colors ${isActive ? colors.iconColor : 'text-ink-muted group-hover:text-ink'}`}>
                        {item.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold leading-tight transition-colors ${isActive ? colors.labelActive : 'text-ink'}`}>
                        {item.label}
                      </p>
                      <p className={`text-[11px] mt-0.5 leading-tight truncate transition-colors ${isActive ? colors.sublabelActive : 'text-ink-muted group-hover:text-ink'}`}>
                        {item.sublabel}
                      </p>
                    </div>
                    {isActive && (
                      <div className={`w-1.5 h-5 rounded-full shrink-0 ${colors.pill}`} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

    </aside>
  )
}
