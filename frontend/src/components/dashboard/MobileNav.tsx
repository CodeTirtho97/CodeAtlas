import { ALL_ITEMS, type TabId } from './nav'

interface Props {
  activeTab: TabId
  onTabChange: (id: TabId) => void
}

export default function MobileNav({ activeTab, onTabChange }: Props) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface-card/95 backdrop-blur-md border-t border-surface-border flex items-center justify-around px-2 pb-safe">
      {ALL_ITEMS.map(item => {
        const isActive = activeTab === item.id
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-lg transition-all ${
              isActive && item.accent ? 'text-pink-300' :
              isActive               ? 'text-ink' :
                                       'text-ink-subtle'
            }`}
          >
            {item.icon}
            <span className="text-[9px] font-semibold">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
