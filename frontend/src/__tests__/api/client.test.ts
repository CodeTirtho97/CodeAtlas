import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import client from '../../api/client'

// Reach into the axios interceptor list to grab our registered error handler.
// axios v1.x stores handlers as an array on the AxiosInterceptorManager.
function getResponseErrorHandler() {
  const handlers = (client.interceptors.response as any).handlers as Array<{
    fulfilled: ((v: unknown) => unknown) | null
    rejected: ((e: unknown) => unknown) | null
  } | null>
  const last = [...handlers].reverse().find(Boolean)
  return last?.rejected ?? null
}

describe('API client configuration', () => {
  it('sends cookies with every request (withCredentials=true)', () => {
    expect(client.defaults.withCredentials).toBe(true)
  })

  it('sets Content-Type to application/json by default', () => {
    expect(client.defaults.headers['Content-Type']).toBe('application/json')
  })

  it('does NOT inject an Authorization header on requests', () => {
    // There must be no request interceptor that adds Bearer tokens.
    // The old localStorage-based approach is gone; cookies are sent automatically.
    const requestHandlers = (client.interceptors.request as any).handlers as Array<unknown> | null
    const hasAuthInjector = (requestHandlers ?? []).some((h: any) => {
      if (!h?.fulfilled) return false
      const src = h.fulfilled.toString()
      return src.includes('Authorization') || src.includes('Bearer')
    })
    expect(hasAuthInjector).toBe(false)
  })
})

describe('401 response interceptor', () => {
  let originalHref: string

  beforeEach(() => {
    localStorage.setItem('user', JSON.stringify({ id: '1', github_username: 'tester' }))
    originalHref = window.location.href
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: window.location.href },
    })
  })

  afterEach(() => {
    localStorage.clear()
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: originalHref },
    })
  })

  it('clears localStorage user on 401', async () => {
    const handler = getResponseErrorHandler()!
    try { await handler({ response: { status: 401 } }) } catch { /* expected */ }
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('redirects to "/" on 401', async () => {
    const handler = getResponseErrorHandler()!
    try { await handler({ response: { status: 401 } }) } catch { /* expected */ }
    expect(window.location.href).toBe('/')
  })

  it('does NOT clear localStorage for non-401 errors', async () => {
    const handler = getResponseErrorHandler()!
    try { await handler({ response: { status: 500 } }) } catch { /* expected */ }
    expect(localStorage.getItem('user')).not.toBeNull()
  })

  it('does NOT clear localStorage for non-401 errors', async () => {
    const handler = getResponseErrorHandler()!
    try { await handler({ response: { status: 403 } }) } catch { /* expected */ }
    expect(window.location.href).not.toBe('/')
  })

  it('rejects the promise so callers can handle the error', async () => {
    const handler = getResponseErrorHandler()!
    const err = { response: { status: 500 }, message: 'Server error' }
    await expect(handler(err)).rejects.toEqual(err)
  })
})
