# 🎯 00 – Produkt-Vision & Architektur-Leitbild (Synapse)

> **Synapse (`SolidStateNetwork/Synapse`)** ist eine selbstgehostete, KI-gestützte Linux-Server- & DevOps-Steuerzentrale (**AI-Managed Infrastructure Control Center**), die visuelle Topologie-Steuerung, autonome Selbstheilung, Zero-Trust-Sicherheit und das **Model Context Protocol (`MCP`)** in einer einheitlichen Plattform vereint.

---

## 1. Das Kernproblem klassischer Server-Administration

Wer Linux-Server, Microservices und Datenbanken betreibt, steht traditionell vor zwei Extremen:
1. **Rein manuelle SSH- & Terminal-Arbeit:** Jede Diagnose, jedes Deployment, jede Firewall-Änderung und jedes Log-Audit erfordert manuelles Verbinden per SSH, das Zusammensuchen von Befehlen und das händische Prüfen von Abhängigkeiten.
2. **Unkontrollierte KI-Skripte ohne Sicherheitsnetz:** Gibt man einem Sprachmodell direkten Root-Zugriff ohne Policy-Gate, drohen Selbst-Aussperrung (Firewall/SSH-Lockout), unbemerkte Konfigurationsfehler ohne Rollback oder geleakte API-Secrets im Chat-Kontext.

**Synapse löst diesen Widerspruch durch die strikte Trennung in „The Brain“ (`Core`) und „The Hands“ (`Muscle`) kombiniert mit deterministischen Sicherheits-Guardrails.**

---

## 2. Die 2-Komponenten-Architektur: Core („The Brain“) & Muscle („The Hands“)

```mermaid
flowchart LR
    subgraph Operators["👨‍💻 Operator & Externe KI-Clients"]
        WebUI["Browser Control Center\n(Next.js 15 Studio :3000)"]
        MCPClient["Claude Desktop / Cursor / Windsurf\n(MCP JSON-RPC 2.0 Client)"]
    end

    subgraph Core["🧠 Synapse Core ('The Brain')"]
        Studio["Core Web Studio & AI Orchestrator\n(29 AI/MCP Tools, Prompt Cache)"]
        Vault["Encrypted Project Brain Vault\n(State.json, Secrets.enc, Checkpoints)"]
        Gateway["Core Gateway (:8081 HTTP / :8443 mTLS)\n(ECDSA P-256 Root CA & Yamux Hub)"]
    end

    subgraph Muscle["💪 Axon Muscle Node ('The Hands')"]
        Axon["Statischer Go-Agent (axon)\n(Outbound mTLS 1.3 + Yamux Client)"]
        Guard["Deterministic Self-Lockout Guard\n& Autonomy Tier Enforcer"]
        Runtime["Lokale Dienste, Docker-Stacks,\nSQLite, Firewall & Sentinel PTY"]
    end

    WebUI <==>|"HTTP / SSE Streaming"| Studio
    MCPClient <==>|"Bearer syn_mcp_... (/api/mcp)"| Studio
    Studio <==>|"AES-256-GCM"| Vault
    Studio <==>|"Internal RPC (:8081)"| Gateway
    Axon ===>|"Outbound mTLS 1.3 (:8443)\n(Zero Inbound Firewall Ports)"| Gateway
    Axon --> Guard --> Runtime
```

### 🧠 1. Synapse Core („The Brain“)
- **Zentrale Steuerung & Visualisierung:** Stellt das interaktive Web-Cockpit (Topology Canvas, Live-Preview Reverse Proxy, Code- & SQLite-Studio, Firewall-Matrix, Time-Machine Checkpoints) sowie den integrierten **MCP-Server (`/api/mcp`)** bereit.
- **Zero Untrusted Execution on Core:** Auf dem Core selbst werden niemals ungetestete Benutzerskripte ausgeführt. Der Core verwaltet das verschlüsselte Projekt-Gedächtnis (`Brain Vault`) und prüft jede KI-Aktion im **Policy Interceptor**.

### 💪 2. Axon Muscle („The Hands“)
- **Abhängigkeitsfreies Single-Binary (`axon`):** Ein in Go geschriebener, statisch kompilierter Agent für Linux (`amd64` & `arm64`).
- **Zero-Inbound-Port-Architektur:** Der Muscle-Server benötigt **keinen einzigen offenen eingehenden Port** in der Firewall. `axon` baut ausgehend einen gegenseitig authentifizierten **mTLS 1.3 + Yamux**-Tunnel zum Core Gateway (`:8443`) auf.

---

## 3. Die 3 Autonomie-Stufen (`Autonomy Tiers`)

Jeder verbundene Muscle-Server wird mit einer klaren, technisch erzwungenen Autonomie-Stufe betrieben:

| Autonomie-Stufe | Zielgruppe / Einsatzgebiet | Technische Durchsetzung |
| :--- | :--- | :--- |
| **`TIER_3_SUPERVISED`** | Produktive Bestandsserver mit strenger menschlicher Freigabepflicht | Lese- und Diagnose-Tools laufen frei; jede schreibende Dateisystem-, PTY- oder Firewall-Aktion wird im Core angehalten und erfordert einen **1-Click Approve** im WebUI oder per MCP. |
| **`TIER_2_WORKSPACE_JAIL`** *(Standard)* | Geteilte Entwicklungs- und Applikations-Server | Die KI arbeitet vollautonom, ist aber durch kanonische Pfad-Prüfung (`filepath.Clean` + `filepath.EvalSymlinks`) strikt in `/opt/axon/workspaces/<project_id>` eingesperrt. |
| **`TIER_1_UNLEASHED`** | Dedizierte VMs, Container oder Cloud-VPS unter voller KI-Verwaltung | Volle System-Autonomie (Systemd, Docker, Firewall, Paketinstallation) – geschützt durch den **Deterministic Self-Lockout Guard** und **Pre-Flight Time-Machine Checkpoints**. |

---

## 4. Kern-Prinzipien für die Weiterentwicklung

1. **100 % Full-Stack AI & MCP Parität:** Jede Funktion, die ein Mensch im WebUI klicken kann, muss auch als strukturiertes Tool für den internen AI-Orchestrator und externe MCP-Clients (`SYNAPSE_TOOL_SCHEMAS`) verfügbar sein.
2. **Pre-Flight Time-Machine Checkpoints vor jeder Mutation:** Jede potenziell kritische Änderung (Blueprint-Rollout, GitOps-Deploy/Teardown, Custom-Service-Deploy, Hot-Reload, Firewall-Mutation, System-Update) legt automatisch vorab einen wiederherstellbaren Checkpoint (`chk-...`) an.
3. **Zero-Leak Secret Management:** Geheimnisse werden ausschließlich mit **AES-256-GCM** (`Secrets.enc`) auf der Festplatte gespeichert, niemals im Klartext an das LLM übergeben und automatisch aus allen Terminal-Ausgaben (`[REDACTED_SECRET:KEY]`) gefiltert.
