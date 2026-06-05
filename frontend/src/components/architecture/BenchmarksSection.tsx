import { BENCHMARKS } from './archData'

export default function BenchmarksSection() {
  return (
    <section className="border-b border-surface-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle mb-2">Real benchmark results</p>
        <h2 className="text-xl font-bold text-ink mb-2">Measured performance</h2>
        <p className="text-xs text-ink-muted mb-8">
          Measured on local hardware. Network-bound steps (Gemini embeddings, Qdrant writes) excluded — those are API/infra dependent.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BENCHMARKS.map(m => (
            <div key={m.label} className={`rounded-2xl border p-5 ${m.bg}`}>
              <p className={`text-2xl font-black tracking-tight font-mono mb-1 ${m.color}`}>{m.value}</p>
              <p className="text-sm font-semibold text-ink mb-1">{m.label}</p>
              <p className="text-[11px] text-ink-subtle leading-snug">{m.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
