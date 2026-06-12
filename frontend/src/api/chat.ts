import client from './client'
import type { ChatSession, ChatMessage, ChatAskResponse, StreamEvent } from '../types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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

  /** Stream a chat answer via SSE. Calls onEvent for each parsed event.
   *  Throws with .status on HTTP errors (e.g. 429 rate limit). */
  streamAsk: async (
    sessionId: string,
    question: string,
    onEvent: (evt: StreamEvent) => void,
    signal?: AbortSignal,
  ): Promise<void> => {
    const response = await fetch(
      `${API_URL}/chat/sessions/${sessionId}/stream`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ question }),
        signal,
      }
    )

    if (!response.ok) {
      const text = await response.text()
      let detail = 'Request failed'
      try { detail = JSON.parse(text).detail } catch { detail = text || detail }
      const err: any = new Error(detail)
      err.status = response.status
      throw err
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // SSE events are separated by double newline
      const parts = buffer.split('\n\n')
      buffer = parts.pop() ?? ''
      for (const part of parts) {
        const line = part.trim()
        if (line.startsWith('data: ')) {
          try { onEvent(JSON.parse(line.slice(6))) } catch { /* ignore malformed */ }
        }
      }
    }
  },
}
