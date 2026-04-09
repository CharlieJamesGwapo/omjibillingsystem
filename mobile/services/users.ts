import { ENDPOINTS } from '../constants/api';
import { User, UserRole } from '../types';
import { apiRequest } from './api';

export async function getUsers(role?: UserRole): Promise<User[]> {
  const query = role ? `?role=${encodeURIComponent(role)}&limit=100` : '?limit=100';
  const res = await apiRequest<{ data: User[] | null }>(`${ENDPOINTS.users}${query}`);
  return res.data ?? [];
}

export async function getUser(id: string): Promise<User> {
  return apiRequest<User>(`${ENDPOINTS.users}/${id}`);
}

export async function updateMyProfile(data: {
  full_name?: string;
  email?: string;
  address?: string;
}): Promise<User> {
  return apiRequest<User>('/api/users/me', {
    method: 'PUT',
    body: data,
  });
}

export async function updateMyLocation(latitude: number, longitude: number): Promise<User> {
  return apiRequest<User>('/api/users/me', {
    method: 'PUT',
    body: { latitude, longitude },
  });
}

export async function changeMyPassword(password: string): Promise<User> {
  return apiRequest<User>('/api/users/me', {
    method: 'PUT',
    body: { password },
  });
}
