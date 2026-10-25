---
id: native-systemd
name: Native-Systemd
description: Prohibits containerization; enforces native Linux installation, dedicated service users, hardened systemd unit files (ProtectSystem=strict), and host-level Nginx/Caddy.
category: Infrastructure
---

# Rule Cartridge: Native-Systemd

When this cartridge is active, you MUST strictly adhere to the following rules:

1. **No Containerization:** Do NOT use Docker, Podman, or `docker-compose.yml`. Install all runtimes and services natively on the remote node OS.
2. **Dedicated Unprivileged Service Users:** Create a dedicated Linux system user (`useradd --system --no-create-home --shell /usr/sbin/nologin <service-user>`) for each daemon.
3. **Hardened Systemd Units:** Every long-running service MUST be managed via a `/etc/systemd/system/<service>.service` unit file containing explicit systemd security hardening directives:
   - `ProtectSystem=strict`
   - `ProtectHome=true`
   - `NoNewPrivileges=true`
   - `PrivateTmp=true`
   - `Restart=on-failure`
4. **Host-Level Reverse Proxy:** Configure Nginx or Caddy directly on the host OS to proxy incoming traffic to local loopback ports (`127.0.0.1:<port>`).
