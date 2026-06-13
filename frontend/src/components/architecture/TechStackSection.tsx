import { TECH_STACK } from './archData'

export default function TechStackSection() {
  return (
    <section className="border-b border-surface-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle mb-2">Technology choices</p>
        <h2 className="text-xl font-bold text-ink mb-2">Every tool chosen for a reason</h2>
        <p className="text-xs text-ink-muted mb-8">Not a logo wall — each choice reflects a specific constraint or tradeoff.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {TECH_STACK.map(t => (
            <div key={t.name} className="flex gap-4 rounded-2xl border border-surface-border bg-surface-card p-4 hover:border-surface-border/80 transition-colors">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-bold self-start shrink-0 ${t.color}`}>
                {t.name}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink mb-0.5">{t.role}</p>
                <p className="text-[11px] text-ink-muted leading-snug">{t.why}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
