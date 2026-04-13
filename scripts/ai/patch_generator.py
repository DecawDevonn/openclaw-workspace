#!/usr/bin/env python3
"""Patch Generator - Converts fix proposals into unified diffs"""

import os
import sys
import json
import re
import hashlib
import difflib
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime

MAX_PATCH_SIZE_LINES = 500
MIN_CONFIDENCE_FOR_PR = 0.6
FORBIDDEN_PATHS = {'..', '~', '/etc', '/usr', '/bin', '/sbin', '/lib', '/opt', '/var', '.git'}

def log(msg: str, level: str = "INFO"):
    timestamp = datetime.utcnow().isoformat()
    if level == "ERROR":
        print(f"::error::{msg}")
    elif level == "WARN":
        print(f"::warning::{msg}")
    print(f"[{timestamp}] [{level}] {msg}", file=sys.stderr if level == "ERROR" else sys.stdout)

def set_output(name: str, value: str):
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

def sanitize_file_path(file_path: str, repo_root: str = ".") -> Optional[str]:
    path = os.path.normpath(file_path)
    for forbidden in FORBIDDEN_PATHS:
        if forbidden in path:
            log(f"Path contains forbidden pattern: {file_path}", "WARN")
            return None
    full_path = os.path.abspath(os.path.join(repo_root, path))
    repo_abs = os.path.abspath(repo_root)
    if not full_path.startswith(repo_abs):
        log(f"Path escapes repo root: {file_path}", "WARN")
        return None
    return full_path

def generate_unified_diff(file_path: str, before: str, after: str, context: int = 3) -> str:
    before_lines = before.splitlines(keepends=True)
    after_lines = after.splitlines(keepends=True)
    before_lines = [l if l.endswith('\n') else l + '\n' for l in before_lines]
    after_lines = [l if l.endswith('\n') else l + '\n' for l in after_lines]
    diff = difflib.unified_diff(
        before_lines, after_lines,
        fromfile=f"a/{file_path}", tofile=f"b/{file_path}", n=context
    )
    return ''.join(diff)

def apply_patch_to_file(file_path: str, before: str, after: str, repo_root: str = ".") -> Tuple[bool, str]:
    safe_path = sanitize_file_path(file_path, repo_root)
    if not safe_path:
        return False, "Path sanitization failed"
    if not os.path.exists(safe_path):
        try:
            os.makedirs(os.path.dirname(safe_path), exist_ok=True)
            with open(safe_path, 'w') as f:
                f.write(after)
            return True, f"Created new file: {file_path}"
        except Exception as e:
            return False, f"Failed to create file: {e}"
    try:
        with open(safe_path, 'r') as f:
            current = f.read()
    except Exception as e:
        return False, f"Failed to read file: {e}"
    if before.strip():
        if before.strip() not in current:
            return False, "Before content does not match current file"
        new_content = current.replace(before.strip(), after.strip(), 1)
    else:
        new_content = after
    try:
        with open(safe_path, 'w') as f:
            f.write(new_content)
        return True, f"Updated file: {file_path}"
    except Exception as e:
        return False, f"Failed to write file: {e}"

def parse_proposal(proposal_text: str) -> Dict[str, Any]:
    result = {"file_changes": [], "confidence": "medium", "confidence_score": 0.5, "root_cause": "", "rationale": ""}
    file_pattern = r'File:\s*([\w\-/\\.]+)'
    files = re.findall(file_pattern, proposal_text)
    code_block_pattern = r'```(?:\w+)?\n(.*?)```'
    code_blocks = re.findall(code_block_pattern, proposal_text, re.DOTALL)
    for i, file_path in enumerate(files):
        change = {"file": file_path, "before": "", "after": ""}
        if i < len(code_blocks):
            block = code_blocks[i]
            if "# Before:" in block and "# After:" in block:
                parts = block.split("# After:")
                change["before"] = parts[0].replace("# Before:", "").strip()
                change["after"] = parts[1].strip() if len(parts) > 1 else ""
            else:
                change["after"] = block
        result["file_changes"].append(change)
    confidence_patterns = [
        (r'Confidence[\s\-:]+(\d+)%', lambda m: int(m.group(1)) / 100),
        (r'Confidence[\s\-:]+(\d\.\d+)', lambda m: float(m.group(1))),
        (r'Confidence[\s\-:]+(low|medium|high)', lambda m: {'low': 0.3, 'medium': 0.6, 'high': 0.9}[m.group(1).lower()]),
    ]
    for pattern, extractor in confidence_patterns:
        match = re.search(pattern, proposal_text, re.IGNORECASE)
        if match:
            result["confidence_score"] = extractor(match)
            break
    cause_match = re.search(r'Root Cause[\s:]+(.+?)(?:\n\n|\Z)', proposal_text, re.DOTALL | re.IGNORECASE)
    if cause_match:
        result["root_cause"] = cause_match.group(1).strip()
    rationale_match = re.search(r'Rationale[\s:]+(.+?)(?:\n\n|\Z)', proposal_text, re.DOTALL | re.IGNORECASE)
    if rationale_match:
        result["rationale"] = rationale_match.group(1).strip()
    return result

def generate_patch(proposal_data: Dict[str, Any], repo_root: str = ".", apply: bool = False) -> Dict[str, Any]:
    result = {"patches": [], "applied": [], "failed": [], "diff": "", "can_create_pr": False, "confidence_score": proposal_data.get("confidence_score", 0.5)}
    all_diffs = []
    for change in proposal_data.get("file_changes", []):
        file_path = change.get("file", "")
        before = change.get("before", "")
        after = change.get("after", "")
        if not file_path or not after:
            continue
        diff = generate_unified_diff(file_path, before, after)
        all_diffs.append(diff)
        patch_info = {"file": file_path, "diff": diff, "lines_changed": diff.count('\n+') + diff.count('\n-') - 2}
        result["patches"].append(patch_info)
        if apply:
            success, message = apply_patch_to_file(file_path, before, after, repo_root)
            if success:
                result["applied"].append({"file": file_path, "message": message})
            else:
                result["failed"].append({"file": file_path, "error": message})
    result["diff"] = '\n'.join(all_diffs)
    result["can_create_pr"] = (result["confidence_score"] >= MIN_CONFIDENCE_FOR_PR and len(result["patches"]) > 0 and len(result["failed"]) == 0)
    return result

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate patches from fix proposals")
    parser.add_argument("--proposal-file", required=True, help="JSON file containing proposal")
    parser.add_argument("--repo", default=".", help="Repository root")
    parser.add_argument("--apply", action="store_true", help="Actually apply patches to files")
    parser.add_argument("--output-json", help="Save result to JSON file")
    parser.add_argument("--output-diff", help="Save unified diff to file")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without doing it")
    args = parser.parse_args()
    try:
        with open(args.proposal_file, 'r') as f:
            data = json.load(f)
    except Exception as e:
        log(f"Failed to load proposal file: {e}", "ERROR")
        sys.exit(1)
    proposal_text = data.get("proposal", "")
    proposal_data = parse_proposal(proposal_text)
    proposal_data["confidence_score"] = data.get("confidence_score", proposal_data["confidence_score"])
    proposal_data["issue_number"] = data.get("issue_number", "unknown")
    log(f"Parsed proposal with {len(proposal_data['file_changes'])} file changes")
    log(f"Confidence score: {proposal_data['confidence_score']:.2f}")
    if args.dry_run:
        log("DRY RUN MODE - no changes will be applied")
        apply = False
    else:
        apply = args.apply
    result = generate_patch(proposal_data, args.repo, apply)
    print("\n" + "="*60)
    print("PATCH GENERATION RESULTS")
    print("="*60)
    print(f"Patches generated: {len(result['patches'])}")
    print(f"Files applied: {len(result['applied'])}")
    print(f"Files failed: {len(result['failed'])}")
    print(f"Can create PR: {result['can_create_pr']}")
    print(f"Confidence: {result['confidence_score']:.2f}")
    if result['diff']:
        print("\n--- DIFF ---")
        print(result['diff'][:2000])
        if len(result['diff']) > 2000:
            print(f"... ({len(result['diff']) - 2000} more characters)")
    set_output("can_create_pr", "true" if result["can_create_pr"] else "false")
    set_output("confidence_score", str(result["confidence_score"]))
    set_output("patches_count", str(len(result["patches"])))
    set_output("diff", result["diff"])
    if args.output_json:
        with open(args.output_json, 'w') as f:
            json.dump(result, f, indent=2)
        log(f"Saved result to {args.output_json}")
    if args.output_diff and result["diff"]:
        with open(args.output_diff, 'w') as f:
            f.write(result["diff"])
        log(f"Saved diff to {args.output_diff}")
    if result["failed"]:
        log(f"Some patches failed to apply: {result['failed']}", "WARN")
        sys.exit(2)
    sys.exit(0)

if __name__ == "__main__":
    main()
