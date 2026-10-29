"use client";

import React from "react";
import {
  Activity,
  Bot,
  Globe,
  KeyRound,
  Lock,
  RefreshCw,
  Server,
  Settings2,
  Sparkles,
} from "lucide-react";
import {
  SynapseSubTabs,
  SynapseViewHeader,
} from "@/components/ui/SynapseDesignSystem";
import { AutonomyTier, ProjectState } from "@/types/synapse";
import {
  DebugConsoleTab,
  SystemUpdateTab,
} from "./settings/SystemUpdateAndDebugTabs";
import {
  SecretsVaultTab,
  SetupKeysTab,
  WatchdogRbacTab,
} from "./settings/SecurityAndAccessTabs";
import {
  AiProvidersTab,
  LanguageTab,
  McpServerTab,
} from "./settings/AiAndMcpTabs";

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

const SettingsView = React.memo(function SettingsView(props: SettingsViewProps) {
  const {
    activeProject,
    settingsTab,
    setSettingsTab,
    secretKeys,
    debugModeEnabled,
    fetchDebugSnapshot,
    fetchSystemUpdateStatus,
  } = props;

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

      {settingsTab === "system-update" && <SystemUpdateTab {...props} />}
      {settingsTab === "setup-keys" && <SetupKeysTab {...props} />}
      {settingsTab === "secrets-vault" && <SecretsVaultTab {...props} />}
      {settingsTab === "ai-providers" && <AiProvidersTab {...props} />}
      {settingsTab === "mcp-server" && <McpServerTab {...props} />}
      {settingsTab === "debug-console" && <DebugConsoleTab {...props} />}
      {settingsTab === "watchdog-rbac" && <WatchdogRbacTab {...props} />}
      {settingsTab === "language" && <LanguageTab />}
    </div>
  );
});

export default SettingsView;
