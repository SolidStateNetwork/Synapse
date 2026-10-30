"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { safeFetchJson } from "@/lib/safeFetch";
import {
  AIProviderSettings,
  AuditEntry,
  AutonomyTier,
  CartridgeMeta,
  ChatItem,
  FlowView,
  GatewayNode,
  NavSection,
  ProjectState,
  StackBlueprint,
} from "@/types/synapse";
import { useSystemAndInfraActions } from "./useSystemAndInfraActions";
import { useRemoteWorkspaceActions } from "./useRemoteWorkspaceActions";
import { useCopilotChatController } from "./useCopilotChatController";
import {
  buildControlCenterSidebarItems,
  filterAuditLogs,
  filterGatewayPeers,
  setIfChanged,
} from "./controlCenterDerivations";

export function useControlCenterController() {
  const { locale } = useI18n();
  const isDe = locale === "de";

  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectState | null>(null);
  const [architectureMd, setArchitectureMd] = useState("");
  const [memoryMd, setMemoryMd] = useState("");
  const [secretKeys, setSecretKeys] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [cartridges, setCartridges] = useState<CartridgeMeta[]>([]);
  const [gatewayNodes, setGatewayNodes] = useState<GatewayNode[]>([]);
  const [gatewayUrl, setGatewayUrl] = useState("http://127.0.0.1:8081");

  const [activeNav, setActiveNav] = useState<NavSection>("control-center");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [flowView, setFlowView] = useState<FlowView>("peers");
  const [focusedCanvasNode, setFocusedCanvasNode] = useState<string | null>(null);
  const [copilotDrawerOpen, setCopilotDrawerOpen] = useState(true);
  const [settingsTab, setSettingsTab] = useState<
    "system-update" | "watchdog-rbac" | "setup-keys" | "secrets-vault" | "ai-providers" | "mcp-server" | "debug-console" | "language"
  >("system-update");

  const [settingsAlertConfig, setSettingsAlertConfig] = useState<{
    enabled: boolean; telegram_enabled: boolean; telegram_bot_token: string; telegram_chat_id: string;
    discord_enabled: boolean; discord_webhook_url: string; webhook_enabled: boolean; webhook_url: string;
    cpu_threshold: number; ram_threshold: number; disk_threshold: number; auto_heal_services: boolean;
    events: Array<{ id: string; timestamp: string; severity: string; title: string; message: string; dispatched_to: string[] }>;
  } | null>(null);
  const [settingsAlertNotice, setSettingsAlertNotice] = useState<string | null>(null);
  const [settingsAuthEnabled, setSettingsAuthEnabled] = useState(false);
  const [settingsAdminPwd, setSettingsAdminPwd] = useState("");
  const [settingsOperatorPwd, setSettingsOperatorPwd] = useState("");
  const [settingsTotpPin, setSettingsTotpPin] = useState("");
  const [settingsAuthNotice, setSettingsAuthNotice] = useState<string | null>(null);

  useEffect(() => {
    safeFetchJson<{ config?: NonNullable<typeof settingsAlertConfig> }>("/api/alerts").then(({ data }) => { if (data?.config) setSettingsAlertConfig(data.config); });
    safeFetchJson<{ enabled?: boolean }>("/api/auth").then(({ data }) => { if (typeof data?.enabled === "boolean") setSettingsAuthEnabled(data.enabled); });
  }, []);

  const [peerSearch, setPeerSearch] = useState("");
  const [peerTierFilter, setPeerTierFilter] = useState<string>("ALL");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityStatusFilter, setActivityStatusFilter] = useState<string>("ALL");
  const [brainDocTab, setBrainDocTab] = useState<"Architecture.md" | "Memory.md">("Architecture.md");
  const [isEditingMarkdown, setIsEditingMarkdown] = useState(false);
  const [selectedCartridgeId, setSelectedCartridgeId] = useState<string>("");
  const [terminalDrawerOpen, setTerminalDrawerOpen] = useState(false);
  const [addPeerModalOpen, setAddPeerModalOpen] = useState(false);
  const [aiEndpointModalOpen, setAiEndpointModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [newProjectModal, setNewProjectModal] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [statusToast, setStatusToast] = useState<string>("");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, durationMs = 3000) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setStatusToast(msg);
    if (durationMs > 0) toastTimerRef.current = setTimeout(() => setStatusToast(""), durationMs);
  }, []);

  const [provider, setProvider] = useState("openai-compatible");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [modelName, setModelName] = useState("gpt-4o");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeySecretName, setApiKeySecretName] = useState("LLM_API_KEY");
  const [enablePromptCaching, setEnablePromptCaching] = useState(true);
  const [enableAutoWatchdog, setEnableAutoWatchdog] = useState(true);

  const [chatHistory, setChatHistory] = useState<ChatItem[]>([
    {
      role: "assistant",
      content:
        "# Willkommen im Synapse AI Copilot\n\nDein autonomer DevOps-Begleiter ist live mit deinen Servern, dem `Brain Vault` (`Architecture.md` & `Memory.md`) und den `Rule Cartridges` verbunden.\n\n- **Status:** `[OK]` Bereit für Live-Analysen\n- **Modus:** Interaktiver ReAct-Orchestrator\n\nWähle unten direkt einen **Quick-Skill** oder stelle eine Frage zu deinen Servern, Ports oder Logs.",
    },
  ]);

  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [joinTier, setJoinTier] = useState<AutonomyTier>("TIER_2_WORKSPACE_JAIL");
  const [joinNodeName, setJoinNodeName] = useState("");
  const [copiedJoinCmd, setCopiedJoinCmd] = useState(false);
  const [copiedRebindCmd, setCopiedRebindCmd] = useState(false);
  const [previewPort, setPreviewPort] = useState<number>(3000);
  const [previewSubPath, setPreviewSubPath] = useState<string>("/");
  const [previewReloadNonce, setPreviewReloadNonce] = useState<number>(0);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>("");
  const [copilotWide, setCopilotWide] = useState<boolean>(false);
  const [copilotWidth, setCopilotWidth] = useState<number>(420);
  const [terminalHeight, setTerminalHeight] = useState<number>(250);
  const [workspaceSidebarWidth, setWorkspaceSidebarWidth] = useState<number>(260);
  const [expandedPeerRows, setExpandedPeerRows] = useState<Record<string, boolean>>({});
  const [expandedAuditRows, setExpandedAuditRows] = useState<Record<number, boolean>>({});
  const [serviceWorkspaceTab, setServiceWorkspaceTab] = useState<"split" | "preview" | "tester">("tester");
  const [peersSubTab, setPeersSubTab] = useState<"nodes" | "mesh" | "blueprints" | "playbooks">("nodes");
  const [serviceActionMethod, setServiceActionMethod] = useState<"GET" | "POST" | "PUT" | "DELETE" | "SQL">("GET");
  const [serviceActionPath, setServiceActionPath] = useState<string>("/");
  const [serviceActionPayload, setServiceActionPayload] = useState<string>("");
  const [serviceActionBusy, setServiceActionBusy] = useState<boolean>(false);
  const [serviceActionResult, setServiceActionResult] = useState<{
    ok: boolean; status_code: number; latency_ms: number; method: string; proxy_url: string; response_text: string;
  } | null>(null);
  const [blueprints, setBlueprints] = useState<StackBlueprint[]>([]);

  const isEditingMarkdownRef = useRef(false);
  useEffect(() => {
    isEditingMarkdownRef.current = isEditingMarkdown;
  }, [isEditingMarkdown]);
  const pollInFlightRef = useRef(false);

  const loadWorkspace = useCallback(
    async (projectId?: string, syncAiSettings = false) => {
      if (!syncAiSettings && pollInFlightRef.current) return;
      if (!syncAiSettings) pollInFlightRef.current = true;
      if (projectId && typeof window !== "undefined") {
        window.localStorage.setItem("synapse_active_project_id", projectId);
      }
      const savedPid =
        typeof window !== "undefined"
          ? window.localStorage.getItem("synapse_active_project_id")
          : null;
      const pid = projectId || activeProject?.project_id || savedPid || "";
      try {
        const qs = new URLSearchParams();
        if (pid) qs.set("project_id", pid);
        if (!syncAiSettings) qs.set("light", "1");
        const res = await safeFetchJson(`/api/projects?${qs.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();

        setIfChanged(setProjects, data.projects || [], true);
        setIfChanged(setActiveProject, data.active_project || null, true);
        if (syncAiSettings || !isEditingMarkdownRef.current) {
          setArchitectureMd((prev) =>
            prev === (data.architecture_md || "")
              ? prev
              : data.architecture_md || ""
          );
          setMemoryMd((prev) =>
            prev === (data.memory_md || "") ? prev : data.memory_md || ""
          );
        }
        setIfChanged(setSecretKeys, data.secret_keys || []);
        setIfChanged(setAuditLogs, data.audit_logs || []);
        setIfChanged(setCartridges, data.cartridges || []);
        setIfChanged(setBlueprints, data.blueprints || []);
        setIfChanged(setGatewayNodes, data.gateway_nodes || []);

        if (data.gateway_url) {
          let resolvedUrl = String(data.gateway_url);
          if (
            typeof window !== "undefined" &&
            (resolvedUrl.includes("core-gateway") ||
              resolvedUrl.includes("127.0.0.1") ||
              resolvedUrl.includes("localhost"))
          ) {
            resolvedUrl = `${window.location.protocol}//${window.location.hostname}:8081`;
          }
          setGatewayUrl((prev) =>
            prev === "http://127.0.0.1:8081" ? resolvedUrl : prev
          );
        }

        if (syncAiSettings && data.active_project?.ai_settings) {
          const ai = data.active_project.ai_settings as AIProviderSettings;
          setProvider(ai.provider || "openai-compatible");
          setBaseUrl(ai.base_url || "https://api.openai.com/v1");
          setModelName(ai.model || "gpt-4o");
          setApiKeySecretName(ai.api_key_secret_name || "LLM_API_KEY");
          setEnablePromptCaching(ai.enable_prompt_caching !== false);
          setEnableAutoWatchdog(ai.enable_auto_watchdog !== false);
        }

        if (syncAiSettings && Array.isArray(data.chat_history)) {
          if (data.chat_history.length > 0) {
            setIfChanged(setChatHistory, data.chat_history);
          }
        }

        const firstNode =
          data.active_project?.assigned_nodes?.[0]?.node_id ||
          data.gateway_nodes?.[0]?.node_id ||
          "";
        setSelectedNodeId((prev) => prev || firstNode);

        const svcs = data.active_project?.registered_services || [];
        if (svcs.length > 0) {
          setSelectedServiceId((prev) => {
            const exists = svcs.some(
              (s: { service_id: string }) => s.service_id === prev
            );
            return exists ? prev : svcs[0].service_id;
          });
          setPreviewPort((prev) => {
            const exists = svcs.some((s: { port: number }) => s.port === prev);
            return exists ? prev : svcs[0].port;
          });
        }
      } catch {
        // ignore transient network error
      } finally {
        if (!syncAiSettings) pollInFlightRef.current = false;
      }
    },
    [activeProject?.project_id]
  );

  const infra = useSystemAndInfraActions({
    locale,
    activeProject,
    activeNav,
    settingsTab,
    selectedNodeId,
    setSelectedNodeId,
    gatewayNodes,
    joinTier,
    setSelectedCartridgeId,
    setChatHistory,
    showToast,
    loadWorkspace,
  });

  const primaryNode =
    selectedNodeId ||
    activeProject?.assigned_nodes?.[0]?.node_id ||
    gatewayNodes[0]?.node_id ||
    "";

  const remoteWs = useRemoteWorkspaceActions({
    isDe,
    activeProject,
    primaryNode,
    showToast,
    loadWorkspace,
  });

  const copilot = useCopilotChatController({
    locale,
    isDe,
    activeProject,
    gatewayNodes,
    primaryNode,
    remoteDir: remoteWs.remoteDir,
    activeFilePath: remoteWs.activeFilePath,
    fetchRemoteDir: remoteWs.fetchRemoteDir,
    openRemoteFile: remoteWs.openRemoteFile,
    loadWorkspace,
    showToast,
    setCopilotDrawerOpen,
    setAiEndpointModalOpen,
    setSystemUpdateStatus: infra.setSystemUpdateStatus,
    setSystemUpdateSteps: infra.setSystemUpdateSteps,
    provider,
    baseUrl,
    modelName,
    setModelName,
    apiKeyInput,
    setApiKeyInput,
    apiKeySecretName,
    enablePromptCaching,
    enableAutoWatchdog,
    chatHistory,
    setChatHistory,
  });

  async function handleInvokeServiceAction(override?: {
    nodeId?: string;
    port?: number;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "SQL";
    path?: string;
    payload?: string;
  }) {
    if (!activeProject) return;
    const activeSvc =
      (activeProject.registered_services || []).find(
        (s) => s.service_id === selectedServiceId
      ) || (activeProject.registered_services || [])[0];
    const targetNode =
      override?.nodeId || activeSvc?.node_id || primaryNode || "";
    const targetPort = override?.port || activeSvc?.port || previewPort || 3000;
    const method = override?.method || serviceActionMethod;
    const path = override?.path || serviceActionPath || "/";
    const payload =
      override?.payload !== undefined ? override.payload : serviceActionPayload;

    setServiceActionBusy(true);
    try {
      const res = await safeFetchJson("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invoke_service_action",
          project_id: activeProject.project_id,
          node_id: targetNode,
          port: targetPort,
          method,
          path,
          payload,
        }),
      });
      const data = await res.json();
      setServiceActionResult(data);
      if (method === "GET" && path.startsWith("/")) {
        setPreviewSubPath(path);
      }
      setPreviewReloadNonce((n) => n + 1);
    } catch (err) {
      setServiceActionResult({
        ok: false,
        status_code: 500,
        latency_ms: 0,
        method,
        proxy_url: "",
        response_text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setServiceActionBusy(false);
    }
  }

  async function handleRemoveService(
    serviceId: string,
    nodeId?: string,
    port?: number
  ) {
    if (!activeProject) return;
    await safeFetchJson("/api/orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: activeProject.project_id,
        direct_tool: {
          name: "core_register_service",
          arguments: {
            action: "remove",
            service_id: serviceId,
            node_id: nodeId || primaryNode,
            port,
          },
        },
      }),
    });
    showToast(
      isDe ? `Dienst ${serviceId} entfernt` : `Service ${serviceId} removed`
    );
    await loadWorkspace(activeProject.project_id);
  }

  const unhealthyServices = useMemo(
    () =>
      (activeProject?.registered_services || []).filter(
        (svc) =>
          svc.healthy === false || svc.health_check?.status === "UNHEALTHY"
      ),
    [activeProject?.registered_services]
  );

  async function handleAutoHealUnhealthyServices() {
    if (!activeProject || unhealthyServices.length === 0) return;
    showToast(
      isDe
        ? `Auto-Heal für ${unhealthyServices.length} Dienst(e) gestartet…`
        : `Starting Auto-Heal for ${unhealthyServices.length} service(s)…`
    );
    for (const svc of unhealthyServices) {
      await safeFetchJson("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "heal_service",
          project_id: activeProject.project_id,
          node_id: svc.node_id || primaryNode,
          port: svc.port,
          service_id: svc.service_id,
          name: svc.name,
        }),
      });
    }
    await loadWorkspace(activeProject.project_id);
    showToast(isDe ? "Auto-Heal abgeschlossen" : "Auto-Heal completed");
  }

  useEffect(() => {
    loadWorkspace(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
        setCommandQuery("");
      } else if (e.key === "Escape") {
        setCommandPaletteOpen(false);
        setFocusedCanvasNode(null);
        copilot.setMentionMenuOpen(false);
        copilot.setSkillMenuOpen(false);
        copilot.setChatInput((prev) => prev.replace(/(?:^|\s)@$/, ""));
      }
    }
    function onPointerDown(e: MouseEvent) {
      if (
        copilot.chatComposerRef.current &&
        e.target instanceof Node &&
        !copilot.chatComposerRef.current.contains(e.target)
      ) {
        copilot.setMentionMenuOpen(false);
        copilot.setSkillMenuOpen(false);
        copilot.setChatInput((prev) => prev.replace(/(?:^|\s)@$/, ""));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [copilot]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadWorkspace(activeProject?.project_id, false);
    }, 5000);
    return () => clearInterval(timer);
  }, [loadWorkspace, activeProject?.project_id]);

  async function handleSaveBrainDoc(doc: "Architecture.md" | "Memory.md") {
    if (!activeProject) return;
    const content = doc === "Architecture.md" ? architectureMd : memoryMd;
    await safeFetchJson("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_doc",
        project_id: activeProject.project_id,
        document: doc,
        content,
      }),
    });
    setIsEditingMarkdown(false);
    showToast(isDe ? `${doc} gespeichert` : `Saved ${doc}`);
    await loadWorkspace(activeProject.project_id);
  }

  const pendingApprovals = useMemo(
    () =>
      (activeProject?.pending_approvals || []).filter(
        (a) => a.status === "pending"
      ),
    [activeProject?.pending_approvals]
  );

  const activeHeartbeat =
    (primaryNode && activeProject?.telemetry?.[primaryNode]) ||
    gatewayNodes.find((n) => n.node_id === primaryNode)?.last_heartbeat;

  const filteredPeers = useMemo(
    () => filterGatewayPeers(gatewayNodes, peerSearch, peerTierFilter),
    [gatewayNodes, peerSearch, peerTierFilter]
  );

  const filteredLogs = useMemo(
    () => filterAuditLogs(auditLogs, activitySearch, activityStatusFilter),
    [auditLogs, activitySearch, activityStatusFilter]
  );

  const oneLineInstallerCmd = infra.issuedToken
    ? `curl -fsSL ${gatewayUrl.replace(/\/$/, "")}/install.sh | sudo sh -s -- ${
        infra.issuedToken
      } ${joinTier}${joinNodeName.trim() ? ` ${joinNodeName.trim()}` : ""}`
    : "";

  const rebindCliCmd = infra.issuedToken
    ? `sudo axon switch --core ${gatewayUrl.replace(/\/$/, "")} --token ${
        infra.issuedToken
      } --tier ${joinTier}${
        joinNodeName.trim() ? ` --node ${joinNodeName.trim()}` : ""
      } --restart`
    : "";

  const sidebarItems = buildControlCenterSidebarItems({
    isDe,
    unhealthyServicesCount: unhealthyServices.length,
    pendingApprovalsCount: pendingApprovals.length,
    activeProject,
    primaryNode,
  });

  return {
    locale, projects, activeProject, architectureMd, setArchitectureMd, memoryMd, setMemoryMd,
    secretKeys, auditLogs, cartridges, gatewayNodes, gatewayUrl, setGatewayUrl,
    activeNav, setActiveNav, sidebarCollapsed, setSidebarCollapsed, flowView, setFlowView,
    focusedCanvasNode, setFocusedCanvasNode, copilotDrawerOpen, setCopilotDrawerOpen,
    settingsTab, setSettingsTab, settingsAlertConfig, setSettingsAlertConfig, settingsAlertNotice, setSettingsAlertNotice,
    settingsAuthEnabled, setSettingsAuthEnabled, settingsAdminPwd, setSettingsAdminPwd,
    settingsOperatorPwd, setSettingsOperatorPwd, settingsTotpPin, setSettingsTotpPin, settingsAuthNotice, setSettingsAuthNotice,
    peerSearch, setPeerSearch, peerTierFilter, setPeerTierFilter, activitySearch, setActivitySearch,
    activityStatusFilter, setActivityStatusFilter, brainDocTab, setBrainDocTab,
    isEditingMarkdown, setIsEditingMarkdown, selectedCartridgeId, setSelectedCartridgeId,
    terminalDrawerOpen, setTerminalDrawerOpen, addPeerModalOpen, setAddPeerModalOpen,
    aiEndpointModalOpen, setAiEndpointModalOpen, commandPaletteOpen, setCommandPaletteOpen,
    commandQuery, setCommandQuery, newProjectModal, setNewProjectModal, newProjName, setNewProjName,
    statusToast, setStatusToast, provider, setProvider, baseUrl, setBaseUrl, modelName, setModelName,
    apiKeyInput, setApiKeyInput, apiKeySecretName, enablePromptCaching, setEnablePromptCaching,
    enableAutoWatchdog, setEnableAutoWatchdog, chatHistory, selectedNodeId, setSelectedNodeId,
    joinTier, setJoinTier, joinNodeName, setJoinNodeName, copiedJoinCmd, setCopiedJoinCmd,
    copiedRebindCmd, setCopiedRebindCmd, previewPort, setPreviewPort, previewSubPath, setPreviewSubPath,
    previewReloadNonce, setPreviewReloadNonce, selectedServiceId, setSelectedServiceId,
    selectedEndpointId, setSelectedEndpointId, copilotWide, setCopilotWide, copilotWidth, setCopilotWidth,
    terminalHeight, setTerminalHeight, workspaceSidebarWidth, setWorkspaceSidebarWidth,
    expandedPeerRows, setExpandedPeerRows, expandedAuditRows, setExpandedAuditRows,
    serviceWorkspaceTab, setServiceWorkspaceTab, peersSubTab, setPeersSubTab,
    serviceActionMethod, setServiceActionMethod, serviceActionPath, setServiceActionPath,
    serviceActionPayload, setServiceActionPayload, serviceActionBusy, serviceActionResult,
    blueprints, loadWorkspace, primaryNode, handleSaveBrainDoc, handleInvokeServiceAction,
    handleRemoveService, handleAutoHealUnhealthyServices, pendingApprovals, unhealthyServices,
    activeHeartbeat, filteredPeers, filteredLogs, oneLineInstallerCmd, rebindCliCmd, sidebarItems,
    ...remoteWs, ...copilot, ...infra,
  };
}
