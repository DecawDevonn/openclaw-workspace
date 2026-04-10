# GitHub Automation Tools

Lightweight automation for discovering and planning GitHub contributions.

## Tools

### 1. Issue Scanner (`scanner.js`)

Scans a repository for "good first issues" and scores them by complexity.

**Usage:**
```bash
node scanner.js <owner/repo>
```

**Example:**
```bash
node scanner.js facebook/react
node scanner.js microsoft/vscode
node scanner.js rust-lang/rust
```

**Output:**
- Top 10 candidate issues
- Score (0-100) with reasoning
- Complexity level (LOW/MEDIUM/HIGH)
- Direct links to issues
- Saved to `scan-results.json`

**Scoring Factors:**
- Good first issue label (+25)
- Help wanted label (+15)
- Documentation label (+10)
- Recent activity (+10)
- Clear title (+5)
- Complexity keywords (-20)
- Stale issues (-15)

---

### 2. Issue Planner (`planner.js`)

Generates an implementation plan for a specific issue.

**Usage:**
```bash
node planner.js <issue-url>
```

**Example:**
```bash
node planner.js https://github.com/facebook/react/issues/12345
```

**Output:**
- Issue type detection (bugfix/feature/docs/testing/refactoring)
- Complexity estimate
- Step-by-step approach
- Risk assessment
- Checklist for completion
- Saved to `plan-{repo}-{number}.json`

---

## Workflow

### Find Issues to Work On

1. Scan a repository:
   ```bash
   node scanner.js microsoft/vscode
   ```

2. Review the top candidates

3. Pick one and generate a plan:
   ```bash
   node planner.js https://github.com/microsoft/vscode/issues/309025
   ```

4. Follow the plan to implement

---

## No Authentication Required

These tools use the public GitHub API without authentication.

**Rate limits:**
- 60 requests per hour (unauthenticated)
- Sufficient for personal use

For higher limits, set a token:
```bash
export GITHUB_TOKEN=your_token_here
```

---

## vs. Full V2 System

This is a **practical subset** of the V2 PRD:

| Feature | V2 PRD | These Tools |
|---------|--------|-------------|
| Repo discovery | ✅ Multi-source | ✅ Single repo |
| Issue scoring | ✅ Complex ML | ✅ Rule-based |
| Planning | ✅ AI-generated | ✅ Template-based |
| Auto-execution | ✅ Full automation | ❌ Manual only |
| Policy engine | ✅ Multi-zone | ❌ Not needed |
| Approval workflow | ✅ Telegram | ❌ Not needed |
| Publishing | ✅ Auto-PR | ❌ Manual PR |

**Use these tools when:**
- You're exploring repos for contributions
- You want structured planning
- You're doing manual implementation

**Build V2 when:**
- You're managing 10+ repos
- You have a team
- You need full automation
