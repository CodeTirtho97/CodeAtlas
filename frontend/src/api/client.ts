import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// withCredentials ensures the httpOnly JWT cookie is sent on every request.
// No manual token injection needed — the browser handles the cookie automatically.
const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  // Safety net so a stuck backend surfaces an error instead of hanging the UI
  // forever. Long-running work (e.g. eval) is launched as a background job and
  // polled, so individual requests should always return quickly.
  timeout: 30000,
})

// On 401, clear stale user data and redirect to the sign-in page.
client.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('user')
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

export default client
