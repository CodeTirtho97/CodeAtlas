import { useAuth } from '../context/AuthContext'
import apiClient from '../api/client'

export default function LandingPage() {
  const { isAuthenticated, login } = useAuth()

  const handleLogin = async () => {
    try {
      const response = await apiClient.get('/auth/login')
      window.location.href = response.data.auth_url
    } catch (error) {
      console.error('Login error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">CodeAtlas</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            AI-Powered Repository Intelligence
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Turn any GitHub repository into a searchable knowledge graph
          </p>

          {!isAuthenticated ? (
            <button
              onClick={handleLogin}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg text-lg"
            >
              Sign in with GitHub
            </button>
          ) : (
            <div>
              <p className="text-gray-700 mb-4">Welcome! Your dashboard is coming soon.</p>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">🔍 Smart Search</h3>
            <p className="text-gray-600">Semantic code search across your entire repository</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">🤖 AI-Powered</h3>
            <p className="text-gray-600">Understand code using advanced RAG and embeddings</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">📊 Visual Insights</h3>
            <p className="text-gray-600">Explore dependencies and architecture at a glance</p>
          </div>
        </div>
      </main>
    </div>
  )
}
