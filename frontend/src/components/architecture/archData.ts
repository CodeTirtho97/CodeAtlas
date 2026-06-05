export const PIPELINE_STEPS = [
  {
    num: '01',
    color: { icon: 'bg-blue-500/15 border-blue-500/25 text-blue-400', num: 'text-blue-400' },
    title: 'Clone & Filter',
    subtitle: 'GitPython + custom filter',
    desc: 'Repository is cloned into an isolated temp directory. A file-type allowlist strips binaries, lockfiles, and vendored code — only source files go forward.',
    tags: ['GitPython', 'File allowlist', 'Language detection'],
  },
  {
    num: '02',
    color: { icon: 'bg-violet-500/15 border-violet-500/25 text-violet-400', num: 'text-violet-400' },
    title: 'AST Parse → Chunks',
    subtitle: 'Tree-sitter, ~1ms/file',
    desc: 'Each source file is parsed with Tree-sitter into an AST. Functions, classes, and modules become semantic chunks — not naive line-count splits. This preserves code structure so the AI retrieves whole, meaningful units.',
    tags: ['Tree-sitter', 'Python · JS · TS · Java · Go', 'Fallback chunker'],
  },
  {
    num: '03',
    color: { icon: 'bg-pink-500/15 border-pink-500/25 text-pink-400', num: 'text-pink-400' },
    title: 'Embed → Vectors',
    subtitle: 'gemini-embedding-001, 3072-dim',
    desc: "Each chunk is embedded using Google's gemini-embedding-001 model (RETRIEVAL_DOCUMENT task type). Simultaneously, a vocabulary-free BM25-style sparse vector is generated via feature hashing — enabling hybrid search.",
    tags: ['gemini-embedding-001', '3,072 dimensions', 'Sparse BM25 (30k vocab)'],
  },
  {
    num: '04',
    color: { icon: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400', num: 'text-emerald-400' },
    title: 'Store in Qdrant + Postgres',
    subtitle: 'Persistent vector + metadata',
    desc: 'Dense and sparse vectors are stored in Qdrant with full payload metadata (file path, function name, line range). Structural metadata — dependencies, API endpoints — is persisted to PostgreSQL for the analysis tabs.',
    tags: ['Qdrant vector store', 'PostgreSQL', 'Dependency graph', 'API extractor'],
  },
  {
    num: '05',
    color: { icon: 'bg-amber-500/15 border-amber-500/25 text-amber-400', num: 'text-amber-400' },
    title: 'Hybrid Retrieve → Generate',
    subtitle: 'Manual RRF + Gemini Flash',
    desc: 'At query time, two independent query_points calls run against the dense and sparse indexes (top-20 each). Results are merged with manual Reciprocal Rank Fusion (k=60) — chunks appearing in both lists are boosted. The final top-10 enter the Gemini prompt with exact file, function, and line citations.',
    tags: ['Dense + Sparse search', 'Manual RRF (k=60)', 'Top-10 context', 'Source citations'],
  },
]

export const BENCHMARKS = [
  { value: '~1ms',      label: 'Parse time per file',     sub: 'Tree-sitter AST on local hardware — varies by file size and CPU',        color: 'text-blue-400',   bg: 'bg-blue-500/8 border-blue-500/20'     },
  { value: '978',       label: 'Files / second',          sub: 'Parser throughput on 100-file batch — scales with CPU core count',        color: 'text-violet-400', bg: 'bg-violet-500/8 border-violet-500/20' },
  { value: '3,072',     label: 'Embedding dimensions',    sub: 'gemini-embedding-001 fixed output — model dependent',                color: 'text-pink-400',   bg: 'bg-pink-500/8 border-pink-500/20'     },
  { value: '0.02ms',    label: 'Sparse vector latency',   sub: 'Vocabulary-free sparse TF via feature hashing — no IDF weighting',   color: 'text-emerald-400',bg: 'bg-emerald-500/8 border-emerald-500/20'},
  { value: '30,000',    label: 'Hash vocab space',        sub: 'MD5 feature hashing, low collision rate — collisions skipped silently',color: 'text-amber-400',  bg: 'bg-amber-500/8 border-amber-500/20'   },
  { value: '20+20→10',  label: 'Retrieval pipeline',      sub: 'Dense + sparse → manual RRF fusion (k=60)',       color: 'text-cyan-400',   bg: 'bg-cyan-500/8 border-cyan-500/20'     },
]

export const TECH_STACK = [
  { name: 'FastAPI',    role: 'Async Python backend',    why: 'Background ingestion tasks, native async/await, auto OpenAPI docs',                                  color: 'text-teal-400 bg-teal-500/10 border-teal-500/20'       },
  { name: 'Qdrant',     role: 'Vector database',         why: 'Stores dense + sparse vectors per chunk. Two separate query_points calls merged with manual RRF (k=60) after native prefetch+fusion was dropped in qdrant-client 1.18.0',  color: 'text-pink-400 bg-pink-500/10 border-pink-500/20'       },
  { name: 'Tree-sitter',role: 'AST parser',              why: 'Language-aware chunking at function/class boundaries, not line counts',                               color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'       },
  { name: 'Gemini',     role: 'Embeddings + generation', why: '3072-dim embeddings (gemini-embedding-001) + gemini-2.5-flash for answers',                           color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  { name: 'PostgreSQL', role: 'Relational metadata store',why: 'Job state, repo records, chat sessions, API endpoints, dependency graphs',                          color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  { name: 'React + Vite',role: 'Frontend SPA',           why: 'TypeScript, Tailwind, component-level state, optimistic UI updates',                                  color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20'       },
  { name: 'NetworkX',   role: 'Dependency graph (backend)', why: 'Builds a directed import graph across all source files, identifies hubs, computes used_by/uses for every file', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  { name: 'React Flow', role: 'Dependency graph (frontend)', why: '@xyflow/react renders the interactive graph; dagre computes TB hierarchical layout; connected-component BFS splits clusters into tabs', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  { name: 'SQLAlchemy', role: 'Async ORM',                why: 'Async session management over PostgreSQL — repo records, job state, chat history, API endpoints, dependency graphs all go through typed models', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  { name: 'GitPython',  role: 'Repository cloning',      why: 'Programmatic git clone into isolated temp directories per job',                                       color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'},
]
