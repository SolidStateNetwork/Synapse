import type { PatternRule } from "../i18n";

export const EN_PATTERNS: PatternRule[] = [
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
  {
    match: /^Benutzerdefinierter (.+)-Dienst bereitgestellt auf (.+)$/,
    replace: "Custom $1 service deployed on $2",
  },
  {
    match: /^Autonomer Microservice( :(\d+))?$/,
    replace: "Autonomous Microservice$1",
  },
  {
    match: /^JSON-Metrik-Collector( :(\d+))?$/,
    replace: "JSON Telemetry Collector$1",
  },
  {
    match: /^Uptime- & Latenz-Beacon( :(\d+))?$/,
    replace: "Uptime & Latency Beacon$1",
  },
  {
    match: /^\+\s*Autonomer Microservice :(\d+)$/,
    replace: "+ Autonomous Microservice :$1",
  },
  {
    match: /^(GET\s+)?\/ \(Status- & Telemetrie-JSON\)$/,
    replace: "$1/ (Status & Telemetry JSON)",
  },
  {
    match: /^(GET\s+)?\/health \(Health-Check\)$/,
    replace: "$1/health (Health Check)",
  },
  {
    match: /^(GET\s+)?\/ \(SQLite-Einträge JSON\)$/,
    replace: "$1/ (SQLite Items JSON)",
  },
  {
    match: /^(POST\s+)?\/ \(JSON-Daten senden\)$/,
    replace: "$1/ (Send JSON Input)",
  },
];

export const DE_PATTERNS: PatternRule[] = [
  {
    match: /^Custom (.+) service deployed on (.+)$/,
    replace: "Benutzerdefinierter $1-Dienst bereitgestellt auf $2",
  },
  {
    match: /^Autonomous Microservice( :(\d+))?$/,
    replace: "Autonomer Microservice$1",
  },
  {
    match: /^Uptime & Latency Beacon( :(\d+))?$/,
    replace: "Uptime- & Latenz-Beacon$1",
  },
  {
    match: /^\+\s*Autonomous Microservice :(\d+)$/,
    replace: "+ Autonomer Microservice :$1",
  },
  {
    match: /^(GET\s+)?\/ \(Status & Telemetry JSON\)$/,
    replace: "$1/ (Status- & Telemetrie-JSON)",
  },
  {
    match: /^(GET\s+)?\/health \(Health Check\)$/,
    replace: "$1/health (Health-Check)",
  },
  {
    match: /^(GET\s+)?\/ \(SQLite Items JSON\)$/,
    replace: "$1/ (SQLite-Einträge JSON)",
  },
  {
    match: /^(POST\s+)?\/ \(Send JSON Input\)$/,
    replace: "$1/ (JSON-Daten senden)",
  },
  {
    match: /^(GET\s+)?\/ \(Overview\)$/,
    replace: "$1/ (Übersicht)",
  },
  {
    match: /^(GET\s+)?\/ \(Service Status\)$/,
    replace: "$1/ (Service-Status)",
  },
  {
    match: /^(POST\s+)?\/api\/events \(Add Event\)$/,
    replace: "$1/api/events (Ereignis senden)",
  },
  {
    match: /^Lightweight JSON health and latency telemetry beacon running on port (\d+)\.$/,
    replace: "Leichtgewichtiger JSON-Health- und Latenz-Telemetrie-Beacon auf Port $1.",
  },
  {
    match: /^\[([^\]]+)\] Autonomous Watchdog inspected (.+)$/,
    replace: "[$1] Autonomer Wächter hat $2 geprüft",
  },
  {
    match: /^\[([^\]]+)\] Self-Healing Runbook executed: (.+)$/,
    replace: "[$1] Self-Healing-Runbook ausgeführt: $2",
  },
  {
    match: /^Reachable Frontend Dashboard with interactive status & action endpoints$/,
    replace: "Erreichbares Frontend-Dashboard mit interaktiven Status- & Aktions-Endpunkten",
  },
  {
    match: /^Interactive SQLite Database Explorer reachable from Core UI$/,
    replace: "Interaktiver SQLite-Datenbank-Explorer über die Core-UI erreichbar",
  },
  {
    match: /^(GET\s+)?Open Dashboard$/,
    replace: "$1Dashboard öffnen",
  },
  {
    match: /^(GET\s+)?Live Status$/,
    replace: "$1Live-Status",
  },
  {
    match: /^(POST\s+)?Refresh Widgets$/,
    replace: "$1Widgets aktualisieren",
  },
  {
    match: /^(SQL\s+)?List Tables$/,
    replace: "$1Tabellen auflisten",
  },
  {
    match: /^(SQL\s+)?Query Events$/,
    replace: "$1Events abfragen",
  },
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
  {
    match: /^Resilience simulation completed for (.+) on (.+) \((.+)\)\.$/,
    replace: "Resilienz-Simulation für $1 auf $2 erfolgreich abgeschlossen ($3).",
  },
  {
    match: /^Resilience simulation completed in (\d+) ms \((.+)\)\.$/,
    replace: "Resilienz-Simulation abgeschlossen in $1 ms ($2).",
  },
  {
    match: /^Chaos-Test Auto-Healed: (.+)$/,
    replace: "Chaos-Test Selbstheilung: $1",
  },
  {
    match: /^24\/7 Proactive Watchdog verified (\d+) services across all Muscle peers \(all healthy\)\.$/,
    replace: "Proaktiver 24/7-Wächter hat $1 Dienste auf allen Muscle-Servern geprüft (alle gesund).",
  },
];

