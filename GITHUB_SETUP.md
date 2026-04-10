# GitHub Setup Guide

## Quick Start

Your workspace is ready to push to GitHub. Follow these steps:

### 1. Create Repository on GitHub

Visit: https://github.com/new

**Settings:**
- Repository name: `openclaw-workspace`
- Description: `OpenClaw workspace with Quick-Capture v2 and API`
- Visibility: Private
- Initialize with README: ❌ No

Click **"Create repository"**

### 2. Push Your Code

After creating the repo, run these commands in your terminal:

```bash
cd /home/ubuntu/.openclaw/workspace

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/openclaw-workspace.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 3. Authentication

When prompted for password, use a **Personal Access Token**:

1. Create token at: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scope: `repo` (full control of private repositories)
4. Generate and copy the token
5. Use it as your password when pushing

### 4. Verify

After pushing, visit:
```
https://github.com/YOUR_USERNAME/openclaw-workspace
```

You should see all your files.

---

## What's in Your Repo

```
openclaw-workspace/
├── AGENTS.md          # Agent configuration
├── BOOTSTRAP.md       # First-run guide
├── HEARTBEAT.md       # Periodic tasks
├── IDENTITY.md        # Your identity
├── SOUL.md            # Personality
├── TOOLS.md           # Tool configurations
├── USER.md            # User profile
├── capture/           # Quick-Capture v2 data
│   ├── config.json
│   ├── index.json
│   ├── todos.md
│   ├── ideas.md
│   ├── notes.md
│   └── thoughts.md
└── capture-api/       # API server
    ├── package.json
    ├── server.js
    └── start.sh
```

---

## Next Steps After Push

1. **Set up GitHub Actions** (optional)
   - Auto-deploy on push
   - Run tests

2. **Connect to OpenClaw**
   - Use `gh` CLI to check issues/PRs
   - Automate GitHub workflows

3. **Clone to other machines**
   ```bash
   git clone https://github.com/YOUR_USERNAME/openclaw-workspace.git
   ```

---

## Need Help?

If you get stuck:
1. Check GitHub's docs: https://docs.github.com/en/get-started
2. Generate PAT: https://github.com/settings/tokens
3. Test authentication: `gh auth login`
