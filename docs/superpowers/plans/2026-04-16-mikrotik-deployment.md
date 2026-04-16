# MikroTik Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the existing billing system code and the user's MikroTik @ 192.168.88.1 (RouterOS 6.49.17) into production: backend + web on Render, agent on a Raspberry Pi at the office, no VPN, no port-forwarding.

**Architecture:** Render hosts public backend + static web. A small agent binary on a Pi at the office holds an outbound WebSocket to the backend and proxies RouterOS API calls to the local MikroTik. Customers dial in via PPPoE; admin actions (create/disable/enable/profile-change/kick) flow Render → WebSocket → agent → router.

**Tech Stack:** Go (backend, agent), Vite/React (web), Postgres (Neon free tier), Docker (Render runtime), systemd (agent host), RouterOS API.

**Companion docs:**
- Spec: `docs/superpowers/specs/2026-04-16-mikrotik-deployment-runbook.md`
- Architecture: `docs/superpowers/specs/2026-04-09-mikrotik-pppoe-vpn-design.md`

**Note on TDD format:** This is a deployment/configuration plan, not a code-writing plan. The vast majority of steps are external actions (clicks in WebFig, commands on a Pi, env var entries on Render). "Verify" steps replace the "run failing test → make it pass" cycle. Where actual code or scripts are added to the repo, conventional code blocks and commits apply.

---

## Task 0: Pre-flight checks

**Files:** none (read-only verification)

- [ ] **Step 0.1: Confirm hardware on hand**

You need:
- The MikroTik (already in place at 192.168.88.1)
- A Raspberry Pi 4/5 with a fresh Raspberry Pi OS Lite (64-bit) install on its SD card, SSH enabled, on the office LAN. *Fallback:* any always-on PC at the office (Linux/macOS preferred for systemd; Windows works but the agent install steps differ).
- A laptop on the office LAN to do the WebFig + SSH steps.

If the Pi isn't ready yet, install Raspberry Pi OS Lite via the Raspberry Pi Imager. In the Imager's "Advanced options": set hostname `mikrotik-agent`, enable SSH (with public key auth if you have one), set wifi/locale. Boot and confirm `ssh pi@mikrotik-agent.local` works before continuing.

- [ ] **Step 0.2: Confirm cloud accounts**

- A Render account (https://render.com) with billing set up (Starter plan ~$7/mo for backend).
- A Neon account (https://neon.tech) — free tier, no card needed to start.
- Push access to the GitHub repo this code lives in (Render pulls from GitHub).

- [ ] **Step 0.3: Confirm code state**

```bash
cd /Users/a1234/Desktop/billingsystem
git status
```

Expected: working tree contains the in-progress username changes you already had (those are unrelated to this work). They can ride along or be stashed — your choice. Note them so they don't get confused with deployment changes.

- [ ] **Step 0.4: Generate the shared agent secret now**

```bash
openssl rand -hex 32
```

Copy the output into a password manager entry titled **"billing-system AGENT_SECRET"**. You'll paste it twice later: once into Render env vars, once into the Pi's env file. Do not commit it to git.

- [ ] **Step 0.5: Generate JWT secrets now**

```bash
openssl rand -hex 32   # save as JWT_SECRET
openssl rand -hex 32   # save as JWT_REFRESH_SECRET
```

Save both into the same password manager entry. They MUST be different from each other and from the agent secret.

---

## Task 1: MikroTik — enable RouterOS API, locked down to LAN

**Files:** none in repo (router config). After all steps pass, export the router config (Step 1.6) and store in a private safe place.

- [ ] **Step 1.1: Open WebFig on the router**

From the office laptop: `http://192.168.88.1` → log in. (You're already in this state per your screenshot.)

- [ ] **Step 1.2: Enable the RouterOS API service on port 8728**

WebFig → **IP → Services**. Find the row `api`:
- Set `Enabled` = yes (checkbox)
- Set `Port` = `8728`
- Set `Available From` = `192.168.88.0/24`
- Click **OK**

Leave `api-ssl` (8729) **disabled** — the Go client uses plain API.

Verify: from the laptop on LAN, `nc -zv 192.168.88.1 8728` returns `succeeded`.

- [ ] **Step 1.3: Create the `billing-api` group**

WebFig → **System → Users → Groups → +**:
- Name: `billing-api`
- Policies (check exactly): `read`, `write`, `policy`, `api`, `test`
- Leave everything else unchecked (`local`, `telnet`, `ssh`, `ftp`, `web`, `winbox`, `sniff`, `dude`, `romon`)
- Click **OK**

- [ ] **Step 1.4: Create the `billing-api` user**

WebFig → **System → Users → Users → +**:
- Name: `billing-api`
- Group: `billing-api`
- Allowed Address: `192.168.88.0/24`
- Password: a strong random string from your password manager
- Click **OK**

Save the password into the same password manager entry you started in Step 0.4.

- [ ] **Step 1.5: Smoke-test API auth from the laptop**

Install a quick CLI checker (Mac):
```bash
brew install jeessy2/tap/routeros-cli || true   # optional, may not exist
```

Or just connect with the existing agent binary to validate (we'll use this binary again in Task 3):
```bash
cd /Users/a1234/Desktop/billingsystem/agent
go build -o /tmp/mtprobe ./   # builds the agent
BACKEND_URL=ws://127.0.0.1:9 \
AGENT_SECRET=x \
MIKROTIK_HOST=192.168.88.1:8728 \
MIKROTIK_USER=billing-api \
MIKROTIK_PASS='<password-from-pm>' \
/tmp/mtprobe 2>&1 | head -10
```

Expected: log line `[Agent] Starting — backend: ws://127.0.0.1:9/ws/agent, MikroTik: billing-api@192.168.88.1:8728`. The dial to backend will fail (deliberately, no backend yet) but if MikroTik creds were wrong you'd also see that. Kill with Ctrl-C.

If creds are wrong, recheck the password and `Allowed Address` field.

- [ ] **Step 1.6: Back up the router config**

WebFig → **Files → Backup**. Download the `.backup` file to your laptop and store it somewhere safe (encrypted external drive, password manager attachment). Also export readable script:

WebFig → **Terminal**, then:
```
/export file=billing-baseline-2026-04-16
```

Then **Files** → download the `.rsc` file. Two formats give you both restore-from-binary and human-readable diff capability.

---

## Task 2: MikroTik — define PPP profiles for the 3 plan tiers

**Files:** none in repo (router config).

- [ ] **Step 2.1: Confirm a remote address pool exists for PPPoE clients**

WebFig → **IP → Pool**. If there's already a pool feeding `pppoe-in1`, note its name (probably `pool1` or similar). If none exists, **+ Add**:
- Name: `pppoe-pool`
- Addresses: `10.10.0.2-10.10.0.254` (or any private range that doesn't collide with `192.168.88.0/24`)
- Click **OK**

- [ ] **Step 2.2: Create PPP profile `PLAN-10M`**

WebFig → **PPP → Profiles → +**:
- Name: `PLAN-10M`
- Local Address: `10.10.0.1` (the gateway IP for clients in this pool)
- Remote Address: `pppoe-pool` (or whatever you named it in 2.1)
- Bridge: leave blank
- Rate Limit (rx/tx): `10M/10M`
- Only One: `yes`
- Click **OK**

- [ ] **Step 2.3: Create PPP profile `PLAN-25M`**

Same as 2.2 but Name `PLAN-25M`, Rate Limit `25M/25M`.

- [ ] **Step 2.4: Create PPP profile `PLAN-50M`**

Same as 2.2 but Name `PLAN-50M`, Rate Limit `50M/50M`.

- [ ] **Step 2.5: Create PPP profile `unpaid`**

Same as 2.2 but Name `unpaid`, Rate Limit `64k/64k`. This is the throttled tier the overdue cron sets users to.

- [ ] **Step 2.6: Verify all four profiles**

WebFig → **PPP → Profiles** → list shows: `PLAN-10M`, `PLAN-25M`, `PLAN-50M`, `unpaid` (plus any defaults like `default` and `default-encryption` — leave those alone).

- [ ] **Step 2.7: Confirm PPPoE server binding is healthy**

WebFig → **PPP → PPPoE Servers**. Confirm `pppoe-in1` is **Enabled** and bound to the customer-facing interface (ask yourself: which `ether` port goes to your customer switch?). Also confirm Default Profile is something safe (e.g., `default-encryption`) — individual users will override via their secret.

---

## Task 3: Build the agent binary for the Pi

**Files:**
- Modify: `agent/main.go` — none if defaults are fine; you'll set env at runtime.

- [ ] **Step 3.1: Cross-compile for Pi (arm64)**

```bash
cd /Users/a1234/Desktop/billingsystem/agent
GOOS=linux GOARCH=arm64 go build -o mikrotik-agent-arm64 .
ls -lh mikrotik-agent-arm64
```

Expected: a ~10–15 MB binary. (If your Pi is a Pi 3 or older, use `GOARCH=arm` `GOARM=7` instead.)

- [ ] **Step 3.2: Verify it isn't accidentally dynamically linked**

```bash
file mikrotik-agent-arm64
```

Expected: `ELF 64-bit LSB executable, ARM aarch64 ... statically linked` (Go default for non-cgo builds is static).

- [ ] **Step 3.3: Copy to the Pi**

```bash
scp mikrotik-agent-arm64 pi@mikrotik-agent.local:/home/pi/mikrotik-agent
```

(If `mikrotik-agent.local` doesn't resolve, use the Pi's actual IP from your DHCP leases on the MikroTik.)

Expected: clean transfer, no errors.

---

## Task 4: Install agent as a systemd service on the Pi

**Files (on Pi, not in repo):**
- Create: `/usr/local/bin/mikrotik-agent`
- Create: `/etc/mikrotik-agent.env`
- Create: `/etc/systemd/system/mikrotik-agent.service`

- [ ] **Step 4.1: SSH to the Pi**

```bash
ssh pi@mikrotik-agent.local
```

All steps from 4.2–4.7 run on the Pi.

- [ ] **Step 4.2: Install the binary**

```bash
sudo install -m 755 /home/pi/mikrotik-agent /usr/local/bin/mikrotik-agent
/usr/local/bin/mikrotik-agent --help 2>&1 | head -5 || true
```

(The agent doesn't have a `--help` flag; the call just confirms it executes.)

- [ ] **Step 4.3: Write the env file (placeholders for now)**

```bash
sudo tee /etc/mikrotik-agent.env >/dev/null <<'EOF'
BACKEND_URL=wss://PLACEHOLDER.onrender.com
AGENT_SECRET=PLACEHOLDER
MIKROTIK_HOST=192.168.88.1:8728
MIKROTIK_USER=billing-api
MIKROTIK_PASS=PLACEHOLDER
EOF
sudo chmod 600 /etc/mikrotik-agent.env
sudo chown root:root /etc/mikrotik-agent.env
```

The `BACKEND_URL` and `AGENT_SECRET` are placeholders until Task 6 deploys the backend. `MIKROTIK_PASS` should be the real password from Step 1.4 — fill it now:

```bash
sudo nano /etc/mikrotik-agent.env
```

Replace `MIKROTIK_PASS=PLACEHOLDER` with the real value. Save.

- [ ] **Step 4.4: Write the systemd unit**

```bash
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
```

- [ ] **Step 4.5: Enable but do not start yet**

```bash
sudo systemctl daemon-reload
sudo systemctl enable mikrotik-agent
```

We'll start it after Task 6 deploys the backend.

Verify:
```bash
systemctl is-enabled mikrotik-agent
```

Expected: `enabled`.

---

## Task 5: Provision the database (Neon)

**Files:** none in repo. Output: a `DATABASE_URL` string for use in Task 6.

- [ ] **Step 5.1: Create a Neon project**

In the Neon dashboard: **New Project**.
- Name: `billing-system`
- Postgres version: latest (16+)
- Region: `Asia Pacific (Singapore)` (closest to PH)
- Click **Create Project**.

- [ ] **Step 5.2: Copy the pooled connection string**

In the project dashboard → **Connection Details**:
- Branch: `main`
- Pooled connection: ON
- Copy the connection string. Format:
  `postgresql://USER:PASS@HOST.neon.tech/billing-system?sslmode=require`

Save into the password manager entry as `DATABASE_URL`.

- [ ] **Step 5.3: Confirm migrations will run on first boot**

```bash
ls /Users/a1234/Desktop/billingsystem/backend/migrations/
```

Expected: 12 SQL files numbered 001–012. The Dockerfile copies `migrations/` into the image, and the backend runs them on startup (per `backend/internal/database/database.go`). No manual migration step needed — Render will handle it on first deploy.

- [ ] **Step 5.4: Sanity-test the connection string locally (optional but recommended)**

```bash
psql "<paste DATABASE_URL>" -c '\dt'
```

Expected: `Did not find any relations.` (empty DB, ready for migrations).

If `psql` isn't installed: `brew install libpq && brew link --force libpq`.

---

## Task 6: Deploy backend to Render

**Files:** none in repo. Output: the Render backend URL `https://<name>.onrender.com`.

- [ ] **Step 6.1: Create a Render Web Service**

Render dashboard → **New + → Web Service** → connect the GitHub repo for this project.

Configure:
- **Name:** `billing-backend` (this becomes the subdomain)
- **Region:** Singapore
- **Branch:** `main`
- **Root Directory:** `backend`
- **Runtime:** Docker (autodetected from `backend/Dockerfile`)
- **Plan:** **Starter ($7/mo)** — *not* Free.
- Health Check Path: leave blank for now (we'll set it after verifying which route the backend exposes).

- [ ] **Step 6.2: Set environment variables**

In the **Environment** tab, add (one at a time):

| Key | Value |
|---|---|
| `DATABASE_URL` | from Step 5.2 |
| `JWT_SECRET` | from Step 0.5 |
| `JWT_REFRESH_SECRET` | from Step 0.5 |
| `AGENT_SECRET` | from Step 0.4 |
| `MIKROTIK_HOST` | *(empty — leave blank)* |
| `MIKROTIK_USER` | *(empty)* |
| `MIKROTIK_PASSWORD` | *(empty)* |
| `CORS_ORIGINS` | `*` *(temporary; tightened in Task 8)* |

`MIKROTIK_HOST` MUST be empty. Per `backend/internal/mikrotik/manager.go:33-37`, an empty host disables the direct-connection client and forces the system to use the agent path.

- [ ] **Step 6.3: First deploy**

Click **Create Web Service**. Watch the build logs — first deploy takes ~5–10 minutes (Docker build + push + first cold start).

Expected log lines on first boot:
- "Running migrations…" (or similar from `database.go`)
- "Listening on :8080"
- The 12 migrations applied successfully

If migrations fail, check `DATABASE_URL` correctness and Neon's `sslmode=require` is in the URL.

- [ ] **Step 6.4: Note the deployed URL**

Render shows it at the top of the service page: `https://billing-backend-XXXX.onrender.com`. Save this as `BACKEND_URL` in your password manager entry. The `wss://` form (replacing `https://` with `wss://`) is what the agent uses.

- [ ] **Step 6.5: Smoke-test the deployment**

```bash
curl -i https://billing-backend-XXXX.onrender.com/api/health
```

Expected: `HTTP/1.1 200 OK` with some JSON body. If 404, check what the actual health route is in `backend/internal/router/router.go` (might be `/health` or `/api/v1/health`). Note it for Step 6.6.

- [ ] **Step 6.6: Set the health check path**

Back in the Render service → **Settings** → Health Check Path → set to whatever returned 200 in Step 6.5. Save.

---

## Task 7: Deploy web frontend to Render (Static Site)

**Files:**
- Possibly modify: `web/.env.production` — only if the project uses one; check `web/src/` for how it reads the API base URL.

- [ ] **Step 7.1: Find how the frontend learns the backend URL**

```bash
grep -rE "VITE_|import\.meta\.env|API_BASE|BACKEND" /Users/a1234/Desktop/billingsystem/web/src | head -20
```

Note the env var name. Common: `VITE_API_BASE_URL`, `VITE_API_URL`, or `VITE_BACKEND_URL`. The exact name decides which key you set in Render.

- [ ] **Step 7.2: Find the build output directory**

```bash
cat /Users/a1234/Desktop/billingsystem/web/vite.config.* 2>/dev/null
cat /Users/a1234/Desktop/billingsystem/web/package.json | grep -A2 '"build"'
```

Expected: build output is `dist/` (Vite default). If the config overrides `build.outDir`, use that value instead in Step 7.4.

- [ ] **Step 7.3: Create a Render Static Site**

Render dashboard → **New + → Static Site** → same GitHub repo.

Configure:
- **Name:** `billing-web`
- **Branch:** `main`
- **Root Directory:** `web`
- **Build Command:** `npm ci && npm run build`
- **Publish Directory:** `dist` (or whatever Step 7.2 reported)

- [ ] **Step 7.4: Set the API URL env var**

Environment tab → add:
- Key: the var name from Step 7.1 (e.g., `VITE_API_BASE_URL`)
- Value: `https://billing-backend-XXXX.onrender.com` (the URL from Step 6.4)

Click **Create Static Site**. Wait for build to finish (~3–5 min). Note the deployed URL: `https://billing-web-XXXX.onrender.com`.

- [ ] **Step 7.5: Add a SPA rewrite rule**

Static Site → **Redirects/Rewrites** → add:
- Source: `/*`
- Destination: `/index.html`
- Action: Rewrite

Without this, deep-linked routes (e.g., `/admin/dashboard` reloaded directly) return 404.

- [ ] **Step 7.6: Open the web app**

Visit `https://billing-web-XXXX.onrender.com` in the browser. Expected: the login page loads. (Auth fails for now — no admin user yet.)

If a CORS error appears in DevTools, jump ahead to Task 8 first.

---

## Task 8: Tighten CORS, create the admin user, and connect the agent

**Files:** none in repo. Mostly Render env edits + DB writes + Pi env edits.

- [ ] **Step 8.1: Tighten CORS**

Render → backend service → Environment → edit `CORS_ORIGINS`:
- New value: the exact web URL from Step 7.4 (e.g., `https://billing-web-XXXX.onrender.com`)
- No trailing slash. Multiple origins comma-separated if you need both prod and a dev URL.

Save → triggers a redeploy. Wait for it to finish.

- [ ] **Step 8.2: Create or promote the admin user**

Open `backend/seed/` to see if a seed admin exists:

```bash
ls /Users/a1234/Desktop/billingsystem/backend/seed/
```

Two paths:
- **If a seed script exists**: trigger it (Render → backend → Shell → run the seed binary, or document its trigger).
- **Otherwise**: register a normal user in the web app, then promote via SQL:

```bash
psql "<DATABASE_URL>" -c "UPDATE users SET role='admin' WHERE email='you@example.com';"
```

Verify:
```bash
psql "<DATABASE_URL>" -c "SELECT id, email, role FROM users WHERE role='admin';"
```

Expected: at least one row.

- [ ] **Step 8.3: Log in to the web app**

Browse to the web URL → log in with the admin email/password. You should land on the admin dashboard.

- [ ] **Step 8.4: Confirm MikroTik settings page is in agent mode**

Admin → MikroTik Settings page (whatever the path is; check `web/src/pages/admin/`). The Host field should be **blank** — leave it that way. With Host blank, the backend's `Manager.Get()` returns nil (per `backend/internal/mikrotik/manager.go:32-43`), and the system uses the AgentHub path instead.

- [ ] **Step 8.5: Update the Pi's env file with real values**

Back on the Pi:
```bash
sudo nano /etc/mikrotik-agent.env
```

Replace the two placeholders:
- `BACKEND_URL=wss://billing-backend-XXXX.onrender.com` (use the wss:// form, not https://)
- `AGENT_SECRET=<paste the same value you set in Render Step 6.2>`

Save.

- [ ] **Step 8.6: Start the agent**

```bash
sudo systemctl start mikrotik-agent
sudo journalctl -u mikrotik-agent -f
```

Expected log lines (within ~5 seconds):
- `[Agent] Starting — backend: wss://billing-backend-...onrender.com/ws/agent, MikroTik: billing-api@192.168.88.1:8728`
- `[Agent] Connected to backend, awaiting commands`

If it loops with `dial backend` errors → check `BACKEND_URL` (must start with `wss://`, not `ws://` or `https://`).
If it connects then immediately disconnects with "unauthorized" → the `AGENT_SECRET` doesn't match Render's.

Ctrl-C exits the journal tail (the service keeps running).

- [ ] **Step 8.7: Confirm in the admin UI**

Admin → MikroTik settings page should show a green "Agent connected" indicator (per the existing PPPoE design doc, section 9). If the UI doesn't show this, click around the MikroTik tab — at minimum, the **PPPoE Users** list should load (empty is fine; an error means no agent connection).

---

## Task 9: Create the 3 plans in the database

**Files:** none in repo (DB rows entered via admin UI).

- [ ] **Step 9.1: Create plan `PLAN-10M`**

Admin → Plans → New Plan:
- Name: `Basic 10 Mbps`
- Price: (your choice, e.g., 999)
- Speed Up: 10
- Speed Down: 10
- `mikrotik_profile`: `PLAN-10M` ← MUST match the MikroTik profile name from Step 2.2 exactly.
- Save.

- [ ] **Step 9.2: Create plan `PLAN-25M`**

Same as 9.1 but Name `Standard 25 Mbps`, speeds 25/25, `mikrotik_profile = PLAN-25M`.

- [ ] **Step 9.3: Create plan `PLAN-50M`**

Same as 9.1 but Name `Premium 50 Mbps`, speeds 50/50, `mikrotik_profile = PLAN-50M`.

- [ ] **Step 9.4: Verify in DB**

```bash
psql "<DATABASE_URL>" -c "SELECT id, name, mikrotik_profile FROM plans;"
```

Expected: 3 rows, each with a non-null `mikrotik_profile` matching one of the four MikroTik profiles (`PLAN-10M`, `PLAN-25M`, `PLAN-50M`).

---

## Task 10: End-to-end verification with a test customer

This is the production smoke test. Stop and diagnose at the first failed step.

**Files:** none. All actions are admin UI + router checks.

- [ ] **Step 10.1: Create a test customer**

Admin → Customers → New:
- Name: `Test Customer`
- Email: `test@example.com`
- Phone: any
- Save. Note the customer ID.

- [ ] **Step 10.2: Create a subscription for the test customer**

Admin → Subscriptions → New:
- Customer: Test Customer
- Plan: `Standard 25 Mbps`
- PPPoE Username: `testuser01`
- PPPoE Password: `testpass01` (use a stronger one in real use)
- Save.

The backend should call `AddPPPoESecret("testuser01", "testpass01", "PLAN-25M", ...)` via the agent.

- [ ] **Step 10.3: Verify on the router**

WebFig → **PPP → Secrets** → confirm:
- Row exists with `Name = testuser01`
- `Profile = PLAN-25M`
- `Service = pppoe`
- `Disabled = no`

If missing → check Render backend logs for the call, then `journalctl -u mikrotik-agent` on the Pi.

- [ ] **Step 10.4: Dial in from a test client**

Use any device with a PPPoE dialer (Windows networking, an old router in client mode, a Linux box with `pppoeconf`). Dial `testuser01 / testpass01` against the office network.

WebFig → **PPP → Active Connections** → row appears with name `testuser01`, the assigned IP from the pool, and uptime.

Run a speed test or `iperf` from the dialed client. Expected: ~25 Mbps both ways (within ISP overhead).

- [ ] **Step 10.5: Disconnect from admin**

Admin → Subscriptions → Test Customer's row → **Disconnect**.

Verify on router:
- WebFig → **PPP → Secrets** → `testuser01` now shows `Disabled = yes`.
- WebFig → **PPP → Active** → the test session is gone (kicked).
- The dialed client loses connectivity within ~5 seconds.

- [ ] **Step 10.6: Reconnect from admin**

Admin → Subscriptions → Test Customer → **Reconnect**.

Verify:
- Secret is re-enabled (`Disabled = no`).
- Profile is back to `PLAN-25M`.
- Re-dialing on the test client succeeds.

- [ ] **Step 10.7: Simulate overdue**

Either:
- Wait for the cron, or
- Force it by SQL (faster):

```bash
psql "<DATABASE_URL>" -c "UPDATE subscriptions SET due_date = NOW() - INTERVAL '10 days' WHERE pppoe_username='testuser01';"
```

Trigger the overdue cron manually if there's a path to do so (check `backend/internal/cron/`), or wait for its next run.

Verify on router: `testuser01`'s profile flips to `unpaid`. The active session (if dialed) is kicked. The client can re-dial but throttled to 64k/64k (per the `unpaid` profile from Step 2.5).

- [ ] **Step 10.8: Clean up the test data**

Admin → Subscriptions → Test Customer → Delete (this should also delete the `/ppp/secret`).
Admin → Customers → Test Customer → Delete.

Verify:
- WebFig → **PPP → Secrets** → no `testuser01` row.
- DB has no `Test Customer` row.

- [ ] **Step 10.9: Mark deployment complete**

Snapshot final state:
```bash
git -C /Users/a1234/Desktop/billingsystem log -5 --oneline
psql "<DATABASE_URL>" -c "SELECT count(*) AS plans FROM plans; SELECT count(*) AS users FROM users WHERE role='admin';"
```

Backup the MikroTik again (Step 1.6 procedure) — capture it in the post-deploy state with the four PPP profiles in place.

---

## Self-review

**Spec coverage check** (each spec section → which task implements it):

| Spec section | Task(s) |
|---|---|
| 4. Stage A — MikroTik configuration | Tasks 1, 2 |
| 5. Stage B — Agent host (Pi) | Tasks 3, 4 |
| 6. Stage C — Backend on Render | Tasks 5, 6, 7 |
| 7. Stage D — Wire it together | Task 8 |
| 8. Stage E — End-to-end verification | Task 10 |
| 9. Operational notes | covered in Task 4 (systemd auto-restart), Task 8 (CORS), Task 10 (final backup) |
| 10. Cost summary | informational only, no task needed |
| 11. Decisions | drives the choices in Tasks 5 (Neon), 6 (Render Starter), 9 (3 plans), 10 (greenfield, no migration) |

No spec sections orphaned.

**Placeholder scan:** the only "PLACEHOLDER" strings are intentional — they're literal strings written into `/etc/mikrotik-agent.env` in Step 4.3 and *replaced with real values* in Steps 4.3 and 8.5 of the same task chain. The plan body contains no TBDs, no "implement later", no "similar to Task N" hand-waves.

**Type/name consistency check:**
- MikroTik PPP profile names: `PLAN-10M`, `PLAN-25M`, `PLAN-50M`, `unpaid` — used consistently in Tasks 2, 9, 10.
- `billing-api` user name — Tasks 1, 4, 8.
- `mikrotik_profile` column name — matches `backend/migrations/010_add_pppoe_fields.sql:2`.
- `MIKROTIK_HOST` env var — matches `backend/internal/config/config.go:51`.
- `MIKROTIK_PASSWORD` env var on Render but `MIKROTIK_PASS` in the agent env — this is correct; the backend reads `MIKROTIK_PASSWORD` (config.go:54), the standalone agent binary reads `MIKROTIK_PASS` (`agent/main.go:37`). Different binaries, different vars on purpose.
- `AGENT_SECRET` — same string in both places, Render env (Step 6.2) and Pi env (Step 4.3 / 8.5).
