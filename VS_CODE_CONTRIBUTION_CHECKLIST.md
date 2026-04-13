# VS Code Contribution Checklist

## Pre-Flight (Before You Start)

- [ ] Fork https://github.com/microsoft/vscode to your account
- [ ] Verify fork exists at https://github.com/DecawDevonn/vscode
- [ ] Clone your fork: `git clone https://github.com/DecawDevonn/vscode.git`
- [ ] Add upstream: `git remote add upstream https://github.com/microsoft/vscode.git`
- [ ] Install dependencies: `yarn install` (takes 10-15 min)

## Development Setup

- [ ] Create branch: `git checkout -b fix/309025-stage-unstage`
- [ ] Open in VS Code: `code .`
- [ ] Run initial build: `yarn compile`

## Understanding the Issue

- [ ] Search for stage/unstage in SCM: `rg "stage" src/vs/workbench/contrib/scm`
- [ ] Read issue #309025 carefully
- [ ] Identify the exact problem
- [ ] Find existing stage/unstage commands

## Implementation

- [ ] Make minimal fix
- [ ] Test locally: `./scripts/code.sh` or `yarn watch` + F5
- [ ] Verify fix works
- [ ] Run existing tests: `yarn test-extension git`

## Submission

- [ ] Commit: `git commit -m "fix: ..."`
- [ ] Push: `git push origin fix/309025-stage-unstage`
- [ ] Create PR on GitHub
- [ ] Fill PR description

## Post-Submission

- [ ] Respond to reviewer feedback
- [ ] Make requested changes
- [ ] Get PR merged!

---

## Current Status

**Last Updated:** 2026-04-10  
**Issue:** #309025 - Stage / Unstage changes  
**Status:** ⏳ Ready to start

**Next Action:** Complete Pre-Flight checklist above
