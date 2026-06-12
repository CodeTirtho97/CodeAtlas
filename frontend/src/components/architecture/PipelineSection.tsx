import { PIPELINE_STEPS } from './archData'

export default function PipelineSection() {
  return (
    <section className="border-b border-surface-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle mb-2">5-stage pipeline</p>
        <h2 className="text-xl font-bold text-ink mb-10">From GitHub URL to cited answer</h2>

        <div className="space-y-4">
          {PIPELINE_STEPS.map(step => (
            <div key={step.num} className="flex gap-5 items-start">
              <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 ${step.color.icon}`}>
                <span className="text-xs font-black font-mono tracking-tight">{step.num}</span>
              </div>
              <div className="flex-1 rounded-2xl border border-surface-border bg-surface-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-2.5">
                  <div>
                    <h3 className="text-sm font-bold text-ink">{step.title}</h3>
                    <p className={`text-[11px] font-mono font-semibold mt-0.5 ${step.color.num}`}>{step.subtitle}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {step.tags.map(tag => (
                      <span key={tag} className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${step.color.tag}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
