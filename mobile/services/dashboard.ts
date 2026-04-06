import { ENDPOINTS } from '../constants/api';
import { DashboardStats } from '../types';
import { apiRequest } from './api';

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>(ENDPOINTS.dashboard.stats);
}
