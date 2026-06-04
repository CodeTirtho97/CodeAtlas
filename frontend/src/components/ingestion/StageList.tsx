export const STAGES: { label: string; detail: string; maxPct: number }[] = [
  { label: 'Cloning repository',     detail: 'Fetching source code from GitHub',     maxPct: 15  },
  { label: 'Parsing code',           detail: 'AST analysis with Tree-sitter',         maxPct: 50  },
  { label: 'Generating embeddings',  detail: 'Vectorising chunks via Google AI',      maxPct: 75  },
  { label: 'Indexing to Qdrant',     detail: 'Storing vectors + dependency graph',    maxPct: 88  },
  { label: 'Generating insights',    detail: 'LLM summary · onboarding · endpoints', maxPct: 100 },
]

function StageRow({ label, detail, done, active }: {
  label: string
  detail: string
  done: boolean
  active: boolean
}) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${active ? 'bg-accent/10 border border-accent/20' : ''}`}>
      <div className="shrink-0 w-5 h-5 flex items-center justify-center">
        {done ? (
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        ) : active ? (
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#2F81F7" strokeOpacity="0.2" strokeWidth="2" />
            <path d="M10 2 a8 8 0 1 1 -7.6 5.6" stroke="#2F81F7" strokeWidth="2" strokeLinecap="round" fill="none" />
          </svg>
        ) : (
          <div className="w-5 h-5 rounded-full bg-surface-raised flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-ink-subtle rounded-full" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium transition-colors duration-300 ${
          done   ? 'text-emerald-400 line-through decoration-emerald-400/40' :
          active ? 'text-ink' : 'text-ink-subtle'
        }`}>{label}</p>
        {active && <p className="text-xs text-ink-muted mt-0.5 animate-fade-in">{detail}</p>}
      </div>
      {active && (
        <span className="shrink-0 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20 animate-fade-in">
          running
        </span>
      )}
    </div>
  )
}

interface Props {
  activeIdx: number
  completed: boolean
}

export default function StageList({ activeIdx, completed }: Props) {
  return (
    <div className="space-y-1">
      {STAGES.map((stage, i) => (
        <StageRow
          key={stage.label}
          label={stage.label}
          detail={stage.detail}
          done={i < activeIdx || completed}
          active={i === activeIdx && !completed}
        />
      ))}
    </div>
  )
}
