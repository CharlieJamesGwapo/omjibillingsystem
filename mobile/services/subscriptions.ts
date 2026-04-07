import { ENDPOINTS } from '../constants/api';
import { Subscription } from '../types';
import { apiRequest } from './api';

export async function getMySubscriptions(): Promise<Subscription[]> {
  return apiRequest<Subscription[]>(ENDPOINTS.subscriptions.mine);
}

export async function getAllSubscriptions(): Promise<Subscription[]> {
  const res = await apiRequest<{ data: Subscription[] | null }>(`${ENDPOINTS.subscriptions.list}?limit=100`);
  return res.data ?? [];
}

export async function getSubscription(id: string): Promise<Subscription> {
  return apiRequest<Subscription>(ENDPOINTS.subscriptions.byId(id));
}

export async function disconnectSubscription(id: string): Promise<void> {
  return apiRequest<void>(ENDPOINTS.subscriptions.disconnect(id), {
    method: 'POST',
  });
}

export async function reconnectSubscription(id: string): Promise<void> {
  return apiRequest<void>(ENDPOINTS.subscriptions.reconnect(id), {
    method: 'POST',
  });
}
