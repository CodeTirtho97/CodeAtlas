import { Link } from 'react-router-dom'
import Header from '../components/Header'
import AppFooter from '../components/AppFooter'
import PipelineSection from '../components/architecture/PipelineSection'
import FeaturesUnlockedSection from '../components/architecture/FeaturesUnlockedSection'
import HybridSearchSection from '../components/architecture/HybridSearchSection'
import BenchmarksSection from '../components/architecture/BenchmarksSection'
import TechStackSection from '../components/architecture/TechStackSection'

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-surface-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-pink-400 bg-pink-500/10 border border-pink-500/20 px-3 py-1 rounded-full mb-6">
              Under the hood
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold text-ink mb-4 leading-tight tracking-tight">
              How CodeAtlas is Built
            </h1>
            <p className="text-ink-muted text-base max-w-2xl mx-auto leading-relaxed">
              CodeAtlas is a <strong className="text-ink font-semibold">Production RAG System</strong> built for source code —
              not PDFs, not text files. It uses AST-aware chunking, hybrid dense+sparse retrieval,
              and Reciprocal Rank Fusion to answer architecture questions with exact source citations.
            </p>
          </div>
        </section>

        {/* Why RAG */}
        <section className="border-b border-surface-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle mb-2">The problem this solves</p>
            <h2 className="text-xl font-bold text-ink mb-8">Why not just paste the code into the AI?</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
                <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">Naive approach</p>
                <div className="space-y-2 text-sm text-ink-muted">
                  {[
                    'Entire codebase into the prompt — token limits hit fast, costs spike on real repos.',
                    'No relevance filtering — diluted context, degraded answer quality.',
                    'No persistence — full codebase re-sent on every query, slow and costly.',
                    'No source grounding — answers cannot be traced to a file or function.',
                  ].map(t => (
                    <div key={t} className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5 shrink-0">✗</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">CodeAtlas RAG approach</p>
                <div className="space-y-2 text-sm text-ink-muted">
                  {[
                    'Index once into Qdrant — no re-processing per query, results stay fast as code grows.',
                    'Only the top-10 most relevant chunks enter the prompt — no noise.',
                    'Vectors persist — subsequent queries run in milliseconds, not minutes.',
                    'Every answer cites the exact file, function, and line range it used.',
                  ].map(t => (
                    <div key={t} className="flex items-start gap-2">
                      <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <PipelineSection />
        <FeaturesUnlockedSection />
        <HybridSearchSection />
        <BenchmarksSection />
        <TechStackSection />

        {/* CTA */}
        <section>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
            <h2 className="text-xl font-bold text-ink mb-3">See it in action</h2>
            <p className="text-sm text-ink-muted mb-6">Paste any public GitHub URL and watch the pipeline run in real time.</p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-white text-sm font-bold transition-all shadow-md shadow-pink-500/25 hover:shadow-lg hover:shadow-pink-500/35 active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
              </svg>
              Try CodeAtlas
            </Link>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  )
}
