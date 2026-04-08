# MikroTik PPPoE Management + Local Bridge Agent Design

**Date:** 2026-04-09  
**Status:** Approved  
**RouterOS Version:** v7.x (latest)

---

## 1. Problem Statement

The Render cloud backend cannot reach the local MikroTik router directly (no public IP). The current system manages bandwidth via Simple Queues (IP-based). The ISP uses PPPoE for client connections and needs to:

- Add PPPoE secrets on new subscriptions
- Disable/enable PPPoE users for suspension/reconnection
- Change PPPoE profile to `unpaid` when overdue (blocks dialing)
- Kick active PPPoE sessions after profile/status changes
- Do all of this from the cloud admin panel despite the router being on a local LAN

---

## 2. Architecture

```
[Admin Web / Mobile App]
         |
         | HTTPS
         v
[Render Cloud Backend (Go)]
         |
         | WebSocket (wss://)
         v
[Local Bridge Agent (Go binary)]   ← runs on local PC, same LAN as MikroTik
         |
         | RouterOS API (TCP:8728)
         v
[MikroTik RouterOS v7]
```

### Why Local Bridge Agent (not VPN)?

- Works behind NAT — no port forwarding, no public IP required on MikroTik
- Agent connects **outbound** to Render; no inbound connections needed
- Simpler to deploy: single Go binary, run as a service
- No WireGuard peer configuration on Render side needed

### WireGuard (Optional Security Layer)

For environments where API traffic must be encrypted end-to-end, WireGuard on RouterOS v7 can be configured as a secure tunnel between the local machine and the MikroTik. This is optional — the local agent communicates with MikroTik on the same LAN so traffic stays local.

---

## 3. PPPoE Operations

The following operations will be added to `backend/internal/mikrotik/client.go`:

| Method | RouterOS Command | Purpose |
|--------|-----------------|---------|
| `AddPPPoESecret(username, password, profile)` | `/ppp/secret/add` | Create PPPoE user on new subscription |
| `DisablePPPoEUser(username)` | `/ppp/secret/set disabled=yes` | Suspend user access |
| `EnablePPPoEUser(username)` | `/ppp/secret/set disabled=no` | Restore user access |
| `SetPPPoEProfile(username, profile)` | `/ppp/secret/set profile=X` | Change to unpaid/plan profile |
| `KickPPPoESession(username)` | `/ppp/active/remove [find name=X]` | Force re-dial after changes |
| `GetPPPoESecrets()` | `/ppp/secret/print` | List all PPPoE users |
| `DeletePPPoESecret(username)` | `/ppp/secret/remove` | Remove user on subscription delete |

**Profile logic:**
- Active subscription → profile = `plan.mikrotik_profile` (new field on Plan, e.g. `PLAN10M`)
- Overdue/suspended → profile = `unpaid` (MikroTik blocks new dial attempts, logs error)
- If `mikrotik_profile` is empty on the plan, falls back to plan `Name`

---

## 4. Data Model Changes

### `plans` table — new column

```sql
ALTER TABLE plans ADD COLUMN mikrotik_profile TEXT;
```

- `mikrotik_profile`: the PPPoE profile name as configured in MikroTik (e.g. `PLAN10M`). Optional — falls back to plan `Name` if empty.

### `subscriptions` table — new columns

```sql
ALTER TABLE subscriptions ADD COLUMN pppoe_username TEXT;
ALTER TABLE subscriptions ADD COLUMN pppoe_password TEXT;
```

- `pppoe_username`: PPPoE secret name on MikroTik (unique per subscription)
- `pppoe_password`: PPPoE secret password (stored for re-provisioning)
- Existing `mikrotik_queue_id` remains for IP-based queue management (backward compatible)

### Subscription model (Go)

```go
PPPoEUsername *string `json:"pppoe_username"`
PPPoEPassword *string `json:"pppoe_password"`
```

### CreateSubscriptionRequest — new optional fields

```go
PPPoEUsername *string `json:"pppoe_username"`
PPPoEPassword *string `json:"pppoe_password"`
```

---

## 5. Subscription Lifecycle Integration

### On Create
1. If `pppoe_username` provided → call `AddPPPoESecret(username, password, planProfile)`
2. If `ip_address` provided → create Simple Queue (existing behavior, unchanged)

### On Disconnect (admin action)
1. If `pppoe_username` set → `DisablePPPoEUser(username)` + `KickPPPoESession(username)`
2. Else if `mikrotik_queue_id` set → `DisableQueue(queueID)` (existing)
3. Set status = `suspended`

### On Reconnect (admin action or payment approved)
1. If `pppoe_username` set → `EnablePPPoEUser(username)` + `SetPPPoEProfile(username, planProfile)` + `KickPPPoESession(username)`
2. Else if `mikrotik_queue_id` set → `EnableQueue(queueID)` (existing)
3. Set status = `active`

### On Overdue (cron job)
1. If `pppoe_username` set → `SetPPPoEProfile(username, "unpaid")` + `KickPPPoESession(username)`
2. Set status = `overdue`

---

## 6. New API Endpoints

```
POST /api/mikrotik/pppoe/users          → AddPPPoESecret (admin only)
GET  /api/mikrotik/pppoe/users          → List PPPoE secrets (admin/tech)
DELETE /api/mikrotik/pppoe/users/:name  → DeletePPPoESecret (admin only)
```

Subscription disconnect/reconnect endpoints already exist and will be updated to handle PPPoE internally.

---

## 7. Local Bridge Agent

### Location: `agent/` directory (new top-level package)

### Binary: `agent/main.go`

**Behavior:**
1. On startup: reads config (`BACKEND_URL`, `AGENT_SECRET`, `MIKROTIK_HOST`, `MIKROTIK_USER`, `MIKROTIK_PASS`)
2. Connects to `wss://<backend>/ws/agent` with `Authorization: Bearer <AGENT_SECRET>`
3. Receives JSON command messages, executes RouterOS API calls locally, sends JSON responses
4. Reconnects automatically on disconnect (exponential backoff)

**Backend changes:**
- New WebSocket endpoint: `GET /ws/agent`
- `AgentHub` struct: manages connected agents, routes commands to them
- When MikroTik client would make a call: check if agent is connected → send via WebSocket → await response

### Command message format

```json
{ "id": "uuid", "op": "pppoe_disable", "params": { "username": "client01" } }
```

### Response format

```json
{ "id": "uuid", "ok": true, "error": "" }
```

### Agent deployment

```bash
# Build
cd agent && go build -o mikrotik-agent .

# Run (Windows/Linux/Mac — any machine on same LAN as MikroTik)
BACKEND_URL=wss://your-app.onrender.com \
AGENT_SECRET=your-secret-token \
MIKROTIK_HOST=192.168.1.1:8728 \
MIKROTIK_USER=admin \
MIKROTIK_PASS=yourpassword \
./mikrotik-agent
```

---

## 8. WireGuard Setup (Optional — RouterOS v7 built-in)

For encrypted LAN-to-MikroTik API access, configure WireGuard on the MikroTik:

```
# On MikroTik (RouterOS v7)
/interface/wireguard/add name=wg0 listen-port=13231
/interface/wireguard/peers/add \
  interface=wg0 \
  public-key=<local-machine-pubkey> \
  allowed-address=10.10.0.2/32

# On local machine (WireGuard client)
# Point MikroTik API traffic to 10.10.0.1:8728 via the tunnel
```

This is optional and does not affect the agent architecture — it only secures the local LAN segment between the agent and MikroTik.

---

## 9. Web UI Updates

- Subscriptions list: **Disconnect / Reconnect** buttons (already exist, now trigger PPPoE ops)
- Subscription create form: add optional `PPPoE Username` + `PPPoE Password` fields
- MikroTik settings page: add **Agent Status** indicator (online/offline) + agent token display
- PPPoE Users tab on MikroTik page: list of all PPPoE secrets from router

---

## 10. Error Handling

- If MikroTik agent is offline: API returns `503 MikroTik agent not connected`
- PPPoE operations are best-effort: subscription status updates in DB even if MikroTik call fails (logged as warning)
- `KickPPPoESession` failure is non-fatal (session will expire naturally)

---

## 11. Files Changed / Created

| File | Change |
|------|--------|
| `backend/internal/mikrotik/client.go` | Add PPPoE methods |
| `backend/internal/mikrotik/agent_hub.go` | New — WebSocket agent hub |
| `backend/internal/model/plan.go` | Add `MikroTikProfile` field |
| `backend/internal/model/subscription.go` | Add PPPoE fields |
| `backend/internal/repository/subscription_repo.go` | Add PPPoE column queries |
| `backend/internal/service/subscription_service.go` | Update Disconnect/Reconnect/Create |
| `backend/internal/handler/mikrotik_handler.go` | Add PPPoE endpoints + agent WS |
| `backend/internal/router/router.go` | Register new routes |
| `backend/migrations/010_add_pppoe_fields.sql` | New migration (plans + subscriptions) |
| `agent/main.go` | New — local bridge agent binary |
| `agent/go.mod` | New — agent module |
| `web/src/pages/admin/MikroTik.tsx` | Add agent status + PPPoE tab |
| `web/src/pages/admin/Subscriptions.tsx` | PPPoE fields in create form |
