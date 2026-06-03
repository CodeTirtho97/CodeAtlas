# Frontend Development Guide

## Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
cd frontend

# Install dependencies
npm install
```

## Running Locally

### With Docker Compose
```bash
docker-compose up frontend
```

### Development Server
```bash
npm run dev
```

Opens at `http://localhost:3000` with hot module replacement.

## Building

### Development Build
```bash
npm run build
```

Output: `dist/` directory

### Preview Production Build
```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── main.tsx                   # Vite entry point
│   ├── App.tsx                    # Router and app shell
│   ├── index.css                  # Global styles + Tailwind
│   ├── api/
│   │   └── client.ts              # Axios instance with auth
│   ├── context/
│   │   └── AuthContext.tsx        # Auth state management
│   ├── pages/
│   │   ├── LandingPage.tsx        # Home page
│   │   ├── CallbackPage.tsx       # OAuth callback handler
│   │   └── DashboardPage.tsx      # Repo dashboard
│   ├── components/                # Reusable components (Phase 2+)
│   ├── hooks/                     # Custom React hooks (Phase 2+)
│   └── types/                     # TypeScript types (Phase 2+)
├── index.html                     # HTML template
├── vite.config.ts                 # Vite configuration
├── tsconfig.json                  # TypeScript configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── postcss.config.js              # PostCSS for Tailwind
├── package.json
├── .env
├── .env.example
├── Dockerfile
└── README.md
```

## Code Style

### TypeScript/React
- **Formatter:** Prettier (auto in package.json)
- **Linter:** ESLint
- **Language:** TypeScript (strict mode)

```bash
# Lint
npm run lint

# Format (with Prettier integration)
npx prettier --write src/
```

### Naming Conventions
- Files: `PascalCase.tsx` (components), `camelCase.ts` (utilities)
- Components: `PascalCase`
- Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`

## Styling

### Tailwind CSS
All styling uses Tailwind utility classes. No custom CSS unless necessary.

```tsx
// Good
<div className="flex items-center justify-between bg-blue-600 p-4">
  <h1 className="text-2xl font-bold text-white">Title</h1>
</div>

// Avoid
<div style={{display: 'flex', ...}}>
```

### Color Palette
Uses Tailwind defaults. Extend in `tailwind.config.js` if needed.

## State Management

### Authentication (Context API)
```tsx
// In any component
import { useAuth } from '../context/AuthContext'

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth()
  
  if (!isAuthenticated) return <p>Not logged in</p>
  
  return <p>Welcome {user?.github_username}</p>
}
```

### Other State (Phase 2+)
Consider Context API for global state or local state for component-level state.

## API Integration

### Making Requests
```tsx
import apiClient from '../api/client'

// GET
const response = await apiClient.get('/repos')

// POST
const response = await apiClient.post('/repos/ingest', {
  github_url: 'https://github.com/fastapi/fastapi'
})

// DELETE
await apiClient.delete(`/repos/${repoId}`)
```

### Error Handling
```tsx
try {
  const response = await apiClient.get('/repos')
  setRepos(response.data.repositories)
} catch (error: any) {
  const message = error.response?.data?.message || 'An error occurred'
  console.error(message)
}
```

## Routing

Uses React Router v6:

```tsx
// In App.tsx
<Routes>
  <Route path="/" element={<LandingPage />} />
  <Route path="/callback" element={<CallbackPage />} />
  <Route path="/dashboard/:repoId" element={<DashboardPage />} />
</Routes>

// In components
import { useNavigate, useParams } from 'react-router-dom'

function MyComponent() {
  const navigate = useNavigate()
  const { repoId } = useParams()
  
  navigate(`/dashboard/${repoId}`)
}
```

## Testing

### Unit Tests (Phase 2+)
```bash
npm run test
```

Setup with Vitest + React Testing Library.

### Test Structure
```
src/__tests__/
├── pages/
│   ├── LandingPage.test.tsx
│   └── DashboardPage.test.tsx
├── components/
│   └── Button.test.tsx
└── hooks/
    └── useAuth.test.ts
```

### Example Test
```typescript
import { render, screen } from '@testing-library/react'
import { AuthProvider } from '../context/AuthContext'
import LandingPage from '../pages/LandingPage'

test('displays login button when not authenticated', () => {
  render(
    <AuthProvider>
      <LandingPage />
    </AuthProvider>
  )
  
  expect(screen.getByText(/Sign in with GitHub/i)).toBeInTheDocument()
})
```

## Environment Variables

Required for development:
- `VITE_API_URL` — Backend API URL (default: http://localhost:8000)
- `VITE_GITHUB_CLIENT_ID` — GitHub OAuth app client ID

Set in `.env`:
```
VITE_API_URL=http://localhost:8000
VITE_GITHUB_CLIENT_ID=your_client_id
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL
```

## Performance

### Code Splitting (Vite auto)
Vite automatically splits code at route boundaries.

### Bundle Analysis
```bash
npm run build
# Check dist/ folder size
```

Target: < 300KB gzipped

### Optimization Tips
- Lazy load routes
- Memoize expensive components (React.memo)
- Use `useCallback` for event handlers
- Minimize bundle size with tree-shaking

## Accessibility (WCAG 2.1 AA)

### Requirements
- Semantic HTML: `<button>`, `<nav>`, `<main>`
- ARIA labels: `aria-label`, `aria-describedby`
- Keyboard navigation: Tab through all interactive elements
- Color contrast: ≥ 4.5:1 for text
- Focus states: visible on all buttons/links

### Testing
```bash
# Lighthouse audit
npm run build && npm run preview
# Chrome DevTools → Lighthouse

# Manual testing
# Tab through page, check focus styles
# Use screen reader (NVDA, JAWS)
```

## Debugging

### React DevTools
Install React DevTools browser extension for component inspection.

### Network Requests
Use browser DevTools Network tab to inspect API calls.

### Console Errors
Check browser console for TypeScript/runtime errors.

### VS Code Setup
```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss"
  ]
}
```

## Adding a New Page

1. Create file in `src/pages/NewPage.tsx`
2. Implement component
3. Add route in `App.tsx`
4. Add navigation link if needed

Example:
```tsx
// src/pages/NewPage.tsx
export default function NewPage() {
  return <div className="p-4">New Page</div>
}

// src/App.tsx
import NewPage from './pages/NewPage'

<Route path="/new" element={<NewPage />} />
```

## Adding a New Component

1. Create file in `src/components/ComponentName.tsx`
2. Use TypeScript interfaces for props
3. Export component

Example:
```tsx
// src/components/Button.tsx
interface ButtonProps {
  label: string
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

export default function Button({
  label,
  onClick,
  variant = 'primary'
}: ButtonProps) {
  const baseClass = 'px-4 py-2 rounded font-semibold'
  const variantClass = variant === 'primary' 
    ? 'bg-blue-600 text-white' 
    : 'bg-gray-200 text-gray-900'
  
  return (
    <button 
      className={`${baseClass} ${variantClass}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
```

## Phase 2 TODOs

- [ ] Implement dashboard components (RepoSummaryCard, OnboardingGuide, etc.)
- [ ] Add hooks (useRepos, useIngestionStatus, etc.)
- [ ] Implement repo ingestion form and progress UI
- [ ] Implement Q&A interface
- [ ] Add test suite
- [ ] Add component library documentation
- [ ] Implement error boundary
- [ ] Add loading skeleton components

## Browser Support

- Chrome/Edge: last 2 versions
- Firefox: last 2 versions
- Safari: last 2 versions
- Mobile: iOS Safari 14+, Chrome Android last 2 versions

---

See `Project_Spec.md` for requirements and `../README.md` for project overview.
