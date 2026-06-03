import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import apiClient from '../api/client'

export default function CallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()

  useEffect(() => {
    const code = searchParams.get('code')

    if (!code) {
      navigate('/', { replace: true })
      return
    }

    const exchangeCode = async () => {
      try {
        const response = await apiClient.post('/auth/callback', { code })
        const { access_token, user } = response.data

        login(user, access_token)
        navigate('/', { replace: true })
      } catch (error) {
        console.error('OAuth callback error:', error)
        navigate('/', { replace: true })
      }
    }

    exchangeCode()
  }, [searchParams, navigate, login])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-700">Signing you in...</p>
      </div>
    </div>
  )
}
