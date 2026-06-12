// ── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string
  github_username: string
  email: string
  github_id: number
}

// ── Repository ────────────────────────────────────────────────────────────────

export type RepoStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface RepoSummary {
  purpose: string
  stack: string[]
  architecture: string
  entry_points: string[]
}

export interface OnboardingStep {
  order: number
  title: string
  files: string[]
  description: string
}

export interface OnboardingGuide {
  steps: OnboardingStep[]
  core_workflows: string[]
  learning_path: string
}

export interface ApiEndpoint {
  method: string | null
  path: string | null
  file_path: string
  function_name: string | null
  line: number
  language: string
}

export interface FileDependency {
  uses: string[]
  used_by: string[]
}

export interface Repository {
  id: string
  name: string
  github_url: string
  status: RepoStatus
  chunk_count: number
  created_at: string
  summary: RepoSummary | null
  onboarding: OnboardingGuide | null
  api_endpoints: ApiEndpoint[] | null
  dependencies: Record<string, FileDependency> | null
}

// ── Ingestion ─────────────────────────────────────────────────────────────────

export interface IngestionJob {
  job_id: string
  repository_id: string
  status: RepoStatus
  github_url: string
}

export interface IngestionStatus {
  job_id: string
  status: RepoStatus | 'cancelled'
  progress_pct: number
  progress_message: string
  error: string | null
  cancelled?: boolean
}

// ── Q&A ───────────────────────────────────────────────────────────────────────

export interface SourceCitation {
  file_path: string
  function_name: string | null
  class_name: string | null
  line_start: number | null
  line_end: number | null
  chunk_type: string
  chunk_preview?: string | null
}

export interface QueryResponse {
  question_id: string
  question: string
  answer: string
  sources: SourceCitation[]
  created_at: string
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceCitation[]
  created_at: string
}

export interface ChatSession {
  id: string
  repository_id: string
  title: string
  message_count: number
  created_at: string
}

export interface ChatAskResponse {
  session_id: string
  question_message: ChatMessage
  answer_message: ChatMessage
  questions_today: number
  questions_in_session: number
}

// ── Change Impact Analysis ────────────────────────────────────────────────────

export interface AffectedEndpoint {
  method: string | null
  path: string | null
  file_path: string
  function_name: string | null
}

export type RiskLevel = 'high' | 'medium' | 'low'

export interface ImpactResult {
  symbol: string
  matched_file: string | null
  risk: RiskLevel
  direct_dependents: string[]
  transitive_dependents: string[]
  affected_endpoints: AffectedEndpoint[]
  tests_to_run: string[]
  total_impact: number
  summary: string
}

// ── RAG Evaluation ────────────────────────────────────────────────────────────

export interface QuestionResult {
  question: string
  question_type: string       // "endpoint" | "paraphrase" | "class" | "import"
  endpoint: string
  expected_file: string
  retrieved_files: string[]
  hit: boolean
  rank: number | null
  reciprocal_rank: number
  answer: string | null       // LLM-generated answer (only when generation quality run)
  citation_hit: boolean       // whether answer cited the expected file
}

export interface AblationResult {
  mode: string                // "hybrid" | "dense" | "sparse"
  recall_at_5: number
  mrr: number
  total_questions: number
  passed: number
}

export interface EvalReport {
  recall_at_5: number
  mrr: number
  total_questions: number
  passed: number
  results: QuestionResult[]
  ablation: AblationResult[]          // per-mode ablation comparison
  citation_precision: number | null   // fraction of answers that cited the right file
  ran_at?: string | null
}

// ── Streaming chat ────────────────────────────────────────────────────────────

export type StreamEvent =
  | { type: 'sources'; sources: SourceCitation[] }
  | { type: 'token'; content: string }
  | { type: 'done'; user_message_id: string; message_id: string; questions_today: number; questions_in_session: number }
  | { type: 'error'; message: string }
