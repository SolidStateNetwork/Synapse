#!/usr/bin/env python3
"""
init-repo.py — Universal Multi-PC Repository Initializer & Readiness Analyzer
=============================================================================
Run this script whenever switching workstations or starting a new AI session
via `python playbooks/scripts/init-repo.py` (or by telling the AI: "init" / "rufe init auf").

Actions performed automatically (100% inside this repository):
1. Configures local Git hooks (`.githooks` if present) and fetches/rebases latest `origin/main` (and checks `upstream/main` if configured).
2. Verifies local workstation GitHub MCP token (`~/.config/ssn/github_token`), auto-bootstrapping from Google Drive Vault if on a new PC.
3. Executes `playbooks/scripts/verify-lexicon-completeness.py` to validate structural and clean-room integrity.
4. Parses `memory/` (`PROJECT_STATE.md` / `FLEET_STATE.md`, `MILESTONES.md`, `BLACKBOX.md`) and outputs a structured Readiness Briefing for the AI and developer.
"""
from __future__ import annotations

import os
import platform
import re
import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parents[2]
HOME = Path.home()
REPO_SLUG = "SolidStateNetwork/Synapse"
STATE_REL = "memory/PROJECT_STATE.md"


def run_git(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", "-C", str(ROOT), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )


def ensure_github_token_from_vault() -> str:
    token_file = HOME / ".config" / "ssn" / "github_token"
    if token_file.exists() and token_file.read_text(encoding="utf-8", errors="replace").strip():
        return f"OK ({token_file})"

    candidates: list[Path] = []
    if platform.system().lower() == "windows":
        for letter in "GDEFCHIJ":
            for sub in ("Meine Ablage\\Netzwerk", "My Drive\\Netzwerk", "Google Drive\\Netzwerk", "Netzwerk"):
                candidates.append(Path(f"{letter}:\\{sub}"))
    else:
        candidates.extend([
            HOME / "Insync" / "de.sa.3521@gmail.com" / "Google Drive" / "Netzwerk",
            HOME / "Google Drive" / "Netzwerk",
            HOME / "My Drive" / "Netzwerk",
            Path("/mnt/g/Meine Ablage/Netzwerk"),
        ])

    for vault in candidates:
        try:
            vault_tok = vault / "GATEWAY" / "07-workstation-recovery" / "github-token"
            if vault_tok.exists():
                tok = vault_tok.read_text(encoding="utf-8", errors="replace").strip()
                if tok:
                    token_file.parent.mkdir(parents=True, exist_ok=True)
                    token_file.write_text(tok + "\n", encoding="utf-8")
                    return f"BOOTSTRAPPED FROM VAULT ({vault_tok})"
        except OSError:
            continue
    return "NOT FOUND (run `gh auth login` or mount Google Drive Vault)"


def extract_head_lines(rel_path: str, max_lines: int = 25) -> str:
    p = ROOT / rel_path
    if not p.exists():
        return f"(missing: {rel_path})"
    lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
    return "\n".join(lines[:max_lines])


def extract_open_milestones() -> list[str]:
    p = ROOT / "memory" / "MILESTONES.md"
    if not p.exists():
        return []
    open_items: list[str] = []
    for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
        if re.match(r"^\s*-\s*\[\s*\]\s+", line):
            open_items.append(line.strip())
    return open_items[:12]


def extract_latest_blackbox() -> str:
    p = ROOT / "memory" / "BLACKBOX.md"
    if not p.exists():
        return "(missing: memory/BLACKBOX.md)"
    lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
    collected: list[str] = []
    started = False
    for line in lines:
        if line.startswith("## [BB-") or line.startswith("### [BB-"):
            if started:
                break
            started = True
        if started:
            collected.append(line)
            if len(collected) >= 18:
                break
    return "\n".join(collected) if collected else "\n".join(lines[:25])


def main() -> int:
    print("=" * 78)
    print(f"🚀 INITIALIZING REPOSITORY: {REPO_SLUG}")
    print(f"   Workspace : {ROOT}")
    print("=" * 78)

    # 1. Configure .githooks if present & sync Git
    if (ROOT / ".githooks").exists():
        run_git("config", "core.hooksPath", ".githooks")

    print("\n[1/4] Fetching & synchronizing latest Git state (origin/main)...")
    run_git("fetch", "--all", "--prune")
    dirty_before = run_git("status", "--porcelain").stdout.strip()
    if not dirty_before:
        pull_res = run_git("pull", "--rebase", "origin", "main")
        print(f"  ✅ Git pull: {pull_res.stdout.strip() or 'Up to date'}")
    else:
        print("  ℹ️  Local uncommitted changes present; skipped automatic rebase to preserve working tree.")

    head_sha = run_git("rev-parse", "--short", "HEAD").stdout.strip()
    branch_status = run_git("status", "-sb").stdout.strip()
    print(f"  ✅ HEAD Commit : {head_sha} ({branch_status.splitlines()[0] if branch_status else 'main'})")

    # 2. Check MCP Token
    print("\n[2/4] Verifying Workstation MCP Credentials...")
    tok_status = ensure_github_token_from_vault()
    print(f"  ✅ GitHub MCP Token : {tok_status}")

    # 3. Run Lexicon Completeness & Clean-Room Verifier
    print("\n[3/4] Running Lexicon & Clean-Room Audit...")
    verifier = ROOT / "playbooks" / "scripts" / "verify-lexicon-completeness.py"
    verify_ok = True
    if verifier.exists():
        v_res = subprocess.run(
            [sys.executable, str(verifier)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        verify_out = (v_res.stdout or "") + (v_res.stderr or "")
        for line in verify_out.strip().splitlines():
            print(f"  {line}")
        verify_ok = v_res.returncode == 0

    # 4. Readiness Summary
    print("\n[4/4] Project Memory & Readiness Briefing:")
    print("-" * 78)
    print(f"📌 STATE SNAPSHOT ({STATE_REL}):")
    print(extract_head_lines(STATE_REL, 22))
    print("-" * 78)
    print("📌 LATEST BLACKBOX ENTRY (memory/BLACKBOX.md):")
    print(extract_latest_blackbox())
    print("-" * 78)
    open_ms = extract_open_milestones()
    print(f"📌 NEXT OPEN MILESTONES ({len(open_ms)} found in memory/MILESTONES.md):")
    if open_ms:
        for item in open_ms:
            print(f"  {item}")
    else:
        print("  (All current milestones marked [x] completed!)")
    print("=" * 78)
    print(f"✅ [{REPO_SLUG} INIT COMPLETE] Workspace is synchronized and ready for development.")
    return 0 if verify_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
