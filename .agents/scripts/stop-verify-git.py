#!/usr/bin/env python3
import json
import os
import subprocess
import sys


def main() -> None:
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except Exception:
        payload = {}

    termination_reason = payload.get("terminationReason", "")
    execution_num = payload.get("executionNum", 1)

    if termination_reason != "NO_TOOL_CALL" or execution_num > 1:
        print(json.dumps({"decision": "stop"}))
        return

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    try:
        porcelain = subprocess.check_output(
            ["git", "-C", repo_root, "status", "--porcelain"],
            stdin=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=2,
        ).strip()
    except Exception:
        porcelain = ""

    if porcelain:
        print(
            json.dumps(
                {
                    "decision": "continue",
                    "reason": (
                        "[SYNAPSE-LEXICON-GUARDRAIL]: Uncommitted changes detected in the working tree:\n"
                        f"{porcelain}\n"
                        "Please ensure memory/BLACKBOX.md, memory/PROJECT_STATE.md, and memory/MILESTONES.md "
                        "are updated in English, run `python playbooks/scripts/verify-lexicon-completeness.py`, "
                        "and commit/push to `origin main` before concluding your response."
                    ),
                }
            )
        )
    else:
        print(json.dumps({"decision": "stop"}))


if __name__ == "__main__":
    main()
