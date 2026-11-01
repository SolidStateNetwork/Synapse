# 🔐 02 – mTLS 1.3 Tunnel, PKI & Axon Muscle Agent

Dieses Dokument spezifiziert die Sicherheits- und Kommunikationsarchitektur zwischen dem **Synapse Core Gateway** (`apps/core-gateway`) und den **Axon Muscle Nodes** (`agents/axon`).

---

## 1. Zero-Trust Enrollment & ECDSA P-256 PKI (`internal/pki`)

Synapse verwendet keine statischen API-Passwörter für die Server-Anbindung, sondern eine vollwertige **Mutual TLS 1.3 (mTLS) Public Key Infrastructure**:

1. **Core Root CA Initialisierung:**
   - Beim ersten Start erzeugt `core-gateway` ein selbstsigniertes **ECDSA P-256 Root-CA-Zertifikat** (`ca.crt` & `ca.key`, `0600`) im Datenverzeichnis.
2. **One-Time CSR Join-Token (`syn_join_...`):**
   - Ein Operator oder MCP-Client fordert über `POST /api/v1/tokens` (bzw. `core_manage_cluster_nodes`) ein zeitlich begrenztes Einmal-Token (Standard: 15–30 Minuten TTL) an, das an eine spezifische Autonomie-Stufe (`TIER_1`–`TIER_3`) gebunden ist.
3. **Lokale Schlüsselgenerierung & CSR-Austausch:**
   - Der Muscle-Server generiert sein privates Schlüsselpaar (`client.key`) **ausschließlich lokal** auf dem Zielsystem.
   - Über `POST /api/v1/enroll` sendet `axon` lediglich einen **Certificate Signing Request (CSR)** zusammen mit dem Einmal-Token an das Core Gateway.
   - Das Gateway entwertet das Token sofort nach einmaliger Nutzung, signiert das Client-Zertifikat (`client.crt`) mit der Root CA und kodiert die erlaubte `Autonomy Tier` in den Zertifikats-Metadaten.

---

## 2. Multiplexed Yamux Tunnel über TLS 1.3 (`:8443`)

Sobald `axon` im Besitz von `ca.crt`, `client.crt` und `client.key` ist, baut der Agent eine dauerhafte ausgehende TCP-Verbindung zum Tunnel-Port (`:8443`) des Core Gateways auf:

- **Strikte TLS-1.3-Konfiguration:** `MinVersion: tls.VersionTLS13`, `ClientAuth: tls.RequireAndVerifyClientCert`.
- **Stream-Multiplexing (`hashicorp/yamux`):** Über diese einzige ausgehende TCP-Verbindung öffnet das Core Gateway bei Bedarf beliebig viele parallele, isolierte virtuelle Streams zum Muscle-Knoten:
  - **Heartbeat & Telemetrie-Stream:** Überträgt alle 5 Sekunden CPU-, RAM-, Disk-Auslastung, OS-Architektur, Netzwerk-IPs und den Live-Status registrierter Dienste (inkl. 60-Sample Ringbuffer im Gateway-Hub).
  - **PTY Execution Streams (`/api/v1/rpc/pty`):** Führt Shell-Befehle in persistenten (`default-<project>`) oder ephemeralen One-Shot-PTY-Sessions aus.
  - **Filesystem RPC Streams (`/api/v1/rpc/fs`):** Atomare Datei-Operationen (`read_file`, `write_file`, `list_dir`, `stat`, `delete`) inkl. automatischer Pre-Write-Snapshots.
  - **Live-Preview Reverse-Proxy Streams (`/preview/<project>/<node>/<port>`):** Tunnelt HTTP/WebSocket-Anfragen aus dem Browser-Cockpit direkt an `127.0.0.1:<port>` auf dem Muscle-Server, ohne dass der Port auf der öffentlichen Server-Firewall geöffnet werden muss.

---

## 3. Ephemeral PTY Garbage Collection (`pty_discovery.go`)

Damit automatisierte Hintergrund-Probes, Healthchecks und One-Shot-Deployments niemals verwaiste Shell-Prozesse (`bash`/`sh`) auf dem Muscle-Server hinterlassen, klassifiziert `IsEphemeralSessionID` in `agents/axon/internal/pty/pty_discovery.go` temporäre Sessions anhand ihres Präfixes:

- **Automatisch bereinigte One-Shot-Präfixe:**
  - `probe-`, `link-probe-`, `service-logs-` (Live-Healthchecks & Log-Inspector)
  - `cron-`, `heal-`, `chaos-`, `secops-` (Cron-Runbooks, Self-Healing & Intrusion-Radar)
  - `chk-`, `bkp-`, `bp-`, `gitops-`, `sqlite-` (Checkpoints, Backups, Blueprints, GitOps & SQLite-Studio)
  - `hot-reload-`, `fw-`, `svc-cleanup-`, `sys-update-`, `mesh-`, `custom-svc-` (Hot-Reload, Firewall-Sync, Teardown, OTA-Update & Service-Mesh)
- **Persistente Operator-Sessions:**
  - Sessions wie `default-<project_id>` oder interaktive WebUI-Terminals bleiben über Einzelbefehle hinweg bestehen, sodass Arbeitsverzeichnisse (`cd`) und Umgebungsvariablen erhalten bleiben.

---

## 4. Deterministic Self-Lockout Guard (`agents/axon/internal/guard`)

Selbst im Modus `TIER_1_UNLEASHED` prüft `axon` jeden einzelnen Befehl vor der Ausführung deterministisch gegen Selbst-Sabotage (`ERR_SELF_PROTECTION_VIOLATION`):

1. **Prozess- & Service-Selbstschutz:** Blockiert `kill`/`pkill` gegen die eigene `axon`-PID sowie `systemctl stop/disable/mask axon`.
2. **Firewall-Anti-Lockout:** Blockiert `ufw`/`iptables`/`nftables`-Befehle, die den ausgehenden mTLS-Tunnel zum Core Gateway oder den lokalen Loopback-Verkehr trennen würden.
3. **Destruktiver Root-Schutz:** Blockiert destruktive Dateisystem-Befehle auf Systemwurzel-Ebene (`rm -rf /`, `mkfs` auf gemounteten Systempartitionen).
