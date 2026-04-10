# GitHub Authentication Instructions

## Quick Setup (2 minutes)

### Step 1: Create Personal Access Token
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes:
   - ✅ `repo` (full control of private repositories)
   - ✅ `read:org` (read org membership)
4. Generate and **copy the token**

### Step 2: Authenticate

**Option A: Interactive (recommended)**
```bash
gh auth login
```
- Choose: GitHub.com
- Choose: HTTPS
- Paste your token when prompted

**Option B: Environment variable**
```bash
export GH_TOKEN=your_token_here
gh auth status
```

**Option C: Store in file**
```bash
echo "your_token_here" > ~/.github-token
gh auth login --with-token < ~/.github-token
```

### Step 3: Verify
```bash
gh auth status
gh repo list
```

## Post-Authentication Tasks

Once authenticated, run these commands:

```bash
# 1. Push workspace to GitHub
cd /home/ubuntu/.openclaw/workspace
./push-to-github.sh YOUR_USERNAME

# 2. Find issues to work on
cd github-automation
node scanner.js facebook/react

# 3. Generate plan for an issue
node planner.js https://github.com/owner/repo/issues/123
```

## Troubleshooting

**"Bad credentials" error:**
- Token may be expired
- Create a new token

**"Permission denied" error:**
- Ensure `repo` scope is selected
- For private repos, also need `read:org`

**Rate limiting:**
- Authenticated: 5,000 requests/hour
- Unauthenticated: 60 requests/hour
