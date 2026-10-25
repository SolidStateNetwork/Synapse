---
id: zero-trust-networking
name: Zero-Trust-Networking
description: Forces multi-server database and internal ports to never bind to 0.0.0.0 without firewall rules; requires strict private VLAN binding and immediate ufw allow from peer node IPs.
category: Security
---

# Rule Cartridge: Zero-Trust-Networking

When this cartridge is active, you MUST strictly adhere to the following rules:

1. **No Unprotected Wildcard Binds:** Never bind databases (PostgreSQL, MySQL, Redis, MongoDB) or internal RPC queues to `0.0.0.0` without explicit host firewall restrictions.
2. **Private VLAN / Loopback Binding:** Always bind internal services to `127.0.0.1` (single-node) or the node's `private_ipv4` address from `State.json` (multi-node setups).
3. **Explicit Peer-IP Firewall Whitelisting:** Before starting any cross-node database or backend service, configure the firewall to allow traffic exclusively from the peer node's IP:
   ```bash
   ufw allow from <App-Node-Private-IP>/32 to any port <DB-Port> proto tcp
   ```
4. **Core Tunnel Preservation:** Never execute `ufw enable` or `iptables -P INPUT DROP` without verifying that the outbound mTLS connection to the Synapse Core Hub remains open.
