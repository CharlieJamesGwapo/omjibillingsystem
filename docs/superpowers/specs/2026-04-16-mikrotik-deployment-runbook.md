# MikroTik Deployment Runbook

**Date:** 2026-04-16
**Status:** Draft — pending user review
**Companion to:** `2026-04-09-mikrotik-pppoe-vpn-design.md` (architecture)
**Target router:** MikroTik @ 192.168.88.1, RouterOS v6.49.17 (stable)
**Hosting target:** Render (cloud) for backend + web; Raspberry Pi (or equivalent) on LAN for the agent

---

## 1. Goal

Take the already-built billing system code and the already-acquired MikroTik router and put them into a working production setup, end-to-end. No new features — this is a deployment/configuration runbook.

When this is done:
- Customers/admins can use the web app from anywhere.
- Creating a subscription provisions a PPPoE secret on the MikroTik automatically.
- Disconnect/reconnect actions kick the PPPoE session.
- Overdue cron sets the user to the `unpaid` profile and kicks them.
- Nothing about the MikroTik is exposed to the public internet.

---

## 2. Architecture (recap)

```
[Browser anywhere]
       │ HTTPS
       ▼
[Render: backend (Go) + web (static)]   ← public
       │ WebSocket  (server holds the socket open)
       ▲ outbound dial from agent
       │
[Agent box on office LAN]               ← Raspberry Pi or any always-on PC
       │ RouterOS API (TCP 8728)
       ▼
[MikroTik 192.168.88.1, RouterOS 6.49] ← never exposed
```

**Why no VPN?** The agent dials *outbound* to Render, which sidesteps NAT/firewall entirely. RouterOS 6.49 also has no native WireGuard (v7+ only), so a VPN would mean OpenVPN — more setup, no benefit here.

---

## 3. Assumptions and non-goals

**Assumptions** (confirm before executing):
- Customers connect via PPPoE (not hotspot, not DHCP, not static IP).
- The MikroTik already has a working PPPoE server on `pppoe-in1` (visible in user's interface list).
- The internet uplink for customers is already terminated by this MikroTik.
- Render will host backend + web. Postgres add-on or Neon used for DB.
- One office/site for now (single MikroTik, single agent).

**Non-goals:**
- Not upgrading RouterOS to v7.
- Not setting up VPN / WireGuard / OpenVPN.
- Not adding new billing features — this is purely deployment.
- Not setting up RADIUS (the system uses `/ppp/secret` directly).

---

## 4. Stage A — MikroTik configuration

### A1. Enable RouterOS API service
WebFig → **IP → Services**. Confirm `api` is **enabled** on port `8728` (not `api-ssl` 8729 — the Go client uses plain API). Restrict the `Available From` field to the LAN subnet (e.g., `192.168.88.0/24`) so only the agent can hit it.

### A2. Create dedicated API user
WebFig → **System → Users → Groups → +**:
- Name: `billing-api`
- Policies: `read`, `write`, `policy`, `api`, `test`
- Skip: `local`, `telnet`, `ssh`, `ftp`, `web`, `winbox`, `sniff`, `dude`, `romon`

WebFig → **System → Users → +**:
- Name: `billing-api`
- Group: `billing-api`
- Allowed Address: `192.168.88.0/24` (LAN only — defense in depth)
- Password: strong random, store in 1Password / your password manager

**Why a dedicated user?** Compromise of `admin` is game-over for the router. Compromise of `billing-api` only lets the attacker manipulate PPPoE secrets and queues.

### A3. Define PPP profiles that match billing plans
WebFig → **PPP → Profiles → +**, one profile per plan tier. Names must match what you'll put in the `plans.mikrotik_profile` column. Recommended naming: `PLAN-<speed>`.

Example for a 25/25 Mbps plan:
- Name: `PLAN-25M`
- Local Address: (your gateway address pool, e.g., `10.10.0.1`)
- Remote Address: a pool you create (e.g., `pppoe-pool`)
- Rate Limit (rx/tx): `25M/25M`
- Only One: `yes` (one session per user)

Create one **`unpaid`** profile too:
- Name: `unpaid`
- Rate Limit: `64k/64k` (effectively blocks browsing; some ISPs use this as a "captive page" tier — alternative is to disable the secret entirely)
- This is what the overdue cron switches users to.

### A4. Confirm PPPoE server binding
You already have `pppoe-in1` (PPPoE Server Binding) — good. Confirm under **PPP → PPPoE Servers** that the server listens on the correct interface (the one facing customers, e.g., `bridge` or a specific ether port).

### A5. Lock down WAN
- WebFig → **IP → Firewall → Filter Rules**: confirm there's no rule allowing inbound WAN access to ports 22/23/80/8291/8728. Default config protects this; verify it after any custom changes.

---

## 5. Stage B — Agent host (Raspberry Pi)

### B1. Hardware
Raspberry Pi 4 (2GB+) or Pi 5. Wired Ethernet to the same switch/MikroTik. Heatsink + a real power supply.

### B2. OS
Raspberry Pi OS Lite (64-bit). SSH enabled. Static DHCP lease in MikroTik DHCP server (so the Pi always gets the same IP — useful for diagnostics).

### B3. Build the agent for Pi
On your dev machine (Mac, per current env):
```bash
cd /Users/a1234/Desktop/billingsystem/agent
GOOS=linux GOARCH=arm64 go build -o mikrotik-agent-arm64 .
scp mikrotik-agent-arm64 pi@<pi-ip>:/home/pi/mikrotik-agent
```
(For x86 mini-PC: `GOARCH=amd64`. For Windows host: `GOOS=windows GOARCH=amd64`, scp the `.exe`.)

### B4. Install as a systemd service
On the Pi:
```bash
sudo install -m 755 /home/pi/mikrotik-agent /usr/local/bin/mikrotik-agent
sudo tee /etc/mikrotik-agent.env >/dev/null <<'EOF'
BACKEND_URL=wss://YOUR-RENDER-APP.onrender.com
AGENT_SECRET=<generated-strong-secret>
MIKROTIK_HOST=192.168.88.1:8728
MIKROTIK_USER=billing-api
MIKROTIK_PASS=<the-billing-api-password>
EOF
sudo chmod 600 /etc/mikrotik-agent.env

sudo tee /etc/systemd/system/mikrotik-agent.service >/dev/null <<'EOF'
[Unit]
Description=Billing System MikroTik Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/mikrotik-agent.env
ExecStart=/usr/local/bin/mikrotik-agent
Restart=always
RestartSec=5
User=nobody

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now mikrotik-agent
sudo journalctl -u mikrotik-agent -f
```

The journalctl tail should show `Connected to backend, awaiting commands` once Render is up.

### B5. Generate the agent secret
On any machine:
```bash
openssl rand -hex 32
```
Use the same value in `/etc/mikrotik-agent.env` on the Pi *and* in Render's `AGENT_SECRET` env var (next stage).

---

## 6. Stage C — Backend on Render

### C1. Database
Pick one:
- **Render Postgres** (simplest, same dashboard, ~$7/mo for starter)
- **Neon** (free tier exists, ~3GB, good enough to start)

Either way: get the `DATABASE_URL` and apply migrations 001–012 to a fresh DB before first deploy.

### C2. Backend Web Service on Render
- **New → Web Service → Connect repo**
- Root directory: `backend/`
- Runtime: **Docker** (uses the existing `backend/Dockerfile`)
- Plan: **Starter ($7/mo)** — *not* Free; Free sleeps after 15 min and breaks the agent WebSocket.
- Health check path: leave default or `/api/health` if such a route exists.

**Environment variables (all required unless noted):**
| Var | Value |
|---|---|
| `DATABASE_URL` | from Render Postgres / Neon |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32` (different from above) |
| `AGENT_SECRET` | same value as on the Pi |
| `MIKROTIK_HOST` | **leave empty** — using agent path, not direct |
| `MIKROTIK_USER` | empty |
| `MIKROTIK_PASSWORD` | empty |
| `CORS_ORIGINS` | the web frontend URL once known (set after C3) |
| `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_BASE_URL` | only if SMS is in use |
| `R2_*` | only if Cloudflare R2 file uploads are in use |

**Deploy.** First boot runs migrations from the embedded `migrations/` folder.

### C3. Web frontend (Static Site)
- **New → Static Site → Connect repo**
- Root: `web/`
- Build: `npm ci && npm run build`
- Publish dir: `dist/` (Vite default — verify in `web/vite.config.*`)
- Environment: `VITE_API_BASE_URL=https://<backend>.onrender.com` (or whatever name your code uses — check `web/src/`)

After web deploys, copy its URL into the backend's `CORS_ORIGINS`.

---

## 7. Stage D — Wire it together

### D1. First admin login
Visit the deployed web URL → log in with the admin user (created via `backend/seed/` if applicable, or by registering and then promoting the user with a SQL update).

### D2. MikroTik settings page
Admin panel → MikroTik settings:
- **Leave Host blank.** This forces the backend to use the `AgentHub` path. (When host is set, the backend uses the direct `Client` path, which can't reach a private IP from Render.)
- Save.

The settings page should show the agent connection status (per the existing design doc, section 9). Green = the Pi's WebSocket is alive.

### D3. Map plans to profiles
Admin → Plans. For each plan, set `mikrotik_profile` to the matching MikroTik profile name (e.g., `PLAN-25M`). If left blank, the system falls back to `plan.Name`, which is fragile — set it explicitly.

---

## 8. Stage E — End-to-end verification

Run these in order. Stop at the first failure and diagnose.

1. **Agent connectivity**: agent settings page shows green; `journalctl` on Pi shows the connection.
2. **List PPPoE secrets**: admin → MikroTik → PPPoE Users tab — should load (probably empty).
3. **Create test plan**: e.g., `Test 25M`, `mikrotik_profile = PLAN-25M`.
4. **Create test customer + subscription** with `pppoe_username = testuser01`, `pppoe_password = testpass01`.
5. **Verify on router** (WebFig → PPP → Secrets): `testuser01` exists, profile `PLAN-25M`, enabled.
6. **Dial-in test**: from any client (PC with PPPoE dialer, or another router), dial `testuser01/testpass01`. Confirm session appears in `/ppp/active` and traffic flows at the configured speed.
7. **Disconnect from admin**: subscription → Disconnect. Verify secret becomes `disabled=yes` on router and active session is kicked.
8. **Reconnect**: subscription → Reconnect. Verify enabled, profile back to `PLAN-25M`, dial works again.
9. **Overdue simulation**: backdate the subscription due date in DB or wait for cron. Verify profile flips to `unpaid` and session is kicked. (Cron lives in `backend/internal/cron/`.)
10. **Delete test data** when satisfied.

---

## 9. Operational notes

- **Agent down recovery**: if the Pi reboots, systemd restarts the agent. If the office internet drops, agent reconnects with 5s backoff once back. Active PPPoE sessions are unaffected — only *new* admin actions queue.
- **Where to look when something breaks**:
  - `journalctl -u mikrotik-agent -n 200` on the Pi
  - Render → backend service → Logs
  - WebFig → Log on the MikroTik (filter for `pppoe`)
- **Secrets rotation**: rotate `AGENT_SECRET` by changing it in Render env first, then in `/etc/mikrotik-agent.env`, then `systemctl restart mikrotik-agent`. Brief disconnect during the swap.
- **Backups**: Render Postgres has automatic backups; export a manual snapshot before any migration. Also export MikroTik config monthly (`/system/backup/save`).

---

## 10. Cost summary (monthly)

| Item | Approx |
|---|---|
| Render backend Starter | $7 |
| Render Postgres Starter (or Neon free) | $7 (or $0) |
| Render Static Site (web) | Free |
| Raspberry Pi power | ~$0.30 (≈2W) |
| MikroTik (already owned) | $0 |
| **Total** | **~$14/mo** (or **~$7** with Neon free DB) |

---

## 11. Decisions (user approved 2026-04-16: "do the recommended")

| # | Question | Decision | Notes |
|---|---|---|---|
| 1 | Web app URL | Default `*.onrender.com` | Custom domain can be added later — `Settings → Custom Domain` on Render Static Site |
| 2 | Agent host | **Raspberry Pi 4 (2GB+)** | Acquire if not owned. Interim fallback: any always-on Windows/Mac PC at the office (same systemd → equivalent service manager) |
| 3 | Database | **Neon free tier** to start | ~3GB free; migrate to Render Postgres or Neon paid when traffic justifies it |
| 4 | Initial speed tiers | **3 tiers**: `PLAN-10M` (10/10), `PLAN-25M` (25/25), `PLAN-50M` (50/50) | Plus the `unpaid` profile (64k/64k). Add more later via WebFig + new Plan rows |
| 5 | Existing customers | **Greenfield** | No migration. Test customers only during verification, deleted afterward |
