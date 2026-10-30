import { EN_DICTIONARY_PART_1 } from "./enDictPart1";
import { EN_DICTIONARY_PART_2 } from "./enDictPart2";

export const EN_DICTIONARY: Record<string, string> = {
  ...EN_DICTIONARY_PART_1,
  ...EN_DICTIONARY_PART_2,
};

export const DE_DICTIONARY: Record<string, string> = {
  "Control Center": "Control Center",
  "Planning-Only": "Nur-Planung",
  "Service Health Alert:": "Dienst-Gesundheitswarnung:",
  "Ask AI to Diagnose & Fix": "KI um Diagnose & Reparatur bitten",
  "Autonomy Tier": "Autonomie-Stufe",
  "Create Custom Rule Cartridge (`.md`)": "Eigene Regel-Cartridge erstellen (`.md`)",
  "Create Custom Rule Cartridge (.md)": "Eigene Regel-Cartridge erstellen (.md)",
  "Cartridge Name (e.g. HIPAA Compliance)": "Cartridge-Name (z.B. DSGVO / HIPAA)",
  "Category (e.g. Security)": "Kategorie (z.B. Sicherheit)",
  "Short description...": "Kurzbeschreibung...",
  "Save & Enable Cartridge": "Cartridge speichern & aktivieren",
  "Approve & Execute": "Freigeben & Ausführen",
  "Reject": "Ablehnen",
  "Unified Diff Patch": "Unified-Diff-Patch",
  "Save to Peer": "Auf Server speichern",
  "Apply Unified Diff": "Unified-Diff anwenden",
  "New file path...": "Neuer Dateipfad...",
  "Paste unified diff (@@ -1,3 +1,4 @@)...": "Unified-Diff einfügen (@@ -1,3 +1,4 @@)...",
  "Timestamp": "Zeitstempel",
  "Actor": "Akteur",
  "Tool / Event": "Tool / Ereignis",
  "Summary": "Zusammenfassung",
  "One-Time Peer Setup Keys": "Einmal-Setup-Schlüssel (Server-Anbindung)",
  "Generate Setup Key": "Setup-Schlüssel erzeugen",
  "Peer Name (optional, e.g. prod-01)": "Server-Name (optional, z.B. prod-01)",
  "1. Fresh Install — Run on target Linux host to install `axon` & connect via token:":
    "1. Neuinstallation — Auf dem Ziel-Linux-Server ausführen, um `axon` zu installieren & zu verbinden:",
  "2. Switch / Rebind Existing Muscle Agent via CLI (`axon switch`)":
    "2. Bestehenden Muscle-Agenten per CLI umschalten (`axon switch`)",
  "Already have `axon` installed? Run this in your shell to connect it to this Core with a new token (or use `axon profiles` to switch saved Cores):":
    "`axon` ist bereits installiert? Führe diesen Befehl aus, um ihn mit neuem Token an diesen Core zu binden (oder nutze `axon profiles`):",
  "✔ Copied!": "✔ Kopiert!",
  "Copy Command": "Befehl kopieren",
  "✔ Copied CLI!": "✔ CLI kopiert!",
  "Copy CLI Switch": "CLI-Switch kopieren",
  "AES-256-GCM Encrypted Secrets Vault (`Secrets.enc`)":
    "AES-256-GCM Verschlüsselter Secrets-Tresor (`Secrets.enc`)",
  "Secret plaintext value (write-only)...": "Geheimer Klartext-Wert (nur schreiben)...",
  "Encrypt & Save": "Verschlüsseln & Speichern",
  "Provider Preset": "KI-Anbieter Vorlage",
  "API Base URL": "API Basis-URL",
  "Fetch /models": "Modelle laden",
  "Model Name": "Modell-Name",
  "Save AI Provider": "KI-Anbieter speichern",
  "External AI Access & Model Context Protocol (MCP) Server (`/api/mcp`)":
    "Externer KI-Zugriff & Model Context Protocol (MCP) Server (`/api/mcp`)",
  "Allow external AI agents (Claude Desktop, Cursor, Windsurf, Antigravity, OpenCode, or custom REST/JSON-RPC bots) to control your Synapse Core & Muscle peers securely via an MCP API Token.":
    "Erlaube externen KI-Agenten (Claude Desktop, Cursor, Windsurf, Antigravity, OpenCode oder eigenen REST/JSON-RPC-Bots), deinen Synapse Core & Muscle sicher per MCP-Token zu steuern.",
  "Client name (e.g. Claude Desktop / Cursor)": "Client-Name (z.B. Claude Desktop / Cursor)",
  "Full Access (Read + Execute PTY/FS + Admin)": "Vollzugriff (Lesen + PTY/Dateisystem + Admin)",
  "Read-Only (Inspect Peers, Files & Brain Docs)": "Nur Lesen (Server, Dateien & Brain-Docs prüfen)",
  "+ Generate MCP API Key": "+ MCP-API-Schlüssel erzeugen",
  "✔ New MCP API Key Generated (copy now — stored as SHA-256 hash):":
    "✔ Neuer MCP-API-Schlüssel erzeugt (jetzt kopieren — wird als SHA-256-Hash gespeichert):",
  "✔ Copied Token!": "✔ Token kopiert!",
  "Copy Token": "Token kopieren",
  "Active External AI / MCP Tokens": "Aktive Externe KI- / MCP-Tokens",
  "No MCP API tokens created yet. Click “+ Generate MCP API Key” above to issue one.":
    "Noch keine MCP-API-Tokens erstellt. Klicke oben auf „+ MCP-API-Schlüssel erzeugen“.",
  "Revoke": "Widerrufen",
  "1. MCP Client Config (`mcp_config.json` — Claude / Cursor / Antigravity)":
    "1. MCP-Client-Konfiguration (`mcp_config.json` — Claude / Cursor / Antigravity)",
  "2. Direct REST / JSON-RPC Tool Call (`curl` / Custom AI Agent)":
    "2. Direkter REST / JSON-RPC Tool-Aufruf (`curl` / Eigener KI-Agent)",
  "Live MCP Protocol Tester (`JSON-RPC 2.0`)": "Live MCP-Protokoll-Tester (`JSON-RPC 2.0`)",
  "Core & Muscle Debug Mode + End-to-End Self-Test":
    "Core & Muscle Debug-Modus + End-to-End-Selbsttest",
  "Inspect live mTLS 1.3 + Yamux stream traces, verify AES-256-GCM Vault integrity, and run diagnostic checks on both Core and Muscle.":
    "Prüfe Live-mTLS-1.3- & Yamux-Streams, verifiziere die AES-256-GCM-Tresor-Integrität und führe Diagnose-Checks auf Core und Muscle aus.",
  "● Debug Mode: ENABLED": "● Debug-Modus: AKTIV",
  "○ Enable Debug Mode": "○ Debug-Modus aktivieren",
  "Running Self-Test...": "Selbsttest läuft...",
  "▶ Run 5-Step Self-Test": "▶ 5-Stufen-Selbsttest starten",
  "Refresh": "Aktualisieren",
  "End-to-End Diagnostic Checks": "End-to-End Diagnose-Prüfungen",
  "CLI Debug Commands for Core & Muscle (`axon debug` / `--debug`)":
    "CLI-Debug-Befehle für Core & Muscle (`axon debug` / `--debug`)",
  "Live Core Web & Gateway Diagnostic Snapshot (`/api/debug`)":
    "Live Core-Web- & Gateway-Diagnose-Snapshot (`/api/debug`)",
  "Click 'Refresh' or 'Run 5-Step Self-Test' to inspect live Core & Gateway state.":
    "Klicke auf 'Aktualisieren' oder '5-Stufen-Selbsttest starten', um den Live-Status zu prüfen.",
  "Drop Screenshots, Diagrams, or Logs Here":
    "Screenshots, Diagramme oder Log-Dateien hier ablegen",
  "Synapse Vision will inspect your images and translate them into server configs or bug fixes.":
    "Synapse Vision analysiert deine Bilder und setzt sie in Server-Konfigurationen oder Bugfixes um.",
  "Attach image, screenshot, diagram, or log file (or Drag & Drop / Ctrl+V)":
    "Bild, Screenshot, Diagramm oder Log-Datei anhängen (oder Drag & Drop / Strg+V)",
  "Mention a Peer, Service, or Brain Vault Doc (@)":
    "Server, Dienst oder Brain-Vault-Dokument erwähnen (@)",
  "Ask Synapse AI, type @ to mention, or drop/paste images...":
    "Frage Synapse AI, tippe @ für Erwähnungen oder ziehe Bilder hinein...",
  "Insert @Context Mention": "@Kontext-Erwähnung einfügen",
  "Thinking...": "Denkt nach...",
  "Expand": "Ausklappen",
  "Hide": "Einklappen",
  "No Muscle Peer connected. Click “+ Add Peer” to enroll a Linux node.":
    "Kein Muscle-Server verbunden. Klicke auf „+ Server“, um einen Linux-Knoten anzubinden.",
  "Add New Muscle Peer (Linux / Docker)": "Neuen Muscle-Server verbinden (Linux / Docker)",
  "One-command installation with automatic token login & mTLS 1.3 enrollment.":
    "Ein-Befehl-Installation mit automatischem Token-Login & mTLS-1.3-Anbindung.",
  "Core Gateway URL": "Core-Gateway-URL",
  "Peer ID (Optional)": "Server-ID (Optional)",
  "Run this single command on your Linux server:":
    "Führe diesen einzelnen Befehl auf deinem Linux-Server aus:",
  "Rotate Token": "Neues Token",
  "Or switch an existing Muscle via CLI (`axon switch`):":
    "Oder bestehenden Muscle per CLI umschalten (`axon switch`):",
  "Rebind an installed Muscle agent to this Core with a new token (old Core profile is saved under `axon profiles`):":
    "Verbinde einen installierten Muscle-Agenten mit neuem Token an diesen Core (altes Profil bleibt unter `axon profiles` erhalten):",
  "Waiting for incoming mTLS 1.3 + Yamux peer handshake...":
    "Warte auf eingehenden mTLS 1.3 + Yamux Server-Handshake...",
  "Done": "Fertig",
  "AI Provider & Custom API Base URL": "KI-Anbieter & Eigene API-Basis-URL",
  "Connect OpenRouter, vLLM, LiteLLM, Ollama, or OpenAI.":
    "Verbinde OpenRouter, vLLM, LiteLLM, Ollama oder OpenAI.",
  "Fetch Models": "Modelle abrufen",
  "Prompt & FS Caching": "Prompt- & Dateisystem-Caching",
  "Cache static system layers & file reads":
    "Statische System-Layer & Datei-Lesezugriffe zwischenspeichern",
  "Proactive Auto-Watchdog": "Proaktiver Auto-Watchdog",
  "Auto-heal crashed services in background":
    "Abgestürzte Dienste im Hintergrund automatisch reparieren",
  "Cancel": "Abbrechen",
  "Save Provider": "Anbieter speichern",
  "Create New Project Vault": "Neuen Projekt-Tresor anlegen",
  "Project name (e.g. prod-mesh)": "Projektname (z.B. prod-mesh)",
  "Create Project": "Projekt anlegen",
  "Jump to Control Center, Peers, Access Control, Proxy...":
    "Springe zu Übersicht, Server, Regeln, Dienste...",
  "Navigate": "Navigieren",
  "Unassign": "Trennen",
  "Assign": "Zuweisen",
  "Setup Keys (Peer Onboarding)": "Setup-Schlüssel (Server-Onboarding)",
  "AI Providers & Base URL": "KI-Anbieter & Basis-URL",
  "API Key (Encrypted in `Secrets.enc` as": "API-Schlüssel (Verschlüsselt in `Secrets.enc` als",
  "Pending Tier-3 Supervised Approvals (": "Ausstehende Tier-3-Freigaben (",
  "Vault (": "Tresor (",
  "Node.js Zero-Trust API Service": "Node.js Zero-Trust API-Service",
  "Provisions a production-ready HTTP JSON microservice bound to 127.0.0.1:4050 with automated health probes, rollback snapshot, and Live-Preview tunnel.":
    "Stellt einen produktionsreifen HTTP-JSON-Microservice auf 127.0.0.1:4050 mit automatischen Health-Probes, Rollback-Snapshot und Live-Vorschau-Tunnel bereit.",
  "PostgreSQL 16 + Redis Cache Stack": "PostgreSQL 16 + Redis Cache-Stack",
  "Generates a 32-char AES-256-GCM DB secret in Secrets.enc, provisions a Docker Compose Postgres + Redis stack on 127.0.0.1, and registers TCP health checks.":
    "Erzeugt ein 32-Zeichen AES-256-GCM DB-Secret in Secrets.enc, startet einen Docker-Compose Postgres- & Redis-Stack auf 127.0.0.1 und registriert TCP-Health-Checks.",
  "n8n Workflow Automation Hub": "n8n Workflow-Automatisierungs-Hub",
  "Deploys a self-hosted n8n workflow automation server on 127.0.0.1:5678 and exposes it through the Yamux Stream 3 Live-Preview proxy.":
    "Stellt einen selbstgehosteten n8n-Automatisierungsserver auf 127.0.0.1:5678 bereit und macht ihn über den Yamux-Live-Vorschau-Proxy erreichbar.",
  "Status & Telemetry Dashboard": "Status- & Telemetrie-Dashboard",
  "Deploys a real-time service status & metrics endpoint on 127.0.0.1:4080 with Proactive Auto-Watchdog self-healing enabled.":
    "Stellt einen Echtzeit-Status- & Metrik-Endpunkt auf 127.0.0.1:4080 mit aktivierter Auto-Watchdog-Selbstheilung bereit.",
  "Nightly Disk & Container Hygiene": "Nächtliche Disk- & Container-Bereinigung",
  "Check disk utilization, prune dangling container logs, and record a summary in Memory.md.":
    "Prüfe Speicherplatz-Auslastung, bereinige alte Container-Logs und dokumentiere das Ergebnis in Memory.md.",
  "Weekly Zero-Trust Port Audit": "Wöchentliches Zero-Trust Port-Audit",
  "Verify all listening ports bind to 127.0.0.1 and update Architecture.md.":
    "Verifiziere, dass alle lauschenden Ports an 127.0.0.1 gebunden sind, und aktualisiere Architecture.md.",
  "Requires every publicly exposed web service to be automatically placed behind a Caddy reverse proxy with automated Let's Encrypt TLS provisioning.":
    "Erfordert, dass jeder öffentlich erreichbare Webdienst hinter einem Caddy-Reverse-Proxy mit automatischem Let's-Encrypt-TLS betrieben wird.",
  "Enforces containerized workloads using Docker Compose with isolated networks, healthchecks, and non-root execution.":
    "Erzwingt containerisierte Workloads über Docker Compose mit isolierten Netzwerken, Health-Checks und Ausführung ohne Root-Rechte.",
  "Prohibits containerization; enforces native Linux installation, dedicated service users, hardened systemd unit files (ProtectSystem=strict), and host-level Nginx/Caddy.":
    "Untersagt Containerisierung; erzwingt native Linux-Installation, eigene Service-User, gehärtete Systemd-Units (ProtectSystem=strict) und Host-Reverse-Proxy.",
  "All HTTP endpoints must include X-Powered-By: Synapse-Mesh and version metadata.":
    "Alle HTTP-Endpunkte müssen den Header X-Powered-By: Synapse-Mesh sowie Versions-Metadaten enthalten.",
  "Forces multi-server database and internal ports to never bind to 0.0.0.0 without firewall rules; requires strict private VLAN binding and immediate ufw allow from peer node IPs.":
    "Verhindert das ungeschützte Binden von Datenbank- und internen Ports an 0.0.0.0; erzwingt Loopback-/VLAN-Binding und explizite UFW-Firewall-Freigaben.",
  "Call the root endpoint through the Yamux Reverse Proxy.":
    "Rufe den Root-Endpunkt über den Yamux-Reverse-Proxy auf.",
  "Probe service health and telemetry.":
    "Prüfe Dienst-Gesundheit und Live-Telemetrie.",
  "Send a custom JSON payload to the service via Reverse Proxy.":
    "Sende einen benutzerdefinierten JSON-Payload über den Reverse-Proxy an den Dienst.",
  "Load the main interactive WebUI in the Reverse Proxy.":
    "Lade die interaktive Haupt-WebUI im Reverse-Proxy.",
  "Inspect WebUI backend status JSON.":
    "Prüfe den JSON-Status des WebUI-Backends.",
  "Send interactive form/JSON input to the WebUI backend.":
    "Sende interaktive Formular-/JSON-Eingaben an das WebUI-Backend.",
  "List all database tables and schemas.":
    "Liste alle Datenbank-Tabellen und Schemata auf.",
  "Inspect recent records stored in the database.":
    "Prüfe die neuesten Datensätze in der Datenbank.",
  "Insert a new record directly into the database.":
    "Füge einen neuen Test-Datensatz direkt in die Datenbank ein.",
  "Probe HTTP/JSON database endpoint via Reverse Proxy.":
    "Prüfe den HTTP/JSON-Datenbank-Endpunkt über den Reverse-Proxy.",
  "Check microservice status via Reverse Proxy.":
    "Prüfe den Microservice-Status über den Reverse-Proxy.",
  "Fetch all stored analytics events from SQLite.":
    "Rufe alle gespeicherten Analytics-Events aus SQLite ab.",
  "Submit a new JSON analytics event from the UI box.":
    "Sende ein neues JSON-Analytics-Event aus der Oberfläche.",
  "Run an interactive SQL query against pulse.db on the Muscle node.":
    "Führe eine interaktive SQL-Abfrage gegen pulse.db auf dem Muscle-Knoten aus.",
  "Conversation context compacted and cleared. Ready for new instructions (Prompt Cache & Vision active).":
    "Konversations-Kontext bereinigt. Bereit für neue Anweisungen (Prompt-Cache & Vision aktiv).",
  "Conversation history cleared.": "Konversationsverlauf geleert.",
  "Live System Topology Graph": "Live System-Topologie-Graph",
  "Architecture flow parsed from": "Architektur-Datenfluss aus",
  "Active Topology Link(s)": "aktive Topologie-Verknüpfungen",
  "•••••••• (Saved in Secrets.enc)": "•••••••• (Gespeichert in Secrets.enc)",
  "e.g. prod-node-01": "z.B. prod-01",
  "Copy": "Kopieren",
  "Copied!": "Kopiert!",
  "Copy CLI": "CLI kopieren",
  "Copied CLI!": "CLI kopiert!",
  "Verified Multi-Core Production Baseline": "Verifizierte Multi-Core Produktions-Basis",
  "24/7 Watchdog & Alert Engine Armed": "24/7 Wächter & Alarm-Engine aktiv",
  "Test Push Notification": "Test-Push-Benachrichtigung",
  "Manual Server Snapshot": "Manueller Server-Snapshot",
  "Manual Snapshot (edge-node-01)": "Manueller Snapshot (edge-node-01)",
  "Uptime & Latency Beacon :4060": "Uptime- & Latenz-Beacon :4060",
  "Lightweight HTTP uptime & latency probe microservice with JSON telemetry":
    "Leichtgewichtiger HTTP-Uptime- & Latenz-Microservice mit JSON-Metrik",
  "Webhook Event Sink :4065": "Webhook-Event-Empfänger :4065",
  "Zero-dependency HTTP webhook receiver & event inspector":
    "Abhängigkeitsfreier HTTP-Webhook-Empfänger & Event-Inspektor",
  "In-Memory KV Cache :6380": "In-Memory KV-Cache :6380",
  "High-speed Redis-compatible in-memory key-value cache":
    "Schneller Redis-kompatibler In-Memory Key-Value-Cache",
  "Core Vault Backup (edge-node-01)": "Core-Vault-Backup (edge-node-01)",
  "Automated Encrypted Core Backup": "Automatisches verschlüsseltes Core-Backup",
  "1. Fault Injection": "1. Fehlerinjektion",
  "2. Watchdog Self-Heal": "2. Wächter Auto-Heilung",
  "3. Health Verification": "3. Gesundheits-Prüfung",
  "Autonomous Microservice": "Autonomer Microservice",
  "/ (Overview)": "/ (Übersicht)",
  "/ (Send JSON Input)": "/ (JSON-Daten senden)",
  "VerifiedMulti-Core Production Baseline":
    "Verifizierte Multi-Core Produktions-Basis",
  "Live Simulation Snapshot": "Live-Simulations-Snapshot",
  "Lightweight JSON health and latency telemetry beacon running on port 4060.":
    "Leichtgewichtiger JSON-Uptime- & Latenz-Telemetrie-Beacon auf Port 4060.",
  "Captures and inspects incoming JSON webhooks in real time on port 4065.":
    "Empfängt und inspiziert eingehende JSON-Webhooks in Echtzeit auf Port 4065.",
  "Fast HTTP/JSON Key-Value in-memory cache store running on port 6380.":
    "Schneller HTTP/JSON In-Memory Key-Value-Cache auf Port 6380.",
  "Networking": "Netzwerk",
  "deployment": "Deployment",
  "Deployment": "Deployment",
  "Infrastructure": "Infrastruktur",
  "security": "Sicherheit",
  "Security": "Sicherheit",
  "EXECUTED": "AUSGEFÜHRT",
  "BLOCKED": "BLOCKIERT",
  "executed": "Ausgeführt",
  "blocked": "Blockiert",
  "REMOTE FILE LAYOUT": "REMOTE-DATEISTRUKTUR",
  "Remote File Layout": "Remote-Dateistruktur",
  "System Architecture — default-project":
    "System-Architektur — default-project",
  "Primary project workspace on assigned Axon Muscle Node(s).":
    "Primäres Projekt-Arbeitsverzeichnis auf den zugewiesenen Axon-Muscle-Servern.",
  "— Primary project workspace on assigned Axon Muscle Node(s).":
    "— Primäres Projekt-Arbeitsverzeichnis auf den zugewiesenen Axon-Muscle-Servern.",
  "Watchdog Log": "Wächter-Log",
  "24/7 Proactive Watchdog verified from Synapse Control Center.":
    "Proaktiver 24/7-Wächter aus dem Synapse Control Center verifiziert.",
};

for (const [deKey, enVal] of Object.entries(EN_DICTIONARY)) {
  if (enVal && !DE_DICTIONARY[enVal]) {
    DE_DICTIONARY[enVal] = deKey;
  }
}
