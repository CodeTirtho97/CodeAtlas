import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { reposApi } from '../api/repos'
import type { Repository } from '../types'
import Header from '../components/Header'
import { DashboardSkeleton } from '../components/dashboard/shared'
import { PAGE_META, type TabId } from '../components/dashboard/nav'
import Sidebar from '../components/dashboard/Sidebar'
import MobileNav from '../components/dashboard/MobileNav'
import OverviewPanel from '../components/dashboard/OverviewPanel'
import UnderstandPanel from '../components/dashboard/UnderstandPanel'
import ExplorePanel from '../components/dashboard/ExplorePanel'
import ImpactWorkbench from '../components/dashboard/ImpactWorkbench'
import EvalDashboard from '../components/dashboard/EvalDashboard'
import AskAIWorkspace from '../components/dashboard/AskAIWorkspace'

export default function DashboardPage() {
  const { repoId } = useParams<{ repoId: string }>()
  const navigate = useNavigate()
  const [repo, setRepo] = useState<Repository | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [rateLimits, setRateLimits] = useState({ today: 0, session: 0 })
  const [askPrefill, setAskPrefill]       = useState<string | undefined>()
  const [impactPrefill, setImpactPrefill] = useState<string | undefined>()

  useEffect(() => {
    if (!repoId) return
    setLoading(true)
    reposApi.get(repoId)
      .then(setRepo)
      .catch(err => setError(
        err.response?.status === 404 ? 'Repository not found.' : 'Failed to load repository.'
      ))
      .finally(() => setLoading(false))
  }, [repoId])

  const handleAskAI = (question: string) => {
    setAskPrefill(question)
    setActiveTab('ask')
  }

  const handleCheckImpact = (filePath: string) => {
    setImpactPrefill(filePath)
    setActiveTab('change')
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header />
      <main className="flex-1 flex justify-center px-6 py-6">
        <div className="w-full max-w-2xl"><DashboardSkeleton /></div>
      </main>
    </div>
  )

  if (error || !repo) return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-red-400 mb-4">{error ?? 'Repository not found.'}</p>
          <button onClick={() => navigate('/')} className="text-xs text-ink-muted hover:text-ink transition-colors">
            ← Back to home
          </button>
        </div>
      </main>
    </div>
  )

  if (repo.status === 'pending' || repo.status === 'running') return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Header repoName={repo.name} repoUrl={repo.github_url} />
      <main className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <div className="w-10 h-10 animate-spin rounded-full border-2 border-surface-border border-t-accent mx-auto mb-4" />
          <p className="text-sm text-ink-muted">Still indexing…</p>
        </div>
      </main>
    </div>
  )

  // ── Layout ────────────────────────────────────────────────────────────────

  const isAskTab = activeTab === 'ask'
  const meta = PAGE_META[activeTab]

  return (
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      <Header repoName={repo.name} repoUrl={repo.github_url} />

      {/* Centering shell */}
      <div className="flex-1 overflow-hidden flex items-stretch justify-center px-6 py-4">

        {/* Floating container */}
        <div className="flex overflow-hidden rounded-2xl border border-surface-border/80 bg-surface-card shadow-2xl shadow-black/30 w-full" style={{ maxWidth: '1400px' }}>

          {/* Sidebar — desktop only */}
          <div className="hidden lg:flex">
            <Sidebar
              repo={repo}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onBack={() => navigate('/')}
              rateLimits={rateLimits}
            />
          </div>

          {/* Content — pl-1 creates the 4px visual gap from the sidebar */}
          <main className={`flex-1 min-w-0 flex flex-col pl-1 ${isAskTab ? 'overflow-hidden' : 'overflow-y-auto'}`}>
            {isAskTab ? (
              <div className="flex-1 min-h-0 flex flex-col p-4">
                <div className="flex items-center gap-3 mb-3 px-1">
                  <span className="text-pink-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">Ask AI</p>
                    <p className="text-[11px] text-ink-muted">{meta.description}</p>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <AskAIWorkspace
                    repoId={repoId!}
                    repo={repo}
                    onRateLimitsChange={setRateLimits}
                    initialQuestion={askPrefill}
                  />
                </div>
              </div>
            ) : (
              <div className="px-8 py-6 pb-24 lg:pb-8 animate-fade-in" key={activeTab}>
                <div className="mb-7">
                  <h2 className="text-xl font-bold text-ink">{meta.title}</h2>
                  <p className="text-sm text-ink-muted mt-1 leading-relaxed">{meta.description}</p>
                </div>

                {activeTab === 'overview'   && <OverviewPanel repo={repo} onNavigate={setActiveTab} />}
                {activeTab === 'understand' && <UnderstandPanel repo={repo} />}
                {activeTab === 'explore'    && <ExplorePanel repo={repo} onCheckImpact={handleCheckImpact} />}
                {activeTab === 'change'     && repoId && <ImpactWorkbench repoId={repoId} onAskAI={handleAskAI} defaultSymbol={impactPrefill} />}
                {activeTab === 'evaluate'   && repoId && <EvalDashboard repoId={repoId} />}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile nav */}
      <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  )
}
