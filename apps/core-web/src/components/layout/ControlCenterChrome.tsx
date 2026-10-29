"use client";

import React from "react";
import {
  AlertTriangle,
  ChevronsUpDown,
  Lock,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { LanguageSwitcher } from "@/lib/i18n";
import {
  GatewayNode,
  NavSection,
  ProjectState,
} from "@/types/synapse";

type RegisteredService = ProjectState["registered_services"][number];

export interface SidebarNavItem {
  id: NavSection;
  section: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  badge?: string | number;
  badgeColor?: "orange" | "green" | "red";
}

export interface SystemUpdateSummary {
  git?: {
    local_short?: string;
    remote_short?: string;
    commits_behind?: number;
    update_available?: boolean;
  };
  nodes?: Array<{
    node_id: string;
    online: boolean;
    up_to_date?: boolean;
  }>;
}

export interface ControlCenterSidebarProps {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  activeNav: NavSection;
  setActiveNav: (nav: NavSection) => void;
  projects: ProjectState[];
  activeProject: ProjectState | null;
  loadWorkspace: (projectId: string, clearChat?: boolean) => void;
  setNewProjectModal: (open: boolean) => void;
  sidebarItems: SidebarNavItem[];
  gatewayNodes: GatewayNode[];
  systemUpdateStatus: SystemUpdateSummary | null;
  systemUpdateBusy: boolean;
  onOpenSystemUpdateTab: () => void;
  onRunSystemUpdate: (action: "check" | "update_all") => void;
}

export function ControlCenterSidebar({
  sidebarCollapsed,
  setSidebarCollapsed,
  activeNav,
  setActiveNav,
  projects,
  activeProject,
  loadWorkspace,
  setNewProjectModal,
  sidebarItems,
  gatewayNodes,
  systemUpdateStatus,
  systemUpdateBusy,
  onOpenSystemUpdateTab,
  onRunSystemUpdate,
}: ControlCenterSidebarProps) {
  const coreUpdateAvailable = Boolean(
    systemUpdateStatus?.git?.update_available ||
      (systemUpdateStatus?.git?.commits_behind ?? 0) > 0
  );
  const outdatedNodes = (systemUpdateStatus?.nodes || []).filter(
    (n) => n.online && n.up_to_date === false
  );
  const hasAnyUpdate = coreUpdateAvailable || outdatedNodes.length > 0;
  const localShort = systemUpdateStatus?.git?.local_short || "latest";
  const remoteShort = systemUpdateStatus?.git?.remote_short || localShort;
  const onlineCount = gatewayNodes.filter((n) => n.online).length;

  return (
    <aside
      className={`flex shrink-0 flex-col justify-between border-r border-nb-gray-900 bg-nb-gray-950 transition-all duration-200 ${
        sidebarCollapsed ? "w-[68px]" : "w-[228px]"
      }`}
    >
      {/* Top Brand + Project Switcher */}
      <div className={sidebarCollapsed ? "space-y-3 p-2.5" : "space-y-3 p-3.5"}>
        <div
          className={
            sidebarCollapsed
              ? "flex flex-col items-center gap-2"
              : "flex items-center justify-between px-1.5"
          }
        >
          <div
            onClick={() => setActiveNav("control-center")}
            className="flex cursor-pointer items-center gap-2.5"
            title="Synapse Control Center"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird shadow-sm">
              <Network className="h-4 w-4 text-netbird" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col leading-none">
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-semibold tracking-tight text-white">
                    Synapse
                  </span>
                </div>
                <span className="mt-0.5 text-[10px] text-nb-gray-400">
                  Control Center
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white transition-colors"
            title={
              sidebarCollapsed ? "Sidebar ausklappen" : "Sidebar einklappen"
            }
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Project Selector Pill */}
        {!sidebarCollapsed && (
          <div className="flex items-center gap-1.5 px-1">
            <div className="relative flex-1">
              <select
                value={activeProject?.project_id || ""}
                onChange={(e) => loadWorkspace(e.target.value, true)}
                className="w-full appearance-none rounded-md border border-nb-gray-800/80 bg-nb-gray-930 pl-3 pr-7 py-1.5 text-xs font-medium text-nb-gray-100 hover:border-nb-gray-700 focus:border-netbird focus:outline-none"
              >
                {projects.map((p) => (
                  <option
                    key={p.project_id}
                    value={p.project_id}
                    className="bg-nb-gray-940 text-white"
                  >
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronsUpDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5 text-nb-gray-400" />
            </div>
            <button
              onClick={() => setNewProjectModal(true)}
              className="rounded-md border border-nb-gray-800/80 bg-nb-gray-930 p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
              title="Neues Projekt anlegen"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Categorized Navigation List */}
        <ul className="space-y-1 pt-1">
          {sidebarItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            const showSectionHeader =
              !sidebarCollapsed &&
              (idx === 0 || sidebarItems[idx - 1].section !== item.section);
            return (
              <React.Fragment key={item.id}>
                {showSectionHeader && (
                  <li className="list-none px-2.5 pt-2.5 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-500">
                    {item.section}
                  </li>
                )}
                <li className="list-none">
                  <button
                    onClick={() => setActiveNav(item.id)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`relative flex w-full items-center rounded-lg text-[0.84rem] font-normal transition-colors ${
                      sidebarCollapsed
                        ? "justify-center p-2.5"
                        : "justify-between px-3 py-[0.46rem]"
                    } ${
                      isActive
                        ? "bg-nb-gray-900 text-white"
                        : "text-nb-gray-400 hover:bg-nb-gray-900/50 hover:text-nb-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        size={16}
                        className={`shrink-0 ${
                          isActive ? "text-netbird" : "text-nb-gray-400"
                        }`}
                      />
                      {!sidebarCollapsed && (
                        <span className="whitespace-nowrap">{item.label}</span>
                      )}
                    </div>
                    {sidebarCollapsed && item.badge !== undefined && (
                      <span
                        className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ${
                          item.badgeColor === "red"
                            ? "bg-red-500 animate-pulse"
                            : "bg-netbird"
                        }`}
                      />
                    )}
                    {!sidebarCollapsed && item.badge !== undefined && (
                      <span
                        className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] leading-none ${
                          item.badgeColor === "orange"
                            ? "border-netbird-500 bg-netbird-950 text-netbird"
                            : item.badgeColor === "red"
                            ? "border-red-500 bg-red-950/60 text-red-400 animate-pulse"
                            : "border-nb-gray-800 bg-nb-gray-930 text-nb-gray-300"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      </div>

      {/* Bottom-Left NetBird-Style Mesh Status + Version & Update Footer */}
      {sidebarCollapsed ? (
        <div className="space-y-2 border-t border-nb-gray-900/80 p-2.5">
          <div
            className="flex justify-center py-1"
            title={
              activeProject?.planning_only
                ? "Planning-Only"
                : `mTLS 1.3 Mesh (${onlineCount} online)`
            }
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                activeProject?.planning_only
                  ? "bg-amber-400"
                  : onlineCount > 0
                  ? "bg-emerald-400"
                  : "bg-red-400 animate-pulse"
              }`}
            />
          </div>
          <button
            type="button"
            onClick={onOpenSystemUpdateTab}
            title={
              hasAnyUpdate
                ? `Synapse v0.3.0 (${localShort}) — Update verfügbar (${remoteShort})`
                : `Synapse v0.3.0 (${localShort}) — Aktuell`
            }
            className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
              hasAnyUpdate
                ? "border-amber-500/60 bg-amber-950/60 text-amber-300 hover:bg-amber-900/50"
                : "border-nb-gray-800/80 bg-nb-gray-940 text-nb-gray-400 hover:text-white"
            }`}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                systemUpdateBusy ? "animate-spin text-emerald-400" : ""
              }`}
            />
            {hasAnyUpdate && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-2 border-t border-nb-gray-900/80 p-3">
          {/* NetBird-Style Version & Update Card (Bottom-Left) */}
          <div
            className={`rounded-lg border px-3 py-2.5 text-[11px] transition-colors ${
              hasAnyUpdate
                ? "border-amber-500/50 bg-amber-950/25"
                : "border-nb-gray-900 bg-nb-gray-940/50"
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <button
                type="button"
                onClick={onOpenSystemUpdateTab}
                title="System-Update & Versionsdetails öffnen"
                className="group flex min-w-0 items-center gap-1.5 text-left"
              >
                <span className="whitespace-nowrap font-semibold text-nb-gray-100 group-hover:text-white">
                  v0.3.0
                </span>
                <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[9px] text-nb-gray-400">
                  {localShort}
                </span>
              </button>

              <div className="flex shrink-0 items-center gap-1">
                {!hasAnyUpdate && (
                  <span className="rounded border border-emerald-500/30 bg-emerald-950/40 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400">
                    Aktuell
                  </span>
                )}
                <button
                  type="button"
                  disabled={systemUpdateBusy}
                  onClick={() => onRunSystemUpdate("check")}
                  title="Auf Updates prüfen"
                  className="rounded p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white disabled:opacity-40 transition-colors"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${
                      systemUpdateBusy ? "animate-spin text-netbird" : ""
                    }`}
                  />
                </button>
              </div>
            </div>

            {hasAnyUpdate && (
              <div className="mt-2 space-y-1.5 border-t border-amber-500/30 pt-2">
                <div className="flex items-center justify-between gap-1.5 leading-tight">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-300">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 animate-pulse" />
                    <span>Update verfügbar</span>
                  </span>
                  <span className="font-mono text-[9.5px] text-amber-200/90">
                    {coreUpdateAvailable
                      ? `Neu: ${remoteShort} (+${
                          systemUpdateStatus?.git?.commits_behind ?? 0
                        })`
                      : `${outdatedNodes.length} Muscle-Node OTA`}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={systemUpdateBusy}
                  onClick={() => onRunSystemUpdate("update_all")}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-netbird px-2.5 py-1 text-[10.5px] font-semibold text-white shadow-sm hover:bg-netbird-500 disabled:opacity-40 transition-colors"
                >
                  <RefreshCw
                    className={`h-2.5 w-2.5 ${
                      systemUpdateBusy ? "animate-spin" : ""
                    }`}
                  />
                  <span>Jetzt aktualisieren</span>
                </button>
              </div>
            )}
          </div>

          {/* Mesh Status Row */}
          <div className="flex items-center justify-between rounded-lg border border-nb-gray-900 bg-nb-gray-940/70 px-3 py-1.5 text-[11px] text-nb-gray-400">
            <span className="flex items-center gap-2 text-nb-gray-200">
              <span
                className={`h-2 w-2 rounded-full ${
                  activeProject?.planning_only
                    ? "bg-amber-400"
                    : onlineCount > 0
                    ? "bg-emerald-400"
                    : "bg-red-400 animate-pulse"
                }`}
              />
              {activeProject?.planning_only ? "Planning-Only" : "mTLS 1.3 Mesh"}
            </span>
            <span className="font-mono text-[10px] text-nb-gray-400">
              {onlineCount} online
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}

export interface ControlCenterHeaderProps {
  activeProject: ProjectState | null;
  activeNavLabel?: string;
  primaryNode: string;
  primaryNodeOnline: boolean;
  statusToast: string | null;
  copilotDrawerOpen: boolean;
  setCopilotDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenPeers: () => void;
  onOpenAddPeerModal: () => void;
}

export function ControlCenterHeader({
  activeProject,
  activeNavLabel,
  primaryNode,
  primaryNodeOnline,
  statusToast,
  copilotDrawerOpen,
  setCopilotDrawerOpen,
  onOpenPeers,
  onOpenAddPeerModal,
}: ControlCenterHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-nb-gray-900 bg-nb-gray-950 px-6 py-3">
      {/* Left: Breadcrumbs + Active Peer Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-normal text-nb-gray-400">
            {activeProject?.name || "synapse-cloud-demo"}
          </span>
          <span className="text-nb-gray-700">/</span>
          <span className="font-medium text-nb-gray-100">
            {activeNavLabel || "Übersicht"}
          </span>
        </div>

        {primaryNode ? (
          <div
            onClick={onOpenPeers}
            className={`hidden md:flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] transition ${
              primaryNodeOnline
                ? "border-emerald-500/30 bg-emerald-950/50 text-emerald-400 hover:bg-emerald-950"
                : "border-amber-500/40 bg-amber-950/50 text-amber-300 hover:bg-amber-950"
            }`}
            title={
              primaryNodeOnline
                ? "Verbundenen Server anzeigen (mTLS 1.3 aktiv)"
                : "Server wird automatisch wiederverbunden..."
            }
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                primaryNodeOnline
                  ? "bg-emerald-400"
                  : "bg-amber-400 animate-pulse"
              }`}
            />
            <span className="font-mono">{primaryNode}</span>
          </div>
        ) : (
          <button
            onClick={onOpenAddPeerModal}
            className="hidden md:flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950/50 px-2.5 py-0.5 text-[11px] text-amber-400 hover:bg-amber-950"
          >
            <Lock className="h-3 w-3" />
            <span>Planning-Only</span>
          </button>
        )}
      </div>

      {/* Right: Essential Global Controls (Language + Copilot + Server) */}
      <div className="flex items-center gap-2">
        {statusToast && (
          <span className="hidden xl:inline-block rounded-md border border-emerald-500/40 bg-emerald-950 px-2.5 py-1 font-mono text-[11px] text-emerald-400">
            {statusToast}
          </span>
        )}

        <LanguageSwitcher variant="header" />

        <button
          onClick={() => setCopilotDrawerOpen((v) => !v)}
          className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${
            copilotDrawerOpen
              ? "border-netbird-500/60 bg-netbird-950 text-netbird"
              : "border-nb-gray-800/80 bg-nb-gray-930 text-nb-gray-300 hover:text-white"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>AI Copilot</span>
        </button>

        <button
          onClick={onOpenAddPeerModal}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-transparent bg-netbird px-3 text-xs font-medium text-white shadow-sm hover:bg-netbird-500 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Server</span>
        </button>
      </div>
    </header>
  );
}

export interface UnhealthyServiceBannerProps {
  unhealthyServices: RegisteredService[];
  onDiagnoseService: (port: number) => void;
  onRemoveService: (serviceId: string, nodeId: string) => void;
}

export function UnhealthyServiceBanner({
  unhealthyServices,
  onDiagnoseService,
  onRemoveService,
}: UnhealthyServiceBannerProps) {
  if (unhealthyServices.length === 0) return null;

  return (
    <div className="flex items-center justify-between border-b border-red-500/40 bg-red-950/40 px-5 py-2 text-xs">
      <div className="flex items-center gap-2 text-red-300">
        <AlertTriangle className="h-4 w-4 text-red-400 animate-pulse" />
        <span>
          <strong>Dienst-Gesundheitswarnung:</strong>{" "}
          {unhealthyServices
            .map(
              (s) =>
                `${s.name} (:${s.port} auf ${s.node_id}) — ${
                  s.health_check?.last_error || "Verbindung fehlgeschlagen"
                }`
            )
            .join(" | ")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onDiagnoseService(unhealthyServices[0].port)}
          className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-red-500"
        >
          <Wrench className="h-3 w-3" />
          <span>KI um Diagnose &amp; Reparatur bitten</span>
        </button>
        <button
          onClick={() =>
            onRemoveService(
              unhealthyServices[0].service_id,
              unhealthyServices[0].node_id
            )
          }
          className="flex items-center gap-1 rounded-md border border-red-500/50 bg-nb-gray-940 px-2.5 py-1 text-[11px] font-medium text-red-300 hover:bg-red-950"
          title="Diesen Dienst aus dem Projekt entfernen"
        >
          <Trash2 className="h-3 w-3" />
          <span>Dienst entfernen</span>
        </button>
      </div>
    </div>
  );
}
