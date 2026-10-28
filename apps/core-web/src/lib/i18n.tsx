"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Globe } from "lucide-react";

export type LocaleCode = "de" | "en" | (string & {});

export interface PatternRule {
  match: RegExp;
  replace: string;
}

export interface LocaleDefinition {
  code: LocaleCode;
  label: string;
  nativeLabel: string;
  shortCode: string;
  flag: string;
  htmlLang: string;
  /** Exact phrase lookup map: canonical source string -> translated string */
  dictionary: Record<string, string>;
  /** Dynamic regex pattern rules (e.g., "Alle (5)" -> "All (5)") */
  patterns: PatternRule[];
}

/**
 * English Dictionary (Translating all German UI strings -> English)
 */
const EN_DICTIONARY: Record<string, string> = {
  // Navigation & Sidebar
  "Übersicht & Dienste": "Overview & Services",
  "Übersicht": "Overview",
  "Services": "Services",
  "Dienste": "Services",
  "Server & Mesh": "Servers & Mesh",
  "Projekt & Dateien": "Project & Files",
  "Brain Vault": "Brain Vault",
  "Dateien": "Files",
  "Sicherheit & System": "Security & System",
  "Firewall": "Firewall",
  "Firewall & Port-Schutz": "Firewall & Port Shield",
  "Firewall aktiv": "Firewall active",
  "Stealth-Firewall": "Stealth Firewall",
  "Firewall & Port-Schutz für diesen Server öffnen":
    "Open Firewall & Port Shield for this server",
  "Live Port-Radar": "Live Port Radar",
  "1-Klick Sicherheits-Profile": "1-Click Security Profiles",
  "Web-Server Modus (Standard)": "Web Server Mode (Standard)",
  "Synapse Stealth-Modus (Zero-Port)": "Synapse Stealth Mode (Zero-Port)",
  "Benutzerdefiniert": "Custom Mode",
  "Anti-Lockout & 15s Notfall-Rollback aktiv":
    "Anti-Lockout & 15s Emergency Rollback active",
  "Nach außen sperren": "Block Externally",
  "Öffentlich freigeben": "Allow Publicly",
  "Öffentlich im Internet": "Public on Internet",
  "Durch Firewall geschützt": "Shielded by Firewall",
  "Nur lokal (127.0.0.1)": "Local Only (127.0.0.1)",
  "IP-Blocker & Whitelist": "IP Blocker & Whitelist",
  "IP-Regel hinzufügen": "Add IP Rule",
  "Regeln": "Rules",
  "Audit-Log": "Audit Log",
  "Einstellungen": "Settings",
  "Sidebar ausklappen": "Expand sidebar",
  "Sidebar einklappen": "Collapse sidebar",
  "Neues Projekt anlegen": "Create new project",
  "Verbundenen Server anzeigen": "View connected servers",
  "Core & Muscle System-Update öffnen": "Open Core & Muscle System Update",

  // Top Header & Canvas Controls
  "Server": "Server",
  "+ Server": "+ Server",
  "Kein Server verbunden": "No server connected",
  "+ Verbinden": "+ Connect",
  "Details einklappen": "Collapse details",
  "Details direkt im Knoten aufklappen": "Expand details inline on node",
  "Core Hub einklappen": "Collapse Core Hub",
  "Regeln & Brain Vault direkt aufklappen": "Expand Rules & Brain Vault inline",
  "Keine Services": "No Services",
  "Noch keine Dienste bereitgestellt": "No services deployed yet",
  "Datenbank": "Database",
  "Service einklappen": "Collapse service",
  "Endpunkte & Aktionen direkt aufklappen": "Expand endpoints & actions inline",
  "Tester & Vorschau öffnen": "Open Tester & Preview",
  "Vorschau & Tester öffnen": "Open Preview & Tester",
  "Detail-Inspektor (frei verschiebbar)": "Detail Inspector (draggable)",
  "Mit der Maus ziehen, um das Detailfenster frei zu verschieben":
    "Drag with mouse to move the inspector window freely",
  "IPv4-Adresse": "IPv4 Address",
  "Sicherheits-Stufe": "Security Tier",
  "Live Terminal öffnen": "Open Live Terminal",
  "Dateien durchsuchen": "Browse Files",
  "KI-Engine, Brain Vault & aktive Sicherheitsregeln":
    "AI Engine, Brain Vault & active security rules",
  "Ändern →": "Change →",
  "Projekt-Dokumentation & Tresor": "Project Documentation & Vault",
  "Sicherheits-Cartridges": "Security Cartridges",
  "Details →": "Details →",
  "Verfügbare Aktionen": "Available Actions",
  "Auto-Heal starten": "Start Auto-Heal",
  "Alle Knoten auf dem Canvas auf- oder zuklappen":
    "Expand or collapse all nodes on the canvas",
  "Alle einklappen": "Collapse all",
  "Alle erweitern": "Expand all",
  "Ansicht zentrieren": "Center view",
  "Layout zurücksetzen": "Reset layout",

  // Peers & Mesh View
  "P2P Mesh-Links": "P2P Mesh Links",
  "Stack-Blueprints": "Stack Blueprints",
  "Cron-Playbooks": "Cron Playbooks",
  "Server hinzufügen": "Add Server",
  "Server nach Name, Hostname oder IP filtern...":
    "Filter servers by name, hostname, or IP...",
  "Alle Tiers": "All Tiers",
  "Server / Status": "Server / Status",
  "Adresse (IPv4)": "Address (IPv4)",
  "Auslastung": "Utilization",
  "Aktionen": "Actions",
  "Diesen Muscle-Server Over-the-Air (OTA) aktualisieren & neu starten":
    "Update & restart this Muscle server Over-the-Air (OTA)",
  "Live Ressourcen-Metriken": "Live Resource Metrics",
  "Registrierte Dienste (": "Registered Services (",
  "Keine Dienste auf diesem Knoten.": "No services on this node.",
  "Verbindungs-Details": "Connection Details",
  "Aktive PTYs:": "Active PTYs:",
  "Verbunden seit:": "Connected since:",
  "Dateien öffnen": "Open Files",
  "Multi-Server Peer-to-Peer Mesh Links (`core_link_peers`)":
    "Multi-Server Peer-to-Peer Mesh Links (`core_link_peers`)",
  "Verbinde Dienste zwischen verschiedenen Muscle-Servern über verschlüsselte mTLS-Loopback-Tunnels.":
    "Connect services across different Muscle servers over encrypted mTLS loopback tunnels.",
  "Source peer (z.B. vps2-muscle)": "Source peer (e.g. vps2-muscle)",
  "Target peer (z.B. vps2-db-node)": "Target peer (e.g. vps2-db-node)",
  "+ Mesh-Link anlegen": "+ Create Mesh Link",
  "1-Click AI Stack Blueprints": "1-Click AI Stack Blueprints",
  "Fertige Infrastruktur-Stacks mit einem Klick autonom über den KI-Orchestrator bereitstellen.":
    "Autonomously deploy ready-made infrastructure stacks with one click via the AI orchestrator.",
  "Stack per KI bereitstellen →": "Deploy Stack via AI →",
  "Scheduled AI Playbooks (Cron-Wartung)":
    "Scheduled AI Playbooks (Cron Maintenance)",
  "Wiederkehrende autonome Health-Checks, Log-Bereinigungen und Sicherheits-Audits.":
    "Recurring autonomous health checks, log cleanups, and security audits.",
  "Playbook-Name...": "Playbook name...",
  "KI-Anweisung...": "AI instruction...",
  "+ Cron hinzufügen": "+ Add Cron",
  "Jetzt ausführen": "Run now",
  "Aktiv": "Active",
  "Pausiert": "Paused",
  "Regeln aktiv": "Rules active",

  // Rules & Access Control
  "Klicke auf eine Rule Cartridge, um die vollständige Regel-Spezifikation direkt in der Karte aufzuklappen.":
    "Click any Rule Cartridge to expand its full policy specification inline.",
  "Neue Cartridge erstellen": "Create New Cartridge",
  "Einklappen": "Collapse",
  "Erweitern": "Expand",
  "AKTIV": "ACTIVE",
  "AUS": "OFF",

  // Services & Reverse Proxy Tester
  "Alle": "All",
  "Alle (": "All (",
  "Datenbanken": "Databases",
  "API- & DB-Tester": "API & DB Tester",
  "Web-Vorschau": "Web Preview",
  "Split-Ansicht": "Split View",
  "Noch keine Dienste im Projekt registriert.":
    "No services registered in this project yet.",
  "Diesen Dienst aus dem Projekt entfernen":
    "Remove this service from the project",
  "Dienst entfernen": "Remove service",
  "Extern": "External",
  "Verfügbare Optionen": "Available Options",
  "Verfügbare Endpunkte": "Available Endpoints",
  "SQL-Abfrage": "SQL Query",
  "Request-Body (JSON)": "Request Body (JSON)",
  "Antwort": "Response",
  "Im Browser über den Yamux-Reverse-Proxy öffnen":
    "Open in browser via Yamux reverse proxy",
  "Sende rechts eine Anfrage an": "Send a request on the right to",
  "Antwort (": "Response (",
  "Pfad auf :": "Path on :",
  "Läuft...": "Running...",
  "Ausführen": "Execute",
  "Klicke links auf eine Option oder auf 'Ausführen'.":
    "Click an option on the left or press 'Execute'.",
  "Klicke links auf einen Endpunkt oder oben auf 'Ausführen'.":
    "Click an endpoint on the left or press 'Execute' above.",
  "Neu laden": "Reload",

  // Brain Vault & Workspace Files
  "Leseansicht": "Reader View",
  "Bearbeiten": "Edit",
  "Speichern": "Save",
  "Mit der Maus ziehen, um die Dateiliste breiter/schmaler zu machen":
    "Drag with mouse to resize the file explorer sidebar",
  "Mit der Maus ziehen, um die Höhe des Terminals anzupassen":
    "Drag with mouse to resize the terminal height",
  "Mit der Maus ziehen, um die Breite des KI-Chats frei anzupassen":
    "Drag with mouse to freely resize the AI chat panel width",

  // Audit Log
  "Audit-Events nach Tool, Peer oder Zusammenfassung durchsuchen (Klick auf Zeile erweitert Details)...":
    "Search audit events by tool, peer, or summary (click row to expand details)...",
  "Vollständiger Audit-Eintrag (": "Full Audit Entry (",

  // Settings & System Update Center
  "System-Update (Core & Muscle)": "System Update (Core & Muscle)",
  "Setup Keys (Peer Onboarding)": "Setup Keys (Peer Onboarding)",
  "AI Providers & Base URL": "AI Providers & Base URL",
  "System-Update & Over-the-Air (OTA) Rollout":
    "System Update & Over-the-Air (OTA) Rollout",
  "1-Klick Synchronisation für": "1-Click Synchronization for",
  "(Git, WebUI & Gateway) und alle": "(Git, WebUI & Gateway) and all",
  "& Systemd-Daemon).": "& systemd daemon).",
  "Aktualisiere": "Update",
  "Muscle-Server": "Muscle Servers",
  "Verbundene Muscle-Knoten (": "Connected Muscle Nodes (",
  "Komplett-Update (Core + alle Muscles)": "Full Update (Core + all Muscles)",
  "Nur Core updaten": "Update Core only",
  "Alle Muscles (OTA) updaten": "Update all Muscles (OTA)",
  "Auf Updates prüfen": "Check for Updates",
  "Prüfe Git & Muscle Versionen...": "Checking Git & Muscle versions...",
  "Aktualisiere Core Plane...": "Updating Core Plane...",
  "OTA-Update auf allen Muscle-Knoten...": "Running OTA update on all Muscle nodes...",
  "Komplett-Update (Core + Muscle OTA)...": "Running Full Update (Core + Muscle OTA)...",
  "Versionsprüfung abgeschlossen": "Version check completed",
  "System-Update erfolgreich durchgeführt!": "System update completed successfully!",
  "Update mit Hinweisen/Warnungen beendet": "Update finished with warnings/notes",
  "— Bitte einen Moment warten, während Git-Commits, Binaries und Systemd-Daemons synchronisiert werden...":
    "— Please wait a moment while Git commits, binaries, and systemd daemons are synchronized...",
  "Core Plane (WebUI, Orchestrator & Gateway)":
    "Core Plane (WebUI, Orchestrator & Gateway)",
  "Installierter Commit:": "Installed Commit:",
  "Remote (origin/main):": "Remote (origin/main):",
  "Core Gateway Binary:": "Core Gateway Binary:",
  "(Synchron)": "(In Sync)",
  "Aktuell": "Up to date",
  "Update-Protokoll (Letzter Lauf)": "Update Log (Last Run)",
  "Ausblenden": "Hide",
  "Sprache & Lokalisierung": "Language & Localization",
  "Wähle die Anzeigesprache der Benutzeroberfläche. Weitere Sprachen können jederzeit über das Sprach-Register ergänzt werden.":
    "Choose the display language of the user interface. Additional languages can be registered at any time.",

  // AI Copilot Panel & Rich Markdown
  "Cache aktiv": "Cache active",
  "Kompakt": "Compact",
  "Breiter": "Wider",
  "Auf Standardbreite verkleinern": "Restore standard width",
  "Chat-Fenster verbreitern (oder linken Rand ziehen)":
    "Widen chat panel (or drag left border)",
  "Konversation zurücksetzen": "Reset conversation",
  "Interaktive Ansicht": "Interactive View",
  "Deine Anfrage": "Your Request",
  "Prompt-Details ▼": "Prompt Details ▼",
  "Kompakt ▲": "Compact ▲",
  "Schritt": "step",
  "Schritte": "steps",
  "Schritte ·": "steps ·",
  "🛠️ Alle (": "🛠️ All (",
  "📁 Dateien (": "📁 Files (",
  "Themenbereiche": "Topic Sections",
  "Zeilen": "lines",
  "Zeile": "line",
  "Senior DevOps KI-Analyse läuft (": "Senior DevOps AI analysis running (",
  "Von außen erreichbare Dienste (": "Externally reachable services (",
  "Skill ausgewählt:": "Skill selected:",
  "SRE System-Tiefenscan": "SRE Deep System Scan",
  "CheckSystem (6-Phasen Infrastruktur-Audit)":
    "CheckSystem (6-Phase Infrastructure Audit)",
  "Prüft Host-Telemetrie, Ports, Quellcode, SQLite-Integrität, Logs & Brain-Sync.":
    "Inspects host telemetry, ports, source code, SQLite integrity, logs & Brain sync.",
  "DevSecOps Security-Audit": "DevSecOps Security Audit",
  "CheckOpsec (Sicherheits- & Socket-Prüfung)":
    "CheckOpsec (Security & Socket Inspection)",
  "Prüft Socket-Bindings, SSH-Härtung, Firewall, Dateirechte, Secrets & Header.":
    "Inspects socket bindings, SSH hardening, firewall, file permissions, secrets & headers.",
  "Muscle & Backend Updates": "Muscle & Backend Updates",
  "Updates durchführen & End-to-End testen":
    "Execute Updates & Run End-to-End Tests",
  "End-to-End Funktionstest ausführen": "Run End-to-End Functional Test",
  "CheckUpdates (Versions- & Paket-Inspektion)":
    "CheckUpdates (Version & Package Inspection)",
  "Prüft Axon-Binaries, Runtimes, Systempakete & Backends auf Updates.":
    "Checks Axon binaries, runtimes, system packages & backends for updates.",
  "Root-Cause Forensik": "Root-Cause Forensics",
  "DeepForensics (Log- & Prozess-Tiefenanalyse)":
    "DeepForensics (Deep Log & Process Analysis)",
  "Durchsucht Systemd-Journals, Logs, Datenbanken & Prozesse nach Fehlerursachen.":
    "Scans systemd journals, logs, databases & processes for root causes.",
  "SkillSearch (Code-, System- & UI-Suche)":
    "SkillSearch (Code, System & UI Search)",
  "Durchsucht Dateien, Ports, Datenbanken, Logs und UI-Funktionen.":
    "Searches files, ports, databases, logs, and UI features.",
  "Interaktives Interview": "Interactive Interview",
  "Interview-Modus gestartet": "Interview Mode Started",
  "Interview-Entscheidung gesendet": "Interview Decision Sent",
  "✅ Punkt jetzt live beheben & verifizieren":
    "✅ Fix & verify this item live now",
  "⏭️ Punkt überspringen → weiter zum nächsten Befund":
    "⏭️ Skip item → proceed to next finding",
  "⚡ Alle verbleibenden Punkte automatisch beheben":
    "⚡ Automatically fix all remaining items",
  "Schrittweise Durchsprache der Befunde & Empfehlungen.":
    "Step-by-step walkthrough of findings & recommendations.",
  "Selbstheilung für Microservice :4050 ausgeführt":
    "Self-healing executed for Microservice :4050",
  "Details ▼": "Details ▼",
  "DevSecOps Security-Bericht": "DevSecOps Security Report",
  "Update- & Test-Inspektor": "Update & Test Inspector",
  "SRE System-Tiefenbericht": "SRE Deep System Report",
  "DevOps Interview-Begleiter": "DevOps Interview Assistant",
  "KI-Gedankengang (Reasoning Trace) ein-/ausblenden":
    "Toggle AI Reasoning & Context Trace",
  "Antwort als Markdown kopieren": "Copy reply as Markdown",
  "Kopiert": "Copied",
  "Kopieren": "Copy",
  "Schließen": "Close",
  "Direktstart: Interaktive DevOps-Skills":
    "Quick Launch: Interactive DevOps Skills",
  "1-Klick Auswahl": "1-Click Selection",
  "System-Check": "System Check",
  "6-Phasen SRE & DB Audit": "6-Phase SRE & DB Audit",
  "OpSec-Audit": "OpSec Audit",
  "Ports, SSH, Firewall & Keys": "Ports, SSH, Firewall & Keys",
  "Updates prüfen": "Check Updates",
  "Muscle, Backends & Test": "Muscle, Backends & Test",
  "Deep-Forensik": "Deep Forensics",
  "Logs, Prozesse & Ursachen": "Logs, Processes & Root Causes",
  "Muscle & Backend Updates: Sollen die Updates durchgeführt & getestet werden?":
    "Muscle & Backend Updates: Should the updates be executed & tested?",
  "Ja, Updates durchführen & Funktionstest starten":
    "Yes, execute updates & start functional test",
  "Nur Funktionstest ausführen": "Run functional test only",
  "Einzeln im Interview durchgehen": "Review one by one in Interview",
  "Nein, keine Updates": "No, skip updates",
  "DevOps Interview-Modus: Deine Entscheidung":
    "DevOps Interview Mode: Your Decision",
  "Ja, jetzt beheben": "Yes, fix now",
  "Nicht beheben (Nächster Punkt)": "Skip (Next item)",
  "Alle restlichen beheben": "Fix all remaining",
  "Interview beenden": "End Interview",
  "Tipp: Du kannst auch direkt ins Textfeld schreiben, wenn die KI diesen Punkt auf eine bestimmte Weise anpassen soll.":
    "Tip: You can also type directly in the input box if you want the AI to customize how this item is fixed.",
  "Befunde & Empfehlungen Schritt für Schritt durchgehen?":
    "Walk through findings & recommendations step by step?",
  "Im Interview-Modus stellt dir die KI jeden Punkt einzeln vor und fragt dich, ob sie ihn direkt beheben soll.":
    "In Interview Mode, the AI presents each finding individually and asks whether to fix it live.",
  "Interview starten": "Start Interview",
  "Öffnen →": "Open →",
  "Einklappen ▲": "Collapse ▲",
  "Schritte öffnen ▼": "Expand steps ▼",
  "Befehl kopiert & Live-Terminal geöffnet":
    "Command copied & Live Terminal opened",
  "Skill abwählen": "Deselect skill",
  "AI Skills auswählen (CheckSystem, CheckOpsec, SkillSearch)":
    "Select AI Skills (CheckSystem, CheckOpsec, SkillSearch)",
  "Wonach suchst du im System? (z.B. Firewall, SQL, SSH Keys, Logs)...":
    "What are you looking for in the system? (e.g. Firewall, SQL, SSH Keys, Logs)...",
  "Mehrstufiger Senior-DevOps-Tiefenscan: Prüft Host, Ports, Quellcode, SQLite-Integrität, Logs & Brain-Sync mit erweiterten Suchfunktionen.":
    "Multi-stage Senior DevOps deep scan: Inspects host, ports, source code, SQLite integrity, logs & Brain sync with deep search.",
  "Mehrstufiger DevSecOps-Tiefenaudit: Prüft offene Sockets, SSH, Firewall, Sysctl, Dateirechte, Code-Schwachstellen, Secrets & HTTP-Header.":
    "Multi-stage DevSecOps deep audit: Inspects open sockets, SSH, firewall, sysctl, file permissions, code vulnerabilities, secrets & HTTP headers.",
  "Muscle & Backend Update-Prüfung: Prüft Axon-Daemons, Workspace-Backends, Runtimes & OS-Pakete auf Updates und fragt danach nach Ausführung + Funktionstest.":
    "Muscle & Backend update check: Inspects Axon daemons, workspace backends, runtimes & OS packages for updates, then asks for execution + functional test.",
  "Tiefgreifende DevOps-Forensik: Durchsucht alle Logs, Prozesse, Datenbanken und Quellcode-Dateien nach versteckten Fehlern & Root-Causes.":
    "Deep DevOps forensics: Searches all logs, processes, databases, and source files for hidden errors & root causes.",
  "Erweiterte System-, Code-, Datenbank-, Log- & UI-Tiefensuche: Findet jede Funktion, Einstellung, Datei oder Zeile im gesamten System.":
    "Extended system, code, database, log & UI deep search: Finds any feature, setting, file, or line across the entire system.",
  "Prüft alle Muscle-Server, Axon-Binaries, Runtimes, OS-Pakete & Backends auf Updates, fragt nach Freigabe und führt danach einen Funktionstest durch.":
    "Checks all Muscle servers, Axon binaries, runtimes, OS packages & backends for updates, asks for approval, and runs a functional test.",
  "6-Phasen SRE Audit": "6-Phase SRE Audit",
  "Tiefenscan wie durch einen Senior DevOps Engineer: Host, Ports, Quellcode-Grep, SQLite-Integrität, Logs & Brain-Drift.":
    "Deep scan like a Senior DevOps Engineer: Host, ports, source code grep, SQLite integrity, logs & Brain drift.",
  "DevSecOps Forensik": "DevSecOps Forensics",
  "Mehrstufiger Security-Audit: Socket-Bindings, SSH, Firewall, Sysctl, Dateirechte, Secret-Leak-Scan & HTTP-Header.":
    "Multi-stage security audit: Socket bindings, SSH, firewall, sysctl, file permissions, secret leak scan & HTTP headers.",
  "Root-Cause & Logs": "Root-Cause & Logs",
  "Durchsucht sämtliche Logs, Journalctl, Prozesse, Datenbanken & Code-Dateien nach Fehlern, Engpässen & Ursachen.":
    "Scans all logs, journalctl, processes, databases & code files for errors, bottlenecks & root causes.",
  "Code-, System- & UI-Suche": "Code, System & UI Search",
  "Durchsucht UI-Sitemap, Server-Dateien, Code-Zeilen, Ports, DBs & Brain Vault nach jeder gesuchten Funktion.":
    "Searches UI sitemap, server files, code lines, ports, DBs & Brain Vault for any requested feature.",
  "System-Update & Versionsdetails öffnen":
    "Open System Update & version details",
  "Update verfügbar": "Update available",
  "Sprache & Region": "Language & Region",
  "@Kontext einfügen": "Insert @Context Mention",

  // RichMarkdownDocument UI Chrome
  "Noch keine Inhalte vorhanden.": "No content documented yet.",
  "Befehl direkt in die Live-PTY-Shell übertragen":
    "Send command directly to Live PTY Shell",
  "Klicken zum Sortieren": "Click to sort",
  "Klicken, um diesen Punkt als erledigt/geprüft zu markieren":
    "Click to mark this item as completed/reviewed",
  "Alle aufklappen": "Expand all",
  "Kompaktansicht": "Compact view",
  "Security & OpSec": "Security & OpSec",
  "Updates & Versionen": "Updates & Versions",
  "Diagnose & Forensik": "Diagnostics & Forensics",
  "Daten & Speicher": "Data & Storage",
  "Maßnahmen & Fazit": "Actions & Conclusion",
  "System & Infrastruktur": "System & Infrastructure",
  "Willkommen im Synapse AI Copilot": "Welcome to Synapse AI Copilot",
  "Conversation context compacted and cleared. Ready for new instructions (Prompt Cache & Vision active).":
    "Conversation context compacted and cleared. Ready for new instructions (Prompt Cache & Vision active).",
  "Quell-Server (z.B. vps2-muscle)": "Source peer (e.g. vps2-muscle)",
  "Ziel-Server (z.B. vps2-db-node)": "Target peer (e.g. vps2-db-node)",
  "ENV-Alias (PEER_DB_URL)": "ENV Alias (PEER_DB_URL)",
  "Noch keine P2P-Mesh-Verknüpfungen aktiv. Wähle oben Quell- und Ziel-Server sowie den Ziel-Port aus, um einen verschlüsselten mTLS-Loopback-Tunnel bereitzustellen.":
    "No P2P mesh links active yet. Select a source peer, target peer, and port above to provision an encrypted mTLS loopback tunnel.",
  "Mesh-Link trennen": "Remove mesh link",
  "PAUSIERT": "PAUSED",
  "Erzeuge einen einmaligen Setup-Schlüssel für das automatische mTLS 1.3 Onboarding neuer Linux-Server oder das Umbinden bestehender Muscle-Knoten.":
    "Generate a one-time setup key for automated mTLS 1.3 onboarding of new Linux servers or rebinding existing Muscle nodes.",
  "Geheimnisse werden lokal mit AES-256-GCM verschlüsselt gespeichert (Write-Only) und bei Bedarf sicher in Remote-Prozesse injiziert.":
    "Secrets are stored locally with AES-256-GCM encryption (write-only) and securely injected into remote processes on demand.",
  "Noch keine Secrets im Tresor hinterlegt.": "No secrets stored in the vault yet.",
  "Secret löschen": "Delete secret",
  "Integrations-Vorlagen ausblenden": "Hide integration templates",
  "Integrations-Vorlagen anzeigen (Claude / Cursor / cURL)":
    "Show integration templates (Claude / Cursor / cURL)",
  "✔ Kopiert": "✔ Copied",
  "Lade Live-Diagnose-Snapshot...": "Loading live diagnostic snapshot...",
  "Frage Synapse AI (@ für Kontext, Bilder per Drag & Drop)...":
    "Ask Synapse AI (@ to mention, drop/paste images)...",
  "Wonach suchst du? (z.B. Firewall, SQL, Ports)...":
    "What are you looking for? (e.g. Firewall, SQL, Ports)...",
  "Quell-Server (vps2-muscle)": "Source peer (vps2-muscle)",
  "Ziel-Server (vps2-db-node)": "Target peer (vps2-db-node)",
  "Quell-Server (vps2)": "Source peer (vps2)",
  "Ziel-Server (db-node)": "Target peer (db-node)",
  "Frage Synapse AI (@ Kontext, Bilder)...":
    "Ask Synapse AI (@ context, images)...",
  "z.B. prod-01": "e.g. prod-01",
  "Dienst-Gesundheitswarnung:": "Service Health Alert:",
  "KI um Diagnose & Reparatur bitten": "Ask AI to Diagnose & Fix",
  "Autonomie-Stufe": "Autonomy Tier",
  "Trennen": "Unassign",
  "Zuweisen": "Assign",
  "Eigene Regel-Cartridge erstellen (.md)": "Create Custom Rule Cartridge (.md)",
  "Eigene Regel-Cartridge erstellen (`.md`)": "Create Custom Rule Cartridge (`.md`)",
  "Cartridge-Name (z.B. DSGVO / HIPAA)": "Cartridge Name (e.g. GDPR / HIPAA)",
  "Kategorie (z.B. Sicherheit)": "Category (e.g. Security)",
  "Kurzbeschreibung...": "Short description...",
  "Cartridge speichern & aktivieren": "Save & Enable Cartridge",
  "Freigeben & Ausführen": "Approve & Execute",
  "Ablehnen": "Reject",
  "Neuer Dateipfad...": "New file path...",
  "Unified-Diff-Patch": "Unified Diff Patch",
  "Auf Server speichern": "Save to Peer",
  "Unified-Diff einfügen (@@ -1,3 +1,4 @@)...": "Paste unified diff (@@ -1,3 +1,4 @@)...",
  "Unified-Diff anwenden": "Apply Unified Diff",
  "Ausgeführt": "Executed",
  "Blockiert": "Blocked",
  "Freigabe nötig": "Needs Approval",
  "Zeitstempel": "Timestamp",
  "Akteur": "Actor",
  "Tool / Ereignis": "Tool / Event",
  "Zusammenfassung": "Summary",
  "Setup-Schlüssel (Server-Onboarding)": "Setup Keys (Peer Onboarding)",
  "KI-Anbieter & Basis-URL": "AI Providers & Base URL",
  "Einmal-Setup-Schlüssel (Server-Anbindung)": "One-Time Peer Setup Keys",
  "Server-Name (optional, z.B. prod-01)": "Peer Name (optional, e.g. prod-01)",
  "Setup-Schlüssel erzeugen": "Generate Setup Key",
  "1. Neuinstallation — Auf dem Ziel-Linux-Server ausführen, um `axon` zu installieren & zu verbinden:":
    "1. Fresh Install — Run on target Linux host to install `axon` & connect via token:",
  "✔ Kopiert!": "✔ Copied!",
  "Befehl kopieren": "Copy Command",
  "2. Bestehenden Muscle-Agenten per CLI umschalten (`axon switch`)":
    "2. Switch / Rebind Existing Muscle Agent via CLI (`axon switch`)",
  "`axon` ist bereits installiert? Führe diesen Befehl aus, um ihn mit neuem Token an diesen Core zu binden (oder nutze `axon profiles`):":
    "Already have `axon` installed? Run this in your shell to connect it to this Core with a new token (or use `axon profiles` to switch saved Cores):",
  "✔ CLI kopiert!": "✔ Copied CLI!",
  "CLI-Switch kopieren": "Copy CLI Switch",
  "AES-256-GCM Verschlüsselter Secrets-Tresor (`Secrets.enc`)":
    "AES-256-GCM Encrypted Secrets Vault (`Secrets.enc`)",
  "Geheimer Klartext-Wert (nur schreiben)...": "Secret plaintext value (write-only)...",
  "Verschlüsseln & Speichern": "Encrypt & Save",
  "KI-Anbieter & Eigene API-Basis-URL": "AI Provider & Custom API Base URL",
  "Verbinde OpenRouter, vLLM, LiteLLM, Ollama oder OpenAI.":
    "Connect OpenRouter, vLLM, LiteLLM, Ollama, or OpenAI.",
  "KI-Anbieter Vorlage": "Provider Preset",
  "API Basis-URL": "API Base URL",
  "Modelle laden": "Fetch /models",
  "Modelle abrufen": "Fetch Models",
  "Modell-Name": "Model Name",
  "API-Schlüssel (Verschlüsselt in Secrets.enc als":
    "API Key (Encrypted in Secrets.enc as",
  "•••••••• (Gespeichert in Secrets.enc)": "•••••••• (Saved in Secrets.enc)",
  "Prompt- & Dateisystem-Caching": "Prompt & FS Caching",
  "Statische System-Layer & Datei-Lesezugriffe zwischenspeichern":
    "Cache static system layers & file reads",
  "Proaktiver Auto-Watchdog": "Proactive Auto-Watchdog",
  "Abgestürzte Dienste im Hintergrund automatisch reparieren":
    "Auto-heal crashed services in background",
  "KI-Anbieter speichern": "Save AI Provider",
  "Anbieter speichern": "Save Provider",
  "Abbrechen": "Cancel",
  "Externer KI-Zugriff & Model Context Protocol (MCP) Server (`/api/mcp`)":
    "External AI Access & Model Context Protocol (MCP) Server (`/api/mcp`)",
  "Erlaube externen KI-Agenten (Claude Desktop, Cursor, Windsurf, Antigravity, OpenCode oder eigenen REST/JSON-RPC-Bots), deinen Synapse Core & Muscle sicher per MCP-Token zu steuern.":
    "Allow external AI agents (Claude Desktop, Cursor, Windsurf, Antigravity, OpenCode, or custom REST/JSON-RPC bots) to control your Synapse Core & Muscle peers securely via an MCP API Token.",
  "Client-Name (z.B. Claude Desktop / Cursor)": "Client name (e.g. Claude Desktop / Cursor)",
  "Vollzugriff (Lesen + PTY/Dateisystem + Admin)": "Full Access (Read + Execute PTY/FS + Admin)",
  "Nur Lesen (Server, Dateien & Brain-Docs prüfen)": "Read-Only (Inspect Peers, Files & Brain Docs)",
  "+ MCP-API-Schlüssel erzeugen": "+ Generate MCP API Key",
  "✔ Neuer MCP-API-Schlüssel erzeugt (jetzt kopieren — wird als SHA-256-Hash gespeichert):":
    "✔ New MCP API Key Generated (copy now — stored as SHA-256 hash):",
  "✔ Token kopiert!": "✔ Copied Token!",
  "Token kopieren": "Copy Token",
  "Aktive Externe KI- / MCP-Tokens": "Active External AI / MCP Tokens",
  "Noch keine MCP-API-Tokens erstellt. Klicke oben auf „+ MCP-API-Schlüssel erzeugen“.":
    "No MCP API tokens created yet. Click “+ Generate MCP API Key” above to issue one.",
  "Widerrufen": "Revoke",
  "1. MCP-Client-Konfiguration (`mcp_config.json` — Claude / Cursor / Antigravity)":
    "1. MCP Client Config (`mcp_config.json` — Claude / Cursor / Antigravity)",
  "2. Direkter REST / JSON-RPC Tool-Aufruf (`curl` / Eigener KI-Agent)":
    "2. Direct REST / JSON-RPC Tool Call (`curl` / Custom AI Agent)",
  "Live MCP-Protokoll-Tester (`JSON-RPC 2.0`)": "Live MCP Protocol Tester (`JSON-RPC 2.0`)",
  "Teste `tools/list` (10 Tools)": "Test `tools/list` (10 Tools)",
  "Teste `resources/list`": "Test `resources/list`",
  "Rufe `synapse_get_project_state` auf": "Call `synapse_get_project_state`",
  "Core & Muscle Debug-Modus + End-to-End-Selbsttest":
    "Core & Muscle Debug Mode + End-to-End Self-Test",
  "Prüfe Live-mTLS-1.3- & Yamux-Streams, verifiziere die AES-256-GCM-Tresor-Integrität und führe Diagnose-Checks auf Core und Muscle aus.":
    "Inspect live mTLS 1.3 + Yamux stream traces, verify AES-256-GCM Vault integrity, and run diagnostic checks on both Core and Muscle.",
  "● Debug-Modus: AKTIV": "● Debug Mode: ENABLED",
  "○ Debug-Modus aktivieren": "○ Enable Debug Mode",
  "Selbsttest läuft...": "Running Self-Test...",
  "▶ 5-Stufen-Selbsttest starten": "▶ Run 5-Step Self-Test",
  "Aktualisieren": "Refresh",
  "End-to-End Diagnose-Prüfungen": "End-to-End Diagnostic Checks",
  "CLI-Debug-Befehle für Core & Muscle (`axon debug` / `--debug`)":
    "CLI Debug Commands for Core & Muscle (`axon debug` / `--debug`)",
  "Live Core-Web- & Gateway-Diagnose-Snapshot (`/api/debug`)":
    "Live Core Web & Gateway Diagnostic Snapshot (`/api/debug`)",
  "Ausklappen": "Expand",
  "Kein Muscle-Server verbunden. Klicke auf „+ Server“, um einen Linux-Knoten anzubinden.":
    "No Muscle Peer connected. Click “+ Server” to enroll a Linux node.",
  "Neuen Muscle-Server verbinden (Linux / Docker)": "Add New Muscle Peer (Linux / Docker)",
  "Ein-Befehl-Installation mit automatischem Token-Login & mTLS-1.3-Anbindung.":
    "One-command installation with automatic token login & mTLS 1.3 enrollment.",
  "Core-Gateway-URL": "Core Gateway URL",
  "Server-ID (Optional)": "Peer ID (Optional)",
  "Führe diesen einzelnen Befehl auf deinem Linux-Server aus:":
    "Run this single command on your Linux server:",
  "Neues Token": "Rotate Token",
  "Erzeuge Setup-Token...": "Generating setup token...",
  "Oder bestehenden Muscle per CLI umschalten (`axon switch`):":
    "Or switch an existing Muscle via CLI (`axon switch`):",
  "Verbinde einen installierten Muscle-Agenten mit neuem Token an diesen Core (altes Profil bleibt unter `axon profiles` erhalten):":
    "Rebind an installed Muscle agent to this Core with a new token (old Core profile is saved under `axon profiles`):",
  "Warte auf eingehenden mTLS 1.3 + Yamux Server-Handshake...":
    "Waiting for incoming mTLS 1.3 + Yamux peer handshake...",
  "Fertig": "Done",
  "Neuen Projekt-Tresor anlegen": "Create New Project Vault",
  "Projektname (z.B. prod-mesh)": "Project name (e.g. prod-mesh)",
  "Projekt anlegen": "Create Project",
  "Springe zu Übersicht, Server, Regeln, Dienste...":
    "Jump to Overview, Servers, Rules, Services...",
  "Navigieren": "Navigate",
  "Endpunkte (": "Endpoints (",
  "Auf Port :": "On Port :",
  "Kein Endpunkt für diese Kategorie hinterlegt.": "No endpoints registered for this category.",
  "Warte auf Anfrage — klicke oben auf einen Endpunkt oder auf 'Ausführen'.":
    "Waiting for request — click an endpoint above or press 'Execute'.",

  // ── Complete View Headers, Firewall, Access Rules, Audit Log, Canvas & Copilot ──
  "Live-Terminal": "Live Terminal",
  "Copilot ausblenden": "Hide Copilot",
  "Copilot einblenden": "Show Copilot",
  "Noch keine Server verbunden": "No servers connected yet",
  "Online — Klicken zum Verwalten": "Online — Click to manage",
  "Offline — Klicken zum Prüfen": "Offline — Click to inspect",
  "aktive Regeln — Klicken zum Verwalten": "active rules — Click to manage",
  "Einträge im Brain-Tresor": "entries in Brain Vault",
  "Neues Projekt...": "New Project...",
  "Suche": "Search",
  "Mit der Maus ziehen, um die linke Seitenleiste breiter/schmaler zu machen (Doppelklick = Standardbreite)":
    "Drag to resize left sidebar (double-click = default width)",
  "Mit der Maus ziehen, um das KI-Copilot-Panel breiter/schmaler zu machen (Doppelklick = Standardbreite)":
    "Drag to resize AI Copilot panel (double-click = default width)",
  "Topologie-Layout wird gespeichert...": "Saving topology layout...",
  "Ziehe Karten frei auf der Fläche ·": "Drag cards freely on the canvas ·",
  "speichert für alle Ansichten": "saves across all views",
  "Auto-Anordnen": "Auto-Arrange",
  "Alle Knoten übersichtlich im 3-Spalten-Raster anordnen (Core -> Muscle -> Services)":
    "Arrange all nodes cleanly in a 3-column grid (Core -> Muscle -> Services)",
  "Mausrad = Zoom · Leere Fläche ziehen = Schwenken ·":
    "Scroll = Zoom · Drag empty space = Pan ·",
  "verschiebt auch verbundene Dienste": "also moves attached services",
  "Kein Muscle verbunden — klicke oben auf": "No Muscle connected — click",
  "Läuft auf": "Runs on",
  "Brain-Tresor": "Brain Vault",
  "Konfiguriert": "Configured",
  "Bereit": "Ready",
  "Server & Mesh-Netzwerk": "Servers & Mesh Network",
  "Verwalte alle angeschlossenen Muscle-Server, verknüpfe Dienste über verschlüsselte P2P-Mesh-Tunnel oder stelle komplette Infrastruktur-Stacks und Cron-Playbooks per 1-Klick bereit.":
    "Manage all connected Muscle servers, link services across encrypted P2P mesh tunnels, or deploy complete infrastructure stacks and cron playbooks with 1 click.",
  "Alle Stufen": "All Tiers",
  "Host & System": "Host & System",
  "Bereitstellen": "Deploy",
  "Firewall & Port-Abschirmung": "Firewall & Port Shielding",
  "Anti-Lockout & 15s Rollback aktiv": "Anti-Lockout & 15s Rollback active",
  "Sperre offene Ports mit 1 Klick nach außen für das öffentliche Internet, während deine Dienste über den verschlüsselten Synapse-Tunnel (127.0.0.1) weiterhin unter Services erreichbar bleiben.":
    "Block open ports from the public internet with 1 click while keeping your services reachable via the encrypted Synapse tunnel (127.0.0.1) under Services.",
  "Synchronisiere...": "Synchronizing...",
  "Port-Radar scannen": "Scan Port Radar",
  "KI-Beratung": "AI Security Advice",
  "1. 1-Klick Sicherheits-Profile": "1. 1-Click Security Profiles",
  "Aktives Backend:": "Active Backend:",
  "· SSH-Schutz:": "· SSH Protection:",
  "🟢 Web-Server Modus (Standard)": "🟢 Web Server Mode (Standard)",
  "Webseiten offen, interne Dienste geschützt":
    "Websites open, internal services shielded",
  "Erlaubt öffentlich nur SSH (:22) sowie HTTP/HTTPS (:80/:443). Interne Backend- & Datenbank-Ports werden nach außen abgeschirmt.":
    "Publicly allows only SSH (:22) and HTTP/HTTPS (:80/:443). Internal backend & database ports are shielded externally.",
  "🛡️ Synapse Stealth-Modus (Zero-Port)": "🛡️ Synapse Stealth Mode (Zero-Port)",
  "Alle App-Ports nach außen unsichtbar": "All app ports invisible externally",
  "Blockiert alle Anwendungs-Ports für das Internet (nur SSH bleibt als Notfallzugang offen). Alle Apps laufen sicher über den Synapse-Tunnel!":
    "Blocks all application ports from the internet (only SSH remains open for emergency access). All apps run securely over the Synapse tunnel!",
  "⚙️ Benutzerdefiniert": "⚙️ Custom Mode",
  "Einzelne Ports & IPs selbst steuern": "Control individual ports & IPs manually",
  "Entscheide unten im Live Port-Radar für jeden Port einzeln per Klick, ob er öffentlich oder nur über Synapse erreichbar sein soll.":
    "Decide for each port individually in the Live Port Radar below whether it should be publicly accessible or only reachable via Synapse.",
  "Wenn du einen Port „Nach außen sperrst“, wird er für Fremde im Internet blockiert, funktioniert aber unter":
    "When you click 'Block Externally', the port is blocked from the public internet, but continues to work under",
  "im Synapse-Browser weiterhin!": "in the Synapse browser!",
  "Noch keine lauschenden Ports erkannt oder kein Muscle-Server verbunden.":
    "No listening ports detected yet or no Muscle server connected.",
  "Dienst / Programm": "Service / Process",
  "Bind-Adresse": "Bind Address",
  "Sichtbarkeit im Internet": "Internet Exposure",
  "1-Klick Schutz": "1-Click Shield",
  "SSH Server-Zugang (Anti-Lockout)": "SSH Server Access (Anti-Lockout)",
  "🛡️ Geschützter System-Port (SSH)": "🛡️ Protected System Port (SSH)",
  "🟢 Sicher · Nur lokal (127.0.0.1)": "🟢 Safe · Local only (127.0.0.1)",
  "🛡️ Durch Firewall geschützt (Nur Synapse-Tunnel)":
    "🛡️ Shielded by Firewall (Synapse Tunnel only)",
  "🔴 Öffentlich im Internet offen": "🔴 Publicly open on the Internet",
  "Anti-Lockout aktiv": "Anti-Lockout active",
  "Bereits lokal isoliert": "Already locally isolated",
  "Nur über Synapse erreichbar machen (Für das öffentliche Internet sperren)":
    "Make reachable via Synapse only (block from public internet)",
  "Port wieder öffentlich für das gesamte Internet öffnen":
    "Re-open port publicly to the entire internet",
  "🔓 Öffentlich freigeben": "🔓 Allow Publicly",
  "🔒 Nach außen sperren": "🔒 Block Externally",
  "Sperre verdächtige IP-Adressen sofort oder gib bestimmte Ports exklusiv für deine eigene IP-Adresse frei.":
    "Block suspicious IP addresses immediately or whitelist specific ports exclusively for your own IP address.",
  "Vorlage: Angreifer-IP blockieren": "Preset: Block Attacker IP",
  "Vorlage: Eigene IP freigeben": "Preset: Allow Own IP",
  "🚫 IP blockieren (Sperre)": "🚫 Block IP (Deny)",
  "✅ IP erlauben (Whitelist)": "✅ Allow IP (Whitelist)",
  "IP oder CIDR (z.B. 203.0.113.50)": "IP or CIDR (e.g. 203.0.113.50)",
  "Port (leer = Alle Ports)": "Port (empty = All Ports)",
  "Notiz (z.B. Büro-VPN)": "Note (e.g. Office VPN)",
  "+ IP-Regel speichern": "+ Save IP Rule",
  "Noch keine benutzerdefinierten IP-Sperren oder Whitelists eingetragen.":
    "No custom IP blocks or whitelists configured yet.",
  "🚫 BLOCKIERT": "🚫 BLOCKED",
  "✅ ERLAUBT": "✅ ALLOWED",
  "→ Alle Ports": "→ All Ports",
  "IP-Regel entfernen": "Remove IP Rule",
  "Sicherheits-Regeln & KI-Richtlinien (Rule Cartridges)":
    "Security Rules & AI Policies (Rule Cartridges)",
  "Steuere in verständlicher Sprache, welche Sicherheits- und Architektur-Leitplanken der KI-Agent auf deinen Servern strikt einhalten muss. Klicke auf eine Karte, um das Regelwerk aufzuklappen.":
    "Control in plain language which security and architecture guardrails the AI agent must strictly enforce on your servers. Click any card to expand its policy specification.",
  "Neue Regel-Cartridge erstellen": "Create New Rule Cartridge",
  "Vollständiges Regelwerk (.md)": "Full Policy Specification (.md)",
  "Services & Reverse-Proxy Workbench": "Services & Reverse Proxy Workbench",
  "Teste Web-Oberflächen, HTTP-Endpunkte und SQLite-Datenbanken deiner Server direkt im Browser über den verschlüsselten Synapse-Tunnel – auch wenn deren Ports in der Firewall nach außen gesperrt sind.":
    "Test web interfaces, HTTP endpoints, and SQLite databases on your servers directly in the browser over the encrypted Synapse tunnel — even when their ports are blocked externally by the firewall.",
  "Erneut prüfen": "Re-check",
  "Alle Dienste prüfen": "Check All Services",
  "Vollbild beenden": "Exit Fullscreen",
  "Vollbild": "Fullscreen",
  "Brain Vault (Architektur- & System-Gedächtnis)":
    "Brain Vault (Architecture & System Memory)",
  "Das persistente Langzeit-Gedächtnis deines Projekts. Der KI-Orchestrator liest und aktualisiert Architecture.md (Topologie, Ports, Dienste) und Memory.md (Runbooks, gelöste Fehler) vollautomatisch.":
    "The persistent long-term memory of your project. The AI orchestrator automatically reads and updates Architecture.md (topology, ports, services) and Memory.md (runbooks, resolved issues).",
  "Architecture.md (System-Topologie)": "Architecture.md (System Topology)",
  "Memory.md (KI-Erfahrungsschatz)": "Memory.md (AI Engineering Journal)",
  "Vorschau": "Preview",
  "Markdown bearbeiten": "Edit Markdown",
  "Remote-Dateien & Code-Editor": "Remote Files & Code Editor",
  "Durchsuche und bearbeite Dateien direkt im isolierten Server-Workspace (/opt/axon/workspaces) oder wende Unified-Diff-Patches mit automatischem Backup-Schutz an.":
    "Browse and edit files directly inside the isolated server workspace (/opt/axon/workspaces) or apply unified diff patches with automatic backup protection.",
  "Audit-Log & Sicherheits-Ereignisse": "Audit Log & Security Events",
  "Lückenlose Chronik aller KI-Aktionen, Benutzer-Befehle und blockierten Sicherheits-Richtlinien. Klicke auf eine Zeile, um die vollständigen Parameter und Ausgaben aufzuklappen.":
    "Complete chronological trail of all AI actions, user commands, and policy interceptions. Click any row to expand full parameters and outputs.",
  "Audit-Events nach Tool, Server oder Zusammenfassung durchsuchen (Klick auf Zeile erweitert Details)...":
    "Search audit events by tool, server, or summary (click row to expand details)...",
  "System-Einstellungen, Tresor & KI-Konfiguration":
    "System Settings, Vault & AI Configuration",
  "Debug Aktiv": "Debug Active",
  "Produktiv": "Production",
  "Verwalte 1-Klick Over-the-Air System-Updates, Server-Koppelungsschlüssel, den AES-256-GCM Geheimnis-Tresor, KI-Modelle sowie den integrierten System-Selbsttest.":
    "Manage 1-click over-the-air system updates, server enrollment keys, the AES-256-GCM secrets vault, AI models, and the built-in system self-test.",
  "System-Update (OTA)": "System Update (OTA)",
  "Server-Onboarding": "Server Onboarding",
  "Geheimnis-Tresor": "Secrets Vault",
  "KI-Anbieter": "AI Providers",
  "MCP-API": "MCP API",
  "Debug & Selbsttest": "Debug & Self-Test",
  "Sprache": "Language",
  "UI-Sprache & Internationalisierung (i18n)":
    "UI Language & Internationalization (i18n)",
  "Wähle die Anzeigesprache für das gesamte Synapse Control Center. Weitere Sprachen können jederzeit über das zentrale Sprach-Register ergänzt werden.":
    "Choose the display language for the entire Synapse Control Center. Additional languages can be registered anytime via the central locale registry.",
  "Tipp: Du kannst die Sprache auch jederzeit über den Schnellschalter oben rechts in der Kopfzeile zwischen":
    "Tip: You can also switch the language anytime using the quick toggle in the top-right header bar between",
  "umschalten.": ".",
  "Interaktiver Schritt-für-Schritt Assistent":
    "Interactive Step-by-Step Assistant",
  "Geführter Einrichtungs-Dialog": "Guided Setup Dialog",
  "Eigenen Wunsch eingeben": "Enter custom answer",
  "Überspringen & Direkt umsetzen": "Skip & Execute Directly",
  "Eigene Antwort oder Details eingeben...":
    "Enter custom answer or details...",
  "Weiter": "Continue",
  "Was bedeutet das konkret?": "What does this mean in practice?",
  "Ergebnisse kopieren": "Copy Results",
  "Abschnitt kopieren": "Copy Section",
  "Autonomer Microservice :4050": "Autonomous Microservice :4050",
  "VPS2 Status-API": "VPS2 Status API",
  "Pulse Analytics-API": "Pulse Analytics API",
  "Pulse SQLite-Datenbank": "Pulse SQLite Database",
  "Pulse Live-WebUI": "Pulse Live WebUI",
  "Web-Oberfläche": "WebUI",
  "Backend-API": "Backend API",
  "Docker-First Bereitstellung": "Docker-First Deployment",
  "Zero-Trust Netzwerk": "Zero-Trust Networking",
  "Auto-TLS & Reverse-Proxy": "Auto-TLS & Reverse Proxy",
  "Bare-Metal & Systemd": "Bare-Metal Systemd",
  "Strikte Sicherheits- & Telemetrie-Header":
    "Strict Security & Telemetry Headers",
  "Verfügbare Aktionen & Endpunkte": "Available Actions & Endpoints",
  "Alle Regeln →": "All Rules →",
  "SPEICHER": "DISK",
  "GET / (Übersicht)": "GET / (Overview)",
  "POST / (JSON-Daten senden)": "POST / (Send JSON Input)",
  "GET / (Dienst-Status)": "GET / (Service Status)",
  "GET / (API-Status)": "GET / (API Status)",
  "POST /api/events (Event hinzufügen)": "POST /api/events (Add Event)",
  "SQL: pulse.db untersuchen": "SQL: Inspect pulse.db",
  "Tabellen anzeigen (SQLite)": "Show Tables (SQLite)",
  "Neueste Einträge abfragen": "Query Latest Rows",
  "Test-Eintrag einfügen (SQL)": "Insert Test Row (SQL)",
  "Verifizierte Multi-Core Produktions-Basis": "Verified Multi-Core Production Baseline",
  "24/7 Wächter & Alarm-Engine aktiv": "24/7 Watchdog & Alert Engine Armed",
  "Test-Push-Benachrichtigung": "Test Push Notification",
  "Manueller Server-Snapshot": "Manual Server Snapshot",
};

/**
 * German Dictionary (Translating any English UI strings -> German)
 */
const DE_DICTIONARY: Record<string, string> = {
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
  "Manual Snapshot (vps2-muscle)": "Manueller Snapshot (vps2-muscle)",
};

const EN_PATTERNS: PatternRule[] = [
  { match: /^Alle \((\d+)\)$/, replace: "All ($1)" },
  { match: /^KI-Antworten \((\d+)\)$/, replace: "AI Replies ($1)" },
  { match: /^Aktionen \((\d+)\)$/, replace: "Actions ($1)" },
  { match: /^🛠️ (\d+) Schritt$/, replace: "🛠️ $1 step" },
  { match: /^🛠️ (\d+) Schritte$/, replace: "🛠️ $1 steps" },
  { match: /^🛠️ Alle \((\d+)\)$/, replace: "🛠️ All ($1)" },
  { match: /^📁 Dateien \((\d+)\)$/, replace: "📁 Files ($1)" },
  { match: /^(\d+) Themenbereiche$/, replace: "$1 Topic Sections" },
  { match: /^Sektion (\d+)$/, replace: "Section $1" },
  { match: /^(\d+) Zeile$/, replace: "$1 line" },
  { match: /^(\d+) Zeilen$/, replace: "$1 lines" },
  { match: /^Alle (\d+) Zeilen$/, replace: "All $1 lines" },
  { match: /^(\d+) Regeln aktiv$/, replace: "$1 Rules active" },
  { match: /^(\d+) online$/, replace: "$1 online" },
  { match: /^Aktuell \((.+)\)$/, replace: "Up to date ($1)" },
  {
    match: /^Update verfügbar \(\+(\d+) Commits?\)$/,
    replace: "Update available (+$1 commits)",
  },
  {
    match: /^\((\d+) Commits? voraus\)$/,
    replace: "($1 commits ahead)",
  },
  {
    match: /^Verbundene Muscle-Knoten \((\d+)\)$/,
    replace: "Connected Muscle Nodes ($1)",
  },
  {
    match: /^Registrierte Dienste \((\d+)\)$/,
    replace: "Registered Services ($1)",
  },
  {
    match: /^Vollständiger Audit-Eintrag \((.+)\)$/,
    replace: "Full Audit Entry ($1)",
  },
  {
    match: /^Antwort \((.+)\)$/,
    replace: "Response ($1)",
  },
  {
    match: /^Pfad auf :(\d+)$/,
    replace: "Path on :$1",
  },
  {
    match: /^OTA-Update auf (.+)\.\.\.$/,
    replace: "Running OTA update on $1...",
  },
  {
    match: /^Skill ausgewählt:\s*(.+)$/,
    replace: "Skill selected: $1",
  },
  {
    match: /^Optional: Eigenen Fokus für (.+) ergänzen\.\.\.$/,
    replace: "Optional: Add custom focus for $1...",
  },
  {
    match: /^Von außen erreichbare Dienste \((\d+)\):$/,
    replace: "Externally reachable services ($1):",
  },
  {
    match: /^Senior DevOps KI-Analyse läuft \((\d+) Schritte · (\d+)s\)\.\.\.$/,
    replace: "Senior DevOps AI analysis running ($1 steps · $2s)...",
  },
  {
    match: /^🛡️ Auto-Watchdog \((\d+)x\)$/,
    replace: "🛡️ Auto-Watchdog ($1x)",
  },
  {
    match: /^Verschlüsselter Tresor \((\d+)\)$/,
    replace: "Encrypted Vault ($1)",
  },
  {
    match: /^Externe KI \/ MCP-API \((\d+)\)$/,
    replace: "External AI / MCP API ($1)",
  },
  {
    match: /^Debug & Selbsttest \(AKTIV\)$/,
    replace: "Debug & Self-Test (ON)",
  },
  {
    match: /^Debug & Selbsttest \(AUS\)$/,
    replace: "Debug & Self-Test (OFF)",
  },
  {
    match: /^Ausstehende Tier-3-Freigaben \((\d+)\)$/,
    replace: "Pending Tier-3 Supervised Approvals ($1)",
  },
  {
    match: /^Endpunkte \((\d+)\)$/,
    replace: "Endpoints ($1)",
  },
  {
    match: /^Auf Port :(\d+)\.\.\.$/,
    replace: "On Port :$1...",
  },
  {
    match: /^FW · (\d+) gesperrt$/,
    replace: "FW · $1 shielded",
  },
  {
    match: /^2\. Live Port-Radar \((\d+) aktive Ports auf (.+)\)$/,
    replace: "2. Live Port Radar ($1 active ports on $2)",
  },
  {
    match: /^🔴 (\d+) Öffentlich offen$/,
    replace: "🔴 $1 Publicly open",
  },
  {
    match: /^🛡️ (\d+) Durch Firewall geschützt$/,
    replace: "🛡️ $1 Shielded by Firewall",
  },
  {
    match: /^🟢 (\d+) Nur lokal \(127\.0\.0\.1\)$/,
    replace: "🟢 $1 Local only (127.0.0.1)",
  },
  {
    match: /^Prozess: (.+)$/,
    replace: "Process: $1",
  },
  {
    match: /^3\. IP-Blocker & Whitelist \((\d+) Regeln\)$/,
    replace: "3. IP Blocker & Whitelist ($1 Rules)",
  },
  {
    match: /^(\d+) von (\d+) aktiv$/,
    replace: "$1 of $2 active",
  },
  {
    match: /^(\d+) Dienste aktiv$/,
    replace: "$1 Services active",
  },
  {
    match: /^(\d+) von (\d+) Einträgen$/,
    replace: "$1 of $2 entries",
  },
  {
    match: /^Optionaler Fokus für (.+)\.\.\.$/,
    replace: "Optional focus for $1...",
  },
  {
    match: /^IP-Regel für (.+) wurde entfernt\.$/,
    replace: "IP rule for $1 removed.",
  },
  {
    match: /^IP (.+) wurde erfolgreich blockiert\.$/,
    replace: "IP $1 blocked successfully.",
  },
  {
    match: /^IP (.+) wurde erfolgreich freigegeben\.$/,
    replace: "IP $1 whitelisted successfully.",
  },
  {
    match: /^Datenbank · (.+)$/,
    replace: "Database · $1",
  },
  {
    match: /^Backend-API · (.+)$/,
    replace: "Backend API · $1",
  },
  {
    match: /^Web-Oberfläche · (.+)$/,
    replace: "WebUI · $1",
  },
  {
    match: /^(.+) · Stufe (\d+)$/,
    replace: "$1 · Tier $2",
  },
  {
    match: /^Erreichbare Backend-REST-API über den Synapse Reverse-Proxy \((.+)\)$/,
    replace: "Reachable Backend REST API via Synapse Reverse Proxy ($1)",
  },
  {
    match: /^Interaktive Datenbank & Speicher-Engine auf (.+) \((.+)\)$/,
    replace: "Interactive Database & Storage Engine on $1 ($2)",
  },
  {
    match: /^Interaktive Web-Oberfläche über den Synapse Reverse-Proxy erreichbar \((.+)\)$/,
    replace:
      "Interactive WebUI reachable from outside via Synapse Reverse Proxy ($1)",
  },
];

const DE_PATTERNS: PatternRule[] = [
  { match: /^All \((\d+)\)$/, replace: "Alle ($1)" },
  { match: /^AI Replies \((\d+)\)$/, replace: "KI-Antworten ($1)" },
  { match: /^Actions \((\d+)\)$/, replace: "Aktionen ($1)" },
  { match: /^🛠️ (\d+) step$/, replace: "🛠️ $1 Schritt" },
  { match: /^🛠️ (\d+) steps$/, replace: "🛠️ $1 Schritte" },
  { match: /^🛠️ All \((\d+)\)$/, replace: "🛠️ Alle ($1)" },
  { match: /^📁 Files \((\d+)\)$/, replace: "📁 Dateien ($1)" },
  { match: /^(\d+) Topic Sections$/, replace: "$1 Themenbereiche" },
  { match: /^Section (\d+)$/, replace: "Sektion $1" },
  { match: /^(\d+) line$/, replace: "$1 Zeile" },
  { match: /^(\d+) lines$/, replace: "$1 Zeilen" },
  { match: /^All (\d+) lines$/, replace: "Alle $1 Zeilen" },
  { match: /^(\d+) Rules active$/, replace: "$1 Regeln aktiv" },
  { match: /^FW · (\d+) shielded$/, replace: "FW · $1 gesperrt" },
  {
    match: /^Database · (.+)$/,
    replace: "Datenbank · $1",
  },
  {
    match: /^Backend API · (.+)$/,
    replace: "Backend-API · $1",
  },
  {
    match: /^WebUI · (.+)$/,
    replace: "Web-Oberfläche · $1",
  },
  {
    match: /^(.+) · Tier (\d+)$/,
    replace: "$1 · Stufe $2",
  },
  {
    match: /^Reachable Backend REST API via Synapse Reverse Proxy \((.+)\)$/,
    replace:
      "Erreichbare Backend-REST-API über den Synapse Reverse-Proxy ($1)",
  },
  {
    match: /^Interactive Database & Storage Engine on (.+) \((.+)\)$/,
    replace: "Interaktive Datenbank & Speicher-Engine auf $1 ($2)",
  },
  {
    match: /^Interactive WebUI reachable from outside via Synapse Reverse Proxy \((.+)\)$/,
    replace:
      "Interaktive Web-Oberfläche über den Synapse Reverse-Proxy erreichbar ($1)",
  },
  {
    match: /^2\. Live Port Radar \((\d+) active ports on (.+)\)$/,
    replace: "2. Live Port-Radar ($1 aktive Ports auf $2)",
  },
  {
    match: /^🔴 (\d+) Publicly open$/,
    replace: "🔴 $1 Öffentlich offen",
  },
  {
    match: /^🛡️ (\d+) Shielded by Firewall$/,
    replace: "🛡️ $1 Durch Firewall geschützt",
  },
  {
    match: /^🟢 (\d+) Local only \(127\.0\.0\.1\)$/,
    replace: "🟢 $1 Nur lokal (127.0.0.1)",
  },
  {
    match: /^Process: (.+)$/,
    replace: "Prozess: $1",
  },
  {
    match: /^3\. IP Blocker & Whitelist \((\d+) Rules\)$/,
    replace: "3. IP-Blocker & Whitelist ($1 Regeln)",
  },
  {
    match: /^(\d+) of (\d+) active$/,
    replace: "$1 von $2 aktiv",
  },
  {
    match: /^(\d+) Services active$/,
    replace: "$1 Dienste aktiv",
  },
  {
    match: /^(\d+) of (\d+) entries$/,
    replace: "$1 von $2 Einträgen",
  },
  {
    match: /^Optional focus for (.+)\.\.\.$/,
    replace: "Optionaler Fokus für $1...",
  },
  {
    match: /^Encrypted Vault \((\d+)\)$/,
    replace: "Verschlüsselter Tresor ($1)",
  },
  {
    match: /^External AI \/ MCP API \((\d+)\)$/,
    replace: "Externe KI / MCP-API ($1)",
  },
  {
    match: /^Debug & Self-Test \(ON\)$/,
    replace: "Debug & Selbsttest (AKTIV)",
  },
  {
    match: /^Debug & Self-Test \(OFF\)$/,
    replace: "Debug & Selbsttest (AUS)",
  },
  {
    match: /^Test `tools\/list` \((\d+) Tools\)$/,
    replace: "Teste `tools/list` ($1 Tools)",
  },
  {
    match: /^Test `resources\/list`$/,
    replace: "Teste `resources/list`",
  },
  {
    match: /^Call `synapse_get_project_state`$/,
    replace: "Rufe `synapse_get_project_state` auf",
  },
  {
    match: /^Vault \((\d+)\)$/,
    replace: "Tresor ($1)",
  },
  {
    match: /^Pending Tier-3 Supervised Approvals \((\d+)\)$/,
    replace: "Ausstehende Tier-3-Freigaben ($1)",
  },
  {
    match: /^(\d+) Active Topology Link\(s\)$/,
    replace: "$1 aktive Topologie-Verknüpfung(en)",
  },
];

// Ensure DE_DICTIONARY also contains all reverse mappings (EN -> DE) from EN_DICTIONARY
for (const [deKey, enVal] of Object.entries(EN_DICTIONARY)) {
  if (enVal && !DE_DICTIONARY[enVal]) {
    DE_DICTIONARY[enVal] = deKey;
  }
}

/**
 * Central extensible registry of supported UI languages.
 * To add a new language in the future (e.g., "fr", "es", "nl"), simply register a new LocaleDefinition here
 * or call `registerLocale(...)` at runtime.
 */
export const LOCALE_REGISTRY: Record<string, LocaleDefinition> = {
  de: {
    code: "de",
    label: "German",
    nativeLabel: "Deutsch",
    shortCode: "DE",
    flag: "🇩🇪",
    htmlLang: "de",
    dictionary: DE_DICTIONARY,
    patterns: DE_PATTERNS,
  },
  en: {
    code: "en",
    label: "English",
    nativeLabel: "English",
    shortCode: "EN",
    flag: "🇬🇧",
    htmlLang: "en",
    dictionary: EN_DICTIONARY,
    patterns: EN_PATTERNS,
  },
};

export function registerLocale(definition: LocaleDefinition) {
  LOCALE_REGISTRY[definition.code] = definition;
}

export function translateStringForLocale(
  raw: string,
  locale: LocaleCode
): string {
  if (!raw) return raw;
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return raw;

  const def = LOCALE_REGISTRY[locale] || LOCALE_REGISTRY.de;

  // 1. Exact match in active locale dictionary
  if (def.dictionary[trimmed]) {
    const leading = raw.match(/^\s*/)?.[0] || "";
    const trailing = raw.match(/\s*$/)?.[0] || "";
    return `${leading}${def.dictionary[trimmed]}${trailing}`;
  }

  // 2. Pattern match in active locale
  for (const rule of def.patterns) {
    if (rule.match.test(trimmed)) {
      const replaced = trimmed.replace(rule.match, rule.replace);
      const leading = raw.match(/^\s*/)?.[0] || "";
      const trailing = raw.match(/\s*$/)?.[0] || "";
      return `${leading}${replaced}${trailing}`;
    }
  }

  return raw;
}

interface I18nContextValue {
  locale: LocaleCode;
  setLocale: (next: LocaleCode) => void;
  locales: LocaleDefinition[];
  /** Inline multilingual helper: `t("Übersicht", "Overview", { fr: "Aperçu" })` */
  t: (
    deText: string,
    enText: string,
    extraLocales?: Record<string, string>
  ) => string;
  translateText: (raw: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "de",
  setLocale: () => {},
  locales: Object.values(LOCALE_REGISTRY),
  t: (deText) => deText,
  translateText: (raw) => raw,
});

export function useI18n() {
  return useContext(I18nContext);
}

const STORAGE_KEY = "synapse_ui_locale";

interface SynchronizedTextNode extends Text {
  __synapseOrigText?: string;
  __synapseLastApplied?: string;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>("de");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && LOCALE_REGISTRY[saved]) {
        setLocaleState(saved);
      }
    }
  }, []);

  const setLocale = useCallback((next: LocaleCode) => {
    if (!LOCALE_REGISTRY[next]) return;
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = LOCALE_REGISTRY[next].htmlLang;
    }
  }, []);

  const t = useCallback(
    (
      deText: string,
      enText: string,
      extraLocales?: Record<string, string>
    ): string => {
      if (locale === "de") return deText;
      if (locale === "en") return enText;
      if (extraLocales && extraLocales[locale]) {
        return extraLocales[locale];
      }
      return translateStringForLocale(deText, locale) || enText;
    },
    [locale]
  );

  const translateText = useCallback(
    (raw: string) => translateStringForLocale(raw, locale),
    [locale]
  );

  // Automatic DOM Synchronizer so every button, badge, header, modal, placeholder & tooltip switches language seamlessly
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang =
      LOCALE_REGISTRY[locale]?.htmlLang || locale;

    let isApplying = false;

    const shouldSkipElement = (el: Element | null): boolean => {
      if (!el) return true;
      const tag = el.tagName;
      if (
        tag === "SCRIPT" ||
        tag === "STYLE" ||
        tag === "CODE" ||
        tag === "TEXTAREA"
      ) {
        return true;
      }
      if (tag === "PRE") {
        const txt = (el.textContent || "").trim();
        if (
          txt === "Klicke links auf eine Option oder auf 'Ausführen'." ||
          txt === "Click an option on the left or press 'Execute'." ||
          txt ===
            "Click 'Refresh' or 'Run 5-Step Self-Test' to inspect live Core & Gateway state." ||
          txt ===
            "Klicke auf 'Aktualisieren' oder '5-Stufen-Selbsttest starten', um den Live-Status zu prüfen."
        ) {
          return false;
        }
        return true;
      }
      if (
        el.closest(
          "pre, code, .xterm, [data-no-i18n='true']"
        )
      ) {
        return true;
      }
      return false;
    };

    const syncSubtree = (root: Node) => {
      if (isApplying) return;
      isApplying = true;
      try {
        const walker = document.createTreeWalker(
          root,
          NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
        );

        let current: Node | null = walker.currentNode;
        while (current) {
          if (current.nodeType === Node.TEXT_NODE) {
            const textNode = current as SynchronizedTextNode;
            const parent = textNode.parentElement;
            if (!shouldSkipElement(parent)) {
              const currentVal = textNode.nodeValue || "";
              if (
                textNode.__synapseOrigText === undefined ||
                (textNode.__synapseLastApplied !== undefined &&
                  currentVal !== textNode.__synapseLastApplied)
              ) {
                // React updated the underlying text node -> capture new canonical original text
                textNode.__synapseOrigText = currentVal;
              }
              const orig = textNode.__synapseOrigText;
              if (orig && orig.trim().length > 1) {
                const nextVal = translateStringForLocale(orig, locale);
                if (nextVal !== currentVal) {
                  textNode.nodeValue = nextVal;
                }
                textNode.__synapseLastApplied = nextVal;
              }
            }
          } else if (current.nodeType === Node.ELEMENT_NODE) {
            const el = current as HTMLElement;
            for (const attr of ["placeholder", "title", "aria-label"]) {
              const val = el.getAttribute(attr);
              if (val) {
                const origAttrKey = `data-synapse-orig-${attr}`;
                const lastAttrKey = `data-synapse-last-${attr}`;
                let orig = el.getAttribute(origAttrKey);
                const lastApplied = el.getAttribute(lastAttrKey);
                if (!orig || (lastApplied && val !== lastApplied)) {
                  orig = val;
                  el.setAttribute(origAttrKey, orig);
                }
                const nextVal = translateStringForLocale(orig, locale);
                if (nextVal !== val) {
                  el.setAttribute(attr, nextVal);
                }
                el.setAttribute(lastAttrKey, nextVal);
              }
            }
          }
          current = walker.nextNode();
        }
      } finally {
        isApplying = false;
      }
    };

    syncSubtree(document.body);

    const observer = new MutationObserver((mutations) => {
      if (isApplying) return;
      for (const m of mutations) {
        if (m.type === "childList") {
          m.addedNodes.forEach((n) => syncSubtree(n));
        } else if (m.type === "characterData" && m.target) {
          syncSubtree(m.target);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      locales: Object.values(LOCALE_REGISTRY),
      t,
      translateText,
    }),
    [locale, setLocale, t, translateText]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Compact, extensible Language Switcher Pill for the Top Header Bar & Settings
 * Automatically renders all registered languages from `LOCALE_REGISTRY`.
 */
export function LanguageSwitcher({
  variant = "header",
}: {
  variant?: "header" | "settings";
}) {
  const { locale, setLocale, locales } = useI18n();

  if (variant === "settings") {
    return (
      <div className="flex flex-wrap items-center gap-2" data-no-i18n="true">
        {locales.map((loc) => {
          const active = locale === loc.code;
          return (
            <button
              key={loc.code}
              type="button"
              onClick={() => setLocale(loc.code)}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition ${
                active
                  ? "border-netbird bg-netbird/20 text-white shadow-sm"
                  : "border-nb-gray-800 bg-nb-gray-950 text-nb-gray-300 hover:border-nb-gray-700 hover:text-white"
              }`}
            >
              <span className="text-sm">{loc.flag}</span>
              <span>{loc.nativeLabel}</span>
              <span className="rounded bg-nb-gray-900 px-1.5 py-0.2 font-mono text-[10px] text-nb-gray-400">
                {loc.shortCode}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="flex h-8 items-center rounded-lg border border-nb-gray-800/80 bg-nb-gray-930 text-xs font-medium"
      style={{ paddingLeft: "10px", paddingRight: "4px", gap: "4px" }}
      data-no-i18n="true"
      title={
        locale === "de"
          ? "Sprache wechseln (Deutsch / English)"
          : "Switch language (Deutsch / English)"
      }
    >
      <Globe
        className="h-3.5 w-3.5 text-nb-gray-400 shrink-0"
        style={{ marginRight: "4px" }}
      />
      {locales.map((loc) => {
        const active = locale === loc.code;
        return (
          <button
            key={loc.code}
            type="button"
            onClick={() => setLocale(loc.code)}
            style={{ height: "22px", paddingLeft: "9px", paddingRight: "9px" }}
            className={`flex items-center justify-center rounded-md font-mono text-[11px] font-semibold leading-none transition-colors ${
              active
                ? "bg-netbird text-white shadow-sm"
                : "text-nb-gray-400 hover:text-white"
            }`}
          >
            {loc.shortCode}
          </button>
        );
      })}
    </div>
  );
}
