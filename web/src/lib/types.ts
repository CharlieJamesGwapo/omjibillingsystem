// Type aliases matching Go model constants
export type UserRole = 'admin' | 'technician' | 'customer'
export type UserStatus = 'active' | 'inactive'
export type SubStatus = 'active' | 'overdue' | 'suspended' | 'pending' | 'expired'
export type PaymentMethod = 'gcash' | 'maya' | 'bank' | 'cash'
export type PaymentStatus = 'pending' | 'approved' | 'rejected'

// Interfaces matching Go models
export interface User {
  id: string
  phone: string
  full_name: string
  email?: string | null
  address?: string | null
  role: UserRole
  status: UserStatus
  created_at: string
  updated_at: string
}

export interface Plan {
  id: string
  name: string
  speed_mbps: number
  price: number
  description?: string | null
  is_active: boolean
  created_at: string
  mikrotik_profile?: string
}

export interface Subscription {
  id: string
  user_id: string
  plan_id: string
  ip_address?: string | null
  mac_address?: string | null
  billing_day: number
  next_due_date: string
  grace_days: number
  status: SubStatus
  mikrotik_queue_id?: string | null
  pppoe_username?: string
  pppoe_password?: string
  created_at: string
  updated_at: string
  // Joined fields
  user_name?: string
  user_phone?: string
  plan_name?: string
  plan_speed?: number
  plan_price?: number
}

export interface Payment {
  id: string
  user_id: string
  subscription_id: string
  amount: number
  method: PaymentMethod
  reference_number?: string | null
  proof_image_url?: string | null
  status: PaymentStatus
  approved_by?: string | null
  billing_period_start: string
  billing_period_end: string
  notes?: string | null
  created_at: string
  updated_at: string
  // Joined fields
  user_name?: string
  user_phone?: string
  approver_name?: string | null
}

export interface DashboardStats {
  total_customers: number
  active: number
  overdue: number
  suspended: number
  monthly_income: number
  expected_income: number
  pending_payments: number
}

export interface PPPoESecret {
  name: string;
  password: string;
  profile: string;
  disabled: boolean;
  comment: string;
}

export interface MikroTikStatus {
  connected: boolean;
  agent_connected: boolean;
  direct_connected: boolean;
  queue_count?: number;
}

export interface ActivityLog {
  id: string
  user_id: string
  action: string
  target_type: string
  target_id: string
  details: Record<string, unknown>
  ip_address: string
  created_at: string
  user_name?: string   // resolved by frontend
}

export interface Notification {
  id: string
  type: 'payment_pending' | 'payment_approved' | 'payment_rejected' | 'subscription_overdue' | 'info'
  title: string
  message: string
  read: boolean
  created_at: string
  link?: string
}

export interface MonthlyIncome {
  month: string   // "2026-01"
  amount: number
}

export interface ChartDataPoint {
  month: string
  amount: number
  label?: string
}

export interface TokenPair {
  access_token: string
  refresh_token: string
}

// JWT payload shape
export interface JWTPayload {
  user_id: string
  role: UserRole
  exp: number
  iat: number
}
