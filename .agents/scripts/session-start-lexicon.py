#!/usr/bin/env python3
import json
import os
import subprocess


def read_snippet(filepath: str, max_lines: int = 35) -> str:
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            lines = [next(f) for _ in range(max_lines)]
            return "".join(lines).strip()
    except StopIteration:
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return "(file unreadable)"


def main() -> None:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    state_path = os.path.join(repo_root, "memory", "PROJECT_STATE.md")
    blackbox_path = os.path.join(repo_root, "memory", "BLACKBOX.md")

    state_excerpt = read_snippet(state_path, 35)
    blackbox_excerpt = read_snippet(blackbox_path, 35)

    try:
        git_status = subprocess.check_output(
            ["git", "-C", repo_root, "status", "-sb"],
            stdin=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=2,
        ).strip()
    except Exception:
        git_status = "unknown"

    msg = (
        "[MANDATORY ARCHITECTURE & SINGLE-REPO DIRECTIVE - AUTO-INJECTED ON SESSION START]\n"
        "You are operating in the standalone repository SolidStateNetwork/Synapse.\n"
        "MANDATORY RULES FOR EVERY ACTION:\n"
        "0. UNIVERSAL INIT COMMAND: If the user says 'init' or 'rufe init auf', IMMEDIATELY run `python playbooks/scripts/init-repo.py`, check the latest GitHub Actions CI status via the `github` MCP server, and present a concise German readiness briefing.\n"
        "1. STRICT SINGLE-REPO SCOPE: Operate 100% inside this repository (CWD). Never read, modify, or run commands in ../ sibling directories.\n"
        "2. 100% ENGLISH REPO / GERMAN CHAT: Write all repo files, docs, code, and commits in 100% English; communicate with the user in German.\n"
        "3. READ FIRST: Review AGENTS.md, memory/PROJECT_STATE.md, memory/BLACKBOX.md, memory/MILESTONES.md & architecture/*.md.\n"
        "4. VERIFY & WRITE-BACK: Run `python playbooks/scripts/verify-lexicon-completeness.py`, update memory/{PROJECT_STATE,MILESTONES,BLACKBOX}.md ([BB-XXX]), and push to origin main.\n\n"
        f"--- CURRENT GIT STATUS ---\n{git_status}\n\n"
        f"--- EXCERPT: memory/PROJECT_STATE.md ---\n{state_excerpt}\n\n"
        f"--- LATEST ENTRY: memory/BLACKBOX.md ---\n{blackbox_excerpt}"
    )

    output = {"injectSteps": [{"systemMessage": {"systemMessage": msg}}]}
    print(json.dumps(output))


if __name__ == "__main__":
    main()
