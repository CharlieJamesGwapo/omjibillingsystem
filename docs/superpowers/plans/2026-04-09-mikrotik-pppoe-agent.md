# MikroTik PPPoE Management + Local Bridge Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PPPoE secret management (add/disable/enable/change-profile/kick) to the billing system, wired into the subscription lifecycle, with a local bridge agent so the Render cloud backend can reach a local MikroTik router via outbound WebSocket.

**Architecture:** A `MikroTikExecutor` interface is implemented by both the existing direct `Client` (for local dev) and a new `AgentHub` (for production via local agent). `SubscriptionService` picks whichever is available at runtime. The local agent is a standalone Go binary in `agent/` that connects outbound to the backend WebSocket endpoint and executes RouterOS API commands on the local MikroTik.

**Tech Stack:** Go 1.25, `github.com/go-routeros/routeros/v3`, `github.com/gorilla/websocket`, PostgreSQL/pgx, React + TypeScript (web UI).

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/migrations/010_add_pppoe_fields.sql` | Create | Add `mikrotik_profile` to plans, `pppoe_username`/`pppoe_password` to subscriptions |
| `backend/internal/model/plan.go` | Modify | Add `MikroTikProfile *string` field |
| `backend/internal/model/subscription.go` | Modify | Add `PPPoEUsername *string`, `PPPoEPassword *string` fields |
| `backend/internal/repository/plan_repo.go` | Modify | Include `mikrotik_profile` in all queries |
| `backend/internal/repository/subscription_repo.go` | Modify | Include pppoe columns in select/insert queries; add `UpdatePPPoECredentials` |
| `backend/internal/mikrotik/executor.go` | Create | `MikroTikExecutor` interface + `PPPoESecret` struct |
| `backend/internal/mikrotik/client.go` | Modify | Add PPPoE methods; implement `MikroTikExecutor` |
| `backend/internal/mikrotik/agent_hub.go` | Create | WebSocket broker; implements `MikroTikExecutor` via agent |
| `backend/internal/mikrotik/manager.go` | Modify | Expose `GetExecutor()` returning `MikroTikExecutor` |
| `backend/internal/service/subscription_service.go` | Modify | Inject `*AgentHub`; PPPoE-aware Create/Disconnect/Reconnect/MarkOverdue |
| `backend/internal/handler/mikrotik_handler.go` | Modify | Add PPPoE list endpoint + agent WebSocket upgrade |
| `backend/internal/router/router.go` | Modify | Register `/ws/agent`, `/api/mikrotik/pppoe/users` routes |
| `backend/cmd/server/main.go` | Modify | Wire `AgentHub` into services and handlers |
| `backend/go.mod` | Modify | Add `github.com/gorilla/websocket` |
| `agent/main.go` | Create | Standalone bridge agent binary |
| `agent/go.mod` | Create | Separate Go module for agent |
| `web/src/pages/admin/MikroTik.tsx` | Modify | Agent status indicator + PPPoE secrets tab |
| `web/src/pages/admin/Subscriptions.tsx` | Modify | PPPoE username/password fields in create form |
| `web/src/lib/types.ts` | Modify | Add `pppoe_username`, `pppoe_password`, `mikrotik_profile` to types |

---

## Task 1: DB Migration — PPPoE Fields

**Files:**
- Create: `backend/migrations/010_add_pppoe_fields.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/migrations/010_add_pppoe_fields.sql
ALTER TABLE plans ADD COLUMN IF NOT EXISTS mikrotik_profile TEXT;

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pppoe_username TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pppoe_password TEXT;
```

- [ ] **Step 2: Verify migration runs**

```bash
cd backend
docker compose up -d  # or ensure local DB is running
go run ./cmd/server/main.go &
sleep 3
# Check columns exist
psql "$DATABASE_URL" -c "\d subscriptions" | grep pppoe
psql "$DATABASE_URL" -c "\d plans" | grep mikrotik_profile
kill %1
```

Expected output: lines showing `pppoe_username`, `pppoe_password`, `mikrotik_profile` columns.

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/010_add_pppoe_fields.sql
git commit -m "feat: migration to add pppoe fields to subscriptions and plans"
```

---

## Task 2: Update Plan Model + Plan Repository

**Files:**
- Modify: `backend/internal/model/plan.go`
- Modify: `backend/internal/repository/plan_repo.go`

- [ ] **Step 1: Add `MikroTikProfile` to Plan model**

In `backend/internal/model/plan.go`, update all three structs:

```go
type Plan struct {
	ID              uuid.UUID `json:"id"`
	Name            string    `json:"name"`
	SpeedMbps       int       `json:"speed_mbps"`
	Price           float64   `json:"price"`
	Description     *string   `json:"description"`
	IsActive        bool      `json:"is_active"`
	MikroTikProfile *string   `json:"mikrotik_profile"`
	CreatedAt       time.Time `json:"created_at"`
}

type CreatePlanRequest struct {
	Name            string  `json:"name"`
	SpeedMbps       int     `json:"speed_mbps"`
	Price           float64 `json:"price"`
	Description     *string `json:"description"`
	IsActive        bool    `json:"is_active"`
	MikroTikProfile *string `json:"mikrotik_profile"`
}

type UpdatePlanRequest struct {
	Name            *string  `json:"name"`
	SpeedMbps       *int     `json:"speed_mbps"`
	Price           *float64 `json:"price"`
	Description     *string  `json:"description"`
	IsActive        *bool    `json:"is_active"`
	MikroTikProfile *string  `json:"mikrotik_profile"`
}
```

- [ ] **Step 2: Update plan_repo Create query**

In `backend/internal/repository/plan_repo.go`, replace the `Create` method:

```go
func (r *PlanRepo) Create(ctx context.Context, req *model.CreatePlanRequest) (*model.Plan, error) {
	p := &model.Plan{}
	err := r.db.QueryRow(ctx, `
		INSERT INTO plans (name, speed_mbps, price, description, is_active, mikrotik_profile)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, name, speed_mbps, price, description, is_active, mikrotik_profile, created_at`,
		req.Name, req.SpeedMbps, req.Price, req.Description, req.IsActive, req.MikroTikProfile,
	).Scan(&p.ID, &p.Name, &p.SpeedMbps, &p.Price, &p.Description, &p.IsActive, &p.MikroTikProfile, &p.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create plan: %w", err)
	}
	return p, nil
}
```

- [ ] **Step 3: Update plan_repo GetByID, GetByName, List queries**

Replace `GetByID`:
```go
func (r *PlanRepo) GetByID(ctx context.Context, id uuid.UUID) (*model.Plan, error) {
	p := &model.Plan{}
	err := r.db.QueryRow(ctx, `
		SELECT id, name, speed_mbps, price, description, is_active, mikrotik_profile, created_at
		FROM plans WHERE id = $1`, id,
	).Scan(&p.ID, &p.Name, &p.SpeedMbps, &p.Price, &p.Description, &p.IsActive, &p.MikroTikProfile, &p.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get plan by id: %w", err)
	}
	return p, nil
}
```

Replace `GetByName`:
```go
func (r *PlanRepo) GetByName(ctx context.Context, name string) (*model.Plan, error) {
	p := &model.Plan{}
	err := r.db.QueryRow(ctx, `
		SELECT id, name, speed_mbps, price, description, is_active, mikrotik_profile, created_at
		FROM plans WHERE name = $1`, name,
	).Scan(&p.ID, &p.Name, &p.SpeedMbps, &p.Price, &p.Description, &p.IsActive, &p.MikroTikProfile, &p.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get plan by name: %w", err)
	}
	return p, nil
}
```

Replace the scan inside `List`:
```go
func (r *PlanRepo) List(ctx context.Context, activeOnly bool) ([]*model.Plan, error) {
	query := `SELECT id, name, speed_mbps, price, description, is_active, mikrotik_profile, created_at FROM plans`
	if activeOnly {
		query += ` WHERE is_active = true`
	}
	query += ` ORDER BY price ASC`

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list plans: %w", err)
	}
	defer rows.Close()

	var plans []*model.Plan
	for rows.Next() {
		p := &model.Plan{}
		if err := rows.Scan(&p.ID, &p.Name, &p.SpeedMbps, &p.Price, &p.Description, &p.IsActive, &p.MikroTikProfile, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan plan: %w", err)
		}
		plans = append(plans, p)
	}
	return plans, rows.Err()
}
```

- [ ] **Step 4: Update plan_repo Update to handle MikroTikProfile**

In the `Update` method, add this block after the `IsActive` block:

```go
if req.MikroTikProfile != nil {
    setClauses = append(setClauses, fmt.Sprintf("mikrotik_profile = $%d", argIdx))
    args = append(args, *req.MikroTikProfile)
    argIdx++
}
```

Also update the `RETURNING` clause and the `Scan` call in `Update`:

```go
query := fmt.Sprintf(`UPDATE plans SET %s WHERE id = $%d
    RETURNING id, name, speed_mbps, price, description, is_active, mikrotik_profile, created_at`,
    strings.Join(setClauses, ", "), argIdx)

p := &model.Plan{}
err := r.db.QueryRow(ctx, query, args...).Scan(
    &p.ID, &p.Name, &p.SpeedMbps, &p.Price, &p.Description, &p.IsActive, &p.MikroTikProfile, &p.CreatedAt,
)
```

- [ ] **Step 5: Build to verify no compile errors**

```bash
cd backend
go build ./...
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/model/plan.go backend/internal/repository/plan_repo.go
git commit -m "feat: add mikrotik_profile field to Plan model and repository"
```

---

## Task 3: Update Subscription Model + Repository

**Files:**
- Modify: `backend/internal/model/subscription.go`
- Modify: `backend/internal/repository/subscription_repo.go`

- [ ] **Step 1: Add PPPoE fields to Subscription model**

In `backend/internal/model/subscription.go`, add to `Subscription` struct after `MikroTikQueueID`:

```go
type Subscription struct {
	ID              uuid.UUID          `json:"id"`
	UserID          uuid.UUID          `json:"user_id"`
	PlanID          uuid.UUID          `json:"plan_id"`
	IPAddress       *string            `json:"ip_address"`
	MACAddress      *string            `json:"mac_address"`
	BillingDay      int                `json:"billing_day"`
	NextDueDate     time.Time          `json:"next_due_date"`
	GraceDays       int                `json:"grace_days"`
	Status          SubscriptionStatus `json:"status"`
	MikroTikQueueID *string            `json:"mikrotik_queue_id"`
	PPPoEUsername   *string            `json:"pppoe_username"`
	PPPoEPassword   *string            `json:"pppoe_password"`
	CreatedAt       time.Time          `json:"created_at"`
	UpdatedAt       time.Time          `json:"updated_at"`

	// Joined fields
	UserName  string  `json:"user_name,omitempty"`
	UserPhone string  `json:"user_phone,omitempty"`
	PlanName  string  `json:"plan_name,omitempty"`
	PlanSpeed int     `json:"plan_speed,omitempty"`
	PlanPrice float64 `json:"plan_price,omitempty"`
}
```

Add to `CreateSubscriptionRequest`:

```go
type CreateSubscriptionRequest struct {
	UserID        uuid.UUID `json:"user_id"`
	PlanID        uuid.UUID `json:"plan_id"`
	IPAddress     *string   `json:"ip_address"`
	MACAddress    *string   `json:"mac_address"`
	BillingDay    int       `json:"billing_day"`
	GraceDays     *int      `json:"grace_days"`
	PPPoEUsername *string   `json:"pppoe_username"`
	PPPoEPassword *string   `json:"pppoe_password"`
}
```

- [ ] **Step 2: Update subscription_repo select constant and scanSubscription**

In `backend/internal/repository/subscription_repo.go`, replace `subscriptionSelectJoin` and `scanSubscription`:

```go
const subscriptionSelectJoin = `
	SELECT s.id, s.user_id, s.plan_id, s.ip_address, s.mac_address, s.billing_day,
	       s.next_due_date, s.grace_days, s.status, s.mikrotik_queue_id,
	       s.pppoe_username, s.pppoe_password,
	       s.created_at, s.updated_at,
	       u.full_name, u.phone, p.name, p.speed_mbps, p.price
	FROM subscriptions s
	JOIN users u ON u.id = s.user_id
	JOIN plans p ON p.id = s.plan_id`

func scanSubscription(row interface{ Scan(...interface{}) error }) (*model.Subscription, error) {
	s := &model.Subscription{}
	err := row.Scan(
		&s.ID, &s.UserID, &s.PlanID, &s.IPAddress, &s.MACAddress, &s.BillingDay,
		&s.NextDueDate, &s.GraceDays, &s.Status, &s.MikroTikQueueID,
		&s.PPPoEUsername, &s.PPPoEPassword,
		&s.CreatedAt, &s.UpdatedAt,
		&s.UserName, &s.UserPhone, &s.PlanName, &s.PlanSpeed, &s.PlanPrice,
	)
	return s, err
}
```

- [ ] **Step 3: Update subscription_repo Create to insert PPPoE fields**

Replace the `Create` method:

```go
func (r *SubscriptionRepo) Create(ctx context.Context, req *model.CreateSubscriptionRequest) (*model.Subscription, error) {
	graceDays := 2
	if req.GraceDays != nil {
		graceDays = *req.GraceDays
	}

	now := time.Now()
	nextDue := time.Date(now.Year(), now.Month(), req.BillingDay, 0, 0, 0, 0, time.UTC)
	if nextDue.Before(now) || nextDue.Equal(now) {
		nextDue = nextDue.AddDate(0, 1, 0)
	}

	var subID uuid.UUID
	err := r.db.QueryRow(ctx, `
		INSERT INTO subscriptions (user_id, plan_id, ip_address, mac_address, billing_day, next_due_date, grace_days, pppoe_username, pppoe_password)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id`,
		req.UserID, req.PlanID, req.IPAddress, req.MACAddress, req.BillingDay, nextDue, graceDays,
		req.PPPoEUsername, req.PPPoEPassword,
	).Scan(&subID)
	if err != nil {
		return nil, fmt.Errorf("create subscription: %w", err)
	}
	return r.GetByID(ctx, subID)
}
```

- [ ] **Step 4: Add UpdatePPPoECredentials method**

Add at end of subscription_repo.go:

```go
func (r *SubscriptionRepo) UpdatePPPoECredentials(ctx context.Context, id uuid.UUID, username, password *string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE subscriptions SET pppoe_username = $1, pppoe_password = $2, updated_at = NOW() WHERE id = $3`,
		username, password, id)
	if err != nil {
		return fmt.Errorf("update pppoe credentials: %w", err)
	}
	return nil
}
```

- [ ] **Step 5: Build to verify no compile errors**

```bash
cd backend
go build ./...
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/model/subscription.go backend/internal/repository/subscription_repo.go
git commit -m "feat: add pppoe_username and pppoe_password to Subscription model and repository"
```

---

## Task 4: MikroTikExecutor Interface + PPPoE Client Methods

**Files:**
- Create: `backend/internal/mikrotik/executor.go`
- Modify: `backend/internal/mikrotik/client.go`

- [ ] **Step 1: Create executor.go with interface and PPPoESecret struct**

```go
// backend/internal/mikrotik/executor.go
package mikrotik

// PPPoESecret represents a PPPoE secret entry from MikroTik.
type PPPoESecret struct {
	Name     string
	Password string
	Profile  string
	Disabled bool
	Comment  string
}

// MikroTikExecutor is the interface for all MikroTik operations.
// Implemented by *Client (direct) and *AgentHub (via local agent).
type MikroTikExecutor interface {
	IsConnected() bool

	// PPPoE secrets management
	AddPPPoESecret(username, password, profile string) error
	DisablePPPoEUser(username string) error
	EnablePPPoEUser(username string) error
	SetPPPoEProfile(username, profile string) error
	KickPPPoESession(username string) error
	DeletePPPoESecret(username string) error
	GetPPPoESecrets() ([]PPPoESecret, error)

	// Simple queue management (existing)
	CreateQueue(name, targetIP, maxUpload, maxDownload string) (string, error)
	DisableQueue(queueID string) error
	EnableQueue(queueID string) error
	UpdateQueueSpeed(queueID, maxUpload, maxDownload string) error
	DeleteQueue(queueID string) error
}
```

- [ ] **Step 2: Add PPPoE methods to client.go**

Add these methods at the end of `backend/internal/mikrotik/client.go`:

```go
// AddPPPoESecret creates a PPPoE secret in /ppp/secret.
func (c *Client) AddPPPoESecret(username, password, profile string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	_, err = client.Run(
		"/ppp/secret/add",
		"=name="+username,
		"=password="+password,
		"=profile="+profile,
		"=service=pppoe",
	)
	if err != nil {
		return fmt.Errorf("add pppoe secret %q: %w", username, err)
	}
	return nil
}

// DisablePPPoEUser sets disabled=yes on the PPPoE secret and kicks the active session.
func (c *Client) DisablePPPoEUser(username string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	_, err = client.Run(
		"/ppp/secret/set",
		"=numbers="+username,
		"=disabled=yes",
	)
	if err != nil {
		return fmt.Errorf("disable pppoe user %q: %w", username, err)
	}
	return c.kickSession(client, username)
}

// EnablePPPoEUser sets disabled=no on the PPPoE secret.
func (c *Client) EnablePPPoEUser(username string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	_, err = client.Run(
		"/ppp/secret/set",
		"=numbers="+username,
		"=disabled=no",
	)
	if err != nil {
		return fmt.Errorf("enable pppoe user %q: %w", username, err)
	}
	return nil
}

// SetPPPoEProfile changes the profile for a PPPoE secret and kicks the active session.
func (c *Client) SetPPPoEProfile(username, profile string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	_, err = client.Run(
		"/ppp/secret/set",
		"=numbers="+username,
		"=profile="+profile,
	)
	if err != nil {
		return fmt.Errorf("set pppoe profile %q -> %q: %w", username, profile, err)
	}
	return c.kickSession(client, username)
}

// KickPPPoESession removes the active PPPoE session for a user (forces re-dial).
func (c *Client) KickPPPoESession(username string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()
	return c.kickSession(client, username)
}

// kickSession removes the active PPPoE session for username using an open client connection.
func (c *Client) kickSession(client interface {
	Run(...string) (*routeros.Reply, error)
}, username string) error {
	reply, err := client.Run(
		"/ppp/active/print",
		"?name="+username,
		"=.proplist=.id",
	)
	if err != nil {
		return nil // no active session is not an error
	}
	for _, re := range reply.Re {
		id := re.Map[".id"]
		if id == "" {
			continue
		}
		_, _ = client.Run("/ppp/active/remove", "=.id="+id)
	}
	return nil
}

// DeletePPPoESecret removes a PPPoE secret from MikroTik.
func (c *Client) DeletePPPoESecret(username string) error {
	client, err := c.connect()
	if err != nil {
		return err
	}
	defer client.Close()

	reply, err := client.Run("/ppp/secret/print", "?name="+username, "=.proplist=.id")
	if err != nil {
		return fmt.Errorf("find pppoe secret %q: %w", username, err)
	}
	for _, re := range reply.Re {
		id := re.Map[".id"]
		if id == "" {
			continue
		}
		if _, err := client.Run("/ppp/secret/remove", "=.id="+id); err != nil {
			return fmt.Errorf("delete pppoe secret %q: %w", username, err)
		}
	}
	return nil
}

// GetPPPoESecrets returns all PPPoE secrets.
func (c *Client) GetPPPoESecrets() ([]PPPoESecret, error) {
	client, err := c.connect()
	if err != nil {
		return nil, err
	}
	defer client.Close()

	reply, err := client.Run("/ppp/secret/print")
	if err != nil {
		return nil, fmt.Errorf("get pppoe secrets: %w", err)
	}

	secrets := make([]PPPoESecret, 0, len(reply.Re))
	for _, re := range reply.Re {
		secrets = append(secrets, PPPoESecret{
			Name:     re.Map["name"],
			Password: re.Map["password"],
			Profile:  re.Map["profile"],
			Disabled: re.Map["disabled"] == "true",
			Comment:  re.Map["comment"],
		})
	}
	return secrets, nil
}
```

- [ ] **Step 3: Fix kickSession signature — use routeros.Client directly**

The `kickSession` helper uses a concrete type. Replace it with a method on `*routeros.Client`:

Find the import at top of client.go. It already imports `routeros "github.com/go-routeros/routeros/v3"`. Change `kickSession` to accept `*routeros.Client`:

```go
func (c *Client) kickSession(conn *routeros.Client, username string) error {
	reply, err := conn.Run(
		"/ppp/active/print",
		"?name="+username,
		"=.proplist=.id",
	)
	if err != nil {
		return nil
	}
	for _, re := range reply.Re {
		id := re.Map[".id"]
		if id == "" {
			continue
		}
		_, _ = conn.Run("/ppp/active/remove", "=.id="+id)
	}
	return nil
}
```

Update `DisablePPPoEUser` and `SetPPPoEProfile` to use `kickSession(client, username)` where `client` is the `*routeros.Client` from `c.connect()`.

- [ ] **Step 4: Build to confirm Client implements MikroTikExecutor**

Add a compile-time check at the bottom of `executor.go`:

```go
// Compile-time interface check.
var _ MikroTikExecutor = (*Client)(nil)
```

```bash
cd backend
go build ./...
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/mikrotik/executor.go backend/internal/mikrotik/client.go
git commit -m "feat: add MikroTikExecutor interface and PPPoE methods to MikroTik client"
```

---

## Task 5: AgentHub — WebSocket Command Broker

**Files:**
- Create: `backend/internal/mikrotik/agent_hub.go`
- Modify: `backend/go.mod` (add gorilla/websocket)

- [ ] **Step 1: Add gorilla/websocket dependency**

```bash
cd backend
go get github.com/gorilla/websocket@v1.5.3
```

Expected: go.mod and go.sum updated.

- [ ] **Step 2: Create agent_hub.go**

```go
// backend/internal/mikrotik/agent_hub.go
package mikrotik

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// AgentCommand is sent from backend to agent.
type AgentCommand struct {
	ID     string            `json:"id"`
	Op     string            `json:"op"`
	Params map[string]string `json:"params"`
}

// AgentResponse is received from agent.
type AgentResponse struct {
	ID    string              `json:"id"`
	OK    bool                `json:"ok"`
	Error string              `json:"error"`
	Data  []map[string]string `json:"data,omitempty"`
}

// AgentHub manages a single connected local agent over WebSocket.
// It implements MikroTikExecutor by proxying all operations to the agent.
type AgentHub struct {
	secret   string
	mu       sync.Mutex
	conn     *websocket.Conn
	pending  map[string]chan AgentResponse
	upgrader websocket.Upgrader
}

// NewAgentHub creates a new AgentHub with the given shared secret.
func NewAgentHub(secret string) *AgentHub {
	return &AgentHub{
		secret:  secret,
		pending: make(map[string]chan AgentResponse),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

// IsConnected returns true if a local agent is currently connected.
func (h *AgentHub) IsConnected() bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.conn != nil
}

// ServeHTTP upgrades the connection to WebSocket and registers the agent.
// The agent must send the secret as the first message.
func (h *AgentHub) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[AgentHub] WebSocket upgrade error: %v", err)
		return
	}

	// Expect auth message: {"secret":"..."}
	var auth struct {
		Secret string `json:"secret"`
	}
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	if err := conn.ReadJSON(&auth); err != nil || auth.Secret != h.secret {
		conn.WriteMessage(websocket.CloseMessage, []byte("unauthorized"))
		conn.Close()
		log.Printf("[AgentHub] Agent rejected: invalid secret")
		return
	}
	conn.SetReadDeadline(time.Time{}) // no deadline after auth

	h.mu.Lock()
	if h.conn != nil {
		h.conn.Close() // disconnect previous agent
	}
	h.conn = conn
	h.mu.Unlock()

	log.Printf("[AgentHub] Local agent connected from %s", r.RemoteAddr)

	// Read responses from agent
	for {
		var resp AgentResponse
		if err := conn.ReadJSON(&resp); err != nil {
			log.Printf("[AgentHub] Agent disconnected: %v", err)
			break
		}
		h.mu.Lock()
		ch, ok := h.pending[resp.ID]
		if ok {
			delete(h.pending, resp.ID)
		}
		h.mu.Unlock()
		if ok {
			ch <- resp
		}
	}

	h.mu.Lock()
	if h.conn == conn {
		h.conn = nil
	}
	h.mu.Unlock()
}

// execute sends a command to the agent and waits for a response (10s timeout).
func (h *AgentHub) execute(op string, params map[string]string) ([]map[string]string, error) {
	h.mu.Lock()
	conn := h.conn
	if conn == nil {
		h.mu.Unlock()
		return nil, fmt.Errorf("no local agent connected")
	}
	cmdID := uuid.New().String()
	ch := make(chan AgentResponse, 1)
	h.pending[cmdID] = ch
	h.mu.Unlock()

	cmd := AgentCommand{ID: cmdID, Op: op, Params: params}
	if err := conn.WriteJSON(cmd); err != nil {
		h.mu.Lock()
		delete(h.pending, cmdID)
		h.mu.Unlock()
		return nil, fmt.Errorf("send command to agent: %w", err)
	}

	select {
	case resp := <-ch:
		if !resp.OK {
			return nil, fmt.Errorf("agent error: %s", resp.Error)
		}
		return resp.Data, nil
	case <-time.After(10 * time.Second):
		h.mu.Lock()
		delete(h.pending, cmdID)
		h.mu.Unlock()
		return nil, fmt.Errorf("agent command timed out: %s", op)
	}
}

// --- MikroTikExecutor implementation ---

func (h *AgentHub) AddPPPoESecret(username, password, profile string) error {
	_, err := h.execute("pppoe_add", map[string]string{
		"username": username, "password": password, "profile": profile,
	})
	return err
}

func (h *AgentHub) DisablePPPoEUser(username string) error {
	_, err := h.execute("pppoe_disable", map[string]string{"username": username})
	return err
}

func (h *AgentHub) EnablePPPoEUser(username string) error {
	_, err := h.execute("pppoe_enable", map[string]string{"username": username})
	return err
}

func (h *AgentHub) SetPPPoEProfile(username, profile string) error {
	_, err := h.execute("pppoe_set_profile", map[string]string{
		"username": username, "profile": profile,
	})
	return err
}

func (h *AgentHub) KickPPPoESession(username string) error {
	_, err := h.execute("pppoe_kick", map[string]string{"username": username})
	return err
}

func (h *AgentHub) DeletePPPoESecret(username string) error {
	_, err := h.execute("pppoe_delete", map[string]string{"username": username})
	return err
}

func (h *AgentHub) GetPPPoESecrets() ([]PPPoESecret, error) {
	data, err := h.execute("pppoe_list", nil)
	if err != nil {
		return nil, err
	}
	secrets := make([]PPPoESecret, 0, len(data))
	for _, m := range data {
		secrets = append(secrets, PPPoESecret{
			Name:     m["name"],
			Password: m["password"],
			Profile:  m["profile"],
			Disabled: m["disabled"] == "true",
			Comment:  m["comment"],
		})
	}
	return secrets, nil
}

func (h *AgentHub) CreateQueue(name, targetIP, maxUpload, maxDownload string) (string, error) {
	data, err := h.execute("queue_create", map[string]string{
		"name": name, "target": targetIP, "upload": maxUpload, "download": maxDownload,
	})
	if err != nil {
		return "", err
	}
	if len(data) > 0 {
		return data[0]["id"], nil
	}
	return "", nil
}

func (h *AgentHub) DisableQueue(queueID string) error {
	_, err := h.execute("queue_disable", map[string]string{"id": queueID})
	return err
}

func (h *AgentHub) EnableQueue(queueID string) error {
	_, err := h.execute("queue_enable", map[string]string{"id": queueID})
	return err
}

func (h *AgentHub) UpdateQueueSpeed(queueID, maxUpload, maxDownload string) error {
	_, err := h.execute("queue_update", map[string]string{
		"id": queueID, "upload": maxUpload, "download": maxDownload,
	})
	return err
}

func (h *AgentHub) DeleteQueue(queueID string) error {
	_, err := h.execute("queue_delete", map[string]string{"id": queueID})
	return err
}

// Compile-time interface check.
var _ MikroTikExecutor = (*AgentHub)(nil)
```

- [ ] **Step 3: Build to verify**

```bash
cd backend
go build ./...
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/mikrotik/agent_hub.go backend/go.mod backend/go.sum
git commit -m "feat: add AgentHub WebSocket broker implementing MikroTikExecutor"
```

---

## Task 6: Update SubscriptionService — PPPoE Lifecycle

**Files:**
- Modify: `backend/internal/service/subscription_service.go`

- [ ] **Step 1: Add AgentHub injection and getMTExecutor helper**

Replace the entire `SubscriptionService` struct and constructor:

```go
// SubscriptionService handles business logic for customer subscriptions.
type SubscriptionService struct {
	subRepo   *repository.SubscriptionRepo
	planRepo  *repository.PlanRepo
	mtManager *mikrotik.Manager
	agentHub  *mikrotik.AgentHub
}

// NewSubscriptionService creates a new SubscriptionService.
func NewSubscriptionService(
	subRepo *repository.SubscriptionRepo,
	planRepo *repository.PlanRepo,
	mtManager *mikrotik.Manager,
	agentHub *mikrotik.AgentHub,
) *SubscriptionService {
	return &SubscriptionService{
		subRepo:   subRepo,
		planRepo:  planRepo,
		mtManager: mtManager,
		agentHub:  agentHub,
	}
}

// getMTExecutor returns the best available MikroTik executor:
// agent hub if connected, otherwise direct client, otherwise nil.
// NOTE: explicit nil check required to avoid non-nil interface with nil pointer (Go gotcha).
func (s *SubscriptionService) getMTExecutor() mikrotik.MikroTikExecutor {
	if s.agentHub != nil && s.agentHub.IsConnected() {
		return s.agentHub
	}
	if c := s.mtManager.Get(); c != nil {
		return c
	}
	return nil
}

// planProfile returns the MikroTik profile name for a plan.
// Uses MikroTikProfile if set, otherwise falls back to plan Name.
func planProfile(plan *model.Plan) string {
	if plan.MikroTikProfile != nil && *plan.MikroTikProfile != "" {
		return *plan.MikroTikProfile
	}
	return plan.Name
}
```

- [ ] **Step 2: Update Create to provision PPPoE secret**

Replace the `Create` method:

```go
func (s *SubscriptionService) Create(ctx context.Context, req *model.CreateSubscriptionRequest) (*model.Subscription, error) {
	if req.BillingDay > 28 {
		req.BillingDay = 28
	}
	if req.BillingDay < 1 {
		req.BillingDay = 1
	}
	if req.GraceDays == nil {
		defaultGrace := 2
		req.GraceDays = &defaultGrace
	}

	sub, err := s.subRepo.Create(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("create subscription: %w", err)
	}

	mt := s.getMTExecutor()
	if mt != nil {
		plan, planErr := s.planRepo.GetByID(ctx, req.PlanID)
		if planErr == nil {
			// Provision PPPoE secret
			if req.PPPoEUsername != nil && *req.PPPoEUsername != "" {
				password := ""
				if req.PPPoEPassword != nil {
					password = *req.PPPoEPassword
				}
				profile := planProfile(plan)
				if err := mt.AddPPPoESecret(*req.PPPoEUsername, password, profile); err != nil {
					log.Printf("[MikroTik] AddPPPoESecret failed for %s: %v", *req.PPPoEUsername, err)
				}
			}

			// Create Simple Queue (IP-based, existing behavior)
			if req.IPAddress != nil && *req.IPAddress != "" {
				speed := fmt.Sprintf("%dM", plan.SpeedMbps)
				queueName := fmt.Sprintf("sub-%s", sub.ID.String())
				queueID, err := mt.CreateQueue(queueName, *req.IPAddress, speed, speed)
				if err == nil && queueID != "" {
					_ = s.subRepo.UpdateMikroTikQueueID(ctx, sub.ID, &queueID)
					sub.MikroTikQueueID = &queueID
				}
			}
		}
	}

	return sub, nil
}
```

Add `"log"` to the import if not present.

- [ ] **Step 3: Update Disconnect to handle PPPoE**

Replace the `Disconnect` method:

```go
func (s *SubscriptionService) Disconnect(ctx context.Context, id uuid.UUID) error {
	sub, err := s.subRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("get subscription: %w", err)
	}

	if mt := s.getMTExecutor(); mt != nil {
		// PPPoE: disable user (also kicks session)
		if sub.PPPoEUsername != nil && *sub.PPPoEUsername != "" {
			if err := mt.DisablePPPoEUser(*sub.PPPoEUsername); err != nil {
				log.Printf("[MikroTik] DisablePPPoEUser %s: %v", *sub.PPPoEUsername, err)
			}
		}
		// Queue: disable if present
		if sub.MikroTikQueueID != nil && *sub.MikroTikQueueID != "" {
			if err := mt.DisableQueue(*sub.MikroTikQueueID); err != nil {
				log.Printf("[MikroTik] DisableQueue %s: %v", *sub.MikroTikQueueID, err)
			}
		}
	}

	return s.subRepo.UpdateStatus(ctx, id, model.SubStatusSuspended)
}
```

- [ ] **Step 4: Update Reconnect to handle PPPoE**

Replace the `Reconnect` method:

```go
func (s *SubscriptionService) Reconnect(ctx context.Context, id uuid.UUID) error {
	sub, err := s.subRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("get subscription: %w", err)
	}

	if mt := s.getMTExecutor(); mt != nil {
		if sub.PPPoEUsername != nil && *sub.PPPoEUsername != "" {
			// Re-enable user
			if err := mt.EnablePPPoEUser(*sub.PPPoEUsername); err != nil {
				log.Printf("[MikroTik] EnablePPPoEUser %s: %v", *sub.PPPoEUsername, err)
			}
			// Restore plan profile
			plan, planErr := s.planRepo.GetByID(ctx, sub.PlanID)
			if planErr == nil {
				if err := mt.SetPPPoEProfile(*sub.PPPoEUsername, planProfile(plan)); err != nil {
					log.Printf("[MikroTik] SetPPPoEProfile %s: %v", *sub.PPPoEUsername, err)
				}
			}
		}
		if sub.MikroTikQueueID != nil && *sub.MikroTikQueueID != "" {
			if err := mt.EnableQueue(*sub.MikroTikQueueID); err != nil {
				log.Printf("[MikroTik] EnableQueue %s: %v", *sub.MikroTikQueueID, err)
			}
		}
	}

	return s.subRepo.UpdateStatus(ctx, id, model.SubStatusActive)
}
```

- [ ] **Step 5: Add MarkOverdue method for cron**

Add this new method (used in Task 8 for cron):

```go
// MarkOverdue sets a subscription to overdue status and changes PPPoE profile to "unpaid".
func (s *SubscriptionService) MarkOverdue(ctx context.Context, id uuid.UUID) error {
	sub, err := s.subRepo.GetByID(ctx, id)
	if err != nil {
		return fmt.Errorf("get subscription: %w", err)
	}

	if mt := s.getMTExecutor(); mt != nil {
		if sub.PPPoEUsername != nil && *sub.PPPoEUsername != "" {
			if err := mt.SetPPPoEProfile(*sub.PPPoEUsername, "unpaid"); err != nil {
				log.Printf("[MikroTik] SetPPPoEProfile unpaid %s: %v", *sub.PPPoEUsername, err)
			}
		}
	}

	return s.subRepo.UpdateStatus(ctx, id, model.SubStatusOverdue)
}
```

- [ ] **Step 6: Build to verify**

```bash
cd backend
go build ./...
```

Expected: compile error about `NewSubscriptionService` call site in `main.go` (we fix that in Task 8). Fix by noting this now; proceed.

- [ ] **Step 7: Commit**

```bash
git add backend/internal/service/subscription_service.go
git commit -m "feat: wire PPPoE lifecycle into SubscriptionService (create, disconnect, reconnect, overdue)"
```

---

## Task 7: PPPoE Handler Endpoints + Agent WebSocket Route

**Files:**
- Modify: `backend/internal/handler/mikrotik_handler.go`
- Modify: `backend/internal/router/router.go`

- [ ] **Step 1: Add AgentHub to MikroTikHandler and update constructor**

In `backend/internal/handler/mikrotik_handler.go`, replace the struct and constructor:

```go
type MikroTikHandler struct {
	manager      *mikrotik.Manager
	agentHub     *mikrotik.AgentHub
	settingsRepo *repository.SettingsRepo
}

func NewMikroTikHandler(manager *mikrotik.Manager, agentHub *mikrotik.AgentHub, settingsRepo *repository.SettingsRepo) *MikroTikHandler {
	return &MikroTikHandler{manager: manager, agentHub: agentHub, settingsRepo: settingsRepo}
}
```

- [ ] **Step 2: Update GetStatus to include agent status**

Replace `GetStatus`:

```go
func (h *MikroTikHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	agentConnected := h.agentHub.IsConnected()
	directConnected := h.manager.IsConnected()

	result := map[string]interface{}{
		"connected":       agentConnected || directConnected,
		"agent_connected": agentConnected,
		"direct_connected": directConnected,
	}

	writeJSON(w, http.StatusOK, result)
}
```

- [ ] **Step 3: Add ListPPPoESecrets handler**

Add at end of `mikrotik_handler.go`:

```go
// ListPPPoESecrets returns all PPPoE secrets from MikroTik.
func (h *MikroTikHandler) ListPPPoESecrets(w http.ResponseWriter, r *http.Request) {
	var executor mikrotik.MikroTikExecutor
	if h.agentHub.IsConnected() {
		executor = h.agentHub
	} else {
		executor = h.manager.Get()
	}
	if executor == nil {
		writeError(w, http.StatusServiceUnavailable, "MikroTik not connected")
		return
	}

	secrets, err := executor.GetPPPoESecrets()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list PPPoE secrets")
		return
	}
	writeJSON(w, http.StatusOK, secrets)
}
```

- [ ] **Step 4: Update router.go — add Deps field and new routes**

In `backend/internal/router/router.go`, add `AgentHub` to `Deps`:

```go
type Deps struct {
	AuthService  *service.AuthService
	AuthHandler  *handler.AuthHandler
	UserHandler  *handler.UserHandler
	PlanHandler  *handler.PlanHandler
	SubHandler   *handler.SubscriptionHandler
	PayHandler   *handler.PaymentHandler
	DashHandler  *handler.DashboardHandler
	MTHandler       *handler.MikroTikHandler
	NotifHandler    *handler.NotificationHandler
	SettingsHandler *handler.SettingsHandler
	MsgHandler      *handler.MessageHandler
	AgentHub        *mikrotik.AgentHub
}
```

Add import for `mikrotik` package in router.go:
```go
"github.com/jdns/billingsystem/internal/mikrotik"
```

Add new routes after the existing MikroTik routes:

```go
// --- MikroTik (existing) ---
mux.Handle("GET /api/mikrotik/status", chain(deps.MTHandler.GetStatus, authMW, adminOnly))
mux.Handle("GET /api/mikrotik/connections", chain(deps.MTHandler.GetActiveConnections, authMW, adminOrTech))
mux.Handle("POST /api/mikrotik/test", chain(deps.MTHandler.TestConnection, authMW, adminOnly))
mux.Handle("POST /api/mikrotik/connect", chain(deps.MTHandler.SaveAndConnect, authMW, adminOnly))

// --- MikroTik PPPoE ---
mux.Handle("GET /api/mikrotik/pppoe/secrets", chain(deps.MTHandler.ListPPPoESecrets, authMW, adminOrTech))

// --- Agent WebSocket (no auth middleware — uses secret token) ---
mux.Handle("GET /ws/agent", deps.AgentHub)
```

- [ ] **Step 5: Build to verify**

```bash
cd backend
go build ./...
```

Expected: compile errors from main.go (AgentHub not wired yet). We fix in Task 8.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/handler/mikrotik_handler.go backend/internal/router/router.go
git commit -m "feat: add PPPoE secrets endpoint, agent WebSocket route, agent status to GetStatus"
```

---

## Task 8: Wire AgentHub in main.go + Fix Cron

**Files:**
- Modify: `backend/cmd/server/main.go`
- Modify: `backend/internal/config/config.go` (add AGENT_SECRET)
- Modify: `backend/internal/cron/scheduler.go` (use MarkOverdue)

- [ ] **Step 1: Add AGENT_SECRET to config**

In `backend/internal/config/config.go`, add `AgentSecret string` to the `Config` struct:

```go
type Config struct {
	Port             string
	DatabaseURL      string
	JWTSecret        string
	JWTRefreshSecret string
	MikroTikHost     string
	MikroTikPort     int
	MikroTikUser     string
	MikroTikPass     string
	AgentSecret      string   // NEW
	SMSProvider      string
	SMSAPIKey        string
	SMSBaseURL       string
	R2AccountID      string
	R2AccessKey      string
	R2SecretKey      string
	R2Bucket         string
	CORSOrigins      string
}
```

In the `Load()` return, add after `MikroTikPass`:

```go
AgentSecret: func() string {
    if s := os.Getenv("AGENT_SECRET"); s != "" {
        return s
    }
    return "changeme-agent-secret"
}(),
```

- [ ] **Step 2: Wire AgentHub in main.go**

In `backend/cmd/server/main.go`, after `mtManager := mikrotik.NewManager(initialMTClient)`, add:

```go
// ---- Agent Hub ----
agentHub := mikrotik.NewAgentHub(cfg.AgentSecret)
log.Printf("[AgentHub] Listening for local agent connections (secret configured: %v)", cfg.AgentSecret != "")
```

Update `NewSubscriptionService` call to pass `agentHub`:

```go
subSvc := service.NewSubscriptionService(subRepo, planRepo, mtManager, agentHub)
```

Update `NewMikroTikHandler` call to pass `agentHub`:

```go
mtH := handler.NewMikroTikHandler(mtManager, agentHub, settingsRepo)
```

Update `router.New` call to pass `AgentHub`:

```go
h := router.New(router.Deps{
    AuthService:     authSvc,
    AuthHandler:     authH,
    UserHandler:     userH,
    PlanHandler:     planH,
    SubHandler:      subH,
    PayHandler:      payH,
    DashHandler:     dashH,
    MTHandler:       mtH,
    NotifHandler:    notifH,
    SettingsHandler: settingsH,
    MsgHandler:      msgH,
    AgentHub:        agentHub,
}, cfg.CORSOrigins)
```

- [ ] **Step 3: Update cron scheduler to use MarkOverdue instead of Disconnect**

In `backend/internal/cron/scheduler.go`, the `checkOverdue()` method currently calls `s.subService.Disconnect(ctx, sub.ID)`. Replace that call with `s.subService.MarkOverdue(ctx, sub.ID)`:

```go
// checkOverdue finds overdue subscriptions, marks them overdue (PPPoE → unpaid profile), and sends an SMS.
func (s *Scheduler) checkOverdue() {
	log.Println("[CRON] Running overdue check")
	ctx := newBackground()

	subs, err := s.subService.GetOverdue(ctx)
	if err != nil {
		log.Printf("[CRON] Failed to get overdue subscriptions: %v", err)
		return
	}

	for _, sub := range subs {
		// MarkOverdue changes PPPoE profile to "unpaid" (still can dial, but gets error/redirect)
		// and sets status = overdue. Use Disconnect for full suspension.
		if err := s.subService.MarkOverdue(ctx, sub.ID); err != nil {
			log.Printf("[CRON] Failed to mark subscription %s overdue: %v", sub.ID, err)
			continue
		}

		msg := fmt.Sprintf(
			"Hi %s, your internet connection has been suspended due to non-payment. Please settle your bill of PHP %.2f to reconnect.",
			sub.UserName,
			sub.PlanPrice,
		)
		if err := s.smsProvider.SendReminder(sub.UserPhone, msg); err != nil {
			log.Printf("[CRON] Failed to send disconnection SMS to %s: %v", sub.UserPhone, err)
		}
	}

	log.Printf("[CRON] Overdue check complete: processed %d subscriptions", len(subs))
}
```

- [ ] **Step 4: Build the entire backend**

```bash
cd backend
go build ./...
```

Expected: no errors.

- [ ] **Step 5: Test the server starts**

```bash
cd backend
go run ./cmd/server/main.go &
sleep 3
curl http://localhost:8080/api/health
kill %1
```

Expected: `{"status":"ok"}`

- [ ] **Step 6: Commit**

```bash
git add backend/cmd/server/main.go backend/internal/config/ backend/internal/cron/
git commit -m "feat: wire AgentHub into server, fix cron to use MarkOverdue for PPPoE profile change"
```

---

## Task 9: Local Bridge Agent Binary

**Files:**
- Create: `agent/go.mod`
- Create: `agent/go.sum` (generated)
- Create: `agent/main.go`

- [ ] **Step 1: Create agent directory and go.mod**

```bash
mkdir -p /Users/dev3/billingsystem/agent
cd /Users/dev3/billingsystem/agent
go mod init github.com/jdns/billingsystem-agent
go get github.com/go-routeros/routeros/v3@v3.0.1
go get github.com/gorilla/websocket@v1.5.3
```

- [ ] **Step 2: Create agent/main.go**

```go
// agent/main.go
// Local Bridge Agent — runs on any machine on the same LAN as MikroTik.
// Connects outbound to the Render backend via WebSocket.
// Receives RouterOS operation commands, executes them, sends responses back.
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	routeros "github.com/go-routeros/routeros/v3"
	"github.com/gorilla/websocket"
)

// AgentCommand matches backend/internal/mikrotik/agent_hub.go AgentCommand.
type AgentCommand struct {
	ID     string            `json:"id"`
	Op     string            `json:"op"`
	Params map[string]string `json:"params"`
}

// AgentResponse matches backend/internal/mikrotik/agent_hub.go AgentResponse.
type AgentResponse struct {
	ID    string              `json:"id"`
	OK    bool                `json:"ok"`
	Error string              `json:"error"`
	Data  []map[string]string `json:"data,omitempty"`
}

func main() {
	backendURL := getEnv("BACKEND_URL", "wss://your-app.onrender.com")
	agentSecret := getEnv("AGENT_SECRET", "changeme-agent-secret")
	mtHost := getEnv("MIKROTIK_HOST", "192.168.1.1:8728")
	mtUser := getEnv("MIKROTIK_USER", "admin")
	mtPass := getEnv("MIKROTIK_PASS", "")

	wsURL := backendURL + "/ws/agent"
	log.Printf("[Agent] Connecting to backend: %s", wsURL)
	log.Printf("[Agent] MikroTik host: %s user: %s", mtHost, mtUser)

	for {
		if err := runAgent(wsURL, agentSecret, mtHost, mtUser, mtPass); err != nil {
			log.Printf("[Agent] Disconnected: %v — reconnecting in 5s", err)
		}
		time.Sleep(5 * time.Second)
	}
}

func runAgent(wsURL, secret, mtHost, mtUser, mtPass string) error {
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}
	defer conn.Close()

	// Send auth
	if err := conn.WriteJSON(map[string]string{"secret": secret}); err != nil {
		return fmt.Errorf("send auth: %w", err)
	}
	log.Printf("[Agent] Connected to backend, waiting for commands")

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			return fmt.Errorf("read: %w", err)
		}

		var cmd AgentCommand
		if err := json.Unmarshal(msg, &cmd); err != nil {
			log.Printf("[Agent] Invalid command: %v", err)
			continue
		}

		resp := handleCommand(cmd, mtHost, mtUser, mtPass)
		if err := conn.WriteJSON(resp); err != nil {
			return fmt.Errorf("write response: %w", err)
		}
	}
}

func handleCommand(cmd AgentCommand, mtHost, mtUser, mtPass string) AgentResponse {
	mt, err := routeros.Dial(mtHost, mtUser, mtPass)
	if err != nil {
		return AgentResponse{ID: cmd.ID, OK: false, Error: "dial mikrotik: " + err.Error()}
	}
	defer mt.Close()

	var data []map[string]string
	p := cmd.Params

	switch cmd.Op {
	case "pppoe_add":
		_, err = mt.Run("/ppp/secret/add",
			"=name="+p["username"],
			"=password="+p["password"],
			"=profile="+p["profile"],
			"=service=pppoe",
		)
	case "pppoe_disable":
		_, err = mt.Run("/ppp/secret/set", "=numbers="+p["username"], "=disabled=yes")
		if err == nil {
			kickSession(mt, p["username"])
		}
	case "pppoe_enable":
		_, err = mt.Run("/ppp/secret/set", "=numbers="+p["username"], "=disabled=no")
	case "pppoe_set_profile":
		_, err = mt.Run("/ppp/secret/set", "=numbers="+p["username"], "=profile="+p["profile"])
		if err == nil {
			kickSession(mt, p["username"])
		}
	case "pppoe_kick":
		kickSession(mt, p["username"])
	case "pppoe_delete":
		reply, e := mt.Run("/ppp/secret/print", "?name="+p["username"], "=.proplist=.id")
		if e == nil {
			for _, re := range reply.Re {
				mt.Run("/ppp/secret/remove", "=.id="+re.Map[".id"])
			}
		}
		err = e
	case "pppoe_list":
		reply, e := mt.Run("/ppp/secret/print")
		if e == nil {
			for _, re := range reply.Re {
				data = append(data, map[string]string{
					"name":     re.Map["name"],
					"password": re.Map["password"],
					"profile":  re.Map["profile"],
					"disabled": re.Map["disabled"],
					"comment":  re.Map["comment"],
				})
			}
		}
		err = e
	case "queue_create":
		reply, e := mt.Run("/queue/simple/add",
			"=name="+p["name"],
			"=target="+p["target"]+"/32",
			"=max-limit="+p["upload"]+"/"+p["download"],
		)
		if e == nil && reply.Done != nil {
			data = []map[string]string{{"id": reply.Done.Map["ret"]}}
		}
		err = e
	case "queue_disable":
		_, err = mt.Run("/queue/simple/set", "=.id="+p["id"], "=disabled=yes")
	case "queue_enable":
		_, err = mt.Run("/queue/simple/set", "=.id="+p["id"], "=disabled=no")
	case "queue_update":
		_, err = mt.Run("/queue/simple/set", "=.id="+p["id"],
			"=max-limit="+p["upload"]+"/"+p["download"])
	case "queue_delete":
		_, err = mt.Run("/queue/simple/remove", "=.id="+p["id"])
	default:
		return AgentResponse{ID: cmd.ID, OK: false, Error: "unknown op: " + cmd.Op}
	}

	if err != nil {
		return AgentResponse{ID: cmd.ID, OK: false, Error: err.Error()}
	}
	return AgentResponse{ID: cmd.ID, OK: true, Data: data}
}

func kickSession(mt *routeros.Client, username string) {
	reply, err := mt.Run("/ppp/active/print", "?name="+username, "=.proplist=.id")
	if err != nil {
		return
	}
	for _, re := range reply.Re {
		mt.Run("/ppp/active/remove", "=.id="+re.Map[".id"])
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
```

- [ ] **Step 3: Build the agent**

```bash
cd /Users/dev3/billingsystem/agent
go build -o mikrotik-agent .
```

Expected: binary `mikrotik-agent` created.

- [ ] **Step 4: Test agent connects (requires backend running locally)**

In terminal 1:
```bash
cd backend
AGENT_SECRET=test123 go run ./cmd/server/main.go
```

In terminal 2:
```bash
cd agent
BACKEND_URL=ws://localhost:8080 AGENT_SECRET=test123 \
MIKROTIK_HOST=192.168.1.1:8728 MIKROTIK_USER=admin MIKROTIK_PASS=password \
./mikrotik-agent
```

Expected: terminal 1 logs `[AgentHub] Local agent connected from 127.0.0.1:...`

- [ ] **Step 5: Commit**

```bash
cd /Users/dev3/billingsystem
git add agent/
git commit -m "feat: add local bridge agent binary for MikroTik API access behind NAT"
```

---

## Task 10: Web UI — MikroTik Page Updates

**Files:**
- Modify: `web/src/lib/types.ts`
- Modify: `web/src/pages/admin/MikroTik.tsx`

- [ ] **Step 1: Update types.ts — read the file first, then add PPPoE types**

Read `web/src/lib/types.ts`, then add:

```typescript
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
```

Also add to `Plan` type: `mikrotik_profile?: string`
Also add to `Subscription` type: `pppoe_username?: string; pppoe_password?: string`

- [ ] **Step 2: Read MikroTik.tsx to understand current structure**

Run the Read tool on `web/src/pages/admin/MikroTik.tsx` before modifying.

- [ ] **Step 3: Add Agent Status banner at top of MikroTik page**

In the status section of `MikroTik.tsx`, display agent vs direct connection status. Replace the existing `connected` boolean display with:

```tsx
{/* Agent Status */}
<div className={`rounded-lg border p-4 flex items-center gap-3 ${
  status?.agent_connected
    ? 'bg-green-50 border-green-200'
    : 'bg-yellow-50 border-yellow-200'
}`}>
  <div className={`w-3 h-3 rounded-full ${
    status?.agent_connected ? 'bg-green-500' : 'bg-yellow-500'
  }`} />
  <div>
    <p className="font-medium text-sm">
      {status?.agent_connected ? 'Local Agent Connected' : 'Local Agent Offline'}
    </p>
    <p className="text-xs text-gray-500">
      {status?.agent_connected
        ? 'MikroTik commands route through local agent'
        : 'Run the mikrotik-agent binary on your local network'}
    </p>
  </div>
</div>
```

- [ ] **Step 4: Add PPPoE Secrets tab/section**

Add a "PPPoE Secrets" section that fetches from `GET /api/mikrotik/pppoe/secrets` and displays a table with columns: Name, Profile, Disabled, Comment.

```tsx
const [pppoeSecrets, setPppoeSecrets] = useState<PPPoESecret[]>([]);

// In useEffect or on tab click:
const loadSecrets = async () => {
  try {
    const res = await api.get('/api/mikrotik/pppoe/secrets');
    setPppoeSecrets(res.data);
  } catch {
    // silently fail if not connected
  }
};
```

Table display:
```tsx
<table className="w-full text-sm">
  <thead>
    <tr className="text-left border-b">
      <th className="pb-2 pr-4">Username</th>
      <th className="pb-2 pr-4">Profile</th>
      <th className="pb-2 pr-4">Status</th>
      <th className="pb-2">Comment</th>
    </tr>
  </thead>
  <tbody>
    {pppoeSecrets.map(s => (
      <tr key={s.name} className="border-b last:border-0">
        <td className="py-2 pr-4 font-mono">{s.name}</td>
        <td className="py-2 pr-4">{s.profile}</td>
        <td className="py-2 pr-4">
          <span className={`px-2 py-0.5 rounded text-xs ${
            s.disabled ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {s.disabled ? 'Disabled' : 'Active'}
          </span>
        </td>
        <td className="py-2 text-gray-500">{s.comment}</td>
      </tr>
    ))}
  </tbody>
</table>
```

- [ ] **Step 5: Build web to verify**

```bash
cd web
npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/types.ts web/src/pages/admin/MikroTik.tsx
git commit -m "feat: MikroTik page shows agent status and PPPoE secrets tab"
```

---

## Task 11: Web UI — Subscription Form PPPoE Fields

**Files:**
- Modify: `web/src/pages/admin/Subscriptions.tsx` (or wherever the create subscription form lives)

- [ ] **Step 1: Read the Subscriptions admin page**

Run the Read tool on `web/src/pages/admin/Subscriptions.tsx` before editing.

- [ ] **Step 2: Add PPPoE fields to the create subscription form**

Find the form that creates a subscription. Add optional PPPoE fields after the IP Address field:

```tsx
{/* PPPoE Username */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    PPPoE Username <span className="text-gray-400 font-normal">(optional)</span>
  </label>
  <input
    type="text"
    value={form.pppoe_username ?? ''}
    onChange={e => setForm(f => ({ ...f, pppoe_username: e.target.value || undefined }))}
    placeholder="e.g. client01"
    className="w-full border rounded-md px-3 py-2 text-sm"
  />
</div>

{/* PPPoE Password */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    PPPoE Password <span className="text-gray-400 font-normal">(optional)</span>
  </label>
  <input
    type="text"
    value={form.pppoe_password ?? ''}
    onChange={e => setForm(f => ({ ...f, pppoe_password: e.target.value || undefined }))}
    placeholder="e.g. password123"
    className="w-full border rounded-md px-3 py-2 text-sm"
  />
</div>
```

Ensure `pppoe_username` and `pppoe_password` are included in the form submit payload sent to `POST /api/subscriptions`.

- [ ] **Step 3: Update Plan form to include MikroTik Profile field**

In the plan create/edit form (in Subscriptions or Plans page), add:

```tsx
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    MikroTik Profile <span className="text-gray-400 font-normal">(optional)</span>
  </label>
  <input
    type="text"
    value={form.mikrotik_profile ?? ''}
    onChange={e => setForm(f => ({ ...f, mikrotik_profile: e.target.value || undefined }))}
    placeholder="e.g. PLAN10M"
    className="w-full border rounded-md px-3 py-2 text-sm"
  />
  <p className="text-xs text-gray-400 mt-1">
    Must match the PPPoE profile name in MikroTik exactly
  </p>
</div>
```

- [ ] **Step 4: Build web to verify**

```bash
cd web
npm run build
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/admin/Subscriptions.tsx web/src/pages/admin/
git commit -m "feat: add PPPoE username/password fields to subscription form, MikroTik profile to plan form"
```

---

## Task 12: End-to-End Smoke Test

- [ ] **Step 1: Start full stack locally**

```bash
cd /Users/dev3/billingsystem
docker compose up -d  # start PostgreSQL
cd backend && go run ./cmd/server/main.go &
cd agent && BACKEND_URL=ws://localhost:8080 AGENT_SECRET=changeme-agent-secret \
  MIKROTIK_HOST=YOUR_MIKROTIK_IP:8728 MIKROTIK_USER=admin MIKROTIK_PASS=YOUR_PASS \
  ./mikrotik-agent &
cd web && npm run dev
```

- [ ] **Step 2: Verify agent connects**

In backend logs, look for: `[AgentHub] Local agent connected from 127.0.0.1:...`

In agent logs, look for: `[Agent] Connected to backend, waiting for commands`

- [ ] **Step 3: Test PPPoE secret creation via subscription**

1. Log in as admin at `http://localhost:5173`
2. Create a Plan with `MikroTik Profile` = a valid profile name on your MikroTik
3. Create a Subscription for a customer, fill PPPoE Username + Password
4. In MikroTik Winbox/WebFig, check `/PPP > Secrets` — new entry should appear

- [ ] **Step 4: Test Disconnect/Reconnect**

1. On Subscriptions page, click Disconnect on the subscription
2. Verify in MikroTik: PPPoE secret shows `disabled=yes` and active session removed
3. Click Reconnect — PPPoE secret shows `disabled=no`

- [ ] **Step 5: Check MikroTik admin page**

Visit `/admin/mikrotik` — verify:
- Agent status shows "Connected"
- PPPoE Secrets tab shows the created secret

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: final integration smoke test passed — PPPoE + agent fully wired"
```

---

## Deployment Notes

### Running the agent on your local machine (production)

```bash
# Build for Linux (if your local machine is Linux/Raspberry Pi)
cd agent
GOOS=linux GOARCH=amd64 go build -o mikrotik-agent-linux .

# Set environment variables and run
export BACKEND_URL=wss://your-app.onrender.com
export AGENT_SECRET=your-strong-secret-here
export MIKROTIK_HOST=192.168.1.1:8728
export MIKROTIK_USER=admin
export MIKROTIK_PASS=your-mikrotik-password
./mikrotik-agent-linux
```

### Add AGENT_SECRET to Render environment variables

In Render dashboard → your backend service → Environment:
```
AGENT_SECRET=your-strong-secret-here
```

### WireGuard (optional, for encrypted LAN traffic)

On MikroTik RouterOS v7:
```
/interface/wireguard add name=wg0 listen-port=13231
/interface/wireguard/peers add interface=wg0 public-key=<local-pc-pubkey> allowed-address=10.10.0.2/32
/ip/address add address=10.10.0.1/24 interface=wg0
```
Then point `MIKROTIK_HOST` to `10.10.0.1:8728` in the agent config.
