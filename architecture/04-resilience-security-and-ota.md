# 🛡️ 04 – Resilience, Zero-Knowledge Security & Container-Native OTA

Dieses Dokument definiert die Sicherheits-, Backup-, Selbstheilungs- und Update-Mechanismen von **Synapse**.

---

## 1. Zero-Leak Secret Vault (`Secrets.enc`)

Projekt-Geheimnisse (Datenbank-Passwörter, API-Tokens, Webhook-Secrets) werden niemals in `State.json` oder im Klartext gespeichert:
- **Verschlüsselung:** `AES-256-GCM` mit zufälligem 12-Byte-IV, 16-Byte-Auth-Tag und einem über `PBKDF2-SHA256` (`100.000` Iterationen) abgeleiteten Master-Schlüssel (`SYNAPSE_MASTER_KEY`).
- **Sichere Injektion & Output-Scrubbing:**
  - Das LLM sieht im System-Prompt ausschließlich die **Schlüssel-Namen** (`secret_keys_available: ["DB_PASSWORD", ...]`).
  - Bei Ausführung von `node_pty_exec`, `core_deploy_git_stack` oder Blueprint-Deployments werden die entschlüsselten Werte direkt in die geschützte Laufzeitumgebung injiziert.
  - Bevor `stdout`/`stderr` oder `Audit.jsonl`-Einträge gespeichert oder an das LLM zurückgegeben werden, ersetzt der **Secret Scrubber** jeden vorkommenden Klartext-Wert durch `[REDACTED_SECRET:<KEY>]`.

---

## 2. Automatische Pre-Flight Time-Machine Checkpoints (`checkpoints.ts`)

Vor jeder zustandsverändernden Infrastruktur-Aktion legt Synapse automatisch einen **Pre-Flight Time-Machine Checkpoint** (`Checkpoints.json`) an und gibt dessen `checkpoint_id` (`chk-...`) im API-Response und als sichtbares UI-Badge zurück:

| Auslöser / Subsystem | Erzeugter Checkpoint | Rollback-Mechanismus |
| :--- | :--- | :--- |
| **1-Click Stack Blueprints (`/api/blueprints`)** | Vor `deploy` & `undeploy` | Stellt Dienst-Snapshot und Blueprint-Verzeichnis wieder her. |
| **GitOps Stack Studio (`gitopsDeployer.ts`)** | Vor `deploy`, `webhook_redeploy` & `delete` | Führt `git reset --hard HEAD~1` im Stack-Repository aus und stellt `State.json` wieder her. |
| **Custom Service Builder (`serviceMeshAndBuilder.ts`)** | Vor `deployCustomServiceOnMuscle` | Sichert die bestehende Service-Topologie und das Ziel-Skriptverzeichnis. |
| **Live-Code Hot-Reload (`v070-studio.ts`)** | Vor `hotReloadServiceCodeOnMuscle` | Validiert Python-Syntax (`py_compile`) vorab und rollt bei HTTP-500 automatisch auf den Pre-Write-Snapshot zurück. |
| **Synapse Shield Firewall (`/api/firewall`)** | Vor `toggle_port_shield`, `apply_profile`, `add_ip_rule`, `remove_ip_rule` | Speichert die vorherige `Firewall.json` als Base64-Snapshot für 1-Click-Wiederherstellung. |
| **OTA System-Update (`/api/system-update`)** | Vor `update_core`, `update_muscle`, `update_all` | Sichert den exakten Git-Commit-Hash für deterministisches `git checkout <commit>` Rollback. |

---

## 3. Autonomous Self-Healing & Chaos-Resilience (`self-healing/`)

Synapse überwacht alle registrierten Dienste kontinuierlich und heilt Ausfälle autonom:
- **Reaktive Selbstheilung (`executeServiceSelfHeal`):** Überschreitet ein Dienst die konfigurierte Fehler-Schwelle (`failure_threshold`) oder Latenz (`max_latency_ms`), startet Synapse den zugehörigen Container, Systemd-Dienst oder Workspace-Prozess automatisch neu, verifiziert `HTTP 200 OK` und protokolliert die **MTTR (Mean Time To Recovery)** in Millisekunden.
- **Chaos-Engineering-Simulation (`simulate_crash`):** Operatoren und KI-Agenten können per 1-Click einen kontrollierten Prozess-Ausfall simulieren und die automatische Wiederherstellungszeit live messen.

---

## 4. Container-Native & Bare-Metal OTA Updates (`/api/system-update`)

Das integrierte Over-The-Air Update-System unterstützt sowohl klassische Bare-Metal-Installationen (`systemd` / `OpenRC`) als auch unser lokales **2-Container-Lab (`containers/`)**:
- **Versions- & Commit-Abgleich:** Vergleicht `SYNAPSE_VERSION`, den lokalen Git-Commit-Hash (`HEAD`), den Remote-Branch (`origin/main`) sowie die `SHA-256`-Prüfsummen von `core-gateway` und `axon`.
- **Dual-Mode Rollout:** Erkennt automatisch, ob `core-gateway`, `core-web` und `axon` als Systemd-Units oder in Rootless-/Docker-Containern laufen, kompiliert neue Binaries/Bundles und führt einen unterbrechungsfreien Neustart durch.
