import { ENDPOINTS } from '../constants/api';
import { User, UserRole } from '../types';
import { apiRequest } from './api';

export async function getUsers(role?: UserRole): Promise<User[]> {
  const query = role ? `?role=${encodeURIComponent(role)}` : '';
  return apiRequest<User[]>(`${ENDPOINTS.users}${query}`);
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

export async function changeMyPassword(password: string): Promise<User> {
  return apiRequest<User>('/api/users/me', {
    method: 'PUT',
    body: { password },
  });
}
