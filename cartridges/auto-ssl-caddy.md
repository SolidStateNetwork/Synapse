---
id: auto-ssl-caddy
name: Auto-SSL-Caddy
description: Requires every publicly exposed web service to be automatically placed behind a Caddy reverse proxy with automated Let's Encrypt TLS provisioning.
category: Networking
---

# Rule Cartridge: Auto-SSL-Caddy

When this cartridge is active, you MUST strictly adhere to the following rules:

1. **Loopback Application Binding:** Bind all web application servers (Next.js, Node.js, Go, Python) strictly to `127.0.0.1:<port>` on the target Muscle Node.
2. **Automated Caddy Reverse Proxy:** Every publicly exposed HTTP service MUST be routed through a Caddy reverse proxy (`Caddyfile`) with automatic Let's Encrypt HTTPS certificates and HTTP-to-HTTPS redirection:
   ```caddyfile
   app.example.com {
       encode zstd gzip
       reverse_proxy 127.0.0.1:3000
   }
   ```
3. **Live-Preview Registration:** Always register the upstream `127.0.0.1:<port>` via `core_register_service` with `enable_preview_tunnel: true` so the service can be inspected via the Core WebUI tunnel even before DNS propagation completes.
