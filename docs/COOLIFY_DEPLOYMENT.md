# Coolify Deployment — Fleet Manager
> Completed: 4 May 2026 | Server: Hostinger KVM1 VPS (Ubuntu 24.04)

---

## TLDR

Migrated the production Next.js dashboard from a manual PM2 + nginx setup to Coolify (self-hosted PaaS) on the same VPS. The GitHub repository was moved to a new account. Auto-deploy on `git push` is now active. The server is hardened with only ports 22, 80, 443 publicly accessible.

**Before:**
```
git push → SSH into VPS → git pull → npm run build → pm2 restart
nginx (ports 80/443) → localhost:3000 (PM2)
```

**After:**
```
git push to main → GitHub webhook → Coolify auto-builds → auto-deploys
Traefik (ports 80/443) → Coolify-managed Docker container
```

---

## Starting State (30 April 2026)

| Component | State |
|---|---|
| OS | Ubuntu 24.04.3 LTS |
| RAM | 3.8 GB total, ~2.9 GB available |
| Disk | 48 GB, 14 GB used |
| Web server | nginx (owned ports 80/443) |
| App | Next.js via PM2 (`fleet` process) on port 3000 |
| Poller | `fleet-poller` via PM2 (Samsara → Supabase) |
| Docker | Not installed |
| SSL | Let's Encrypt via certbot (nginx-managed) |
| Deployment | Manual SSH → git pull → npm run build → pm2 restart |
| GitHub repo | `mahmoodfathy227/fleet-manager` (private, no owner access) |

**Open ports (UFW):**
- 22/tcp (SSH)
- 80/tcp (HTTP)
- 443 (HTTPS)
- 3000 (Next.js — public, security gap)
- 8433:8443/tcp (CloudPanel legacy)

---

## Step 1 — GitHub Repository Migration

The original repo was on `mahmoodfathy227`'s account with no GitHub App installation rights.

**Action:** Created new private repo `mohamed-hamada-cs/fleet-manager` and pushed the existing codebase.

```bash
# On VPS
cd /root/FleetManager
git remote set-url origin https://github.com/mohamed-hamada-cs/fleet-manager.git
git push origin main
git checkout -b staging
git push origin staging
```

**Result:** Full ownership of the repo under `mohamed-hamada-cs`. Both `main` and `staging` branches pushed.

---

## Step 2 — DNS Records Added

Added to `senfleetmanager.com` DNS (Hostinger):

| Type | Name | Points to | Purpose |
|---|---|---|---|
| A | `coolify` | `82.180.154.114` | Coolify UI domain |
| A | `stage` | `82.180.154.114` | Staging dashboard (future) |

Existing records unchanged:
- `@` → `82.180.154.114` (root domain, already present)
- `www` CNAME → `senfleetmanager.com` (already present)

---

## Step 3 — Coolify Installation

```bash
# Open port 8000 temporarily for Coolify UI setup
sudo ufw allow 8000/tcp

# Install Coolify (installs Docker automatically)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

**Containers started by the installer:**
- `coolify` — main Coolify application (UI on port 8000, internally 8080)
- `coolify-db` — PostgreSQL
- `coolify-redis` — Redis
- `coolify-realtime` — WebSocket relay

**Note:** `coolify-proxy` (Traefik) did not start at install time — nginx was still holding ports 80/443. This is expected.

---

## Step 4 — Coolify Initial Setup

Accessed Coolify UI at `http://82.180.154.114:8000`:
- Created admin account
- Chose **"localhost"** as the server (Coolify manages the host it's installed on via Docker socket)
- Server validated successfully

---

## Step 5 — GitHub App Connection

In Coolify: **Sources → Add → GitHub App → "+ Add GitHub App"**

- Triggered automated GitHub OAuth flow
- Installed the `fleet-manager-coolify` GitHub App on `mohamed-hamada-cs`'s account
- Selected `mohamed-hamada-cs/fleet-manager` as the accessible repository
- Permissions granted: Read access to code/metadata, Read+Write to pull requests

**Result:** Coolify can clone the private repo and receive push webhooks for auto-deploy.

---

## Step 6 — Production Application Setup

In Coolify: **Projects → fleet-manager → New Resource → Application**

| Setting | Value |
|---|---|
| Source | GitHub App — `mohamed-hamada-cs/fleet-manager` |
| Branch | `main` |
| Build Pack | Nixpacks (auto-detected Next.js) |
| Port | `3000` |
| Domain | `https://senfleetmanager.com` |
| Direction | Allow www & non-www |

**Environment Variables configured:**

| Variable | Type |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Plain — Available at Buildtime + Runtime |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Plain — Available at Buildtime + Runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret (locked) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Plain — Available at Buildtime + Runtime |
| `SMTP_HOST` | Plain |
| `SMTP_PORT` | Plain |
| `SMTP_USER` | Plain |
| `SMTP_PASS` | Secret (locked) |
| `SMTP_FROM` | Plain |
| `SMTP_SECURE` | Plain |
| `APP_URL` | `https://senfleetmanager.com` |
| `NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL` | Plain — Available at Buildtime + Runtime |
| `NODE_ENV` | `production` |
| `NIXPACKS_NODE_VERSION` | `22` (matches VPS Node v22.22.2) |

> `NEXT_PUBLIC_*` variables must be set before the first build — they are baked into the Next.js bundle at build time.

First build completed in ~7 minutes.

---

## Step 7 — Coolify Instance Domain

In Coolify: **Settings → General → URL**

Set to: `https://coolify.senfleetmanager.com`

Ensures invitation links and webhook URLs use the correct domain instead of the raw IP:port.

---

## Step 8 — nginx → Traefik Switchover

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
```

Then in Coolify: **Servers → localhost → Proxy → Start Proxy**

Traefik bound ports 80 and 443, issued a new Let's Encrypt certificate for `senfleetmanager.com` via ACME (~30 seconds), and began routing traffic to the Coolify container.

**Downtime window:** ~30 seconds.

**Verification:**
```bash
sudo ss -tlnp | grep -E ':80|:443'
# Shows docker-proxy on both ports
```

---

## Step 9 — PM2 Fleet Process Removal

```bash
pm2 stop fleet && pm2 delete fleet && pm2 save
```

`fleet-poller` was **not touched** — continues running on PM2 unchanged.

---

## Step 10 — Port Hardening

### UFW cleanup:
```bash
sudo ufw delete allow 3000
sudo ufw delete allow 8433:8443/tcp
sudo ufw delete allow 8000/tcp
sudo ufw reload
```

### Final UFW state:
```
22/tcp   ALLOW IN  (SSH)
80/tcp   ALLOW IN  (HTTP → HTTPS redirect)
443      ALLOW IN  (HTTPS)
443/udp  ALLOW IN  (HTTP/3)
```

### Docker + UFW bypass fix:

UFW does not block Docker-published ports — Docker writes iptables rules directly, bypassing UFW. The fix is the `DOCKER-USER` chain, which Docker explicitly respects.

The Coolify container maps internal port **8080 → host port 8000**. After Docker's DNAT in PREROUTING, the FORWARD chain (where DOCKER-USER lives) sees destination port **8080**, not 8000. The rule must target port 8080:

```bash
sudo iptables -I DOCKER-USER ! -s 127.0.0.1 -p tcp --dport 8080 -j DROP
sudo iptables-save > /etc/iptables.rules
```

### iptables persistence:

`iptables-persistent` could not be installed (conflicts with legacy CloudPanel package). Persistence via systemd service instead:

```
/etc/systemd/system/iptables-restore.service
```

```bash
sudo systemctl enable iptables-restore
```

Restores `/etc/iptables.rules` on every boot before network comes up.

---

## Final State

### Services

| Service | Runtime | Notes |
|---|---|---|
| Next.js dashboard | Coolify Docker container | Auto-deploys on push to `main` |
| Traefik proxy | Docker (`coolify-proxy`) | TLS, routing, Let's Encrypt |
| Coolify UI | Docker (`coolify`) | `https://coolify.senfleetmanager.com` |
| Samsara poller | PM2 (`fleet-poller`) | Unchanged |
| nginx | Removed | Disabled, replaced by Traefik |

### URLs

| URL | Destination |
|---|---|
| `https://senfleetmanager.com` | Production dashboard |
| `https://coolify.senfleetmanager.com` | Coolify management UI |
| `https://stage.senfleetmanager.com` | Staging (pending — needs staging Supabase project) |

### Open ports

| Port | Service | Externally accessible |
|---|---|---|
| 22 | SSH | Yes |
| 80 | Traefik (redirects to HTTPS) | Yes |
| 443 | Traefik (HTTPS) | Yes |
| 8000 | Coolify UI | No — blocked via iptables DOCKER-USER |
| 3000 | (none) | No — UFW rule removed |

### Deploy workflow

```
git push origin main
  → GitHub webhook → Coolify
  → Nixpacks: npm ci + npm run build
  → Rolling container update (zero downtime)
  → Live at https://senfleetmanager.com
```

---

## Known Remaining Items

| Item | Priority | Notes |
|---|---|---|
| Staging environment | Phase 3 | DNS A record added. Needs second Supabase project + Coolify staging app config. |
| CloudPanel still installed | Low | Conflicts with `iptables-persistent`. Not actively interfering but occupies disk. Pre-removal script currently fails — needs manual removal. |
| GitHub webhook | Low | Verify auto-created at `github.com/mohamed-hamada-cs/fleet-manager/settings/hooks`. If missing, add manually pointing to `https://coolify.senfleetmanager.com`. |

---

## Key File Locations (VPS)

| Path | Contents |
|---|---|
| `/root/FleetManager/` | Next.js app source (git repo) |
| `/root/fleet-poller/` | Samsara poller script |
| `/data/coolify/` | All Coolify data and compose files |
| `/data/coolify/proxy/docker-compose.yml` | Traefik proxy configuration |
| `/etc/iptables.rules` | Saved iptables rules (restored on boot) |
| `/etc/systemd/system/iptables-restore.service` | Systemd unit for iptables persistence |