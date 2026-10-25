---
id: native-systemd
name: Native Systemd Daemon Management
description: Manages services as hardened native Linux systemd units with cgroup resource limits, sandboxing, and journald logging.
category: deployment
---

# CARTRIDGE: NATIVE SYSTEMD DAEMON ARCHITECTURE

## Core Mandates
1. **Dedicated Systemd Units:** Every long-running background service MUST be managed via a dedicated `.service` unit file (either `/etc/systemd/system/<app>.service` in `TIER_1_UNLEASHED` or `--user` systemd units in `TIER_2_WORKSPACE_JAIL`).
2. **Never Leave Orphan Processes:** Do not rely on `nohup`, `screen`, or backgrounded `&` shell jobs for production services. Always register, enable, and verify units via `systemctl`.
3. **Unit Hardening Directives:** Every generated `.service` unit MUST include:
   - `Restart=on-failure` and `RestartSec=5s`
   - `NoNewPrivileges=true`
   - `ProtectSystem=strict` and `PrivateTmp=true` (with explicit `ReadWritePaths=` for the workspace)
   - `EnvironmentFile=` pointing to a `0600` secret file rather than inline secrets in unit definitions.
4. **Observability:** Verify service startup using `systemctl is-active <service>` and inspect logs with `journalctl -u <service> -n 50 --no-pager`.
5. **Self-Protection:** Never modify, stop, mask, or restart `axon.service`.
