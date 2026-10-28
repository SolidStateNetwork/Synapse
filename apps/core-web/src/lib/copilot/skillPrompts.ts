import { ProjectState } from "@/types/synapse";

export function detectInputLang(
  sample: string,
  fallbackLocale: string = "de"
): "de" | "en" {
  const trimmed = (sample || "").trim();
  if (!trimmed) return fallbackLocale === "en" ? "en" : "de";
  const deWords =
    (
      trimmed.match(
        /\b(wie|was|warum|wo|wann|bitte|zeig|zeige|prüf|prüfe|teste|finde|suche|erkläre|erstelle|baue|behebe|aktualisiere|ist|sind|nicht|und|oder|für|mit|auf|dem|den|der|die|das|ein|eine|meine|deine|alle|servern|dienste|dateien)\b/gi
      ) || []
    ).length + (/[äöüß]/i.test(trimmed) ? 2 : 0);
  const enWords = (
    trimmed.match(
      /\b(what|how|why|where|when|who|can|could|would|should|please|show|check|test|find|search|list|explain|tell|give|help|create|deploy|build|fix|update|is|are|do|does|the|with|from|for|and|all|my|your|our|servers|services|ports|files)\b/gi
    ) || []
  ).length;
  if (enWords > deWords) return "en";
  if (deWords > enWords) return "de";
  return fallbackLocale === "en" ? "en" : "de";
}

export function getLangInstruction(promptLang: "de" | "en"): string {
  return promptLang === "en"
    ? "IMPORTANT LANGUAGE RULE: Respond thoroughly and accurately in ENGLISH."
    : "WICHTIGE SPRACHREGEL: Antworte ausführlich und präzise auf DEUTSCH.";
}

export function buildSkillSearchPrompt(opts: {
  projectId: string;
  node: string;
  text: string;
  promptLang: "de" | "en";
}): { prompt: string; displayMsg: string } {
  const { projectId, node, text, promptLang } = opts;
  const langInstruction = getLangInstruction(promptLang);
  const searchQuery =
    text ||
    (promptLang === "en"
      ? "Give me a complete overview of all UI features as well as all files, databases, ports, and services on the server."
      : "Gib mir eine vollständige Übersicht über alle Funktionen in der UI sowie alle Dateien, Datenbanken, Ports und Dienste auf dem Server.");
  const prompt = [
    `Du führst jetzt den erweiterten DevOps-Such-Skill **SkillSearch** (Vollständige System-, Code-, Log-, Datenbank- & UI-Tiefensuche) für das Projekt \`${projectId}\` auf \`@${node}\` aus.`,
    `SUCHANFRAGE DES NUTZERS: "${searchQuery}"`,
    ``,
    `ARBEITE WIE EIN ERFAHRENER SENIOR DEVOPS ENGINEER: Nimm dir so viele Schritte und Tool-Aufrufe wie nötig, um sowohl in der Synapse-Oberfläche als auch live auf dem Server (\`@${node}\`) und im Core Brain Vault nach allem zu suchen, was zur Anfrage passt:`,
    `1. **Erweiterte Live-Suchwerkzeuge einsetzen (PFLICHT, wenn nach Code, Funktionen, Ports, DBs, Dateien, Logs oder Konfigurationen gefragt wird):**`,
    `   - Nutze \`core_vault_search\` (\`scope: "all"\`), um \`State.json\`, \`Architecture.md\`, \`Memory.md\`, \`Audit.jsonl\`, Cartridges und registrierte Services zu durchsuchen.`,
    `   - Nutze \`node_deep_search\` mit \`search_mode: "file_find"\` und \`search_mode: "content_grep"\`, um Dateien, Quellcode, Endpunkte, Funktionen oder Konfigurationswerte auf \`@${node}\` exakt (mit Dateipfad & Zeilennummer) zu lokalisieren.`,
    `   - Nutze bei Bedarf \`node_deep_search\` mit \`search_mode: "process_and_port_map"\`, \`"sqlite_inspect"\` oder \`"log_scan"\`, falls die Suche Ports, Prozesse, Datenbank-Tabellen oder Logs betrifft.`,
    `2. **Komplette Sitemap der Synapse Core WebUI (für UI-Navigation):**`,
    `   - **Linke Sidebar -> Übersicht (Control Center Canvas):** Interaktive Topologie-Karte mit Server-Knoten (links), Synapse Core Hub (Mitte) und erreichbaren Services (rechts). Ein Klick auf ein Element öffnet rechts das Detail-Menü.`,
    `   - **Linke Sidebar -> Services (Reverse Proxy & DB-Tester):** Obere Reiter für jeden registrierten Dienst (WebUI, Backend API, SQLite DB). Links klickbare Endpunkt-/SQL-Optionen, rechts der Live-Request-Tester sowie der Umschalter zur **Web-Vorschau**.`,
    `   - **Linke Sidebar -> Server & Mesh:** 4 Unter-Tabs: **Server** (Autonomy Tier ändern, Terminal öffnen, Server verbinden), **P2P Mesh-Links** (Direkt-Tunnel zwischen zwei Servern), **Stack-Blueprints** (1-Klick Vorlagen) und **Cron-Playbooks** (Geplante KI-Aufgaben).`,
    `   - **Linke Sidebar -> Brain Vault:** \`Architecture.md\` (Systemarchitektur & Mermaid-Graph), \`Memory.md\` (Technisches Logbuch) und \`Secrets.enc\` (AES-256-GCM verschlüsselter Key-Tresor).`,
    `   - **Linke Sidebar -> Dateien:** Remote-Dateimanager & Code-Editor direkt auf dem verbundenen Muscle-Server (\`/opt/axon/workspaces/...\`) inkl. 1-Klick Snapshot-Rollback.`,
    `   - **Linke Sidebar -> Regeln:** Sicherheits-Cartridges (\`docker-first\`, \`zero-trust-networking\`, \`strict-security-telemetry-headers\`), eigene Policy-Cartridges sowie Freigabe-Warteschlange für \`TIER_3_SUPERVISED\`-Befehle.`,
    `   - **Linke Sidebar -> Audit-Log:** Chronologisches Protokoll aller KI- und Benutzer-Aktionen.`,
    `   - **Linke Sidebar -> Einstellungen:** KI-Provider/Modell & API-Key, Prompt-Caching & Auto-Watchdog, externe **MCP-Server API-Keys** sowie Debug-Selbsttest.`,
    `   - **Untere Leiste -> Live Peer PTY Shell:** Ausklappbares Echtzeit-Linux-Terminal direkt auf dem Muscle-Server.`,
    ``,
    langInstruction,
  ].join("\n");

  const displayMsg = `🧭 **[Skill: SkillSearch]** ${searchQuery}`;
  return { prompt, displayMsg };
}

export function buildCheckSystemPrompt(opts: {
  activeProject: ProjectState;
  node: string;
  text: string;
  promptLang: "de" | "en";
}): { prompt: string; displayMsg: string } {
  const { activeProject, node, text, promptLang } = opts;
  const langInstruction = getLangInstruction(promptLang);
  const svcsList =
    (activeProject.registered_services || [])
      .map(
        (s) =>
          `${s.name} (${s.category || "backend"} auf ${s.node_id}:${s.port}, Pfad: ${s.path || "/"}, DB: ${s.db_path || "keine"})`
      )
      .join("; ") || "keine registrierten Services";

  const prompt = [
    `Du führst jetzt den erweiterten Skill **CheckSystem** (Tiefgreifende, mehrstufige Senior-DevOps-Gesamtsystemanalyse) für das Projekt \`${activeProject.project_id}\` auf \`@${node}\` aus.`,
    text ? `ZUSÄTZLICHER BENUTZER-FOKUS / ANWEISUNG: "${text}"` : ``,
    `WICHTIG: Arbeite wie ein extrem gründlicher Senior DevOps & Site Reliability Engineer (SRE). Egal wie viele Schritte es dauert – gehe **jedes Teilsystem nacheinander** mit deinen erweiterten Such- und Analyse-Tools durch, bevor du dein Urteil fällst:`,
    ``,
    `### PFLICHT-UNTERSUCHUNGSPHASEN (Nutze dafür aktiv deine Tools in mehreren Runden):`,
    `1. **Phase 1 — Host-, Prozess-, Container- & Port-Korrelation:**`,
    `   - Rufe \`node_deep_search\` mit \`search_mode: "process_and_port_map"\` auf \`@${node}\` auf.`,
    `   - Prüfe CPU, RAM, Disk, alle lauschenden Ports (\`ss -tulpn\`), laufende Prozesse, Docker-Container, systemd-Units und Live-HTTP-Antworten auf allen Ports.`,
    `2. **Phase 2 — Vollständige Datei-, Code- & Konfigurations-Inventur:**`,
    `   - Rufe \`node_deep_search\` mit \`search_mode: "file_find"\` und \`search_mode: "content_grep"\` auf, um alle Skripte, Server-Dateien und Konfigurationen unter \`/opt/axon/workspaces\` zu inventarisieren und deren Quellcode/Endpunkte (z. B. \`do_GET\`, \`do_POST\`, Error-Handling, Reboot-Persistenz) zu prüfen.`,
    `   - Wenn dir eine Datei auffällt, lies sie gezielt mit \`node_fs_operation\` (\`operation: "read_file"\`) aus.`,
    `3. **Phase 3 — Tiefenprüfung aller SQLite-Datenbanken:**`,
    `   - Rufe \`node_deep_search\` mit \`search_mode: "sqlite_inspect"\` auf.`,
    `   - Prüfe jede gefundene \`.db\`/\`.sqlite\`-Datei auf \`PRAGMA integrity_check\`, Tabellen-Schemata, Datensatz-Anzahl, Dateirechte und aktuelle Einträge.`,
    `4. **Phase 4 — Log- & Journal-Forensik:**`,
    `   - Rufe \`node_deep_search\` mit \`search_mode: "log_scan"\` auf, um sämtliche \`*.log\`-Dateien in \`/opt/axon/workspaces\`, \`/tmp\`, \`journalctl\` und Docker-Logs nach Fehlern, Warnungen, Tracebacks oder abgestürzten Prozessen zu durchsuchen.`,
    `5. **Phase 5 — Brain-Vault-Abgleich & Drift-Erkennung:**`,
    `   - Rufe \`core_vault_search\` (\`scope: "all"\`) auf und prüfe, ob die registrierten Services (${svcsList}) sowie \`Architecture.md\` und \`Memory.md\` zu 100 % mit den tatsächlich auf \`@${node}\` laufenden Ports und Dateien übereinstimmen oder ob es Abweichungen (Drift) gibt.`,
    `6. **Phase 6 — Großer Senior-DevOps-Abschlussbericht:**`,
    `   - Erstelle eine übersichtliche Status-Tabelle aller geprüften Subsysteme (Host, Muscle-Agent, jeder einzelne Backend-/WebUI-Service, Datenbanken, Logs, Brain-Sync).`,
    `   - Belege jeden Befund mit echten Daten aus deiner Untersuchung (PIDs, Ports, Dateipfade, Zeilen, DB-Tabellen, Antwortzeiten).`,
    `   - Gib konkrete, priorisierte **Verbesserungsempfehlungen** (Architektur, Stabilität, Auto-Restart/Systemd, Logging, Performance).`,
    langInstruction,
  ]
    .filter(Boolean)
    .join("\n");

  const displayMsg = text
    ? `🔍 **[Skill: CheckSystem]** ${text}`
    : promptLang === "en"
    ? `🔍 **[Skill: CheckSystem]** Multi-phase Senior DevOps deep scan (Host, Ports, Code, SQLite DBs, Logs & Brain Sync) on \`@${node}\``
    : `🔍 **[Skill: CheckSystem]** Mehrstufiger Senior-DevOps-Tiefenscan (Host, Ports, Code, SQLite-DBs, Logs & Brain-Sync) auf \`@${node}\``;

  return { prompt, displayMsg };
}

export function buildCheckOpsecPrompt(opts: {
  activeProject: ProjectState;
  node: string;
  text: string;
  promptLang: "de" | "en";
}): { prompt: string; displayMsg: string } {
  const { activeProject, node, text, promptLang } = opts;
  const langInstruction = getLangInstruction(promptLang);
  const currentTier =
    activeProject.assigned_nodes[0]?.tier || "TIER_1_UNLEASHED";
  const activeCarts =
    (activeProject.active_cartridges || []).join(", ") || "keine";

  const prompt = [
    `Du führst jetzt den erweiterten Skill **CheckOpsec** (Gründlicher DevSecOps-, Cybersecurity- & Zero-Trust-Tiefenaudit) für \`${activeProject.project_id}\` auf \`@${node}\` aus.`,
    text ? `ZUSÄTZLICHER BENUTZER-FOKUS / ANWEISUNG: "${text}"` : ``,
    `WICHTIG: Arbeite wie ein erfahrener Senior Security Engineer & Penetration-Tester. Nimm dir alle nötigen Tool-Runden Zeit, um das gesamte System gründlich zu durchleuchten:`,
    ``,
    `### PFLICHT-PRÜFPHASEN (Nutze aktiv deine Deep-Search- & PTY-Tools):`,
    `1. **Phase 1 — Automatisierte Security-Forensik (\`node_deep_search\` -> \`security_forensics\`):**`,
    `   - Führe \`node_deep_search\` mit \`search_mode: "security_forensics"\` auf \`@${node}\` aus.`,
    `   - Analysiere alle lauschenden Sockets (\`0.0.0.0\` vs. \`127.0.0.1\`), \`sshd_config\`-Direktiven, letzte SSH-Auth-Logs, Firewall-Regeln (\`ufw\`/\`iptables\`/\`nftables\`), Kernel-Sysctl-Parameter, Dateiberechtigungen und HTTP-Security-Header aller lokalen Services.`,
    `2. **Phase 2 — Quellcode- & Konfigurations-Audit auf Schwachstellen (\`node_deep_search\` -> \`content_grep\`):**`,
    `   - Durchsuche den gesamten Quellcode unter \`/opt/axon/workspaces\` mit \`node_deep_search\` (\`search_mode: "content_grep"\`) nach potenziellen Sicherheitsrisiken: SQL-Injection-Mustern, fehlender Input-Validierung, \`0.0.0.0\`-Bindings, fehlenden Security-Headern, offenen CORS-Headern (\`*\`) oder im Klartext hinterlegten Secrets/Tokens.`,
    `3. **Phase 3 — Prozess-Privilegien & Datenbank-Schutz (\`node_deep_search\` -> \`process_and_port_map\` & \`sqlite_inspect\`):**`,
    `   - Prüfe, unter welchem Linux-User (\`root\` vs. unprivilegierter User) die Python-/App-Prozesse und Container laufen und welche Oktal-Rechte (\`0600\` vs. \`0644\`/\`0777\`) die SQLite-Datenbanken und Skripte besitzen.`,
    `4. **Phase 4 — Synapse Governance & Zero-Trust Policy Audit (\`core_vault_search\`):**`,
    `   - Prüfe über \`core_vault_search\` (\`scope: "all"\`) das aktive Autonomy-Tier (\`${currentTier}\`), die aktiven Sicherheits-Cartridges (\`${activeCarts}\`), die gespeicherten Secret-Keys in \`Secrets.enc\` und das Audit-Log.`,
    `5. **Phase 5 — Umfassender DevSecOps-Bericht:**`,
    `   - Gliedere alle Befunde nach Schweregrad (**KRITISCH / HOCH / MITTEL / NIEDRIG / OK**) mit exakten technischen Nachweisen (Port, Datei, Zeilennummer, Konfigurationswert).`,
    `   - Vergib einen fundierten **OpSec-Score (0–100)** und liefere sofort ausführbare Härtungsmaßnahmen.`,
    langInstruction,
  ]
    .filter(Boolean)
    .join("\n");

  const displayMsg = text
    ? `🛡️ **[Skill: CheckOpsec]** ${text}`
    : promptLang === "en"
    ? `🛡️ **[Skill: CheckOpsec]** Multi-phase DevSecOps & Cybersecurity deep audit (Network, SSH, Firewall, Code Vulnerabilities, Secrets & Headers) on \`@${node}\``
    : `🛡️ **[Skill: CheckOpsec]** Mehrstufiger DevSecOps- & Cybersecurity-Tiefenaudit (Netzwerk, SSH, Firewall, Code-Schwachstellen, Secrets & Header) auf \`@${node}\``;

  return { prompt, displayMsg };
}

export function buildDeepForensicsPrompt(opts: {
  projectId: string;
  node: string;
  text: string;
  promptLang: "de" | "en";
}): { prompt: string; displayMsg: string } {
  const { projectId, node, text, promptLang } = opts;
  const langInstruction = getLangInstruction(promptLang);
  const focusTopic =
    text ||
    (promptLang === "en"
      ? "Inspect all logs, processes, databases, and source files for hidden errors, warnings, performance bottlenecks, or inconsistencies."
      : "Untersuche alle Logs, Prozesse, Datenbanken und Quellcode-Dateien auf versteckte Fehler, Warnungen, Performance-Engpässe oder Inkonsistenzen.");
  const prompt = [
    `Du führst jetzt den Skill **DeepForensics** (Tiefgreifende DevOps-Fehler-, Log-, Code- & Datenbank-Forensik) für \`${projectId}\` auf \`@${node}\` aus.`,
    `FORENSIK-AUFTRAG / FOKUS: "${focusTopic}"`,
    ``,
    `ARBEITE WIE EIN SENIOR DEVOPS TROUBLESHOOTER: Gehe gründlich und systematisch in mehreren Schritten vor:`,
    `1. **Log- & Crash-Analyse:** Starte \`node_deep_search\` mit \`search_mode: "log_scan"\` auf \`@${node}\`, um alle Applikations-Logs, \`/tmp/*.log\`, \`journalctl\` und Container-Logs auszuwerten.`,
    `2. **Prozess-, Port- & Ressourcen-Analyse:** Starte \`node_deep_search\` mit \`search_mode: "process_and_port_map"\`, um hängende Prozesse, Speicherverbrauch, Antwortzeiten und HTTP-Statuscodes aller Dienste zu prüfen.`,
    `3. **Code- & Datenbank-Tiefenprüfung:** Nutze \`node_deep_search\` mit \`search_mode: "content_grep"\` und \`"sqlite_inspect"\` sowie \`node_fs_operation\` (\`read_file\`), um den relevanten Quellcode und die Datenbank-Tabellen Zeile für Zeile auf Ursachen (Root Cause) zu untersuchen.`,
    `4. **Forensischer Diagnosebericht:** Präsentiere die genaue Ursache (Root Cause), alle gefundenen Belege (Logs, Codezeilen, DB-Status) und die exakte technische Lösung.`,
    langInstruction,
  ].join("\n");

  const displayMsg = `🔬 **[Skill: DeepForensics]** ${focusTopic}`;
  return { prompt, displayMsg };
}

export function buildCheckUpdatesPrompt(opts: {
  projectId: string;
  node: string;
  text: string;
  sysStatusSummary: string;
}): { prompt: string; displayMsg: string } {
  const { projectId, node, text, sysStatusSummary } = opts;
  const prompt = [
    `Du führst jetzt den Skill **CheckUpdates** (Umfassende Update-Prüfung aller Muscle-Server, Axon-Daemons, Linux-Pakete & Workspace-Backends) für das Projekt \`${projectId}\` auf \`@${node}\` aus.`,
    text ? `ZUSÄTZLICHER BENUTZER-FOKUS / ANWEISUNG: "${text}"` : ``,
    sysStatusSummary
      ? `Vorab geladener Core/Muscle Git- & OTA-Binary-Status:\n\`\`\`json\n${sysStatusSummary}\n\`\`\``
      : ``,
    ``,
    `ARBEITE WIE EIN SENIOR DEVOPS RELEASE & PATCH ENGINEER: Prüfe in mehreren Schritten gründlich alle Ebenen auf Updates und Verbesserungen (führe jetzt **NOCH KEINE** Updates aus, sondern erstelle zuerst den Prüfbericht!):`,
    `1. **Schicht 1 — Synapse Muscle Agent (\`/usr/local/bin/axon\`, \`axon.service\`, \`axon-db.service\` & \`/opt/synapse-src\`):**`,
    `   - Prüfe per \`node_pty_exec\` auf \`@${node}\` den genauen Stand von \`/opt/synapse-src\` (\`git -C /opt/synapse-src fetch origin main && git -C /opt/synapse-src status -sb && git -C /opt/synapse-src log -1 --format="%h %ci %s"\`), den SHA-256-Hash & Zeitstempel von \`/usr/local/bin/axon\` sowie den Systemd-Status von \`axon\` und \`axon-db\`.`,
    `2. **Schicht 2 — Workspace-Backends, Runtimes & Abhängigkeiten (\`/opt/axon/workspaces\`):**`,
    `   - Nutze \`node_deep_search\` (\`search_mode: "process_and_port_map"\` und \`"file_find"\`), um alle laufenden Backend-Services (z. B. Ports \`:4050\`, \`:4060\`, \`:4070\`, SQLite-DBs, Python-/Node-Skripte) zu inventarisieren.`,
    `   - Prüfe die eingesetzten Runtimes (\`python3 --version\`, \`go version\`, \`node --version\`, \`sqlite3 --version\`), vorhandene \`requirements.txt\`/\`package.json\` sowie ob die Backend-Dienste Health-/Version-Endpunkte, sauberes Logging und Systemd-Auto-Restart besitzen oder aktualisiert/modernisiert werden können.`,
    `3. **Schicht 3 — Linux OS- & Security-Updates (\`apt\`):**`,
    `   - Prüfe per \`node_pty_exec\` auf \`@${node}\` mit \`apt list --upgradable 2>/dev/null | head -n 35\` und \`[ -f /var/run/reboot-required ] && cat /var/run/reboot-required || echo "Kein Reboot erforderlich"\`, welche System- und Sicherheits-Updates für den Muscle-Host bereitstehen.`,
    `4. **Strukturierter Update-Bericht & Entscheidungsfrage (auf Deutsch):**`,
    `   - Erstelle eine übersichtliche Markdown-Tabelle aller geprüften Komponenten (**Synapse Muscle Agent**, **Backend :4050**, **Backend :4060**, **DB-Mesh :4070**, **Runtimes**, **Linux Security/APT-Pakete**) mit \`Aktueller Stand\`, \`Verfügbares Update / Optimierung\`, \`Risiko\` und \`Empfehlung\`.`,
    `   - Stelle am Ende des Berichts ausdrücklich die Frage: **„Sollen diese Updates jetzt durchgeführt und im Anschluss ein vollständiger Funktionstest aller Muscle-Backends gestartet werden?“**`,
  ]
    .filter(Boolean)
    .join("\n");

  const displayMsg = text
    ? `🔄 **[Skill: CheckUpdates]** ${text}`
    : `🔄 **[Skill: CheckUpdates]** Prüfe alle Muscle-Server, Axon-Daemons, Runtimes, OS-Pakete & Workspace-Backends auf verfügbare Updates auf \`@${node}\``;

  return { prompt, displayMsg };
}

export function buildStartSkillInterviewPrompt(opts: {
  node: string;
  reportContent: string;
}): { prompt: string; displayMsg: string } {
  const { node, reportContent } = opts;
  const prompt = [
    `Starte jetzt den interaktiven **DevOps-Interview-Modus** zu deinem folgenden Analyse- & Skill-Bericht auf \`@${node}\`:`,
    `<skill_report>`,
    reportContent.slice(0, 6000),
    `</skill_report>`,
    ``,
    `WICHTIGE REGELN FÜR DAS INTERVIEW:`,
    `1. Extrahiere alle gefundenen Verbesserungsvorschläge, Warnungen, Fehlkonfigurationen oder Sicherheitslücken aus dem Bericht und nummeriere sie intern durch (**Punkt 1 von N**, **Punkt 2 von N**, ...).`,
    `2. Gehe **immer nur EINEN einzigen Punkt pro Nachricht** mit mir durch!`,
    `3. Stelle mir **jetzt ausschließlich Punkt 1 von N** kurz, präzise und verständlich auf Deutsch vor:`,
    `   - **Befund / Problem:** Was genau hast du gefunden (inkl. Server/Port/Datei)?`,
    `   - **Geplante Behebung:** Was genau würdest du ausführen oder ändern, um das Problem sauber zu lösen?`,
    `   - **Auswirkung / Nutzen:** Warum ist diese Änderung sinnvoll?`,
    `4. Führe **NOCH KEINE Änderung** aus, sondern frage mich am Ende: **„Soll ich diesen Punkt jetzt beheben oder überspringen?“**`,
  ].join("\n");

  const displayMsg = `🎙️ **[Interview-Modus]** Lass uns alle Punkte aus dem Bericht einzeln durchgehen und entscheiden, ob sie behoben werden sollen.`;
  return { prompt, displayMsg };
}

export function buildInterviewStepResponsePrompt(opts: {
  node: string;
  decision: "fix" | "skip" | "fix_all" | "stop";
}): { prompt: string; displayMsg: string } {
  const { node, decision } = opts;
  if (decision === "fix") {
    return {
      prompt: [
        `Der Nutzer hat entschieden: **JA, DIESEN PUNKT JETZT BEHEBEN.**`,
        `1. Führe die besprochene Behebung für den aktuellen Punkt jetzt sofort live auf \`@${node}\` mit deinen Tools (\`node_fs_operation\`, \`node_pty_exec\`, \`core_register_service\`, \`core_update_brain_doc\`) durch und verifiziere kurz, dass die Änderung erfolgreich aktiv ist.`,
        `2. Bestätige in 1–2 Sätzen, was du behoben hast.`,
        `3. Stelle mir direkt darunter den **nächsten offenen Punkt (Punkt X von N)** aus dem ursprünglichen Bericht vor und frage wieder: **„Soll ich diesen Punkt jetzt beheben oder überspringen?“** (Falls alle Punkte abgearbeitet sind, gib eine kurze Abschluss-Zusammenfassung).`,
      ].join("\n"),
      displayMsg: `✅ **[Interview-Antwort]** Ja, diesen Punkt jetzt beheben und danach den nächsten Punkt vorstellen.`,
    };
  }
  if (decision === "skip") {
    return {
      prompt: [
        `Der Nutzer hat entschieden: **DIESEN PUNKT ÜBERSPRINGEN (NICHT BEHEBEN).**`,
        `Nimm an diesem Punkt KEINE Änderungen vor. Stelle mir jetzt direkt den **nächsten offenen Punkt (Punkt X von N)** aus dem Bericht vor (Befund, geplante Behebung, Auswirkung) und frage: **„Soll ich diesen Punkt jetzt beheben oder überspringen?“** (Falls keine weiteren Punkte offen sind, gib eine kurze Abschluss-Zusammenfassung).`,
      ].join("\n"),
      displayMsg: `⏭️ **[Interview-Antwort]** Diesen Punkt überspringen – bitte nächsten Punkt vorstellen.`,
    };
  }
  if (decision === "fix_all") {
    return {
      prompt: [
        `Der Nutzer hat entschieden: **ALLE RESTLICHEN PUNKTE AUTOMATISCH BEHEBEN.**`,
        `Gehe jetzt alle noch offenen Punkte aus dem Bericht nacheinander durch, setze die Behebungen live auf \`@${node}\` mit deinen Tools um, aktualisiere bei Bedarf \`Memory.md\` / \`Architecture.md\` und erstelle einen abschließenden Erfolgsbericht über alle durchgeführten Korrekturen.`,
      ].join("\n"),
      displayMsg: `⚡ **[Interview-Antwort]** Alle restlichen Punkte aus dem Bericht jetzt automatisch beheben.`,
    };
  }
  return {
    prompt: [
      `Der Nutzer beendet das Interview.`,
      `Fasse kurz und übersichtlich auf Deutsch zusammen, welche Punkte im Rahmen des Interviews bereits behoben wurden und welche Punkte übersprungen / offen gelassen wurden.`,
    ].join("\n"),
    displayMsg: `⏹️ **[Interview-Antwort]** Interview beenden & Zusammenfassung anzeigen.`,
  };
}

export function buildUpdateSkillDecisionPrompt(opts: {
  node: string;
  decision: "execute_and_test" | "test_only" | "skip";
  reportContent: string;
  otaSummary?: string;
}): { prompt: string; displayMsg: string } {
  const { node, decision, reportContent, otaSummary } = opts;

  if (decision === "skip") {
    return {
      prompt: [
        `Der Nutzer hat entschieden: **NEIN, KEINE UPDATES DURCHFÜHREN.**`,
        `Nimm KEINE Änderungen oder Updates an den Muscle-Servern oder Backends vor und bestätige kurz auf Deutsch, dass alle Dienste im aktuellen Zustand belassen wurden.`,
      ].join("\n"),
      displayMsg: `❌ **[Update-Entscheidung]** Nein, Updates jetzt nicht durchführen.`,
    };
  }

  if (decision === "test_only") {
    return {
      prompt: [
        `Der Nutzer möchte **OHNE vorheriges Update sofort einen vollständigen End-to-End Funktionstest** aller Muscle-Server und Backends auf \`@${node}\` durchführen.`,
        `Führe jetzt folgende Live-Tests durch:`,
        `1. Prüfe per \`node_deep_search\` (\`search_mode: "process_and_port_map"\`), dass \`axon\`, \`axon-db\` und alle Backend-Ports (\`:4050\`, \`:4060\`, \`:4070\`) aktiv lauschen.`,
        `2. Prüfe per \`node_pty_exec\` mit \`curl -sS -i http://127.0.0.1:4050/\`, \`curl -sS -i http://127.0.0.1:4060/api/events\` und \`curl -sS -i http://127.0.0.1:4070/query\`, ob alle HTTP- & JSON-Endpunkte fehlerfrei mit HTTP 200 antworten.`,
        `3. Prüfe per \`node_deep_search\` (\`search_mode: "sqlite_inspect"\`), ob alle SQLite-Datenbanken \`PRAGMA integrity_check = ok\` melden.`,
        `4. Erstelle einen klaren **Funktionstest-Bericht (PASS / FAIL)** für jedes getestete Backend.`,
      ].join("\n"),
      displayMsg: `🧪 **[Update-Entscheidung]** Nur vollständigen End-to-End Funktionstest aller Muscle-Backends ausführen.`,
    };
  }

  const prompt = [
    `Der Nutzer hat entschieden: **JA, UPDATES JETZT DURCHFÜHREN UND ANSCHLIESSEND VOLLSTÄNDIG TESTEN!**`,
    `Bezugnehmend auf deinen vorherigen Update-Bericht:`,
    `<update_report>`,
    reportContent.slice(0, 4500),
    `</update_report>`,
    otaSummary
      ? `Ergebnis des soeben ausgeführten Core & Muscle OTA-Binary-Rollouts (\`/api/system-update\`):\n\`\`\`json\n${otaSummary}\n\`\`\``
      : ``,
    ``,
    `DEIN AUFTRAG IN 2 VERBINDLICHEN PHASEN AUF \`@${node}\`:`,
    `### Phase 1 — Muscle- & Backend-Updates ausführen:`,
    `1. Prüfe bzw. aktualisiere auf \`@${node}\` per \`node_pty_exec\` die im Bericht genannten sicheren Backend-/Paket-Updates (z. B. \`DEBIAN_FRONTEND=noninteractive apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install --only-upgrade -y curl ca-certificates git sqlite3 2>/dev/null || true\`) sowie eventuelle Verbesserungen an den Workspace-Backends unter \`/opt/axon/workspaces\`, ohne laufende Datenbanken zu beschädigen.`,
    `2. Stelle sicher, dass alle Backend-Prozesse (\`:4050\`, \`:4060\`, \`:4070\`) sowie \`axon.service\` und \`axon-db.service\` sauber laufen.`,
    ``,
    `### Phase 2 — Verbindlicher End-to-End Funktionstest (PFLICHT!):`,
    `1. **Prozess- & Port-Verifikation:** Führe \`node_deep_search\` mit \`search_mode: "process_and_port_map"\` auf \`@${node}\` aus und prüfe, dass \`axon\`, \`axon-db\` und alle Backend-Ports (\`:4050\`, \`:4060\`, \`:4070\`) aktiv sind.`,
    `2. **Live HTTP- & API-Funktionstest:** Teste per \`node_pty_exec\` jeden einzelnen Backend-Dienst mit echten Requests (\`curl -sS -w "\\nHTTP_CODE:%{http_code} TIME:%{time_total}s\\n" http://127.0.0.1:4050/\`, \`http://127.0.0.1:4060/api/events\`, \`http://127.0.0.1:4070/query\`) und verifiziere Statuscode \`200\` sowie valide Antworten.`,
    `3. **Datenbank-Integritätstest:** Führe \`node_deep_search\` mit \`search_mode: "sqlite_inspect"\` aus und bestätige \`PRAGMA integrity_check = ok\` für alle SQLite-Datenbanken.`,
    `4. **Abschlussbericht (Update + Testergebnis auf Deutsch):**`,
    `   - Zeige eine übersichtliche Tabelle mit **allen durchgeführten Updates** (Vorher -> Nachher) und **jedem einzelnen Funktionstest (PASS / FAIL, HTTP-Code, Antwortzeit, DB-Integrität)**.`,
  ]
    .filter(Boolean)
    .join("\n");

  const displayMsg = `🚀 **[Update & Funktionstest]** Ja, alle Updates für Muscle & Backends jetzt durchführen und anschließend auf Herz und Nieren testen!`;
  return { prompt, displayMsg };
}
