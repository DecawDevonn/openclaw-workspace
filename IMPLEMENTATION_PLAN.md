# Implementation Plan: VS Code Issue #309025

## Issue: Stage / Unstage changes

**Repository:** microsoft/vscode  
**Issue URL:** https://github.com/microsoft/vscode/issues/309025  
**Complexity:** Medium  
**Estimated Time:** 2-4 hours  

---

## Understanding the Issue

The title "Stage / Unstage changes" suggests this is related to Git source control functionality in VS Code. This likely involves:

- The Source Control panel UI
- Git extension commands
- Context menu actions for staging/unstaging files
- Keyboard shortcuts or command palette integration

---

## Research Phase (30 minutes)

### 1. Explore VS Code Source Control

```bash
# Clone VS Code repo (if not already)
git clone https://github.com/microsoft/vscode.git
cd vscode

# Find Source Control related files
grep -r "stage" --include="*.ts" extensions/git/src/ | head -20
grep -r "unstage" --include="*.ts" extensions/git/src/ | head -20
```

### 2. Key Areas to Investigate

| Area | Files to Check |
|------|----------------|
| Git Extension | `extensions/git/src/commands.ts` |
| Source Control UI | `src/vs/workbench/contrib/scm/` |
| Context Menus | `extensions/git/package.json` (contributes.menus) |
| Commands | `extensions/git/src/commands.ts` |

### 3. Look For

- How stage/unstage commands are currently implemented
- What UI elements exist (buttons, context menus, keybindings)
- Any missing functionality or UI gaps
- Related issues or PRs

---

## Implementation Strategy

### Option A: Add Missing Command (Most Likely)

If the issue is about adding a missing stage/unstage command:

1. **Locate command definitions** in `extensions/git/src/commands.ts`
2. **Add new command** or fix existing one
3. **Register in package.json** under `contributes.commands`
4. **Add to UI** (context menu, button, or keybinding)

### Option B: Fix UI/UX Issue

If the issue is about improving the UI:

1. **Find SCM viewlet** in `src/vs/workbench/contrib/scm/`
2. **Modify action buttons** or context menu
3. **Update icons/labels** for clarity

### Option C: Add Keyboard Shortcut

If the issue is about keyboard accessibility:

1. **Add keybinding** in `extensions/git/package.json`
2. **Ensure command exists** and works properly

---

## Step-by-Step Implementation

### Step 1: Setup Development Environment (15 min)

```bash
# Fork VS Code repo on GitHub first
git clone https://github.com/DecawDevonn/vscode.git
cd vscode

# Install dependencies
yarn install

# Open in VS Code
code .
```

### Step 2: Find the Issue (30 min)

```bash
# Search for stage/unstage related code
grep -rn "stage" extensions/git/src/ --include="*.ts" | grep -i "command\|menu\|action"

# Look at the git extension structure
ls -la extensions/git/src/
```

**Key files:**
- `extensions/git/src/commands.ts` - All git commands
- `extensions/git/src/repository.ts` - Repository operations
- `extensions/git/package.json` - Extension manifest (commands, menus)

### Step 3: Implement the Fix (1-2 hours)

Based on what you find, implement one of:

**If adding a command:**
```typescript
// In extensions/git/src/commands.ts
@command('git.stageChange', { repository: true })
async stageChange(repository: Repository, ...changes: SourceControlResourceChange[]): Promise<void> {
    // Implementation
}
```

**If fixing UI:**
```json
// In extensions/git/package.json
"contributes": {
  "menus": {
    "scm/resourceState/context": [
      {
        "command": "git.stage",
        "group": "1_modification@1"
      }
    ]
  }
}
```

### Step 4: Test Locally (30 min)

```bash
# Build the extension
cd extensions/git
npm run compile

# Or build entire VS Code
yarn watch

# Test in Extension Development Host
# Press F5 in VS Code
```

### Step 5: Write Tests (30 min)

```bash
# Find existing tests
grep -r "stage" extensions/git/src/test/ --include="*.ts"

# Add test for your change
# In extensions/git/src/test/git.test.ts or similar
```

### Step 6: Commit and Push (15 min)

```bash
# Create branch
git checkout -b fix/stage-unstage-changes

# Commit
git add .
git commit -m "fix(git): improve stage/unstage changes functionality

- Add/fix stage/unstage command
- Update UI for better accessibility
- Add keyboard shortcut

Fixes #309025"

# Push
git push origin fix/stage-unstage-changes
```

---

## Files Likely to Change

| File | Purpose |
|------|---------|
| `extensions/git/src/commands.ts` | Command implementations |
| `extensions/git/package.json` | Command/menu registrations |
| `extensions/git/src/repository.ts` | Git operations |
| `src/vs/workbench/contrib/scm/browser/scmViewPane.ts` | SCM UI |

---

## Testing Checklist

- [ ] Stage single file works
- [ ] Unstage single file works
- [ ] Stage multiple files works
- [ ] Unstage multiple files works
- [ ] Keyboard shortcut works (if added)
- [ ] Context menu shows correct options
- [ ] Command palette shows commands
- [ ] No errors in console

---

## PR Description Template

```markdown
## Description
This PR improves the stage/unstage changes functionality in the Git extension.

## Changes
- Added/fixed [specific functionality]
- Improved [UI/UX aspect]
- Added [keyboard shortcut/test]

## Testing
- [ ] Tested staging single file
- [ ] Tested unstaging single file
- [ ] Tested staging multiple files
- [ ] Tested keyboard shortcut

## Related Issue
Fixes #309025
```

---

## Getting Help

If stuck:
1. Check VS Code contributing guide: https://github.com/microsoft/vscode/wiki/How-to-Contribute
2. Look at similar merged PRs: https://github.com/microsoft/vscode/pulls?q=is%3Apr+git+stage
3. Ask in issue comments for clarification

---

## Time Estimate

| Phase | Time |
|-------|------|
| Research | 30 min |
| Setup | 15 min |
| Implementation | 1-2 hours |
| Testing | 30 min |
| PR creation | 15 min |
| **Total** | **2.5-4 hours** |

---

**Ready to start?** Clone the repo and begin Step 1!
