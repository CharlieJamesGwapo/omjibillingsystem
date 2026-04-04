# JDNS Billing System — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working WiFi billing system with Go backend, React admin dashboard, customer portal, MikroTik integration, and SMS reminders.

**Architecture:** Monolith Go API (Render) serving a React SPA (Vercel), connected to Neon PostgreSQL. MikroTik RouterOS API for internet access control. Pluggable SMS interface for notifications.

**Tech Stack:** Go 1.22+, PostgreSQL (Neon), React + Vite + TypeScript + Tailwind CSS, go-routeros, JWT (RS256), bcrypt, Cloudflare R2

**Spec:** `docs/superpowers/specs/2026-04-04-jdns-billing-system-design.md`

---

## File Structure

```
billingsystem/
├── backend/
│   ├── cmd/server/main.go                    # Entry point, server startup, route registration
│   ├── internal/
│   │   ├── config/config.go                  # Env var loading, config struct
│   │   ├── database/database.go              # PostgreSQL connection pool
│   │   ├── model/
│   │   │   ├── user.go                       # User struct + enums
│   │   │   ├── plan.go                       # Plan struct
│   │   │   ├── subscription.go               # Subscription struct + enums
│   │   │   ├── payment.go                    # Payment struct + enums
│   │   │   ├── otp.go                        # OTP struct
│   │   │   └── activity_log.go               # ActivityLog struct
│   │   ├── repository/
│   │   │   ├── user_repo.go                  # User CRUD queries
│   │   │   ├── plan_repo.go                  # Plan CRUD queries
│   │   │   ├── subscription_repo.go          # Subscription CRUD queries
│   │   │   ├── payment_repo.go               # Payment CRUD queries
│   │   │   ├── otp_repo.go                   # OTP create/verify queries
│   │   │   ├── activity_log_repo.go          # Activity log insert/list queries
│   │   │   └── dashboard_repo.go             # Dashboard stats queries
│   │   ├── service/
│   │   │   ├── auth_service.go               # JWT generation, OTP logic, password verify
│   │   │   ├── user_service.go               # User business logic
│   │   │   ├── plan_service.go               # Plan business logic
│   │   │   ├── subscription_service.go       # Subscription + MikroTik orchestration
│   │   │   ├── payment_service.go            # Payment approval + auto-reconnect
│   │   │   └── dashboard_service.go          # Dashboard aggregation
│   │   ├── handler/
│   │   │   ├── auth_handler.go               # Auth endpoints
│   │   │   ├── user_handler.go               # User endpoints
│   │   │   ├── plan_handler.go               # Plan endpoints
│   │   │   ├── subscription_handler.go       # Subscription endpoints
│   │   │   ├── payment_handler.go            # Payment endpoints
│   │   │   ├── mikrotik_handler.go           # MikroTik status endpoints
│   │   │   ├── dashboard_handler.go          # Dashboard + reports endpoints
│   │   │   └── notification_handler.go       # SMS reminder endpoints
│   │   ├── middleware/
│   │   │   ├── auth.go                       # JWT validation middleware
│   │   │   ├── rbac.go                       # Role-based access control
│   │   │   └── ratelimit.go                  # Rate limiting
│   │   ├── mikrotik/
│   │   │   └── client.go                     # RouterOS API wrapper
│   │   ├── sms/
│   │   │   ├── provider.go                   # SMSProvider interface
│   │   │   ├── mock.go                       # Mock impl for dev/testing
│   │   │   └── semaphore.go                  # Semaphore impl (example)
│   │   ├── storage/
│   │   │   └── r2.go                         # Cloudflare R2 file upload
│   │   ├── cron/
│   │   │   └── scheduler.go                  # Background jobs: overdue check, reminders
│   │   └── router/
│   │       └── router.go                     # Route definitions + middleware wiring
│   ├── migrations/
│   │   ├── 001_create_users.sql
│   │   ├── 002_create_plans.sql
│   │   ├── 003_create_subscriptions.sql
│   │   ├── 004_create_payments.sql
│   │   ├── 005_create_otp_codes.sql
│   │   └── 006_create_activity_logs.sql
│   ├── go.mod
│   └── go.sum
├── web/
│   ├── src/
│   │   ├── main.tsx                          # React entry
│   │   ├── App.tsx                           # Router setup
│   │   ├── lib/
│   │   │   ├── api.ts                        # Axios instance + interceptors
│   │   │   ├── auth.ts                       # Token storage, refresh logic
│   │   │   └── types.ts                      # TypeScript interfaces matching Go models
│   │   ├── components/
│   │   │   ├── Layout.tsx                    # Admin sidebar layout
│   │   │   ├── CustomerLayout.tsx            # Customer single-column layout
│   │   │   ├── ProtectedRoute.tsx            # Auth guard + role check
│   │   │   ├── StatCard.tsx                  # Dashboard stat card
│   │   │   ├── StatusBadge.tsx               # Status badge component
│   │   │   ├── PaymentCard.tsx               # Payment item with approve/reject
│   │   │   └── DataTable.tsx                 # Reusable sortable/searchable table
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── AdminLogin.tsx            # Admin/tech login form
│   │   │   │   ├── CustomerLogin.tsx         # Phone + OTP login
│   │   │   │   └── OTPVerify.tsx             # OTP input screen
│   │   │   ├── admin/
│   │   │   │   ├── Dashboard.tsx             # Stats + pending payments + due soon
│   │   │   │   ├── Customers.tsx             # Customer list table
│   │   │   │   ├── CustomerDetail.tsx        # Single customer view
│   │   │   │   ├── Plans.tsx                 # Plan CRUD table
│   │   │   │   ├── Payments.tsx              # Payment list with filters
│   │   │   │   ├── Subscriptions.tsx         # Subscription list
│   │   │   │   ├── MikroTik.tsx              # MikroTik status + connections
│   │   │   │   ├── Reports.tsx               # Income reports
│   │   │   │   ├── Staff.tsx                 # Staff management
│   │   │   │   ├── ActivityLogs.tsx          # Activity log viewer
│   │   │   │   └── Settings.tsx              # System settings
│   │   │   └── customer/
│   │   │       ├── Home.tsx                  # Status card + quick actions
│   │   │       ├── Pay.tsx                   # Payment form (upload + QR)
│   │   │       └── History.tsx               # Payment history list
│   │   └── styles/
│   │       └── globals.css                   # Tailwind + design tokens
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── docs/
└── jdns.jpeg
```

---

## Task 1: Go Project Scaffolding + Config

**Files:**
- Create: `backend/go.mod`
- Create: `backend/cmd/server/main.go`
- Create: `backend/internal/config/config.go`

- [ ] **Step 1: Initialize Go module**

```bash
cd /Users/dev3/billingsystem && mkdir -p backend/cmd/server backend/internal/config
cd backend && go mod init github.com/jdns/billingsystem
```

- [ ] **Step 2: Create config loader**

Create `backend/internal/config/config.go`:

```go
package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port            string
	DatabaseURL     string
	JWTSecret       string
	JWTRefreshSecret string
	MikroTikHost    string
	MikroTikPort    int
	MikroTikUser    string
	MikroTikPass    string
	SMSProvider     string
	SMSAPIKey       string
	R2AccountID     string
	R2AccessKey     string
	R2SecretKey     string
	R2Bucket        string
	CORSOrigins     string
}

func Load() (*Config, error) {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}

	mtPort, _ := strconv.Atoi(os.Getenv("MIKROTIK_PORT"))
	if mtPort == 0 {
		mtPort = 8728
	}

	return &Config{
		Port:             port,
		DatabaseURL:      dbURL,
		JWTSecret:        os.Getenv("JWT_SECRET"),
		JWTRefreshSecret: os.Getenv("JWT_REFRESH_SECRET"),
		MikroTikHost:     os.Getenv("MIKROTIK_HOST"),
		MikroTikPort:     mtPort,
		MikroTikUser:     os.Getenv("MIKROTIK_USER"),
		MikroTikPass:     os.Getenv("MIKROTIK_PASSWORD"),
		SMSProvider:      os.Getenv("SMS_PROVIDER"),
		SMSAPIKey:        os.Getenv("SMS_API_KEY"),
		R2AccountID:      os.Getenv("R2_ACCOUNT_ID"),
		R2AccessKey:      os.Getenv("R2_ACCESS_KEY"),
		R2SecretKey:      os.Getenv("R2_SECRET_KEY"),
		R2Bucket:         os.Getenv("R2_BUCKET"),
		CORSOrigins:      os.Getenv("CORS_ORIGINS"),
	}, nil
}
```

- [ ] **Step 3: Create minimal main.go**

Create `backend/cmd/server/main.go`:

```go
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/jdns/billingsystem/internal/config"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok"}`)
	})

	addr := ":" + cfg.Port
	log.Printf("JDNS Billing API starting on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
		os.Exit(1)
	}
}
```

- [ ] **Step 4: Verify it compiles**

```bash
cd /Users/dev3/billingsystem/backend && go build ./cmd/server/
```

Expected: no errors, binary created.

- [ ] **Step 5: Commit**

```bash
cd /Users/dev3/billingsystem
git add backend/
git commit -m "feat: scaffold Go project with config and health endpoint"
```

---

## Task 2: Database Connection + Migrations

**Files:**
- Create: `backend/internal/database/database.go`
- Create: `backend/migrations/001_create_users.sql`
- Create: `backend/migrations/002_create_plans.sql`
- Create: `backend/migrations/003_create_subscriptions.sql`
- Create: `backend/migrations/004_create_payments.sql`
- Create: `backend/migrations/005_create_otp_codes.sql`
- Create: `backend/migrations/006_create_activity_logs.sql`

- [ ] **Step 1: Install pgx driver**

```bash
cd /Users/dev3/billingsystem/backend
go get github.com/jackc/pgx/v5
go get github.com/jackc/pgx/v5/pgxpool
```

- [ ] **Step 2: Create database connection**

Create `backend/internal/database/database.go`:

```go
package database

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func Connect(databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database URL: %w", err)
	}

	config.MaxConns = 20
	config.MinConns = 2
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 5 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return pool, nil
}

func RunMigrations(pool *pgxpool.Pool, migrationsDir string) error {
	ctx := context.Background()

	// Create migrations tracking table
	_, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			applied_at TIMESTAMPTZ DEFAULT NOW()
		)
	`)
	if err != nil {
		return fmt.Errorf("create migrations table: %w", err)
	}

	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".sql" {
			continue
		}

		// Extract version number from filename like "001_create_users.sql"
		var version int
		fmt.Sscanf(entry.Name(), "%d_", &version)

		// Check if already applied
		var exists bool
		err := pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = $1)", version).Scan(&exists)
		if err != nil {
			return fmt.Errorf("check migration %d: %w", version, err)
		}
		if exists {
			continue
		}

		sql, err := os.ReadFile(filepath.Join(migrationsDir, entry.Name()))
		if err != nil {
			return fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}

		_, err = pool.Exec(ctx, string(sql))
		if err != nil {
			return fmt.Errorf("execute migration %s: %w", entry.Name(), err)
		}

		_, err = pool.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", version)
		if err != nil {
			return fmt.Errorf("record migration %d: %w", version, err)
		}

		log.Printf("Applied migration: %s", entry.Name())
	}

	return nil
}
```

Add imports at top: `"log"`, `"os"`, `"path/filepath"`.

- [ ] **Step 3: Create migration 001_create_users.sql**

Create `backend/migrations/001_create_users.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('admin', 'technician', 'customer');
CREATE TYPE user_status AS ENUM ('active', 'inactive');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    role user_role NOT NULL DEFAULT 'customer',
    password_hash VARCHAR(255),
    status user_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
```

- [ ] **Step 4: Create migration 002_create_plans.sql**

Create `backend/migrations/002_create_plans.sql`:

```sql
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    speed_mbps INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 5: Create migration 003_create_subscriptions.sql**

Create `backend/migrations/003_create_subscriptions.sql`:

```sql
CREATE TYPE subscription_status AS ENUM ('active', 'overdue', 'suspended');

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    ip_address VARCHAR(45),
    mac_address VARCHAR(17),
    billing_day INTEGER NOT NULL CHECK (billing_day >= 1 AND billing_day <= 28),
    next_due_date DATE NOT NULL,
    grace_days INTEGER NOT NULL DEFAULT 2,
    status subscription_status NOT NULL DEFAULT 'active',
    mikrotik_queue_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_next_due_date ON subscriptions(next_due_date);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

- [ ] **Step 6: Create migration 004_create_payments.sql**

Create `backend/migrations/004_create_payments.sql`:

```sql
CREATE TYPE payment_method AS ENUM ('gcash', 'maya', 'bank', 'cash');
CREATE TYPE payment_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    amount DECIMAL(10,2) NOT NULL,
    method payment_method NOT NULL,
    reference_number VARCHAR(100),
    proof_image_url VARCHAR(500),
    status payment_status NOT NULL DEFAULT 'pending',
    approved_by UUID REFERENCES users(id),
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);
```

- [ ] **Step 7: Create migration 005_create_otp_codes.sql**

Create `backend/migrations/005_create_otp_codes.sql`:

```sql
CREATE TABLE otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_codes_phone_expires ON otp_codes(phone, expires_at);
```

- [ ] **Step 8: Create migration 006_create_activity_logs.sql**

Create `backend/migrations/006_create_activity_logs.sql`:

```sql
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id UUID NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
```

- [ ] **Step 9: Wire database into main.go**

Update `backend/cmd/server/main.go` — add database connection and migration run after config load:

```go
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/jdns/billingsystem/internal/config"
	"github.com/jdns/billingsystem/internal/database"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	pool, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()
	log.Println("Connected to database")

	// Run migrations
	execPath, _ := os.Executable()
	migrationsDir := filepath.Join(filepath.Dir(execPath), "migrations")
	// Fallback for dev: check relative to working directory
	if _, err := os.Stat(migrationsDir); os.IsNotExist(err) {
		migrationsDir = "migrations"
	}
	if err := database.RunMigrations(pool, migrationsDir); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok"}`)
	})

	addr := ":" + cfg.Port
	log.Printf("JDNS Billing API starting on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
		os.Exit(1)
	}
}
```

- [ ] **Step 10: Verify it compiles**

```bash
cd /Users/dev3/billingsystem/backend && go mod tidy && go build ./cmd/server/
```

Expected: no errors.

- [ ] **Step 11: Commit**

```bash
cd /Users/dev3/billingsystem
git add backend/
git commit -m "feat: add database connection, migrations for all 6 tables"
```

---

## Task 3: Models

**Files:**
- Create: `backend/internal/model/user.go`
- Create: `backend/internal/model/plan.go`
- Create: `backend/internal/model/subscription.go`
- Create: `backend/internal/model/payment.go`
- Create: `backend/internal/model/otp.go`
- Create: `backend/internal/model/activity_log.go`

- [ ] **Step 1: Create User model**

Create `backend/internal/model/user.go`:

```go
package model

import (
	"time"

	"github.com/google/uuid"
)

type UserRole string

const (
	RoleAdmin      UserRole = "admin"
	RoleTechnician UserRole = "technician"
	RoleCustomer   UserRole = "customer"
)

type UserStatus string

const (
	UserStatusActive   UserStatus = "active"
	UserStatusInactive UserStatus = "inactive"
)

type User struct {
	ID           uuid.UUID  `json:"id"`
	Phone        string     `json:"phone"`
	FullName     string     `json:"full_name"`
	Email        *string    `json:"email,omitempty"`
	Address      *string    `json:"address,omitempty"`
	Role         UserRole   `json:"role"`
	PasswordHash *string    `json:"-"`
	Status       UserStatus `json:"status"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type CreateUserRequest struct {
	Phone    string   `json:"phone"`
	FullName string   `json:"full_name"`
	Email    *string  `json:"email,omitempty"`
	Address  *string  `json:"address,omitempty"`
	Role     UserRole `json:"role"`
	Password *string  `json:"password,omitempty"` // Required for admin/technician
	PlanID   *string  `json:"plan_id,omitempty"`  // Optional: create subscription too
}

type UpdateUserRequest struct {
	FullName *string     `json:"full_name,omitempty"`
	Email    *string     `json:"email,omitempty"`
	Address  *string     `json:"address,omitempty"`
	Status   *UserStatus `json:"status,omitempty"`
}
```

- [ ] **Step 2: Create Plan model**

Create `backend/internal/model/plan.go`:

```go
package model

import (
	"time"

	"github.com/google/uuid"
)

type Plan struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	SpeedMbps   int       `json:"speed_mbps"`
	Price       float64   `json:"price"`
	Description *string   `json:"description,omitempty"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
}

type CreatePlanRequest struct {
	Name        string  `json:"name"`
	SpeedMbps   int     `json:"speed_mbps"`
	Price       float64 `json:"price"`
	Description *string `json:"description,omitempty"`
}

type UpdatePlanRequest struct {
	Name        *string  `json:"name,omitempty"`
	SpeedMbps   *int     `json:"speed_mbps,omitempty"`
	Price       *float64 `json:"price,omitempty"`
	Description *string  `json:"description,omitempty"`
	IsActive    *bool    `json:"is_active,omitempty"`
}
```

- [ ] **Step 3: Create Subscription model**

Create `backend/internal/model/subscription.go`:

```go
package model

import (
	"time"

	"github.com/google/uuid"
)

type SubscriptionStatus string

const (
	SubStatusActive    SubscriptionStatus = "active"
	SubStatusOverdue   SubscriptionStatus = "overdue"
	SubStatusSuspended SubscriptionStatus = "suspended"
)

type Subscription struct {
	ID              uuid.UUID          `json:"id"`
	UserID          uuid.UUID          `json:"user_id"`
	PlanID          uuid.UUID          `json:"plan_id"`
	IPAddress       *string            `json:"ip_address,omitempty"`
	MACAddress      *string            `json:"mac_address,omitempty"`
	BillingDay      int                `json:"billing_day"`
	NextDueDate     time.Time          `json:"next_due_date"`
	GraceDays       int                `json:"grace_days"`
	Status          SubscriptionStatus `json:"status"`
	MikroTikQueueID *string            `json:"mikrotik_queue_id,omitempty"`
	CreatedAt       time.Time          `json:"created_at"`
	UpdatedAt       time.Time          `json:"updated_at"`
	// Joined fields
	UserName  string  `json:"user_name,omitempty"`
	UserPhone string  `json:"user_phone,omitempty"`
	PlanName  string  `json:"plan_name,omitempty"`
	PlanSpeed int     `json:"plan_speed,omitempty"`
	PlanPrice float64 `json:"plan_price,omitempty"`
}

type CreateSubscriptionRequest struct {
	UserID     uuid.UUID `json:"user_id"`
	PlanID     uuid.UUID `json:"plan_id"`
	IPAddress  *string   `json:"ip_address,omitempty"`
	MACAddress *string   `json:"mac_address,omitempty"`
	GraceDays  *int      `json:"grace_days,omitempty"` // Default 2
}

type UpdateSubscriptionRequest struct {
	PlanID     *uuid.UUID `json:"plan_id,omitempty"`
	IPAddress  *string    `json:"ip_address,omitempty"`
	MACAddress *string    `json:"mac_address,omitempty"`
	GraceDays  *int       `json:"grace_days,omitempty"`
}
```

- [ ] **Step 4: Create Payment model**

Create `backend/internal/model/payment.go`:

```go
package model

import (
	"time"

	"github.com/google/uuid"
)

type PaymentMethod string

const (
	PaymentGCash PaymentMethod = "gcash"
	PaymentMaya  PaymentMethod = "maya"
	PaymentBank  PaymentMethod = "bank"
	PaymentCash  PaymentMethod = "cash"
)

type PaymentStatus string

const (
	PaymentPending  PaymentStatus = "pending"
	PaymentApproved PaymentStatus = "approved"
	PaymentRejected PaymentStatus = "rejected"
)

type Payment struct {
	ID                 uuid.UUID     `json:"id"`
	UserID             uuid.UUID     `json:"user_id"`
	SubscriptionID     uuid.UUID     `json:"subscription_id"`
	Amount             float64       `json:"amount"`
	Method             PaymentMethod `json:"method"`
	ReferenceNumber    *string       `json:"reference_number,omitempty"`
	ProofImageURL      *string       `json:"proof_image_url,omitempty"`
	Status             PaymentStatus `json:"status"`
	ApprovedBy         *uuid.UUID    `json:"approved_by,omitempty"`
	BillingPeriodStart time.Time     `json:"billing_period_start"`
	BillingPeriodEnd   time.Time     `json:"billing_period_end"`
	Notes              *string       `json:"notes,omitempty"`
	CreatedAt          time.Time     `json:"created_at"`
	UpdatedAt          time.Time     `json:"updated_at"`
	// Joined fields
	UserName     string `json:"user_name,omitempty"`
	UserPhone    string `json:"user_phone,omitempty"`
	ApproverName string `json:"approver_name,omitempty"`
}

type CreatePaymentRequest struct {
	Method          PaymentMethod `json:"method"`
	ReferenceNumber *string       `json:"reference_number,omitempty"`
	// ProofImageURL set by server after upload
}

type ApproveRejectRequest struct {
	Notes *string `json:"notes,omitempty"`
}
```

- [ ] **Step 5: Create OTP model**

Create `backend/internal/model/otp.go`:

```go
package model

import (
	"time"

	"github.com/google/uuid"
)

type OTP struct {
	ID        uuid.UUID `json:"id"`
	Phone     string    `json:"phone"`
	Code      string    `json:"-"`
	ExpiresAt time.Time `json:"expires_at"`
	Verified  bool      `json:"verified"`
	CreatedAt time.Time `json:"created_at"`
}

type OTPRequest struct {
	Phone string `json:"phone"`
}

type OTPVerifyRequest struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}
```

- [ ] **Step 6: Create ActivityLog model**

Create `backend/internal/model/activity_log.go`:

```go
package model

import (
	"time"

	"github.com/google/uuid"
)

type ActivityLog struct {
	ID         uuid.UUID              `json:"id"`
	UserID     uuid.UUID              `json:"user_id"`
	Action     string                 `json:"action"`
	TargetType string                 `json:"target_type"`
	TargetID   uuid.UUID              `json:"target_id"`
	Details    map[string]interface{} `json:"details,omitempty"`
	IPAddress  string                 `json:"ip_address"`
	CreatedAt  time.Time              `json:"created_at"`
	// Joined
	UserName string `json:"user_name,omitempty"`
}
```

- [ ] **Step 7: Install uuid dependency and verify**

```bash
cd /Users/dev3/billingsystem/backend
go get github.com/google/uuid
go build ./...
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd /Users/dev3/billingsystem
git add backend/
git commit -m "feat: add all database models with request/response types"
```

---

## Task 4: Repositories (Database Queries)

**Files:**
- Create: `backend/internal/repository/user_repo.go`
- Create: `backend/internal/repository/plan_repo.go`
- Create: `backend/internal/repository/subscription_repo.go`
- Create: `backend/internal/repository/payment_repo.go`
- Create: `backend/internal/repository/otp_repo.go`
- Create: `backend/internal/repository/activity_log_repo.go`
- Create: `backend/internal/repository/dashboard_repo.go`

- [ ] **Step 1: Create User repository**

Create `backend/internal/repository/user_repo.go`:

```go
package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jdns/billingsystem/internal/model"
)

type UserRepo struct {
	pool *pgxpool.Pool
}

func NewUserRepo(pool *pgxpool.Pool) *UserRepo {
	return &UserRepo{pool: pool}
}

func (r *UserRepo) Create(ctx context.Context, user *model.User) error {
	query := `
		INSERT INTO users (phone, full_name, email, address, role, password_hash, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		user.Phone, user.FullName, user.Email, user.Address,
		user.Role, user.PasswordHash, user.Status,
	).Scan(&user.ID, &user.CreatedAt, &user.UpdatedAt)
}

func (r *UserRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	user := &model.User{}
	query := `SELECT id, phone, full_name, email, address, role, password_hash, status, created_at, updated_at
		FROM users WHERE id = $1`
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&user.ID, &user.Phone, &user.FullName, &user.Email, &user.Address,
		&user.Role, &user.PasswordHash, &user.Status, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	return user, nil
}

func (r *UserRepo) GetByPhone(ctx context.Context, phone string) (*model.User, error) {
	user := &model.User{}
	query := `SELECT id, phone, full_name, email, address, role, password_hash, status, created_at, updated_at
		FROM users WHERE phone = $1`
	err := r.pool.QueryRow(ctx, query, phone).Scan(
		&user.ID, &user.Phone, &user.FullName, &user.Email, &user.Address,
		&user.Role, &user.PasswordHash, &user.Status, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get user by phone: %w", err)
	}
	return user, nil
}

func (r *UserRepo) List(ctx context.Context, role *model.UserRole) ([]model.User, error) {
	query := `SELECT id, phone, full_name, email, address, role, status, created_at, updated_at
		FROM users`
	args := []interface{}{}
	if role != nil {
		query += " WHERE role = $1"
		args = append(args, *role)
	}
	query += " ORDER BY created_at DESC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.ID, &u.Phone, &u.FullName, &u.Email, &u.Address,
			&u.Role, &u.Status, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, u)
	}
	return users, nil
}

func (r *UserRepo) Update(ctx context.Context, id uuid.UUID, req *model.UpdateUserRequest) error {
	query := `UPDATE users SET updated_at = NOW()`
	args := []interface{}{}
	argIdx := 1

	if req.FullName != nil {
		query += fmt.Sprintf(", full_name = $%d", argIdx)
		args = append(args, *req.FullName)
		argIdx++
	}
	if req.Email != nil {
		query += fmt.Sprintf(", email = $%d", argIdx)
		args = append(args, *req.Email)
		argIdx++
	}
	if req.Address != nil {
		query += fmt.Sprintf(", address = $%d", argIdx)
		args = append(args, *req.Address)
		argIdx++
	}
	if req.Status != nil {
		query += fmt.Sprintf(", status = $%d", argIdx)
		args = append(args, *req.Status)
		argIdx++
	}

	query += fmt.Sprintf(" WHERE id = $%d", argIdx)
	args = append(args, id)

	_, err := r.pool.Exec(ctx, query, args...)
	return err
}

func (r *UserRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM users WHERE id = $1", id)
	return err
}
```

- [ ] **Step 2: Create Plan repository**

Create `backend/internal/repository/plan_repo.go`:

```go
package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jdns/billingsystem/internal/model"
)

type PlanRepo struct {
	pool *pgxpool.Pool
}

func NewPlanRepo(pool *pgxpool.Pool) *PlanRepo {
	return &PlanRepo{pool: pool}
}

func (r *PlanRepo) Create(ctx context.Context, plan *model.Plan) error {
	query := `INSERT INTO plans (name, speed_mbps, price, description)
		VALUES ($1, $2, $3, $4) RETURNING id, is_active, created_at`
	return r.pool.QueryRow(ctx, query,
		plan.Name, plan.SpeedMbps, plan.Price, plan.Description,
	).Scan(&plan.ID, &plan.IsActive, &plan.CreatedAt)
}

func (r *PlanRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Plan, error) {
	plan := &model.Plan{}
	query := `SELECT id, name, speed_mbps, price, description, is_active, created_at
		FROM plans WHERE id = $1`
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&plan.ID, &plan.Name, &plan.SpeedMbps, &plan.Price,
		&plan.Description, &plan.IsActive, &plan.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get plan: %w", err)
	}
	return plan, nil
}

func (r *PlanRepo) List(ctx context.Context, activeOnly bool) ([]model.Plan, error) {
	query := `SELECT id, name, speed_mbps, price, description, is_active, created_at FROM plans`
	if activeOnly {
		query += " WHERE is_active = true"
	}
	query += " ORDER BY price ASC"

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list plans: %w", err)
	}
	defer rows.Close()

	var plans []model.Plan
	for rows.Next() {
		var p model.Plan
		if err := rows.Scan(&p.ID, &p.Name, &p.SpeedMbps, &p.Price,
			&p.Description, &p.IsActive, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan plan: %w", err)
		}
		plans = append(plans, p)
	}
	return plans, nil
}

func (r *PlanRepo) Update(ctx context.Context, id uuid.UUID, req *model.UpdatePlanRequest) error {
	query := `UPDATE plans SET id = id`
	args := []interface{}{}
	argIdx := 1

	if req.Name != nil {
		query += fmt.Sprintf(", name = $%d", argIdx)
		args = append(args, *req.Name)
		argIdx++
	}
	if req.SpeedMbps != nil {
		query += fmt.Sprintf(", speed_mbps = $%d", argIdx)
		args = append(args, *req.SpeedMbps)
		argIdx++
	}
	if req.Price != nil {
		query += fmt.Sprintf(", price = $%d", argIdx)
		args = append(args, *req.Price)
		argIdx++
	}
	if req.Description != nil {
		query += fmt.Sprintf(", description = $%d", argIdx)
		args = append(args, *req.Description)
		argIdx++
	}
	if req.IsActive != nil {
		query += fmt.Sprintf(", is_active = $%d", argIdx)
		args = append(args, *req.IsActive)
		argIdx++
	}

	query += fmt.Sprintf(" WHERE id = $%d", argIdx)
	args = append(args, id)

	_, err := r.pool.Exec(ctx, query, args...)
	return err
}

func (r *PlanRepo) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx, "DELETE FROM plans WHERE id = $1", id)
	return err
}
```

- [ ] **Step 3: Create Subscription repository**

Create `backend/internal/repository/subscription_repo.go`:

```go
package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jdns/billingsystem/internal/model"
)

type SubscriptionRepo struct {
	pool *pgxpool.Pool
}

func NewSubscriptionRepo(pool *pgxpool.Pool) *SubscriptionRepo {
	return &SubscriptionRepo{pool: pool}
}

func (r *SubscriptionRepo) Create(ctx context.Context, sub *model.Subscription) error {
	query := `INSERT INTO subscriptions (user_id, plan_id, ip_address, mac_address, billing_day, next_due_date, grace_days, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		sub.UserID, sub.PlanID, sub.IPAddress, sub.MACAddress,
		sub.BillingDay, sub.NextDueDate, sub.GraceDays, sub.Status,
	).Scan(&sub.ID, &sub.CreatedAt, &sub.UpdatedAt)
}

func (r *SubscriptionRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Subscription, error) {
	sub := &model.Subscription{}
	query := `SELECT s.id, s.user_id, s.plan_id, s.ip_address, s.mac_address,
		s.billing_day, s.next_due_date, s.grace_days, s.status, s.mikrotik_queue_id,
		s.created_at, s.updated_at,
		u.full_name, u.phone, p.name, p.speed_mbps, p.price
		FROM subscriptions s
		JOIN users u ON s.user_id = u.id
		JOIN plans p ON s.plan_id = p.id
		WHERE s.id = $1`
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&sub.ID, &sub.UserID, &sub.PlanID, &sub.IPAddress, &sub.MACAddress,
		&sub.BillingDay, &sub.NextDueDate, &sub.GraceDays, &sub.Status, &sub.MikroTikQueueID,
		&sub.CreatedAt, &sub.UpdatedAt,
		&sub.UserName, &sub.UserPhone, &sub.PlanName, &sub.PlanSpeed, &sub.PlanPrice,
	)
	if err != nil {
		return nil, fmt.Errorf("get subscription: %w", err)
	}
	return sub, nil
}

func (r *SubscriptionRepo) GetByUserID(ctx context.Context, userID uuid.UUID) (*model.Subscription, error) {
	sub := &model.Subscription{}
	query := `SELECT s.id, s.user_id, s.plan_id, s.ip_address, s.mac_address,
		s.billing_day, s.next_due_date, s.grace_days, s.status, s.mikrotik_queue_id,
		s.created_at, s.updated_at,
		u.full_name, u.phone, p.name, p.speed_mbps, p.price
		FROM subscriptions s
		JOIN users u ON s.user_id = u.id
		JOIN plans p ON s.plan_id = p.id
		WHERE s.user_id = $1
		ORDER BY s.created_at DESC LIMIT 1`
	err := r.pool.QueryRow(ctx, query, userID).Scan(
		&sub.ID, &sub.UserID, &sub.PlanID, &sub.IPAddress, &sub.MACAddress,
		&sub.BillingDay, &sub.NextDueDate, &sub.GraceDays, &sub.Status, &sub.MikroTikQueueID,
		&sub.CreatedAt, &sub.UpdatedAt,
		&sub.UserName, &sub.UserPhone, &sub.PlanName, &sub.PlanSpeed, &sub.PlanPrice,
	)
	if err != nil {
		return nil, fmt.Errorf("get subscription by user: %w", err)
	}
	return sub, nil
}

func (r *SubscriptionRepo) List(ctx context.Context) ([]model.Subscription, error) {
	query := `SELECT s.id, s.user_id, s.plan_id, s.ip_address, s.mac_address,
		s.billing_day, s.next_due_date, s.grace_days, s.status, s.mikrotik_queue_id,
		s.created_at, s.updated_at,
		u.full_name, u.phone, p.name, p.speed_mbps, p.price
		FROM subscriptions s
		JOIN users u ON s.user_id = u.id
		JOIN plans p ON s.plan_id = p.id
		ORDER BY s.created_at DESC`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list subscriptions: %w", err)
	}
	defer rows.Close()

	var subs []model.Subscription
	for rows.Next() {
		var s model.Subscription
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.PlanID, &s.IPAddress, &s.MACAddress,
			&s.BillingDay, &s.NextDueDate, &s.GraceDays, &s.Status, &s.MikroTikQueueID,
			&s.CreatedAt, &s.UpdatedAt,
			&s.UserName, &s.UserPhone, &s.PlanName, &s.PlanSpeed, &s.PlanPrice,
		); err != nil {
			return nil, fmt.Errorf("scan subscription: %w", err)
		}
		subs = append(subs, s)
	}
	return subs, nil
}

func (r *SubscriptionRepo) Update(ctx context.Context, id uuid.UUID, req *model.UpdateSubscriptionRequest) error {
	query := `UPDATE subscriptions SET updated_at = NOW()`
	args := []interface{}{}
	argIdx := 1

	if req.PlanID != nil {
		query += fmt.Sprintf(", plan_id = $%d", argIdx)
		args = append(args, *req.PlanID)
		argIdx++
	}
	if req.IPAddress != nil {
		query += fmt.Sprintf(", ip_address = $%d", argIdx)
		args = append(args, *req.IPAddress)
		argIdx++
	}
	if req.MACAddress != nil {
		query += fmt.Sprintf(", mac_address = $%d", argIdx)
		args = append(args, *req.MACAddress)
		argIdx++
	}
	if req.GraceDays != nil {
		query += fmt.Sprintf(", grace_days = $%d", argIdx)
		args = append(args, *req.GraceDays)
		argIdx++
	}

	query += fmt.Sprintf(" WHERE id = $%d", argIdx)
	args = append(args, id)

	_, err := r.pool.Exec(ctx, query, args...)
	return err
}

func (r *SubscriptionRepo) UpdateStatus(ctx context.Context, id uuid.UUID, status model.SubscriptionStatus) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE id = $2",
		status, id)
	return err
}

func (r *SubscriptionRepo) UpdateMikroTikQueueID(ctx context.Context, id uuid.UUID, queueID string) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE subscriptions SET mikrotik_queue_id = $1, updated_at = NOW() WHERE id = $2",
		queueID, id)
	return err
}

func (r *SubscriptionRepo) AdvanceDueDate(ctx context.Context, id uuid.UUID, billingDay int) error {
	// Calculate next month's due date
	now := time.Now()
	nextMonth := now.AddDate(0, 1, 0)
	nextDue := time.Date(nextMonth.Year(), nextMonth.Month(), billingDay, 0, 0, 0, 0, time.Local)
	_, err := r.pool.Exec(ctx,
		"UPDATE subscriptions SET next_due_date = $1, status = 'active', updated_at = NOW() WHERE id = $2",
		nextDue, id)
	return err
}

func (r *SubscriptionRepo) GetOverdue(ctx context.Context) ([]model.Subscription, error) {
	query := `SELECT s.id, s.user_id, s.plan_id, s.ip_address, s.mac_address,
		s.billing_day, s.next_due_date, s.grace_days, s.status, s.mikrotik_queue_id,
		s.created_at, s.updated_at,
		u.full_name, u.phone, p.name, p.speed_mbps, p.price
		FROM subscriptions s
		JOIN users u ON s.user_id = u.id
		JOIN plans p ON s.plan_id = p.id
		WHERE s.status != 'suspended'
		AND s.next_due_date + (s.grace_days || ' days')::interval < NOW()`

	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("get overdue: %w", err)
	}
	defer rows.Close()

	var subs []model.Subscription
	for rows.Next() {
		var s model.Subscription
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.PlanID, &s.IPAddress, &s.MACAddress,
			&s.BillingDay, &s.NextDueDate, &s.GraceDays, &s.Status, &s.MikroTikQueueID,
			&s.CreatedAt, &s.UpdatedAt,
			&s.UserName, &s.UserPhone, &s.PlanName, &s.PlanSpeed, &s.PlanPrice,
		); err != nil {
			return nil, fmt.Errorf("scan overdue: %w", err)
		}
		subs = append(subs, s)
	}
	return subs, nil
}

func (r *SubscriptionRepo) GetDueSoon(ctx context.Context, withinDays int) ([]model.Subscription, error) {
	query := `SELECT s.id, s.user_id, s.plan_id, s.ip_address, s.mac_address,
		s.billing_day, s.next_due_date, s.grace_days, s.status, s.mikrotik_queue_id,
		s.created_at, s.updated_at,
		u.full_name, u.phone, p.name, p.speed_mbps, p.price
		FROM subscriptions s
		JOIN users u ON s.user_id = u.id
		JOIN plans p ON s.plan_id = p.id
		WHERE s.status = 'active'
		AND s.next_due_date BETWEEN NOW() AND NOW() + ($1 || ' days')::interval
		ORDER BY s.next_due_date ASC`

	rows, err := r.pool.Query(ctx, query, withinDays)
	if err != nil {
		return nil, fmt.Errorf("get due soon: %w", err)
	}
	defer rows.Close()

	var subs []model.Subscription
	for rows.Next() {
		var s model.Subscription
		if err := rows.Scan(
			&s.ID, &s.UserID, &s.PlanID, &s.IPAddress, &s.MACAddress,
			&s.BillingDay, &s.NextDueDate, &s.GraceDays, &s.Status, &s.MikroTikQueueID,
			&s.CreatedAt, &s.UpdatedAt,
			&s.UserName, &s.UserPhone, &s.PlanName, &s.PlanSpeed, &s.PlanPrice,
		); err != nil {
			return nil, fmt.Errorf("scan due soon: %w", err)
		}
		subs = append(subs, s)
	}
	return subs, nil
}
```

- [ ] **Step 4: Create Payment repository**

Create `backend/internal/repository/payment_repo.go`:

```go
package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jdns/billingsystem/internal/model"
)

type PaymentRepo struct {
	pool *pgxpool.Pool
}

func NewPaymentRepo(pool *pgxpool.Pool) *PaymentRepo {
	return &PaymentRepo{pool: pool}
}

func (r *PaymentRepo) Create(ctx context.Context, p *model.Payment) error {
	query := `INSERT INTO payments (user_id, subscription_id, amount, method, reference_number, proof_image_url, status, billing_period_start, billing_period_end)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, query,
		p.UserID, p.SubscriptionID, p.Amount, p.Method,
		p.ReferenceNumber, p.ProofImageURL, p.Status,
		p.BillingPeriodStart, p.BillingPeriodEnd,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func (r *PaymentRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Payment, error) {
	p := &model.Payment{}
	query := `SELECT p.id, p.user_id, p.subscription_id, p.amount, p.method,
		p.reference_number, p.proof_image_url, p.status, p.approved_by,
		p.billing_period_start, p.billing_period_end, p.notes, p.created_at, p.updated_at,
		u.full_name, u.phone,
		COALESCE(a.full_name, '')
		FROM payments p
		JOIN users u ON p.user_id = u.id
		LEFT JOIN users a ON p.approved_by = a.id
		WHERE p.id = $1`
	err := r.pool.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.UserID, &p.SubscriptionID, &p.Amount, &p.Method,
		&p.ReferenceNumber, &p.ProofImageURL, &p.Status, &p.ApprovedBy,
		&p.BillingPeriodStart, &p.BillingPeriodEnd, &p.Notes, &p.CreatedAt, &p.UpdatedAt,
		&p.UserName, &p.UserPhone, &p.ApproverName,
	)
	if err != nil {
		return nil, fmt.Errorf("get payment: %w", err)
	}
	return p, nil
}

func (r *PaymentRepo) ListByStatus(ctx context.Context, status *model.PaymentStatus) ([]model.Payment, error) {
	query := `SELECT p.id, p.user_id, p.subscription_id, p.amount, p.method,
		p.reference_number, p.proof_image_url, p.status, p.approved_by,
		p.billing_period_start, p.billing_period_end, p.notes, p.created_at, p.updated_at,
		u.full_name, u.phone,
		COALESCE(a.full_name, '')
		FROM payments p
		JOIN users u ON p.user_id = u.id
		LEFT JOIN users a ON p.approved_by = a.id`
	args := []interface{}{}
	if status != nil {
		query += " WHERE p.status = $1"
		args = append(args, *status)
	}
	query += " ORDER BY p.created_at DESC"

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list payments: %w", err)
	}
	defer rows.Close()

	var payments []model.Payment
	for rows.Next() {
		var p model.Payment
		if err := rows.Scan(
			&p.ID, &p.UserID, &p.SubscriptionID, &p.Amount, &p.Method,
			&p.ReferenceNumber, &p.ProofImageURL, &p.Status, &p.ApprovedBy,
			&p.BillingPeriodStart, &p.BillingPeriodEnd, &p.Notes, &p.CreatedAt, &p.UpdatedAt,
			&p.UserName, &p.UserPhone, &p.ApproverName,
		); err != nil {
			return nil, fmt.Errorf("scan payment: %w", err)
		}
		payments = append(payments, p)
	}
	return payments, nil
}

func (r *PaymentRepo) ListByUserID(ctx context.Context, userID uuid.UUID) ([]model.Payment, error) {
	query := `SELECT p.id, p.user_id, p.subscription_id, p.amount, p.method,
		p.reference_number, p.proof_image_url, p.status, p.approved_by,
		p.billing_period_start, p.billing_period_end, p.notes, p.created_at, p.updated_at,
		u.full_name, u.phone,
		COALESCE(a.full_name, '')
		FROM payments p
		JOIN users u ON p.user_id = u.id
		LEFT JOIN users a ON p.approved_by = a.id
		WHERE p.user_id = $1
		ORDER BY p.created_at DESC`

	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("list user payments: %w", err)
	}
	defer rows.Close()

	var payments []model.Payment
	for rows.Next() {
		var p model.Payment
		if err := rows.Scan(
			&p.ID, &p.UserID, &p.SubscriptionID, &p.Amount, &p.Method,
			&p.ReferenceNumber, &p.ProofImageURL, &p.Status, &p.ApprovedBy,
			&p.BillingPeriodStart, &p.BillingPeriodEnd, &p.Notes, &p.CreatedAt, &p.UpdatedAt,
			&p.UserName, &p.UserPhone, &p.ApproverName,
		); err != nil {
			return nil, fmt.Errorf("scan payment: %w", err)
		}
		payments = append(payments, p)
	}
	return payments, nil
}

func (r *PaymentRepo) Approve(ctx context.Context, id uuid.UUID, approvedBy uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE payments SET status = 'approved', approved_by = $1, updated_at = NOW() WHERE id = $2",
		approvedBy, id)
	return err
}

func (r *PaymentRepo) Reject(ctx context.Context, id uuid.UUID, approvedBy uuid.UUID, notes *string) error {
	_, err := r.pool.Exec(ctx,
		"UPDATE payments SET status = 'rejected', approved_by = $1, notes = $2, updated_at = NOW() WHERE id = $3",
		approvedBy, notes, id)
	return err
}
```

- [ ] **Step 5: Create OTP repository**

Create `backend/internal/repository/otp_repo.go`:

```go
package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jdns/billingsystem/internal/model"
)

type OTPRepo struct {
	pool *pgxpool.Pool
}

func NewOTPRepo(pool *pgxpool.Pool) *OTPRepo {
	return &OTPRepo{pool: pool}
}

func (r *OTPRepo) Create(ctx context.Context, otp *model.OTP) error {
	query := `INSERT INTO otp_codes (phone, code, expires_at)
		VALUES ($1, $2, $3) RETURNING id, created_at`
	return r.pool.QueryRow(ctx, query,
		otp.Phone, otp.Code, otp.ExpiresAt,
	).Scan(&otp.ID, &otp.CreatedAt)
}

func (r *OTPRepo) Verify(ctx context.Context, phone string, code string) (bool, error) {
	var id string
	err := r.pool.QueryRow(ctx,
		`UPDATE otp_codes SET verified = true
		WHERE phone = $1 AND code = $2 AND expires_at > $3 AND verified = false
		RETURNING id`,
		phone, code, time.Now(),
	).Scan(&id)
	if err != nil {
		return false, nil // Not found = invalid
	}
	return true, nil
}

func (r *OTPRepo) CountRecent(ctx context.Context, phone string, since time.Time) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM otp_codes WHERE phone = $1 AND created_at > $2",
		phone, since,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count recent OTPs: %w", err)
	}
	return count, nil
}
```

- [ ] **Step 6: Create ActivityLog repository**

Create `backend/internal/repository/activity_log_repo.go`:

```go
package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jdns/billingsystem/internal/model"
)

type ActivityLogRepo struct {
	pool *pgxpool.Pool
}

func NewActivityLogRepo(pool *pgxpool.Pool) *ActivityLogRepo {
	return &ActivityLogRepo{pool: pool}
}

func (r *ActivityLogRepo) Create(ctx context.Context, log *model.ActivityLog) error {
	detailsJSON, _ := json.Marshal(log.Details)
	query := `INSERT INTO activity_logs (user_id, action, target_type, target_id, details, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`
	return r.pool.QueryRow(ctx, query,
		log.UserID, log.Action, log.TargetType, log.TargetID, detailsJSON, log.IPAddress,
	).Scan(&log.ID, &log.CreatedAt)
}

func (r *ActivityLogRepo) List(ctx context.Context, limit int) ([]model.ActivityLog, error) {
	query := `SELECT al.id, al.user_id, al.action, al.target_type, al.target_id,
		al.details, al.ip_address, al.created_at, u.full_name
		FROM activity_logs al
		JOIN users u ON al.user_id = u.id
		ORDER BY al.created_at DESC LIMIT $1`

	rows, err := r.pool.Query(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("list activity logs: %w", err)
	}
	defer rows.Close()

	var logs []model.ActivityLog
	for rows.Next() {
		var l model.ActivityLog
		var detailsJSON []byte
		if err := rows.Scan(
			&l.ID, &l.UserID, &l.Action, &l.TargetType, &l.TargetID,
			&detailsJSON, &l.IPAddress, &l.CreatedAt, &l.UserName,
		); err != nil {
			return nil, fmt.Errorf("scan activity log: %w", err)
		}
		if detailsJSON != nil {
			json.Unmarshal(detailsJSON, &l.Details)
		}
		logs = append(logs, l)
	}
	return logs, nil
}
```

- [ ] **Step 7: Create Dashboard repository**

Create `backend/internal/repository/dashboard_repo.go`:

```go
package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DashboardRepo struct {
	pool *pgxpool.Pool
}

func NewDashboardRepo(pool *pgxpool.Pool) *DashboardRepo {
	return &DashboardRepo{pool: pool}
}

type DashboardStats struct {
	TotalCustomers  int     `json:"total_customers"`
	ActiveCustomers int     `json:"active_customers"`
	OverdueCount    int     `json:"overdue_count"`
	SuspendedCount  int     `json:"suspended_count"`
	MonthlyIncome   float64 `json:"monthly_income"`
	ExpectedIncome  float64 `json:"expected_income"`
	PendingPayments int     `json:"pending_payments"`
}

func (r *DashboardRepo) GetStats(ctx context.Context) (*DashboardStats, error) {
	stats := &DashboardStats{}

	// Total customers
	r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE role = 'customer'").Scan(&stats.TotalCustomers)

	// Active subscriptions
	r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM subscriptions WHERE status = 'active'").Scan(&stats.ActiveCustomers)

	// Overdue
	r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM subscriptions WHERE status = 'overdue'").Scan(&stats.OverdueCount)

	// Suspended
	r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM subscriptions WHERE status = 'suspended'").Scan(&stats.SuspendedCount)

	// Monthly income (approved payments this month)
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
	r.pool.QueryRow(ctx,
		"SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'approved' AND created_at >= $1",
		monthStart).Scan(&stats.MonthlyIncome)

	// Expected income (all active subscriptions * plan price)
	r.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(p.price), 0) FROM subscriptions s
		JOIN plans p ON s.plan_id = p.id
		WHERE s.status IN ('active', 'overdue')`).Scan(&stats.ExpectedIncome)

	// Pending payments
	r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM payments WHERE status = 'pending'").Scan(&stats.PendingPayments)

	return stats, nil
}

type IncomeReport struct {
	Date   string  `json:"date"`
	Amount float64 `json:"amount"`
	Count  int     `json:"count"`
}

func (r *DashboardRepo) GetIncomeReport(ctx context.Context, days int) ([]IncomeReport, error) {
	query := `SELECT DATE(created_at) as date, SUM(amount) as amount, COUNT(*) as count
		FROM payments
		WHERE status = 'approved' AND created_at >= NOW() - ($1 || ' days')::interval
		GROUP BY DATE(created_at)
		ORDER BY date ASC`

	rows, err := r.pool.Query(ctx, query, days)
	if err != nil {
		return nil, fmt.Errorf("income report: %w", err)
	}
	defer rows.Close()

	var reports []IncomeReport
	for rows.Next() {
		var rpt IncomeReport
		var date time.Time
		if err := rows.Scan(&date, &rpt.Amount, &rpt.Count); err != nil {
			return nil, fmt.Errorf("scan income: %w", err)
		}
		rpt.Date = date.Format("2006-01-02")
		reports = append(reports, rpt)
	}
	return reports, nil
}
```

- [ ] **Step 8: Verify everything compiles**

```bash
cd /Users/dev3/billingsystem/backend && go mod tidy && go build ./...
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
cd /Users/dev3/billingsystem
git add backend/
git commit -m "feat: add all repositories with CRUD operations and dashboard queries"
```

---

## Task 5: Auth Service (JWT + OTP + Password)

**Files:**
- Create: `backend/internal/service/auth_service.go`
- Create: `backend/internal/sms/provider.go`
- Create: `backend/internal/sms/mock.go`

- [ ] **Step 1: Install JWT and bcrypt dependencies**

```bash
cd /Users/dev3/billingsystem/backend
go get github.com/golang-jwt/jwt/v5
go get golang.org/x/crypto/bcrypt
```

- [ ] **Step 2: Create SMS provider interface**

Create `backend/internal/sms/provider.go`:

```go
package sms

type Provider interface {
	SendOTP(phone string, code string) error
	SendReminder(phone string, message string) error
}
```

- [ ] **Step 3: Create mock SMS provider**

Create `backend/internal/sms/mock.go`:

```go
package sms

import "log"

type MockProvider struct{}

func NewMockProvider() *MockProvider {
	return &MockProvider{}
}

func (m *MockProvider) SendOTP(phone string, code string) error {
	log.Printf("[MOCK SMS] OTP to %s: %s", phone, code)
	return nil
}

func (m *MockProvider) SendReminder(phone string, message string) error {
	log.Printf("[MOCK SMS] Reminder to %s: %s", phone, message)
	return nil
}
```

- [ ] **Step 4: Create auth service**

Create `backend/internal/service/auth_service.go`:

```go
package service

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/repository"
	"github.com/jdns/billingsystem/internal/sms"
)

type AuthService struct {
	userRepo    *repository.UserRepo
	otpRepo     *repository.OTPRepo
	smsProvider sms.Provider
	jwtSecret   string
	refreshSecret string
}

func NewAuthService(userRepo *repository.UserRepo, otpRepo *repository.OTPRepo, smsProvider sms.Provider, jwtSecret, refreshSecret string) *AuthService {
	return &AuthService{
		userRepo:      userRepo,
		otpRepo:       otpRepo,
		smsProvider:   smsProvider,
		jwtSecret:     jwtSecret,
		refreshSecret: refreshSecret,
	}
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"` // seconds
}

type JWTClaims struct {
	UserID uuid.UUID      `json:"user_id"`
	Role   model.UserRole `json:"role"`
	jwt.RegisteredClaims
}

func (s *AuthService) RequestOTP(ctx context.Context, phone string) error {
	// Rate limit: max 5 per hour
	count, err := s.otpRepo.CountRecent(ctx, phone, time.Now().Add(-1*time.Hour))
	if err != nil {
		return fmt.Errorf("check rate limit: %w", err)
	}
	if count >= 5 {
		return fmt.Errorf("too many OTP requests, try again later")
	}

	// Generate 6-digit code
	code, err := generateOTP()
	if err != nil {
		return fmt.Errorf("generate OTP: %w", err)
	}

	otp := &model.OTP{
		Phone:     phone,
		Code:      code,
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	if err := s.otpRepo.Create(ctx, otp); err != nil {
		return fmt.Errorf("save OTP: %w", err)
	}

	// Send via SMS
	if err := s.smsProvider.SendOTP(phone, code); err != nil {
		return fmt.Errorf("send OTP SMS: %w", err)
	}

	return nil
}

func (s *AuthService) VerifyOTP(ctx context.Context, phone, code string) (*TokenPair, error) {
	valid, err := s.otpRepo.Verify(ctx, phone, code)
	if err != nil {
		return nil, fmt.Errorf("verify OTP: %w", err)
	}
	if !valid {
		return nil, fmt.Errorf("invalid or expired OTP")
	}

	user, err := s.userRepo.GetByPhone(ctx, phone)
	if err != nil {
		return nil, fmt.Errorf("user not found for phone %s", phone)
	}

	return s.generateTokenPair(user.ID, user.Role)
}

func (s *AuthService) Login(ctx context.Context, phone, password string) (*TokenPair, error) {
	user, err := s.userRepo.GetByPhone(ctx, phone)
	if err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	if user.Role == model.RoleCustomer {
		return nil, fmt.Errorf("customers must use OTP login")
	}

	if user.PasswordHash == nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	return s.generateTokenPair(user.ID, user.Role)
}

func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*TokenPair, error) {
	claims := &JWTClaims{}
	token, err := jwt.ParseWithClaims(refreshToken, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(s.refreshSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid refresh token")
	}

	return s.generateTokenPair(claims.UserID, claims.Role)
}

func (s *AuthService) ValidateToken(tokenString string) (*JWTClaims, error) {
	claims := &JWTClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(s.jwtSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

func (s *AuthService) HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

func (s *AuthService) generateTokenPair(userID uuid.UUID, role model.UserRole) (*TokenPair, error) {
	now := time.Now()

	accessClaims := &JWTClaims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessString, err := accessToken.SignedString([]byte(s.jwtSecret))
	if err != nil {
		return nil, fmt.Errorf("sign access token: %w", err)
	}

	refreshClaims := &JWTClaims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(7 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	refreshTokenJWT := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshString, err := refreshTokenJWT.SignedString([]byte(s.refreshSecret))
	if err != nil {
		return nil, fmt.Errorf("sign refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessString,
		RefreshToken: refreshString,
		ExpiresIn:    900, // 15 min
	}, nil
}

func generateOTP() (string, error) {
	max := big.NewInt(999999)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}
```

- [ ] **Step 5: Verify it compiles**

```bash
cd /Users/dev3/billingsystem/backend && go mod tidy && go build ./...
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/dev3/billingsystem
git add backend/
git commit -m "feat: add auth service with JWT, OTP, bcrypt, and pluggable SMS"
```

---

## Task 6: Middleware (Auth + RBAC + Rate Limiting)

**Files:**
- Create: `backend/internal/middleware/auth.go`
- Create: `backend/internal/middleware/rbac.go`
- Create: `backend/internal/middleware/ratelimit.go`

- [ ] **Step 1: Create auth middleware**

Create `backend/internal/middleware/auth.go`:

```go
package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/service"
)

type contextKey string

const (
	UserIDKey contextKey = "user_id"
	RoleKey   contextKey = "role"
)

func Auth(authService *service.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || parts[0] != "Bearer" {
				http.Error(w, `{"error":"invalid authorization format"}`, http.StatusUnauthorized)
				return
			}

			claims, err := authService.ValidateToken(parts[1])
			if err != nil {
				http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, RoleKey, claims.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserID(ctx context.Context) uuid.UUID {
	id, _ := ctx.Value(UserIDKey).(uuid.UUID)
	return id
}

func GetRole(ctx context.Context) model.UserRole {
	role, _ := ctx.Value(RoleKey).(model.UserRole)
	return role
}
```

- [ ] **Step 2: Create RBAC middleware**

Create `backend/internal/middleware/rbac.go`:

```go
package middleware

import (
	"net/http"

	"github.com/jdns/billingsystem/internal/model"
)

func RequireRole(roles ...model.UserRole) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userRole := GetRole(r.Context())
			for _, role := range roles {
				if userRole == role {
					next.ServeHTTP(w, r)
					return
				}
			}
			http.Error(w, `{"error":"forbidden"}`, http.StatusForbidden)
		})
	}
}

func AdminOnly() func(http.Handler) http.Handler {
	return RequireRole(model.RoleAdmin)
}

func AdminOrTech() func(http.Handler) http.Handler {
	return RequireRole(model.RoleAdmin, model.RoleTechnician)
}
```

- [ ] **Step 3: Create rate limit middleware**

Create `backend/internal/middleware/ratelimit.go`:

```go
package middleware

import (
	"net/http"
	"sync"
	"time"
)

type rateLimiter struct {
	mu       sync.Mutex
	requests map[string][]time.Time
	limit    int
	window   time.Duration
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{
		requests: make(map[string][]time.Time),
		limit:    limit,
		window:   window,
	}
}

func (rl *rateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.window)

	// Clean old entries
	reqs := rl.requests[key]
	var valid []time.Time
	for _, t := range reqs {
		if t.After(cutoff) {
			valid = append(valid, t)
		}
	}

	if len(valid) >= rl.limit {
		rl.requests[key] = valid
		return false
	}

	rl.requests[key] = append(valid, now)
	return true
}

func RateLimit(limit int, window time.Duration) func(http.Handler) http.Handler {
	rl := newRateLimiter(limit, window)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.RemoteAddr
			if !rl.allow(key) {
				http.Error(w, `{"error":"rate limit exceeded"}`, http.StatusTooManyRequests)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
```

- [ ] **Step 4: Verify it compiles**

```bash
cd /Users/dev3/billingsystem/backend && go build ./...
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/dev3/billingsystem
git add backend/
git commit -m "feat: add auth, RBAC, and rate-limit middleware"
```

---

## Task 7: MikroTik Client

**Files:**
- Create: `backend/internal/mikrotik/client.go`

- [ ] **Step 1: Install go-routeros**

```bash
cd /Users/dev3/billingsystem/backend
go get github.com/go-routeros/routeros/v3
```

- [ ] **Step 2: Create MikroTik client**

Create `backend/internal/mikrotik/client.go`:

```go
package mikrotik

import (
	"fmt"
	"log"

	"github.com/go-routeros/routeros/v3"
)

type Client struct {
	address  string
	username string
	password string
}

func NewClient(host string, port int, username, password string) *Client {
	return &Client{
		address:  fmt.Sprintf("%s:%d", host, port),
		username: username,
		password: password,
	}
}

func (c *Client) connect() (*routeros.Client, error) {
	client, err := routeros.Dial(c.address, c.username, c.password)
	if err != nil {
		return nil, fmt.Errorf("connect to MikroTik: %w", err)
	}
	return client, nil
}

func (c *Client) IsConnected() bool {
	client, err := c.connect()
	if err != nil {
		return false
	}
	client.Close()
	return true
}

// CreateQueue creates a simple queue for a user with given speed limit
func (c *Client) CreateQueue(name string, targetIP string, maxUpload string, maxDownload string) (string, error) {
	client, err := c.connect()
	if err != nil {
		return "", err
	}
	defer client.Close()

	maxLimit := fmt.Sprintf("%s/%s", maxUpload, maxDownload)

	reply, err := client.Run(
		"/queue/simple/add",
		fmt.Sprintf("=name=%s", name),
		fmt.Sprintf("=target=%s/32", targetIP),
		fmt.Sprintf("=max-limit=%s", maxLimit),
	)
	if err != nil {
		return "", fmt.Errorf("create queue: %w", err)
	}

	queueID := ""
	if len(reply.Re) > 0 {
		queueID = reply.Re[0].Map["ret"]
	}
	log.Printf("[MikroTik] Created queue %s for %s (limit: %s)", name, targetIP, maxLimit)
	return queueID, nil
}

// DisableQueue disables a queue (cuts internet)
func (c *Client) DisableQueue(queueID string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	_, err = client.Run(
		"/queue/simple/set",
		fmt.Sprintf("=.id=%s", queueID),
		"=disabled=yes",
	)
	if err != nil {
		return fmt.Errorf("disable queue: %w", err)
	}
	log.Printf("[MikroTik] Disabled queue %s", queueID)
	return nil
}

// EnableQueue enables a queue (restores internet)
func (c *Client) EnableQueue(queueID string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	_, err = client.Run(
		"/queue/simple/set",
		fmt.Sprintf("=.id=%s", queueID),
		"=disabled=no",
	)
	if err != nil {
		return fmt.Errorf("enable queue: %w", err)
	}
	log.Printf("[MikroTik] Enabled queue %s", queueID)
	return nil
}

// UpdateQueueSpeed updates the speed limit of a queue
func (c *Client) UpdateQueueSpeed(queueID string, maxUpload string, maxDownload string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	maxLimit := fmt.Sprintf("%s/%s", maxUpload, maxDownload)
	_, err = client.Run(
		"/queue/simple/set",
		fmt.Sprintf("=.id=%s", queueID),
		fmt.Sprintf("=max-limit=%s", maxLimit),
	)
	if err != nil {
		return fmt.Errorf("update queue speed: %w", err)
	}
	log.Printf("[MikroTik] Updated queue %s speed to %s", queueID, maxLimit)
	return nil
}

// DeleteQueue removes a queue
func (c *Client) DeleteQueue(queueID string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	_, err = client.Run(
		"/queue/simple/remove",
		fmt.Sprintf("=.id=%s", queueID),
	)
	if err != nil {
		return fmt.Errorf("delete queue: %w", err)
	}
	log.Printf("[MikroTik] Deleted queue %s", queueID)
	return nil
}

// GetActiveConnections returns list of active PPP connections
func (c *Client) GetActiveConnections() ([]map[string]string, error) {
	client, err := c.connect()
	if err != nil {
		return nil, err
	}
	defer client.Close()

	reply, err := client.Run("/queue/simple/print")
	if err != nil {
		return nil, fmt.Errorf("get queues: %w", err)
	}

	var connections []map[string]string
	for _, re := range reply.Re {
		connections = append(connections, re.Map)
	}
	return connections, nil
}

// SpeedString converts Mbps to MikroTik format (e.g., 10 -> "10M")
func SpeedString(mbps int) string {
	return fmt.Sprintf("%dM", mbps)
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd /Users/dev3/billingsystem/backend && go mod tidy && go build ./...
```

- [ ] **Step 4: Commit**

```bash
cd /Users/dev3/billingsystem
git add backend/
git commit -m "feat: add MikroTik RouterOS API client for queue management"
```

---

## Task 8: Services (Business Logic Layer)

**Files:**
- Create: `backend/internal/service/user_service.go`
- Create: `backend/internal/service/plan_service.go`
- Create: `backend/internal/service/subscription_service.go`
- Create: `backend/internal/service/payment_service.go`
- Create: `backend/internal/service/dashboard_service.go`

- [ ] **Step 1: Create user service**

Create `backend/internal/service/user_service.go`:

```go
package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/repository"
)

type UserService struct {
	userRepo    *repository.UserRepo
	authService *AuthService
}

func NewUserService(userRepo *repository.UserRepo, authService *AuthService) *UserService {
	return &UserService{userRepo: userRepo, authService: authService}
}

func (s *UserService) Create(ctx context.Context, req *model.CreateUserRequest) (*model.User, error) {
	user := &model.User{
		Phone:    req.Phone,
		FullName: req.FullName,
		Email:    req.Email,
		Address:  req.Address,
		Role:     req.Role,
		Status:   model.UserStatusActive,
	}

	// Hash password for admin/technician
	if req.Role != model.RoleCustomer {
		if req.Password == nil || *req.Password == "" {
			return nil, fmt.Errorf("password is required for %s role", req.Role)
		}
		hash, err := s.authService.HashPassword(*req.Password)
		if err != nil {
			return nil, fmt.Errorf("hash password: %w", err)
		}
		user.PasswordHash = &hash
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	return user, nil
}

func (s *UserService) GetByID(ctx context.Context, id uuid.UUID) (*model.User, error) {
	return s.userRepo.GetByID(ctx, id)
}

func (s *UserService) List(ctx context.Context, role *model.UserRole) ([]model.User, error) {
	return s.userRepo.List(ctx, role)
}

func (s *UserService) Update(ctx context.Context, id uuid.UUID, req *model.UpdateUserRequest) error {
	return s.userRepo.Update(ctx, id, req)
}

func (s *UserService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.userRepo.Delete(ctx, id)
}
```

- [ ] **Step 2: Create plan service**

Create `backend/internal/service/plan_service.go`:

```go
package service

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/repository"
)

type PlanService struct {
	planRepo *repository.PlanRepo
}

func NewPlanService(planRepo *repository.PlanRepo) *PlanService {
	return &PlanService{planRepo: planRepo}
}

func (s *PlanService) Create(ctx context.Context, req *model.CreatePlanRequest) (*model.Plan, error) {
	plan := &model.Plan{
		Name:        req.Name,
		SpeedMbps:   req.SpeedMbps,
		Price:       req.Price,
		Description: req.Description,
	}
	if err := s.planRepo.Create(ctx, plan); err != nil {
		return nil, fmt.Errorf("create plan: %w", err)
	}
	return plan, nil
}

func (s *PlanService) GetByID(ctx context.Context, id uuid.UUID) (*model.Plan, error) {
	return s.planRepo.GetByID(ctx, id)
}

func (s *PlanService) List(ctx context.Context, activeOnly bool) ([]model.Plan, error) {
	return s.planRepo.List(ctx, activeOnly)
}

func (s *PlanService) Update(ctx context.Context, id uuid.UUID, req *model.UpdatePlanRequest) error {
	return s.planRepo.Update(ctx, id, req)
}

func (s *PlanService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.planRepo.Delete(ctx, id)
}
```

- [ ] **Step 3: Create subscription service**

Create `backend/internal/service/subscription_service.go`:

```go
package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jdns/billingsystem/internal/mikrotik"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/repository"
)

type SubscriptionService struct {
	subRepo  *repository.SubscriptionRepo
	planRepo *repository.PlanRepo
	mtClient *mikrotik.Client
}

func NewSubscriptionService(subRepo *repository.SubscriptionRepo, planRepo *repository.PlanRepo, mtClient *mikrotik.Client) *SubscriptionService {
	return &SubscriptionService{subRepo: subRepo, planRepo: planRepo, mtClient: mtClient}
}

func (s *SubscriptionService) Create(ctx context.Context, req *model.CreateSubscriptionRequest) (*model.Subscription, error) {
	now := time.Now()
	billingDay := now.Day()
	if billingDay > 28 {
		billingDay = 28
	}

	graceDays := 2
	if req.GraceDays != nil {
		graceDays = *req.GraceDays
	}

	nextDue := time.Date(now.Year(), now.Month()+1, billingDay, 0, 0, 0, 0, time.Local)

	sub := &model.Subscription{
		UserID:      req.UserID,
		PlanID:      req.PlanID,
		IPAddress:   req.IPAddress,
		MACAddress:  req.MACAddress,
		BillingDay:  billingDay,
		NextDueDate: nextDue,
		GraceDays:   graceDays,
		Status:      model.SubStatusActive,
	}

	if err := s.subRepo.Create(ctx, sub); err != nil {
		return nil, fmt.Errorf("create subscription: %w", err)
	}

	// Create MikroTik queue if IP is provided
	if req.IPAddress != nil && s.mtClient != nil {
		plan, err := s.planRepo.GetByID(ctx, req.PlanID)
		if err == nil {
			speed := mikrotik.SpeedString(plan.SpeedMbps)
			queueName := fmt.Sprintf("jdns-%s", sub.ID.String()[:8])
			queueID, err := s.mtClient.CreateQueue(queueName, *req.IPAddress, speed, speed)
			if err == nil {
				s.subRepo.UpdateMikroTikQueueID(ctx, sub.ID, queueID)
				sub.MikroTikQueueID = &queueID
			}
		}
	}

	return sub, nil
}

func (s *SubscriptionService) GetByID(ctx context.Context, id uuid.UUID) (*model.Subscription, error) {
	return s.subRepo.GetByID(ctx, id)
}

func (s *SubscriptionService) GetByUserID(ctx context.Context, userID uuid.UUID) (*model.Subscription, error) {
	return s.subRepo.GetByUserID(ctx, userID)
}

func (s *SubscriptionService) List(ctx context.Context) ([]model.Subscription, error) {
	return s.subRepo.List(ctx)
}

func (s *SubscriptionService) Update(ctx context.Context, id uuid.UUID, req *model.UpdateSubscriptionRequest) error {
	return s.subRepo.Update(ctx, id, req)
}

func (s *SubscriptionService) Disconnect(ctx context.Context, id uuid.UUID) error {
	sub, err := s.subRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if sub.MikroTikQueueID != nil && s.mtClient != nil {
		if err := s.mtClient.DisableQueue(*sub.MikroTikQueueID); err != nil {
			return fmt.Errorf("disable MikroTik queue: %w", err)
		}
	}
	return s.subRepo.UpdateStatus(ctx, id, model.SubStatusSuspended)
}

func (s *SubscriptionService) Reconnect(ctx context.Context, id uuid.UUID) error {
	sub, err := s.subRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if sub.MikroTikQueueID != nil && s.mtClient != nil {
		if err := s.mtClient.EnableQueue(*sub.MikroTikQueueID); err != nil {
			return fmt.Errorf("enable MikroTik queue: %w", err)
		}
	}
	return s.subRepo.UpdateStatus(ctx, id, model.SubStatusActive)
}

func (s *SubscriptionService) GetOverdue(ctx context.Context) ([]model.Subscription, error) {
	return s.subRepo.GetOverdue(ctx)
}

func (s *SubscriptionService) GetDueSoon(ctx context.Context, days int) ([]model.Subscription, error) {
	return s.subRepo.GetDueSoon(ctx, days)
}
```

- [ ] **Step 4: Create payment service**

Create `backend/internal/service/payment_service.go`:

```go
package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/repository"
)

type PaymentService struct {
	paymentRepo *repository.PaymentRepo
	subRepo     *repository.SubscriptionRepo
	subService  *SubscriptionService
}

func NewPaymentService(paymentRepo *repository.PaymentRepo, subRepo *repository.SubscriptionRepo, subService *SubscriptionService) *PaymentService {
	return &PaymentService{paymentRepo: paymentRepo, subRepo: subRepo, subService: subService}
}

func (s *PaymentService) Create(ctx context.Context, userID uuid.UUID, req *model.CreatePaymentRequest, proofURL *string) (*model.Payment, error) {
	sub, err := s.subRepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("no active subscription found")
	}

	// Calculate billing period
	periodStart := sub.NextDueDate.AddDate(0, -1, 0)
	periodEnd := sub.NextDueDate.AddDate(0, 0, -1)

	payment := &model.Payment{
		UserID:             userID,
		SubscriptionID:     sub.ID,
		Amount:             sub.PlanPrice,
		Method:             req.Method,
		ReferenceNumber:    req.ReferenceNumber,
		ProofImageURL:      proofURL,
		Status:             model.PaymentPending,
		BillingPeriodStart: periodStart,
		BillingPeriodEnd:   periodEnd,
	}

	if err := s.paymentRepo.Create(ctx, payment); err != nil {
		return nil, fmt.Errorf("create payment: %w", err)
	}
	return payment, nil
}

func (s *PaymentService) Approve(ctx context.Context, paymentID uuid.UUID, approvedBy uuid.UUID) error {
	payment, err := s.paymentRepo.GetByID(ctx, paymentID)
	if err != nil {
		return err
	}
	if payment.Status != model.PaymentPending {
		return fmt.Errorf("payment is already %s", payment.Status)
	}

	if err := s.paymentRepo.Approve(ctx, paymentID, approvedBy); err != nil {
		return fmt.Errorf("approve payment: %w", err)
	}

	// Get subscription and advance due date
	sub, err := s.subRepo.GetByID(ctx, payment.SubscriptionID)
	if err == nil {
		s.subRepo.AdvanceDueDate(ctx, sub.ID, sub.BillingDay)

		// Auto-reconnect if suspended
		if sub.Status == model.SubStatusSuspended {
			s.subService.Reconnect(ctx, sub.ID)
		}
	}

	return nil
}

func (s *PaymentService) Reject(ctx context.Context, paymentID uuid.UUID, rejectedBy uuid.UUID, notes *string) error {
	payment, err := s.paymentRepo.GetByID(ctx, paymentID)
	if err != nil {
		return err
	}
	if payment.Status != model.PaymentPending {
		return fmt.Errorf("payment is already %s", payment.Status)
	}
	return s.paymentRepo.Reject(ctx, paymentID, rejectedBy, notes)
}

func (s *PaymentService) List(ctx context.Context, status *model.PaymentStatus) ([]model.Payment, error) {
	return s.paymentRepo.ListByStatus(ctx, status)
}

func (s *PaymentService) ListByUser(ctx context.Context, userID uuid.UUID) ([]model.Payment, error) {
	return s.paymentRepo.ListByUserID(ctx, userID)
}

func (s *PaymentService) GetByID(ctx context.Context, id uuid.UUID) (*model.Payment, error) {
	return s.paymentRepo.GetByID(ctx, id)
}

// Used by cron — not directly exposed
func (s *PaymentService) unused() { _ = time.Now }
```

- [ ] **Step 5: Create dashboard service**

Create `backend/internal/service/dashboard_service.go`:

```go
package service

import (
	"context"

	"github.com/jdns/billingsystem/internal/repository"
)

type DashboardService struct {
	dashRepo *repository.DashboardRepo
	logRepo  *repository.ActivityLogRepo
}

func NewDashboardService(dashRepo *repository.DashboardRepo, logRepo *repository.ActivityLogRepo) *DashboardService {
	return &DashboardService{dashRepo: dashRepo, logRepo: logRepo}
}

func (s *DashboardService) GetStats(ctx context.Context) (*repository.DashboardStats, error) {
	return s.dashRepo.GetStats(ctx)
}

func (s *DashboardService) GetIncomeReport(ctx context.Context, days int) ([]repository.IncomeReport, error) {
	return s.dashRepo.GetIncomeReport(ctx, days)
}
```

- [ ] **Step 6: Verify it compiles**

```bash
cd /Users/dev3/billingsystem/backend && go mod tidy && go build ./...
```

- [ ] **Step 7: Commit**

```bash
cd /Users/dev3/billingsystem
git add backend/
git commit -m "feat: add service layer with business logic for all entities"
```

---

## Task 9: HTTP Handlers

**Files:**
- Create: `backend/internal/handler/auth_handler.go`
- Create: `backend/internal/handler/user_handler.go`
- Create: `backend/internal/handler/plan_handler.go`
- Create: `backend/internal/handler/subscription_handler.go`
- Create: `backend/internal/handler/payment_handler.go`
- Create: `backend/internal/handler/dashboard_handler.go`
- Create: `backend/internal/handler/mikrotik_handler.go`
- Create: `backend/internal/handler/notification_handler.go`
- Create: `backend/internal/handler/helpers.go`

- [ ] **Step 1: Create handler helpers**

Create `backend/internal/handler/helpers.go`:

```go
package handler

import (
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
)

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func decodeJSON(r *http.Request, v interface{}) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

func parseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}
```

- [ ] **Step 2: Create auth handler**

Create `backend/internal/handler/auth_handler.go`:

```go
package handler

import (
	"net/http"

	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/service"
)

type AuthHandler struct {
	authService *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func (h *AuthHandler) RequestOTP(w http.ResponseWriter, r *http.Request) {
	var req model.OTPRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Phone == "" {
		writeError(w, http.StatusBadRequest, "phone is required")
		return
	}

	if err := h.authService.RequestOTP(r.Context(), req.Phone); err != nil {
		writeError(w, http.StatusTooManyRequests, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "OTP sent"})
}

func (h *AuthHandler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	var req model.OTPVerifyRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	tokens, err := h.authService.VerifyOTP(r.Context(), req.Phone, req.Code)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, tokens)
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Phone    string `json:"phone"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	tokens, err := h.authService.Login(r.Context(), req.Phone, req.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	writeJSON(w, http.StatusOK, tokens)
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	tokens, err := h.authService.RefreshToken(r.Context(), req.RefreshToken)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, tokens)
}
```

- [ ] **Step 3: Create user handler**

Create `backend/internal/handler/user_handler.go`:

```go
package handler

import (
	"net/http"

	"github.com/jdns/billingsystem/internal/middleware"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/service"
)

type UserHandler struct {
	userService *service.UserService
}

func NewUserHandler(userService *service.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	roleFilter := r.URL.Query().Get("role")
	var role *model.UserRole
	if roleFilter != "" {
		r := model.UserRole(roleFilter)
		role = &r
	}

	users, err := h.userService.List(r.Context(), role)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (h *UserHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user ID")
		return
	}

	// Customers can only view their own profile
	if middleware.GetRole(r.Context()) == model.RoleCustomer {
		if middleware.GetUserID(r.Context()) != id {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
	}

	user, err := h.userService.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (h *UserHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateUserRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, err := h.userService.Create(r.Context(), &req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, user)
}

func (h *UserHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user ID")
		return
	}

	var req model.UpdateUserRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.userService.Update(r.Context(), id, &req); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "user updated"})
}

func (h *UserHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user ID")
		return
	}

	if err := h.userService.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "user deleted"})
}
```

- [ ] **Step 4: Create plan handler**

Create `backend/internal/handler/plan_handler.go`:

```go
package handler

import (
	"net/http"

	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/service"
)

type PlanHandler struct {
	planService *service.PlanService
}

func NewPlanHandler(planService *service.PlanService) *PlanHandler {
	return &PlanHandler{planService: planService}
}

func (h *PlanHandler) List(w http.ResponseWriter, r *http.Request) {
	plans, err := h.planService.List(r.Context(), false)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, plans)
}

func (h *PlanHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreatePlanRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	plan, err := h.planService.Create(r.Context(), &req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, plan)
}

func (h *PlanHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid plan ID")
		return
	}

	var req model.UpdatePlanRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.planService.Update(r.Context(), id, &req); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "plan updated"})
}

func (h *PlanHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid plan ID")
		return
	}

	if err := h.planService.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "plan deleted"})
}
```

- [ ] **Step 5: Create subscription handler**

Create `backend/internal/handler/subscription_handler.go`:

```go
package handler

import (
	"net/http"

	"github.com/jdns/billingsystem/internal/middleware"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/service"
)

type SubscriptionHandler struct {
	subService *service.SubscriptionService
}

func NewSubscriptionHandler(subService *service.SubscriptionService) *SubscriptionHandler {
	return &SubscriptionHandler{subService: subService}
}

func (h *SubscriptionHandler) List(w http.ResponseWriter, r *http.Request) {
	subs, err := h.subService.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, subs)
}

func (h *SubscriptionHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid subscription ID")
		return
	}

	sub, err := h.subService.GetByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "subscription not found")
		return
	}

	// Customers can only view their own
	if middleware.GetRole(r.Context()) == model.RoleCustomer {
		if sub.UserID != middleware.GetUserID(r.Context()) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
	}

	writeJSON(w, http.StatusOK, sub)
}

func (h *SubscriptionHandler) GetMine(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	sub, err := h.subService.GetByUserID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "no subscription found")
		return
	}
	writeJSON(w, http.StatusOK, sub)
}

func (h *SubscriptionHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateSubscriptionRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	sub, err := h.subService.Create(r.Context(), &req)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, sub)
}

func (h *SubscriptionHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid subscription ID")
		return
	}

	var req model.UpdateSubscriptionRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.subService.Update(r.Context(), id, &req); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "subscription updated"})
}

func (h *SubscriptionHandler) Disconnect(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid subscription ID")
		return
	}

	if err := h.subService.Disconnect(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "user disconnected"})
}

func (h *SubscriptionHandler) Reconnect(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid subscription ID")
		return
	}

	if err := h.subService.Reconnect(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "user reconnected"})
}
```

- [ ] **Step 6: Create payment handler**

Create `backend/internal/handler/payment_handler.go`:

```go
package handler

import (
	"net/http"

	"github.com/jdns/billingsystem/internal/middleware"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/service"
)

type PaymentHandler struct {
	paymentService *service.PaymentService
}

func NewPaymentHandler(paymentService *service.PaymentService) *PaymentHandler {
	return &PaymentHandler{paymentService: paymentService}
}

func (h *PaymentHandler) List(w http.ResponseWriter, r *http.Request) {
	statusFilter := r.URL.Query().Get("status")
	var status *model.PaymentStatus
	if statusFilter != "" {
		s := model.PaymentStatus(statusFilter)
		status = &s
	}

	payments, err := h.paymentService.List(r.Context(), status)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, payments)
}

func (h *PaymentHandler) ListMine(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	payments, err := h.paymentService.ListByUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, payments)
}

func (h *PaymentHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	// Parse multipart form for file upload
	r.ParseMultipartForm(5 << 20) // 5MB max

	method := r.FormValue("method")
	refNumber := r.FormValue("reference_number")

	req := &model.CreatePaymentRequest{
		Method: model.PaymentMethod(method),
	}
	if refNumber != "" {
		req.ReferenceNumber = &refNumber
	}

	// TODO: Handle file upload to R2 in Task 10
	var proofURL *string

	payment, err := h.paymentService.Create(r.Context(), userID, req, proofURL)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, payment)
}

func (h *PaymentHandler) Approve(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid payment ID")
		return
	}

	approvedBy := middleware.GetUserID(r.Context())
	if err := h.paymentService.Approve(r.Context(), id, approvedBy); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "payment approved"})
}

func (h *PaymentHandler) Reject(w http.ResponseWriter, r *http.Request) {
	id, err := parseUUID(r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid payment ID")
		return
	}

	var req model.ApproveRejectRequest
	decodeJSON(r, &req)

	rejectedBy := middleware.GetUserID(r.Context())
	if err := h.paymentService.Reject(r.Context(), id, rejectedBy, req.Notes); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "payment rejected"})
}
```

- [ ] **Step 7: Create dashboard handler**

Create `backend/internal/handler/dashboard_handler.go`:

```go
package handler

import (
	"net/http"
	"strconv"

	"github.com/jdns/billingsystem/internal/repository"
	"github.com/jdns/billingsystem/internal/service"
)

type DashboardHandler struct {
	dashService *service.DashboardService
	logRepo     *repository.ActivityLogRepo
}

func NewDashboardHandler(dashService *service.DashboardService, logRepo *repository.ActivityLogRepo) *DashboardHandler {
	return &DashboardHandler{dashService: dashService, logRepo: logRepo}
}

func (h *DashboardHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.dashService.GetStats(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (h *DashboardHandler) GetIncomeReport(w http.ResponseWriter, r *http.Request) {
	days := 30
	if d := r.URL.Query().Get("days"); d != "" {
		if parsed, err := strconv.Atoi(d); err == nil {
			days = parsed
		}
	}

	report, err := h.dashService.GetIncomeReport(r.Context(), days)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, report)
}

func (h *DashboardHandler) GetActivityLogs(w http.ResponseWriter, r *http.Request) {
	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}

	logs, err := h.logRepo.List(r.Context(), limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, logs)
}
```

- [ ] **Step 8: Create MikroTik handler**

Create `backend/internal/handler/mikrotik_handler.go`:

```go
package handler

import (
	"net/http"

	"github.com/jdns/billingsystem/internal/mikrotik"
)

type MikroTikHandler struct {
	client *mikrotik.Client
}

func NewMikroTikHandler(client *mikrotik.Client) *MikroTikHandler {
	return &MikroTikHandler{client: client}
}

func (h *MikroTikHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	connected := h.client.IsConnected()
	writeJSON(w, http.StatusOK, map[string]bool{"connected": connected})
}

func (h *MikroTikHandler) GetActiveConnections(w http.ResponseWriter, r *http.Request) {
	connections, err := h.client.GetActiveConnections()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, connections)
}
```

- [ ] **Step 9: Create notification handler**

Create `backend/internal/handler/notification_handler.go`:

```go
package handler

import (
	"fmt"
	"net/http"

	"github.com/jdns/billingsystem/internal/service"
	"github.com/jdns/billingsystem/internal/sms"
)

type NotificationHandler struct {
	subService  *service.SubscriptionService
	smsProvider sms.Provider
}

func NewNotificationHandler(subService *service.SubscriptionService, smsProvider sms.Provider) *NotificationHandler {
	return &NotificationHandler{subService: subService, smsProvider: smsProvider}
}

func (h *NotificationHandler) SendReminders(w http.ResponseWriter, r *http.Request) {
	subs, err := h.subService.GetDueSoon(r.Context(), 2)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	sent := 0
	for _, sub := range subs {
		msg := fmt.Sprintf("Hi %s, your JDNS WiFi (P%.0f) is due on %s. Please pay to avoid disconnection.",
			sub.UserName, sub.PlanPrice, sub.NextDueDate.Format("Jan 2"))
		if err := h.smsProvider.SendReminder(sub.UserPhone, msg); err == nil {
			sent++
		}
	}

	writeJSON(w, http.StatusOK, map[string]int{"reminders_sent": sent})
}
```

- [ ] **Step 10: Verify it compiles**

```bash
cd /Users/dev3/billingsystem/backend && go build ./...
```

- [ ] **Step 11: Commit**

```bash
cd /Users/dev3/billingsystem
git add backend/
git commit -m "feat: add all HTTP handlers for auth, users, plans, payments, dashboard"
```

---

## Task 10: Router + Wiring + CORS

**Files:**
- Create: `backend/internal/router/router.go`
- Modify: `backend/cmd/server/main.go`

- [ ] **Step 1: Create router with all routes**

Create `backend/internal/router/router.go`:

```go
package router

import (
	"net/http"
	"strings"

	"github.com/jdns/billingsystem/internal/handler"
	"github.com/jdns/billingsystem/internal/middleware"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/service"
)

type Deps struct {
	AuthService    *service.AuthService
	AuthHandler    *handler.AuthHandler
	UserHandler    *handler.UserHandler
	PlanHandler    *handler.PlanHandler
	SubHandler     *handler.SubscriptionHandler
	PaymentHandler *handler.PaymentHandler
	DashHandler    *handler.DashboardHandler
	MikroTikHandler *handler.MikroTikHandler
	NotifHandler   *handler.NotificationHandler
	CORSOrigins    string
}

func New(deps *Deps) http.Handler {
	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Auth (public)
	mux.HandleFunc("POST /api/auth/otp/request", deps.AuthHandler.RequestOTP)
	mux.HandleFunc("POST /api/auth/otp/verify", deps.AuthHandler.VerifyOTP)
	mux.HandleFunc("POST /api/auth/login", deps.AuthHandler.Login)
	mux.HandleFunc("POST /api/auth/refresh", deps.AuthHandler.Refresh)

	// Authenticated routes
	auth := middleware.Auth(deps.AuthService)
	adminOnly := middleware.AdminOnly()
	adminOrTech := middleware.AdminOrTech()

	// Users
	mux.Handle("GET /api/users", auth(adminOrTech(http.HandlerFunc(deps.UserHandler.List))))
	mux.Handle("GET /api/users/{id}", auth(http.HandlerFunc(deps.UserHandler.GetByID)))
	mux.Handle("POST /api/users", auth(adminOnly(http.HandlerFunc(deps.UserHandler.Create))))
	mux.Handle("PUT /api/users/{id}", auth(adminOnly(http.HandlerFunc(deps.UserHandler.Update))))
	mux.Handle("DELETE /api/users/{id}", auth(adminOnly(http.HandlerFunc(deps.UserHandler.Delete))))

	// Plans
	mux.Handle("GET /api/plans", auth(http.HandlerFunc(deps.PlanHandler.List)))
	mux.Handle("POST /api/plans", auth(adminOnly(http.HandlerFunc(deps.PlanHandler.Create))))
	mux.Handle("PUT /api/plans/{id}", auth(adminOnly(http.HandlerFunc(deps.PlanHandler.Update))))
	mux.Handle("DELETE /api/plans/{id}", auth(adminOnly(http.HandlerFunc(deps.PlanHandler.Delete))))

	// Subscriptions
	mux.Handle("GET /api/subscriptions", auth(adminOrTech(http.HandlerFunc(deps.SubHandler.List))))
	mux.Handle("GET /api/subscriptions/mine", auth(http.HandlerFunc(deps.SubHandler.GetMine)))
	mux.Handle("GET /api/subscriptions/{id}", auth(http.HandlerFunc(deps.SubHandler.GetByID)))
	mux.Handle("POST /api/subscriptions", auth(adminOnly(http.HandlerFunc(deps.SubHandler.Create))))
	mux.Handle("PUT /api/subscriptions/{id}", auth(adminOnly(http.HandlerFunc(deps.SubHandler.Update))))
	mux.Handle("POST /api/subscriptions/{id}/disconnect", auth(adminOnly(http.HandlerFunc(deps.SubHandler.Disconnect))))
	mux.Handle("POST /api/subscriptions/{id}/reconnect", auth(adminOnly(http.HandlerFunc(deps.SubHandler.Reconnect))))

	// Payments
	mux.Handle("GET /api/payments", auth(adminOrTech(http.HandlerFunc(deps.PaymentHandler.List))))
	mux.Handle("GET /api/payments/mine", auth(http.HandlerFunc(deps.PaymentHandler.ListMine)))
	mux.Handle("POST /api/payments", auth(middleware.RequireRole(model.RoleCustomer)(http.HandlerFunc(deps.PaymentHandler.Create))))
	mux.Handle("POST /api/payments/{id}/approve", auth(adminOrTech(http.HandlerFunc(deps.PaymentHandler.Approve))))
	mux.Handle("POST /api/payments/{id}/reject", auth(adminOrTech(http.HandlerFunc(deps.PaymentHandler.Reject))))

	// Dashboard & Reports
	mux.Handle("GET /api/dashboard/stats", auth(adminOnly(http.HandlerFunc(deps.DashHandler.GetStats))))
	mux.Handle("GET /api/reports/income", auth(adminOnly(http.HandlerFunc(deps.DashHandler.GetIncomeReport))))
	mux.Handle("GET /api/reports/unpaid", auth(adminOrTech(http.HandlerFunc(deps.SubHandler.List)))) // Filtered in frontend
	mux.Handle("GET /api/activity-logs", auth(adminOnly(http.HandlerFunc(deps.DashHandler.GetActivityLogs))))

	// MikroTik
	mux.Handle("GET /api/mikrotik/status", auth(adminOnly(http.HandlerFunc(deps.MikroTikHandler.GetStatus))))
	mux.Handle("GET /api/mikrotik/active-connections", auth(adminOrTech(http.HandlerFunc(deps.MikroTikHandler.GetActiveConnections))))

	// Notifications
	mux.Handle("POST /api/notifications/send-reminders", auth(adminOnly(http.HandlerFunc(deps.NotifHandler.SendReminders))))

	// Wrap with CORS
	return corsMiddleware(deps.CORSOrigins)(mux)
}

func corsMiddleware(origins string) func(http.Handler) http.Handler {
	allowedOrigins := strings.Split(origins, ",")
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			for _, allowed := range allowedOrigins {
				if strings.TrimSpace(allowed) == origin || strings.TrimSpace(allowed) == "*" {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					break
				}
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Max-Age", "86400")

			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
```

- [ ] **Step 2: Update main.go with full wiring**

Replace `backend/cmd/server/main.go` with:

```go
package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/jdns/billingsystem/internal/config"
	"github.com/jdns/billingsystem/internal/database"
	"github.com/jdns/billingsystem/internal/handler"
	"github.com/jdns/billingsystem/internal/mikrotik"
	"github.com/jdns/billingsystem/internal/repository"
	"github.com/jdns/billingsystem/internal/router"
	"github.com/jdns/billingsystem/internal/service"
	"github.com/jdns/billingsystem/internal/sms"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Database
	pool, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()
	log.Println("Connected to database")

	// Migrations
	migrationsDir := "migrations"
	if execPath, err := os.Executable(); err == nil {
		candidate := filepath.Join(filepath.Dir(execPath), "migrations")
		if _, err := os.Stat(candidate); err == nil {
			migrationsDir = candidate
		}
	}
	if err := database.RunMigrations(pool, migrationsDir); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	// Repositories
	userRepo := repository.NewUserRepo(pool)
	planRepo := repository.NewPlanRepo(pool)
	subRepo := repository.NewSubscriptionRepo(pool)
	paymentRepo := repository.NewPaymentRepo(pool)
	otpRepo := repository.NewOTPRepo(pool)
	logRepo := repository.NewActivityLogRepo(pool)
	dashRepo := repository.NewDashboardRepo(pool)

	// SMS Provider
	var smsProvider sms.Provider = sms.NewMockProvider()

	// MikroTik Client
	mtClient := mikrotik.NewClient(cfg.MikroTikHost, cfg.MikroTikPort, cfg.MikroTikUser, cfg.MikroTikPass)

	// Services
	authService := service.NewAuthService(userRepo, otpRepo, smsProvider, cfg.JWTSecret, cfg.JWTRefreshSecret)
	userService := service.NewUserService(userRepo, authService)
	planService := service.NewPlanService(planRepo)
	subService := service.NewSubscriptionService(subRepo, planRepo, mtClient)
	paymentService := service.NewPaymentService(paymentRepo, subRepo, subService)
	dashService := service.NewDashboardService(dashRepo, logRepo)

	// Handlers
	authHandler := handler.NewAuthHandler(authService)
	userHandler := handler.NewUserHandler(userService)
	planHandler := handler.NewPlanHandler(planService)
	subHandler := handler.NewSubscriptionHandler(subService)
	paymentHandler := handler.NewPaymentHandler(paymentService)
	dashHandler := handler.NewDashboardHandler(dashService, logRepo)
	mtHandler := handler.NewMikroTikHandler(mtClient)
	notifHandler := handler.NewNotificationHandler(subService, smsProvider)

	// Router
	h := router.New(&router.Deps{
		AuthService:     authService,
		AuthHandler:     authHandler,
		UserHandler:     userHandler,
		PlanHandler:     planHandler,
		SubHandler:      subHandler,
		PaymentHandler:  paymentHandler,
		DashHandler:     dashHandler,
		MikroTikHandler: mtHandler,
		NotifHandler:    notifHandler,
		CORSOrigins:     cfg.CORSOrigins,
	})

	addr := ":" + cfg.Port
	log.Printf("JDNS Billing API starting on %s", addr)
	if err := http.ListenAndServe(addr, h); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd /Users/dev3/billingsystem/backend && go mod tidy && go build ./cmd/server/
```

- [ ] **Step 4: Commit**

```bash
cd /Users/dev3/billingsystem
git add backend/
git commit -m "feat: wire router with all routes, middleware, CORS, and dependency injection"
```

---

## Task 11: Cron Scheduler (Background Jobs)

**Files:**
- Create: `backend/internal/cron/scheduler.go`
- Modify: `backend/cmd/server/main.go` (add cron start)

- [ ] **Step 1: Create scheduler**

Create `backend/internal/cron/scheduler.go`:

```go
package cron

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jdns/billingsystem/internal/service"
	"github.com/jdns/billingsystem/internal/sms"
)

type Scheduler struct {
	subService  *service.SubscriptionService
	smsProvider sms.Provider
	stop        chan struct{}
}

func NewScheduler(subService *service.SubscriptionService, smsProvider sms.Provider) *Scheduler {
	return &Scheduler{
		subService:  subService,
		smsProvider: smsProvider,
		stop:        make(chan struct{}),
	}
}

func (s *Scheduler) Start() {
	go s.runOverdueCheck()
	go s.runReminderCheck()
	log.Println("Cron scheduler started")
}

func (s *Scheduler) Stop() {
	close(s.stop)
}

func (s *Scheduler) runOverdueCheck() {
	// Run immediately on start, then every hour
	s.checkOverdue()
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.checkOverdue()
		case <-s.stop:
			return
		}
	}
}

func (s *Scheduler) checkOverdue() {
	ctx := context.Background()
	subs, err := s.subService.GetOverdue(ctx)
	if err != nil {
		log.Printf("[CRON] Error getting overdue subscriptions: %v", err)
		return
	}

	for _, sub := range subs {
		log.Printf("[CRON] Disconnecting overdue user: %s (%s)", sub.UserName, sub.UserPhone)
		if err := s.subService.Disconnect(ctx, sub.ID); err != nil {
			log.Printf("[CRON] Error disconnecting %s: %v", sub.UserName, err)
			continue
		}

		// Send disconnection SMS
		msg := fmt.Sprintf("Hi %s, your JDNS WiFi has been disconnected due to non-payment. Please pay to restore your connection.",
			sub.UserName)
		s.smsProvider.SendReminder(sub.UserPhone, msg)
	}

	if len(subs) > 0 {
		log.Printf("[CRON] Disconnected %d overdue users", len(subs))
	}
}

func (s *Scheduler) runReminderCheck() {
	// Run daily at 8 AM
	for {
		now := time.Now()
		next8AM := time.Date(now.Year(), now.Month(), now.Day(), 8, 0, 0, 0, now.Location())
		if now.After(next8AM) {
			next8AM = next8AM.Add(24 * time.Hour)
		}
		timer := time.NewTimer(time.Until(next8AM))

		select {
		case <-timer.C:
			s.sendReminders()
		case <-s.stop:
			timer.Stop()
			return
		}
	}
}

func (s *Scheduler) sendReminders() {
	ctx := context.Background()
	subs, err := s.subService.GetDueSoon(ctx, 2)
	if err != nil {
		log.Printf("[CRON] Error getting due-soon subscriptions: %v", err)
		return
	}

	sent := 0
	for _, sub := range subs {
		msg := fmt.Sprintf("Hi %s, your JDNS WiFi (P%.0f) is due on %s. Please pay to avoid disconnection.",
			sub.UserName, sub.PlanPrice, sub.NextDueDate.Format("Jan 2"))
		if err := s.smsProvider.SendReminder(sub.UserPhone, msg); err == nil {
			sent++
		}
	}
	log.Printf("[CRON] Sent %d payment reminders", sent)
}
```

- [ ] **Step 2: Add cron start to main.go**

Add after the router creation in `backend/cmd/server/main.go`, before the `ListenAndServe` call:

```go
	// Start cron scheduler
	cronScheduler := cron.NewScheduler(subService, smsProvider)
	cronScheduler.Start()
	defer cronScheduler.Stop()
```

And add `"github.com/jdns/billingsystem/internal/cron"` to imports.

- [ ] **Step 3: Verify it compiles**

```bash
cd /Users/dev3/billingsystem/backend && go build ./cmd/server/
```

- [ ] **Step 4: Commit**

```bash
cd /Users/dev3/billingsystem
git add backend/
git commit -m "feat: add cron scheduler for overdue checks and SMS reminders"
```

---

## Task 12: React Web App Scaffolding

**Files:**
- Create: `web/` directory with Vite + React + TypeScript + Tailwind

- [ ] **Step 1: Create React app with Vite**

```bash
cd /Users/dev3/billingsystem
npm create vite@latest web -- --template react-ts
cd web && npm install
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/dev3/billingsystem/web
npm install react-router-dom axios tailwindcss @tailwindcss/vite
npm install -D @types/react-router-dom
```

- [ ] **Step 3: Configure Tailwind**

Update `web/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080'
    }
  }
})
```

Replace `web/src/index.css` with:

```css
@import "tailwindcss";

@theme {
  --color-primary: #1E3A5F;
  --color-secondary: #2563EB;
  --color-accent: #059669;
  --color-warning: #F59E0B;
  --color-destructive: #DC2626;
  --color-bg-deep: #0a0a0f;
  --color-bg-surface: #0d1b2a;
  --color-bg-card: #112240;
  --color-border: rgba(255, 255, 255, 0.08);
  --color-text-primary: #FFFFFF;
  --color-text-secondary: #888888;
  --font-heading: 'Poppins', sans-serif;
  --font-body: 'Open Sans', sans-serif;
}

body {
  margin: 0;
  background: var(--color-bg-deep);
  color: var(--color-text-primary);
  font-family: var(--font-body);
}
```

- [ ] **Step 4: Create API client and types**

Create `web/src/lib/types.ts`:

```ts
export type UserRole = 'admin' | 'technician' | 'customer'
export type UserStatus = 'active' | 'inactive'
export type SubStatus = 'active' | 'overdue' | 'suspended'
export type PaymentMethod = 'gcash' | 'maya' | 'bank' | 'cash'
export type PaymentStatus = 'pending' | 'approved' | 'rejected'

export interface User {
  id: string
  phone: string
  full_name: string
  email?: string
  address?: string
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
  description?: string
  is_active: boolean
  created_at: string
}

export interface Subscription {
  id: string
  user_id: string
  plan_id: string
  ip_address?: string
  mac_address?: string
  billing_day: number
  next_due_date: string
  grace_days: number
  status: SubStatus
  mikrotik_queue_id?: string
  user_name: string
  user_phone: string
  plan_name: string
  plan_speed: number
  plan_price: number
  created_at: string
}

export interface Payment {
  id: string
  user_id: string
  subscription_id: string
  amount: number
  method: PaymentMethod
  reference_number?: string
  proof_image_url?: string
  status: PaymentStatus
  approved_by?: string
  billing_period_start: string
  billing_period_end: string
  notes?: string
  user_name: string
  user_phone: string
  approver_name: string
  created_at: string
}

export interface DashboardStats {
  total_customers: number
  active_customers: number
  overdue_count: number
  suspended_count: number
  monthly_income: number
  expected_income: number
  pending_payments: number
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  expires_in: number
}
```

Create `web/src/lib/auth.ts`:

```ts
import { TokenPair, UserRole } from './types'
import { jwtDecode } from 'jwt-decode'

interface JWTPayload {
  user_id: string
  role: UserRole
  exp: number
}

export function saveTokens(tokens: TokenPair) {
  localStorage.setItem('access_token', tokens.access_token)
  localStorage.setItem('refresh_token', tokens.refresh_token)
}

export function getAccessToken(): string | null {
  return localStorage.getItem('access_token')
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('refresh_token')
}

export function clearTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

export function getCurrentUser(): JWTPayload | null {
  const token = getAccessToken()
  if (!token) return null
  try {
    const payload = jwtDecode<JWTPayload>(token)
    if (payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function getUserRole(): UserRole | null {
  return getCurrentUser()?.role ?? null
}
```

Create `web/src/lib/api.ts`:

```ts
import axios from 'axios'
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from './auth'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = getRefreshToken()
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refresh_token: refreshToken })
          saveTokens(data)
          original.headers.Authorization = `Bearer ${data.access_token}`
          return api(original)
        } catch {
          clearTokens()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
```

- [ ] **Step 5: Install jwt-decode**

```bash
cd /Users/dev3/billingsystem/web && npm install jwt-decode
```

- [ ] **Step 6: Verify it builds**

```bash
cd /Users/dev3/billingsystem/web && npm run build
```

- [ ] **Step 7: Commit**

```bash
cd /Users/dev3/billingsystem
git add web/
git commit -m "feat: scaffold React web app with Vite, Tailwind, API client, auth, types"
```

---

## Task 13: React Web — Auth Pages

**Files:**
- Create: `web/src/pages/auth/AdminLogin.tsx`
- Create: `web/src/pages/auth/CustomerLogin.tsx`
- Create: `web/src/pages/auth/OTPVerify.tsx`
- Create: `web/src/components/ProtectedRoute.tsx`
- Modify: `web/src/App.tsx`

This task creates the login pages and routing. Due to the plan length, the remaining React page implementations (Tasks 13-17) follow the same pattern: create the page component, wire it to the API client, and add it to the router. Each page matches the mockups shown in the visual companion.

- [ ] **Step 1-5:** Create auth pages, ProtectedRoute, and App.tsx with React Router. (Full code follows the same patterns as above — each page calls `api.post`/`api.get`, uses the design tokens from globals.css, and implements the exact UI from the mockups.)

- [ ] **Step 6: Commit**

```bash
git add web/ && git commit -m "feat: add auth pages with admin login, customer OTP login"
```

---

## Task 14: React Web — Admin Dashboard Pages

Create all admin pages: Dashboard, Customers, CustomerDetail, Plans, Payments, Subscriptions, MikroTik, Reports, Staff, ActivityLogs, Settings. Each page follows the mockup layout with the sidebar navigation, stat cards, data tables, and action buttons.

- [ ] **Steps 1-12:** Create each admin page component with API integration.
- [ ] **Step 13: Commit**

```bash
git add web/ && git commit -m "feat: add admin dashboard with all management pages"
```

---

## Task 15: React Web — Customer Portal Pages

Create customer pages: Home (status card + quick actions), Pay (upload proof + QR code tabs), History (payment list).

- [ ] **Steps 1-4:** Create customer portal pages.
- [ ] **Step 5: Commit**

```bash
git add web/ && git commit -m "feat: add customer portal with payment and history pages"
```

---

## Task 16: React Web — Shared Components + Layout

Create Layout.tsx (admin sidebar), CustomerLayout.tsx, StatCard, StatusBadge, PaymentCard, DataTable components.

- [ ] **Steps 1-7:** Create all shared components.
- [ ] **Step 8: Commit**

```bash
git add web/ && git commit -m "feat: add shared components and layout wrappers"
```

---

## Task 17: Seed Data + Admin Setup Script

**Files:**
- Create: `backend/cmd/seed/main.go`

- [ ] **Step 1: Create seed script**

Create `backend/cmd/seed/main.go`:

```go
package main

import (
	"context"
	"log"

	"github.com/jdns/billingsystem/internal/config"
	"github.com/jdns/billingsystem/internal/database"
	"github.com/jdns/billingsystem/internal/model"
	"github.com/jdns/billingsystem/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Config: %v", err)
	}

	pool, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("DB: %v", err)
	}
	defer pool.Close()

	ctx := context.Background()
	userRepo := repository.NewUserRepo(pool)
	planRepo := repository.NewPlanRepo(pool)

	// Create admin user
	hash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
	hashStr := string(hash)
	admin := &model.User{
		Phone:        "09170000001",
		FullName:     "JDNS Admin",
		Role:         model.RoleAdmin,
		PasswordHash: &hashStr,
		Status:       model.UserStatusActive,
	}
	if err := userRepo.Create(ctx, admin); err != nil {
		log.Printf("Admin may already exist: %v", err)
	} else {
		log.Printf("Created admin: %s (phone: %s, password: admin123)", admin.FullName, admin.Phone)
	}

	// Create technician
	techHash, _ := bcrypt.GenerateFromPassword([]byte("tech123"), bcrypt.DefaultCost)
	techHashStr := string(techHash)
	tech := &model.User{
		Phone:        "09170000002",
		FullName:     "Mark Rivera (Technician)",
		Role:         model.RoleTechnician,
		PasswordHash: &techHashStr,
		Status:       model.UserStatusActive,
	}
	if err := userRepo.Create(ctx, tech); err != nil {
		log.Printf("Tech may already exist: %v", err)
	} else {
		log.Printf("Created technician: %s", tech.FullName)
	}

	// Create plans
	plans := []model.Plan{
		{Name: "10 Mbps Plan", SpeedMbps: 10, Price: 500},
		{Name: "20 Mbps Plan", SpeedMbps: 20, Price: 800},
		{Name: "50 Mbps Plan", SpeedMbps: 50, Price: 1500},
	}
	for i := range plans {
		if err := planRepo.Create(ctx, &plans[i]); err != nil {
			log.Printf("Plan may already exist: %v", err)
		} else {
			log.Printf("Created plan: %s - P%.0f/month", plans[i].Name, plans[i].Price)
		}
	}

	log.Println("Seed complete!")
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/dev3/billingsystem/backend && go build ./cmd/seed/
```

- [ ] **Step 3: Commit**

```bash
cd /Users/dev3/billingsystem
git add backend/cmd/seed/
git commit -m "feat: add seed script with admin, technician, and default plans"
```

---

## Task 18: Deployment Configuration

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/render.yaml`
- Create: `web/vercel.json`
- Create: `.env.example`

- [ ] **Step 1: Create Go Dockerfile**

Create `backend/Dockerfile`:

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o server ./cmd/server/

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/server .
COPY --from=builder /app/migrations ./migrations
EXPOSE 8080
CMD ["./server"]
```

- [ ] **Step 2: Create Vercel config**

Create `web/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 3: Create .env.example**

Create `.env.example`:

```env
DATABASE_URL=postgresql://user:pass@host/jdns?sslmode=require
JWT_SECRET=change-me-to-random-string
JWT_REFRESH_SECRET=change-me-to-another-random-string
MIKROTIK_HOST=your-public-ip
MIKROTIK_PORT=8728
MIKROTIK_USER=jdns-api
MIKROTIK_PASSWORD=your-mikrotik-password
SMS_PROVIDER=mock
SMS_API_KEY=
R2_ACCOUNT_ID=
R2_ACCESS_KEY=
R2_SECRET_KEY=
R2_BUCKET=jdns-payments
CORS_ORIGINS=http://localhost:5173,https://your-app.vercel.app
PORT=8080
```

- [ ] **Step 4: Commit**

```bash
cd /Users/dev3/billingsystem
git add backend/Dockerfile web/vercel.json .env.example
git commit -m "feat: add deployment config for Render (Docker) and Vercel"
```

---

## Summary

| Task | Description | Est. |
|------|-------------|------|
| 1 | Go project scaffolding + config | 5 min |
| 2 | Database connection + 6 migrations | 10 min |
| 3 | All models (6 structs + request types) | 10 min |
| 4 | All repositories (7 files, CRUD queries) | 20 min |
| 5 | Auth service (JWT + OTP + bcrypt + SMS) | 15 min |
| 6 | Middleware (auth + RBAC + rate limit) | 10 min |
| 7 | MikroTik client (queue CRUD) | 10 min |
| 8 | Services (business logic layer) | 15 min |
| 9 | HTTP handlers (9 files) | 20 min |
| 10 | Router wiring + CORS | 10 min |
| 11 | Cron scheduler (overdue + reminders) | 10 min |
| 12 | React scaffolding + API client + Tailwind | 10 min |
| 13 | Auth pages (admin login, OTP login) | 15 min |
| 14 | Admin dashboard (10+ pages) | 30 min |
| 15 | Customer portal (3 pages) | 15 min |
| 16 | Shared components + layouts | 15 min |
| 17 | Seed data script | 5 min |
| 18 | Deployment config (Docker + Vercel) | 5 min |
