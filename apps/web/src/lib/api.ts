import axios, { type AxiosError } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Attach access token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sva_access_token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh expired access tokens
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as any
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem('sva_refresh_token')
      if (!refreshToken) {
        window.location.href = '/login'
        return Promise.reject(error)
      }
      try {
        const { data } = await axios.post(`${API_URL}/api/v1/auth/refresh`, { refreshToken })
        const { accessToken, refreshToken: newRefresh } = data.data
        localStorage.setItem('sva_access_token', accessToken)
        localStorage.setItem('sva_refresh_token', newRefresh)
        original.headers.Authorization = `Bearer ${accessToken}`
        return api(original)
      } catch {
        localStorage.removeItem('sva_access_token')
        localStorage.removeItem('sva_refresh_token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const setAuthTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem('sva_access_token', accessToken)
  localStorage.setItem('sva_refresh_token', refreshToken)
}

export const clearAuthTokens = () => {
  localStorage.removeItem('sva_access_token')
  localStorage.removeItem('sva_refresh_token')
}
