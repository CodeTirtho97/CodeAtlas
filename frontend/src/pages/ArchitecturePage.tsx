import { Link } from 'react-router-dom'
import Header from '../components/Header'

// ─── Data ─────────────────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  {
    num: '01',
    color: { accent: 'from-blue-500/80 to-blue-400/20', icon: 'bg-blue-500/15 border-blue-500/25 text-blue-400', num: 'text-blue-400', connector: 'bg-blue-500/30' },
    title: 'Clone & Filter',
    subtitle: 'GitPython + custom filter',
    desc: 'Repository is cloned into an isolated temp directory. A file-type allowlist strips binaries, lockfiles, and vendored code — only source files go forward.',
    tags: ['GitPython', 'File allowlist', 'Language detection'],
  },
  {
    num: '02',
    color: { accent: 'from-violet-500/80 to-violet-400/20', icon: 'bg-violet-500/15 border-violet-500/25 text-violet-400', num: 'text-violet-400', connector: 'bg-violet-500/30' },
    title: 'AST Parse → Chunks',
    subtitle: 'Tree-sitter, ~1ms/file',
    desc: 'Each source file is parsed with Tree-sitter into an AST. Functions, classes, and modules become semantic chunks — not naive line-count splits. This preserves code structure so the AI retrieves whole, meaningful units.',
    tags: ['Tree-sitter', 'Python · JS · TS · Java · Go', 'Fallback chunker'],
  },
  {
    num: '03',
    color: { accent: 'from-pink-500/80 to-pink-400/20', icon: 'bg-pink-500/15 border-pink-500/25 text-pink-400', num: 'text-pink-400', connector: 'bg-pink-500/30' },
    title: 'Embed → Vectors',
    subtitle: 'gemini-embedding-001, 3072-dim',
    desc: 'Each chunk is embedded using Google\'s gemini-embedding-001 model (RETRIEVAL_DOCUMENT task type). Simultaneously, a vocabulary-free BM25-style sparse vector is generated via feature hashing — enabling hybrid search.',
    tags: ['gemini-embedding-001', '3,072 dimensions', 'Sparse BM25 (30k vocab)'],
  },
  {
    num: '04',
    color: { accent: 'from-emerald-500/80 to-emerald-400/20', icon: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400', num: 'text-emerald-400', connector: 'bg-emerald-500/30' },
    title: 'Store in Qdrant + Postgres',
    subtitle: 'Persistent vector + metadata',
    desc: 'Dense and sparse vectors are stored in Qdrant with full payload metadata (file path, function name, line range). Structural metadata — dependencies, API endpoints — is persisted to PostgreSQL for the analysis tabs.',
    tags: ['Qdrant vector store', 'PostgreSQL', 'Dependency graph', 'API extractor'],
  },
  {
    num: '05',
    color: { accent: 'from-amber-500/80 to-amber-400/20', icon: 'bg-amber-500/15 border-amber-500/25 text-amber-400', num: 'text-amber-400', connector: 'bg-amber-500/30' },
    title: 'Hybrid Retrieve → Generate',
    subtitle: 'RRF fusion + Gemini Flash',
    desc: 'At query time, the question is embedded and searched against both the dense and sparse indexes (top-20 each). Reciprocal Rank Fusion merges them into a single top-10 shortlist. Only those chunks enter the Gemini prompt — with exact file, function, and line citations.',
    tags: ['Dense + Sparse search', 'RRF fusion', 'Top-10 context', 'Source citations'],
  },
]

const BENCHMARKS = [
  {
    value: '~1ms',
    label: 'Parse time per file',
    sub: 'Tree-sitter AST, measured across 50 runs',
    color: 'text-blue-400',
    bg: 'bg-blue-500/8 border-blue-500/20',
  },
  {
    value: '978',
    label: 'Files / second',
    sub: 'Parser throughput on 100-file batch',
    color: 'text-violet-400',
    bg: 'bg-violet-500/8 border-violet-500/20',
  },
  {
    value: '3,072',
    label: 'Embedding dimensions',
    sub: 'gemini-embedding-001 vector size',
    color: 'text-pink-400',
    bg: 'bg-pink-500/8 border-pink-500/20',
  },
  {
    value: '0.02ms',
    label: 'Sparse vector latency',
    sub: 'Per chunk, vocabulary-free BM25',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/8 border-emerald-500/20',
  },
  {
    value: '30,000',
    label: 'Hash vocab space',
    sub: 'MD5 feature hashing, collision-resistant',
    color: 'text-amber-400',
    bg: 'bg-amber-500/8 border-amber-500/20',
  },
  {
    value: '20+20→10',
    label: 'Retrieval pipeline',
    sub: 'Dense + sparse prefetch → RRF fusion',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/8 border-cyan-500/20',
  },
]

const TECH_STACK = [
  {
    name: 'FastAPI',
    role: 'Async Python backend',
    why: 'Background ingestion tasks, native async/await, auto OpenAPI docs',
    color: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
  },
  {
    name: 'Qdrant',
    role: 'Vector database',
    why: 'Native sparse+dense hybrid search and RRF fusion in a single query',
    color: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  },
  {
    name: 'Tree-sitter',
    role: 'AST parser',
    why: 'Language-aware chunking at function/class boundaries, not line counts',
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  {
    name: 'Gemini',
    role: 'Embeddings + generation',
    why: '3072-dim embeddings (gemini-embedding-001) + gemini-2.0-flash for answers',
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  },
  {
    name: 'PostgreSQL',
    role: 'Relational metadata store',
    why: 'Job state, repo records, chat sessions, API endpoints, dependency graphs',
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    name: 'React + Vite',
    role: 'Frontend SPA',
    why: 'TypeScript, Tailwind, component-level state, optimistic UI updates',
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  },
  {
    name: 'NetworkX',
    role: 'Dependency graph',
    why: 'Directed import graph across all source files, hub detection',
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  },
  {
    name: 'GitPython',
    role: 'Repository cloning',
    why: 'Programmatic git clone into isolated temp directories per job',
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArchitecturePage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="border-b border-surface-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-pink-400 bg-pink-500/10 border border-pink-500/20 px-3 py-1 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse" />
              Under the hood
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold text-ink mb-4 leading-tight tracking-tight">
              How CodeAtlas Works
            </h1>
            <p className="text-ink-muted text-base max-w-2xl mx-auto leading-relaxed">
              CodeAtlas is a <strong className="text-ink font-semibold">production RAG system</strong> built for source code —
              not PDFs, not text files. It uses AST-aware chunking, hybrid dense+sparse retrieval,
              and Reciprocal Rank Fusion to answer architecture questions with exact source citations.
            </p>
          </div>
        </section>

        {/* ── What is RAG ───────────────────────────────────────────────────── */}
        <section className="border-b border-surface-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle mb-2">The problem this solves</p>
            <h2 className="text-xl font-bold text-ink mb-8">Why not just paste the code into the AI?</h2>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Naive */}
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
                <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">Naive approach</p>
                <div className="space-y-2 text-sm text-ink-muted">
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5 shrink-0">✗</span>
                    <span>Entire codebase → LLM context window. Fails for anything beyond ~500 files.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5 shrink-0">✗</span>
                    <span>No relevance filtering — the LLM sees irrelevant code and hallucinates.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5 shrink-0">✗</span>
                    <span>No persistence — every query re-processes the entire codebase.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5 shrink-0">✗</span>
                    <span>No citations — you can't verify where the answer came from.</span>
                  </div>
                </div>
              </div>

              {/* RAG */}
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">CodeAtlas RAG approach</p>
                <div className="space-y-2 text-sm text-ink-muted">
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                    <span>Index once into Qdrant — scales to any repo size, queries are fast.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                    <span>Only the top-10 most relevant chunks enter the prompt — no noise.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                    <span>Vectors persist — subsequent queries run in milliseconds, not minutes.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5 shrink-0">✓</span>
                    <span>Every answer cites the exact file, function, and line range it used.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pipeline ──────────────────────────────────────────────────────── */}
        <section className="border-b border-surface-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle mb-2">5-stage pipeline</p>
            <h2 className="text-xl font-bold text-ink mb-10">From GitHub URL to cited answer</h2>

            <div className="relative">
              {/* Single continuous connector line */}
              <div className="absolute left-5 top-10 bottom-10 w-px bg-gradient-to-b from-surface-border via-surface-border/50 to-transparent pointer-events-none" />

              <div className="space-y-5">
                {PIPELINE_STEPS.map((step) => (
                  <div key={step.num} className="flex gap-5">
                    {/* Step badge */}
                    <div className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center shrink-0 z-10 ${step.color.icon}`}>
                      <span className="text-xs font-black font-mono tracking-tight">{step.num}</span>
                    </div>

                    {/* Card */}
                    <div className="flex-1 rounded-2xl border border-surface-border bg-surface-card p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-2.5">
                        <div>
                          <h3 className="text-sm font-bold text-ink">{step.title}</h3>
                          <p className={`text-[11px] font-mono font-semibold mt-0.5 ${step.color.num}`}>{step.subtitle}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {step.tags.map(tag => (
                            <span key={tag} className="text-[10px] font-medium text-ink-subtle bg-surface-raised border border-surface-border/60 px-2 py-0.5 rounded-full">
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
          </div>
        </section>

        {/* ── Hybrid Search ─────────────────────────────────────────────────── */}
        <section className="border-b border-surface-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle mb-2">Retrieval architecture</p>
            <h2 className="text-xl font-bold text-ink mb-3">Hybrid search with RRF fusion</h2>
            <p className="text-sm text-ink-muted mb-10 max-w-2xl">
              A single dense vector search misses exact identifiers (function names, variable names). A single keyword search misses semantic similarity. CodeAtlas runs both in parallel and fuses them.
            </p>

            <div className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden">
              {/* Query input row */}
              <div className="px-6 py-4 bg-surface-raised/60 border-b border-surface-border flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-ink/5 border border-surface-border flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink">User query</p>
                  <p className="text-[11px] text-ink-muted font-mono">"How does authentication work in this codebase?"</p>
                </div>
              </div>

              {/* Two signals */}
              <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-surface-border">
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Dense signal</p>
                  </div>
                  <p className="text-[11px] text-ink-muted mb-3">embed_query() → 3,072-dim vector → cosine similarity search → <strong className="text-ink">top-20 candidates</strong></p>
                  <div className="space-y-1.5">
                    {['login() in auth/service.py', 'verify_token() in middleware.py', 'JWTPayload class in models.py'].map(r => (
                      <div key={r} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blue-500/5 border border-blue-500/15">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 shrink-0" />
                        <code className="text-[10px] font-mono text-blue-300/80">{r}</code>
                      </div>
                    ))}
                    <p className="text-[10px] text-ink-subtle pl-2">+ 17 more…</p>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Sparse signal</p>
                  </div>
                  <p className="text-[11px] text-ink-muted mb-3">to_sparse_vector() → BM25 TF scores → keyword index → <strong className="text-ink">top-20 candidates</strong></p>
                  <div className="space-y-1.5">
                    {['authenticate() in auth/service.py', 'password_hash() in utils/crypto.py', 'AUTH_SECRET in config.py'].map(r => (
                      <div key={r} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/15">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 shrink-0" />
                        <code className="text-[10px] font-mono text-amber-300/80">{r}</code>
                      </div>
                    ))}
                    <p className="text-[10px] text-ink-subtle pl-2">+ 17 more…</p>
                  </div>
                </div>
              </div>

              {/* RRF */}
              <div className="px-6 py-4 border-t border-surface-border bg-surface-raised/40">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-pink-400" />
                  <p className="text-xs font-bold text-pink-400 uppercase tracking-widest">Reciprocal Rank Fusion → top-10</p>
                </div>
                <p className="text-[11px] text-ink-muted">
                  RRF score = Σ 1/(k + rank<sub>i</sub>) across both signals. Results appearing in both lists are boosted.
                  Final top-10 chunks are injected into the Gemini prompt — with file path, function name, and line range attached.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Benchmarks ────────────────────────────────────────────────────── */}
        <section className="border-b border-surface-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle mb-2">Real benchmark results</p>
            <h2 className="text-xl font-bold text-ink mb-2">Measured performance</h2>
            <p className="text-xs text-ink-muted mb-8">
              Measured via pytest-benchmark on local hardware. Network-bound steps (Gemini embeddings, Qdrant writes) excluded — those are API/infra dependent.
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

        {/* ── Tech stack ────────────────────────────────────────────────────── */}
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

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
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

      <footer className="bg-surface-card border-t border-surface-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-accent flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="text-sm font-bold text-ink">CodeAtlas</span>
            <span className="text-surface-border">·</span>
            <span className="text-xs text-ink-subtle">AI-powered repository intelligence</span>
          </div>
          <Link to="/" className="flex items-center gap-1.5 text-xs text-ink-subtle hover:text-ink transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Home
          </Link>
        </div>
      </footer>
    </div>
  )
}
