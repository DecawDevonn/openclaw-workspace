# DEVONN Scheduler Daemonization

> Systemd service setup for production deployment

---

## Service Files

| Service | Purpose | Status |
|---------|---------|--------|
| `devonn-scheduler.service` | Main scheduler + Dashboard API | Required |
| `devonn-ecosystem.service` | Ecosystem connector (optional) | Optional |

---

## Quick Install

```bash
# 1. Copy service files to systemd
sudo cp devonn-scheduler.service /etc/systemd/system/
sudo cp devonn-ecosystem.service /etc/systemd/system/

# 2. Create .env file (if not exists)
cp /home/ubuntu/.openclaw/workspace/.env.example /home/ubuntu/.openclaw/workspace/.env
# Edit and fill in your values:
nano /home/ubuntu/.openclaw/workspace/.env

# 3. Reload systemd
sudo systemctl daemon-reload

# 4. Enable services (start on boot)
sudo systemctl enable devonn-scheduler
sudo systemctl enable devonn-ecosystem

# 5. Start services
sudo systemctl start devonn-scheduler
sudo systemctl start devonn-ecosystem

# 6. Check status
sudo systemctl status devonn-scheduler
sudo systemctl status devonn-ecosystem
```

---

## Configuration

### Environment Variables

Edit `/home/ubuntu/.openclaw/workspace/.env`:

```bash
# Required
GITHUB_TOKEN=ghp_your_token_here

# Optional - Ecosystem
ENABLE_ECOSYSTEM=false
ORCHESTRATOR_URL=https://central-orchestrator.onrender.com
GATEWAY_URL=https://openclaw-gateway-2t9e.onrender.com
ORGANIZATION=wesship

# Optional - API
DEVONN_API_PORT=7373
```

---

## Management Commands

```bash
# Start/stop/restart
sudo systemctl start devonn-scheduler
sudo systemctl stop devonn-scheduler
sudo systemctl restart devonn-scheduler

# View logs
sudo journalctl -u devonn-scheduler -f
sudo journalctl -u devonn-scheduler -n 50 --no-pager

# Check health
curl http://localhost:7373/health
node status.js health

# Disable auto-start
sudo systemctl disable devonn-scheduler
```

---

## Troubleshooting

### Service won't start
```bash
# Check logs
sudo journalctl -u devonn-scheduler -n 100 --no-pager

# Check Node.js path
which node
ls -la /usr/bin/node

# Verify .env exists
ls -la /home/ubuntu/.openclaw/workspace/.env
```

### Port already in use
```bash
# Find process using port 7373
sudo lsof -i :7373
# or
sudo fuser 7373/tcp

# Kill if needed
sudo kill -9 <PID>
```

### Permission denied
```bash
# Fix data directory permissions
sudo chown -R ubuntu:ubuntu /home/ubuntu/.openclaw/workspace/devonn/data
```

---

## Service File Details

### devonn-scheduler.service
- **Type**: Simple
- **User**: ubuntu
- **Restart**: always (5s delay)
- **Working Directory**: `/home/ubuntu/.openclaw/workspace/devonn`
- **Environment**: Loaded from `/home/ubuntu/.openclaw/workspace/.env`
- **Features**: 
  - Auto-restart on failure
  - Journal logging
  - Security hardening (NoNewPrivileges, ProtectSystem)

### devonn-ecosystem.service
- **Depends on**: devonn-scheduler.service
- **Purpose**: Connects to Devonn.ai ecosystem (optional)
- **Restart**: always (10s delay)

---

## Uninstall

```bash
sudo systemctl stop devonn-scheduler devonn-ecosystem
sudo systemctl disable devonn-scheduler devonn-ecosystem
sudo rm /etc/systemd/system/devonn-scheduler.service
sudo rm /etc/systemd/system/devonn-ecosystem.service
sudo systemctl daemon-reload
```

---

*Part of DEVONN.ai Autonomous Scheduler v2.0*
