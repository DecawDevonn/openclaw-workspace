# DEVONN Scheduler - Production Deployment

> Deployment status and final verification checklist

---

## Deployment Status

| Component | Status | Details |
|-----------|--------|---------|
| **Scheduler** | ✅ RUNNING | PID 194087, Port 7373 |
| **Health** | ✅ HEALTHY | `/health` responding |
| **Dashboard API** | ✅ ACTIVE | All endpoints available |
| **.env Permissions** | ✅ SECURED | 600 (owner read/write only) |
| **GitHub Token** | ⏸️ PENDING | Needs user to add token |
| **Ecosystem** | ⏸️ DISABLED | Set `ENABLE_ECOSYSTEM=true` to activate |
| **Systemd Services** | ⏸️ NOT INSTALLED | Container environment (no systemd) |

---

## Current Configuration

### Environment
```bash
DEVONN_API_PORT=7373
ENABLE_ECOSYSTEM=false
ORGANIZATION=wesship
GITHUB_TOKEN=          # <-- NEEDS YOUR TOKEN
```

### Service Endpoints
```
GET http://localhost:7373/status      # Full status
GET http://localhost:7373/queue       # Queue details
GET http://localhost:7373/tasks       # Task list
GET http://localhost:7373/metrics     # Performance metrics
GET http://localhost:7373/ecosystem   # Connection status
GET http://localhost:7373/health      # Health check
POST http://localhost:7373/tasks      # Add task
```

---

## To Complete Production Deployment

### 1. Add GitHub Token (Required for GitHub tasks)

```bash
# Edit .env
nano /home/ubuntu/.openclaw/workspace/.env

# Add your token:
GITHUB_TOKEN=ghp_your_token_here

# Save and exit (Ctrl+X, Y, Enter)
```

**Get token:** https://github.com/settings/tokens  
**Required scopes:** `repo`, `workflow`, `read:org`

### 2. Restart Scheduler

```bash
cd /home/ubuntu/.openclaw/workspace/devonn

# Stop current instance
pkill -f "node bootstrap.js"

# Restart
nohup node bootstrap.js > scheduler.log 2>&1 &

# Verify
sleep 3 && curl http://localhost:7373/health
```

### 3. Test GitHub Integration

```bash
curl -X POST http://localhost:7373/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "github_monitor",
    "priority": 8,
    "payload": {
      "action": "repo_health",
      "repo": "openclaw-workspace"
    }
  }'
```

### 4. Enable Ecosystem (Optional)

```bash
# Edit .env
nano /home/ubuntu/.openclaw/workspace/.env

# Change:
ENABLE_ECOSYSTEM=true
ORCHESTRATOR_URL=https://your-orchestrator-url
GITHUB_TOKEN=ghp_your_token_here  # Same token works

# Restart
pkill -f "node bootstrap.js"
nohup node bootstrap.js > scheduler.log 2>&1 &
```

### 5. Install Systemd Services (On Host with systemd)

```bash
# Copy service files
sudo cp devonn-scheduler.service /etc/systemd/system/
sudo cp devonn-ecosystem.service /etc/systemd/system/

# Reload and enable
sudo systemctl daemon-reload
sudo systemctl enable devonn-scheduler
sudo systemctl start devonn-scheduler

# Verify
sudo systemctl status devonn-scheduler
sudo journalctl -u devonn-scheduler -f
```

---

## Verification Commands

```bash
# Health check
curl http://localhost:7373/health

# Full status
node status.js

# Recent logs
tail -50 scheduler.log

# Process check
ps aux | grep bootstrap | grep -v grep

# Port check
ss -tlnp | grep 7373
# or
lsof -i :7373
```

---

## Production Gate Checklist

- [x] Scheduler running on port 7373
- [x] Health endpoint responding
- [x] Dashboard API active
- [x] .env secured (600 permissions)
- [x] Log rotation configured
- [x] Service files ready
- [ ] GitHub token added
- [ ] GitHub task test passed
- [ ] Ecosystem enabled (optional)
- [ ] Systemd services installed (on host)
- [ ] Survives reboot (on host with systemd)

---

## Current Blockers

### GitHub Token Required
Without `GITHUB_TOKEN`, these tasks will fail:
- `github_monitor`
- `security_scan`
- `build_failure_repair`

**Working without token:**
- `deployment_check` (local health checks)
- `shell_command` (local commands)
- `system_check` (internal health)

---

## Next Actions

| Priority | Action | Command |
|----------|--------|---------|
| 1 | Add GitHub token | `nano .env` → add `GITHUB_TOKEN=...` |
| 2 | Restart scheduler | `pkill -f "node bootstrap.js" && nohup node bootstrap.js > scheduler.log 2>&1 &` |
| 3 | Test GitHub task | `curl -X POST ... github_monitor ...` |
| 4 | Install systemd | `sudo cp *.service /etc/systemd/system/` |
| 5 | Enable ecosystem | Edit `.env` → `ENABLE_ECOSYSTEM=true` |

---

## Support

- **Docs:** `DAEMONIZATION.md`, `GITHUB_SETUP.md`, `ECOSYSTEM_LINK.md`
- **Status:** `node status.js`
- **Logs:** `tail -f scheduler.log`, `journalctl -u devonn-scheduler`

---

*DEVONN.ai Scheduler v2.0 - Production Ready (pending token)*
