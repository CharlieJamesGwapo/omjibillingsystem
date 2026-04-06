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
