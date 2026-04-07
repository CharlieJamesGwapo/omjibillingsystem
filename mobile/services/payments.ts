import { ENDPOINTS } from '../constants/api';
import { Payment } from '../types';
import { apiRequest, apiUpload } from './api';

export async function getMyPayments(): Promise<Payment[]> {
  return apiRequest<Payment[]>(ENDPOINTS.payments.mine);
}

export async function getAllPayments(status?: string): Promise<Payment[]> {
  const query = status ? `?status=${encodeURIComponent(status)}&limit=100` : '?limit=100';
  const res = await apiRequest<{ data: Payment[] | null }>(`${ENDPOINTS.payments.list}${query}`);
  return res.data ?? [];
}

export async function createPayment(formData: FormData): Promise<Payment> {
  return apiUpload<Payment>(ENDPOINTS.payments.create, formData);
}

export async function approvePayment(id: string, notes?: string): Promise<Payment> {
  return apiRequest<Payment>(ENDPOINTS.payments.approve(id), {
    method: 'POST',
    body: notes ? { notes } : undefined,
  });
}

export async function rejectPayment(id: string, notes?: string): Promise<Payment> {
  return apiRequest<Payment>(ENDPOINTS.payments.reject(id), {
    method: 'POST',
    body: notes ? { notes } : undefined,
  });
}
