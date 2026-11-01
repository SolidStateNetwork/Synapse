#!/usr/bin/env python3
import json
import os
import subprocess
import sys

def main():
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
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=2
        ).strip()
    except Exception:
        porcelain = ""

    if porcelain:
        print(json.dumps({
            "decision": "continue",
            "reason": (
                "🚨 [SYNAPSE-LEXIKON-GUARDRAIL]: Es liegen uncommittete Änderungen im Synapse-Repository vor:\n"
                f"{porcelain}\n"
                "Bitte stelle sicher, dass memory/BLACKBOX.md, memory/PROJECT_STATE.md und memory/MILESTONES.md "
                "vollständig aktualisiert sind, und führe anschließend `git add`, `git commit` "
                "und `git push origin main` aus, bevor du deine Antwort abschließt."
            )
        }))
    else:
        print(json.dumps({"decision": "stop"}))

if __name__ == "__main__":
    main()
