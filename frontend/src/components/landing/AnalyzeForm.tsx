import { useState } from 'react'

interface Props {
  onSubmit: (url: string) => void
  disabled?: boolean
  atLimit?: boolean
}

export default function AnalyzeForm({ onSubmit, disabled, atLimit }: Props) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const isDisabled = disabled || atLimit

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (atLimit) return
    setError('')
    const cleaned = url.trim()
    if (!cleaned.match(/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/)) {
      setError('Enter a valid GitHub URL: https://github.com/owner/repo')
      return
    }
    onSubmit(cleaned)
    setUrl('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </div>
          <input
            id="github-url-input"
            type="text"
            value={url}
            onChange={e => { if (!atLimit) { setUrl(e.target.value); setError('') } }}
            placeholder="https://github.com/owner/repository"
            disabled={isDisabled}
            className="w-full bg-surface-raised border border-surface-border rounded-lg py-2.5 pl-9 pr-4 text-sm text-ink placeholder-ink-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <button
          type="submit"
          disabled={isDisabled || !url.trim()}
          className="px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shrink-0"
        >
          Analyze
        </button>
      </div>
      {atLimit && (
        <p className="text-xs text-yellow-400 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          Maximum of 3 active repos allowed. Remove one below to add another.
        </p>
      )}
      {!atLimit && error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  )
}
