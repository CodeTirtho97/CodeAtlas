const DENSE_EXAMPLES = ['login() in auth/service.py', 'verify_token() in middleware.py', 'JWTPayload class in models.py']
const SPARSE_EXAMPLES = ['authenticate() in auth/service.py', 'password_hash() in utils/crypto.py', 'AUTH_SECRET in config.py']

export default function HybridSearchSection() {
  return (
    <section className="border-b border-surface-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-subtle mb-2">Retrieval architecture</p>
        <h2 className="text-xl font-bold text-ink mb-3">Hybrid search with RRF fusion</h2>
        <p className="text-sm text-ink-muted mb-10 max-w-2xl">
          A single dense vector search misses exact identifiers (function names, variable names). A single keyword search misses semantic similarity. CodeAtlas runs both in parallel and fuses them.
        </p>

        <div className="rounded-2xl border border-surface-border bg-surface-card overflow-hidden">
          {/* Query */}
          <div className="px-6 py-4 bg-surface-raised/60 border-b border-surface-border flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-ink/5 border border-surface-border flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
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
              <p className="text-[11px] text-ink-muted mb-3">embed_query() → 3,072-dim vector → cosine similarity → <strong className="text-ink">top-20</strong></p>
              <div className="space-y-1.5">
                {DENSE_EXAMPLES.map(r => (
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
              <p className="text-[11px] text-ink-muted mb-3">to_sparse_vector() → BM25 TF scores → keyword index → <strong className="text-ink">top-20</strong></p>
              <div className="space-y-1.5">
                {SPARSE_EXAMPLES.map(r => (
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
  )
}
