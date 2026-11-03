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
        return "(File unreadable)"


def main() -> None:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    state_path = os.path.join(repo_root, "memory", "PROJECT_STATE.md")
    blackbox_path = os.path.join(repo_root, "memory", "BLACKBOX.md")

    state_excerpt = read_snippet(state_path, 35)
    blackbox_excerpt = read_snippet(blackbox_path, 35)

    try:
        git_status = subprocess.check_output(
            ["git", "-C", repo_root, "status", "-sb"],
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=2,
        ).strip()
    except Exception:
        git_status = "unknown"

    msg = (
        "🚨 [MANDATORY SYNAPSE ARCHITECTURE & MEMORY DIRECTIVE - AUTO-INJECTED ON SESSION START]\n"
        "You are operating in the standalone public repository SolidStateNetwork/Synapse.\n"
        "MANDATORY RULES FOR EVERY ACTION:\n"
        "1. Strict Single-Repo Boundary: Operate 100% inside CWD; never access ../ sibling directories.\n"
        "2. Read First: Inspect AGENTS.md, memory/PROJECT_STATE.md, memory/BLACKBOX.md, memory/MILESTONES.md & architecture/00..04 before modifying code.\n"
        "3. Public Clean-Room & 100% English Standard: Keep 100% of repository files in English (chat with the user in German). Never commit API tokens, private keys, Secrets.enc, .env, real server IPs, or local workstation paths (/home/<user>/...).\n"
        "4. Quality Gates & Write-Back: Keep Go files < 500 lines (>= 90% coverage), TS/TSX files < 600 lines (0 any types), update memory/{PROJECT_STATE,MILESTONES,BLACKBOX}.md ([BB-XXX]), and run git commit & git push origin main.\n\n"
        f"--- CURRENT GIT STATUS ---\n{git_status}\n\n"
        f"--- EXCERPT: memory/PROJECT_STATE.md ---\n{state_excerpt}\n\n"
        f"--- LATEST ENTRY: memory/BLACKBOX.md ---\n{blackbox_excerpt}"
    )

    output = {
        "injectSteps": [
            {
                "systemMessage": {
                    "systemMessage": msg
                }
            }
        ]
    }
    print(json.dumps(output))


if __name__ == "__main__":
    main()
