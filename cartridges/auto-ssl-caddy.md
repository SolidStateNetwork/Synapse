---
id: auto-ssl-caddy
name: Automated HTTPS Ingress with Caddy
description: Configures Caddy as an automatic TLS reverse proxy with Let's Encrypt/ZeroSSL, security headers, and zero-downtime reloads.
category: ingress
---

# CARTRIDGE: AUTO-SSL CADDY INGRESS

## Core Mandates
1. **Automated TLS Termination:** Use Caddy (`Caddyfile`) as the unified edge reverse proxy for all public-facing HTTP/HTTPS services.
2. **Upstream Isolation:** Caddy proxies traffic exclusively to local loopback upstreams (`reverse_proxy 127.0.0.1:<port>`).
3. **Mandatory Security Headers:** Every site block in `Caddyfile` MUST include hardened response headers:
   ```caddyfile
   header {
       Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
       X-Content-Type-Options "nosniff"
       X-Frame-Options "SAMEORIGIN"
       Referrer-Policy "strict-origin-when-cross-origin"
       -Server
   }
   ```
4. **Zero-Downtime Validation:** Always run `caddy validate --config Caddyfile` before executing `caddy reload --config Caddyfile`.
5. **Brain Vault Registration:** Whenever an upstream port or domain is configured in Caddy, immediately invoke `core_register_service` and document the ingress topology in `Architecture.md`.
