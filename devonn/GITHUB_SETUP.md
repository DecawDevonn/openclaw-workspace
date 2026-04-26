# GitHub Integration Setup

> Configure GitHub token for scheduler tasks

---

## Quick Setup

### 1. Generate GitHub Token

1. Go to: https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Select scopes:
   - ✅ `repo` - Full repository access
   - ✅ `workflow` - Actions workflow access
   - ✅ `read:org` - Read organization data
4. Click **Generate token**
5. **Copy the token immediately** (you won't see it again)

### 2. Add Token to .env

```bash
# Edit the .env file
nano /home/ubuntu/.openclaw/workspace/.env

# Add your token:
GITHUB_TOKEN=ghp_your_token_here

# Save and exit (Ctrl+X, Y, Enter)
```

### 3. Restart Scheduler

```bash
# If running as service:
sudo systemctl restart devonn-scheduler

# If running manually:
# Stop current instance (Ctrl+C or kill)
# Then restart:
node bootstrap.js
```

### 4. Verify

```bash
# Check scheduler health
node status.js

# Test GitHub task
curl -X POST http://localhost:7373/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "github_monitor",
    "priority": 7,
    "payload": {
      "action": "repo_health",
      "repo": "openclaw-workspace"
    }
  }'
```

---

## Token Permissions Required

| Task Type | Required Scopes |
|-----------|----------------|
| `github_monitor` | `repo`, `read:org` |
| `security_scan` | `repo`, `read:org` |
| `build_failure_repair` | `repo`, `workflow` |
| `deployment_check` | None (public endpoints) |

---

## Security Best Practices

1. **Never commit tokens to git**
   ```bash
   # .env is already in .gitignore
   # Verify:
   grep .env .gitignore
   ```

2. **Use fine-grained tokens** (recommended)
   - Go to: https://github.com/settings/personal-access-tokens
   - Select only required repositories
   - Set expiration (90 days recommended)

3. **Rotate tokens regularly**
   ```bash
   # Set calendar reminder for token rotation
   # Update .env with new token
   # Restart service
   ```

4. **Restrict token access**
   - Limit to specific repositories if possible
   - Set expiration dates
   - Monitor token usage in GitHub settings

---

## Troubleshooting

### 401 Unauthorized Error
```
[SchedulerBrain] Task failed: ... - GitHub API error: 401 Unauthorized
```

**Fix:**
1. Check token is set: `grep GITHUB_TOKEN .env`
2. Verify token hasn't expired
3. Regenerate token at https://github.com/settings/tokens
4. Update .env and restart

### 403 Rate Limited
```
GitHub API error: 403 rate limit exceeded
```

**Fix:**
- Authenticated requests have higher rate limits
- Ensure GITHUB_TOKEN is set correctly
- Consider reducing task frequency

### 404 Not Found
```
GitHub API error: 404 Not Found
```

**Fix:**
- Verify repository name is correct
- Check organization name in .env
- Ensure token has access to the repo

---

## Testing Without Token

Some tasks work without GitHub token:

```bash
# Deployment checks (no auth required)
curl -X POST http://localhost:7373/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "deployment_check",
    "priority": 6,
    "payload": {
      "action": "check_service",
      "service": "scheduler"
    }
  }'
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | For GitHub tasks | Personal access token |
| `ORGANIZATION` | No | GitHub org/user (default: wesship) |

---

*Part of DEVONN.ai Scheduler v2.0*
