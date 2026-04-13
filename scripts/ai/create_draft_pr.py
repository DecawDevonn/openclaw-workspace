#!/usr/bin/env python3
"""
Draft PR Creator - Creates draft PRs from generated patches
Part of the Autonomous Fix Engine Phase 2
"""

import os
import sys
import json
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime


# =============================================================================
# CONFIGURATION
# =============================================================================

MIN_CONFIDENCE_FOR_PR = 0.6
MAX_FILES_PER_PR = 10


# =============================================================================
# LOGGING
# =============================================================================

def log(msg: str, level: str = "INFO"):
    """Print structured log message"""
    timestamp = datetime.utcnow().isoformat()
    if level == "ERROR":
        print(f"::error::{msg}")
    elif level == "WARN":
        print(f"::warning::{msg}")
    print(f"[{timestamp}] [{level}] {msg}", file=sys.stderr if level == "ERROR" else sys.stdout)


def set_output(name: str, value: str):
    """Set GitHub Actions output variable"""
    output_file = os.environ.get("GITHUB_OUTPUT")
    if output_file:
        with open(output_file, "a") as f:
            if "\n" in value:
                delimiter = f"ghadelimiter_{hashlib.sha256(name.encode()).hexdigest()[:8]}"
                f.write(f"{name}<<{delimiter}\n")
                f.write(f"{value}\n")
                f.write(f"{delimiter}\n")
            else:
                f.write(f"{name}={value}\n")


# =============================================================================
# GIT OPERATIONS
# =============================================================================

def run_git_command(args: List[str], cwd: str = ".") -> Tuple[bool, str]:
    """Run a git command and return success status and output"""
    try:
        result = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=False
        )
        if result.returncode == 0:
            return True, result.stdout.strip()
        return False, result.stderr.strip()
    except Exception as e:
        return False, str(e)


def get_current_branch(repo_root: str = ".") -> str:
    """Get current git branch"""
    success, output = run_git_command(["rev-parse", "--abbrev-ref", "HEAD"], repo_root)
    return output if success else "main"


def create_branch(branch_name: str, repo_root: str = ".") -> bool:
    """Create and checkout a new branch"""
    success, _ = run_git_command(["checkout", "-b", branch_name], repo_root)
    return success


def stage_files(files: List[str], repo_root: str = ".") -> bool:
    """Stage files for commit"""
    if not files:
        return True
    success, _ = run_git_command(["add"] + files, repo_root)
    return success


def commit_changes(message: str, repo_root: str = ".") -> bool:
    """Commit staged changes"""
    success, _ = run_git_command(["commit", "-m", message], repo_root)
    return success


def push_branch(branch_name: str, repo_root: str = ".") -> bool:
    """Push branch to remote"""
    success, _ = run_git_command(["push", "-u", "origin", branch_name], repo_root)
    return success


# =============================================================================
# GITHUB API
# =============================================================================

def create_draft_pr(
    title: str,
    body: str,
    head_branch: str,
    base_branch: str = "main",
    repo: str = ""
) -> Optional[Dict[str, Any]]:
    """Create a draft PR using GitHub CLI"""
    
    # Use gh CLI if available
    success, output = run_git_command([
        "gh", "pr", "create",
        "--title", title,
        "--body", body,
        "--head", head_branch,
        "--base", base_branch,
        "--draft"
    ])
    
    if success:
        # Extract PR number from output
        # Output is like: https://github.com/owner/repo/pull/123
        if "/pull/" in output:
            pr_number = output.split("/pull/")[-1].strip()
            return {
                "number": pr_number,
                "url": output,
                "success": True
            }
        return {"number": "unknown", "url": output, "success": True}
    
    log(f"Failed to create PR: {output}", "ERROR")
    return None


def comment_on_issue(issue_number: str, comment: str, repo: str = "") -> bool:
    """Add a comment to the original issue"""
    success, output = run_git_command([
        "gh", "issue", "comment", issue_number,
        "--body", comment
    ])
    return success


# =============================================================================
# PR BODY GENERATION
# =============================================================================

def generate_pr_body(proposal_data: Dict[str, Any], patch_data: Dict[str, Any]) -> str:
    """Generate PR body from proposal and patch data"""
    
    body = f"""## 🤖 Autonomous Fix Proposal

This PR was automatically generated by the Autonomous Fix Engine.

### Original Issue
#{proposal_data.get('issue_number', 'unknown')}

### Root Cause
{proposal_data.get('root_cause', 'See issue for details')}

### Changes Made
"""
    
    # List changed files
    for change in proposal_data.get('file_changes', []):
        body += f"- `{change.get('file', 'unknown')}`\n"
    
    body += f"""
### Confidence Score
{proposal_data.get('confidence_score', 0.5):.0%}

### Risk Level
{calculate_risk_level(proposal_data)}

### Rationale
{proposal_data.get('rationale', 'See proposal analysis')}

---

**Note:** This is an automated fix. Please review carefully before merging.

**To accept:** Review and merge if correct.
**To reject:** Close this PR and comment on the original issue with feedback.
"""
    
    return body


def calculate_risk_level(proposal_data: Dict[str, Any]) -> str:
    """Calculate risk level"""
    score = proposal_data.get("confidence_score", 0.5)
    files_changed = len(proposal_data.get("file_changes", []))
    
    if score < 0.4 or files_changed > 5:
        return "🔴 High"
    elif score < 0.7 or files_changed > 2:
        return "🟡 Medium"
    return "🟢 Low"


# =============================================================================
# MAIN WORKFLOW
# =============================================================================

def should_create_pr(proposal_data: Dict[str, Any], patch_data: Dict[str, Any]) -> Tuple[bool, str]:
    """Determine if we should create a PR based on confidence and patch status"""
    
    confidence = proposal_data.get("confidence_score", 0)
    
    if confidence < MIN_CONFIDENCE_FOR_PR:
        return False, f"Confidence too low ({confidence:.2f} < {MIN_CONFIDENCE_FOR_PR})"
    
    if not patch_data.get("patches"):
        return False, "No patches generated"
    
    if patch_data.get("failed"):
        return False, f"Some patches failed: {patch_data['failed']}"
    
    files_count = len(patch_data.get("patches", []))
    if files_count > MAX_FILES_PER_PR:
        return False, f"Too many files ({files_count} > {MAX_FILES_PER_PR})"
    
    return True, "Passed all checks"


def create_pr_from_patch(
    proposal_file: str,
    patch_file: str,
    repo_root: str = ".",
    dry_run: bool = False
) -> Dict[str, Any]:
    """Main function to create PR from patch"""
    
    result = {
        "success": False,
        "pr_number": None,
        "pr_url": None,
        "branch": None,
        "reason": ""
    }
    
    # Load proposal and patch data
    try:
        with open(proposal_file, 'r') as f:
            proposal_data = json.load(f)
        with open(patch_file, 'r') as f:
            patch_data = json.load(f)
    except Exception as e:
        result["reason"] = f"Failed to load data: {e}"
        log(result["reason"], "ERROR")
        return result
    
    # Check if we should create PR
    should_create, reason = should_create_pr(proposal_data, patch_data)
    if not should_create:
        result["reason"] = reason
        log(f"Skipping PR creation: {reason}", "WARN")
        return result
    
    if dry_run:
        log("DRY RUN: Would create PR with title: " + f"🤖 Fix: Issue #{proposal_data.get('issue_number', 'unknown')}")
        result["success"] = True
        result["reason"] = "Dry run mode - no PR created"
        return result
    
    # Generate branch name
    issue_number = proposal_data.get("issue_number", "unknown")
    timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    branch_name = f"auto-fix/issue-{issue_number}-{timestamp}"
    
    # Create branch
    log(f"Creating branch: {branch_name}")
    if not create_branch(branch_name, repo_root):
        result["reason"] = "Failed to create branch"
        log(result["reason"], "ERROR")
        return result
    
    # Apply patches
    log("Applying patches...")
    patch_result = generate_patch(proposal_data, repo_root, apply=True)
    
    if patch_result["failed"]:
        result["reason"] = f"Failed to apply patches: {patch_result['failed']}"
        log(result["reason"], "ERROR")
        return result
    
    # Stage and commit
    changed_files = [p["file"] for p in patch_result["patches"]]
    if not stage_files(changed_files, repo_root):
        result["reason"] = "Failed to stage files"
        log(result["reason"], "ERROR")
        return result
    
    commit_message = f"""🤖 Auto-fix: Issue #{issue_number}

This fix was automatically generated by the Autonomous Fix Engine.

Confidence: {proposal_data.get('confidence_score', 0):.0%}
Root cause: {proposal_data.get('root_cause', 'See issue for details')}

Files changed:
"""
    for f in changed_files:
        commit_message += f"- {f}\n"
    
    if not commit_changes(commit_message, repo_root):
        result["reason"] = "Failed to commit changes"
        log(result["reason"], "ERROR")
        return result
    
    # Push branch
    log(f"Pushing branch {branch_name}...")
    if not push_branch(branch_name, repo_root):
        result["reason"] = "Failed to push branch"
        log(result["reason"], "ERROR")
        return result
    
    # Create PR
    pr_title = f"🤖 Auto-fix: Issue #{issue_number}"
    pr_body = generate_pr_body(proposal_data, patch_data)
    
    log("Creating draft PR...")
    pr_info = create_draft_pr(pr_title, pr_body, branch_name)
    
    if pr_info:
        result["success"] = True
        result["pr_number"] = pr_info.get("number")
        result["pr_url"] = pr_info.get("url")
        result["branch"] = branch_name
        result["reason"] = "PR created successfully"
        
        # Comment on original issue
        comment = f"""## ✅ Fix Applied

I've created a draft PR with the proposed fix: {pr_info.get('url')}

**Changes:** {len(changed_files)} file(s) modified
**Confidence:** {proposal_data.get('confidence_score', 0):.0%}

Please review and:
- **Merge** if the fix looks correct
- **Close** and comment with feedback if it needs adjustment

*This helps the Autonomous Fix Engine learn and improve.*"""
        
        comment_on_issue(issue_number, comment)
    else:
        result["reason"] = "Failed to create PR"
        log(result["reason"], "ERROR")
    
    return result


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Create draft PR from fix proposal")
    parser.add_argument("--proposal-file", required=True, help="Proposal JSON file")
    parser.add_argument("--patch-file", required=True, help="Patch JSON file")
    parser.add_argument("--repo", default=".", help="Repository root")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done")
    
    args = parser.parse_args()
    
    result = create_pr_from_patch(
        args.proposal_file,
        args.patch_file,
        args.repo,
        args.dry_run
    )
    
    # Output results
    print("\n" + "="*60)
    print("DRAFT PR CREATION RESULTS")
    print("="*60)
    print(f"Success: {result['success']}")
    print(f"Reason: {result['reason']}")
    
    if result['pr_number']:
        print(f"PR Number: {result['pr_number']}")
        print(f"PR URL: {result['pr_url']}")
        print(f"Branch: {result['branch']}")
        
        set_output("pr_number", result['pr_number'])
        set_output("pr_url", result['pr_url'])
        set_output("branch", result['branch'])
        set_output("success", "true")
    else:
        set_output("success", "false")
        set_output("reason", result['reason'])
    
    sys.exit(0 if result['success'] else 1)


if __name__ == "__main__":
    main()
