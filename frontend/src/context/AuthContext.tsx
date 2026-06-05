import React, { createContext, useContext, useEffect, useState } from 'react'
import apiClient from '../api/client'

interface User {
  id: string
  github_username: string
  email: string
  github_id: number
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Restore user profile from localStorage on mount.
  // The JWT lives in an httpOnly cookie — we can't read it from JS.
  // If the cookie has expired, the first API call will 401 and the
  // interceptor in client.ts will clear localStorage and redirect home.
  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
        setIsAuthenticated(true)
        // Pre-warm the backend so it's ready before the first real API call.
        apiClient.get('/health').catch(() => {})
      } catch {
        localStorage.removeItem('user')
      }
    }
  }, [])

  const login = (userData: User) => {
    setUser(userData)
    setIsAuthenticated(true)
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const logout = () => {
    setUser(null)
    setIsAuthenticated(false)
    localStorage.removeItem('user')
    // Tell the server to clear the httpOnly cookie (fire-and-forget).
    apiClient.post('/auth/logout').catch(() => {})
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
