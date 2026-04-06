import { API_BASE_URL, ENDPOINTS } from '../constants/api';
import { getAccessToken, getRefreshToken, saveTokens, clearAll } from '../utils/storage';
import { TokenPair } from '../types';

export class SessionExpiredError extends Error {
  constructor() {
    super('SESSION_EXPIRED');
    this.name = 'SessionExpiredError';
  }
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new SessionExpiredError();
  }

  const response = await fetch(`${API_BASE_URL}${ENDPOINTS.auth.refresh}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    await clearAll();
    throw new SessionExpiredError();
  }

  const data = (await response.json()) as TokenPair;
  await saveTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

async function getValidToken(): Promise<string> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  const token = await getAccessToken();
  return token || '';
}

async function handleTokenRefresh(): Promise<string> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = refreshAccessToken().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });

  return refreshPromise;
}

/**
 * Core API request function with automatic token management and retry on 401.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const token = await getValidToken();

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  // On 401, attempt token refresh and retry once
  if (response.status === 401) {
    try {
      const newToken = await handleTokenRefresh();
      requestHeaders['Authorization'] = `Bearer ${newToken}`;

      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      if (err instanceof SessionExpiredError) throw err;
      throw new SessionExpiredError();
    }
  }

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text().catch(() => null);
    }

    const message =
      errorBody && typeof errorBody === 'object' && 'error' in errorBody
        ? String((errorBody as { error: string }).error)
        : `Request failed with status ${response.status}`;

    throw new ApiError(response.status, message, errorBody);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

/**
 * Upload multipart form data (e.g. payment proof images).
 * Does NOT set Content-Type header so fetch can auto-set the multipart boundary.
 */
export async function apiUpload<T>(
  endpoint: string,
  formData: FormData,
): Promise<T> {
  const token = await getValidToken();

  const requestHeaders: Record<string, string> = {};
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: requestHeaders,
    body: formData,
  });

  // On 401, attempt token refresh and retry once
  if (response.status === 401) {
    try {
      const newToken = await handleTokenRefresh();
      requestHeaders['Authorization'] = `Bearer ${newToken}`;

      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: requestHeaders,
        body: formData,
      });
    } catch (err) {
      if (err instanceof SessionExpiredError) throw err;
      throw new SessionExpiredError();
    }
  }

  if (!response.ok) {
    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text().catch(() => null);
    }

    const message =
      errorBody && typeof errorBody === 'object' && 'error' in errorBody
        ? String((errorBody as { error: string }).error)
        : `Upload failed with status ${response.status}`;

    throw new ApiError(response.status, message, errorBody);
  }

  return response.json() as Promise<T>;
}
