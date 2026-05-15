import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { jwtDecode } from 'jwt-decode'
import type { JWTPayload } from '@/types'
import { api, setAuthTokens, clearAuthTokens } from '@/lib/api'

interface AuthState {
  user: JWTPayload | null
  isLoading: boolean
  login: (email: string, password: string, orgSlug: string) => Promise<{ requiresTwoFactor?: boolean; userId?: string }>
  verifyTwoFactor: (userId: string, code: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: JWTPayload | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,

      login: async (email, password, orgSlug) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post('/auth/login', { email, password, orgSlug })
          if (data.data.requiresTwoFactor) {
            set({ isLoading: false })
            return { requiresTwoFactor: true, userId: data.data.userId }
          }
          const { tokens } = data.data
          setAuthTokens(tokens.accessToken, tokens.refreshToken)
          const user = jwtDecode<JWTPayload>(tokens.accessToken)
          set({ user, isLoading: false })
          return {}
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      verifyTwoFactor: async (userId, code) => {
        const { data } = await api.post('/auth/2fa/verify', { userId, code })
        const { tokens } = data.data
        setAuthTokens(tokens.accessToken, tokens.refreshToken)
        const user = jwtDecode<JWTPayload>(tokens.accessToken)
        set({ user })
      },

      logout: async () => {
        const refreshToken = localStorage.getItem('sva_refresh_token')
        try { await api.post('/auth/logout', { refreshToken }) } catch {}
        clearAuthTokens()
        set({ user: null })
        window.location.href = '/login'
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'sva_auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
)
