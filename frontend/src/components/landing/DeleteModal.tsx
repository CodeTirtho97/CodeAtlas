import { useEffect, useRef } from 'react'
import Spinner from '../Spinner'

interface Props {
  repoName: string
  deleting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteModal({ repoName, deleting, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />
      <div
        className="relative w-full max-w-sm card p-6 shadow-2xl shadow-black/60 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
        </div>

        <div className="text-center mb-6">
          <h3 className="text-base font-semibold text-ink mb-2">Delete repository?</h3>
          <p className="text-sm text-ink-muted mb-1">
            You're about to delete <span className="font-mono font-medium text-ink">{repoName}</span>.
          </p>
          <p className="text-xs text-ink-subtle leading-relaxed">
            All indexed chunks, embeddings, and Q&A history will be permanently removed. This cannot be undone.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 rounded-lg bg-surface-raised hover:bg-surface-border text-sm text-ink transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-sm font-medium text-red-400 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {deleting ? <><Spinner size="sm" /> Deleting…</> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
