# OMJI Mobile App — Professional UI/UX Design Spec (v2)

**Supersedes:** `2026-04-05-omji-mobile-app-design.md` (retains all architecture decisions, enhances UI/UX)

## Overview

React Native (Expo Router) mobile app for **OMJI Billing System**, serving **Customers** and **Technicians** in a single app with role-based screens. Professional, polished UI with the OMJI brand identity (red/black/white).

**Brand:** OMJI — Pasugo, Pasabay, Pasundo — Balingasag
**Logo:** `logo.jpeg` (circular logo, used on login and profile headers)

---

## Branding & Color System

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#CC0000` | Buttons, active tabs, headers, brand elements |
| Primary Dark | `#990000` | Gradients, pressed states |
| Primary Light | `#FFE5E5` | Light tint backgrounds for badges/highlights |
| Black | `#1A1A1A` | Headings, primary text |
| Grey 700 | `#444444` | Body text |
| Grey 500 | `#888888` | Secondary text, labels |
| Grey 300 | `#CCCCCC` | Borders, dividers |
| Grey 100 | `#F5F5F5` | Screen backgrounds |
| Surface | `#FFFFFF` | Cards, inputs, tab bar |
| Success | `#22C55E` | Active, approved |
| Success Light | `#DCFCE7` | Success badge background |
| Warning | `#F59E0B` | Pending, overdue |
| Warning Light | `#FEF3C7` | Warning badge background |
| Error | `#EF4444` | Rejected, suspended, destructive |
| Error Light | `#FEE2E2` | Error badge background |
| Info | `#3B82F6` | Informational accents |
| Info Light | `#DBEAFE` | Info badge background |

## Typography System

| Style | Size | Weight | Usage |
|-------|------|--------|-------|
| H1 | 28px | Bold (700) | Screen titles |
| H2 | 22px | Bold (700) | Section headers |
| H3 | 18px | SemiBold (600) | Card titles |
| Body | 15px | Regular (400) | Body text |
| Body Bold | 15px | SemiBold (600) | Emphasized body |
| Caption | 13px | Regular (400) | Labels, timestamps |
| Small | 11px | Medium (500) | Badges, tags |

## Spacing System

Base unit: 4px. Standard spacings: 4, 8, 12, 16, 20, 24, 32, 40, 48px.

## Design Language

- **Cards:** White with 1px `#F0F0F0` border, 12px radius, `shadowColor: #000, opacity: 0.06, offset: {0, 2}, radius: 8, elevation: 2`. Status cards have a 4px colored left border.
- **Buttons:** 48px height, 12px radius. Primary = red fill + white text. Outline = white fill + red border + red text. Destructive = red outline. Press state = scale(0.97) + darken.
- **Inputs:** 48px height, 12px radius, 1px `#E0E0E0` border, 16px padding. Focus state = red border.
- **Status Badges:** Pill shape, 6px vertical / 12px horizontal padding. Colored text on light tint background (e.g., green text on `#DCFCE7`).
- **Avatars:** 44px circle with colored background + white initials. Color derived from name hash.
- **Tab Bar:** White background, 1px top border, 60px height + safe area. Active = red icon + red label. Inactive = grey icon + grey label.
- **Lists:** `FlatList` with 16px horizontal padding, 12px item gap. Skeleton loaders (3 placeholder cards) on initial load.
- **Pull-to-refresh:** Red-tinted `RefreshControl`.
- **Empty states:** Centered icon (48px, grey) + title + subtitle + optional action button.
- **Transitions:** Screen push/pop with default Expo Router animations. Card press = `Animated` scale feedback.

---

## Tech Stack

- React Native + Expo SDK 54 + Expo Router (file-based routing)
- TypeScript
- React Native StyleSheet (no external CSS libs)
- Expo SecureStore (tokens), AsyncStorage (cache)
- Expo Image Picker (payment proof)
- expo-haptics (approve/reject feedback)

---

## Architecture

### File Structure

```
mobile/
├── app/
│   ├── _layout.tsx              # Root: AuthProvider + font loading + splash
│   ├── index.tsx                # Entry: redirect based on auth state
│   ├── (auth)/
│   │   ├── _layout.tsx          # Stack layout (no header)
│   │   └── login.tsx            # Phone + password login
│   ├── (customer)/
│   │   ├── _layout.tsx          # Bottom tabs (Home, Payments, Plan, Profile)
│   │   ├── home.tsx
│   │   ├── payments/
│   │   │   ├── index.tsx        # Payment history
│   │   │   └── submit.tsx       # Submit payment form
│   │   ├── plan.tsx
│   │   └── profile.tsx
│   └── (technician)/
│       ├── _layout.tsx          # Bottom tabs (Home, Payments, Clients, Profile)
│       ├── home.tsx
│       ├── payments/
│       │   ├── index.tsx        # All payments list
│       │   └── [id].tsx         # Payment detail + approve/reject
│       ├── clients/
│       │   ├── index.tsx        # Client list + search
│       │   └── [id].tsx         # Client detail
│       └── profile.tsx
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── StatCard.tsx
│   │   ├── Badge.tsx
│   │   ├── Input.tsx
│   │   ├── Avatar.tsx
│   │   ├── TabBar.tsx
│   │   ├── SkeletonLoader.tsx
│   │   └── EmptyState.tsx
│   ├── PaymentCard.tsx
│   ├── ClientCard.tsx
│   ├── PlanCard.tsx
│   └── QuickActions.tsx
├── services/
│   ├── api.ts                   # Fetch wrapper with auth interceptor + refresh
│   ├── auth.ts
│   ├── payments.ts
│   ├── subscriptions.ts
│   ├── users.ts
│   ├── plans.ts
│   └── dashboard.ts
├── hooks/
│   ├── useAuth.tsx
│   └── useApi.ts
├── context/
│   └── AuthContext.tsx
├── constants/
│   ├── colors.ts
│   ├── typography.ts
│   └── api.ts
├── types/
│   └── index.ts
└── utils/
    ├── storage.ts
    └── format.ts
```

### Auth Flow

1. App opens -> `_layout.tsx` loads fonts + checks SecureStore for tokens
2. No tokens -> redirect to `(auth)/login`
3. User enters phone + password -> `POST /api/auth/login`
4. Store tokens in SecureStore, user in AuthContext
5. Redirect based on `user.role`: customer -> `(customer)/home`, technician -> `(technician)/home`
6. API interceptor attaches `Authorization: Bearer <token>`
7. On 401 -> attempt refresh -> if fails -> logout + redirect to login

### API Service Layer

Central `api.ts` with:
- `apiRequest(method, path, body?, options?)` function
- Auto-attaches auth header from SecureStore
- 401 interceptor: queues requests, refreshes token, retries
- Multipart form support for image uploads
- Returns `{ data, error }` pattern for clean error handling

---

## Screen Specifications

### Login Screen

- **Header area:** Red gradient background (`#CC0000` -> `#990000`), 40% of screen height
- **Logo:** OMJI `logo.jpeg`, 120px circle, centered in header, white circular border (3px)
- **Title:** "OMJI Billing" in white, 28px bold, below logo
- **Subtitle:** "Pasugo - Pasabay - Pasundo" in white/80% opacity, 14px
- **Form card:** White card overlapping header by 30px, 16px radius, shadow
  - Phone input with phone icon prefix, "09XX XXX XXXX" placeholder
  - Password input with lock icon, show/hide eye toggle
  - "Sign In" button, full width, red, 48px height
  - Loading state: button shows spinner, inputs disabled
- **Footer:** "OMJI Balingasag" in grey, app version, bottom-aligned

### Customer Home

- **Header:** White background, "Good morning, {firstName}" in H2, grey subtitle "Here's your account overview", avatar top-right
- **Plan Card:** Red gradient card (rounded 16px), white text: plan name (bold), speed, "PHP {price}/mo", next due date, status badge (white bg on red)
- **Quick Actions:** 3 items in a row — "Pay Now" (wallet icon), "History" (clock icon), "My Plan" (wifi icon). Each is a white card with red icon + label below.
- **Recent Payments:** Section header "Recent Payments" + "See All" link. Last 3 payments as `PaymentCard` components.
- Pull-to-refresh reloads subscription + recent payments

### Customer Payments

- **Header:** "Payments" title + filter dropdown (All/Pending/Approved/Rejected)
- **List:** FlatList of PaymentCard items, 12px gap
- **PaymentCard:** White card, 4px left border (colored by status). Shows: billing period, amount (bold), method + reference, status badge. Tap = expand details.
- **FAB:** Floating action button bottom-right, red circle 56px, "+" icon, navigates to submit screen
- **Empty state:** "No payments yet" + "Submit your first payment" button

### Submit Payment

- **Header:** "Submit Payment" with back arrow
- **Amount section:** Plan name + "PHP {price}" large text, billing period auto-calculated
- **Method selector:** 2x2 grid of method cards (GCash, Maya, Bank Transfer, Cash). Selected = red fill + white text + checkmark. Unselected = white + grey border.
- **Reference input:** "Reference Number" text input (optional for cash)
- **Proof upload:** Dashed border box (160px height), camera icon, "Tap to upload proof". After selection: shows image thumbnail with "X" to remove.
- **Submit button:** Full width red, "Submit Payment". Disabled until method selected.
- **Confirmation:** Alert dialog "Submit payment of PHP {amount} via {method}?" with Cancel/Confirm

### Customer Plan

- **Header:** "My Plan" title
- **Plan details card:** Plan name, speed (with speedometer icon), price
- **Subscription card:** Billing day, next due date, status badge, grace period info
- **Connection card:** IP address, MAC address (if available)

### Customer Profile

- **Header:** Red gradient (shorter than login), avatar (64px), full name, role badge, phone number
- **Menu sections:** White cards with list items
  - Account: Edit Profile (future), Change Password (future)
  - App: About, App Version
  - Sign Out: Red text, with confirmation dialog
- **Version:** "OMJI Billing v1.0.0" centered at bottom

### Technician Home

- **Header:** "Welcome back, {firstName}" + avatar
- **Stat Cards:** 2x2 grid, each card has:
  - Colored left border (4px)
  - Large number (H1)
  - Label (caption, uppercase)
  - Cards: Pending (red), Overdue (orange), Active (green), Approved Today (blue)
- **Quick Actions:** 4 items — "Approve" (checkmark), "Clients" (users), "Network" (wifi), "Search" (search icon)
- **Pending Payments:** Section header "Pending Payments" + badge count + "See All"
  - List of recent pending payments: customer avatar + name, method, time ago, amount (right-aligned, bold)
- Pull-to-refresh reloads stats + pending list

### Technician Payments

- **Tab badge:** Red badge with pending count on tab icon
- **Filter bar:** Horizontal scroll of filter pills (All, Pending, Approved, Rejected) with counts
- **List:** All payments, each showing: customer name + avatar, amount, method, timestamp, status badge
- Tap navigates to `[id].tsx` detail screen

### Technician Payment Detail

- **Customer card:** Avatar, name, phone, plan name, subscription status
- **Payment card:** Large amount in red, method, reference number, billing period, submitted date
- **Proof image:** Tappable thumbnail -> full-screen viewer with pinch-to-zoom
- **Notes input:** TextInput for rejection reason (shown when rejecting)
- **Action buttons:** Row of two buttons:
  - "Reject" — red outline, left
  - "Approve" — green fill, right
  - Both trigger confirmation dialog + haptic feedback
- After action: auto-navigate back with success toast

### Technician Clients

- **Search bar:** White input with search icon, "Search by name or phone"
- **Filter tabs:** Horizontal scroll pills — All ({count}), Active, Overdue, Suspended
- **Client list:** Cards with avatar (initials), name (bold), plan name, status badge, due date or "Overdue by X days"
- 4px left border colored by status
- Tap navigates to `[id].tsx` detail

### Technician Client Detail

- **Header card:** Large avatar, name, phone, email, address
- **Subscription card:** Plan, speed, price, status, billing day, next due, IP/MAC
- **Actions:** Disconnect/Reconnect button (if applicable)
- **Payment history:** Recent payments for this customer, same PaymentCard component

### Shared Profile

Same component used for both roles. Menu items may differ slightly (technicians don't see "My Plan").

---

## Non-Goals (Future Enhancements)

- Push notifications (Expo Push Tokens)
- Dark mode (toggle present but not wired)
- Forgot password flow
- Cloud image storage (R2/S3) — currently stores locally
- WebSocket real-time updates
- Offline mode / local caching
- Admin role in mobile app
