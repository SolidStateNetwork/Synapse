"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BookOpen,
  Command,
  ExternalLink,
  FileCode,
  FolderGit2,
  Globe,
  Layers,
  Lock,
  Network,
  RotateCcw,
  Search,
  Server,
  Settings,
  Shield,
  Sparkles,
  Terminal,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type {
  GatewayNode,
  NavSection,
  ProjectState,
} from "@/types/synapse";

export interface CommandPaletteItem {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: "orange" | "emerald" | "sky" | "violet" | "amber";
  icon: React.ComponentType<{ className?: string }>;
  onSelect: () => void | Promise<void>;
}

export interface CommandPaletteModalProps {
  open: boolean;
  onClose: () => void;
  activeProject: ProjectState | null;
  gatewayNodes: GatewayNode[];
  onNavigate: (nav: NavSection) => void;
  onOpenSettingsTab: (
    tab:
      | "system-update"
      | "watchdog-rbac"
      | "setup-keys"
      | "secrets-vault"
      | "ai-providers"
      | "mcp-server"
      | "debug-console"
      | "language"
  ) => void;
  onOpenBrainDoc: (doc: "Architecture.md" | "Memory.md") => void;
  onOpenServiceProxy: (port: number, serviceId?: string) => void;
  onOpenNodeTerminal: (nodeId: string) => void;
  onOpenNodeFirewall: (nodeId: string) => void;
  onRunCopilotSkill: (prompt: string) => void;
  sidebarItems?: unknown;
  setActiveNav?: unknown;
  onShowToast?: (msg: string) => void;
}

export default function CommandPaletteModal({
  open,
  onClose,
  activeProject,
  gatewayNodes,
  onNavigate,
  onOpenSettingsTab,
  onOpenBrainDoc,
  onOpenServiceProxy,
  onOpenNodeTerminal,
  onOpenNodeFirewall,
  onRunCopilotSkill,
  onShowToast,
}: CommandPaletteModalProps) {
  const { t, translateText } = useI18n();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const items = useMemo<CommandPaletteItem[]>(() => {
    const list: CommandPaletteItem[] = [];
    const services = activeProject?.registered_services || [];

    // 1. Navigation (All 9 Main Menus)
    const navEntries: Array<{
      id: NavSection;
      titleDe: string;
      titleEn: string;
      subDe: string;
      subEn: string;
      icon: React.ComponentType<{ className?: string }>;
    }> = [
      {
        id: "control-center",
        titleDe: "Übersicht (Interaktiver Canvas)",
        titleEn: "Overview (Interactive Canvas)",
        subDe: "Topologie, Live-Sparklines & 1-Klick Quick-Actions",
        subEn: "Topology, live sparklines & 1-click quick-actions",
        icon: Network,
      },
      {
        id: "reverse-proxy",
        titleDe: "Services (Reverse-Proxy & API-Tester)",
        titleEn: "Services (Reverse Proxy & API Tester)",
        subDe: "Alle bereitgestellten HTTP/SQLite-Endpunkte live testen",
        subEn: "Test all deployed HTTP/SQLite endpoints live",
        icon: Globe,
      },
      {
        id: "peers",
        titleDe: "Server & Mesh-Netzwerk",
        titleEn: "Servers & Mesh Network",
        subDe: "Multi-Core Muscle-Server, P2P-Links, Blueprints & Playbooks",
        subEn: "Multi-Core Muscle servers, P2P links, blueprints & playbooks",
        icon: Server,
      },
      {
        id: "brain-vault",
        titleDe: "Brain Vault (Wissensspeicher)",
        titleEn: "Brain Vault (Knowledge Store)",
        subDe: "Architecture.md & Memory.md einsehen und bearbeiten",
        subEn: "View and edit Architecture.md & Memory.md",
        icon: BookOpen,
      },
      {
        id: "workspace",
        titleDe: "Dateien (Remote-Workspace Explorer)",
        titleEn: "Files (Remote Workspace Explorer)",
        subDe: "Dateien auf dem Muscle-Server bearbeiten & Diffs anwenden",
        subEn: "Edit files on the Muscle server & apply diffs",
        icon: FolderGit2,
      },
      {
        id: "firewall",
        titleDe: "Firewall & Port-Shield",
        titleEn: "Firewall & Port Shield",
        subDe: "UFW/iptables Regeln, Port-Freigaben & Anti-Lockout-Schutz",
        subEn: "UFW/iptables rules, port shielding & anti-lockout guard",
        icon: Shield,
      },
      {
        id: "access-control",
        titleDe: "Regeln & Sicherheits-Cartridges",
        titleEn: "Rules & Security Cartridges",
        subDe: "Autonomie-Stufen & DevOps-Leitplanken verwalten",
        subEn: "Manage autonomy tiers & DevOps guardrails",
        icon: Lock,
      },
      {
        id: "activity",
        titleDe: "Audit-Log & Aktivitäten",
        titleEn: "Audit Log & Activity",
        subDe: "Revisionssicheres Protokoll aller KI- & System-Aktionen",
        subEn: "Tamper-evident log of all AI & system actions",
        icon: Activity,
      },
      {
        id: "settings",
        titleDe: "Einstellungen & System-Konfiguration",
        titleEn: "Settings & System Configuration",
        subDe: "RBAC, Server-Onboarding, Geheimnis-Tresor, KI, MCP & Debug",
        subEn: "RBAC, Server Onboarding, Secret Vault, AI, MCP & Debug",
        icon: Settings,
      },
    ];

    for (const nav of navEntries) {
      list.push({
        id: `nav:${nav.id}`,
        category: t("Menüs & Navigation", "Menus & Navigation"),
        title: t(nav.titleDe, nav.titleEn),
        subtitle: t(nav.subDe, nav.subEn),
        badge: t("Menü", "Menu"),
        badgeColor: "orange",
        icon: nav.icon,
        onSelect: () => {
          onNavigate(nav.id);
          onClose();
        },
      });
    }

    // 2. Active Services & Autonomous Self-Healing Actions
    for (const svc of services) {
      const svcName = translateText(svc.name);
      list.push({
        id: `svc-heal:${svc.service_id}`,
        category: t(
          "Dienste & Autonomous Self-Healing",
          "Services & Autonomous Self-Healing"
        ),
        title: `${t("⚡ Autonomous Self-Heal / Neustart:", "⚡ Autonomous Self-Heal / Restart:")} ${svcName} (:${svc.port})`,
        subtitle: t(
          `Startet den Dienst auf ${svc.node_id} neu, sichert Logs und prüft HTTP 200`,
          `Restarts service on ${svc.node_id}, captures logs and verifies HTTP 200`
        ),
        badge: `:${svc.port}`,
        badgeColor: "emerald",
        icon: RotateCcw,
        onSelect: async () => {
          setBusyItemId(`svc-heal:${svc.service_id}`);
          try {
            const res = await fetch("/api/service-ops", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "self_heal",
                project_id: activeProject?.project_id || "synapse-cloud-demo",
                node_id: svc.node_id || "vps2-muscle",
                service_id: svc.service_id,
                service_name: svc.name,
                port: svc.port,
              }),
            });
            const data = await res.json();
            if (data.ok && onShowToast) {
              onShowToast(
                t(
                  `⚡ ${svcName} (:${svc.port}) geheilt in ${data.event?.mttr_ms || 120} ms`,
                  `⚡ ${svcName} (:${svc.port}) healed in ${data.event?.mttr_ms || 120} ms`
                )
              );
            }
          } finally {
            setBusyItemId(null);
            onClose();
          }
        },
      });

      list.push({
        id: `svc-crash:${svc.service_id}`,
        category: t(
          "Dienste & Autonomous Self-Healing",
          "Services & Autonomous Self-Healing"
        ),
        title: `${t("💥 Crash & Auto-Heal simulieren:", "💥 Simulate Crash & Auto-Heal:")} ${svcName} (:${svc.port})`,
        subtitle: t(
          `Beendet Prozess auf :${svc.port} und führt das Self-Healing-Runbook live aus`,
          `Terminates process on :${svc.port} and executes the live Self-Healing runbook`
        ),
        badge: "Chaos + Heal",
        badgeColor: "amber",
        icon: Wrench,
        onSelect: async () => {
          setBusyItemId(`svc-crash:${svc.service_id}`);
          try {
            const res = await fetch("/api/service-ops", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "simulate_crash_and_heal",
                project_id: activeProject?.project_id || "synapse-cloud-demo",
                node_id: svc.node_id || "vps2-muscle",
                service_id: svc.service_id,
                service_name: svc.name,
                port: svc.port,
                simulate_crash: true,
              }),
            });
            const data = await res.json();
            if (data.ok && onShowToast) {
              onShowToast(
                t(
                  `⚡ Crash geheilt: ${svcName} (:${svc.port}) in ${data.event?.mttr_ms || 140} ms`,
                  `⚡ Crash recovered: ${svcName} (:${svc.port}) in ${data.event?.mttr_ms || 140} ms`
                )
              );
            }
          } finally {
            setBusyItemId(null);
            onClose();
          }
        },
      });

      list.push({
        id: `svc-open:${svc.service_id}`,
        category: t(
          "Dienste & Autonomous Self-Healing",
          "Services & Autonomous Self-Healing"
        ),
        title: `${t("🌐 Im Reverse-Proxy öffnen:", "🌐 Open in Reverse Proxy:")} ${svcName} (:${svc.port})`,
        subtitle: `${svc.node_id} · 127.0.0.1:${svc.port}`,
        badge: "Proxy",
        badgeColor: "sky",
        icon: ExternalLink,
        onSelect: () => {
          onOpenServiceProxy(svc.port, svc.service_id);
          onClose();
        },
      });
    }

    // 3. Connected Muscle Nodes
    for (const gn of gatewayNodes) {
      const cores = gn.last_heartbeat?.active_cores ?? 1;
      list.push({
        id: `node-pty:${gn.node_id}`,
        category: t("Muscle-Server", "Muscle Servers"),
        title: `${t("Live-Terminal (PTY) öffnen:", "Open Live Terminal (PTY):")} ${gn.node_id}`,
        subtitle: `${gn.last_heartbeat?.private_ipv4 || gn.remote_addr} · ${cores} Core(s)`,
        badge: "PTY",
        badgeColor: "emerald",
        icon: Terminal,
        onSelect: () => {
          onOpenNodeTerminal(gn.node_id);
          onClose();
        },
      });
      list.push({
        id: `node-fw:${gn.node_id}`,
        category: t("Muscle-Server", "Muscle Servers"),
        title: `${t("Firewall & Ports verwalten:", "Manage Firewall & Ports:")} ${gn.node_id}`,
        subtitle: t(
          "UFW/iptables Regeln & Port-Shield für diesen Server öffnen",
          "Open UFW/iptables rules & port shield for this server"
        ),
        badge: "Firewall",
        badgeColor: "sky",
        icon: Shield,
        onSelect: () => {
          onOpenNodeFirewall(gn.node_id);
          onClose();
        },
      });
    }

    // 4. Brain Vault Documents & Settings Sub-Tabs
    list.push(
      {
        id: "doc:arch",
        category: "Brain Vault & Einstellungen",
        title: t(
          "Brain Vault: Architecture.md öffnen",
          "Brain Vault: Open Architecture.md"
        ),
        subtitle: t(
          "Infrastruktur-Architektur & Topologie-Dokumentation",
          "Infrastructure architecture & topology documentation"
        ),
        badge: "Markdown",
        badgeColor: "violet",
        icon: FileCode,
        onSelect: () => {
          onOpenBrainDoc("Architecture.md");
          onClose();
        },
      },
      {
        id: "doc:mem",
        category: "Brain Vault & Einstellungen",
        title: t(
          "Brain Vault: Memory.md öffnen",
          "Brain Vault: Open Memory.md"
        ),
        subtitle: t(
          "Chronologisches Gedächtnis aller Deployments & Auto-Heals",
          "Chronological memory of all deployments & auto-heals"
        ),
        badge: "Markdown",
        badgeColor: "violet",
        icon: BookOpen,
        onSelect: () => {
          onOpenBrainDoc("Memory.md");
          onClose();
        },
      },
      {
        id: "set:onboarding",
        category: "Brain Vault & Einstellungen",
        title: t(
          "Einstellungen: Server-Onboarding & Multi-Core (axon add-core)",
          "Settings: Server Onboarding & Multi-Core (axon add-core)"
        ),
        subtitle: t(
          "Setup-Schlüssel erzeugen & weiteren Core verbinden",
          "Generate setup key & connect additional Core"
        ),
        badge: "Multi-Core",
        badgeColor: "violet",
        icon: Layers,
        onSelect: () => {
          onOpenSettingsTab("setup-keys");
          onClose();
        },
      },
      {
        id: "set:debug",
        category: "Brain Vault & Einstellungen",
        title: t(
          "Einstellungen: 7-Phasen Debug & Selbsttest",
          "Settings: 7-Phase Debug & Self-Diagnostic"
        ),
        subtitle: t(
          "Vollständige System-Diagnose über Vault, Gateway & Muscle",
          "Full system diagnostic across Vault, Gateway & Muscle"
        ),
        badge: "Diagnose",
        badgeColor: "emerald",
        icon: Zap,
        onSelect: () => {
          onOpenSettingsTab("debug-console");
          onClose();
        },
      }
    );

    // 5. AI Copilot DevOps Skills
    const skills: Array<{
      id: string;
      titleDe: string;
      titleEn: string;
      prompt: string;
    }> = [
      {
        id: "skill:syscheck",
        titleDe: "KI-Skill: 6-Phasen System- & SRE-Check ausführen",
        titleEn: "AI Skill: Run 6-Phase System & SRE Check",
        prompt:
          "Führe einen vollständigen System-Check auf vps2-muscle durch (Uptime, CPU/RAM, aktive Ports und Dienste).",
      },
      {
        id: "skill:opsec",
        titleDe: "KI-Skill: OpSec- & Firewall-Audit starten",
        titleEn: "AI Skill: Run OpSec & Firewall Audit",
        prompt:
          "Prüfe die offene Port-Landschaft, SSH-Sicherheit und Firewall-Regeln auf vps2-muscle.",
      },
      {
        id: "skill:forensics",
        titleDe: "KI-Skill: Deep-Forensik & Fehleranalyse starten",
        titleEn: "AI Skill: Run Deep Forensics & Log Analysis",
        prompt:
          "Analysiere die neuesten Prozess- und Service-Logs auf vps2-muscle auf Warnungen oder Fehler.",
      },
    ];

    for (const sk of skills) {
      list.push({
        id: sk.id,
        category: t("KI-Copilot DevOps-Skills", "AI Copilot DevOps Skills"),
        title: t(sk.titleDe, sk.titleEn),
        subtitle: sk.prompt,
        badge: "AI Skill",
        badgeColor: "orange",
        icon: Sparkles,
        onSelect: () => {
          onRunCopilotSkill(sk.prompt);
          onClose();
        },
      });
    }

    return list;
  }, [
    activeProject,
    gatewayNodes,
    onClose,
    onNavigate,
    onOpenBrainDoc,
    onOpenNodeFirewall,
    onOpenNodeTerminal,
    onOpenServiceProxy,
    onOpenSettingsTab,
    onRunCopilotSkill,
    onShowToast,
    t,
    translateText,
  ]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.badge && item.badge.toLowerCase().includes(q))
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        onClose();
      } else if (ev.key === "ArrowDown") {
        ev.preventDefault();
        setSelectedIndex((prev) =>
          filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0
        );
      } else if (ev.key === "ArrowUp") {
        ev.preventDefault();
        setSelectedIndex((prev) =>
          filteredItems.length > 0
            ? (prev - 1 + filteredItems.length) % filteredItems.length
            : 0
        );
      } else if (ev.key === "Enter" && filteredItems[selectedIndex]) {
        ev.preventDefault();
        void filteredItems[selectedIndex].onSelect();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, filteredItems, selectedIndex, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-nb-gray-950/80 pt-[10vh] backdrop-blur-sm p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-nb-gray-800 bg-nb-gray-940 shadow-2xl"
      >
        {/* Top Search Input */}
        <div className="flex items-center gap-3 border-b border-nb-gray-800 bg-nb-gray-950 px-4 py-3.5">
          <Search className="h-4 w-4 shrink-0 text-netbird" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(
              "Befehl, Menü, Server, Port (:4060), Self-Heal oder KI-Skill suchen...",
              "Search command, menu, server, port (:4060), Self-Heal or AI skill..."
            )}
            className="flex-1 bg-transparent text-sm text-white placeholder-nb-gray-500 focus:outline-none"
          />
          <div className="flex items-center gap-1.5">
            <span className="rounded border border-nb-gray-800 bg-nb-gray-900 px-1.5 py-0.5 font-mono text-[10px] text-nb-gray-400">
              ESC
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filtered Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center text-xs text-nb-gray-400">
              {t(
                "Keine passenden Befehle, Dienste oder Menüs gefunden.",
                "No matching commands, services, or menus found."
              )}
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              const isBusy = busyItemId === item.id;
              const showCatHeader =
                idx === 0 ||
                filteredItems[idx - 1].category !== item.category;

              return (
                <React.Fragment key={item.id}>
                  {showCatHeader && (
                    <div className="px-3 pt-2 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-500">
                      {item.category}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={isBusy}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => void item.onSelect()}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      isSelected
                        ? "bg-nb-gray-900 text-white ring-1 ring-netbird/40"
                        : "text-nb-gray-300 hover:bg-nb-gray-900/60"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                          isSelected
                            ? "border-netbird/50 bg-netbird-950 text-netbird"
                            : "border-nb-gray-800 bg-nb-gray-950 text-nb-gray-400"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-white">
                          {item.title}
                        </div>
                        <div className="truncate text-[11px] text-nb-gray-400">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>

                    {item.badge && (
                      <span
                        className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                          item.badgeColor === "emerald"
                            ? "border-emerald-500/40 bg-emerald-950/70 text-emerald-300"
                            : item.badgeColor === "sky"
                            ? "border-sky-500/40 bg-sky-950/70 text-sky-300"
                            : item.badgeColor === "violet"
                            ? "border-violet-500/40 bg-violet-950/70 text-violet-300"
                            : item.badgeColor === "amber"
                            ? "border-amber-500/40 bg-amber-950/70 text-amber-300"
                            : "border-netbird-500/40 bg-netbird-950 text-netbird"
                        }`}
                      >
                        {isBusy ? "..." : item.badge}
                      </span>
                    )}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="flex items-center justify-between border-t border-nb-gray-800 bg-nb-gray-950 px-4 py-2 text-[11px] text-nb-gray-400">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Command className="h-3 w-3 text-netbird" />
              <span>Synapse Command Palette (v0.7.0)</span>
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px]">
            <span>↑↓ {t("Auswählen", "Navigate")}</span>
            <span>↵ {t("Ausführen", "Execute")}</span>
            <span>ESC {t("Schließen", "Close")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
