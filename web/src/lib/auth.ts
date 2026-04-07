import { jwtDecode } from 'jwt-decode'
import type { JWTPayload, UserRole } from './types'

const ACCESS_TOKEN_KEY = 'omji_access_token'
const REFRESH_TOKEN_KEY = 'omji_refresh_token'

export function saveTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getCurrentUser(): { user_id: string; role: UserRole } | null {
  const token = getAccessToken()
  if (!token) return null

  try {
    const payload = jwtDecode<JWTPayload>(token)
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      return null
    }
    return {
      user_id: payload.user_id,
      role: payload.role,
    }
  } catch {
    return null
  }
}

export function getUserRole(): UserRole | null {
  const user = getCurrentUser()
  return user ? user.role : null
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null
}
