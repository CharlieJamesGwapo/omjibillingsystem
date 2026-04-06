import { useState, useCallback, useRef, useEffect } from 'react';
import { SessionExpiredError } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Generic hook for making API calls with loading/error state management.
 * Automatically detects SESSION_EXPIRED errors and triggers logout.
 *
 * Usage:
 *   const { data, loading, error, refetch } = useApi(() => getMyPayments());
 */
export function useApi<T>(apiFn: () => Promise<T>): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { logout } = useAuth();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiFn();
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (!mountedRef.current) return;

      if (err instanceof SessionExpiredError) {
        await logout();
        return;
      }

      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiFn, logout]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
