# OMJI Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional React Native (Expo Router) mobile app for the OMJI Billing System, serving customers and technicians with role-based screens.

**Architecture:** Single Expo Router app with route groups — `(auth)` for login, `(customer)` for customer tabs, `(technician)` for technician tabs. Auth context determines which route group is active. API services wrap the Go backend endpoints with token management.

**Tech Stack:** React Native, Expo SDK 54, Expo Router, TypeScript, Expo SecureStore, Expo Image Picker

---

### Task 1: Backend — Allow Customer Password Login

**Files:**
- Modify: `backend/internal/service/auth_service.go:122-130`
- Modify: `backend/internal/service/user_service.go:27-37`
- Modify: `backend/internal/service/user_service.go:64-88`

- [ ] **Step 1: Remove customer OTP-only restriction in auth_service.go**

In `backend/internal/service/auth_service.go`, remove lines 128-130 in the `Login` method:

```go
// Login authenticates users via password.
func (s *AuthService) Login(ctx context.Context, phone, password string) (*TokenPair, *model.User, error) {
	user, err := s.userRepo.GetByPhone(ctx, phone)
	if err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	if user.PasswordHash == nil {
		return nil, nil, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)); err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	tokens, err := s.generateTokenPair(user.ID, user.Role)
	if err != nil {
		return nil, nil, fmt.Errorf("generate tokens: %w", err)
	}
	return tokens, user, nil
}
```

- [ ] **Step 2: Allow password hashing for all roles in user_service.go Create**

In `backend/internal/service/user_service.go`, update the `Create` method to hash passwords for all roles:

```go
func (s *UserService) Create(ctx context.Context, req *model.CreateUserRequest) (*model.User, error) {
	var passwordHash *string

	if req.Password != nil && *req.Password != "" {
		hash, err := s.authService.HashPassword(*req.Password)
		if err != nil {
			return nil, fmt.Errorf("hash password: %w", err)
		}
		passwordHash = &hash
	}

	user, err := s.userRepo.Create(ctx, req, passwordHash)
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return user, nil
}
```

- [ ] **Step 3: Allow password hashing for all roles in user_service.go Update**

In `backend/internal/service/user_service.go`, update the `Update` method to hash passwords for all roles:

```go
func (s *UserService) Update(ctx context.Context, id uuid.UUID, req *model.UpdateUserRequest) (*model.User, error) {
	var passwordHash *string

	if req.Password != nil && *req.Password != "" {
		hash, err := s.authService.HashPassword(*req.Password)
		if err != nil {
			return nil, fmt.Errorf("hash password: %w", err)
		}
		passwordHash = &hash
	}

	user, err := s.userRepo.Update(ctx, id, req, passwordHash)
	if err != nil {
		return nil, fmt.Errorf("update user: %w", err)
	}
	return user, nil
}
```

- [ ] **Step 4: Build and verify**

Run: `cd /Users/dev3/billingsystem/backend && go build ./...`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/service/auth_service.go backend/internal/service/user_service.go
git commit -m "feat: allow customer password login and password hashing for all roles"
```

---

### Task 2: Install Expo Dependencies & Configure Project

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/app.json`
- Modify: `mobile/tsconfig.json`

- [ ] **Step 1: Install all required Expo packages**

```bash
cd /Users/dev3/billingsystem/mobile && npx expo install expo-router expo-linking expo-constants expo-secure-store expo-image-picker expo-font @expo/vector-icons react-native-safe-area-context react-native-screens react-native-gesture-handler react-native-reanimated @react-native-async-storage/async-storage
```

- [ ] **Step 2: Update app.json for Expo Router**

Replace `mobile/app.json` with:

```json
{
  "expo": {
    "name": "OMJI Billing",
    "slug": "omji-billing",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "scheme": "omji-billing",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#CC0000"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.omji.billing"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#CC0000"
      },
      "package": "com.omji.billing"
    },
    "web": {
      "favicon": "./assets/favicon.png",
      "bundler": "metro"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-image-picker"
    ]
  }
}
```

- [ ] **Step 3: Update tsconfig.json**

Replace `mobile/tsconfig.json` with:

```json
{
  "extends": "expo-router/tsconfig",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

- [ ] **Step 4: Update package.json main entry**

In `mobile/package.json`, change `"main"` to `"expo-router/entry"`.

- [ ] **Step 5: Delete old entry files**

Delete `mobile/App.tsx` and `mobile/index.ts` — Expo Router uses `app/` directory instead.

- [ ] **Step 6: Commit**

```bash
git add mobile/
git commit -m "feat: configure Expo Router, install dependencies for OMJI mobile app"
```

---

### Task 3: Constants, Types & Utilities

**Files:**
- Create: `mobile/constants/colors.ts`
- Create: `mobile/constants/api.ts`
- Create: `mobile/types/index.ts`
- Create: `mobile/utils/storage.ts`
- Create: `mobile/utils/format.ts`

- [ ] **Step 1: Create color constants**

Create `mobile/constants/colors.ts`:

```typescript
export const Colors = {
  primary: '#CC0000',
  primaryDark: '#990000',
  black: '#1A1A1A',
  grey600: '#666666',
  grey400: '#999999',
  grey200: '#CCCCCC',
  background: '#F8F8F8',
  surface: '#FFFFFF',
  border: '#EEEEEE',
  success: '#4CAF50',
  successLight: '#E8F5E9',
  warning: '#FF9800',
  warningLight: '#FFF3E0',
  error: '#F44336',
  errorLight: '#FFEBEE',
  info: '#2196F3',
  infoLight: '#E3F2FD',
} as const;
```

- [ ] **Step 2: Create API constants**

Create `mobile/constants/api.ts`:

```typescript
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
  },
  mikrotik: {
    connections: '/api/mikrotik/connections',
  },
} as const;
```

- [ ] **Step 3: Create TypeScript types matching backend models**

Create `mobile/types/index.ts`:

```typescript
export type UserRole = 'admin' | 'technician' | 'customer';
export type UserStatus = 'active' | 'inactive';
export type SubscriptionStatus = 'active' | 'overdue' | 'suspended';
export type PaymentMethod = 'gcash' | 'maya' | 'bank' | 'cash';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  phone: string;
  full_name: string;
  email?: string;
  address?: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  name: string;
  speed_mbps: number;
  price: number;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  ip_address?: string;
  mac_address?: string;
  billing_day: number;
  next_due_date: string;
  grace_days: number;
  status: SubscriptionStatus;
  mikrotik_queue_id?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  user_name?: string;
  user_phone?: string;
  plan_name?: string;
  plan_speed?: number;
  plan_price?: number;
}

export interface Payment {
  id: string;
  user_id: string;
  subscription_id: string;
  amount: number;
  method: PaymentMethod;
  reference_number?: string;
  proof_image_url?: string;
  status: PaymentStatus;
  approved_by?: string;
  billing_period_start: string;
  billing_period_end: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  user_name?: string;
  user_phone?: string;
  approver_name?: string;
}

export interface DashboardStats {
  total_customers: number;
  active: number;
  overdue: number;
  suspended: number;
  monthly_income: number;
  expected_income: number;
  pending_payments: number;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export interface LoginResponse {
  tokens: TokenPair;
  user: User;
}
```

- [ ] **Step 4: Create SecureStore storage helpers**

Create `mobile/utils/storage.ts`:

```typescript
import * as SecureStore from 'expo-secure-store';

const KEYS = {
  accessToken: 'omji_access_token',
  refreshToken: 'omji_refresh_token',
  user: 'omji_user',
} as const;

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.accessToken, accessToken);
  await SecureStore.setItemAsync(KEYS.refreshToken, refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.accessToken);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.refreshToken);
}

export async function saveUser(user: object): Promise<void> {
  await SecureStore.setItemAsync(KEYS.user, JSON.stringify(user));
}

export async function getUser(): Promise<object | null> {
  const raw = await SecureStore.getItemAsync(KEYS.user);
  return raw ? JSON.parse(raw) : null;
}

export async function clearAll(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.accessToken);
  await SecureStore.deleteItemAsync(KEYS.refreshToken);
  await SecureStore.deleteItemAsync(KEYS.user);
}
```

- [ ] **Step 5: Create formatting utilities**

Create `mobile/utils/format.ts`:

```typescript
export function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export function formatBillingPeriod(start: string, end: string): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

- [ ] **Step 6: Commit**

```bash
git add mobile/constants/ mobile/types/ mobile/utils/
git commit -m "feat: add constants, types, and utilities for OMJI mobile app"
```

---

### Task 4: API Service Layer & Auth Context

**Files:**
- Create: `mobile/services/api.ts`
- Create: `mobile/services/auth.ts`
- Create: `mobile/services/payments.ts`
- Create: `mobile/services/subscriptions.ts`
- Create: `mobile/services/users.ts`
- Create: `mobile/context/AuthContext.tsx`

- [ ] **Step 1: Create API client with auth interceptor**

Create `mobile/services/api.ts`:

```typescript
import { API_BASE_URL } from '@/constants/api';
import { getAccessToken, getRefreshToken, saveTokens, clearAll } from '@/utils/storage';
import { ENDPOINTS } from '@/constants/api';

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}${ENDPOINTS.auth.refresh}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    await saveTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuth, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = await getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  let res = await fetch(`${API_BASE_URL}${endpoint}`, { ...fetchOptions, headers });

  // Retry once with refreshed token on 401
  if (res.status === 401 && !skipAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE_URL}${endpoint}`, { ...fetchOptions, headers });
    } else {
      await clearAll();
      throw new Error('SESSION_EXPIRED');
    }
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || error.error || `HTTP ${res.status}`);
  }

  return res.json();
}
```

- [ ] **Step 2: Create auth service**

Create `mobile/services/auth.ts`:

```typescript
import { apiRequest } from './api';
import { ENDPOINTS } from '@/constants/api';
import { LoginResponse } from '@/types';

export async function login(phone: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>(ENDPOINTS.auth.login, {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
    skipAuth: true,
  });
}
```

- [ ] **Step 3: Create payments service**

Create `mobile/services/payments.ts`:

```typescript
import { apiRequest } from './api';
import { ENDPOINTS } from '@/constants/api';
import { Payment } from '@/types';

export async function getMyPayments(): Promise<Payment[]> {
  return apiRequest<Payment[]>(ENDPOINTS.payments.mine);
}

export async function getAllPayments(status?: string): Promise<Payment[]> {
  const query = status ? `?status=${status}` : '';
  return apiRequest<Payment[]>(`${ENDPOINTS.payments.list}${query}`);
}

export async function createPayment(data: {
  subscription_id: string;
  amount: number;
  method: string;
  reference_number?: string;
  proof_image_url?: string;
}): Promise<Payment> {
  return apiRequest<Payment>(ENDPOINTS.payments.create, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function approvePayment(id: string, notes?: string): Promise<Payment> {
  return apiRequest<Payment>(ENDPOINTS.payments.approve(id), {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function rejectPayment(id: string, notes?: string): Promise<Payment> {
  return apiRequest<Payment>(ENDPOINTS.payments.reject(id), {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}
```

- [ ] **Step 4: Create subscriptions service**

Create `mobile/services/subscriptions.ts`:

```typescript
import { apiRequest } from './api';
import { ENDPOINTS } from '@/constants/api';
import { Subscription } from '@/types';

export async function getMySubscriptions(): Promise<Subscription[]> {
  return apiRequest<Subscription[]>(ENDPOINTS.subscriptions.mine);
}

export async function getAllSubscriptions(): Promise<Subscription[]> {
  return apiRequest<Subscription[]>(ENDPOINTS.subscriptions.list);
}

export async function getSubscription(id: string): Promise<Subscription> {
  return apiRequest<Subscription>(ENDPOINTS.subscriptions.byId(id));
}
```

- [ ] **Step 5: Create users service**

Create `mobile/services/users.ts`:

```typescript
import { apiRequest } from './api';
import { ENDPOINTS } from '@/constants/api';
import { User, DashboardStats } from '@/types';

export async function getUsers(role?: string): Promise<User[]> {
  const query = role ? `?role=${role}` : '';
  return apiRequest<User[]>(`${ENDPOINTS.users}${query}`);
}

export async function getUser(id: string): Promise<User> {
  return apiRequest<User>(`${ENDPOINTS.users}/${id}`);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>(ENDPOINTS.dashboard.stats);
}
```

- [ ] **Step 6: Create AuthContext**

Create `mobile/context/AuthContext.tsx`:

```typescript
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@/types';
import { login as loginApi } from '@/services/auth';
import { saveTokens, saveUser, getUser, getAccessToken, clearAll } from '@/utils/storage';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const token = await getAccessToken();
      const userData = await getUser();
      if (token && userData) {
        setState({ user: userData as User, isLoading: false, isAuthenticated: true });
      } else {
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    } catch {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }

  const login = useCallback(async (phone: string, password: string) => {
    const response = await loginApi(phone, password);
    await saveTokens(response.tokens.access_token, response.tokens.refresh_token);
    await saveUser(response.user);
    setState({ user: response.user, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    await clearAll();
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

- [ ] **Step 7: Commit**

```bash
git add mobile/services/ mobile/context/
git commit -m "feat: add API services and auth context for OMJI mobile app"
```

---

### Task 5: UI Components

**Files:**
- Create: `mobile/components/ui/Button.tsx`
- Create: `mobile/components/ui/Card.tsx`
- Create: `mobile/components/ui/StatCard.tsx`
- Create: `mobile/components/ui/Badge.tsx`
- Create: `mobile/components/ui/Input.tsx`
- Create: `mobile/components/ui/Avatar.tsx`
- Create: `mobile/components/PaymentCard.tsx`
- Create: `mobile/components/ClientCard.tsx`
- Create: `mobile/components/PlanCard.tsx`
- Create: `mobile/components/QuickActions.tsx`

- [ ] **Step 1: Create Button component**

Create `mobile/components/ui/Button.tsx`:

```typescript
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'destructive';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const buttonStyle = [
    styles.base,
    variant === 'primary' && styles.primary,
    variant === 'outline' && styles.outline,
    variant === 'destructive' && styles.destructive,
    (disabled || loading) && styles.disabled,
    style,
  ];

  const textStyle = [
    styles.text,
    variant === 'outline' && styles.outlineText,
    variant === 'destructive' && styles.destructiveText,
  ];

  return (
    <TouchableOpacity style={buttonStyle} onPress={onPress} disabled={disabled || loading} activeOpacity={0.7}>
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? Colors.primary : '#fff'} />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: { padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: Colors.primary },
  outline: { backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.error },
  destructive: { backgroundColor: Colors.error },
  disabled: { opacity: 0.6 },
  text: { color: '#fff', fontSize: 15, fontWeight: '700' },
  outlineText: { color: Colors.error },
  destructiveText: { color: '#fff' },
});
```

- [ ] **Step 2: Create Card component**

Create `mobile/components/ui/Card.tsx`:

```typescript
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '@/constants/colors';

interface CardProps {
  children: React.ReactNode;
  borderColor?: string;
  style?: ViewStyle;
}

export function Card({ children, borderColor, style }: CardProps) {
  return (
    <View style={[styles.card, borderColor && { borderLeftWidth: 3, borderLeftColor: borderColor }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
});
```

- [ ] **Step 3: Create StatCard component**

Create `mobile/components/ui/StatCard.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: number | string;
  subtitle: string;
  borderColor: string;
  subtitleColor?: string;
}

export function StatCard({ label, value, subtitle, borderColor, subtitleColor }: StatCardProps) {
  return (
    <Card borderColor={borderColor}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={[styles.subtitle, subtitleColor && { color: subtitleColor }]}>{subtitle}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', marginVertical: 2 },
  subtitle: { fontSize: 10, color: '#999', fontWeight: '600' },
});
```

- [ ] **Step 4: Create Badge component**

Create `mobile/components/ui/Badge.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';
import { PaymentStatus, SubscriptionStatus } from '@/types';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  approved: { bg: Colors.successLight, text: Colors.success },
  active: { bg: Colors.successLight, text: Colors.success },
  pending: { bg: Colors.warningLight, text: Colors.warning },
  overdue: { bg: Colors.warningLight, text: Colors.warning },
  rejected: { bg: Colors.errorLight, text: Colors.error },
  suspended: { bg: Colors.errorLight, text: Colors.error },
};

interface BadgeProps {
  status: PaymentStatus | SubscriptionStatus;
}

export function Badge({ status }: BadgeProps) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>{status.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  text: { fontSize: 10, fontWeight: '700' },
});
```

- [ ] **Step 5: Create Input component**

Create `mobile/components/ui/Input.tsx`:

```typescript
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, TextInputProps } from 'react-native';
import { Colors } from '@/constants/colors';

interface InputProps extends TextInputProps {
  icon?: string;
  isPassword?: boolean;
}

export function Input({ icon, isPassword, style, ...props }: InputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.container}>
      {icon && <Text style={styles.icon}>{icon}</Text>}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={Colors.grey400}
        secureTextEntry={isPassword && !showPassword}
        {...props}
      />
      {isPassword && (
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          <Text style={styles.toggle}>{showPassword ? '🙈' : '👁️'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  icon: { fontSize: 16, marginRight: 10 },
  input: { flex: 1, fontSize: 14, color: Colors.black },
  toggle: { fontSize: 16, marginLeft: 8 },
});
```

- [ ] **Step 6: Create Avatar component**

Create `mobile/components/ui/Avatar.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getInitials } from '@/utils/format';
import { Colors } from '@/constants/colors';

interface AvatarProps {
  name: string;
  size?: number;
  backgroundColor?: string;
  textColor?: string;
}

export function Avatar({ name, size = 40, backgroundColor = Colors.primary, textColor = '#fff' }: AvatarProps) {
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor }]}>
      <Text style={[styles.text, { fontSize: size * 0.35, color: textColor }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  text: { fontWeight: '800' },
});
```

- [ ] **Step 7: Create PaymentCard component**

Create `mobile/components/PaymentCard.tsx`:

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Colors } from '@/constants/colors';
import { Payment } from '@/types';
import { formatCurrency, formatDate, formatBillingPeriod } from '@/utils/format';

const BORDER_COLORS: Record<string, string> = {
  approved: Colors.success,
  pending: Colors.warning,
  rejected: Colors.error,
};

interface PaymentCardProps {
  payment: Payment;
  showCustomer?: boolean;
  onPress?: () => void;
}

export function PaymentCard({ payment, showCustomer, onPress }: PaymentCardProps) {
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <Card borderColor={BORDER_COLORS[payment.status]} style={styles.card}>
        <View style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.amount}>{formatCurrency(payment.amount)}</Text>
            <Text style={styles.period}>
              {showCustomer ? payment.user_name : formatBillingPeriod(payment.billing_period_start, payment.billing_period_end)}
            </Text>
            <Text style={styles.meta}>
              {payment.method.charAt(0).toUpperCase() + payment.method.slice(1)}
              {payment.reference_number ? ` • Ref: ${payment.reference_number}` : ''}
            </Text>
          </View>
          <Badge status={payment.status} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  info: { flex: 1 },
  amount: { fontSize: 14, fontWeight: '700', color: Colors.black },
  period: { fontSize: 11, color: Colors.grey600, marginTop: 2 },
  meta: { fontSize: 10, color: Colors.grey400, marginTop: 2 },
});
```

- [ ] **Step 8: Create ClientCard component**

Create `mobile/components/ClientCard.tsx`:

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from './ui/Card';
import { Avatar } from './ui/Avatar';
import { Colors } from '@/constants/colors';
import { Subscription } from '@/types';

const STATUS_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  active: { border: Colors.success, bg: Colors.successLight, text: Colors.success },
  overdue: { border: Colors.warning, bg: Colors.warningLight, text: Colors.warning },
  suspended: { border: Colors.error, bg: Colors.errorLight, text: Colors.error },
};

interface ClientCardProps {
  subscription: Subscription;
  onPress: () => void;
}

export function ClientCard({ subscription, onPress }: ClientCardProps) {
  const colors = STATUS_COLORS[subscription.status] || STATUS_COLORS.active;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card borderColor={colors.border} style={styles.card}>
        <View style={styles.row}>
          <View style={styles.left}>
            <Avatar name={subscription.user_name || '?'} size={36} backgroundColor={colors.bg} textColor={colors.text} />
            <View style={styles.info}>
              <Text style={styles.name}>{subscription.user_name}</Text>
              <Text style={[styles.detail, subscription.status !== 'active' && { color: colors.text, fontWeight: '600' }]}>
                {subscription.status === 'active'
                  ? `${subscription.plan_name} • Due ${new Date(subscription.next_due_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`
                  : subscription.status === 'overdue'
                  ? `Overdue • Was ${new Date(subscription.next_due_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`
                  : 'Suspended'}
              </Text>
            </View>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  info: { flex: 1 },
  name: { fontSize: 13, fontWeight: '700', color: Colors.black },
  detail: { fontSize: 10, color: Colors.grey400, marginTop: 2 },
  chevron: { fontSize: 18, color: Colors.grey200 },
});
```

- [ ] **Step 9: Create PlanCard component**

Create `mobile/components/PlanCard.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Subscription } from '@/types';
import { formatCurrency, formatShortDate } from '@/utils/format';
import { Badge } from './ui/Badge';

interface PlanCardProps {
  subscription: Subscription;
}

export function PlanCard({ subscription }: PlanCardProps) {
  return (
    <LinearGradient colors={['#CC0000', '#880000']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <Text style={styles.label}>CURRENT PLAN</Text>
      <Text style={styles.planName}>{subscription.plan_name || 'No Plan'}</Text>
      {subscription.plan_speed ? <Text style={styles.speed}>{subscription.plan_speed} Mbps</Text> : null}
      <View style={styles.details}>
        <View>
          <Text style={styles.detailLabel}>Monthly</Text>
          <Text style={styles.detailValue}>{formatCurrency(subscription.plan_price || 0)}</Text>
        </View>
        <View>
          <Text style={styles.detailLabel}>Due Date</Text>
          <Text style={styles.detailValue}>{formatShortDate(subscription.next_due_date)}</Text>
        </View>
        <View>
          <Text style={styles.detailLabel}>Status</Text>
          <Badge status={subscription.status} />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 20, marginHorizontal: 16, marginVertical: 12 },
  label: { fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textTransform: 'uppercase' },
  planName: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 4 },
  speed: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  details: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  detailLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  detailValue: { fontSize: 16, fontWeight: '700', color: '#fff', marginTop: 2 },
});
```

- [ ] **Step 10: Create QuickActions component**

Create `mobile/components/QuickActions.tsx`:

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

interface Action {
  icon: string;
  label: string;
  onPress: () => void;
}

interface QuickActionsProps {
  actions: Action[];
  columns?: number;
}

export function QuickActions({ actions, columns = 3 }: QuickActionsProps) {
  return (
    <View style={[styles.grid, { gap: 8 }]}>
      {actions.map((action, i) => (
        <TouchableOpacity
          key={i}
          style={[styles.item, { width: `${100 / columns - 3}%` as any }]}
          onPress={action.onPress}
          activeOpacity={0.7}
        >
          <Text style={styles.icon}>{action.icon}</Text>
          <Text style={styles.label}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16 },
  item: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  icon: { fontSize: 22 },
  label: { fontSize: 10, color: Colors.grey600, marginTop: 4, fontWeight: '600' },
});
```

- [ ] **Step 11: Commit**

```bash
git add mobile/components/
git commit -m "feat: add all UI components for OMJI mobile app"
```

---

### Task 6: Root Layout & Auth Routing

**Files:**
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/index.tsx`
- Create: `mobile/app/(auth)/_layout.tsx`
- Create: `mobile/app/(auth)/login.tsx`

- [ ] **Step 1: Create root layout with AuthProvider**

Create `mobile/app/_layout.tsx`:

```typescript
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '@/context/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(technician)" />
      </Stack>
    </AuthProvider>
  );
}
```

- [ ] **Step 2: Create index redirect**

Create `mobile/app/index.tsx`:

```typescript
import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';

export default function Index() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (user?.role === 'customer') {
      router.replace('/(customer)/home');
    } else if (user?.role === 'technician' || user?.role === 'admin') {
      router.replace('/(technician)/home');
    }
  }, [isLoading, isAuthenticated, user]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
});
```

- [ ] **Step 3: Create auth stack layout**

Create `mobile/app/(auth)/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
    </Stack>
  );
}
```

- [ ] **Step 4: Create login screen**

Create `mobile/app/(auth)/login.tsx`:

```typescript
import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';

export default function LoginScreen() {
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your phone number and password');
      return;
    }

    setLoading(true);
    try {
      await login(phone.trim(), password);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.flex} bounces={false}>
        <LinearGradient colors={['#CC0000', '#990000']} style={styles.header}>
          <Image source={require('@/assets/logo.jpeg')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>OMJI Billing</Text>
          <Text style={styles.subtitle}>Pasugo • Pasabay • Pasundo</Text>
        </LinearGradient>

        <View style={styles.form}>
          <Input
            icon="📱"
            placeholder="Phone Number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
          <Input
            icon="🔒"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            isPassword
          />
          <Button title="Sign In" onPress={handleLogin} loading={loading} />
          <Text style={styles.forgot}>
            Forgot password? <Text style={styles.link}>Reset</Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surface },
  header: {
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logo: { width: 80, height: 80, borderRadius: 40, marginBottom: 16, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  form: { flex: 1, padding: 24, paddingTop: 32 },
  forgot: { textAlign: 'center', marginTop: 20, fontSize: 13, color: Colors.grey400 },
  link: { color: Colors.primary, fontWeight: '600' },
});
```

- [ ] **Step 5: Copy logo to mobile assets**

```bash
cp /Users/dev3/billingsystem/logo.jpeg /Users/dev3/billingsystem/mobile/assets/logo.jpeg
```

- [ ] **Step 6: Commit**

```bash
git add mobile/app/ mobile/assets/logo.jpeg
git commit -m "feat: add root layout, auth routing, and login screen"
```

---

### Task 7: Customer Tab Layout & Home Screen

**Files:**
- Create: `mobile/app/(customer)/_layout.tsx`
- Create: `mobile/app/(customer)/home.tsx`

- [ ] **Step 1: Create customer tab layout**

Create `mobile/app/(customer)/_layout.tsx`:

```typescript
import { Tabs } from 'expo-router';
import { Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

export default function CustomerLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.grey400,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>💳</Text>,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>📡</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>👤</Text>,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    height: 60,
    paddingBottom: 6,
  },
  tabLabel: { fontSize: 10, fontWeight: '600' },
  tabIcon: { fontSize: 20 },
});
```

- [ ] **Step 2: Create customer home screen**

Create `mobile/app/(customer)/home.tsx`:

```typescript
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { getMySubscriptions } from '@/services/subscriptions';
import { getMyPayments } from '@/services/payments';
import { Avatar } from '@/components/ui/Avatar';
import { PlanCard } from '@/components/PlanCard';
import { PaymentCard } from '@/components/PaymentCard';
import { QuickActions } from '@/components/QuickActions';
import { Colors } from '@/constants/colors';
import { getGreeting } from '@/utils/format';
import { Subscription, Payment } from '@/types';

export default function CustomerHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [subs, pays] = await Promise.all([getMySubscriptions(), getMyPayments()]);
      setSubscription(subs[0] || null);
      setPayments(pays.slice(0, 3));
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const actions = [
    { icon: '💳', label: 'Pay Now', onPress: () => router.push('/(customer)/payments/submit') },
    { icon: '📋', label: 'History', onPress: () => router.push('/(customer)/payments') },
    { icon: '📡', label: 'My Plan', onPress: () => router.push('/(customer)/plan') },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.name}>{user?.full_name}</Text>
          </View>
          <Avatar name={user?.full_name || 'U'} backgroundColor={Colors.primary} />
        </View>

        {/* Plan Card */}
        {subscription && <PlanCard subscription={subscription} />}

        {/* Quick Actions */}
        <View style={styles.section}>
          <QuickActions actions={actions} columns={3} />
        </View>

        {/* Recent Payments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Payments</Text>
          <View style={styles.list}>
            {payments.length > 0 ? (
              payments.map((p) => <PaymentCard key={p.id} payment={p} />)
            ) : (
              <Text style={styles.empty}>No payments yet</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  greeting: { fontSize: 13, color: Colors.grey400 },
  name: { fontSize: 18, fontWeight: '700', color: Colors.black },
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.black, paddingHorizontal: 16, marginBottom: 8 },
  list: { paddingHorizontal: 16 },
  empty: { textAlign: 'center', color: Colors.grey400, fontSize: 13, paddingVertical: 20 },
});
```

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(customer\)/
git commit -m "feat: add customer tab layout and home screen"
```

---

### Task 8: Customer Payments Screens

**Files:**
- Create: `mobile/app/(customer)/payments/index.tsx`
- Create: `mobile/app/(customer)/payments/submit.tsx`
- Create: `mobile/app/(customer)/payments/_layout.tsx`

- [ ] **Step 1: Create payments stack layout**

Create `mobile/app/(customer)/payments/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';

export default function PaymentsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="submit" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
```

- [ ] **Step 2: Create payment history screen**

Create `mobile/app/(customer)/payments/index.tsx`:

```typescript
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyPayments } from '@/services/payments';
import { PaymentCard } from '@/components/PaymentCard';
import { Colors } from '@/constants/colors';
import { Payment, PaymentStatus } from '@/types';

const FILTERS: { label: string; value: PaymentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

export default function PaymentHistory() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<PaymentStatus | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await getMyPayments();
      setPayments(data);
    } catch (err) {
      console.error('Failed to load payments:', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const filtered = filter === 'all' ? payments : payments.filter((p) => p.status === filter);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Payment History</Text>
        <TouchableOpacity style={styles.submitBtn} onPress={() => router.push('/(customer)/payments/submit')}>
          <Text style={styles.submitText}>+ Submit</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterBtn, filter === f.value && styles.filterActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PaymentCard payment={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<Text style={styles.empty}>No payments found</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.black },
  submitBtn: { backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  submitText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  filters: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 12 },
  filterBtn: { backgroundColor: Colors.surface, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  filterActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.grey600 },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  empty: { textAlign: 'center', color: Colors.grey400, fontSize: 13, paddingVertical: 40 },
});
```

- [ ] **Step 3: Create submit payment screen**

Create `mobile/app/(customer)/payments/submit.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { getMySubscriptions } from '@/services/subscriptions';
import { createPayment } from '@/services/payments';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { formatCurrency, formatShortDate } from '@/utils/format';
import { Subscription, PaymentMethod } from '@/types';

const METHODS: { label: string; value: PaymentMethod }[] = [
  { label: 'GCash', value: 'gcash' },
  { label: 'Maya', value: 'maya' },
  { label: 'Bank', value: 'bank' },
  { label: 'Cash', value: 'cash' },
];

export default function SubmitPayment() {
  const router = useRouter();
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('gcash');
  const [reference, setReference] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getMySubscriptions().then((subs) => setSubscription(subs[0] || null)).catch(console.error);
  }, []);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setProofUri(result.assets[0].uri);
    }
  }

  async function handleSubmit() {
    if (!subscription) {
      Alert.alert('Error', 'No active subscription found');
      return;
    }

    Alert.alert('Confirm Payment', `Submit ${formatCurrency(subscription.plan_price || 0)} via ${method}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit',
        onPress: async () => {
          setLoading(true);
          try {
            await createPayment({
              subscription_id: subscription.id,
              amount: subscription.plan_price || 0,
              method,
              reference_number: reference || undefined,
              proof_image_url: proofUri || undefined,
            });
            Alert.alert('Success', 'Payment submitted successfully!', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to submit payment');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← </Text>
          </TouchableOpacity>
          <Text style={styles.title}>Submit Payment</Text>
          <View style={{ width: 30 }} />
        </View>

        {/* Amount */}
        {subscription && (
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>AMOUNT DUE</Text>
            <Text style={styles.amount}>{formatCurrency(subscription.plan_price || 0)}</Text>
            <Text style={styles.amountSub}>{subscription.plan_name} • Due {formatShortDate(subscription.next_due_date)}</Text>
          </View>
        )}

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.methods}>
            {METHODS.map((m) => (
              <TouchableOpacity
                key={m.value}
                style={[styles.methodBtn, method === m.value && styles.methodActive]}
                onPress={() => setMethod(m.value)}
              >
                <Text style={[styles.methodText, method === m.value && styles.methodTextActive]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Reference */}
        <View style={styles.section}>
          <Input placeholder="Reference Number (optional)" value={reference} onChangeText={setReference} />
        </View>

        {/* Proof Upload */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.uploadArea} onPress={pickImage}>
            {proofUri ? (
              <Image source={{ uri: proofUri }} style={styles.proofImage} resizeMode="cover" />
            ) : (
              <>
                <Text style={styles.uploadIcon}>📷</Text>
                <Text style={styles.uploadText}>Upload Payment Proof</Text>
                <Text style={styles.uploadHint}>Tap to take photo or choose from gallery</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Submit */}
        <View style={styles.section}>
          <Button title="Submit Payment" onPress={handleSubmit} loading={loading} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back: { fontSize: 20, color: Colors.black },
  title: { fontSize: 17, fontWeight: '700', color: Colors.black },
  amountCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 24, marginHorizontal: 16, marginBottom: 16,
    alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  amountLabel: { fontSize: 11, color: Colors.grey400, letterSpacing: 1 },
  amount: { fontSize: 36, fontWeight: '800', color: Colors.primary, marginVertical: 4 },
  amountSub: { fontSize: 12, color: Colors.grey400 },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.black, marginBottom: 8 },
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodBtn: {
    flex: 1, minWidth: '45%', backgroundColor: Colors.surface, borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 2, borderColor: Colors.border,
  },
  methodActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  methodText: { fontSize: 13, fontWeight: '600', color: Colors.grey600 },
  methodTextActive: { color: '#fff' },
  uploadArea: {
    backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.grey200, borderStyle: 'dashed',
    borderRadius: 12, padding: 32, alignItems: 'center',
  },
  uploadIcon: { fontSize: 32, marginBottom: 8 },
  uploadText: { fontSize: 13, color: Colors.grey400 },
  uploadHint: { fontSize: 11, color: Colors.grey200, marginTop: 4 },
  proofImage: { width: '100%', height: 200, borderRadius: 8 },
});
```

- [ ] **Step 4: Commit**

```bash
git add mobile/app/\(customer\)/payments/
git commit -m "feat: add customer payment history and submit payment screens"
```

---

### Task 9: Customer Plan & Profile Screens

**Files:**
- Create: `mobile/app/(customer)/plan.tsx`
- Create: `mobile/app/(customer)/profile.tsx`

- [ ] **Step 1: Create plan details screen**

Create `mobile/app/(customer)/plan.tsx`:

```typescript
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMySubscriptions } from '@/services/subscriptions';
import { PlanCard } from '@/components/PlanCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Colors } from '@/constants/colors';
import { Subscription } from '@/types';
import { formatCurrency, formatDate } from '@/utils/format';

export default function PlanScreen() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const subs = await getMySubscriptions();
      setSubscription(subs[0] || null);
    } catch (err) {
      console.error('Failed to load subscription:', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (!subscription) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.empty}>No active subscription</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
        <Text style={styles.title}>My Plan</Text>
        <PlanCard subscription={subscription} />

        <View style={styles.details}>
          <Card style={styles.detailCard}>
            <Text style={styles.detailTitle}>Subscription Details</Text>
            <DetailRow label="Plan" value={subscription.plan_name || ''} />
            <DetailRow label="Speed" value={`${subscription.plan_speed || 0} Mbps`} />
            <DetailRow label="Price" value={formatCurrency(subscription.plan_price || 0)} />
            <DetailRow label="Billing Day" value={`Every ${subscription.billing_day}th`} />
            <DetailRow label="Next Due" value={formatDate(subscription.next_due_date)} />
            <DetailRow label="Grace Period" value={`${subscription.grace_days} days`} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <Badge status={subscription.status} />
            </View>
          </Card>

          {(subscription.ip_address || subscription.mac_address) && (
            <Card style={styles.detailCard}>
              <Text style={styles.detailTitle}>Connection Info</Text>
              {subscription.ip_address && <DetailRow label="IP Address" value={subscription.ip_address} />}
              {subscription.mac_address && <DetailRow label="MAC Address" value={subscription.mac_address} />}
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { fontSize: 18, fontWeight: '700', color: Colors.black, paddingHorizontal: 20, paddingTop: 16 },
  details: { paddingHorizontal: 16, paddingBottom: 20 },
  detailCard: { marginTop: 12, padding: 16 },
  detailTitle: { fontSize: 12, fontWeight: '700', color: Colors.grey400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  detailLabel: { fontSize: 13, color: Colors.grey600 },
  detailValue: { fontSize: 13, fontWeight: '600', color: Colors.black },
  empty: { textAlign: 'center', color: Colors.grey400, fontSize: 14, paddingVertical: 60 },
});
```

- [ ] **Step 2: Create profile screen (shared between customer and technician)**

Create `mobile/app/(customer)/profile.tsx`:

```typescript
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { Colors } from '@/constants/colors';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  }

  const menuItems = [
    { icon: '👤', label: 'Edit Profile', onPress: () => {} },
    { icon: '🔒', label: 'Change Password', onPress: () => {} },
    { icon: '🔔', label: 'Notifications', onPress: () => {} },
    { icon: 'ℹ️', label: 'About', onPress: () => {} },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        <LinearGradient colors={['#CC0000', '#990000']} style={styles.header}>
          <Avatar name={user?.full_name || 'U'} size={64} backgroundColor="#fff" textColor={Colors.primary} />
          <Text style={styles.name}>{user?.full_name}</Text>
          <Text style={styles.role}>{user?.role === 'customer' ? 'Customer' : 'Technician'} • {user?.phone}</Text>
        </LinearGradient>

        <View style={styles.menu}>
          <View style={styles.menuGroup}>
            {menuItems.map((item, i) => (
              <TouchableOpacity key={i} style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.menuGroup, { marginTop: 16 }]}>
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.7}>
              <Text style={styles.menuIcon}>🚪</Text>
              <Text style={[styles.menuLabel, { color: Colors.error }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.version}>OMJI Billing v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 40, paddingBottom: 28, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  name: { fontSize: 20, fontWeight: '700', color: '#fff', marginTop: 12 },
  role: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  menu: { padding: 20 },
  menuGroup: { backgroundColor: Colors.surface, borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  menuIcon: { fontSize: 18, marginRight: 12 },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.black },
  chevron: { fontSize: 18, color: Colors.grey200 },
  version: { textAlign: 'center', marginTop: 24, fontSize: 12, color: Colors.grey200 },
});
```

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(customer\)/plan.tsx mobile/app/\(customer\)/profile.tsx
git commit -m "feat: add customer plan details and profile screens"
```

---

### Task 10: Technician Tab Layout & Home Screen

**Files:**
- Create: `mobile/app/(technician)/_layout.tsx`
- Create: `mobile/app/(technician)/home.tsx`

- [ ] **Step 1: Create technician tab layout**

Create `mobile/app/(technician)/_layout.tsx`:

```typescript
import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

export default function TechnicianLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.grey400,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>💳</Text>,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>👥</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>👤</Text>,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    height: 60,
    paddingBottom: 6,
  },
  tabLabel: { fontSize: 10, fontWeight: '600' },
  tabIcon: { fontSize: 20 },
});
```

- [ ] **Step 2: Create technician home screen**

Create `mobile/app/(technician)/home.tsx`:

```typescript
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { getAllPayments } from '@/services/payments';
import { getAllSubscriptions } from '@/services/subscriptions';
import { StatCard } from '@/components/ui/StatCard';
import { QuickActions } from '@/components/QuickActions';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/colors';
import { Payment, Subscription } from '@/types';
import { formatCurrency, timeAgo } from '@/utils/format';

export default function TechnicianHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState({ pending: 0, overdue: 0, active: 0, todayApproved: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [payments, subscriptions] = await Promise.all([getAllPayments(), getAllSubscriptions()]);
      const pending = payments.filter((p) => p.status === 'pending');
      const todayApproved = payments.filter((p) => {
        if (p.status !== 'approved') return false;
        const today = new Date().toDateString();
        return new Date(p.updated_at).toDateString() === today;
      });

      setPendingPayments(pending.slice(0, 5));
      setStats({
        pending: pending.length,
        overdue: subscriptions.filter((s) => s.status === 'overdue').length,
        active: subscriptions.filter((s) => s.status === 'active').length,
        todayApproved: todayApproved.length,
      });
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const actions = [
    { icon: '✅', label: 'Approve', onPress: () => router.push('/(technician)/payments') },
    { icon: '👥', label: 'Clients', onPress: () => router.push('/(technician)/clients') },
    { icon: '📡', label: 'Network', onPress: () => {} },
    { icon: '🔍', label: 'Search', onPress: () => router.push('/(technician)/clients') },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back</Text>
            <Text style={styles.name}>{user?.full_name}</Text>
          </View>
          <Avatar name={user?.full_name || 'T'} backgroundColor={Colors.black} />
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <StatCard label="Pending" value={stats.pending} subtitle="Payments" borderColor={Colors.primary} subtitleColor={Colors.primary} />
            </View>
            <View style={styles.statItem}>
              <StatCard label="Overdue" value={stats.overdue} subtitle="Subscribers" borderColor={Colors.warning} subtitleColor={Colors.warning} />
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statItem}>
              <StatCard label="Active" value={stats.active} subtitle="Connections" borderColor={Colors.success} subtitleColor={Colors.success} />
            </View>
            <View style={styles.statItem}>
              <StatCard label="Today" value={stats.todayApproved} subtitle="Approved" borderColor={Colors.info} subtitleColor={Colors.info} />
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <QuickActions actions={actions} columns={4} />
        </View>

        {/* Pending Payments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending Payments</Text>
            <TouchableOpacity onPress={() => router.push('/(technician)/payments')}>
              <Text style={styles.seeAll}>See All →</Text>
            </TouchableOpacity>
          </View>
          {pendingPayments.map((p) => (
            <TouchableOpacity key={p.id} onPress={() => router.push(`/(technician)/payments/${p.id}`)}>
              <Card borderColor={Colors.warning} style={styles.pendingCard}>
                <View style={styles.pendingRow}>
                  <View>
                    <Text style={styles.pendingName}>{p.user_name}</Text>
                    <Text style={styles.pendingMeta}>{p.method} • {timeAgo(p.created_at)}</Text>
                  </View>
                  <Text style={styles.pendingAmount}>{formatCurrency(p.amount)}</Text>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
          {pendingPayments.length === 0 && <Text style={styles.empty}>No pending payments</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  greeting: { fontSize: 13, color: Colors.grey400 },
  name: { fontSize: 18, fontWeight: '700', color: Colors.black },
  statsGrid: { paddingHorizontal: 16, gap: 8 },
  statRow: { flexDirection: 'row', gap: 8 },
  statItem: { flex: 1 },
  section: { marginTop: 16, paddingBottom: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.black, paddingHorizontal: 16, marginBottom: 8 },
  seeAll: { fontSize: 12, color: Colors.primary, fontWeight: '600', paddingRight: 16 },
  pendingCard: { marginHorizontal: 16, marginBottom: 6 },
  pendingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pendingName: { fontSize: 13, fontWeight: '700', color: Colors.black },
  pendingMeta: { fontSize: 10, color: Colors.grey400, marginTop: 2 },
  pendingAmount: { fontSize: 15, fontWeight: '800', color: Colors.black },
  empty: { textAlign: 'center', color: Colors.grey400, fontSize: 13, paddingVertical: 20 },
});
```

- [ ] **Step 3: Commit**

```bash
git add mobile/app/\(technician\)/_layout.tsx mobile/app/\(technician\)/home.tsx
git commit -m "feat: add technician tab layout and home dashboard"
```

---

### Task 11: Technician Payments Screens

**Files:**
- Create: `mobile/app/(technician)/payments/_layout.tsx`
- Create: `mobile/app/(technician)/payments/index.tsx`
- Create: `mobile/app/(technician)/payments/[id].tsx`

- [ ] **Step 1: Create technician payments stack layout**

Create `mobile/app/(technician)/payments/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';

export default function PaymentsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
```

- [ ] **Step 2: Create technician payments list screen**

Create `mobile/app/(technician)/payments/index.tsx`:

```typescript
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllPayments } from '@/services/payments';
import { PaymentCard } from '@/components/PaymentCard';
import { Colors } from '@/constants/colors';
import { Payment, PaymentStatus } from '@/types';

const FILTERS: { label: string; value: PaymentStatus | 'all' }[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'All', value: 'all' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

export default function TechPayments() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<PaymentStatus | 'all'>('pending');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await getAllPayments();
      setPayments(data);
    } catch (err) {
      console.error('Failed to load payments:', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const filtered = filter === 'all' ? payments : payments.filter((p) => p.status === filter);
  const pendingCount = payments.filter((p) => p.status === 'pending').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Payments</Text>
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount} pending</Text>
          </View>
        )}
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterBtn, filter === f.value && styles.filterActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PaymentCard payment={item} showCustomer onPress={() => router.push(`/(technician)/payments/${item.id}`)} />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<Text style={styles.empty}>No payments found</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.black },
  badge: { backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  filters: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, marginBottom: 12 },
  filterBtn: { backgroundColor: Colors.surface, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  filterActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: Colors.grey600 },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  empty: { textAlign: 'center', color: Colors.grey400, fontSize: 13, paddingVertical: 40 },
});
```

- [ ] **Step 3: Create payment detail / approval screen**

Create `mobile/app/(technician)/payments/[id].tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Image, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllPayments, approvePayment, rejectPayment } from '@/services/payments';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/colors';
import { Payment } from '@/types';
import { formatCurrency, formatBillingPeriod } from '@/utils/format';

export default function PaymentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getAllPayments().then((payments) => {
      const found = payments.find((p) => p.id === id);
      setPayment(found || null);
    }).catch(console.error);
  }, [id]);

  async function handleApprove() {
    if (!payment) return;
    Alert.alert('Approve Payment', `Approve ${formatCurrency(payment.amount)} from ${payment.user_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve',
        onPress: async () => {
          setLoading(true);
          try {
            await approvePayment(payment.id, notes || undefined);
            Alert.alert('Success', 'Payment approved!', [{ text: 'OK', onPress: () => router.back() }]);
          } catch (err: any) {
            Alert.alert('Error', err.message);
          } finally { setLoading(false); }
        },
      },
    ]);
  }

  async function handleReject() {
    if (!payment) return;
    Alert.alert('Reject Payment', `Reject ${formatCurrency(payment.amount)} from ${payment.user_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await rejectPayment(payment.id, notes || undefined);
            Alert.alert('Rejected', 'Payment rejected.', [{ text: 'OK', onPress: () => router.back() }]);
          } catch (err: any) {
            Alert.alert('Error', err.message);
          } finally { setLoading(false); }
        },
      },
    ]);
  }

  if (!payment) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.empty}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Payment Details</Text>
          <View style={{ width: 30 }} />
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Card>
            <View style={styles.customerRow}>
              <Avatar name={payment.user_name || '?'} size={44} backgroundColor={Colors.errorLight} textColor={Colors.primary} />
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{payment.user_name}</Text>
                <Text style={styles.customerPhone}>{payment.user_phone}</Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Payment Info */}
        <View style={styles.section}>
          <Card>
            <Text style={styles.cardTitle}>PAYMENT INFO</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Amount</Text>
              <Text style={styles.infoAmount}>{formatCurrency(payment.amount)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Method</Text>
              <Text style={styles.infoValue}>{payment.method.charAt(0).toUpperCase() + payment.method.slice(1)}</Text>
            </View>
            {payment.reference_number && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Reference</Text>
                <Text style={styles.infoValue}>#{payment.reference_number}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Billing Period</Text>
              <Text style={styles.infoValue}>{formatBillingPeriod(payment.billing_period_start, payment.billing_period_end)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <Badge status={payment.status} />
            </View>
          </Card>
        </View>

        {/* Proof Image */}
        {payment.proof_image_url && (
          <View style={styles.section}>
            <Card>
              <Text style={styles.cardTitle}>PAYMENT PROOF</Text>
              <Image source={{ uri: payment.proof_image_url }} style={styles.proofImage} resizeMode="contain" />
            </Card>
          </View>
        )}

        {/* Notes & Actions */}
        {payment.status === 'pending' && (
          <View style={styles.section}>
            <Input placeholder="Add notes (optional)..." value={notes} onChangeText={setNotes} multiline />
            <View style={styles.actions}>
              <Button title="Reject" variant="outline" onPress={handleReject} loading={loading} style={styles.actionBtn} />
              <Button title="Approve" variant="primary" onPress={handleApprove} loading={loading} style={[styles.actionBtn, { backgroundColor: Colors.success }]} />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back: { fontSize: 22, color: Colors.black },
  title: { fontSize: 17, fontWeight: '700', color: Colors.black },
  section: { paddingHorizontal: 16, marginBottom: 12 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 15, fontWeight: '700', color: Colors.black },
  customerPhone: { fontSize: 12, color: Colors.grey400, marginTop: 2 },
  cardTitle: { fontSize: 11, fontWeight: '700', color: Colors.grey400, letterSpacing: 0.5, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  infoLabel: { fontSize: 13, color: Colors.grey600 },
  infoAmount: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  infoValue: { fontSize: 13, fontWeight: '600', color: Colors.black },
  proofImage: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#f0f0f0' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: { flex: 1 },
  empty: { textAlign: 'center', color: Colors.grey400, paddingVertical: 60, fontSize: 14 },
});
```

- [ ] **Step 4: Commit**

```bash
git add mobile/app/\(technician\)/payments/
git commit -m "feat: add technician payments list and approval detail screen"
```

---

### Task 12: Technician Clients Screens

**Files:**
- Create: `mobile/app/(technician)/clients/_layout.tsx`
- Create: `mobile/app/(technician)/clients/index.tsx`
- Create: `mobile/app/(technician)/clients/[id].tsx`

- [ ] **Step 1: Create clients stack layout**

Create `mobile/app/(technician)/clients/_layout.tsx`:

```typescript
import { Stack } from 'expo-router';

export default function ClientsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
```

- [ ] **Step 2: Create clients list screen**

Create `mobile/app/(technician)/clients/index.tsx`:

```typescript
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TouchableOpacity } from 'react-native';
import { getAllSubscriptions } from '@/services/subscriptions';
import { ClientCard } from '@/components/ClientCard';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/constants/colors';
import { Subscription, SubscriptionStatus } from '@/types';

const FILTERS: { label: string; value: SubscriptionStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Suspended', value: 'suspended' },
];

export default function ClientList() {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filter, setFilter] = useState<SubscriptionStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const data = await getAllSubscriptions();
      setSubscriptions(data);
    } catch (err) {
      console.error('Failed to load clients:', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const filtered = useMemo(() => {
    let result = subscriptions;
    if (filter !== 'all') result = result.filter((s) => s.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((s) =>
        s.user_name?.toLowerCase().includes(q) || s.user_phone?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [subscriptions, filter, search]);

  const counts = useMemo(() => ({
    all: subscriptions.length,
    active: subscriptions.filter((s) => s.status === 'active').length,
    overdue: subscriptions.filter((s) => s.status === 'overdue').length,
    suspended: subscriptions.filter((s) => s.status === 'suspended').length,
  }), [subscriptions]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Clients</Text>
        <Input icon="🔍" placeholder="Search by name or phone..." value={search} onChangeText={setSearch} style={styles.searchInput} />
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterBtn, filter === f.value && styles.filterActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
              {f.label} ({counts[f.value]})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ClientCard subscription={item} onPress={() => router.push(`/(technician)/clients/${item.user_id}`)} />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={<Text style={styles.empty}>No clients found</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.black, marginBottom: 10 },
  searchInput: { marginBottom: 0 },
  filters: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 12, flexWrap: 'wrap' },
  filterBtn: { backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  filterActive: { backgroundColor: Colors.primary },
  filterText: { fontSize: 11, fontWeight: '600', color: Colors.grey600 },
  filterTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  empty: { textAlign: 'center', color: Colors.grey400, fontSize: 13, paddingVertical: 40 },
});
```

- [ ] **Step 3: Create client detail screen**

Create `mobile/app/(technician)/clients/[id].tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUser } from '@/services/users';
import { getAllSubscriptions } from '@/services/subscriptions';
import { getAllPayments } from '@/services/payments';
import { Card } from '@/components/ui/Card';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { PaymentCard } from '@/components/PaymentCard';
import { Colors } from '@/constants/colors';
import { User, Subscription, Payment } from '@/types';
import { formatCurrency, formatDate } from '@/utils/format';

export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [client, setClient] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getUser(id),
      getAllSubscriptions().then((subs) => subs.find((s) => s.user_id === id) || null),
      getAllPayments().then((pays) => pays.filter((p) => p.user_id === id).slice(0, 5)),
    ]).then(([u, s, p]) => {
      setClient(u);
      setSubscription(s);
      setPayments(p);
    }).catch(console.error);
  }, [id]);

  if (!client) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.empty}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Client Details</Text>
          <View style={{ width: 30 }} />
        </View>

        {/* Client Info */}
        <View style={styles.section}>
          <Card>
            <View style={styles.clientRow}>
              <Avatar name={client.full_name} size={52} />
              <View style={styles.clientInfo}>
                <Text style={styles.clientName}>{client.full_name}</Text>
                <Text style={styles.clientMeta}>{client.phone}</Text>
                {client.email && <Text style={styles.clientMeta}>{client.email}</Text>}
                {client.address && <Text style={styles.clientMeta}>{client.address}</Text>}
              </View>
            </View>
          </Card>
        </View>

        {/* Subscription */}
        {subscription && (
          <View style={styles.section}>
            <Card>
              <Text style={styles.cardTitle}>SUBSCRIPTION</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Plan</Text>
                <Text style={styles.infoValue}>{subscription.plan_name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Speed</Text>
                <Text style={styles.infoValue}>{subscription.plan_speed} Mbps</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Price</Text>
                <Text style={styles.infoValue}>{formatCurrency(subscription.plan_price || 0)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Next Due</Text>
                <Text style={styles.infoValue}>{formatDate(subscription.next_due_date)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Status</Text>
                <Badge status={subscription.status} />
              </View>
              {subscription.ip_address && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>IP Address</Text>
                  <Text style={styles.infoValue}>{subscription.ip_address}</Text>
                </View>
              )}
            </Card>
          </View>
        )}

        {/* Recent Payments */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recent Payments</Text>
          {payments.length > 0 ? (
            payments.map((p) => <PaymentCard key={p.id} payment={p} />)
          ) : (
            <Text style={styles.empty}>No payments yet</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  back: { fontSize: 22, color: Colors.black },
  title: { fontSize: 17, fontWeight: '700', color: Colors.black },
  section: { paddingHorizontal: 16, marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.black, marginBottom: 8 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 16, fontWeight: '700', color: Colors.black },
  clientMeta: { fontSize: 12, color: Colors.grey400, marginTop: 2 },
  cardTitle: { fontSize: 11, fontWeight: '700', color: Colors.grey400, letterSpacing: 0.5, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoLabel: { fontSize: 13, color: Colors.grey600 },
  infoValue: { fontSize: 13, fontWeight: '600', color: Colors.black },
  empty: { textAlign: 'center', color: Colors.grey400, fontSize: 13, paddingVertical: 20 },
});
```

- [ ] **Step 4: Commit**

```bash
git add mobile/app/\(technician\)/clients/
git commit -m "feat: add technician client list and client detail screens"
```

---

### Task 13: Technician Profile Screen

**Files:**
- Create: `mobile/app/(technician)/profile.tsx`

- [ ] **Step 1: Create technician profile (reuse customer profile pattern)**

Create `mobile/app/(technician)/profile.tsx`:

```typescript
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { Avatar } from '@/components/ui/Avatar';
import { Colors } from '@/constants/colors';

export default function TechProfileScreen() {
  const { user, logout } = useAuth();

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  }

  const menuItems = [
    { icon: '👤', label: 'Edit Profile', onPress: () => {} },
    { icon: '🔒', label: 'Change Password', onPress: () => {} },
    { icon: '🔔', label: 'Notifications', onPress: () => {} },
    { icon: 'ℹ️', label: 'About', onPress: () => {} },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        <LinearGradient colors={['#CC0000', '#990000']} style={styles.header}>
          <Avatar name={user?.full_name || 'T'} size={64} backgroundColor="#fff" textColor={Colors.primary} />
          <Text style={styles.name}>{user?.full_name}</Text>
          <Text style={styles.role}>Technician • {user?.phone}</Text>
        </LinearGradient>

        <View style={styles.menu}>
          <View style={styles.menuGroup}>
            {menuItems.map((item, i) => (
              <TouchableOpacity key={i} style={styles.menuItem} onPress={item.onPress} activeOpacity={0.7}>
                <Text style={styles.menuIcon}>{item.icon}</Text>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.menuGroup, { marginTop: 16 }]}>
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.7}>
              <Text style={styles.menuIcon}>🚪</Text>
              <Text style={[styles.menuLabel, { color: Colors.error }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.version}>OMJI Billing v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: 40, paddingBottom: 28, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  name: { fontSize: 20, fontWeight: '700', color: '#fff', marginTop: 12 },
  role: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  menu: { padding: 20 },
  menuGroup: { backgroundColor: Colors.surface, borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  menuIcon: { fontSize: 18, marginRight: 12 },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.black },
  chevron: { fontSize: 18, color: Colors.grey200 },
  version: { textAlign: 'center', marginTop: 24, fontSize: 12, color: Colors.grey200 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/app/\(technician\)/profile.tsx
git commit -m "feat: add technician profile screen"
```

---

### Task 14: Install Dependencies & Verify Build

- [ ] **Step 1: Install expo-linear-gradient (used by PlanCard and profile headers)**

```bash
cd /Users/dev3/billingsystem/mobile && npx expo install expo-linear-gradient
```

- [ ] **Step 2: Install all packages**

```bash
cd /Users/dev3/billingsystem/mobile && npm install
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/dev3/billingsystem/mobile && npx tsc --noEmit
```

Expected: No type errors. If there are errors, fix them before proceeding.

- [ ] **Step 4: Start Expo and verify the app loads**

```bash
cd /Users/dev3/billingsystem/mobile && npx expo start
```

Expected: Metro bundler starts. App should load showing the login screen.

- [ ] **Step 5: Commit any fixes**

```bash
git add mobile/
git commit -m "feat: install remaining dependencies and fix build issues"
```
