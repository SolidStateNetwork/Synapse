---
id: docker-first
name: Docker-First Container Architecture
description: Enforces containerized workloads using Docker Compose with isolated networks, healthchecks, and non-root execution.
category: deployment
---

# CARTRIDGE: DOCKER-FIRST ARCHITECTURE

## Core Mandates
1. **Zero Host Pollution:** Never install application runtimes (Node.js, Python, Ruby, PHP, Java, databases) directly onto the host operating system. All application dependencies and services MUST run inside Docker containers.
2. **Compose Standardization:** Every project deployment must be defined in a reproducible `docker-compose.yml` inside the project workspace directory.
3. **Explicit Healthchecks:** Every service in `docker-compose.yml` MUST declare a deterministic `healthcheck` block (`curl -f`, `pg_isready`, `nc -z`, etc.) and depend on upstream services via `condition: service_healthy`.
4. **Least-Privilege Containers:**
   - Use minimal base images (`alpine`, `distroless`, or `-slim` variants).
   - Multi-stage builds are mandatory for compiled languages (Go, Rust, TypeScript/Next.js).
   - Bind host ports exclusively to `127.0.0.1:<port>:<container_port>` unless explicitly exposed through a reverse proxy.
5. **Persistent Volumes:** Stateful data (PostgreSQL, Redis, SQLite, uploads) MUST use named Docker volumes or dedicated `./data/` bind mounts documented in `Architecture.md`.
