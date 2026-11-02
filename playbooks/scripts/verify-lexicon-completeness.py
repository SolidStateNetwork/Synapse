#!/usr/bin/env python3
"""
verify-lexicon-completeness.py — Clean-Room & Lexicon Verifier for SolidStateNetwork/Synapse
Ensures:
1. All mandatory governance, memory, architecture, template, design, and bridge files exist.
2. Zero leaked infrastructure IPs, internal mesh domains, or local workstation paths in tracked files.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

REQUIRED_FILES = [
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "GEMINI.md",
    ".cursorrules",
    ".windsurfrules",
    ".agents/hooks.json",
    ".agents/scripts/session-start-lexicon.py",
    ".agents/scripts/stop-verify-git.py",
    ".cursor/rules/00-lexicon-governance.mdc",
    ".github/copilot-instructions.md",
    ".githooks/pre-commit",
    "memory/PROJECT_STATE.md",
    "memory/MILESTONES.md",
    "memory/BLACKBOX.md",
    "templates/design-tokens.json",
    "templates/theme-bridge.css",
    "templates/README.md",
    "design/README.md",
    "bridge/contract.json",
    "bridge/ssn-bridge.py",
]

FORBIDDEN_PATTERNS = [
    (re.compile(r"\b10\.[2]0\.20\.\d+\b"), "Internal WireGuard IP"),
    (re.compile(r"\b10\.1[0]\.\d+\.\d+\b"), "Internal LXC Subnet IP"),
    (re.compile(r"\b217\.1[56][04]\.\d+\.\d+\b"), "Public Server IP (217.x)"),
    (re.compile(r"\b212\.227\.\d+\.\d+\b"), "Public Server IP (212.x)"),
    (re.compile(r"\b82\.165\.\d+\.\d+\b"), "Public Server IP (82.x)"),
    (re.compile(r"/home/[a-zA-Z0-9_-]+/"), "Local Workstation Path (/home/<user>/)"),
    (re.compile(r"-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----"), "Private Key Material"),
]


def main() -> int:
    errors: list[str] = []

    for rel in REQUIRED_FILES:
        if not (ROOT / rel).exists():
            errors.append(f"Missing required file: {rel}")

    if (ROOT / ".git").exists():
        res = subprocess.run(
            ["git", "-C", str(ROOT), "ls-files"],
            capture_output=True,
            text=True,
            check=False,
        )
        tracked = [line.strip() for line in res.stdout.splitlines() if line.strip()]
        for rel in tracked:
            if rel in {
                "playbooks/scripts/verify-lexicon-completeness.py",
                ".githooks/pre-commit",
            }:
                continue
            fpath = ROOT / rel
            if not fpath.is_file():
                continue
            try:
                content = fpath.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            for pat, label in FORBIDDEN_PATTERNS:
                if pat.search(content):
                    errors.append(f"Clean-room violation ({label}) in {rel}")

    if errors:
        print("❌ [SYNAPSE VERIFICATION FAILED]")
        for err in errors:
            print(f"  - {err}")
        return 1

    print(
        f"✅ [SYNAPSE LEXICON & CLEAN-ROOM OK] All {len(REQUIRED_FILES)} mandatory artifacts verified. "
        "0 infrastructure/workstation leaks."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
