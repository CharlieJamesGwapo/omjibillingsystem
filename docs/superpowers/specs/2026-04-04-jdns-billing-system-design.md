# JDNS Billing System — Design Specification

**Date:** 2026-04-04
**Status:** Approved
**Version:** 1.0

## 1. Overview

JDNS Billing System is a complete WiFi subscription management platform for a Philippine ISP business. It enables customer self-service (view plan, pay bills), automated internet access control via MikroTik, and full admin management of users, plans, payments, and reports.

### 1.1 Deliverables

| Platform | Tech | Deployment | Users |
|----------|------|------------|-------|
| Admin Dashboard + Customer Portal | React (Vite) | Vercel | Admin, Technician, Customers |
| Customer Mobile App | React Native (Expo) | App Store / Play Store | Customers |
| Technician Mobile App | React Native (Expo) | App Store / Play Store | Technicians |
| Backend API | Go | Render | All platforms |
| Database | PostgreSQL | Neon | - |

### 1.2 Phased Delivery

- **Phase 1 (Simple Version):** User registration, due date tracking, manual payment upload, admin approval, MikroTik enable/disable, SMS reminders, web portal only
- **Phase 2:** React Native mobile apps (Customer + Technician), QR code payment flow, push notifications
- **Phase 3:** Wallet system, promo system, online payment integration (PayMongo/GCash API), live monitoring

---

## 2. Architecture

### 2.1 System Architecture

```
[React Web App - Vercel]  ──┐
[Customer RN App]           ├──→ [Go API Server - Render] ──→ [Neon PostgreSQL]
[Technician RN App]        ──┘         │
                                       ├──→ [MikroTik RouterOS API :8728]
                                       ├──→ [SMS Provider (pluggable)]
                                       └──→ [Firebase Cloud Messaging]
```

### 2.2 Go API Server (Monolith)

Single Go binary handling:
- REST API (HTTP handlers)
- JWT authentication (access + refresh tokens)
- MikroTik integration via `go-routeros` library
- Background cron jobs (goroutine-based)
- SMS sending (pluggable interface)
- Push notification dispatch (FCM)
- File upload handling (payment proof images)

### 2.3 MikroTik Integration

- **Connection:** RouterOS API (port 8728) over static public IP
- **Security:** Firewall rules whitelist only Render's outbound IPs
- **Dedicated API user** on MikroTik with limited permissions
- **Operations:**
  - Create simple queue on subscription creation (speed limit = plan speed)
  - Enable queue on payment approval (restore internet)
  - Disable queue on overdue + grace expired (cut internet)
  - Update queue on plan change
  - Queue naming: `jdns-{user_id}`

### 2.4 Background Jobs (Goroutines)

| Job | Schedule | Action |
|-----|----------|--------|
| Overdue check | Every midnight | Scan subscriptions past due + grace → disable MikroTik queue → update status to "suspended" |
| Payment reminder | Daily at 8 AM | SMS users due within 2 days |
| Auto-reconnect | Event-driven | On payment approval → enable MikroTik queue immediately |

---

## 3. Database Schema

### 3.1 Tables

#### users
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| phone | VARCHAR(20) | UNIQUE, required |
| full_name | VARCHAR(255) | required |
| email | VARCHAR(255) | nullable |
| address | TEXT | nullable |
| role | ENUM('admin','technician','customer') | required |
| password_hash | VARCHAR(255) | nullable, required for admin/technician |
| status | ENUM('active','inactive') | default 'active', account-level status (inactive = deactivated by admin) |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### plans
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | VARCHAR(100) | e.g., "10 Mbps Plan" |
| speed_mbps | INTEGER | |
| price | DECIMAL(10,2) | in PHP (Philippine Peso) |
| description | TEXT | nullable |
| is_active | BOOLEAN | default true |
| created_at | TIMESTAMPTZ | |

#### subscriptions
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| plan_id | UUID | FK → plans |
| ip_address | VARCHAR(45) | nullable |
| mac_address | VARCHAR(17) | nullable |
| billing_day | INTEGER | 1-28, day of month |
| next_due_date | DATE | |
| grace_days | INTEGER | default 2 |
| status | ENUM('active','overdue','suspended') | |
| mikrotik_queue_id | VARCHAR(100) | nullable, MikroTik internal ID |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### payments
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → users |
| subscription_id | UUID | FK → subscriptions |
| amount | DECIMAL(10,2) | |
| method | ENUM('gcash','maya','bank','cash') | |
| reference_number | VARCHAR(100) | nullable |
| proof_image_url | VARCHAR(500) | nullable |
| status | ENUM('pending','approved','rejected') | |
| approved_by | UUID | FK → users, nullable |
| billing_period_start | DATE | |
| billing_period_end | DATE | |
| notes | TEXT | nullable, rejection reason etc. |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

#### otp_codes
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| phone | VARCHAR(20) | |
| code | VARCHAR(6) | 6-digit code |
| expires_at | TIMESTAMPTZ | 5 minutes from creation |
| verified | BOOLEAN | default false |
| created_at | TIMESTAMPTZ | |

#### activity_logs
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user_id | UUID | FK → users, who performed the action |
| action | VARCHAR(100) | e.g., "payment.approved", "user.created" |
| target_type | VARCHAR(50) | e.g., "user", "payment", "subscription" |
| target_id | UUID | |
| details | JSONB | additional context |
| ip_address | VARCHAR(45) | |
| created_at | TIMESTAMPTZ | |

### 3.2 Indexes

- `users`: UNIQUE on `phone`, INDEX on `role`, INDEX on `status`
- `subscriptions`: INDEX on `user_id`, INDEX on `next_due_date`, INDEX on `status`
- `payments`: INDEX on `user_id`, INDEX on `status`, INDEX on `created_at`
- `otp_codes`: INDEX on `phone` + `expires_at`
- `activity_logs`: INDEX on `user_id`, INDEX on `created_at`

---

## 4. API Design

### 4.1 Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/otp/request` | POST | Send OTP to phone number |
| `/api/auth/otp/verify` | POST | Verify OTP, return JWT |
| `/api/auth/login` | POST | Admin/technician login (username+password) |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/logout` | POST | Invalidate refresh token |

JWT tokens: access token (15 min), refresh token (7 days).

### 4.2 Users

| Endpoint | Method | Roles |
|----------|--------|-------|
| `GET /api/users` | GET | Admin, Technician |
| `GET /api/users/:id` | GET | Admin, Technician, Own |
| `POST /api/users` | POST | Admin |
| `PUT /api/users/:id` | PUT | Admin |
| `DELETE /api/users/:id` | DELETE | Admin |

### 4.3 Plans

| Endpoint | Method | Roles |
|----------|--------|-------|
| `GET /api/plans` | GET | All authenticated |
| `POST /api/plans` | POST | Admin |
| `PUT /api/plans/:id` | PUT | Admin |
| `DELETE /api/plans/:id` | DELETE | Admin |

### 4.4 Subscriptions

| Endpoint | Method | Roles |
|----------|--------|-------|
| `GET /api/subscriptions` | GET | Admin, Technician |
| `GET /api/subscriptions/:id` | GET | Admin, Technician, Own |
| `POST /api/subscriptions` | POST | Admin |
| `PUT /api/subscriptions/:id` | PUT | Admin |
| `POST /api/subscriptions/:id/disconnect` | POST | Admin |
| `POST /api/subscriptions/:id/reconnect` | POST | Admin |

### 4.5 Payments

| Endpoint | Method | Roles |
|----------|--------|-------|
| `GET /api/payments` | GET | Admin, Technician |
| `GET /api/payments/mine` | GET | Customer |
| `POST /api/payments` | POST | Customer |
| `POST /api/payments/:id/approve` | POST | Admin, Technician |
| `POST /api/payments/:id/reject` | POST | Admin, Technician |

### 4.6 MikroTik

| Endpoint | Method | Roles |
|----------|--------|-------|
| `GET /api/mikrotik/status` | GET | Admin |
| `GET /api/mikrotik/active-connections` | GET | Admin, Technician |
| `POST /api/mikrotik/sync` | POST | Admin |

### 4.7 Reports & Dashboard

| Endpoint | Method | Roles |
|----------|--------|-------|
| `GET /api/dashboard/stats` | GET | Admin |
| `GET /api/reports/income` | GET | Admin |
| `GET /api/reports/unpaid` | GET | Admin, Technician |
| `GET /api/activity-logs` | GET | Admin |

### 4.8 Notifications

| Endpoint | Method | Roles |
|----------|--------|-------|
| `POST /api/notifications/send-reminders` | POST | Admin |
| `POST /api/notifications/register-device` | POST | All authenticated |

---

## 5. Roles & Permissions

### 5.1 Admin
- Full CRUD on users, plans, subscriptions
- Approve/reject payments
- MikroTik control (disconnect, reconnect, sync)
- View all reports, income, activity logs
- Manage staff (create technician accounts)
- System settings (grace period defaults, GCash number, QR code)
- Send SMS reminders manually

### 5.2 Technician
- View customer list and details (read-only)
- View subscriptions (read-only)
- Approve/reject payments
- View active connections
- View unpaid users list
- **Cannot:** create/delete users, manage plans, change settings, view activity logs, disconnect/reconnect users

### 5.3 Customer
- View own profile
- View own subscription (plan, status, due date)
- Submit payment (upload proof or enter reference number)
- View own payment history
- **Cannot:** access any other user's data

---

## 6. UI/UX Design

### 6.1 Design System

**Style:** Modern Dark Cinema + Financial Dashboard (UI/UX Pro Max)

**Color Palette:**
| Token | Value | Usage |
|-------|-------|-------|
| Primary | #1E3A5F | Navigation, headers |
| Secondary | #2563EB | Buttons, links, active states |
| Accent/Success | #059669 | Paid, active, approved |
| Warning | #F59E0B | Due soon, pending |
| Destructive | #DC2626 | Overdue, rejected, errors |
| BG Deep | #0a0a0f | Page background |
| BG Surface | #0d1b2a | Sidebar, nav |
| Card | #112240 | Card backgrounds |
| Border | rgba(255,255,255,0.08) | Subtle borders |
| Text Primary | #FFFFFF | Headings |
| Text Secondary | #888888 | Labels, muted |

**Typography:**
- Headings: Poppins (500-700 weight)
- Body: Open Sans (300-600 weight)
- Google Fonts import for web, bundled for React Native

**Component Tokens:**
- Border radius: 16px (cards), 10px (buttons), 8px (inputs)
- Shadows: Soft multi-layer, no hard edges
- Animation: 200-300ms ease, spring modals (damping: 20, stiffness: 90)
- Touch targets: Min 44px height
- Accessibility: WCAG AA+ contrast (4.5:1 minimum)

### 6.2 React Web — Admin Dashboard

**Layout:** Fixed sidebar (200px) + scrollable main content
- Sidebar navigation: Dashboard, Customers, Plans, Payments, Subscriptions, MikroTik, Reports, Staff, Activity Logs, Settings
- Top bar: Notification badge (pending payments count), admin name
- Responsive: Sidebar collapses to hamburger menu on tablet/mobile

**Dashboard page:**
- 4 stat cards: Total Customers, Active, Overdue, Monthly Income
- Pending payments list with one-click Approve/Reject
- "Due Soon" panel (next 3 days) with "Send Reminders to All" button

**Key pages:**
- Customer list: searchable table with status badges, click to view details
- Customer detail: subscription info, payment history, manual disconnect/reconnect
- Plan management: CRUD table
- Payment list: filterable by status (pending/approved/rejected), date range
- Reports: daily/monthly income charts, unpaid users list
- MikroTik: connection status, active connections list, force sync button
- Settings: grace period default, GCash number, QR code upload, SMS template

### 6.3 React Web — Customer Portal

**Layout:** Mobile-first, single column, no sidebar
- Login: Phone number → OTP verification
- Dashboard: Status card (plan, due date, days left), quick actions (Pay Now, History)
- Payment: Two tabs — Upload Proof (screenshot + method selector) / QR Code (QR display + reference number input)
- Payment History: List of past payments with status badges
- Also serves as the **walled garden page** (accessible even when internet is cut)

### 6.4 React Native — Customer App

**Navigation:** Bottom tab bar (Home, Pay, History, Profile)
- React Navigation with typed params
- Deep linking support
- Android back button handling

**Home tab:**
- Greeting with user name
- Glassmorphic status card (plan, fee, due date, days remaining)
- Quick action buttons (Pay Now, History, My Plan)
- Recent activity list

**Pay tab:**
- Amount due display
- Toggle tabs: QR Code / Upload Proof
- QR Code: displays GCash QR + number, reference number input
- Upload: camera/gallery picker, method dropdown
- Confirm button

**History tab:**
- Scrollable list of all payments
- Status badges (approved/pending/rejected)
- Pull-to-refresh

**Profile tab:**
- Name, phone, address
- Current plan details
- Logout

**Push notifications (FCM):**
- Payment approved/rejected
- Due date reminder (2 days before)
- Account suspended/restored

### 6.5 React Native — Technician App

**Navigation:** Bottom tab bar (Home, Customers, Payments, Status)

**Home tab:**
- Stats row: Active, Pending, Overdue counts
- Pending payments list with Approve/Reject buttons
- Overdue users summary with "View All" link

**Customers tab:**
- Searchable customer list
- Customer detail: subscription info, payment history (read-only)

**Payments tab:**
- All payments, filterable by status
- Tap to view proof image
- Approve/Reject actions

**Status tab:**
- Active connections from MikroTik
- Bandwidth usage per user (if available)

**Push notifications (FCM):**
- New payment submitted (needs review)
- High number of overdue users alert

---

## 7. Security

### 7.1 Authentication
- Customers: Phone + 6-digit OTP (5 min expiry, max 3 attempts)
- Admin/Technician: Username (phone) + password (bcrypt hashed)
- JWT access tokens: 15 min expiry, RS256 signed
- JWT refresh tokens: 7 days, stored server-side, revocable
- Rate limiting: 5 OTP requests per phone per hour

### 7.2 Authorization
- Middleware checks JWT on every protected route
- Role-based access control (RBAC) per endpoint
- Customers can only access their own data (ownership check)

### 7.3 Data Security
- HTTPS everywhere (Render + Vercel enforce this)
- MikroTik API connection over IP-whitelisted port
- Payment proof images stored in cloud storage (e.g., Cloudflare R2 or Render disk)
- No sensitive data in JWT payload (only user ID + role)
- Activity logging for all admin/technician actions

### 7.4 Input Validation
- Server-side validation on all inputs
- Phone number format validation (PH format)
- File upload: max 5MB, image types only (JPEG, PNG)
- SQL injection prevention via parameterized queries

---

## 8. SMS Integration

### 8.1 Pluggable Interface

```go
type SMSProvider interface {
    SendOTP(phone string, code string) error
    SendReminder(phone string, message string) error
}
```

Implementations can be swapped: Semaphore, Twilio, or any provider.

### 8.2 SMS Templates

- **OTP:** "Your JDNS verification code is {code}. Valid for 5 minutes."
- **Due Reminder:** "Hi {name}, your JDNS WiFi (₱{amount}) is due on {date}. Please pay to avoid disconnection."
- **Disconnection:** "Hi {name}, your JDNS WiFi has been disconnected due to non-payment. Pay now to restore: {portal_url}"
- **Payment Approved:** "Hi {name}, your payment of ₱{amount} has been confirmed. Thank you!"

---

## 9. File Storage

Payment proof images need cloud storage. Options ranked:
1. **Cloudflare R2** — free egress, S3-compatible, cheap (recommended)
2. **Render Disk** — simple but limited storage
3. **Supabase Storage** — free tier available

Images served via signed URLs (expire after 1 hour) for security.

---

## 10. Project Structure

```
billingsystem/
├── backend/                    # Go API
│   ├── cmd/server/main.go      # Entry point
│   ├── internal/
│   │   ├── auth/               # JWT, OTP logic
│   │   ├── handler/            # HTTP handlers
│   │   ├── middleware/         # Auth, RBAC, rate-limit
│   │   ├── model/              # Database models
│   │   ├── repository/         # Database queries
│   │   ├── service/            # Business logic
│   │   ├── mikrotik/           # RouterOS API client
│   │   ├── sms/                # SMS provider interface + impls
│   │   ├── cron/               # Background job scheduler
│   │   └── notification/       # FCM push notifications
│   ├── migrations/             # SQL migration files
│   ├── go.mod
│   └── go.sum
├── web/                        # React web app
│   ├── src/
│   │   ├── components/         # Shared UI components
│   │   ├── pages/
│   │   │   ├── admin/          # Admin dashboard pages
│   │   │   ├── customer/       # Customer portal pages
│   │   │   └── auth/           # Login, OTP pages
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API client
│   │   ├── store/              # State management
│   │   └── styles/             # Design tokens, global styles
│   ├── package.json
│   └── vite.config.ts
├── mobile/                     # React Native (Expo)
│   ├── apps/
│   │   ├── customer/           # Customer app entry
│   │   └── technician/         # Technician app entry
│   ├── packages/
│   │   └── shared/             # Shared components, hooks, API client
│   ├── src/
│   │   ├── components/         # Shared RN components
│   │   ├── screens/
│   │   │   ├── customer/       # Customer screens
│   │   │   └── technician/     # Technician screens
│   │   ├── navigation/         # React Navigation config
│   │   ├── services/           # API client, FCM
│   │   ├── hooks/              # Custom hooks
│   │   └── theme/              # Design tokens for RN
│   ├── app.json
│   └── package.json
├── docs/
│   └── superpowers/specs/      # This spec
└── jdns.jpeg                   # Logo
```

---

## 11. Tech Stack Summary

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend (Web) | React + Vite + TypeScript | Deployed on Vercel |
| Frontend (Mobile) | React Native + Expo + TypeScript | iOS + Android |
| Backend | Go 1.22+ | Deployed on Render |
| Database | PostgreSQL 16 | Hosted on Neon |
| Auth | JWT (RS256) + OTP | |
| MikroTik | go-routeros | RouterOS API client |
| SMS | Pluggable interface | Provider TBD |
| Push Notifications | Firebase Cloud Messaging | iOS + Android |
| File Storage | Cloudflare R2 | Payment proof images |
| CSS Framework (Web) | Tailwind CSS | Dark theme |
| Navigation (Mobile) | React Navigation v6 | Type-safe |
| State (Web) | Zustand or React Query | Lightweight |
| HTTP Client | Axios | Shared across web + mobile |

---

## 12. Deployment

| Service | Platform | URL Pattern |
|---------|----------|-------------|
| Go API | Render (Web Service) | `api.jdns.ph` or `jdns-api.onrender.com` |
| React Web | Vercel | `app.jdns.ph` or `jdns.vercel.app` |
| PostgreSQL | Neon | Connection string in env |
| Customer App | App Store + Play Store | - |
| Technician App | App Store + Play Store | - |

### 12.1 Environment Variables (Backend)

```
DATABASE_URL=postgresql://...@neon.tech/jdns
JWT_SECRET=...
JWT_REFRESH_SECRET=...
MIKROTIK_HOST=<public-ip>
MIKROTIK_PORT=8728
MIKROTIK_USER=jdns-api
MIKROTIK_PASSWORD=...
SMS_PROVIDER=semaphore
SMS_API_KEY=...
FCM_SERVICE_ACCOUNT=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_BUCKET=jdns-payments
CORS_ORIGINS=https://app.jdns.ph
```

---

## 13. Non-Functional Requirements

- **Response time:** API < 200ms for standard queries
- **Availability:** Render auto-restarts on crash, Neon handles DB failover
- **Scalability:** Single Go instance handles 500+ concurrent users easily
- **Mobile:** Support iOS 15+ and Android 10+
- **Browsers:** Chrome, Safari, Firefox (latest 2 versions)
- **Image uploads:** Max 5MB per file
