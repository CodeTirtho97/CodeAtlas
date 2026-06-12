import client from './client'
import type {
  Repository, IngestionJob, IngestionStatus, ImpactResult, EvalReport,
  RepoComposition, CodeSearchResponse,
} from '../types'

export const reposApi = {
  list: async (): Promise<Repository[]> => {
    const r = await client.get('/repos')
    return r.data.repositories
  },

  get: async (repoId: string): Promise<Repository> => {
    const r = await client.get(`/repos/${repoId}`)
    // Handle both { repository: {...} } and direct object responses
    return r.data.repository ?? r.data
  },

  ingest: async (githubUrl: string): Promise<IngestionJob> => {
    const r = await client.post('/repos/ingest', { github_url: githubUrl })
    return r.data
  },

  getIngestionStatus: async (jobId: string): Promise<IngestionStatus> => {
    const r = await client.get(`/repos/ingest/${jobId}/status`)
    return r.data
  },

  cancelIngestion: async (jobId: string): Promise<void> => {
    await client.post(`/repos/ingest/${jobId}/cancel`)
  },

  delete: async (repoId: string): Promise<void> => {
    await client.delete(`/repos/${repoId}`)
  },

  getComposition: async (repoId: string): Promise<RepoComposition> => {
    const r = await client.get(`/repos/${repoId}/composition`)
    return r.data
  },

  searchCode: async (repoId: string, query: string): Promise<CodeSearchResponse> => {
    const r = await client.post('/query/search', { repository_id: repoId, query })
    return r.data
  },

  analyzeImpact: async (repoId: string, symbol: string): Promise<ImpactResult> => {
    const r = await client.post(`/repos/${repoId}/impact`, { symbol })
    return r.data
  },

  getEvalResult: async (repoId: string): Promise<EvalReport | null> => {
    const r = await client.get(`/repos/${repoId}/eval/result`)
    return r.data ?? null
  },

  runEval: async (repoId: string): Promise<EvalReport> => {
    const r = await client.post(`/repos/${repoId}/eval/run`)
    return r.data
  },
}
