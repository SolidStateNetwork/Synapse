<div align="center">

<img src="./docs/assets/synapse-hero-banner.svg" alt="Synapse — KI-gesteuertes Server- & Infrastruktur-Management" width="100%" />

<br />

[![Read in English](https://img.shields.io/badge/🇬🇧_Language-Read_in_English_→-31c48d?style=for-the-badge&labelColor=181a1d)](./README.md)
[![Deutsch (Aktiv)](https://img.shields.io/badge/🇩🇪_Sprache-Deutsch_(Aktiv)-f68330?style=for-the-badge&labelColor=181a1d)](./README.de.md)

[![CI Pipeline](https://github.com/SolidStateNetwork/Synapse/actions/workflows/ci.yml/badge.svg)](https://github.com/SolidStateNetwork/Synapse/actions/workflows/ci.yml)
[![Latest Release](https://img.shields.io/github/v/release/SolidStateNetwork/Synapse?label=Release&color=f68330&labelColor=181a1d)](https://github.com/SolidStateNetwork/Synapse/releases)
[![Lizenz: Source-Available (Non-Commercial)](https://img.shields.io/badge/Lizenz-Source--Available_(Non--Commercial)-f68330?labelColor=181a1d)](./LICENSE)

### **Synapse — Dein KI-verwaltetes Server- & DevOps-Control-Center**
Verwalte, überwache und repariere deine Linux-Server gemeinsam mit einer KI – über eine aufgeräumte grafische Oberfläche statt stundenlanger Fehlersuche im Terminal.

[Was ist Synapse?](#-was-ist-synapse) · [Die 5 Kernfunktionen](#-die-5-kernfunktionen) · [Wie ist Synapse aufgebaut?](#-wie-ist-synapse-aufgebaut-core--muscle) · [Sicherheit & Kontrolle](#️-sicherheit--kontrolle) · [Schnellstart in 2 Schritten](#-schnellstart-in-2-schritten)

</div>

---

## 💡 Was ist Synapse?

Wer einen oder mehrere Linux-Server betreibt, kennt den Alltag: Man verbindet sich per SSH, sucht in langen Log-Dateien nach Fehlern, passt Konfigurationsdateien von Hand an, spielt Updates ein und prüft danach mühsam, ob noch alle Dienste laufen.

**Synapse ist ein KI-gesteuertes Management-Tool (AI-Managed Infrastructure Tool), das dir diese Arbeit abnimmt.**

Statt selbst Befehle im Terminal einzutippen, arbeitest du in einer visuellen Oberfläche (jederzeit per Klick zwischen **Deutsch** und **Englisch** umschaltbar) mit einem integrierten KI-Systemadministrator zusammen. Die KI ist direkt mit deinen Servern verbunden: Sie kann den Zustand des Systems prüfen, Dienste einrichten, Sicherheitslücken aufspüren, Updates vorbereiten und Fehler beheben – während du jederzeit die volle Übersicht und das letzte Wort behältst.

---

## 🎯 Die 5 Kernfunktionen

### 1. Interaktiver KI-Chat, fertige Prüf-Skills & Interview-Modus
Neben dem normalen Chat (in dem du der KI in Alltagssprache Aufgaben geben, Server per `@` erwähnen oder Screenshots hineinziehen kannst) bringt Synapse fertige **DevOps-Skills** mit, die du direkt im KI-Panel oder über **`✨ Skills`** startest:
- **`CheckSystem`:** Prüft deine Server gründlich auf Herz und Nieren (Auslastung, laufende Dienste, SQLite-Datenbanken, Logs und Konfiguration).
- **`CheckOpsec`:** Untersucht das System auf Sicherheitsrisiken (offene Ports, SSH-Einstellungen, Firewall, Dateirechte und HTTP-Header).
- **`CheckUpdates`:** Prüft alle verbundenen Server, Dienste und Systempakete auf verfügbare Updates, fragt dich im Bericht um Freigabe und führt danach automatisch einen Funktionstest durch.
- **`DeepForensics` & `SkillSearch`:** Findet versteckte Fehlerursachen in Logs oder zeigt dir sofort, wo sich eine bestimmte Datei, Einstellung oder Funktion im System befindet.

> **Der Interview-Modus:** Wenn ein Skill seinen Bericht fertiggestellt hat, ändert die KI nichts ungefragt. Mit einem Klick auf **„Interview starten"** geht die KI jeden gefundenen Punkt einzeln mit dir durch und fragt dich: *„Jetzt beheben oder überspringen?"*

### 2. Visuelle Übersicht & direkter App-Tester im Browser
Auf der Startseite (**Übersicht**) siehst du alle verbundenen Server, die KI-Zentrale und deine laufenden Anwendungen als interaktive Karten, die du mit der Maus aufklappen und frei anordnen kannst:

<div align="center">
  <img src="./docs/assets/control-center-ui-preview.svg" alt="Synapse Control Center Vorschau" width="100%" />
</div>

- **Sofort testen ohne Firewall-Stress:** Wenn die KI auf deinem Server eine Web-App, eine API oder eine Datenbank startet, kannst du sie unter **Services** direkt im Browser öffnen und testen – ganz ohne Ports in deiner Server-Firewall nach außen öffnen zu müssen.
- **Eingebautes Live-Terminal & Datei-Explorer:** Wenn du doch einmal selbst nachsehen möchtest, kannst du am unteren Bildschirmrand jederzeit das Live-Terminal aufklappen oder unter **Dateien** direkt im Browser Dateien bearbeiten.

### 3. Versionsanzeige & 1-Klick Updates unten links (wie bei NetBird)
Unten links in der Seitenleiste siehst du jederzeit die aktuell installierte Version und den Commit-Stand:
- **Sofort sehen, wenn ein Update bereitsteht:** Sobald für die Steuerzentrale (**Core**) oder deine verbundenen Linux-Server (**Muscle**) ein Update verfügbar ist, erscheint direkt unten links der Hinweis **`Update verfügbar`** samt **`Update`**-Button, mit dem du alles mit einem Klick aktualisieren kannst.

### 4. Projekt-Gedächtnis (`Brain Vault`), das nichts vergisst
Ein normaler KI-Chat vergisst nach jedem Gespräch, wie dein Server eingerichtet ist. Synapse führt für jedes Projekt automatisch zwei lebendige Dokumente unter **Brain Vault**:
- **`Architecture.md`:** Eine übersichtliche Dokumentation deiner Server-Struktur, Ports und Pfade (inklusive interaktivem Topologie-Graphen).
- **`Memory.md`:** Ein technisches Tagebuch, in dem die KI festhält, welche Probleme bereits gelöst wurden und worauf bei deinem Server geachtet werden muss.

### 5. Eigene Regeln per Klick aktivieren (`Regeln`)
Unter **Regeln** kannst du fertige Vorgaben (sogenannte *Rule Cartridges*) einfach per Schalter auf `AKTIV` setzen – etwa *„Nutze immer Docker-Container"*, *„Öffne keine Ports direkt ins Internet"* oder *„Richte Dienste sauber über Systemd ein"*. Die KI hält sich dann bei jeder Aufgabe automatisch an deine Vorgaben.

---

## 🧠 Wie ist Synapse aufgebaut? (Core & Muscle)

Synapse besteht aus zwei klar getrennten Teilen:

1. **Der Core („Das Gehirn" — `synapse-core`):**
   Deine zentrale Weboberfläche inklusive KI-Steuerung und verschlüsseltem Passwort-Tresor. Auf dem Core selbst wird niemals fremder Programmcode ausgeführt.
2. **Der Muscle („Die Hände" — `axon`):**
   Ein kleines, schlankes Programm (eine einzige Datei ohne Abhängigkeiten), das du auf deinen Linux-Servern installierst. Es verbindet sich verschlüsselt mit deinem Core und führt dort genau die Befehle und Datei-Änderungen aus, die für deine Projekte nötig sind.

<div align="center">
  <img src="./docs/assets/brain-muscle-architecture.svg" alt="Synapse Core & Muscle Aufbau" width="100%" />
</div>

---

## 🛡️ Sicherheit & Kontrolle

Du entscheidest für jeden Server selbst, wie viel Spielraum die KI bekommt:

<div align="center">
  <img src="./docs/assets/security-autonomy-tiers.svg" alt="Synapse Sicherheits- & Autonomie-Stufen" width="100%" />
</div>

1. 🟢 **Überwachter Modus (`TIER_3_SUPERVISED`):** Die KI darf lesen und analysieren, fragt dich aber vor jeder Datei-Änderung und vor jedem Befehl in der Oberfläche um Erlaubnis.
2. 🟡 **Projekt-Ordner (`TIER_2_WORKSPACE_JAIL` — Standard):** Die KI darf innerhalb ihres eigenen Projekt-Ordners (`/opt/axon/workspaces/...`) selbstständig arbeiten, hat aber keinen Zugriff auf das restliche Betriebssystem.
3. 🔴 **Vollzugriff (`TIER_1_UNLEASHED`):** Für eigene VMs oder Server, auf denen die KI auch Systempakete installieren, Dienste neu starten und die gesamte Maschine verwalten soll.

Zusätzlich schützt sich Synapse selbst:
- **Passwörter bleiben geheim:** Zugangsdaten werden verschlüsselt gespeichert (`AES-256-GCM`) und niemals im Klartext im Chat oder in Logs angezeigt.
- **1-Klick Rückgängig (Rollback):** Vor jeder Datei-Änderung legt Synapse automatisch eine Sicherungskopie an, sodass du Änderungen im Chat mit einem Klick rückgängig machen kannst.
- **Vollständiges Protokoll (`Audit-Log`):** Jede Aktion der KI wird nachvollziehbar im Audit-Log protokolliert.

---

## 🚀 Schnellstart in 2 Schritten

### Schritt 1 — Steuerzentrale (`Core`) mit Docker starten
Führe diesen Befehl auf dem System aus, auf dem deine Weboberfläche laufen soll:

```bash
curl -fsSL https://raw.githubusercontent.com/SolidStateNetwork/Synapse/main/scripts/deploy-core.sh | bash
```

Danach erreichst du das **Synapse Control Center** im Browser unter `http://<DEINE_CORE_IP>:3000`.

### Schritt 2 — Linux-Server (`Muscle`) verbinden
Klicke oben rechts in der Weboberfläche auf **`+ Server`**, erzeuge über **„Setup-Schlüssel erzeugen"** einen Einmal-Schlüssel und führe den angezeigten Befehl auf deinem Linux-Server aus:

```bash
curl -fsSL http://<DEINE_CORE_IP>:8081/install.sh | sudo sh -s -- <EINMAL_TOKEN> TIER_2_WORKSPACE_JAIL
```

Der Server verbindet sich automatisch im Hintergrund (ohne dass du eingehende Ports in deiner Firewall öffnen musst) und erscheint sofort live auf deiner Übersichtskarte.

---

## 🛠️ Manuelles Kompilieren & Testen (für Entwickler)

```bash
# 1. Go-Tests für Agent (axon) und Gateway (core-gateway) ausführen
CGO_ENABLED=0 go test -v ./proto/... ./agents/axon/... ./apps/core-gateway/...

# 2. Statische Binaries bauen
CGO_ENABLED=0 go build -C agents/axon -o ../../bin/axon ./cmd/axon
CGO_ENABLED=0 go build -C apps/core-gateway -o ../../bin/core-gateway .

# 3. Next.js Weboberfläche starten / bauen
npm --prefix apps/core-web ci
npm --prefix apps/core-web run build
```

## 📄 Lizenz

Veröffentlicht unter der [Synapse Source-Available Non-Commercial License](./LICENSE) (`Copyright (c) 2026 SolidStateNetwork — Alle Rechte vorbehalten`). Kostenlos für private Nutzung, Tests und nicht-kommerzielles Self-Hosting; kommerzieller Verkauf, Weiterverkauf oder das Anbieten als Managed-Cloud-/SaaS-Dienst ist ohne schriftliche Lizenz von SolidStateNetwork streng untersagt. Hinweise zur Sicherheit findest du in [SECURITY.md](./SECURITY.md).
