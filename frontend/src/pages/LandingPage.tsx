import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { reposApi } from '../api/repos'
import type { Repository } from '../types'
import client from '../api/client'
import Header from '../components/Header'
import Spinner from '../components/Spinner'
import AppFooter from '../components/AppFooter'
import AnalyzeForm from '../components/landing/AnalyzeForm'
import RepoSection from '../components/landing/RepoSection'
import FeaturesGrid from '../components/landing/FeaturesGrid'

export default function LandingPage() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [repos, setRepos] = useState<Repository[]>([])
  const [loadingRepos, setLoadingRepos] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [limitError, setLimitError] = useState('')

  useEffect(() => {
    client.get('/health').catch(() => {})
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      setLoadingRepos(true)
      reposApi.list().then(setRepos).finally(() => setLoadingRepos(false))
    }
  }, [isAuthenticated])

  const handleLogin = async () => {
    const r = await client.get('/auth/login')
    window.location.href = r.data.auth_url
  }

  const handleAnalyze = async (url: string) => {
    if (repos.length >= 3) {
      setLimitError('You have reached the 3-repository limit. Delete one to add another.')
      return
    }
    setSubmitting(true)
    setLimitError('')
    try {
      const job = await reposApi.ingest(url)
      navigate(`/ingest/${job.job_id}/${job.repository_id}`)
    } catch (err: any) {
      setLimitError(err.response?.data?.detail || 'Failed to start ingestion. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const atLimit = repos.length >= 3

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-surface-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-8 h-8 text-accent fill-none stroke-current" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold mb-6 leading-[1.1] tracking-tight">
              <span className="text-ink block">New Codebase?</span>
              <span className="text-gradient block">Own it in Minutes.</span>
            </h1>

            <p className="text-ink-muted text-lg sm:text-xl max-w-xl mx-auto mb-10 leading-relaxed">
              One URL. Instant clarity on every dependency,<br />
              endpoint, and architecture decision —<br />
              with answers cited back to the exact line of code.
            </p>

            {!isAuthenticated ? (
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={handleLogin}
                  className="inline-flex items-center gap-2.5 bg-white text-gray-900 hover:bg-gray-100 font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  Sign in with GitHub
                </button>
                <p className="text-xs text-ink-subtle">Free · Public repositories only · No credit card</p>
              </div>
            ) : (
              <div className="max-w-xl mx-auto">
                <AnalyzeForm onSubmit={handleAnalyze} disabled={submitting} atLimit={atLimit} />
                {limitError && <p className="mt-2 text-xs text-red-400">{limitError}</p>}
                {submitting && (
                  <div className="flex items-center justify-center gap-2 mt-3 text-sm text-ink-muted">
                    <Spinner size="sm" /> Starting ingestion...
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {isAuthenticated && (
          <RepoSection repos={repos} loading={loadingRepos} onDelete={id => setRepos(p => p.filter(r => r.id !== id))} />
        )}

        <FeaturesGrid />
      </main>

      <AppFooter />
    </div>
  )
}
