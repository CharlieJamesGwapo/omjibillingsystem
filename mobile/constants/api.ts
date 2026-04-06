export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8080';

export const ENDPOINTS = {
  auth: {
    login: '/api/auth/login',
    refresh: '/api/auth/refresh',
  },
  users: '/api/users',
  plans: '/api/plans',
  subscriptions: {
    list: '/api/subscriptions',
    mine: '/api/subscriptions/mine',
    byId: (id: string) => `/api/subscriptions/${id}`,
    disconnect: (id: string) => `/api/subscriptions/${id}/disconnect`,
    reconnect: (id: string) => `/api/subscriptions/${id}/reconnect`,
  },
  payments: {
    list: '/api/payments',
    mine: '/api/payments/mine',
    create: '/api/payments',
    approve: (id: string) => `/api/payments/${id}/approve`,
    reject: (id: string) => `/api/payments/${id}/reject`,
  },
  dashboard: {
    stats: '/api/dashboard/stats',
    income: '/api/dashboard/income',
  },
  mikrotik: {
    status: '/api/mikrotik/status',
    connections: '/api/mikrotik/connections',
  },
} as const;
