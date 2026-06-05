import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import apiClient from '../api/client'

const MESSAGES = [
  { after: 0,  text: 'Signing you in…' },
  { after: 8,  text: 'Connecting to server…' },
  { after: 20, text: 'Server is waking up, hang tight…' },
  { after: 40, text: 'Almost there, just a few more seconds…' },
]

const MAX_RETRIES = 4
const RETRY_DELAY_MS = 8_000

function isColdStartError(err: any): boolean {
  if (!err.response) return true  // network timeout / no response
  const status = err.response.status
  return status === 502 || status === 503 || status === 504
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export default function CallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const exchangedRef = useRef(false)

  // Tick elapsed seconds for progressive messaging
  useEffect(() => {
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (exchangedRef.current) return
    exchangedRef.current = true

    const code = searchParams.get('code')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      setError('GitHub access was denied. Please try again.')
      return
    }
    if (!code) {
      setError('No authorization code received from GitHub.')
      return
    }

    const exchangeCode = async () => {
      let lastErr: any
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await apiClient.post('/auth/callback', { code })
          const { user } = response.data
          login(user)
          navigate('/', { replace: true })
          return
        } catch (err: any) {
          lastErr = err
          if (!isColdStartError(err) || attempt === MAX_RETRIES) break
          await sleep(RETRY_DELAY_MS)
        }
      }

      const msg =
        lastErr.response?.data?.detail ||
        lastErr.response?.data?.message ||
        'Authentication failed. Please try again.'
      setError(msg)
    }

    exchangeCode()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const currentMessage =
    [...MESSAGES].reverse().find(m => elapsed >= m.after)?.text ?? MESSAGES[0].text

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface p-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-sm font-semibold text-ink mb-2">Sign-in failed</h2>
          <p className="text-xs text-ink-muted mb-6 leading-relaxed">{error}</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-raised hover:bg-surface-border text-sm text-ink transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full border-2 border-surface-border border-t-accent animate-spin mx-auto mb-4" />
        <p className="text-sm text-ink-muted transition-all duration-500">{currentMessage}</p>
        {elapsed >= 20 && (
          <p className="text-xs text-ink-subtle mt-2">
            This is normal on the first sign-in of the day.
          </p>
        )}
      </div>
    </div>
  )
}
