# OMJI Billing System — Mobile App Design Spec

## Overview

React Native (Expo Router) mobile app for **OMJI Billing System**, serving two user roles — **Customers** and **Technicians** — in a single app with role-based screens. Login determines which experience the user sees.

**Brand:** OMJI (Pasugo, Pasabay, Pasundo — Balingasag)
**Logo file:** `logo.jpeg` (project root)

## Branding & Color System

All branding references changed from JNDS to OMJI throughout the entire system.

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#CC0000` | Buttons, active tabs, headers, brand elements |
| Primary Dark | `#990000` | Gradients, pressed states |
| Black | `#1A1A1A` | Headings, primary text |
| Grey 600 | `#666666` | Secondary text |
| Grey 400 | `#999999` | Placeholder text, labels |
| Background | `#F8F8F8` | Screen backgrounds |
| Surface | `#FFFFFF` | Cards, inputs, tab bar |
| Success | `#4CAF50` | Active status, approved payments |
| Warning | `#FF9800` | Pending status, overdue |
| Error | `#F44336` | Rejected, suspended, destructive actions |
| Info | `#2196F3` | Informational accents |

## Design Language

Matches the existing OMJI admin panel (omji-v1.vercel.app):
- **Cards** with colored left borders indicating status
- **Stat cards** with left-border accent, uppercase labels, large numbers
- **Clean white surfaces** on light grey backgrounds
- **Rounded corners** (12px cards, 12px buttons, 32px phone frames)
- **Status badges** with light background tint + bold colored text (e.g., green bg + green text for "APPROVED")

## Tech Stack

- **React Native** with **Expo SDK 54**
- **Expo Router** (file-based routing with route groups)
- **TypeScript**
- **React Native StyleSheet** (no external CSS libs)
- **AsyncStorage** for token persistence
- **Expo Image Picker** for payment proof uploads
- **Expo Secure Store** for sensitive token storage

## Architecture

### File Structure

```
mobile/
├── app/
│   ├── _layout.tsx              # Root layout (auth provider)
│   ├── index.tsx                # Entry redirect
│   ├── (auth)/
│   │   ├── _layout.tsx          # Auth stack layout
│   │   ├── login.tsx            # Phone + password login
│   │   └── forgot-password.tsx  # Password reset (future)
│   ├── (customer)/
│   │   ├── _layout.tsx          # Customer tab layout
│   │   ├── home.tsx             # Dashboard with plan card
│   │   ├── payments/
│   │   │   ├── index.tsx        # Payment history list
│   │   │   └── submit.tsx       # Submit payment form
│   │   ├── plan.tsx             # Subscription details
│   │   └── profile.tsx          # Profile & settings
│   └── (technician)/
│       ├── _layout.tsx          # Technician tab layout
│       ├── home.tsx             # Dashboard with stats
│       ├── payments/
│       │   ├── index.tsx        # All pending payments list
│       │   └── [id].tsx         # Payment detail + approve/reject
│       ├── clients/
│       │   ├── index.tsx        # Client list with search/filter
│       │   └── [id].tsx         # Client detail view
│       └── profile.tsx          # Profile & settings
├── components/
│   ├── ui/
│   │   ├── Button.tsx           # Primary, outline, destructive variants
│   │   ├── Card.tsx             # Card with optional left border color
│   │   ├── StatCard.tsx         # Dashboard stat card
│   │   ├── Badge.tsx            # Status badge (approved/pending/rejected)
│   │   ├── Input.tsx            # Text input with icon
│   │   ├── Avatar.tsx           # Initials avatar with colored background
│   │   └── TabBar.tsx           # Custom bottom tab bar
│   ├── PaymentCard.tsx          # Payment list item
│   ├── ClientCard.tsx           # Client list item
│   ├── PlanCard.tsx             # Gradient plan card
│   └── QuickActions.tsx         # Quick action grid
├── services/
│   ├── api.ts                   # Axios/fetch wrapper with auth interceptor
│   ├── auth.ts                  # Login, refresh token, logout
│   ├── payments.ts              # Payment CRUD
│   ├── subscriptions.ts         # Subscription queries
│   ├── users.ts                 # User queries
│   └── plans.ts                 # Plan queries
├── hooks/
│   ├── useAuth.tsx              # Auth context & hook
│   ├── useApi.ts                # API call hook with loading/error
│   └── useRefresh.ts            # Pull-to-refresh hook
├── context/
│   └── AuthContext.tsx          # Auth state, tokens, role
├── constants/
│   ├── colors.ts                # Color tokens
│   └── api.ts                   # API base URL
├── types/
│   └── index.ts                 # TypeScript interfaces matching backend models
└── utils/
    ├── storage.ts               # SecureStore helpers
    └── format.ts                # Currency, date formatters
```

### Auth Flow

1. User opens app → checks SecureStore for existing tokens
2. If no tokens → redirect to `(auth)/login`
3. User enters phone + password → POST `/api/auth/login`
4. Backend returns `{ tokens: { access_token, refresh_token, expires_at }, user }`
5. Store tokens in SecureStore, user in AuthContext
6. Based on `user.role`:
   - `customer` → redirect to `(customer)/home`
   - `technician` → redirect to `(technician)/home`
7. API interceptor attaches `Authorization: Bearer <access_token>` to all requests
8. On 401 → attempt refresh with `refresh_token` → if fails, logout

**Backend change required:** Remove the `ErrCustomerMustUseOTP` check in `auth_service.go` Login method to allow customers to login with phone + password.

### API Integration

Base URL configured via environment variable. All API calls go through a central client that:
- Attaches auth headers
- Handles token refresh on 401
- Provides loading/error states
- Supports pull-to-refresh patterns

## Screen Specifications

### Shared: Login Screen

- OMJI logo (from `logo.jpeg`) centered in red gradient header
- "OMJI Billing" title with "Pasugo, Pasabay, Pasundo" subtitle
- Phone number input with phone icon
- Password input with lock icon (show/hide toggle)
- "Sign In" primary button (full width, red)
- "Forgot password?" link below
- Loading spinner on submit

### Customer Screens

#### Customer Home (Tab 1)

- **Header:** Greeting ("Good Morning") + user name + avatar
- **Plan Card:** Red gradient card showing current plan name, speed, monthly price, due date, status badge
- **Quick Actions:** 3-column grid — Pay Now, History, My Plan
- **Recent Payments:** Last 2-3 payments as cards with colored left borders (green=approved, orange=pending, red=rejected)
- Pull-to-refresh to reload data

#### Payments Tab (Tab 2)

- **Payment History:** Scrollable list of all user's payments
- Each item: amount, billing period, method, reference number, status badge
- Colored left border per status
- Filter dropdown (All / Pending / Approved / Rejected)
- FAB or header button to "Submit Payment"

#### Submit Payment (Push screen from Payments)

- **Amount display:** Large centered amount with plan info
- **Payment method selector:** 2x2 grid (GCash, Maya, Bank, Cash) — selected = red fill, unselected = white outline
- **Reference number input:** Optional text field
- **Proof upload:** Dashed border area with camera icon, tap to open image picker (camera or gallery)
- **Submit button:** Full width red button
- Confirmation dialog before submit
- Success/error feedback

#### Plan Tab (Tab 3)

- Current subscription details: plan name, speed, price, billing day, next due date, status
- Connection info: IP address, MAC address (if available)
- Grace period info

#### Profile Tab (Tab 4)

- Red gradient header with avatar, name, role, phone
- Settings list: Edit Profile, Change Password, Notifications, Dark Mode toggle, About
- Sign Out button (red text)
- App version at bottom

### Technician Screens

#### Technician Home (Tab 1)

- **Header:** "Welcome back" + technician name + avatar
- **Stat Cards:** 2x2 grid with colored left borders:
  - Pending Payments (red border) — count
  - Overdue Subscribers (orange border) — count
  - Active Connections (green border) — count
  - Today's Approved (blue border) — count
- **Quick Actions:** 4-column grid — Approve, Clients, Network, Search
- **Pending Payments List:** Recent pending items with customer name, method, time ago, amount
- "See All" link to payments tab
- Pull-to-refresh

#### Payments Tab (Tab 2)

- Badge count on tab icon showing pending count
- List of all payments (not just user's own)
- Filter by status (Pending / Approved / Rejected / All)
- Each item: customer name, amount, method, time submitted
- Tap to open payment detail

#### Payment Detail (Push screen)

- **Customer Info Card:** Avatar, name, phone, plan, subscription status
- **Payment Info Card:** Amount (red, large), method, reference number, billing period
- **Proof Image:** Tappable to view full-size
- **Notes Input:** Optional notes field (used on rejection)
- **Action Buttons:** Side-by-side Reject (red outline) + Approve (green fill)
- Confirmation dialog before action
- Auto-navigates back to list after action

#### Clients Tab (Tab 3)

- **Search bar:** Search by name or phone
- **Filter tabs:** Horizontal scroll — All, Active, Overdue, Suspended (with counts)
- **Client list:** Cards with avatar (initials), name, plan, due date or status
- Colored left border per subscription status
- Tap to view client detail

#### Client Detail (Push screen)

- Customer info: name, phone, email, address
- Subscription info: plan, speed, price, status, dates
- Recent payments for this customer
- Connection status (MikroTik)

#### Profile Tab (Tab 4)

- Same as customer profile screen (shared component)

## Backend Changes Required

1. **Remove customer password login restriction:** In `auth_service.go`, remove the `ErrCustomerMustUseOTP` check so customers can login with phone + password
2. **Ensure customers have passwords:** Update user creation flow so customer accounts can have passwords set
3. **Rebrand:** Change any JNDS references in the backend to OMJI (if any exist in responses or configs)

## Non-Goals (Future)

- Push notifications (Expo Push Tokens)
- Dark mode implementation (toggle present but not wired)
- Forgot password flow (screen present but backend endpoint needed)
- Image upload to cloud storage (R2/S3)
- Real-time updates (WebSocket)
- Offline mode
