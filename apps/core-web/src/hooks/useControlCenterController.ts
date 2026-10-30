"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  BookOpen,
  Code2,
  Globe,
  MonitorSmartphone,
  Network,
  Settings,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  AIProviderSettings,
  AuditEntry,
  AutonomyTier,
  CartridgeMeta,
  ChatAttachment,
  ChatItem,
  FlowView,
  FsEntry,
  GatewayNode,
  NavSection,
  ProjectState,
  PromptCacheMetrics,
  StackBlueprint,
} from "@/types/synapse";
import {
  buildCheckOpsecPrompt,
  buildCheckSystemPrompt,
  buildCheckUpdatesPrompt,
  buildDeepForensicsPrompt,
  buildInterviewStepResponsePrompt,
  buildSkillSearchPrompt,
  buildStartSkillInterviewPrompt,
  buildUpdateSkillDecisionPrompt,
  detectInputLang,
} from "@/lib/copilot/skillPrompts";
import { useSystemAndInfraActions } from "./useSystemAndInfraActions";

function stripVolatileTimestamps(val: unknown): unknown {
  if (Array.isArray(val)) {
    return val.map(stripVolatileTimestamps);
  }
  if (val && typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (k === "updated_at") continue;
      out[k] = stripVolatileTimestamps(v);
    }
    return out;
  }
  return val;
}

function setIfChanged<T>(
  setter: React.Dispatch<React.SetStateAction<T>>,
  nextVal: T,
  ignoreVolatileTimestamps = false
) {
  setter((prev) => {
    try {
      const a = ignoreVolatileTimestamps
        ? JSON.stringify(stripVolatileTimestamps(prev))
        : JSON.stringify(prev);
      const b = ignoreVolatileTimestamps
        ? JSON.stringify(stripVolatileTimestamps(nextVal))
        : JSON.stringify(nextVal);
      return a === b ? prev : nextVal;
    } catch {
      return nextVal;
    }
  });
}

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
  const [focusedCanvasNode, setFocusedCanvasNode] = useState<string | null>(
    null
  );
  const [copilotDrawerOpen, setCopilotDrawerOpen] = useState(true);
  const [settingsTab, setSettingsTab] = useState<
    | "system-update"
    | "watchdog-rbac"
    | "setup-keys"
    | "secrets-vault"
    | "ai-providers"
    | "mcp-server"
    | "debug-console"
    | "language"
  >("system-update");

  const [settingsAlertConfig, setSettingsAlertConfig] = useState<{
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
  } | null>(null);
  const [settingsAlertNotice, setSettingsAlertNotice] = useState<string | null>(
    null
  );
  const [settingsAuthEnabled, setSettingsAuthEnabled] = useState(false);
  const [settingsAdminPwd, setSettingsAdminPwd] = useState("");
  const [settingsOperatorPwd, setSettingsOperatorPwd] = useState("");
  const [settingsTotpPin, setSettingsTotpPin] = useState("");
  const [settingsAuthNotice, setSettingsAuthNotice] = useState<string | null>(
    null
  );

  useEffect(() => {
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.config) setSettingsAlertConfig(d.config);
      })
      .catch(() => {});
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d.enabled === "boolean")
          setSettingsAuthEnabled(d.enabled);
      })
      .catch(() => {});
  }, []);

  const [peerSearch, setPeerSearch] = useState("");
  const [peerTierFilter, setPeerTierFilter] = useState<string>("ALL");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityStatusFilter, setActivityStatusFilter] =
    useState<string>("ALL");

  const [brainDocTab, setBrainDocTab] = useState<
    "Architecture.md" | "Memory.md"
  >("Architecture.md");
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
    if (durationMs > 0) {
      toastTimerRef.current = setTimeout(() => setStatusToast(""), durationMs);
    }
  }, []);

  const [remoteDir, setRemoteDir] = useState(".");
  const [remoteEntries, setRemoteEntries] = useState<FsEntry[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string>("");
  const [editorContent, setEditorContent] = useState<string>("");
  const [diffPatchText, setDiffPatchText] = useState<string>("");
  const [showDiffDrawer, setShowDiffDrawer] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  const [provider, setProvider] = useState("openai-compatible");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [modelName, setModelName] = useState("gpt-4o");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeySecretName, setApiKeySecretName] = useState("LLM_API_KEY");
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [syncingModels, setSyncingModels] = useState(false);
  const [modelSyncStatus, setModelSyncStatus] = useState("");

  const [chatInput, setChatInput] = useState("");
  const [chatAttachments, setChatAttachments] = useState<ChatAttachment[]>([]);
  const [isDraggingOverChat, setIsDraggingOverChat] = useState(false);
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [streamingReplyText, setStreamingReplyText] = useState("");
  const [streamingThinkingText, setStreamingThinkingText] = useState("");
  const [latestCacheMetrics, setLatestCacheMetrics] =
    useState<PromptCacheMetrics | null>(null);
  const [enablePromptCaching, setEnablePromptCaching] = useState(true);
  const [enableAutoWatchdog, setEnableAutoWatchdog] = useState(true);
  const [expandedThinking, setExpandedThinking] = useState<
    Record<number, boolean>
  >({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatComposerRef = useRef<HTMLFormElement | null>(null);
  const [selectedChatSkill, setSelectedChatSkill] = useState<
    | "CheckSystem"
    | "CheckOpsec"
    | "SkillSearch"
    | "DeepForensics"
    | "CheckUpdates"
    | null
  >(null);
  const [skillMenuOpen, setSkillMenuOpen] = useState<boolean>(false);
  const [chatMessageFilter, setChatMessageFilter] = useState<
    "all" | "reports" | "user"
  >("all");
  const [expandedRawPrompts, setExpandedRawPrompts] = useState<
    Record<number, boolean>
  >({});
  const [copiedChatMsgIdx, setCopiedChatMsgIdx] = useState<number | null>(null);
  const [turnToolCategoryFilter, setTurnToolCategoryFilter] = useState<
    Record<number, string>
  >({});
  const [chatBusy, setChatBusy] = useState(false);
  const [chatElapsedSec, setChatElapsedSec] = useState(0);

  useEffect(() => {
    if (!chatBusy) {
      setChatElapsedSec(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      setChatElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [chatBusy]);

  const [liveSteps, setLiveSteps] = useState<
    Array<{
      step: number;
      tool_name: string;
      detail?: string;
      cached?: boolean;
      status:
        | "running"
        | "executed"
        | "blocked"
        | "requires_approval"
        | "error";
    }>
  >([]);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>(
    {}
  );
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([
    {
      role: "assistant",
      content:
        "# Willkommen im Synapse AI Copilot\n\nDein autonomer DevOps-Begleiter ist live mit deinen Servern, dem `Brain Vault` (`Architecture.md` & `Memory.md`) und den `Rule Cartridges` verbunden.\n\n- **Status:** `[OK]` Bereit für Live-Analysen\n- **Modus:** Interaktiver ReAct-Orchestrator\n\nWähle unten direkt einen **Quick-Skill** oder stelle eine Frage zu deinen Servern, Ports oder Logs.",
    },
  ]);

  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [joinTier, setJoinTier] = useState<AutonomyTier>(
    "TIER_2_WORKSPACE_JAIL"
  );
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
  const [workspaceSidebarWidth, setWorkspaceSidebarWidth] =
    useState<number>(260);
  const [expandedPeerRows, setExpandedPeerRows] = useState<
    Record<string, boolean>
  >({});
  const [expandedAuditRows, setExpandedAuditRows] = useState<
    Record<number, boolean>
  >({});
  const [systemScanBusy, setSystemScanBusy] = useState<boolean>(false);
  const [opsecScanBusy, setOpsecScanBusy] = useState<boolean>(false);
  const [serviceWorkspaceTab, setServiceWorkspaceTab] = useState<
    "split" | "preview" | "tester"
  >("tester");
  const [peersSubTab, setPeersSubTab] = useState<
    "nodes" | "mesh" | "blueprints" | "playbooks"
  >("nodes");
  const [expandedTurnTools, setExpandedTurnTools] = useState<
    Record<number, boolean>
  >({});
  const [serviceActionMethod, setServiceActionMethod] = useState<
    "GET" | "POST" | "PUT" | "DELETE" | "SQL"
  >("GET");
  const [serviceActionPath, setServiceActionPath] = useState<string>("/");
  const [serviceActionPayload, setServiceActionPayload] = useState<string>("");
  const [serviceActionBusy, setServiceActionBusy] = useState<boolean>(false);
  const [serviceActionResult, setServiceActionResult] = useState<{
    ok: boolean;
    status_code: number;
    latency_ms: number;
    method: string;
    proxy_url: string;
    response_text: string;
  } | null>(null);
  const [blueprints, setBlueprints] = useState<StackBlueprint[]>([]);

  const isEditingMarkdownRef = useRef(false);
  useEffect(() => {
    isEditingMarkdownRef.current = isEditingMarkdown;
  }, [isEditingMarkdown]);
  const pollInFlightRef = useRef(false);

  const loadWorkspace = useCallback(
    async (projectId?: string, syncAiSettings = false) => {
      if (!syncAiSettings && pollInFlightRef.current) {
        return;
      }
      if (!syncAiSettings) {
        pollInFlightRef.current = true;
      }
      if (projectId && typeof window !== "undefined") {
        window.localStorage.setItem("synapse_active_project_id", projectId);
      }
      const savedPid =
        typeof window !== "undefined"
          ? window.localStorage.getItem("synapse_active_project_id")
          : null;
      const pid =
        projectId ||
        activeProject?.project_id ||
        savedPid ||
        "synapse-cloud-demo";
      try {
        const res = await fetch(
          `/api/projects?project_id=${encodeURIComponent(pid)}${
            syncAiSettings ? "" : "&light=1"
          }`,
          { cache: "no-store" }
        );
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
        if (!syncAiSettings) {
          pollInFlightRef.current = false;
        }
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
      const res = await fetch("/api/projects", {
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

  async function handleRemoveService(serviceId: string, nodeId?: string) {
    if (!activeProject) return;
    await fetch("/api/orchestrator", {
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
          },
        },
      }),
    });
    showToast(
      isDe ? `Dienst ${serviceId} entfernt` : `Service ${serviceId} removed`
    );
    await loadWorkspace(activeProject.project_id);
  }

  useEffect(() => {
    loadWorkspace("synapse-cloud-demo", true);
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
        setMentionMenuOpen(false);
        setSkillMenuOpen(false);
        setChatInput((prev) => prev.replace(/(?:^|\s)@$/, ""));
      }
    }
    function onPointerDown(e: MouseEvent) {
      if (
        chatComposerRef.current &&
        e.target instanceof Node &&
        !chatComposerRef.current.contains(e.target)
      ) {
        setMentionMenuOpen(false);
        setSkillMenuOpen(false);
        setChatInput((prev) => prev.replace(/(?:^|\s)@$/, ""));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      loadWorkspace(activeProject?.project_id, false);
    }, 5000);
    return () => clearInterval(timer);
  }, [loadWorkspace, activeProject?.project_id]);

  const openRemoteFile = useCallback(
    async (filePath: string) => {
      if (!activeProject || !primaryNode || !filePath) return;
      try {
        const res = await fetch("/api/orchestrator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: activeProject.project_id,
            direct_tool: {
              name: "node_fs_operation",
              arguments: {
                node_id: primaryNode,
                operation: "read_file",
                path: filePath,
              },
            },
          }),
        });
        const data = await res.json();
        const tr = data.tool_results?.[0];
        if (tr?.output?.success) {
          setActiveFilePath(filePath);
          setEditorContent(tr.output.content || "");
        }
      } catch {
        // ignore
      }
    },
    [activeProject, primaryNode]
  );

  const fetchRemoteDir = useCallback(
    async (dirPath: string, autoSelectFirstFile = false) => {
      if (!activeProject || !primaryNode || activeProject.planning_only) return;
      try {
        const res = await fetch("/api/orchestrator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: activeProject.project_id,
            direct_tool: {
              name: "node_fs_operation",
              arguments: {
                node_id: primaryNode,
                operation: "list_dir",
                path: dirPath,
              },
            },
          }),
        });
        const data = await res.json();
        const tr = data.tool_results?.[0];
        if (Array.isArray(tr?.output?.entries)) {
          const entries = tr.output.entries as FsEntry[];
          setIfChanged(setRemoteEntries, entries);
          setRemoteDir(dirPath);
          if (autoSelectFirstFile) {
            const firstFile = entries.find((e) => !e.is_dir);
            if (firstFile?.path) {
              void openRemoteFile(firstFile.path);
            }
          }
        }
      } catch {
        // ignore
      }
    },
    [activeProject, primaryNode, openRemoteFile]
  );

  useEffect(() => {
    if (primaryNode && activeProject && !activeProject.planning_only) {
      fetchRemoteDir(".", !activeFilePath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryNode, activeProject?.project_id, activeProject?.planning_only]);

  async function handleSaveRemoteFile() {
    if (!activeProject || !primaryNode || !activeFilePath) return;
    const res = await fetch("/api/orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: activeProject.project_id,
        direct_tool: {
          name: "node_fs_operation",
          arguments: {
            node_id: primaryNode,
            operation: "write_file",
            path: activeFilePath,
            content: editorContent,
          },
        },
      }),
    });
    const data = await res.json();
    const tr = data.tool_results?.[0];
    if (tr?.output?.success) {
      showToast(
        isDe ? `Gespeichert: ${activeFilePath}` : `Saved ${activeFilePath}`
      );
      fetchRemoteDir(remoteDir);
    }
    loadWorkspace(activeProject.project_id);
  }

  async function handleApplyUnifiedDiff() {
    if (!activeProject || !primaryNode || !activeFilePath || !diffPatchText)
      return;
    const res = await fetch("/api/orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: activeProject.project_id,
        direct_tool: {
          name: "node_fs_operation",
          arguments: {
            node_id: primaryNode,
            operation: "apply_unified_diff",
            path: activeFilePath,
            diff: diffPatchText,
          },
        },
      }),
    });
    const data = await res.json();
    const tr = data.tool_results?.[0];
    if (tr?.output?.success) {
      showToast(
        isDe
          ? `Atomarer Diff auf ${activeFilePath} angewendet`
          : `Applied atomic diff to ${activeFilePath}`
      );
      setShowDiffDrawer(false);
      setDiffPatchText("");
      openRemoteFile(activeFilePath);
    }
    loadWorkspace(activeProject.project_id);
  }

  async function handleCreateRemoteFile(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProject || !primaryNode || !newFileName.trim()) return;
    const targetPath =
      remoteDir === "."
        ? newFileName.trim()
        : `${remoteDir}/${newFileName.trim()}`;
    await fetch("/api/orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: activeProject.project_id,
        direct_tool: {
          name: "node_fs_operation",
          arguments: {
            node_id: primaryNode,
            operation: "write_file",
            path: targetPath,
            content: "// Created via Synapse Control Center\n",
          },
        },
      }),
    });
    setNewFileName("");
    fetchRemoteDir(remoteDir);
    openRemoteFile(targetPath);
  }

  async function handleDeleteRemoteFile(targetPath: string) {
    if (!activeProject || !primaryNode) return;
    await fetch("/api/orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: activeProject.project_id,
        direct_tool: {
          name: "node_fs_operation",
          arguments: {
            node_id: primaryNode,
            operation: "delete",
            path: targetPath,
          },
        },
      }),
    });
    fetchRemoteDir(remoteDir);
    loadWorkspace(activeProject.project_id);
  }

  async function handleSaveAiEndpoint(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProject) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_ai_settings",
        project_id: activeProject.project_id,
        provider,
        base_url: baseUrl,
        model: modelName,
        api_key_secret_name: apiKeySecretName,
        enable_prompt_caching: enablePromptCaching,
        enable_auto_watchdog: enableAutoWatchdog,
        api_key: apiKeyInput,
      }),
    });
    setApiKeyInput("");
    setAiEndpointModalOpen(false);
    showToast(
      isDe
        ? `KI-Provider gespeichert: ${modelName}`
        : `Saved AI Provider: ${modelName}`
    );
    await loadWorkspace(activeProject.project_id, true);
  }

  async function handleSyncModels() {
    if (!activeProject) return;
    setSyncingModels(true);
    setModelSyncStatus(
      isDe ? "Frage /models ab..." : "Querying /models..."
    );
    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_models",
          project_id: activeProject.project_id,
          provider,
          base_url: baseUrl,
          api_key: apiKeyInput,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.models) && data.models.length > 0) {
        setDiscoveredModels(data.models);
        if (!modelName || !data.models.includes(modelName)) {
          setModelName(data.models[0]);
        }
        setModelSyncStatus(
          isDe
            ? `${data.models.length} Modelle geladen`
            : `Loaded ${data.models.length} models`
        );
      } else {
        setModelSyncStatus(
          data.error ||
            (isDe
              ? "Keine Modelle vom Endpunkt erhalten"
              : "No models returned by endpoint")
        );
      }
    } finally {
      setSyncingModels(false);
    }
  }

  async function processDroppedOrSelectedFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const added: ChatAttachment[] = [];
    for (const file of list.slice(0, 6)) {
      if (file.size > 8 * 1024 * 1024) {
        showToast(
          isDe
            ? `Übersprungen: ${file.name} (>8MB Limit)`
            : `Skipped ${file.name} (>8MB limit)`
        );
        continue;
      }
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
      });
      if (dataUrl) {
        added.push({
          id: `att-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          name: file.name || "screenshot.png",
          mime_type: file.type || "image/png",
          data_url: dataUrl,
          size_bytes: file.size,
        });
      }
    }
    if (added.length > 0) {
      setChatAttachments((prev) => [...prev, ...added].slice(0, 6));
    }
  }

  function handleChatPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      processDroppedOrSelectedFiles(files);
    }
  }

  async function handleRollbackSnapshot(snapshotId: string, filePath?: string) {
    if (!activeProject || !snapshotId) return;
    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rollback_snapshot",
          project_id: activeProject.project_id,
          snapshot_id: snapshotId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          isDe
            ? `Rollback durchgeführt: ${filePath || snapshotId}`
            : `Rolled back ${filePath || snapshotId}`
        );
        setChatHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              data.reply ||
              `⏪ Rolled back ${filePath || "file"} to snapshot ${snapshotId}.`,
          },
        ]);
        await loadWorkspace(activeProject.project_id);
        if (primaryNode) {
          fetchRemoteDir(remoteDir);
          if (filePath) openRemoteFile(filePath);
        }
      } else {
        showToast(
          data.error || (isDe ? "Rollback fehlgeschlagen" : "Rollback failed")
        );
      }
    } catch {
      showToast(
        isDe ? "Rollback-Anfrage fehlgeschlagen" : "Rollback request failed"
      );
    }
  }

  const mentionCandidates = useMemo(() => {
    const items: Array<{ token: string; label: string; category: string }> = [
      {
        token: "@Architecture.md",
        label: "Project Architecture & Mermaid Specs",
        category: "Vault",
      },
      {
        token: "@Memory.md",
        label: "Engineering Journal & Past Fixes",
        category: "Vault",
      },
    ];
    for (const n of gatewayNodes) {
      items.push({
        token: `@${n.node_id}`,
        label: `Muscle Peer (${n.tier})`,
        category: "Peer",
      });
    }
    for (const svc of activeProject?.registered_services || []) {
      items.push({
        token: `@service:${svc.port}`,
        label: `${svc.name} (127.0.0.1:${svc.port})`,
        category: "Service",
      });
    }
    return items.filter(
      (i) =>
        !mentionFilter ||
        i.token.toLowerCase().includes(mentionFilter.toLowerCase()) ||
        i.label.toLowerCase().includes(mentionFilter.toLowerCase())
    );
  }, [gatewayNodes, activeProject?.registered_services, mentionFilter]);

  function handleChatInputChange(val: string) {
    setChatInput(val);
    const atMatch = val.match(/(?:^|\s)@([a-zA-Z0-9._:-]*)$/);
    if (atMatch) {
      setMentionFilter(atMatch[1] || "");
      setSkillMenuOpen(false);
      setMentionMenuOpen(true);
    } else {
      setMentionMenuOpen(false);
    }
  }

  function insertMentionToken(token: string) {
    if (/(?:^|\s)@([a-zA-Z0-9._:-]*)$/.test(chatInput)) {
      const replaced = chatInput.replace(
        /(?:^|\s)@([a-zA-Z0-9._:-]*)$/,
        (m) => (m.startsWith(" ") ? ` ${token} ` : `${token} `)
      );
      setChatInput(replaced);
    } else {
      const prefix =
        chatInput && !chatInput.endsWith(" ") ? `${chatInput} ` : chatInput;
      setChatInput(`${prefix}${token} `);
    }
    setMentionMenuOpen(false);
    setMentionFilter("");
    setTimeout(() => chatInputRef.current?.focus(), 30);
  }

  async function runStreamingPrompt(
    promptText: string,
    overrideProvider?: string,
    attachmentsToSend?: ChatAttachment[],
    displayUserMessage?: string
  ) {
    if (
      !activeProject ||
      (!promptText.trim() &&
        (!attachmentsToSend || attachmentsToSend.length === 0))
    )
      return;
    const userMsg: ChatItem = {
      role: "user",
      content:
        displayUserMessage ||
        promptText.trim() ||
        `Attached ${attachmentsToSend?.length || 1} visual file(s)`,
      attachments:
        attachmentsToSend && attachmentsToSend.length > 0
          ? attachmentsToSend
          : undefined,
    };
    const nextHistory = [...chatHistory, userMsg];
    setChatHistory(nextHistory);
    setChatBusy(true);
    setLiveSteps([]);
    setStreamingReplyText("");
    setStreamingThinkingText("");

    const messagesForAi = [
      ...chatHistory.map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
      })),
      {
        role: "user" as const,
        content:
          promptText.trim() ||
          `Attached ${attachmentsToSend?.length || 1} visual file(s)`,
        attachments: userMsg.attachments,
      },
    ];

    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: activeProject.project_id,
          provider: overrideProvider || provider,
          base_url: baseUrl,
          model: modelName,
          api_key: apiKeyInput,
          stream: true,
          display_user_message: displayUserMessage,
          messages: messagesForAi,
        }),
      });

      if (!res.body) {
        throw new Error("ReadableStream not available");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";

        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          try {
            const evt = JSON.parse(line.replace(/^data:\s*/, ""));
            if (evt.type === "step_start") {
              setLiveSteps((prev) => [
                ...prev,
                {
                  step: evt.step,
                  tool_name: evt.tool_name,
                  detail: evt.detail ? String(evt.detail) : undefined,
                  status: "running",
                },
              ]);
            } else if (evt.type === "step_done" && evt.result) {
              setLiveSteps((prev) =>
                prev.map((s) =>
                  s.step === evt.step && s.tool_name === evt.result.tool_name
                    ? {
                        ...s,
                        detail: evt.detail ? String(evt.detail) : s.detail,
                        status: evt.result.status,
                        cached: Boolean(evt.result.cached),
                      }
                    : s
                )
              );
            } else if (evt.type === "thinking_delta" && evt.delta) {
              setStreamingThinkingText((prev) => prev + String(evt.delta));
            } else if (evt.type === "token_delta" && evt.delta) {
              setStreamingReplyText((prev) => prev + String(evt.delta));
            } else if (evt.type === "cache_metrics" && evt.metrics) {
              setLatestCacheMetrics(evt.metrics);
            } else if (evt.type === "complete") {
              if (evt.cache_metrics) {
                setLatestCacheMetrics(evt.cache_metrics);
              }
              setChatHistory((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: evt.reply || "Completed.",
                  thinking: evt.thinking,
                  cacheMetrics: evt.cache_metrics,
                  toolResults: evt.tool_results,
                },
              ]);
              setStreamingReplyText("");
              setStreamingThinkingText("");
            } else if (evt.type === "error") {
              setChatHistory((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `Error: ${evt.error}`,
                },
              ]);
            }
          } catch {
            // ignore malformed frame
          }
        }
      }
      await loadWorkspace(activeProject.project_id);
      if (primaryNode) {
        fetchRemoteDir(remoteDir);
        if (activeFilePath) openRemoteFile(activeFilePath);
      }
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Orchestrator error: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
      ]);
    } finally {
      setChatBusy(false);
      setLiveSteps([]);
      setStreamingReplyText("");
      setStreamingThinkingText("");
    }
  }

  async function handleSendPrompt(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (
      (!chatInput.trim() &&
        chatAttachments.length === 0 &&
        !selectedChatSkill) ||
      chatBusy ||
      !activeProject
    )
      return;

    const text = chatInput.trim();
    const atts = [...chatAttachments];
    const activeSkill = selectedChatSkill;
    setChatInput("");
    setChatAttachments([]);
    setSelectedChatSkill(null);
    setSkillMenuOpen(false);
    setMentionMenuOpen(false);

    const promptLang = detectInputLang(text, locale);
    const node = primaryNode || "vps2-muscle";

    if (activeSkill === "SkillSearch") {
      const { prompt, displayMsg } = buildSkillSearchPrompt({
        projectId: activeProject.project_id,
        node,
        text,
        promptLang,
      });
      await runStreamingPrompt(prompt, undefined, atts, displayMsg);
      return;
    }

    if (activeSkill === "CheckSystem") {
      const { prompt, displayMsg } = buildCheckSystemPrompt({
        activeProject,
        node,
        text,
        promptLang,
      });
      setSystemScanBusy(true);
      try {
        await runStreamingPrompt(prompt, undefined, atts, displayMsg);
      } finally {
        setSystemScanBusy(false);
      }
      return;
    }

    if (activeSkill === "CheckOpsec") {
      const { prompt, displayMsg } = buildCheckOpsecPrompt({
        activeProject,
        node,
        text,
        promptLang,
      });
      setOpsecScanBusy(true);
      try {
        await runStreamingPrompt(prompt, undefined, atts, displayMsg);
      } finally {
        setOpsecScanBusy(false);
      }
      return;
    }

    if (activeSkill === "DeepForensics") {
      const { prompt, displayMsg } = buildDeepForensicsPrompt({
        projectId: activeProject.project_id,
        node,
        text,
        promptLang,
      });
      await runStreamingPrompt(prompt, undefined, atts, displayMsg);
      return;
    }

    if (activeSkill === "CheckUpdates") {
      let sysStatusSummary = "";
      try {
        const upRes = await fetch(
          "/api/system-update?check_remote=1&inspect_nodes=1",
          { cache: "no-store" }
        );
        if (upRes.ok) {
          const upData = await upRes.json();
          infra.setSystemUpdateStatus(upData);
          sysStatusSummary = JSON.stringify(
            {
              git: upData.git,
              nodes: upData.nodes,
            },
            null,
            2
          );
        }
      } catch {
        // ignore
      }

      const { prompt, displayMsg } = buildCheckUpdatesPrompt({
        projectId: activeProject.project_id,
        node,
        text,
        sysStatusSummary,
      });
      await runStreamingPrompt(prompt, undefined, atts, displayMsg);
      return;
    }

    await runStreamingPrompt(text, undefined, atts);
  }

  async function handleStartSkillInterview(reportContent: string) {
    if (!activeProject || chatBusy) return;
    const node = primaryNode || "vps2-muscle";
    const { prompt, displayMsg } = buildStartSkillInterviewPrompt({
      node,
      reportContent,
    });
    await runStreamingPrompt(prompt, undefined, undefined, displayMsg);
  }

  async function handleInterviewStepResponse(
    decision: "fix" | "skip" | "fix_all" | "stop"
  ) {
    if (!activeProject || chatBusy) return;
    const node = primaryNode || "vps2-muscle";
    const { prompt, displayMsg } = buildInterviewStepResponsePrompt({
      node,
      decision,
    });
    await runStreamingPrompt(prompt, undefined, undefined, displayMsg);
  }

  async function handleUpdateSkillDecision(
    decision: "execute_and_test" | "test_only" | "skip",
    reportContent: string
  ) {
    if (!activeProject || chatBusy) return;
    const node = primaryNode || "vps2-muscle";

    if (decision === "skip" || decision === "test_only") {
      const { prompt, displayMsg } = buildUpdateSkillDecisionPrompt({
        node,
        decision,
        reportContent,
      });
      await runStreamingPrompt(prompt, undefined, undefined, displayMsg);
      return;
    }

    let otaSummary = "";
    try {
      showToast(
        isDe
          ? "Führe Core & Muscle OTA-Sync durch..."
          : "Running Core & Muscle OTA sync...",
        0
      );
      const upRes = await fetch("/api/system-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_all",
          project_id: activeProject.project_id,
        }),
      });
      if (upRes.ok) {
        const upData = await upRes.json();
        if (upData.status) infra.setSystemUpdateStatus(upData.status);
        if (Array.isArray(upData.steps)) infra.setSystemUpdateSteps(upData.steps);
        otaSummary = JSON.stringify(
          {
            success: upData.success,
            steps: upData.steps,
            git: upData.status?.git,
            nodes: upData.status?.nodes,
          },
          null,
          2
        );
      }
    } catch {
      // ignore
    } finally {
      showToast("", 0);
    }

    const { prompt, displayMsg } = buildUpdateSkillDecisionPrompt({
      node,
      decision,
      reportContent,
      otaSummary,
    });
    await runStreamingPrompt(prompt, undefined, undefined, displayMsg);
  }

  async function handleQuickAction(actionPrompt: string) {
    if (!activeProject || chatBusy) return;
    setCopilotDrawerOpen(true);
    await runStreamingPrompt(actionPrompt, "synapse-autonomous");
  }

  async function handleClearChat() {
    if (!activeProject) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "clear_chat",
        project_id: activeProject.project_id,
      }),
    });
    const data = await res.json();
    if (Array.isArray(data.chat_history)) {
      setChatHistory(
        data.chat_history.length > 0
          ? data.chat_history
          : [
              {
                role: "assistant",
                content: isDe
                  ? "Chat-Verlauf geleert."
                  : "Conversation history cleared.",
              },
            ]
      );
    }
  }

  async function handleSaveBrainDoc(doc: "Architecture.md" | "Memory.md") {
    if (!activeProject) return;
    const content = doc === "Architecture.md" ? architectureMd : memoryMd;
    await fetch("/api/projects", {
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

  const unhealthyServices = useMemo(
    () =>
      (activeProject?.registered_services || []).filter(
        (svc) =>
          svc.healthy === false || svc.health_check?.status === "UNHEALTHY"
      ),
    [activeProject?.registered_services]
  );

  const activeHeartbeat =
    (primaryNode && activeProject?.telemetry?.[primaryNode]) ||
    gatewayNodes.find((n) => n.node_id === primaryNode)?.last_heartbeat;

  const filteredPeers = useMemo(() => {
    return gatewayNodes.filter((n) => {
      const matchesQuery =
        !peerSearch.trim() ||
        n.node_id.toLowerCase().includes(peerSearch.toLowerCase()) ||
        (n.last_heartbeat?.hostname || "")
          .toLowerCase()
          .includes(peerSearch.toLowerCase()) ||
        (n.last_heartbeat?.private_ipv4 || "").includes(peerSearch);
      const matchesTier =
        peerTierFilter === "ALL" || n.tier === peerTierFilter;
      return matchesQuery && matchesTier;
    });
  }, [gatewayNodes, peerSearch, peerTierFilter]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((l) => {
      const matchesQuery =
        !activitySearch.trim() ||
        l.tool_name.toLowerCase().includes(activitySearch.toLowerCase()) ||
        l.summary.toLowerCase().includes(activitySearch.toLowerCase()) ||
        (l.node_id || "").toLowerCase().includes(activitySearch.toLowerCase());
      const matchesStatus =
        activityStatusFilter === "ALL" ||
        (activityStatusFilter === "executed"
          ? l.status === "executed" || l.status === "approved"
          : activityStatusFilter === "blocked"
          ? l.status === "blocked" ||
            l.status === "rejected" ||
            l.status === "error"
          : l.status === activityStatusFilter);
      return matchesQuery && matchesStatus;
    });
  }, [auditLogs, activitySearch, activityStatusFilter]);

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

  const sidebarItems: Array<{
    id: NavSection;
    section: string;
    label: string;
    icon: React.ComponentType<{ className?: string; size?: number }>;
    badge?: string | number;
    badgeColor?: "orange" | "green" | "red";
  }> = [
    {
      id: "control-center",
      section: isDe ? "Übersicht & Dienste" : "Overview & Services",
      label: isDe ? "Übersicht" : "Overview",
      icon: Network,
    },
    {
      id: "reverse-proxy",
      section: isDe ? "Übersicht & Dienste" : "Overview & Services",
      label: "Services",
      icon: Globe,
      badge:
        unhealthyServices.length > 0
          ? `${unhealthyServices.length} !`
          : undefined,
      badgeColor: unhealthyServices.length > 0 ? "red" : undefined,
    },
    {
      id: "peers",
      section: isDe ? "Übersicht & Dienste" : "Overview & Services",
      label: "Server & Mesh",
      icon: MonitorSmartphone,
    },
    {
      id: "brain-vault",
      section: isDe ? "Projekt & Dateien" : "Project & Files",
      label: "Brain Vault",
      icon: BookOpen,
    },
    {
      id: "workspace",
      section: isDe ? "Projekt & Dateien" : "Project & Files",
      label: isDe ? "Dateien" : "Files",
      icon: Code2,
    },
    {
      id: "firewall",
      section: isDe ? "Sicherheit & System" : "Security & System",
      label: "Firewall",
      icon: ShieldCheck,
      badge:
        activeProject?.firewall_policies?.[primaryNode || "vps2-muscle"]
          ?.profile === "synapse_stealth"
          ? "Stealth"
          : undefined,
      badgeColor: "green",
    },
    {
      id: "access-control",
      section: isDe ? "Sicherheit & System" : "Security & System",
      label: isDe ? "Regeln" : "Rules",
      icon: Shield,
      badge:
        pendingApprovals.length > 0 ? pendingApprovals.length : undefined,
      badgeColor: pendingApprovals.length > 0 ? "orange" : undefined,
    },
    {
      id: "activity",
      section: isDe ? "Sicherheit & System" : "Security & System",
      label: "Audit-Log",
      icon: Activity,
    },
    {
      id: "settings",
      section: isDe ? "Sicherheit & System" : "Security & System",
      label: isDe ? "Einstellungen" : "Settings",
      icon: Settings,
    },
  ];

  return {
    locale,
    projects,
    activeProject,
    architectureMd,
    setArchitectureMd,
    memoryMd,
    setMemoryMd,
    secretKeys,
    auditLogs,
    cartridges,
    gatewayNodes,
    gatewayUrl,
    setGatewayUrl,
    activeNav,
    setActiveNav,
    sidebarCollapsed,
    setSidebarCollapsed,
    flowView,
    setFlowView,
    focusedCanvasNode,
    setFocusedCanvasNode,
    copilotDrawerOpen,
    setCopilotDrawerOpen,
    settingsTab,
    setSettingsTab,
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
    peerSearch,
    setPeerSearch,
    peerTierFilter,
    setPeerTierFilter,
    activitySearch,
    setActivitySearch,
    activityStatusFilter,
    setActivityStatusFilter,
    brainDocTab,
    setBrainDocTab,
    isEditingMarkdown,
    setIsEditingMarkdown,
    selectedCartridgeId,
    setSelectedCartridgeId,
    terminalDrawerOpen,
    setTerminalDrawerOpen,
    addPeerModalOpen,
    setAddPeerModalOpen,
    aiEndpointModalOpen,
    setAiEndpointModalOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    commandQuery,
    setCommandQuery,
    newProjectModal,
    setNewProjectModal,
    newProjName,
    setNewProjName,
    statusToast,
    setStatusToast,
    remoteDir,
    remoteEntries,
    activeFilePath,
    editorContent,
    setEditorContent,
    diffPatchText,
    setDiffPatchText,
    showDiffDrawer,
    setShowDiffDrawer,
    newFileName,
    setNewFileName,
    provider,
    setProvider,
    baseUrl,
    setBaseUrl,
    modelName,
    setModelName,
    apiKeyInput,
    setApiKeyInput,
    apiKeySecretName,
    discoveredModels,
    syncingModels,
    modelSyncStatus,
    chatInput,
    setChatInput,
    chatAttachments,
    setChatAttachments,
    isDraggingOverChat,
    setIsDraggingOverChat,
    mentionMenuOpen,
    setMentionMenuOpen,
    mentionFilter,
    setMentionFilter,
    streamingReplyText,
    streamingThinkingText,
    latestCacheMetrics,
    enablePromptCaching,
    setEnablePromptCaching,
    enableAutoWatchdog,
    setEnableAutoWatchdog,
    expandedThinking,
    setExpandedThinking,
    fileInputRef,
    chatScrollRef,
    chatInputRef,
    chatComposerRef,
    selectedChatSkill,
    setSelectedChatSkill,
    skillMenuOpen,
    setSkillMenuOpen,
    chatMessageFilter,
    setChatMessageFilter,
    expandedRawPrompts,
    setExpandedRawPrompts,
    copiedChatMsgIdx,
    setCopiedChatMsgIdx,
    turnToolCategoryFilter,
    setTurnToolCategoryFilter,
    chatBusy,
    chatElapsedSec,
    liveSteps,
    expandedTools,
    setExpandedTools,
    chatHistory,
    selectedNodeId,
    setSelectedNodeId,
    joinTier,
    setJoinTier,
    joinNodeName,
    setJoinNodeName,
    copiedJoinCmd,
    setCopiedJoinCmd,
    copiedRebindCmd,
    setCopiedRebindCmd,
    previewPort,
    setPreviewPort,
    previewSubPath,
    setPreviewSubPath,
    previewReloadNonce,
    setPreviewReloadNonce,
    selectedServiceId,
    setSelectedServiceId,
    selectedEndpointId,
    setSelectedEndpointId,
    copilotWide,
    setCopilotWide,
    copilotWidth,
    setCopilotWidth,
    terminalHeight,
    setTerminalHeight,
    workspaceSidebarWidth,
    setWorkspaceSidebarWidth,
    expandedPeerRows,
    setExpandedPeerRows,
    expandedAuditRows,
    setExpandedAuditRows,
    systemScanBusy,
    opsecScanBusy,
    serviceWorkspaceTab,
    setServiceWorkspaceTab,
    peersSubTab,
    setPeersSubTab,
    expandedTurnTools,
    setExpandedTurnTools,
    serviceActionMethod,
    setServiceActionMethod,
    serviceActionPath,
    setServiceActionPath,
    serviceActionPayload,
    setServiceActionPayload,
    serviceActionBusy,
    serviceActionResult,
    blueprints,
    loadWorkspace,
    primaryNode,
    openRemoteFile,
    fetchRemoteDir,
    handleSaveRemoteFile,
    handleApplyUnifiedDiff,
    handleCreateRemoteFile,
    handleDeleteRemoteFile,
    handleSaveAiEndpoint,
    handleSyncModels,
    processDroppedOrSelectedFiles,
    handleChatPaste,
    handleRollbackSnapshot,
    mentionCandidates,
    handleChatInputChange,
    insertMentionToken,
    runStreamingPrompt,
    handleSendPrompt,
    handleStartSkillInterview,
    handleInterviewStepResponse,
    handleUpdateSkillDecision,
    handleQuickAction,
    handleClearChat,
    handleSaveBrainDoc,
    handleInvokeServiceAction,
    handleRemoveService,
    pendingApprovals,
    unhealthyServices,
    activeHeartbeat,
    filteredPeers,
    filteredLogs,
    oneLineInstallerCmd,
    rebindCliCmd,
    sidebarItems,
    ...infra,
  };
}
