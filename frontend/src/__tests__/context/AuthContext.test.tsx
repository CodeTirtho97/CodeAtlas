import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../../context/AuthContext'

// Prevent real HTTP calls from the fire-and-forget logout request
vi.mock('../../api/client', () => ({
  default: {
    post: vi.fn().mockResolvedValue({}),
  },
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
)

const mockUser = {
  id: 'user-1',
  github_username: 'testuser',
  email: 'test@example.com',
  github_id: 12345,
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('starts unauthenticated with no user', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('login sets authenticated state and user', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    act(() => result.current.login(mockUser))
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(mockUser)
  })

  it('login persists user profile to localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    act(() => result.current.login(mockUser))
    expect(JSON.parse(localStorage.getItem('user')!)).toEqual(mockUser)
  })

  it('login does NOT store access_token in localStorage (cookie-based auth)', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    act(() => result.current.login(mockUser))
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('logout clears user and sets isAuthenticated to false', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    act(() => result.current.login(mockUser))
    act(() => result.current.logout())
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('logout removes user from localStorage', () => {
    const { result } = renderHook(() => useAuth(), { wrapper })
    act(() => result.current.login(mockUser))
    act(() => result.current.logout())
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('logout calls POST /auth/logout to clear httpOnly cookie', async () => {
    const apiClient = await import('../../api/client')
    const { result } = renderHook(() => useAuth(), { wrapper })
    act(() => result.current.login(mockUser))
    act(() => result.current.logout())
    expect(apiClient.default.post).toHaveBeenCalledWith('/auth/logout')
  })

  it('restores session from localStorage on mount', () => {
    localStorage.setItem('user', JSON.stringify(mockUser))
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.user).toEqual(mockUser)
  })

  it('ignores localStorage if only access_token is present (old format)', () => {
    localStorage.setItem('access_token', 'some-old-token')
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
  })

  it('clears corrupted localStorage user data on mount', () => {
    localStorage.setItem('user', 'not-valid-json{{{')
    const { result } = renderHook(() => useAuth(), { wrapper })
    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('throws when useAuth is used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    )
    spy.mockRestore()
  })
})
