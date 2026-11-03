# 🤖 GEMINI.md — Mandatory AI Engineering Directive (SolidStateNetwork/Synapse)

1. **Single-Repo & Language Standard:** Operate strictly inside this repository (`CWD` only; never read or modify `../` sibling directories). Keep **100% of repository files in English** while communicating with the user in the chat in **German**.
2. **Mandatory 5-Step Protocol:** Read and follow [`AGENTS.md`](./AGENTS.md), [`memory/PROJECT_STATE.md`](./memory/PROJECT_STATE.md), [`memory/BLACKBOX.md`](./memory/BLACKBOX.md), [`memory/MILESTONES.md`](./memory/MILESTONES.md), and [`architecture/`](./architecture/) before and after every change.
3. **Quality & Clean-Room Gates:** Keep all Go files `< 500` lines (`>= 90%` coverage across 11 packages), TS/TSX files `< 600` lines (`0` `any` types), zero secrets/private IPs, and verify with `python3 playbooks/scripts/verify-lexicon-completeness.py`.
