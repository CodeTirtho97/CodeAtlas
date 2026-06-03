import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import CallbackPage from './pages/CallbackPage'
import IngestionPage from './pages/IngestionPage'
import ArchitecturePage from './pages/ArchitecturePage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/architecture" element={<ArchitecturePage />} />
      <Route path="/callback" element={<CallbackPage />} />
      <Route
        path="/ingest/:jobId/:repoId"
        element={
          <ProtectedRoute>
            <IngestionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/:repoId"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  )
}

export default App
