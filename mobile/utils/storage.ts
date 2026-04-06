import * as SecureStore from 'expo-secure-store';
import { User } from '../types';

const KEYS = {
  accessToken: 'omji_access_token',
  refreshToken: 'omji_refresh_token',
  user: 'omji_user',
} as const;

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.accessToken, accessToken);
  await SecureStore.setItemAsync(KEYS.refreshToken, refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.accessToken);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.refreshToken);
}

export async function saveUser(user: User): Promise<void> {
  await SecureStore.setItemAsync(KEYS.user, JSON.stringify(user));
}

export async function getUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync(KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export async function clearAll(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.accessToken);
  await SecureStore.deleteItemAsync(KEYS.refreshToken);
  await SecureStore.deleteItemAsync(KEYS.user);
}
