# GitHub Copilot Instructions — SolidStateNetwork/Synapse

This repository (`SolidStateNetwork/Synapse`) is a self-contained project governed by its local Architecture Lexicon (`AGENTS.md`, `architecture/`, `memory/`).

## Mandatory Rules (see `AGENTS.md`):
1. **Single-Repository Isolation:** Operate exclusively inside this repository (`CWD`). Never read or modify sibling directories (`../`).
2. **100% English Repository Standard:** Write all repository documentation, code, comments, and commit messages in 100% English (chat with the user in German).
3. **Universal `init` Command:** When the user says `init` or `rufe init auf`, run `python playbooks/scripts/init-repo.py`.
4. **Read First:** Read `AGENTS.md`, `memory/PROJECT_STATE.md`, `memory/MILESTONES.md`, and `memory/BLACKBOX.md`.
5. **Verify & Write Back:** Run `python playbooks/scripts/verify-lexicon-completeness.py`, update `memory/` (`[BB-XXX]`), commit, and push to `origin main`.
