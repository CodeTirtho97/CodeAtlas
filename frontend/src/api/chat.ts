import client from './client'
import type { ChatSession, ChatMessage, ChatAskResponse } from '../types'

export const chatApi = {
  getSessions: async (repositoryId: string): Promise<ChatSession[]> => {
    const r = await client.get('/chat/sessions', {
      params: { repository_id: repositoryId },
    })
    return r.data
  },

  createSession: async (repositoryId: string): Promise<ChatSession> => {
    const r = await client.post('/chat/sessions', {
      repository_id: repositoryId,
    })
    return r.data
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    await client.delete(`/chat/sessions/${sessionId}`)
  },

  getMessages: async (sessionId: string): Promise<ChatMessage[]> => {
    const r = await client.get(`/chat/sessions/${sessionId}/messages`)
    return r.data
  },

  ask: async (
    sessionId: string,
    question: string
  ): Promise<ChatAskResponse> => {
    const r = await client.post(`/chat/sessions/${sessionId}/ask`, {
      question,
    })
    return r.data
  },
}
