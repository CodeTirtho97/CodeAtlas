import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CallbackPage from '../../pages/CallbackPage'

// ─── Mocks ────────────────────────────────────────────────────────────────────
// vi.mock() is hoisted to the top of the file by vitest, so any variables it
// references must be created with vi.hoisted() to avoid TDZ errors.

const { mockLogin, mockNavigate, mockApiPost } = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockNavigate: vi.fn(),
  mockApiPost: vi.fn(),
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('../../api/client', () => ({
  default: { post: mockApiPost },
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderCallback(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/callback${search}`]}>
      <CallbackPage />
    </MemoryRouter>
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows a loading spinner while exchanging the code', () => {
    mockApiPost.mockReturnValue(new Promise(() => {})) // never resolves
    renderCallback('?code=abc123')
    expect(screen.getByText(/signing you in/i)).toBeInTheDocument()
  })

  it('shows an error when GitHub denies access', async () => {
    renderCallback('?error=access_denied')
    await waitFor(() => {
      expect(screen.getByText(/github access was denied/i)).toBeInTheDocument()
    })
  })

  it('shows an error when no OAuth code is present in the URL', async () => {
    renderCallback()
    await waitFor(() => {
      expect(screen.getByText(/no authorization code received/i)).toBeInTheDocument()
    })
  })

  it('renders a "Back to home" link in the error state', async () => {
    renderCallback('?error=access_denied')
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /back to home/i })).toBeInTheDocument()
    })
  })

  it('calls login with the user object on a successful exchange', async () => {
    const user = { id: '1', github_username: 'alice', email: 'alice@example.com', github_id: 99 }
    mockApiPost.mockResolvedValue({ data: { user } })
    renderCallback('?code=valid-code')
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(user)
    })
  })

  it('does NOT pass an access_token to login (cookie-based auth)', async () => {
    const user = { id: '1', github_username: 'alice', email: 'alice@example.com', github_id: 99 }
    // Backend now only returns { user } — no access_token in the body
    mockApiPost.mockResolvedValue({ data: { user } })
    renderCallback('?code=valid-code')
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(1)
      // login() should be called with exactly one argument (the user object)
      expect(mockLogin.mock.calls[0]).toHaveLength(1)
    })
  })

  it('navigates to "/" after a successful login', async () => {
    const user = { id: '1', github_username: 'alice', email: 'alice@example.com', github_id: 99 }
    mockApiPost.mockResolvedValue({ data: { user } })
    renderCallback('?code=valid-code')
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
    })
  })

  it('shows a backend error message on API failure', async () => {
    mockApiPost.mockRejectedValue({
      response: { data: { detail: 'GitHub token expired' } },
    })
    renderCallback('?code=bad-code')
    await waitFor(() => {
      expect(screen.getByText(/github token expired/i)).toBeInTheDocument()
    })
  })

  it('shows a generic fallback error on unknown failure', async () => {
    mockApiPost.mockRejectedValue(new Error('Network error'))
    renderCallback('?code=bad-code')
    await waitFor(() => {
      expect(screen.getByText(/authentication failed/i)).toBeInTheDocument()
    })
  })

  it('only exchanges the code once even if the component re-renders', async () => {
    const user = { id: '1', github_username: 'alice', email: 'alice@example.com', github_id: 99 }
    mockApiPost.mockResolvedValue({ data: { user } })
    const { rerender } = renderCallback('?code=single-use')
    rerender(
      <MemoryRouter initialEntries={['/callback?code=single-use']}>
        <CallbackPage />
      </MemoryRouter>
    )
    await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(1))
  })
})
