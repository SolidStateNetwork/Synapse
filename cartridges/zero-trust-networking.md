---
id: zero-trust-networking
name: Zero-Trust Network & Firewall Posture
description: Enforces loopback-only service bindings, strict egress/ingress firewall policies, and mTLS/WireGuard internal transport.
category: security
---

# CARTRIDGE: ZERO-TRUST NETWORKING

## Core Mandates
1. **Loopback-First Binding:** All application servers, databases, and caches MUST bind strictly to `127.0.0.1` (e.g., `HOST=127.0.0.1`, `-p 127.0.0.1:3000:3000`). Direct public listening on `0.0.0.0` is prohibited except for hardened ingress proxies on ports `80`/`443`.
2. **Synapse Live-Preview Tunneling:** Rely on the Axon mTLS Yamux Port-Forwarding stream (`/preview/<project_id>/<node_id>/<port>`) for staging and internal verification instead of opening public firewall ports.
3. **Firewall Safety & Axon Preservation:**
   - Before modifying `ufw`, `nftables`, or `iptables`, verify active SSH and Axon outbound connections.
   - NEVER block outbound traffic to the Synapse `core-gateway` host/port or drop established TCP sessions (`ct state established,related accept`).
4. **Service Authentication:** Internal microservices communicating across nodes must authenticate via mutual TLS or HMAC bearer tokens stored in the Project Brain Vault (`Secrets.enc`).
