import { useNavigate } from 'react-router-dom'
import type { Repository } from '../../types'
import RepoCard from './RepoCard'

interface Props {
  repos: Repository[]
  loading: boolean
  onDelete: (id: string) => void
}

function SlotIndicator({ total, filled }: { total: number; filled: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i < filled
                ? 'w-5 h-2 bg-accent'
                : 'w-2 h-2 bg-surface-raised border border-surface-border'
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-ink-subtle tabular-nums">{filled}/{total} used</span>
    </div>
  )
}

function focusUrlInput() {
  const input = document.getElementById('github-url-input') as HTMLInputElement | null
  if (!input) return
  input.scrollIntoView({ behavior: 'smooth', block: 'center' })
  input.focus()
  input.classList.add('ring-2', '!ring-accent', '!border-accent')
  setTimeout(() => input.classList.remove('ring-2', '!ring-accent', '!border-accent'), 1800)
}

export default function RepoSection({ repos, loading, onDelete }: Props) {
  const navigate = useNavigate()

  return (
    <section id="your-repos" className="border-t border-surface-border bg-surface-raised/20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Section header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-ink">Your repositories</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              {loading
                ? 'Loading…'
                : repos.length === 0
                  ? 'Paste a GitHub URL above to index your first repo'
                  : 'Click any card to explore the full dashboard'}
            </p>
          </div>
          {!loading && <SlotIndicator total={3} filled={repos.length} />}
        </div>

        {/* Loading skeletons */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2].map(i => (
              <div key={i} className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden">
                <div className="h-0.5 w-full bg-surface-raised skeleton" />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-3/5 rounded-md skeleton" />
                  <div className="h-3 w-4/5 rounded-md skeleton" />
                  <div className="h-3 w-full rounded-md skeleton" />
                  <div className="flex gap-2 pt-1">
                    <div className="h-5 w-16 rounded-full skeleton" />
                    <div className="h-5 w-20 rounded-full skeleton" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : repos.length === 0 ? (

          /* Empty state */
          <div className="rounded-2xl border border-dashed border-surface-border/60 bg-surface-card/40 py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-surface-raised border border-surface-border flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-ink-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-ink-muted">No repositories yet</p>
            <p className="text-xs text-ink-subtle mt-1">Paste any public GitHub URL above to get started</p>
          </div>

        ) : (

          /* Cards grid */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {repos.map(repo => (
              <RepoCard
                key={repo.id}
                repo={repo}
                onDelete={onDelete}
                onOpen={id => navigate(`/dashboard/${id}`)}
              />
            ))}

            {/* Open slots */}
            {repos.length < 3 && Array.from({ length: 3 - repos.length }).map((_, i) => (
              <div
                key={`slot-${i}`}
                onClick={focusUrlInput}
                className="rounded-2xl border border-dashed border-surface-border/50 bg-transparent
                           flex flex-col items-center justify-center gap-2.5 py-10 min-h-[200px]
                           hover:border-accent/30 hover:bg-accent/5 transition-all duration-200 cursor-pointer group"
              >
                <div className="w-9 h-9 rounded-xl bg-surface-raised border border-surface-border
                                flex items-center justify-center group-hover:border-accent/30 transition-colors">
                  <svg className="w-4 h-4 text-ink-subtle group-hover:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-ink-subtle group-hover:text-ink-muted transition-colors">Empty slot</p>
                  <p className="text-[11px] text-ink-subtle mt-0.5">Add a repository above</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
