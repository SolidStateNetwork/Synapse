#!/usr/bin/env python3
"""
ssn-bridge.py — Decoupled Clean-Room Cross-Repository Bridge for SolidStateNetwork
Connects sibling repositories (Gateway/Infrastructure, Synapse, Template_Signal,
Werkblick, Strata, Anvil/Odoo) without leaking internal infrastructure secrets,
IPs, or coupling runtime dependencies.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_PARENT = ROOT.parent

KNOWN_REPOS = [
    "Gateway",
    "Synapse",
    "Template_Signal",
    "Werkblick",
    "handwerk-kompass",
    "Strata",
    "Odoo",
]


def sha256_file(path: Path) -> str:
    if not path.exists():
        return "missing"
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def discover_repos() -> list[dict]:
    records = []
    for name in KNOWN_REPOS:
        repo_dir = WORKSPACE_PARENT / name
        contract_path = repo_dir / "bridge" / "contract.json"
        if not repo_dir.exists() or not contract_path.exists():
            continue
        contract = json.loads(contract_path.read_text(encoding="utf-8"))
        tokens_path = repo_dir / "templates" / "design-tokens.json"
        records.append({
            "folder": name,
            "repo_id": contract.get("repo_id", name),
            "github_repo": contract.get("github_repo", ""),
            "role": contract.get("role", ""),
            "default_template": contract.get("default_template", ""),
            "clean_room_isolation": bool(contract.get("clean_room_isolation", False)),
            "tokens_hash": sha256_file(tokens_path),
            "contract_version": contract.get("contract_version", "2.0.0"),
        })
    return records


def cmd_status(as_json: bool) -> int:
    local_contract_path = ROOT / "bridge" / "contract.json"
    local_contract = json.loads(local_contract_path.read_text(encoding="utf-8"))
    peers = discover_repos()
    payload = {
        "local_repo": local_contract.get("repo_id"),
        "local_role": local_contract.get("role"),
        "clean_room_isolation": local_contract.get("clean_room_isolation", True),
        "discovered_peers_count": len(peers),
        "peers": peers,
    }
    if as_json:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 0

    print(f"🔗 [SSN CLEAN-ROOM BRIDGE] Active Repo: {payload['local_repo']} ({payload['local_role']})")
    print(f"   Discovered Federation Peers: {len(peers)}")
    for p in peers:
        print(
            f"   - {p['folder']:<18} | {p['github_repo']:<38} | "
            f"template={p['default_template']:<18} | tokens_sha={p['tokens_hash']}"
        )
    return 0


def cmd_sync_erp_blueprint() -> int:
    source = WORKSPACE_PARENT / "Odoo" / "blueprints" / "werkblick-erp-blueprint.json"
    if not source.exists():
        print("❌ Source blueprint not found in Odoo/blueprints/werkblick-erp-blueprint.json")
        return 1

    targets = []
    for folder in ("handwerk-kompass", "Werkblick"):
        repo_dir = WORKSPACE_PARENT / folder
        if repo_dir.exists() and (repo_dir / "bridge").exists():
            t1 = repo_dir / "bridge" / "werkblick-erp-blueprint.json"
            shutil.copyfile(source, t1)
            targets.append(str(t1.relative_to(WORKSPACE_PARENT)))
            src_data_dir = repo_dir / "src" / "data"
            if (repo_dir / "src").exists():
                src_data_dir.mkdir(parents=True, exist_ok=True)
                t2 = src_data_dir / "odooErpBlueprint.json"
                shutil.copyfile(source, t2)
                targets.append(str(t2.relative_to(WORKSPACE_PARENT)))

    print(f"✅ [SSN BRIDGE ERP SYNC] Exported Clean-Room ERP Blueprint to: {', '.join(targets)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="SolidStateNetwork Clean-Room Repository Bridge")
    sub = parser.add_subparsers(dest="cmd")
    st = sub.add_parser("status", help="Show cross-repository bridge status")
    st.add_argument("--json", action="store_true", help="Output JSON")
    sub.add_parser("sync-erp-blueprint", help="Sync Clean-Room ERP blueprint from Anvil (Odoo) to Werkblick")
    args = parser.parse_args()

    if args.cmd in (None, "status"):
        return cmd_status(getattr(args, "json", False))
    if args.cmd == "sync-erp-blueprint":
        return cmd_sync_erp_blueprint()
    return 0


if __name__ == "__main__":
    sys.exit(main())
