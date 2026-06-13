import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface HeaderProps {
  repoName?: string
  repoUrl?: string
}

const NAV_LINKS = [
  { to: '/',             label: 'Home'         },
  { to: '/architecture', label: 'Architecture' },
]

export default function Header({ repoName, repoUrl }: HeaderProps) {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/')
    setMenuOpen(false)
  }

  const scrollToRepos = () => {
    const el = document.getElementById('your-repos')
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top, behavior: 'smooth' })
  }

  const handleMyRepos = () => {
    setMenuOpen(false)
    if (pathname === '/') {
      scrollToRepos()
    } else {
      navigate('/')
      setTimeout(scrollToRepos, 150)
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-surface-card/95 backdrop-blur-md border-b border-surface-border shadow-[0_1px_0_0_rgba(47,129,247,0.10),0_4px_24px_0_rgba(0,0,0,0.45)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-6">

        {/* ── Left: logo + optional repo breadcrumb ── */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <Link to="/" className="flex items-center gap-2 shrink-0 group">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shadow-sm shadow-accent/30 group-hover:shadow-accent/50 transition-shadow">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="font-bold text-sm text-ink tracking-tight">CodeAtlas</span>
          </Link>

          {repoName && (
            <>
              <span className="text-surface-border select-none">/</span>
              {repoUrl ? (
                <a
                  href={repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-ink-muted hover:text-ink truncate transition-colors flex items-center gap-1 max-w-[200px]"
                >
                  <svg className="w-3.5 h-3.5 shrink-0 text-ink-subtle" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span className="truncate">{repoName}</span>
                  <svg className="w-3 h-3 shrink-0 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                  </svg>
                </a>
              ) : (
                <span className="text-sm text-ink-muted truncate max-w-[200px]">{repoName}</span>
              )}
            </>
          )}
        </div>

        {/* ── Centre: nav links (hide when showing repo breadcrumb) ── */}
        {!repoName && (
          <nav className="hidden sm:flex items-center flex-1 justify-center">
            <div className="flex items-center gap-0.5 bg-surface-raised/70 border border-surface-border/70 rounded-xl p-1">
              {NAV_LINKS.map(link => {
                const active = pathname === link.to
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                      active
                        ? 'bg-accent/10 text-accent font-semibold border border-accent/30 shadow-sm shadow-accent/10'
                        : 'text-ink-subtle hover:text-ink-muted'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </div>
          </nav>
        )}

        {/* Spacer when breadcrumb is shown */}
        {repoName && <div className="flex-1" />}

        {/* ── Right: auth ── */}
        <div className="shrink-0">
          {isAuthenticated && user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border transition-all duration-150 text-sm ${
                  menuOpen
                    ? 'bg-surface-raised border-surface-border'
                    : 'border-transparent hover:bg-surface-raised hover:border-surface-border'
                }`}
              >
                <img
                  src={`https://github.com/${user.github_username}.png?size=32`}
                  alt={user.github_username}
                  className="w-6 h-6 rounded-full ring-1 ring-surface-border"
                />
                <span className="text-ink-muted hidden sm:block text-xs font-medium">{user.github_username}</span>
                <svg className={`w-3 h-3 text-ink-subtle transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              {/* Dropdown — always rendered, transitions in/out */}
              <div className={`absolute right-0 top-full mt-2 w-52 rounded-xl border border-surface-border bg-surface-card shadow-2xl shadow-black/50 overflow-hidden z-20
                transition-all duration-200 origin-top-right
                ${menuOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'}`}>

                {/* User info */}
                <div className="px-4 py-3 bg-surface-raised/50 border-b border-surface-border">
                  <p className="text-[10px] text-ink-subtle uppercase tracking-widest font-semibold mb-0.5">Signed in as</p>
                  <p className="text-sm font-semibold text-ink truncate">@{user.github_username}</p>
                </div>

                {/* Links */}
                <div className="py-1">
                  <button
                    onClick={handleMyRepos}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-muted hover:text-ink hover:bg-surface-raised/60 transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"/>
                    </svg>
                    My Repositories
                  </button>
                  <Link
                    to="/architecture"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-muted hover:text-ink hover:bg-surface-raised/60 transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z"/>
                    </svg>
                    Architecture
                  </Link>
                </div>

                {/* Sign out */}
                <div className="border-t border-surface-border py-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/>
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <a
              href="#sign-in"
              onClick={e => { e.preventDefault(); document.querySelector<HTMLButtonElement>('[data-sign-in]')?.click() }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-border border border-surface-border text-xs font-medium text-ink transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Sign in
            </a>
          )}
        </div>

      </div>
    </header>
  )
}
