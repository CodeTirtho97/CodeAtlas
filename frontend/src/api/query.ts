import client from './client'
import type { QueryResponse } from '../types'

export const queryApi = {
  ask: async (repositoryId: string, question: string): Promise<QueryResponse> => {
    const r = await client.post('/query', { repository_id: repositoryId, question })
    return r.data
  },
}
