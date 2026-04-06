import { ENDPOINTS } from '../constants/api';
import { LoginResponse } from '../types';
import { apiRequest } from './api';

export async function login(phone: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>(ENDPOINTS.auth.login, {
    method: 'POST',
    body: { phone, password },
  });
}
