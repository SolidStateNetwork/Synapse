#!/usr/bin/env python3
import json
import os
import subprocess

def read_snippet(filepath, max_lines=35):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            lines = [next(f) for _ in range(max_lines)]
            return "".join(lines).strip()
    except StopIteration:
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return "(Datei nicht lesbar)"

def main():
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
            timeout=2
        ).strip()
    except Exception:
        git_status = "unbekannt"

    msg = (
        "🚨 [MANDATORY SYNAPSE ARCHITECTURE & MEMORY DIRECTIVE - AUTO-INJECTED ON SESSION START]\n"
        "Du arbeitest im öffentlichen Repository SolidStateNetwork/Synapse.\n"
        "PFLICHTREGELN FÜR JEDE AKTION:\n"
        "1. Lies vor jeder Code-/Architektur-Änderung: memory/PROJECT_STATE.md, memory/BLACKBOX.md, memory/MILESTONES.md & architecture/00..04.\n"
        "2. Public Clean-Room Policy: NIEMALS API-Tokens, Private Keys, Secrets.enc, .env, echte Server-IPs oder lokale Benutzerpfade (/home/<user>/...) ins öffentliche Git schreiben!\n"
        "3. Strikte Qualitäts-Gates: Jede Go-Datei < 500 Zeilen, jede TS/TSX-Datei < 600 Zeilen, 0 any-Typen, >= 85% Go Coverage, >= 90% TS Coverage.\n"
        "4. Write-Back-Pflicht: Aktualisiere nach JEDEM Schritt PROJECT_STATE.md, MILESTONES.md & BLACKBOX.md ([BB-XXX]) und führe git commit & git push origin main aus!\n\n"
        f"--- AKTUELLER GIT STATUS ---\n{git_status}\n\n"
        f"--- AUSZUG: memory/PROJECT_STATE.md ---\n{state_excerpt}\n\n"
        f"--- LETZTER EINTRAG: memory/BLACKBOX.md ---\n{blackbox_excerpt}"
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
