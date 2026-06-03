import client from './client'
import type { Repository, IngestionJob, IngestionStatus } from '../types'

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

  delete: async (repoId: string): Promise<void> => {
    await client.delete(`/repos/${repoId}`)
  },
}
