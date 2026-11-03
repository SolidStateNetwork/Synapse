#!/usr/bin/env python3
"""
verify-lexicon-completeness.py — Single-Repo Clean-Room & Lexicon Verifier for SolidStateNetwork/Synapse
Ensures:
1. All mandatory streamlined governance, memory, architecture, and playbook files exist.
2. Deleted cross-repo bloat and duplicate instruction files do not reappear.
3. Zero leaked infrastructure IPs, internal mesh domains, local workstation paths, or cross-repo sibling references in tracked files.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[2]

REQUIRED_FILES = [
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "GEMINI.md",
    ".github/copilot-instructions.md",
    ".agents/hooks.json",
    ".agents/scripts/session-start-lexicon.py",
    ".agents/scripts/stop-verify-git.py",
    ".githooks/pre-commit",
    "memory/PROJECT_STATE.md",
    "memory/MILESTONES.md",
    "memory/BLACKBOX.md",
    "architecture/00-product-vision.md",
    "architecture/01-tech-stack-and-monorepo.md",
    "architecture/02-mtls-tunnel-and-axon-agent.md",
    "architecture/03-ai-orchestrator-and-mcp-server.md",
    "architecture/04-resilience-security-and-ota.md",
    "playbooks/01-feature-and-milestone-sop.md",
    "playbooks/02-container-lab-and-release-sop.md",
    "playbooks/scripts/verify-lexicon-completeness.py",
]

FORBIDDEN_PATHS = [
    "README.de.md",
    "bridge",
    "design",
    "templates",
    ".cursorrules",
    ".windsurfrules",
    ".cursor",
]

FORBIDDEN_PATTERNS = [
    (re.compile(r"\b10\.[2]0\.20\.\d+\b"), "Internal WireGuard IP"),
    (re.compile(r"\b10\.1[0]\.\d+\.\d+\b"), "Internal LXC Subnet IP"),
    (re.compile(r"\b217\.1[56][04]\.\d+\.\d+\b"), "Public Server IP (217.x)"),
    (re.compile(r"\b212\.227\.\d+\.\d+\b"), "Public Server IP (212.x)"),
    (re.compile(r"\b82\.165\.\d+\.\d+\b"), "Public Server IP (82.x)"),
    (re.compile(r"/home/[a-zA-Z0-9_-]+/"), "Local Workstation Path (/home/<user>/)"),
    (re.compile(r"-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----"), "Private Key Material"),
    (re.compile(r"\b(?:Werkblick|Template_Signal|Strata|ssn-bridge|theme-bridge\.css)\b"), "Cross-Repo Sibling Reference"),
    (re.compile(r"\bREADME\.de\.md\b"), "Deleted German README Reference"),
]


def main() -> int:
    errors: list[str] = []

    for rel in REQUIRED_FILES:
        if not (ROOT / rel).exists():
            errors.append(f"Missing required file: {rel}")

    for rel in FORBIDDEN_PATHS:
        if (ROOT / rel).exists():
            errors.append(f"Forbidden bloat file/directory present: {rel}")

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
                ".github/workflows/ci.yml",
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
        f"✅ [SYNAPSE LEXICON & CLEAN-ROOM OK] All {len(REQUIRED_FILES)} mandatory artifacts verified, "
        f"{len(FORBIDDEN_PATHS)} bloat paths absent, 0 infrastructure/cross-repo leaks."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
