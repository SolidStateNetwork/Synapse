"use client";

import React from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  ChevronDown,
  ChevronUp,
  Cpu,
  Globe,
  KeyRound,
  Lock,
  RefreshCw,
  Server,
  Settings2,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { LanguageSwitcher } from "@/lib/i18n";
import {
  SynapseSubTabs,
  SynapseViewHeader,
} from "@/components/ui/SynapseDesignSystem";
import {
  AutonomyTier,
  PROVIDER_PRESETS,
  ProjectState,
} from "@/types/synapse";

export type SettingsTabId =
  | "system-update"
  | "watchdog-rbac"
  | "setup-keys"
  | "secrets-vault"
  | "ai-providers"
  | "mcp-server"
  | "debug-console"
  | "language";

export interface SystemUpdateStatusSnapshot {
  checked_at: string;
  git: {
    branch: string;
    local_short: string;
    local_full: string;
    local_date: string;
    local_subject: string;
    remote_short: string;
    remote_full: string;
    remote_date: string;
    remote_subject: string;
    commits_behind: number;
    commits_ahead: number;
    update_available: boolean;
  };
  binaries: {
    core_gateway: {
      exists: boolean;
      path: string;
      size_bytes: number;
      updated_at: string | null;
      sha256: string | null;
    };
    axon_linux_amd64: {
      exists: boolean;
      path: string;
      size_bytes: number;
      updated_at: string | null;
      sha256: string | null;
    };
  };
  nodes: Array<{
    node_id: string;
    online: boolean;
    tier: string;
    remote_addr: string;
    os_arch?: string;
    installed_sha256?: string | null;
    installed_mtime?: string | null;
    source_commit?: string | null;
    systemd_status?: string | null;
    up_to_date?: boolean;
  }>;
}

export interface SystemUpdateStepEntry {
  step: string;
  status: "ok" | "warn" | "error";
  detail: string;
  duration_ms: number;
}

export interface SettingsAlertConfigState {
  enabled: boolean;
  telegram_enabled: boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;
  discord_enabled: boolean;
  discord_webhook_url: string;
  webhook_enabled: boolean;
  webhook_url: string;
  cpu_threshold: number;
  ram_threshold: number;
  disk_threshold: number;
  auto_heal_services: boolean;
  events: Array<{
    id: string;
    timestamp: string;
    severity: string;
    title: string;
    message: string;
    dispatched_to: string[];
  }>;
}

export interface SelfTestCheckItem {
  id: string;
  name: string;
  status: "PASS" | "WARN" | "FAIL";
  latency_ms: number;
  detail: string;
}

export interface SettingsViewProps {
  activeProject: ProjectState | null;
  primaryNode: string;
  settingsTab: SettingsTabId;
  setSettingsTab: (tab: SettingsTabId) => void;
  secretKeys: string[];
  debugModeEnabled: boolean;
  fetchDebugSnapshot: () => void;
  fetchSystemUpdateStatus: (silent?: boolean, force?: boolean) => void;
  systemUpdateBusy: boolean;
  systemUpdateActionLabel: string;
  systemUpdateStatus: SystemUpdateStatusSnapshot | null;
  systemUpdateSteps: SystemUpdateStepEntry[];
  setSystemUpdateSteps: React.Dispatch<
    React.SetStateAction<SystemUpdateStepEntry[]>
  >;
  showReleaseNotes: boolean;
  setShowReleaseNotes: React.Dispatch<React.SetStateAction<boolean>>;
  handleRunSystemUpdate: (
    action: "check" | "update_all" | "update_core" | "update_muscle",
    targetNodeId?: string
  ) => void;
  gatewayUrl: string;
  setGatewayUrl: (val: string) => void;
  joinNodeName: string;
  setJoinNodeName: (val: string) => void;
  joinTier: AutonomyTier;
  setJoinTier: (val: AutonomyTier) => void;
  handleGenerateJoinToken: () => void;
  issuedToken: string | null;
  oneLineInstallerCmd: string;
  copiedJoinCmd: boolean;
  setCopiedJoinCmd: (val: boolean) => void;
  rebindCliCmd: string;
  copiedRebindCmd: boolean;
  setCopiedRebindCmd: (val: boolean) => void;
  newSecretKey: string;
  setNewSecretKey: (val: string) => void;
  newSecretVal: string;
  setNewSecretVal: (val: string) => void;
  handleAddSecret: (e: React.FormEvent) => void;
  handleDeleteSecret: (keyName: string) => void;
  provider: string;
  setProvider: (val: string) => void;
  baseUrl: string;
  setBaseUrl: (val: string) => void;
  modelName: string;
  setModelName: (val: string) => void;
  handleSyncModels: () => void;
  syncingModels: boolean;
  modelSyncStatus: string;
  discoveredModels: string[];
  apiKeySecretName: string;
  apiKeyInput: string;
  setApiKeyInput: (val: string) => void;
  enablePromptCaching: boolean;
  setEnablePromptCaching: (val: boolean) => void;
  enableAutoWatchdog: boolean;
  setEnableAutoWatchdog: (val: boolean) => void;
  handleSaveAiEndpoint: (e: React.FormEvent) => void;
  mcpKeyName: string;
  setMcpKeyName: (val: string) => void;
  mcpKeyScopeMode: "read-exec" | "read-only";
  setMcpKeyScopeMode: (val: "read-exec" | "read-only") => void;
  handleCreateMcpKey: (e: React.FormEvent) => void;
  issuedMcpToken: string | null;
  copiedMcpToken: boolean;
  setCopiedMcpToken: (val: boolean) => void;
  showMcpConfigExamples: boolean;
  setShowMcpConfigExamples: React.Dispatch<React.SetStateAction<boolean>>;
  copiedMcpConfig: "json" | "curl" | null;
  setCopiedMcpConfig: (val: "json" | "curl" | null) => void;
  handleRevokeMcpKey: (keyId: string) => void;
  handleTestMcpEndpoint: (
    mode: "tools/list" | "resources/list" | "call_state"
  ) => void;
  mcpTestOutput: string;
  handleToggleDebugMode: () => void;
  handleRunSelfTest: () => void;
  runningSelfTest: boolean;
  selfTestChecks: SelfTestCheckItem[];
  debugSnapshot: Record<string, unknown> | null;
  settingsAlertConfig: SettingsAlertConfigState | null;
  setSettingsAlertConfig: React.Dispatch<
    React.SetStateAction<SettingsAlertConfigState | null>
  >;
  settingsAlertNotice: string | null;
  setSettingsAlertNotice: (val: string | null) => void;
  settingsAuthEnabled: boolean;
  setSettingsAuthEnabled: (val: boolean) => void;
  settingsAdminPwd: string;
  setSettingsAdminPwd: (val: string) => void;
  settingsOperatorPwd: string;
  setSettingsOperatorPwd: (val: string) => void;
  settingsTotpPin: string;
  setSettingsTotpPin: (val: string) => void;
  settingsAuthNotice: string | null;
  setSettingsAuthNotice: (val: string | null) => void;
}

export default function SettingsView({
  activeProject,
  primaryNode,
  settingsTab,
  setSettingsTab,
  secretKeys,
  debugModeEnabled,
  fetchDebugSnapshot,
  fetchSystemUpdateStatus,
  systemUpdateBusy,
  systemUpdateActionLabel,
  systemUpdateStatus,
  systemUpdateSteps,
  setSystemUpdateSteps,
  showReleaseNotes,
  setShowReleaseNotes,
  handleRunSystemUpdate,
  gatewayUrl,
  setGatewayUrl,
  joinNodeName,
  setJoinNodeName,
  joinTier,
  setJoinTier,
  handleGenerateJoinToken,
  issuedToken,
  oneLineInstallerCmd,
  copiedJoinCmd,
  setCopiedJoinCmd,
  rebindCliCmd,
  copiedRebindCmd,
  setCopiedRebindCmd,
  newSecretKey,
  setNewSecretKey,
  newSecretVal,
  setNewSecretVal,
  handleAddSecret,
  handleDeleteSecret,
  provider,
  setProvider,
  baseUrl,
  setBaseUrl,
  modelName,
  setModelName,
  handleSyncModels,
  syncingModels,
  modelSyncStatus,
  discoveredModels,
  apiKeySecretName,
  apiKeyInput,
  setApiKeyInput,
  enablePromptCaching,
  setEnablePromptCaching,
  enableAutoWatchdog,
  setEnableAutoWatchdog,
  handleSaveAiEndpoint,
  mcpKeyName,
  setMcpKeyName,
  mcpKeyScopeMode,
  setMcpKeyScopeMode,
  handleCreateMcpKey,
  issuedMcpToken,
  copiedMcpToken,
  setCopiedMcpToken,
  showMcpConfigExamples,
  setShowMcpConfigExamples,
  copiedMcpConfig,
  setCopiedMcpConfig,
  handleRevokeMcpKey,
  handleTestMcpEndpoint,
  mcpTestOutput,
  handleToggleDebugMode,
  handleRunSelfTest,
  runningSelfTest,
  selfTestChecks,
  debugSnapshot,
  settingsAlertConfig,
  setSettingsAlertConfig,
  settingsAlertNotice,
  setSettingsAlertNotice,
  settingsAuthEnabled,
  setSettingsAuthEnabled,
  settingsAdminPwd,
  setSettingsAdminPwd,
  settingsOperatorPwd,
  setSettingsOperatorPwd,
  settingsTotpPin,
  setSettingsTotpPin,
  settingsAuthNotice,
  setSettingsAuthNotice,
}: SettingsViewProps) {
  return (
    <div className="mx-auto max-w-6xl p-6 space-y-5">
      <SynapseViewHeader
        icon={<Settings2 className="h-5 w-5" />}
        accentColor="indigo"
        title="System-Einstellungen, Tresor & KI-Konfiguration"
        description="Verwalte 1-Klick Over-the-Air System-Updates, Server-Koppelungsschlüssel, den AES-256-GCM Geheimnis-Tresor, KI-Modelle sowie den integrierten System-Selbsttest."
        subTabs={
          <SynapseSubTabs
            activeTab={settingsTab}
            onChange={(id) => {
              const nextId = id as SettingsTabId;
              setSettingsTab(nextId);
              if (nextId === "debug-console") fetchDebugSnapshot();
              if (nextId === "system-update")
                fetchSystemUpdateStatus(false, true);
            }}
            tabs={[
              {
                id: "system-update",
                label: "System-Update (OTA)",
                icon: <RefreshCw className="h-3.5 w-3.5" />,
              },
              {
                id: "watchdog-rbac",
                label: "Wächter & Login (RBAC)",
                icon: <Lock className="h-3.5 w-3.5" />,
              },
              {
                id: "setup-keys",
                label: "Server-Onboarding",
                icon: <Server className="h-3.5 w-3.5" />,
              },
              {
                id: "secrets-vault",
                label: "Geheimnis-Tresor",
                icon: <KeyRound className="h-3.5 w-3.5" />,
                badge: secretKeys.length,
              },
              {
                id: "ai-providers",
                label: "KI-Anbieter",
                icon: <Bot className="h-3.5 w-3.5" />,
              },
              {
                id: "mcp-server",
                label: "MCP-API",
                icon: <Sparkles className="h-3.5 w-3.5" />,
                badge: (activeProject?.mcp_api_keys || []).length,
              },
              {
                id: "debug-console",
                label: "Debug & Selbsttest",
                icon: <Activity className="h-3.5 w-3.5" />,
                badge: debugModeEnabled ? "ON" : "OFF",
              },
              {
                id: "language",
                label: "Sprache",
                icon: <Globe className="h-3.5 w-3.5" />,
              },
            ]}
          />
        }
      />

      {settingsTab === "system-update" && (
        <div className="space-y-5">
          {/* Top Action Card: 1-Click Core + Muscle OTA Rollout */}
          <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-950/60 text-emerald-400">
                    <RefreshCw
                      className={`h-4 w-4 ${
                        systemUpdateBusy ? "animate-spin" : ""
                      }`}
                    />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      System-Update &amp; Over-the-Air (OTA) Rollout
                    </h2>
                    <p className="text-xs text-nb-gray-400">
                      1-Klick Synchronisation für{" "}
                      <strong className="text-nb-gray-200">Core Plane</strong>{" "}
                      (Git, WebUI &amp; Gateway) und alle{" "}
                      <strong className="text-nb-gray-200">
                        Muscle-Server
                      </strong>{" "}
                      (<code className="text-emerald-300">/usr/local/bin/axon</code>{" "}
                      &amp; Systemd-Daemon).
                    </p>
                  </div>
                </div>
              </div>

              {systemUpdateStatus &&
                (() => {
                  const outdatedCount = systemUpdateStatus.nodes.filter(
                    (n) => !n.up_to_date
                  ).length;
                  const anyUpdate =
                    systemUpdateStatus.git.update_available ||
                    outdatedCount > 0;
                  return (
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 font-mono text-[11px] font-semibold ${
                          anyUpdate
                            ? "border-amber-500/50 bg-amber-950/60 text-amber-300"
                            : "border-emerald-500/50 bg-emerald-950/60 text-emerald-300"
                        }`}
                      >
                        {systemUpdateStatus.git.update_available
                          ? `Update verfügbar (+${systemUpdateStatus.git.commits_behind} Commits)`
                          : outdatedCount > 0
                            ? `${outdatedCount} Muscle-Node OTA verfügbar`
                            : `Aktuell (${systemUpdateStatus.git.local_short})`}
                      </span>
                    </div>
                  );
                })()}
            </div>

            {/* 4 Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                disabled={systemUpdateBusy}
                onClick={() => handleRunSystemUpdate("update_all")}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 transition"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Komplett-Update (Core + alle Muscles)</span>
              </button>

              <button
                type="button"
                disabled={systemUpdateBusy}
                onClick={() => handleRunSystemUpdate("update_core")}
                className="flex items-center gap-2 rounded-lg border border-netbird-500/50 bg-netbird-950/70 px-3.5 py-2.5 text-xs font-medium text-netbird hover:bg-netbird-900/60 disabled:opacity-50 transition"
              >
                <Brain className="h-3.5 w-3.5" />
                <span>Nur Core updaten</span>
              </button>

              <button
                type="button"
                disabled={systemUpdateBusy}
                onClick={() => handleRunSystemUpdate("update_muscle")}
                className="flex items-center gap-2 rounded-lg border border-sky-500/50 bg-sky-950/60 px-3.5 py-2.5 text-xs font-medium text-sky-300 hover:bg-sky-900/50 disabled:opacity-50 transition"
              >
                <Cpu className="h-3.5 w-3.5" />
                <span>Alle Muscles (OTA) updaten</span>
              </button>

              <button
                type="button"
                disabled={systemUpdateBusy}
                onClick={() => handleRunSystemUpdate("check")}
                className="flex items-center gap-2 rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2.5 text-xs font-medium text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white disabled:opacity-50 transition"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    systemUpdateBusy ? "animate-spin" : ""
                  }`}
                />
                <span>Auf Updates prüfen</span>
              </button>
            </div>

            {systemUpdateBusy && (
              <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-xs text-emerald-200">
                <RefreshCw className="h-4 w-4 animate-spin text-emerald-400 shrink-0" />
                <span>
                  <strong>{systemUpdateActionLabel}</strong> — Bitte einen
                  Moment warten, während Git-Commits, Binaries und
                  Systemd-Daemons synchronisiert werden...
                </span>
              </div>
            )}

            {/* Core & Muscle Status Grid */}
            {systemUpdateStatus && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 pt-2">
                {/* Left Card: Core Plane */}
                <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-950/90 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-nb-gray-900 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-netbird" />
                      <span className="text-xs font-semibold text-white">
                        Core Plane (WebUI, Orchestrator &amp; Gateway)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowReleaseNotes((prev) => !prev)}
                        className="inline-flex items-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-930 px-2 py-0.5 font-mono text-[10px] text-nb-gray-300 hover:border-nb-gray-700 hover:text-white transition"
                      >
                        <span>
                          {showReleaseNotes
                            ? "Release einklappen"
                            : "Release ausklappen"}
                        </span>
                        {showReleaseNotes ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                      <span className="rounded border border-netbird-500/40 bg-netbird-950/60 px-2 py-0.5 font-mono text-[10px] text-netbird">
                        Branch: {systemUpdateStatus.git.branch}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-nb-gray-400">
                        Installierter Commit:
                      </span>
                      <span className="font-mono font-semibold text-emerald-300">
                        {systemUpdateStatus.git.local_short}{" "}
                        <span className="text-[10px] font-normal text-nb-gray-400">
                          ({systemUpdateStatus.git.local_date.slice(0, 16)})
                        </span>
                      </span>
                    </div>
                    {showReleaseNotes && (
                      <div className="text-[11px] text-nb-gray-300 font-mono bg-nb-gray-930/80 rounded px-2.5 py-1.5 border border-nb-gray-900 leading-relaxed">
                        {systemUpdateStatus.git.local_subject}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-nb-gray-400">
                        Remote (origin/main):
                      </span>
                      <span className="font-mono text-nb-gray-200">
                        {systemUpdateStatus.git.remote_short}
                        {systemUpdateStatus.git.commits_behind > 0
                          ? ` (${systemUpdateStatus.git.commits_behind} Commits voraus)`
                          : " (Synchron)"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-nb-gray-400">
                        Core Gateway Binary:
                      </span>
                      <span className="font-mono text-[11px] text-nb-gray-200">
                        {systemUpdateStatus.binaries.core_gateway.exists
                          ? `SHA-256 ${systemUpdateStatus.binaries.core_gateway.sha256} (${(
                              systemUpdateStatus.binaries.core_gateway
                                .size_bytes /
                              (1024 * 1024)
                            ).toFixed(1)} MB)`
                          : "Aktiv"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right Card: Muscle Plane Nodes */}
                <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-950/90 p-4 space-y-3">
                  {systemUpdateStatus.nodes.length === 0 ? (
                    <>
                      <div className="flex items-center justify-between border-b border-nb-gray-900 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-sky-400" />
                          <span className="text-xs font-semibold text-white">
                            Verbundene Muscle-Knoten (0)
                          </span>
                        </div>
                        <span className="font-mono text-[10px] text-nb-gray-400">
                          /usr/local/bin/axon
                        </span>
                      </div>
                      <div className="py-4 text-center text-xs text-nb-gray-400">
                        Kein Muscle-Knoten verbunden.
                      </div>
                    </>
                  ) : (
                    systemUpdateStatus.nodes.map((node) => (
                      <div key={node.node_id} className="space-y-3">
                        <div className="flex items-center justify-between border-b border-nb-gray-900 pb-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <Server className="h-4 w-4 text-sky-400 shrink-0" />
                            <span className="text-xs font-semibold text-white truncate">
                              Muscle Plane ({node.node_id})
                            </span>
                            <span className="rounded border border-nb-gray-800 bg-nb-gray-930 px-1.5 py-0.2 font-mono text-[9px] text-nb-gray-300">
                              {node.systemd_status || "active"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setShowReleaseNotes((prev) => !prev)
                              }
                              className="inline-flex items-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-930 px-2 py-0.5 font-mono text-[10px] text-nb-gray-300 hover:border-nb-gray-700 hover:text-white transition"
                            >
                              <span>
                                {showReleaseNotes
                                  ? "Release einklappen"
                                  : "Release ausklappen"}
                              </span>
                              {showReleaseNotes ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={systemUpdateBusy || !node.online}
                              onClick={() =>
                                handleRunSystemUpdate(
                                  "update_muscle",
                                  node.node_id
                                )
                              }
                              className="rounded border border-sky-500/40 bg-sky-950/60 px-2 py-0.5 font-mono text-[10px] text-sky-200 hover:bg-sky-900/60 disabled:opacity-40 transition"
                            >
                              OTA Update
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-nb-gray-400">
                              Installierter Commit:
                            </span>
                            <span className="font-mono font-semibold text-emerald-300">
                              {node.source_commit ||
                                systemUpdateStatus.git.local_short}{" "}
                              <span className="text-[10px] font-normal text-nb-gray-400">
                                (
                                {(
                                  node.installed_mtime ||
                                  systemUpdateStatus.git.local_date
                                ).slice(0, 16)}
                                )
                              </span>
                            </span>
                          </div>
                          {showReleaseNotes && (
                            <div className="text-[11px] text-nb-gray-300 font-mono bg-nb-gray-930/80 rounded px-2.5 py-1.5 border border-nb-gray-900 leading-relaxed">
                              {systemUpdateStatus.git.local_subject}
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-nb-gray-400">
                              Remote (origin/main):
                            </span>
                            <span className="font-mono text-nb-gray-200">
                              {systemUpdateStatus.git.remote_short}
                              {node.up_to_date
                                ? " (Synchron)"
                                : " (OTA verfügbar)"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-nb-gray-400">
                              Axon Muscle Binary:
                            </span>
                            <span className="font-mono text-[11px] text-nb-gray-200">
                              SHA-256{" "}
                              {(
                                node.installed_sha256 ||
                                systemUpdateStatus.binaries.axon_linux_amd64
                                  .sha256 ||
                                "aktiv"
                              ).slice(0, 16)}
                              {systemUpdateStatus.binaries.axon_linux_amd64
                                .exists
                                ? ` (${(
                                    systemUpdateStatus.binaries
                                      .axon_linux_amd64.size_bytes /
                                    (1024 * 1024)
                                  ).toFixed(1)} MB)`
                                : ""}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Step-by-Step Rollout Log */}
            {systemUpdateSteps.length > 0 && (
              <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-950 p-4 space-y-2.5">
                <div className="flex items-center justify-between border-b border-nb-gray-900 pb-2">
                  <span className="text-xs font-semibold text-white">
                    Update-Protokoll (Letzter Lauf)
                  </span>
                  <button
                    type="button"
                    onClick={() => setSystemUpdateSteps([])}
                    className="text-[11px] text-nb-gray-400 hover:text-white"
                  >
                    Ausblenden
                  </button>
                </div>
                <div className="space-y-2">
                  {systemUpdateSteps.map((st, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-3 rounded-md border border-nb-gray-900 bg-nb-gray-930/60 p-2.5 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 font-medium text-white">
                          <span
                            className={`rounded px-1.5 py-0.2 font-mono text-[10px] uppercase ${
                              st.status === "ok"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-500/40"
                                : st.status === "warn"
                                  ? "bg-amber-950 text-amber-300 border border-amber-500/40"
                                  : "bg-red-950 text-red-400 border border-red-500/40"
                            }`}
                          >
                            {st.status}
                          </span>
                          <span>{st.step}</span>
                        </div>
                        <p className="font-mono text-[11px] text-nb-gray-300 whitespace-pre-wrap">
                          {st.detail}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-nb-gray-400">
                        {st.duration_ms} ms
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {settingsTab === "setup-keys" && (
        <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-5">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
              <Server className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">
                Einmal-Setup-Schlüssel (Server-Anbindung)
              </h2>
              <p className="text-xs text-nb-gray-400">
                Erzeuge einen einmaligen Setup-Schlüssel für das automatische
                mTLS 1.3 Onboarding neuer Linux-Server oder das Umbinden
                bestehender Muscle-Knoten.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              value={gatewayUrl}
              onChange={(e) => setGatewayUrl(e.target.value)}
              placeholder="http://<CORE_IP>:8081"
              className="w-60 rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-netbird"
            />
            <input
              type="text"
              value={joinNodeName}
              onChange={(e) => setJoinNodeName(e.target.value)}
              placeholder="Server-Name (optional, z.B. prod-01)"
              className="flex-1 min-w-[240px] rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
            />
            <select
              value={joinTier}
              onChange={(e) => setJoinTier(e.target.value as AutonomyTier)}
              className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-white"
            >
              <option value="TIER_1_UNLEASHED">TIER_1_UNLEASHED</option>
              <option value="TIER_2_WORKSPACE_JAIL">
                TIER_2_WORKSPACE_JAIL
              </option>
              <option value="TIER_3_SUPERVISED">TIER_3_SUPERVISED</option>
            </select>
            <button
              onClick={handleGenerateJoinToken}
              className="rounded-lg bg-netbird px-4 py-2 text-xs font-semibold text-white hover:bg-netbird-500 transition shadow-sm"
            >
              Setup-Schlüssel erzeugen
            </button>
          </div>

          {(gatewayUrl.includes("localhost") ||
            gatewayUrl.includes("127.0.0.1")) && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3.5 py-2 text-xs text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>
                Hinweis: Für entfernte Linux-VPS bitte{" "}
                <code className="font-mono text-amber-300">{gatewayUrl}</code>{" "}
                durch die öffentlich oder per VPN erreichbare IP/Domain dieses
                Core-Servers ersetzen.
              </span>
            </div>
          )}

          {issuedToken ? (
            <div className="space-y-4 pt-1">
              <div className="rounded-xl border border-netbird-500/40 bg-nb-gray-950 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-netbird">
                    1. Neuinstallation — Auf dem Ziel-Linux-Server ausführen, um
                    axon zu installieren &amp; zu verbinden:
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(oneLineInstallerCmd);
                      setCopiedJoinCmd(true);
                      setTimeout(() => setCopiedJoinCmd(false), 2500);
                    }}
                    className="rounded-md bg-netbird px-3 py-1 text-[11px] font-medium text-white hover:bg-netbird-500 transition"
                  >
                    {copiedJoinCmd ? "✔ Kopiert!" : "Befehl kopieren"}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-nb-gray-960 p-3 font-mono text-xs text-emerald-400">
                  {oneLineInstallerCmd}
                </pre>
              </div>

              <div className="rounded-xl border border-sky-500/40 bg-nb-gray-950 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-sky-400">
                      2. Bestehenden Muscle-Agenten per CLI umschalten (axon
                      switch)
                    </span>
                    <p className="text-[11px] text-nb-gray-400">
                      Ist axon bereits installiert? Führe diesen Befehl aus, um
                      ihn mit neuem Token an diesen Core zu binden (oder nutze
                      axon profiles):
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(rebindCliCmd);
                      setCopiedRebindCmd(true);
                      setTimeout(() => setCopiedRebindCmd(false), 2500);
                    }}
                    className="rounded-md border border-sky-500/50 bg-sky-950 px-3 py-1 text-[11px] font-medium text-sky-300 hover:bg-sky-900 transition"
                  >
                    {copiedRebindCmd ? "✔ CLI kopiert!" : "CLI-Switch kopieren"}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-nb-gray-960 p-3 font-mono text-xs text-sky-300">
                  {rebindCliCmd}
                </pre>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-950/70 px-4 py-3.5 text-xs text-nb-gray-400">
              Noch kein aktiver Setup-Schlüssel generiert. Klicke oben auf{" "}
              <strong className="text-white">Setup-Schlüssel erzeugen</strong>,
              um einen neuen Einmal-Token samt kopierfertigem Installations- und{" "}
              <code className="font-mono text-sky-300">axon switch</code>
              -Befehl zu erstellen.
            </div>
          )}
        </div>
      )}

      {settingsTab === "secrets-vault" && (
        <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-5">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">
                AES-256-GCM Verschlüsselter Secrets-Tresor (Secrets.enc)
              </h2>
              <p className="text-xs text-nb-gray-400">
                Geheimnisse werden lokal mit AES-256-GCM verschlüsselt
                gespeichert (Write-Only) und bei Bedarf sicher in
                Remote-Prozesse injiziert.
              </p>
            </div>
          </div>
          <form onSubmit={handleAddSecret} className="flex flex-wrap gap-2.5">
            <input
              type="text"
              value={newSecretKey}
              onChange={(e) => setNewSecretKey(e.target.value)}
              placeholder="SECRET_KEY_NAME"
              className="flex-1 min-w-[200px] rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-white"
            />
            <input
              type="password"
              value={newSecretVal}
              onChange={(e) => setNewSecretVal(e.target.value)}
              placeholder="Geheimer Klartext-Wert (nur schreiben)..."
              className="flex-1 min-w-[240px] rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-white"
            />
            <button
              type="submit"
              className="rounded-lg bg-netbird px-4 py-2 text-xs font-semibold text-white hover:bg-netbird-500 transition shadow-sm"
            >
              Verschlüsseln &amp; Speichern
            </button>
          </form>

          {secretKeys.length === 0 ? (
            <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-950/70 px-4 py-3 text-xs text-nb-gray-400">
              Noch keine Secrets im Tresor hinterlegt.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {secretKeys.map((k) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-930 px-3.5 py-2.5 font-mono text-xs"
                >
                  <span className="text-netbird">{k}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-nb-gray-400">
                      AES-256-GCM
                    </span>
                    <button
                      onClick={() => handleDeleteSecret(k)}
                      className="text-nb-gray-400 hover:text-red-400 transition"
                      title="Secret löschen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {settingsTab === "ai-providers" && (
        <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-5">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
              <Bot className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">
                KI-Anbieter &amp; Eigene API-Basis-URL
              </h2>
              <p className="text-xs text-nb-gray-400">
                Verbinde OpenRouter, vLLM, LiteLLM, Ollama oder OpenAI.
              </p>
            </div>
          </div>
          <form
            onSubmit={handleSaveAiEndpoint}
            className="space-y-4 text-xs max-w-xl"
          >
            <div>
              <label className="block text-nb-gray-200 font-medium mb-1.5">
                KI-Anbieter Vorlage
              </label>
              <select
                value={provider}
                onChange={(e) => {
                  const nextProv = e.target.value;
                  setProvider(nextProv);
                  const preset = PROVIDER_PRESETS[nextProv];
                  if (preset) {
                    setBaseUrl(preset.defaultUrl);
                    setModelName(preset.defaultModel);
                  }
                }}
                className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 text-xs text-white"
              >
                {Object.entries(PROVIDER_PRESETS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-nb-gray-200 font-medium mb-1.5">
                API Basis-URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  className="flex-1 rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-netbird"
                />
                <button
                  type="button"
                  onClick={handleSyncModels}
                  disabled={syncingModels}
                  className="flex items-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-nb-gray-200 hover:text-white transition"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      syncingModels ? "animate-spin" : ""
                    }`}
                  />
                  <span>Modelle laden</span>
                </button>
              </div>
              {modelSyncStatus && (
                <p className="mt-1 font-mono text-[11px] text-netbird">
                  {modelSyncStatus}
                </p>
              )}
            </div>

            <div>
              <label className="block text-nb-gray-200 font-medium mb-1.5">
                Modell-Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="flex-1 rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-white"
                />
                {discoveredModels.length > 0 && (
                  <select
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="max-w-[200px] rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-2 font-mono text-xs text-netbird"
                  >
                    {discoveredModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div>
              <label className="block text-nb-gray-200 font-medium mb-1.5">
                <span>API-Schlüssel (Verschlüsselt in Secrets.enc als </span>
                <code>{apiKeySecretName}</code>
                <span>)</span>
              </label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder={
                  secretKeys.includes(apiKeySecretName)
                    ? "•••••••• (Gespeichert in Secrets.enc)"
                    : "sk-..."
                }
                className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1">
              <label className="flex items-center gap-2.5 rounded-lg border border-nb-gray-800 bg-nb-gray-920 p-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enablePromptCaching}
                  onChange={(e) => setEnablePromptCaching(e.target.checked)}
                  className="rounded border-nb-gray-700 accent-netbird"
                />
                <div>
                  <div className="font-medium text-white">
                    Prompt- &amp; Dateisystem-Caching
                  </div>
                  <div className="text-[10px] text-nb-gray-400">
                    Statische System-Layer &amp; Datei-Lesezugriffe
                    zwischenspeichern
                  </div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 rounded-lg border border-nb-gray-800 bg-nb-gray-920 p-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableAutoWatchdog}
                  onChange={(e) => setEnableAutoWatchdog(e.target.checked)}
                  className="rounded border-nb-gray-700 accent-netbird"
                />
                <div>
                  <div className="font-medium text-white">
                    Proaktiver Auto-Watchdog
                  </div>
                  <div className="text-[10px] text-nb-gray-400">
                    Abgestürzte Dienste im Hintergrund automatisch reparieren
                  </div>
                </div>
              </label>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-netbird px-5 py-2 text-xs font-semibold text-white hover:bg-netbird-500 transition shadow-sm"
            >
              KI-Anbieter speichern
            </button>
          </form>
        </div>
      )}

      {settingsTab === "mcp-server" && (
        <div className="space-y-5">
          <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-5">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-white">
                  Externer KI-Zugriff &amp; Model Context Protocol (MCP) Server
                  (/api/mcp)
                </h2>
                <p className="text-xs text-nb-gray-400">
                  Erlaube externen KI-Agenten (Claude Desktop, Cursor, Windsurf,
                  Antigravity, OpenCode oder eigenen REST/JSON-RPC-Bots), deinen
                  Synapse Core &amp; Muscle sicher per MCP-Token zu steuern.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleCreateMcpKey}
              className="flex flex-wrap items-center gap-2.5 text-xs"
            >
              <input
                type="text"
                value={mcpKeyName}
                onChange={(e) => setMcpKeyName(e.target.value)}
                placeholder="Client-Name (z.B. Claude Desktop / Cursor)"
                className="flex-1 min-w-[220px] rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-white"
              />
              <select
                value={mcpKeyScopeMode}
                onChange={(e) =>
                  setMcpKeyScopeMode(
                    e.target.value as "read-exec" | "read-only"
                  )
                }
                className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-white"
              >
                <option value="read-exec">
                  Vollzugriff (Lesen + PTY/Dateisystem + Admin)
                </option>
                <option value="read-only">
                  Nur Lesen (Server, Dateien &amp; Brain-Docs prüfen)
                </option>
              </select>
              <button
                type="submit"
                className="rounded-lg bg-netbird px-4 py-2 text-xs font-semibold text-white hover:bg-netbird-500 transition shadow-sm"
              >
                + MCP-API-Schlüssel erzeugen
              </button>
            </form>

            {issuedMcpToken && (
              <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/20 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400">
                    ✔ Neuer MCP-API-Schlüssel erzeugt (jetzt kopieren — wird als
                    SHA-256-Hash gespeichert):
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(issuedMcpToken);
                      setCopiedMcpToken(true);
                      setTimeout(() => setCopiedMcpToken(false), 2500);
                    }}
                    className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-500 transition"
                  >
                    {copiedMcpToken ? "✔ Token kopiert!" : "Token kopieren"}
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg bg-nb-gray-960 p-3 font-mono text-xs text-emerald-300">
                  {issuedMcpToken}
                </pre>
              </div>
            )}

            {/* Active MCP API Keys List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-nb-gray-300">
                  Aktive Externe KI- / MCP-Tokens
                </div>
                {!issuedMcpToken && (
                  <button
                    type="button"
                    onClick={() => setShowMcpConfigExamples((v) => !v)}
                    className="text-[11px] text-sky-400 hover:text-sky-300 hover:underline"
                  >
                    {showMcpConfigExamples
                      ? "Integrations-Vorlagen ausblenden"
                      : "Integrations-Vorlagen anzeigen (Claude / Cursor / cURL)"}
                  </button>
                )}
              </div>
              {(activeProject?.mcp_api_keys || []).length === 0 ? (
                <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-3 text-xs text-nb-gray-400">
                  Noch keine MCP-API-Tokens erstellt. Klicke oben auf „+
                  MCP-API-Schlüssel erzeugen“.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(activeProject?.mcp_api_keys || []).map((k) => (
                    <div
                      key={k.key_id}
                      className="flex items-center justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3.5 py-2 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-white">
                          {k.name}
                        </span>
                        <span className="font-mono text-[11px] text-netbird">
                          {k.token_prefix}
                        </span>
                        <span className="rounded border border-nb-gray-700 bg-nb-gray-900 px-2 py-0.5 font-mono text-[10px] text-nb-gray-300">
                          {k.scopes.join(", ")}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRevokeMcpKey(k.key_id)}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Widerrufen
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MCP Client Config & REST Examples */}
            {(issuedMcpToken || showMcpConfigExamples) &&
              (() => {
                const originUrl =
                  typeof window !== "undefined"
                    ? window.location.origin
                    : "http://localhost:3000";
                const pid = activeProject?.project_id || "synapse-cloud-demo";
                const tokenVal = issuedMcpToken || "syn_mcp_<DEIN_API_KEY>";
                const mcpJsonSnippet = `{
  "mcpServers": {
    "synapse-core": {
      "url": "${originUrl}/api/mcp?project_id=${pid}",
      "headers": {
        "Authorization": "Bearer ${tokenVal}"
      }
    }
  }
}`;
                const mcpCurlSnippet = `# Execute any tool directly via REST or JSON-RPC 2.0:
curl -X POST ${originUrl}/api/mcp \\
  -H "Authorization: Bearer ${tokenVal}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "node_pty_exec",
    "arguments": {
      "node_id": "${primaryNode || "node-01"}",
      "session_id": "mcp-shell",
      "command": "uname -a && uptime"
    }
  }'`;
                return (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 pt-2">
                    <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-sky-400">
                          1. MCP-Client-Konfiguration (mcp_config.json — Claude
                          / Cursor / Antigravity)
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(mcpJsonSnippet);
                            setCopiedMcpConfig("json");
                            setTimeout(() => setCopiedMcpConfig(null), 2000);
                          }}
                          className="rounded border border-sky-500/40 bg-sky-950/60 px-2.5 py-0.5 text-[10px] font-medium text-sky-300 hover:bg-sky-900"
                        >
                          {copiedMcpConfig === "json"
                            ? "✔ Kopiert"
                            : "Kopieren"}
                        </button>
                      </div>
                      <pre className="overflow-x-auto rounded-lg bg-nb-gray-960 p-3 font-mono text-[11px] text-nb-gray-200 leading-relaxed">
                        {mcpJsonSnippet}
                      </pre>
                    </div>

                    <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-emerald-400">
                          2. Direkter REST / JSON-RPC Tool-Aufruf (curl /
                          Eigener KI-Agent)
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(mcpCurlSnippet);
                            setCopiedMcpConfig("curl");
                            setTimeout(() => setCopiedMcpConfig(null), 2000);
                          }}
                          className="rounded border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-900"
                        >
                          {copiedMcpConfig === "curl"
                            ? "✔ Kopiert"
                            : "Kopieren"}
                        </button>
                      </div>
                      <pre className="overflow-x-auto rounded-lg bg-nb-gray-960 p-3 font-mono text-[11px] text-nb-gray-200 leading-relaxed">
                        {mcpCurlSnippet}
                      </pre>
                    </div>
                  </div>
                );
              })()}

            {/* Interactive Live MCP Tester */}
            <div className="space-y-2 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-nb-gray-300">
                  Live MCP-Protokoll-Tester (JSON-RPC 2.0)
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTestMcpEndpoint("tools/list")}
                    className="rounded-lg border border-netbird-500/40 bg-netbird-950 px-3 py-1 font-mono text-[11px] text-netbird hover:bg-netbird hover:text-white transition"
                  >
                    Teste tools/list (10 Tools)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestMcpEndpoint("resources/list")}
                    className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-1 font-mono text-[11px] text-nb-gray-200 hover:text-white transition"
                  >
                    Teste resources/list
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestMcpEndpoint("call_state")}
                    className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-1 font-mono text-[11px] text-nb-gray-200 hover:text-white transition"
                  >
                    Rufe synapse_get_project_state auf
                  </button>
                </div>
              </div>
              {mcpTestOutput && (
                <pre className="max-h-72 overflow-auto rounded-lg border border-nb-gray-800 bg-nb-gray-960 p-3.5 font-mono text-[11px] text-emerald-400">
                  {mcpTestOutput}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {settingsTab === "debug-console" && (
        <div className="space-y-5">
          <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-950/60 text-amber-400">
                  <Activity className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Core &amp; Muscle Debug-Modus + End-to-End-Selbsttest
                  </h2>
                  <p className="text-xs text-nb-gray-400">
                    Prüfe Live-mTLS-1.3- &amp; Yamux-Streams, verifiziere die
                    AES-256-GCM-Tresor-Integrität und führe Diagnose-Checks auf
                    Core und Muscle aus.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleDebugMode}
                  className={`rounded-lg border px-3.5 py-2 font-mono text-xs font-medium transition ${
                    debugModeEnabled
                      ? "border-amber-500 bg-amber-950 text-amber-300"
                      : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-300 hover:text-white"
                  }`}
                >
                  {debugModeEnabled
                    ? "● Debug-Modus: AKTIV"
                    : "○ Debug-Modus aktivieren"}
                </button>
                <button
                  onClick={handleRunSelfTest}
                  disabled={runningSelfTest}
                  className="rounded-lg bg-netbird px-4 py-2 text-xs font-semibold text-white hover:bg-netbird-500 disabled:opacity-50 transition shadow-sm"
                >
                  {runningSelfTest
                    ? "Selbsttest läuft..."
                    : "▶ 5-Stufen-Selbsttest starten"}
                </button>
                <button
                  onClick={fetchDebugSnapshot}
                  className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-nb-gray-300 hover:text-white transition"
                >
                  Aktualisieren
                </button>
              </div>
            </div>

            {selfTestChecks.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-nb-gray-300">
                  End-to-End Diagnose-Prüfungen
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {selfTestChecks.map((chk) => (
                    <div
                      key={chk.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                              chk.status === "PASS"
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-500/40"
                                : chk.status === "WARN"
                                  ? "bg-amber-950 text-amber-300 border border-amber-500/40"
                                  : "bg-red-950 text-red-400 border border-red-500/40"
                            }`}
                          >
                            {chk.status}
                          </span>
                          <span className="font-semibold text-white">
                            {chk.name}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-nb-gray-300 break-all">
                          {chk.detail}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-nb-gray-400">
                        {chk.latency_ms} ms
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CLI Debug Commands Reference */}
            <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-4 space-y-2">
              <div className="text-xs font-semibold text-sky-400">
                CLI-Debug-Befehle für Core &amp; Muscle (axon debug / --debug)
              </div>
              <pre className="overflow-x-auto rounded-lg bg-nb-gray-960 p-3 font-mono text-[11px] text-nb-gray-200 leading-relaxed">
                {`# 1. Run 5-step Muscle diagnostic doctor (checks X.509 cert, Core HTTP latency, mTLS 1.3 handshake & FS permissions)
sudo axon debug

# 2. Persist Debug Mode on the Muscle agent and inspect live systemd journal logs
sudo axon debug --enable && sudo systemctl restart axon
sudo journalctl -u axon -f

# 3. Start Core Gateway with verbose mTLS / Yamux / RPC debug trace logging
SYNAPSE_DEBUG=1 ./bin/core-gateway --debug`}
              </pre>
            </div>

            {/* Live JSON Snapshot of Core Web + Core Gateway Ring Buffer */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-nb-gray-300">
                Live Core-Web- &amp; Gateway-Diagnose-Snapshot (/api/debug)
              </div>
              {debugSnapshot ? (
                <pre className="max-h-80 overflow-auto rounded-lg border border-nb-gray-800 bg-nb-gray-960 p-3.5 font-mono text-[11px] text-emerald-400">
                  {JSON.stringify(debugSnapshot, null, 2)}
                </pre>
              ) : (
                <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-950/70 px-4 py-3 text-xs text-nb-gray-400">
                  Lade Live-Diagnose-Snapshot...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {settingsTab === "watchdog-rbac" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Left Card: 24/7 Watchdog & Multi-Channel Push Alerts */}
          <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
                  <Activity className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    24/7 Wächter &amp; Push-Alarme
                  </h2>
                  <p className="text-xs text-nb-gray-400">
                    Automatische Benachrichtigungen bei Server-Ausfällen, hoher
                    Last oder Selbstheilungs-Aktionen.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setSettingsAlertNotice(null);
                  const r = await fetch("/api/alerts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "test_alert",
                      node_id: primaryNode || "vps2-muscle",
                    }),
                  });
                  const d = await r.json();
                  if (d.config) setSettingsAlertConfig(d.config);
                  setSettingsAlertNotice(
                    "🔔 Test-Alarm erfolgreich ausgelöst!"
                  );
                  setTimeout(() => setSettingsAlertNotice(null), 4000);
                }}
                className="shrink-0 rounded-lg border border-netbird/50 bg-netbird/15 px-3 py-1.5 font-mono text-xs font-semibold text-netbird hover:bg-netbird/25 transition"
              >
                Test-Alarm senden
              </button>
            </div>

            {settingsAlertNotice && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-3 py-2 text-xs text-emerald-300">
                {settingsAlertNotice}
              </div>
            )}

            {settingsAlertConfig && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-nb-gray-300 mb-1">
                    Telegram Bot-Token
                  </label>
                  <input
                    type="text"
                    value={settingsAlertConfig.telegram_bot_token}
                    onChange={(e) =>
                      setSettingsAlertConfig({
                        ...settingsAlertConfig,
                        telegram_bot_token: e.target.value,
                        telegram_enabled: Boolean(e.target.value),
                      })
                    }
                    placeholder="123456:ABC-DEF..."
                    className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-nb-gray-300 mb-1">
                    Telegram Chat-ID
                  </label>
                  <input
                    type="text"
                    value={settingsAlertConfig.telegram_chat_id}
                    onChange={(e) =>
                      setSettingsAlertConfig({
                        ...settingsAlertConfig,
                        telegram_chat_id: e.target.value,
                      })
                    }
                    placeholder="-1001234567890"
                    className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-nb-gray-300 mb-1">
                    Discord / Slack Webhook-URL
                  </label>
                  <input
                    type="text"
                    value={settingsAlertConfig.discord_webhook_url}
                    onChange={(e) =>
                      setSettingsAlertConfig({
                        ...settingsAlertConfig,
                        discord_webhook_url: e.target.value,
                        discord_enabled: Boolean(e.target.value),
                      })
                    }
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const r = await fetch("/api/alerts", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "configure",
                        ...settingsAlertConfig,
                      }),
                    });
                    const d = await r.json();
                    if (d.config) setSettingsAlertConfig(d.config);
                    setSettingsAlertNotice(
                      "✔ Alarm-Kanäle & Regeln gespeichert"
                    );
                    setTimeout(() => setSettingsAlertNotice(null), 3500);
                  }}
                  className="rounded-lg bg-netbird px-4 py-2 text-xs font-semibold text-white hover:bg-netbird-500 transition"
                >
                  Alarm-Kanäle speichern
                </button>

                {settingsAlertConfig.events &&
                  settingsAlertConfig.events.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-nb-gray-850">
                      <div className="font-mono text-[10px] uppercase tracking-wider text-nb-gray-400">
                        Letzte Wächter-Ereignisse
                      </div>
                      {settingsAlertConfig.events.slice(0, 4).map((ev) => (
                        <div
                          key={ev.id}
                          className="flex items-center justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-white truncate">
                              {ev.title}
                            </div>
                            <div className="text-[11px] text-nb-gray-400 truncate">
                              {ev.message}
                            </div>
                          </div>
                          <span className="shrink-0 font-mono text-[10px] text-emerald-400 ml-2">
                            {ev.dispatched_to.join(", ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* Right Card: WebUI Login & RBAC Roles */}
          <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-950/60 text-emerald-400">
                  <Lock className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    WebUI Login &amp; Rollen (RBAC)
                  </h2>
                  <p className="text-xs text-nb-gray-400">
                    Schütze das Control Center mit Admin-Passwort,
                    Nur-Lesen-Operator-Passwort und optionaler 2FA-PIN.
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
                  settingsAuthEnabled
                    ? "border-emerald-500/40 bg-emerald-950/60 text-emerald-300"
                    : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-400"
                }`}
              >
                {settingsAuthEnabled ? "AKTIV" : "AUS"}
              </span>
            </div>

            {settingsAuthNotice && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-3 py-2 text-xs text-emerald-300">
                {settingsAuthNotice}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-nb-gray-300 mb-1">
                  Neues Admin-Passwort (Vollzugriff)
                </label>
                <input
                  type="password"
                  value={settingsAdminPwd}
                  onChange={(e) => setSettingsAdminPwd(e.target.value)}
                  placeholder="Neues Admin-Passwort..."
                  className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-nb-gray-300 mb-1">
                  Operator-Passwort (Nur-Lesen / Read-Only)
                </label>
                <input
                  type="password"
                  value={settingsOperatorPwd}
                  onChange={(e) => setSettingsOperatorPwd(e.target.value)}
                  placeholder="Operator-Passwort (Nur-Lesen)..."
                  className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-nb-gray-300 mb-1">
                  Optionaler 2FA-PIN (z.B. 2408)
                </label>
                <input
                  type="text"
                  value={settingsTotpPin}
                  onChange={(e) => setSettingsTotpPin(e.target.value)}
                  placeholder="Optionaler 2FA-PIN..."
                  className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    const r = await fetch("/api/auth", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "configure",
                        enabled: true,
                        admin_password: settingsAdminPwd || "synapse-admin",
                        operator_password: settingsOperatorPwd,
                        totp_pin: settingsTotpPin,
                      }),
                    });
                    const d = await r.json();
                    if (d.ok) {
                      setSettingsAuthEnabled(Boolean(d.enabled));
                      setSettingsAuthNotice(
                        "🔒 WebUI Passwort-Schutz aktiviert"
                      );
                      setTimeout(() => setSettingsAuthNotice(null), 3500);
                    }
                  }}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition"
                >
                  Passwort-Schutz speichern &amp; aktivieren
                </button>
                {settingsAuthEnabled && (
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await fetch("/api/auth", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          action: "configure",
                          enabled: false,
                        }),
                      });
                      const d = await r.json();
                      if (d.ok) {
                        setSettingsAuthEnabled(false);
                        setSettingsAuthNotice(
                          "🔓 WebUI Passwort-Schutz deaktiviert"
                        );
                        setTimeout(() => setSettingsAuthNotice(null), 3500);
                      }
                    }}
                    className="rounded-lg border border-nb-gray-700 bg-nb-gray-900 px-3.5 py-2 text-xs text-nb-gray-300 hover:text-white transition"
                  >
                    Schutz deaktivieren
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {settingsTab === "language" && (
        <div className="space-y-5">
          <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
                  <Globe className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Sprache &amp; Lokalisierung
                  </h2>
                  <p className="text-xs text-nb-gray-400">
                    Wähle die Anzeigesprache der Benutzeroberfläche. Weitere
                    Sprachen können jederzeit über das Sprach-Register ergänzt
                    werden.
                  </p>
                </div>
              </div>
              <LanguageSwitcher variant="settings" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
