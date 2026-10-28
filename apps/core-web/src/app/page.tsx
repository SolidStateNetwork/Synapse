"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
  Bot,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Code2,
  Command,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  FileCode2,
  FileText,
  Folder,
  FolderGit2,
  GitCompare,
  Globe,
  HardDrive,
  KeyRound,
  Layers,
  Lock,
  MonitorSmartphone,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Server,
  Settings,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal as TerminalIcon,
  Trash2,
  Users,
  Wrench,
  X,
  Zap,
  Image as ImageIcon,
  Paperclip,
  RotateCcw,
  AtSign,
  Brain,
} from "lucide-react";
import RichMarkdownDocument from "@/components/RichMarkdownDocument";
import InteractiveControlCenterCanvas from "@/components/InteractiveControlCenterCanvas";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
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
  NodeHeartbeat,
  PendingApproval,
  PROVIDER_PRESETS,
  ProjectState,
  PromptCacheMetrics,
  StackBlueprint,
  ToolResultItem,
} from "@/types/synapse";
import {
  SynapseSubTabs,
  SynapseViewHeader,
} from "@/components/ui/SynapseDesignSystem";
import FirewallView from "@/components/views/FirewallView";
import AccessRulesView from "@/components/views/AccessRulesView";
import AuditLogView from "@/components/views/AuditLogView";
import ControlCenterModals from "@/components/modals/ControlCenterModals";

const XTermTerminal = dynamic(() => import("@/components/XTermTerminal"), {
  ssr: false,
});

export default function SynapseNetBirdControlCenter() {
  const { locale } = useI18n();
  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectState | null>(null);
  const [architectureMd, setArchitectureMd] = useState("");
  const [memoryMd, setMemoryMd] = useState("");
  const [secretKeys, setSecretKeys] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [cartridges, setCartridges] = useState<CartridgeMeta[]>([]);
  const [gatewayNodes, setGatewayNodes] = useState<GatewayNode[]>([]);
  const [gatewayUrl, setGatewayUrl] = useState("http://127.0.0.1:8081");

  // NetBird Dashboard Navigation State
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
  const [systemUpdateBusy, setSystemUpdateBusy] = useState(false);
  const [systemUpdateActionLabel, setSystemUpdateActionLabel] = useState("");
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [systemUpdateStatus, setSystemUpdateStatus] = useState<{
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
  } | null>(null);
  const [systemUpdateSteps, setSystemUpdateSteps] = useState<
    Array<{
      step: string;
      status: "ok" | "warn" | "error";
      detail: string;
      duration_ms: number;
    }>
  >([]);
  const [mcpKeyName, setMcpKeyName] = useState("External AI Agent (MCP)");
  const [mcpKeyScopeMode, setMcpKeyScopeMode] = useState<"read-exec" | "read-only">("read-exec");
  const [issuedMcpToken, setIssuedMcpToken] = useState<string | null>(null);
  const [copiedMcpToken, setCopiedMcpToken] = useState(false);
  const [showMcpConfigExamples, setShowMcpConfigExamples] = useState(false);
  const [copiedMcpConfig, setCopiedMcpConfig] = useState<"json" | "curl" | null>(null);
  const [mcpTestOutput, setMcpTestOutput] = useState<string>("");
  const [debugModeEnabled, setDebugModeEnabled] = useState(false);
  const [debugSnapshot, setDebugSnapshot] = useState<Record<string, unknown> | null>(null);
  const [selfTestChecks, setSelfTestChecks] = useState<
    Array<{
      id: string;
      name: string;
      status: "PASS" | "WARN" | "FAIL";
      latency_ms: number;
      detail: string;
    }>
  >([]);
  const [runningSelfTest, setRunningSelfTest] = useState(false);

  // Peer & Activity Filters (NetBird Chip Filter bar)
  const [peerSearch, setPeerSearch] = useState("");
  const [peerTierFilter, setPeerTierFilter] = useState<string>("ALL");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityStatusFilter, setActivityStatusFilter] =
    useState<string>("ALL");

  // Brain Vault & Cartridges sub-state
  const [brainDocTab, setBrainDocTab] = useState<
    "Architecture.md" | "Memory.md"
  >("Architecture.md");
  const [isEditingMarkdown, setIsEditingMarkdown] = useState(false);
  const [selectedCartridgeId, setSelectedCartridgeId] = useState<string>("");

  // Bottom Live PTY Drawer & Modals
  const [terminalDrawerOpen, setTerminalDrawerOpen] = useState(false);
  const [addPeerModalOpen, setAddPeerModalOpen] = useState(false);
  const [aiEndpointModalOpen, setAiEndpointModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [newProjectModal, setNewProjectModal] = useState(false);
  const [newProjName, setNewProjName] = useState("");
  const [statusToast, setStatusToast] = useState<string>("");

  // Remote File Explorer & Editor State
  const [remoteDir, setRemoteDir] = useState(".");
  const [remoteEntries, setRemoteEntries] = useState<FsEntry[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string>(
    "service/server.js"
  );
  const [editorContent, setEditorContent] = useState<string>("");
  const [diffPatchText, setDiffPatchText] = useState<string>("");
  const [showDiffDrawer, setShowDiffDrawer] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  // AI Provider & Custom Base URL Configuration
  const [provider, setProvider] = useState("openai-compatible");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [modelName, setModelName] = useState("gpt-4o");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeySecretName, setApiKeySecretName] = useState("LLM_API_KEY");
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [syncingModels, setSyncingModels] = useState(false);
  const [modelSyncStatus, setModelSyncStatus] = useState("");

  // Copilot Chat, Multimodal Vision Drag & Drop, Live Token/Thinking Stream & Caching State
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

  // Peer Onboarding & Secrets
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [joinTier, setJoinTier] = useState<AutonomyTier>(
    "TIER_2_WORKSPACE_JAIL"
  );
  const [joinNodeName, setJoinNodeName] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [copiedJoinCmd, setCopiedJoinCmd] = useState(false);
  const [copiedRebindCmd, setCopiedRebindCmd] = useState(false);
  const [newSecretKey, setNewSecretKey] = useState("");
  const [newSecretVal, setNewSecretVal] = useState("");
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
  const [systemScanBusy, setSystemScanBusy] = useState<boolean>(false);
  const [opsecScanBusy, setOpsecScanBusy] = useState<boolean>(false);
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<
    "all" | "webui" | "backend" | "database"
  >("all");
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

  // Wave 2 Expansion State: Blueprints, Custom Cartridges, Playbooks & Mesh Links
  const [blueprints, setBlueprints] = useState<StackBlueprint[]>([]);
  const [showCustomCartModal, setShowCustomCartModal] = useState(false);
  const [customCartName, setCustomCartName] = useState("");
  const [customCartCategory, setCustomCartCategory] = useState("Custom");
  const [customCartDesc, setCustomCartDesc] = useState("");
  const [customCartContent, setCustomCartContent] = useState(
    "# Custom DevOps Policy\n\n1. Always verify systemd unit syntax before reload.\n2. Keep logs under /var/log/synapse."
  );
  const [playbookName, setPlaybookName] = useState("");
  const [playbookCron, setPlaybookCron] = useState("0 */6 * * *");
  const [playbookPrompt, setPlaybookPrompt] = useState("");
  const [meshSourceNode, setMeshSourceNode] = useState("");
  const [meshTargetNode, setMeshTargetNode] = useState("");
  const [meshTargetPort, setMeshTargetPort] = useState(5432);
  const [meshAliasEnv, setMeshAliasEnv] = useState("PEER_DB_URL");

  const loadWorkspace = useCallback(
    async (projectId?: string, syncAiSettings = false) => {
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
          `/api/projects?project_id=${encodeURIComponent(pid)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        setProjects(data.projects || []);
        setActiveProject(data.active_project);
        setArchitectureMd(data.architecture_md || "");
        setMemoryMd(data.memory_md || "");
        setSecretKeys(data.secret_keys || []);
        setAuditLogs(data.audit_logs || []);
        setCartridges(data.cartridges || []);
        setBlueprints(data.blueprints || []);
        setGatewayNodes(data.gateway_nodes || []);
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
            setChatHistory(data.chat_history);
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
      }
    },
    [activeProject?.project_id]
  );

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
    setStatusToast(`Dienst ${serviceId} entfernt`);
    setTimeout(() => setStatusToast(""), 3000);
    await loadWorkspace(activeProject.project_id);
  }

  useEffect(() => {
    loadWorkspace("synapse-cloud-demo", true);
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

  const primaryNode =
    selectedNodeId ||
    activeProject?.assigned_nodes?.[0]?.node_id ||
    gatewayNodes[0]?.node_id ||
    "";

  const fetchRemoteDir = useCallback(
    async (dirPath: string) => {
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
        if (tr?.output?.entries) {
          setRemoteEntries(tr.output.entries);
          setRemoteDir(dirPath);
        }
      } catch {
        // ignore
      }
    },
    [activeProject, primaryNode]
  );

  const openRemoteFile = useCallback(
    async (filePath: string) => {
      if (!activeProject || !primaryNode) return;
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

  useEffect(() => {
    if (primaryNode && activeProject && !activeProject.planning_only) {
      fetchRemoteDir(".");
      openRemoteFile("service/server.js");
    }
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
      setStatusToast(`Saved ${activeFilePath}`);
      setTimeout(() => setStatusToast(""), 3000);
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
      setStatusToast(`Applied atomic diff to ${activeFilePath}`);
      setTimeout(() => setStatusToast(""), 3000);
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
    setStatusToast(`Saved AI Provider: ${modelName}`);
    setTimeout(() => setStatusToast(""), 3000);
    await loadWorkspace(activeProject.project_id, true);
  }

  async function handleSyncModels() {
    if (!activeProject) return;
    setSyncingModels(true);
    setModelSyncStatus("Querying /models...");
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
        setModelName(data.models[0]);
        setModelSyncStatus(`Loaded ${data.models.length} models`);
      } else {
        setModelSyncStatus(data.error || "No models returned by endpoint");
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
        setStatusToast(`Skipped ${file.name} (>8MB limit)`);
        setTimeout(() => setStatusToast(""), 3000);
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
        setStatusToast(`Rolled back ${filePath || snapshotId}`);
        setTimeout(() => setStatusToast(""), 3000);
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
        setStatusToast(data.error || "Rollback failed");
        setTimeout(() => setStatusToast(""), 3000);
      }
    } catch {
      setStatusToast("Rollback request failed");
      setTimeout(() => setStatusToast(""), 3000);
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
        openRemoteFile(activeFilePath);
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

    const detectInputLang = (sample: string): "de" | "en" => {
      const trimmed = (sample || "").trim();
      if (!trimmed) return locale === "en" ? "en" : "de";
      const deWords =
        (trimmed.match(
          /\b(wie|was|warum|wo|wann|bitte|zeig|zeige|prüf|prüfe|teste|finde|suche|erkläre|erstelle|baue|behebe|aktualisiere|ist|sind|nicht|und|oder|für|mit|auf|dem|den|der|die|das|ein|eine|meine|deine|alle|servern|dienste|dateien)\b/gi
        ) || []).length + (/[äöüß]/i.test(trimmed) ? 2 : 0);
      const enWords = (
        trimmed.match(
          /\b(what|how|why|where|when|who|can|could|would|should|please|show|check|test|find|search|list|explain|tell|give|help|create|deploy|build|fix|update|is|are|do|does|the|with|from|for|and|all|my|your|our|servers|services|ports|files)\b/gi
        ) || []
      ).length;
      if (enWords > deWords) return "en";
      if (deWords > enWords) return "de";
      return locale === "en" ? "en" : "de";
    };
    const promptLang = detectInputLang(text);
    const langInstruction =
      promptLang === "en"
        ? "IMPORTANT LANGUAGE RULE: Respond thoroughly and accurately in ENGLISH."
        : "WICHTIGE SPRACHREGEL: Antworte ausführlich und präzise auf DEUTSCH.";

    if (activeSkill === "SkillSearch") {
      const node = primaryNode || "vps2-muscle";
      const searchQuery =
        text ||
        (promptLang === "en"
          ? "Give me a complete overview of all UI features as well as all files, databases, ports, and services on the server."
          : "Gib mir eine vollständige Übersicht über alle Funktionen in der UI sowie alle Dateien, Datenbanken, Ports und Dienste auf dem Server.");
      const aiSearchPrompt = [
        `Du führst jetzt den erweiterten DevOps-Such-Skill **SkillSearch** (Vollständige System-, Code-, Log-, Datenbank- & UI-Tiefensuche) für das Projekt \`${activeProject.project_id}\` auf \`@${node}\` aus.`,
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
      await runStreamingPrompt(aiSearchPrompt, undefined, atts, displayMsg);
      return;
    }

    if (activeSkill === "CheckSystem") {
      const node = primaryNode || "vps2-muscle";
      const svcsList =
        (activeProject.registered_services || [])
          .map(
            (s) =>
              `${s.name} (${s.category || "backend"} auf ${s.node_id}:${s.port}, Pfad: ${s.path || "/"}, DB: ${s.db_path || "keine"})`
          )
          .join("; ") || "keine registrierten Services";

      const aiMissionPrompt = [
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

      setSystemScanBusy(true);
      try {
        await runStreamingPrompt(aiMissionPrompt, undefined, atts, displayMsg);
      } finally {
        setSystemScanBusy(false);
      }
      return;
    }

    if (activeSkill === "CheckOpsec") {
      const node = primaryNode || "vps2-muscle";
      const currentTier =
        activeProject.assigned_nodes[0]?.tier || "TIER_1_UNLEASHED";
      const activeCarts =
        (activeProject.active_cartridges || []).join(", ") || "keine";

      const aiOpsecPrompt = [
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

      setOpsecScanBusy(true);
      try {
        await runStreamingPrompt(aiOpsecPrompt, undefined, atts, displayMsg);
      } finally {
        setOpsecScanBusy(false);
      }
      return;
    }

    if (activeSkill === "DeepForensics") {
      const node = primaryNode || "vps2-muscle";
      const focusTopic =
        text ||
        (promptLang === "en"
          ? "Inspect all logs, processes, databases, and source files for hidden errors, warnings, performance bottlenecks, or inconsistencies."
          : "Untersuche alle Logs, Prozesse, Datenbanken und Quellcode-Dateien auf versteckte Fehler, Warnungen, Performance-Engpässe oder Inkonsistenzen.");
      const aiForensicsPrompt = [
        `Du führst jetzt den Skill **DeepForensics** (Tiefgreifende DevOps-Fehler-, Log-, Code- & Datenbank-Forensik) für \`${activeProject.project_id}\` auf \`@${node}\` aus.`,
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
      await runStreamingPrompt(aiForensicsPrompt, undefined, atts, displayMsg);
      return;
    }

    if (activeSkill === "CheckUpdates") {
      const node = primaryNode || "vps2-muscle";
      let sysStatusSummary = "";
      try {
        const upRes = await fetch(
          "/api/system-update?check_remote=1&inspect_nodes=1",
          { cache: "no-store" }
        );
        if (upRes.ok) {
          const upData = await upRes.json();
          setSystemUpdateStatus(upData);
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

      const aiUpdateCheckPrompt = [
        `Du führst jetzt den Skill **CheckUpdates** (Umfassende Update-Prüfung aller Muscle-Server, Axon-Daemons, Linux-Pakete & Workspace-Backends) für das Projekt \`${activeProject.project_id}\` auf \`@${node}\` aus.`,
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

      await runStreamingPrompt(
        aiUpdateCheckPrompt,
        undefined,
        atts,
        displayMsg
      );
      return;
    }

    await runStreamingPrompt(text, undefined, atts);
  }

  async function handleStartSkillInterview(reportContent: string) {
    if (!activeProject || chatBusy) return;
    const node = primaryNode || "vps2-muscle";
    const interviewPrompt = [
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
    await runStreamingPrompt(interviewPrompt, undefined, undefined, displayMsg);
  }

  async function handleInterviewStepResponse(
    decision: "fix" | "skip" | "fix_all" | "stop"
  ) {
    if (!activeProject || chatBusy) return;
    const node = primaryNode || "vps2-muscle";
    if (decision === "fix") {
      const prompt = [
        `Der Nutzer hat entschieden: **JA, DIESEN PUNKT JETZT BEHEBEN.**`,
        `1. Führe die besprochene Behebung für den aktuellen Punkt jetzt sofort live auf \`@${node}\` mit deinen Tools (\`node_fs_operation\`, \`node_pty_exec\`, \`core_register_service\`, \`core_update_brain_doc\`) durch und verifiziere kurz, dass die Änderung erfolgreich aktiv ist.`,
        `2. Bestätige in 1–2 Sätzen, was du behoben hast.`,
        `3. Stelle mir direkt darunter den **nächsten offenen Punkt (Punkt X von N)** aus dem ursprünglichen Bericht vor und frage wieder: **„Soll ich diesen Punkt jetzt beheben oder überspringen?“** (Falls alle Punkte abgearbeitet sind, gib eine kurze Abschluss-Zusammenfassung).`,
      ].join("\n");
      await runStreamingPrompt(
        prompt,
        undefined,
        undefined,
        `✅ **[Interview-Antwort]** Ja, diesen Punkt jetzt beheben und danach den nächsten Punkt vorstellen.`
      );
    } else if (decision === "skip") {
      const prompt = [
        `Der Nutzer hat entschieden: **DIESEN PUNKT ÜBERSPRINGEN (NICHT BEHEBEN).**`,
        `Nimm an diesem Punkt KEINE Änderungen vor. Stelle mir jetzt direkt den **nächsten offenen Punkt (Punkt X von N)** aus dem Bericht vor (Befund, geplante Behebung, Auswirkung) und frage: **„Soll ich diesen Punkt jetzt beheben oder überspringen?“** (Falls keine weiteren Punkte offen sind, gib eine kurze Abschluss-Zusammenfassung).`,
      ].join("\n");
      await runStreamingPrompt(
        prompt,
        undefined,
        undefined,
        `⏭️ **[Interview-Antwort]** Diesen Punkt überspringen – bitte nächsten Punkt vorstellen.`
      );
    } else if (decision === "fix_all") {
      const prompt = [
        `Der Nutzer hat entschieden: **ALLE RESTLICHEN PUNKTE AUTOMATISCH BEHEBEN.**`,
        `Gehe jetzt alle noch offenen Punkte aus dem Bericht nacheinander durch, setze die Behebungen live auf \`@${node}\` mit deinen Tools um, aktualisiere bei Bedarf \`Memory.md\` / \`Architecture.md\` und erstelle einen abschließenden Erfolgsbericht über alle durchgeführten Korrekturen.`,
      ].join("\n");
      await runStreamingPrompt(
        prompt,
        undefined,
        undefined,
        `⚡ **[Interview-Antwort]** Alle restlichen Punkte aus dem Bericht jetzt automatisch beheben.`
      );
    } else {
      const prompt = [
        `Der Nutzer beendet das Interview.`,
        `Fasse kurz und übersichtlich auf Deutsch zusammen, welche Punkte im Rahmen des Interviews bereits behoben wurden und welche Punkte übersprungen / offen gelassen wurden.`,
      ].join("\n");
      await runStreamingPrompt(
        prompt,
        undefined,
        undefined,
        `⏹️ **[Interview-Antwort]** Interview beenden & Zusammenfassung anzeigen.`
      );
    }
  }

  async function handleUpdateSkillDecision(
    decision: "execute_and_test" | "test_only" | "skip",
    reportContent: string
  ) {
    if (!activeProject || chatBusy) return;
    const node = primaryNode || "vps2-muscle";

    if (decision === "skip") {
      const prompt = [
        `Der Nutzer hat entschieden: **NEIN, KEINE UPDATES DURCHFÜHREN.**`,
        `Nimm KEINE Änderungen oder Updates an den Muscle-Servern oder Backends vor und bestätige kurz auf Deutsch, dass alle Dienste im aktuellen Zustand belassen wurden.`,
      ].join("\n");
      await runStreamingPrompt(
        prompt,
        undefined,
        undefined,
        `❌ **[Update-Entscheidung]** Nein, Updates jetzt nicht durchführen.`
      );
      return;
    }

    if (decision === "test_only") {
      const prompt = [
        `Der Nutzer möchte **OHNE vorheriges Update sofort einen vollständigen End-to-End Funktionstest** aller Muscle-Server und Backends auf \`@${node}\` durchführen.`,
        `Führe jetzt folgende Live-Tests durch:`,
        `1. Prüfe per \`node_deep_search\` (\`search_mode: "process_and_port_map"\`), dass \`axon\`, \`axon-db\` und alle Backend-Ports (\`:4050\`, \`:4060\`, \`:4070\`) aktiv lauschen.`,
        `2. Prüfe per \`node_pty_exec\` mit \`curl -sS -i http://127.0.0.1:4050/\`, \`curl -sS -i http://127.0.0.1:4060/api/events\` und \`curl -sS -i http://127.0.0.1:4070/query\`, ob alle HTTP- & JSON-Endpunkte fehlerfrei mit HTTP 200 antworten.`,
        `3. Prüfe per \`node_deep_search\` (\`search_mode: "sqlite_inspect"\`), ob alle SQLite-Datenbanken \`PRAGMA integrity_check = ok\` melden.`,
        `4. Erstelle einen klaren **Funktionstest-Bericht (PASS / FAIL)** für jedes getestete Backend.`,
      ].join("\n");
      await runStreamingPrompt(
        prompt,
        undefined,
        undefined,
        `🧪 **[Update-Entscheidung]** Nur vollständigen End-to-End Funktionstest aller Muscle-Backends ausführen.`
      );
      return;
    }

    // decision === "execute_and_test":
    // 1. Trigger OTA Muscle & Core sync via /api/system-update first so /usr/local/bin/axon is freshly synced
    let otaSummary = "";
    try {
      setStatusToast("Führe Core & Muscle OTA-Sync durch...");
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
        if (upData.status) setSystemUpdateStatus(upData.status);
        if (Array.isArray(upData.steps)) setSystemUpdateSteps(upData.steps);
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
      setStatusToast("");
    }

    const executeAndTestPrompt = [
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

    await runStreamingPrompt(
      executeAndTestPrompt,
      undefined,
      undefined,
      `🚀 **[Update & Funktionstest]** Ja, alle Updates für Muscle & Backends jetzt durchführen und anschließend auf Herz und Nieren testen!`
    );
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
                content: "Conversation history cleared.",
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
    setStatusToast(`Saved ${doc}`);
    setTimeout(() => setStatusToast(""), 3000);
    await loadWorkspace(activeProject.project_id);
  }

  async function handleGenerateJoinToken() {
    if (!activeProject) return;
    const res = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: activeProject.project_id,
        tier: joinTier,
        ttl_minutes: 30,
      }),
    });
    const data = await res.json();
    if (data.token) setIssuedToken(data.token);
  }

  async function handleAssignNode(nodeId: string, tier: AutonomyTier) {
    if (!activeProject || !nodeId.trim()) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign_node",
        project_id: activeProject.project_id,
        node_id: nodeId.trim(),
        tier,
      }),
    });
    setSelectedNodeId(nodeId.trim());
    await loadWorkspace(activeProject.project_id);
  }

  async function handleUnassignNode(nodeId: string) {
    if (!activeProject) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "unassign_node",
        project_id: activeProject.project_id,
        node_id: nodeId,
      }),
    });
    await loadWorkspace(activeProject.project_id);
  }

  async function handleToggleCartridge(cartridgeId: string) {
    if (!activeProject) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "toggle_cartridge",
        project_id: activeProject.project_id,
        cartridge_id: cartridgeId,
      }),
    });
    await loadWorkspace(activeProject.project_id);
  }

  async function handleAddSecret(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProject || !newSecretKey.trim()) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_secret",
        project_id: activeProject.project_id,
        key: newSecretKey.trim(),
        value: newSecretVal,
      }),
    });
    setNewSecretKey("");
    setNewSecretVal("");
    setStatusToast(`Encrypted ${newSecretKey.trim().toUpperCase()} in Vault`);
    setTimeout(() => setStatusToast(""), 3000);
    await loadWorkspace(activeProject.project_id);
  }

  async function handleDeleteSecret(keyName: string) {
    if (!activeProject) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete_secret",
        project_id: activeProject.project_id,
        key: keyName,
      }),
    });
    await loadWorkspace(activeProject.project_id);
  }

  async function handleResolveApproval(
    approvalId: string,
    decision: "approve" | "reject"
  ) {
    if (!activeProject) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "resolve_approval",
        project_id: activeProject.project_id,
        approval_id: approvalId,
        decision,
      }),
    });
    const data = await res.json();
    if (data.execution) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Approved & executed \`${data.approval.tool_name}\` (${approvalId}).`,
          toolResults: [data.execution],
        },
      ]);
    }
    await loadWorkspace(activeProject.project_id);
  }

  const pendingApprovals = (activeProject?.pending_approvals || []).filter(
    (a) => a.status === "pending"
  );

  const unhealthyServices = (activeProject?.registered_services || []).filter(
    (svc) =>
      svc.healthy === false || svc.health_check?.status === "UNHEALTHY"
  );

  const activeHeartbeat =
    (primaryNode && activeProject?.telemetry?.[primaryNode]) ||
    gatewayNodes.find((n) => n.node_id === primaryNode)?.last_heartbeat;

  const currentCartridge =
    cartridges.find((c) => c.id === selectedCartridgeId) || cartridges[0];

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

  const oneLineInstallerCmd = issuedToken
    ? `curl -fsSL ${gatewayUrl.replace(/\/$/, "")}/install.sh | sudo sh -s -- ${issuedToken} ${joinTier}${
        joinNodeName.trim() ? ` ${joinNodeName.trim()}` : ""
      }`
    : "";

  const rebindCliCmd = issuedToken
    ? `sudo axon switch --core ${gatewayUrl.replace(/\/$/, "")} --token ${issuedToken} --tier ${joinTier}${
        joinNodeName.trim() ? ` --node ${joinNodeName.trim()}` : ""
      } --restart`
    : "";

  async function handleCreateCustomCartridge(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProject || !customCartName.trim()) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_custom_cartridge",
        project_id: activeProject.project_id,
        name: customCartName.trim(),
        category: customCartCategory.trim() || "Custom",
        description: customCartDesc.trim() || "Custom user-defined policy cartridge",
        content: customCartContent,
      }),
    });
    const data = await res.json();
    if (data.cartridge) {
      setSelectedCartridgeId(data.cartridge.id);
      setShowCustomCartModal(false);
      setCustomCartName("");
      setCustomCartDesc("");
      setStatusToast(`Created & enabled Cartridge: ${data.cartridge.name}`);
      setTimeout(() => setStatusToast(""), 3000);
      await loadWorkspace(activeProject.project_id);
    }
  }

  async function handleAddPlaybook(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProject || !playbookName.trim() || !playbookPrompt.trim()) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_playbook",
        project_id: activeProject.project_id,
        name: playbookName.trim(),
        cron: playbookCron.trim() || "0 */6 * * *",
        prompt: playbookPrompt.trim(),
        enabled: true,
      }),
    });
    setPlaybookName("");
    setPlaybookPrompt("");
    setStatusToast("Scheduled AI Playbook saved");
    setTimeout(() => setStatusToast(""), 3000);
    await loadWorkspace(activeProject.project_id);
  }

  async function handleTogglePlaybook(pb: {
    playbook_id: string;
    name: string;
    cron?: string;
    cron_expression?: string;
    prompt: string;
    enabled: boolean;
  }) {
    if (!activeProject) return;
    const cronVal = pb.cron || pb.cron_expression || "0 3 * * *";
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_playbook",
        project_id: activeProject.project_id,
        playbook_id: pb.playbook_id,
        name: pb.name,
        cron: cronVal,
        cron_expression: cronVal,
        prompt: pb.prompt,
        enabled: !pb.enabled,
      }),
    });
    await loadWorkspace(activeProject.project_id);
  }

  async function handleDeletePlaybook(playbookId: string) {
    if (!activeProject) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete_playbook",
        project_id: activeProject.project_id,
        playbook_id: playbookId,
      }),
    });
    await loadWorkspace(activeProject.project_id);
  }

  async function handleAddMeshLink(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProject || !meshSourceNode.trim() || !meshTargetNode.trim()) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_mesh_link",
        project_id: activeProject.project_id,
        source_node_id: meshSourceNode.trim(),
        target_node_id: meshTargetNode.trim(),
        target_port: Number(meshTargetPort) || 5432,
        protocol: "tcp",
        alias_env: meshAliasEnv.trim() || "PEER_SERVICE_URL",
      }),
    });
    setStatusToast(
      `Linked ${meshSourceNode.trim()} -> ${meshTargetNode.trim()}:${meshTargetPort}`
    );
    setTimeout(() => setStatusToast(""), 3000);
    await loadWorkspace(activeProject.project_id);
  }

  async function handleRemoveMeshLink(linkId: string) {
    if (!activeProject) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "remove_mesh_link",
        project_id: activeProject.project_id,
        link_id: linkId,
      }),
    });
    await loadWorkspace(activeProject.project_id);
  }

  const fetchDebugSnapshot = useCallback(async () => {
    const pid = activeProject?.project_id || "synapse-cloud-demo";
    try {
      const res = await fetch(
        `/api/debug?project_id=${encodeURIComponent(pid)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      setDebugSnapshot(data);
      const cw = data.core_web as Record<string, unknown> | undefined;
      const gw = data.gateway as Record<string, unknown> | undefined;
      setDebugModeEnabled(
        Boolean(cw?.debug_enabled || gw?.debug_enabled)
      );
    } catch {
      // ignore
    }
  }, [activeProject?.project_id]);

  async function handleToggleDebugMode() {
    const pid = activeProject?.project_id || "synapse-cloud-demo";
    const next = !debugModeEnabled;
    setDebugModeEnabled(next);
    await fetch("/api/debug", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: pid,
        action: "toggle_debug",
        enabled: next,
      }),
    });
    setStatusToast(
      next
        ? "Debug Mode ENABLED (Core + Gateway + Muscle traces)"
        : "Debug Mode DISABLED"
    );
    setTimeout(() => setStatusToast(""), 3000);
    await fetchDebugSnapshot();
  }

  async function handleRunSelfTest() {
    const pid = activeProject?.project_id || "synapse-cloud-demo";
    setRunningSelfTest(true);
    try {
      const res = await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: pid,
          action: "run_self_test",
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.checks)) {
        setSelfTestChecks(data.checks);
      }
      await fetchDebugSnapshot();
    } finally {
      setRunningSelfTest(false);
    }
  }

  const fetchSystemUpdateStatus = useCallback(async (checkRemote = false, inspectNodes = true) => {
    try {
      const qs = new URLSearchParams();
      if (checkRemote) qs.set("check_remote", "1");
      if (inspectNodes) qs.set("inspect_nodes", "1");
      const res = await fetch(`/api/system-update?${qs.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setSystemUpdateStatus(data);
      }
    } catch {
      // ignore transient error
    }
  }, []);

  useEffect(() => {
    fetchSystemUpdateStatus(true, true);
    const timer = setInterval(() => {
      fetchSystemUpdateStatus(true, true);
    }, 60000);
    return () => clearInterval(timer);
  }, [fetchSystemUpdateStatus]);

  useEffect(() => {
    if (activeNav === "settings" && settingsTab === "system-update") {
      fetchSystemUpdateStatus(false, true);
    } else if (activeNav === "settings" && settingsTab === "debug-console") {
      fetchDebugSnapshot();
    }
  }, [activeNav, settingsTab, fetchSystemUpdateStatus, fetchDebugSnapshot]);

  async function handleRunSystemUpdate(
    action: "check" | "update_core" | "update_muscle" | "update_all",
    targetNodeId?: string
  ) {
    if (systemUpdateBusy) return;
    const pid = activeProject?.project_id || "synapse-cloud-demo";
    setSystemUpdateBusy(true);
    setSystemUpdateActionLabel(
      action === "check"
        ? "Prüfe Git & Muscle Versionen..."
        : action === "update_core"
        ? "Aktualisiere Core Plane..."
        : action === "update_muscle"
        ? targetNodeId
          ? `OTA-Update auf ${targetNodeId}...`
          : "OTA-Update auf allen Muscle-Knoten..."
        : "Komplett-Update (Core + Muscle OTA)..."
    );
    try {
      const res = await fetch("/api/system-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          project_id: pid,
          node_id: targetNodeId,
        }),
      });
      const data = await res.json();
      if (data.status) {
        setSystemUpdateStatus(data.status);
      }
      if (Array.isArray(data.steps)) {
        setSystemUpdateSteps(data.steps);
      }
      setStatusToast(
        data.success
          ? action === "check"
            ? "Versionsprüfung abgeschlossen"
            : "System-Update erfolgreich durchgeführt!"
          : "Update mit Hinweisen/Warnungen beendet"
      );
      setTimeout(() => setStatusToast(""), 4000);
      await loadWorkspace(pid);
    } catch (err) {
      setSystemUpdateSteps([
        {
          step: "System-Update Anfrage",
          status: "error",
          detail: err instanceof Error ? err.message : String(err),
          duration_ms: 0,
        },
      ]);
    } finally {
      setSystemUpdateBusy(false);
      setSystemUpdateActionLabel("");
    }
  }

  function handleRunSystemScan() {
    if (chatBusy) return;
    setCopilotDrawerOpen(true);
    setSelectedChatSkill((prev) =>
      prev === "CheckSystem" ? null : "CheckSystem"
    );
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 60);
  }

  function handleRunOpsecScan() {
    if (chatBusy) return;
    setCopilotDrawerOpen(true);
    setSelectedChatSkill((prev) =>
      prev === "CheckOpsec" ? null : "CheckOpsec"
    );
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 60);
  }

  async function handleCreateMcpKey(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProject) return;
    const scopes =
      mcpKeyScopeMode === "read-only" ? ["read"] : ["read", "execute", "admin"];
    const res = await fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: activeProject.project_id,
        action: "create_key",
        name: mcpKeyName.trim() || "External AI Agent (MCP)",
        scopes,
      }),
    });
    const data = await res.json();
    if (data.plaintext_token) {
      setIssuedMcpToken(data.plaintext_token);
      setStatusToast("Generated External AI / MCP API Token");
      setTimeout(() => setStatusToast(""), 3000);
      await loadWorkspace(activeProject.project_id);
    }
  }

  async function handleRevokeMcpKey(keyId: string) {
    if (!activeProject) return;
    await fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: activeProject.project_id,
        action: "revoke_key",
        key_id: keyId,
      }),
    });
    await loadWorkspace(activeProject.project_id);
  }

  async function handleTestMcpEndpoint(method: "tools/list" | "resources/list" | "call_state") {
    const pid = activeProject?.project_id || "synapse-cloud-demo";
    const payload =
      method === "call_state"
        ? {
            jsonrpc: "2.0",
            id: 1,
            project_id: pid,
            internal_ui_test: true,
            method: "tools/call",
            params: {
              name: "synapse_get_project_state",
              arguments: { project_id: pid },
            },
          }
        : {
            jsonrpc: "2.0",
            id: 1,
            project_id: pid,
            internal_ui_test: true,
            method,
          };

    const res = await fetch("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setMcpTestOutput(JSON.stringify(data, null, 2));
  }

  // Firewall & Port-Shield State
  const [firewallBusy, setFirewallBusy] = useState(false);
  const [firewallError, setFirewallError] = useState("");
  const [fwIpInput, setFwIpInput] = useState("");
  const [fwRuleAction, setFwRuleAction] = useState<"block" | "allow">("block");
  const [fwRulePort, setFwRulePort] = useState("");
  const [fwRuleNote, setFwRuleNote] = useState("");
  const [liveFirewallPorts, setLiveFirewallPorts] = useState<
    Array<{
      port: number;
      protocol: "tcp" | "udp";
      bind_address: string;
      exposure: "public" | "local";
      process: string;
      pid?: number;
      service_name?: string;
      shielded: boolean;
      system_protected?: boolean;
    }>
  >([]);

  const fetchFirewallStatus = useCallback(
    async (targetNode?: string) => {
      const pid = activeProject?.project_id || "synapse-cloud-demo";
      const nid =
        targetNode ||
        selectedNodeId ||
        activeProject?.assigned_nodes?.[0]?.node_id ||
        gatewayNodes[0]?.node_id ||
        "vps2-muscle";
      setFirewallBusy(true);
      setFirewallError("");
      try {
        const res = await fetch(
          `/api/firewall?project_id=${encodeURIComponent(
            pid
          )}&node_id=${encodeURIComponent(nid)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (Array.isArray(data.ports)) {
          setLiveFirewallPorts(data.ports);
        }
        await loadWorkspace(pid, false);
      } catch (err) {
        setFirewallError(err instanceof Error ? err.message : String(err));
      } finally {
        setFirewallBusy(false);
      }
    },
    [
      activeProject?.project_id,
      activeProject?.assigned_nodes,
      selectedNodeId,
      gatewayNodes,
      loadWorkspace,
    ]
  );

  useEffect(() => {
    if (activeNav === "firewall") {
      fetchFirewallStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNav, selectedNodeId]);

  async function handleFirewallAction(payload: {
    action:
      | "inspect"
      | "set_profile"
      | "shield_port"
      | "unshield_port"
      | "add_ip_rule"
      | "remove_ip_rule";
    node_id?: string;
    profile?: "web_standard" | "synapse_stealth" | "custom";
    port?: number;
    ip_or_cidr?: string;
    rule_action?: "allow" | "block";
    note?: string;
    rule_id?: string;
  }) {
    if (firewallBusy) return;
    const pid = activeProject?.project_id || "synapse-cloud-demo";
    const nid =
      payload.node_id ||
      selectedNodeId ||
      activeProject?.assigned_nodes?.[0]?.node_id ||
      gatewayNodes[0]?.node_id ||
      "vps2-muscle";
    setFirewallBusy(true);
    setFirewallError("");
    try {
      const res = await fetch("/api/firewall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          project_id: pid,
          node_id: nid,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setFirewallError(data.error || "Firewall-Aktion fehlgeschlagen");
      } else {
        if (Array.isArray(data.ports)) {
          setLiveFirewallPorts(data.ports);
        }
        if (data.message) {
          setStatusToast(data.message);
          setTimeout(() => setStatusToast(""), 3500);
        }
        await loadWorkspace(pid, false);
      }
    } catch (err) {
      setFirewallError(err instanceof Error ? err.message : String(err));
    } finally {
      setFirewallBusy(false);
    }
  }

  async function handleAddFirewallIpRule(e: React.FormEvent) {
    e.preventDefault();
    if (!fwIpInput.trim()) return;
    await handleFirewallAction({
      action: "add_ip_rule",
      ip_or_cidr: fwIpInput.trim(),
      rule_action: fwRuleAction,
      port: fwRulePort.trim() ? Number(fwRulePort.trim()) : undefined,
      note: fwRuleNote.trim() || undefined,
    });
    setFwIpInput("");
    setFwRulePort("");
    setFwRuleNote("");
  }

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
      section: "Übersicht & Dienste",
      label: "Übersicht",
      icon: Network,
    },
    {
      id: "reverse-proxy",
      section: "Übersicht & Dienste",
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
      section: "Übersicht & Dienste",
      label: "Server & Mesh",
      icon: MonitorSmartphone,
    },
    {
      id: "brain-vault",
      section: "Projekt & Dateien",
      label: "Brain Vault",
      icon: BookOpen,
    },
    {
      id: "workspace",
      section: "Projekt & Dateien",
      label: "Dateien",
      icon: Code2,
    },
    {
      id: "firewall",
      section: "Sicherheit & System",
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
      section: "Sicherheit & System",
      label: "Regeln",
      icon: Shield,
      badge:
        pendingApprovals.length > 0 ? pendingApprovals.length : undefined,
      badgeColor: pendingApprovals.length > 0 ? "orange" : undefined,
    },
    {
      id: "activity",
      section: "Sicherheit & System",
      label: "Audit-Log",
      icon: Activity,
    },
    {
      id: "settings",
      section: "Sicherheit & System",
      label: "Einstellungen",
      icon: Settings,
    },
  ];

  return (
    <div className="dark flex h-screen w-screen overflow-hidden bg-nb-gray-950 text-nb-gray-100">
      {/* ═══════════════════════════════════════════════════════════════════════
          CLEAN LEFT VERTICAL SIDEBAR NAVIGATION
      ═══════════════════════════════════════════════════════════════════════ */}
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
              title={sidebarCollapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
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
                          <span className="whitespace-nowrap">
                            {item.label}
                          </span>
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
        {(() => {
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

          if (sidebarCollapsed) {
            return (
              <div className="space-y-2 p-2.5 border-t border-nb-gray-900/80">
                <div
                  className="flex justify-center py-1"
                  title={
                    activeProject?.planning_only
                      ? "Planning-Only"
                      : `mTLS 1.3 Mesh (${gatewayNodes.filter((n) => n.online).length} online)`
                  }
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      activeProject?.planning_only
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                    }`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsTab("system-update");
                    setActiveNav("settings");
                    fetchSystemUpdateStatus(true, true);
                  }}
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
            );
          }

          return (
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
                    onClick={() => {
                      setSettingsTab("system-update");
                      setActiveNav("settings");
                      fetchSystemUpdateStatus(true, true);
                    }}
                    title="System-Update & Versionsdetails öffnen"
                    className="flex items-center gap-1.5 text-left min-w-0 group"
                  >
                    <span className="whitespace-nowrap font-semibold text-nb-gray-100 group-hover:text-white">
                      v0.3.0
                    </span>
                    <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[9px] text-nb-gray-400">
                      {localShort}
                    </span>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    {!hasAnyUpdate && (
                      <span className="rounded border border-emerald-500/30 bg-emerald-950/40 px-1.5 py-0.5 font-mono text-[9px] text-emerald-400">
                        Aktuell
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={systemUpdateBusy}
                      onClick={() => handleRunSystemUpdate("check")}
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
                      <span className="flex items-center gap-1.5 font-semibold text-[10px] text-amber-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                        <span>Update verfügbar</span>
                      </span>
                      <span className="font-mono text-[9.5px] text-amber-200/90">
                        {coreUpdateAvailable
                          ? `Neu: ${remoteShort} (+${systemUpdateStatus?.git.commits_behind})`
                          : `${outdatedNodes.length} Muscle-Node OTA`}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={systemUpdateBusy}
                      onClick={() => handleRunSystemUpdate("update_all")}
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
                        : "bg-emerald-400"
                    }`}
                  />
                  {activeProject?.planning_only ? "Planning-Only" : "mTLS 1.3 Mesh"}
                </span>
                <span className="font-mono text-[10px] text-nb-gray-400">
                  {gatewayNodes.filter((n) => n.online).length} online
                </span>
              </div>
            </div>
          );
        })()}
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN WORKSPACE COLUMN (Clean Top Header + Content + PTY)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* CLEAN TOP HEADER BAR (No duplicate segmented tabs or clutter) */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-nb-gray-900 bg-nb-gray-950 px-6 py-3">
          {/* Left: Breadcrumbs + Active Peer Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-nb-gray-400 font-normal">
                {activeProject?.name || "synapse-cloud-demo"}
              </span>
              <span className="text-nb-gray-700">/</span>
              <span className="font-medium text-nb-gray-100">
                {sidebarItems.find((i) => i.id === activeNav)?.label}
              </span>
            </div>

            {primaryNode ? (
              <div
                onClick={() => setActiveNav("peers")}
                className="hidden md:flex cursor-pointer items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2.5 py-0.5 text-[11px] text-emerald-400 hover:bg-emerald-950 transition"
                title="Verbundenen Server anzeigen"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="font-mono">{primaryNode}</span>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAddPeerModalOpen(true);
                  handleGenerateJoinToken();
                }}
                className="hidden md:flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950/50 px-2.5 py-0.5 text-[11px] text-amber-400 hover:bg-amber-950"
              >
                <Lock className="h-3 w-3" />
                <span>Planning-Only</span>
              </button>
            )}
          </div>

          {/* Right: Essential Global Controls (Language + Update + Copilot + Server) */}
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
              onClick={() => {
                setAddPeerModalOpen(true);
                if (!issuedToken) handleGenerateJoinToken();
              }}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-transparent bg-netbird px-3 text-xs font-medium text-white shadow-sm hover:bg-netbird-500 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Server</span>
            </button>
          </div>
        </header>

        {/* REAL-TIME UNHEALTHY SERVICE AUTO-HEAL BANNER */}
        {unhealthyServices.length > 0 && (
          <div className="flex items-center justify-between border-b border-red-500/40 bg-red-950/40 px-5 py-2 text-xs">
            <div className="flex items-center gap-2 text-red-300">
              <AlertTriangle className="h-4 w-4 text-red-400 animate-pulse" />
              <span>
                <strong>Dienst-Gesundheitswarnung:</strong>{" "}
                {unhealthyServices
                  .map(
                    (s) =>
                      `${s.name} (:${s.port} on ${s.node_id}) — ${
                        s.health_check?.last_error || "Connection refused"
                      }`
                  )
                  .join(" | ")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  handleQuickAction(
                    `diagnose and auto-heal service ${unhealthyServices[0].port}`
                  )
                }
                className="flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-red-500"
              >
                <Wrench className="h-3 w-3" />
                <span>KI um Diagnose &amp; Reparatur bitten</span>
              </button>
              <button
                onClick={() =>
                  handleRemoveService(
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
        )}

        {/* MAIN STAGE + DOCKED AI COPILOT DRAWER */}
        <div className="flex flex-1 overflow-hidden">
          {/* ─────────────────────────────────────────────────────────────────
              CENTER STAGE VIEWPORT
          ───────────────────────────────────────────────────────────────── */}
          <main className="relative flex-1 overflow-y-auto">
            {/* ═══════════════════════════════════════════════════════════════
                VIEW 1: NETBIRD CONTROL CENTER (Interactive Topological Map)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "control-center" && (
              <InteractiveControlCenterCanvas
                gatewayNodes={gatewayNodes}
                primaryNode={primaryNode}
                cartridges={cartridges}
                activeCartridges={activeProject?.active_cartridges || []}
                joinTier={
                  activeProject?.assigned_nodes?.[0]?.tier || joinTier
                }
                modelName={modelName}
                baseUrl={baseUrl}
                secretKeysCount={secretKeys.length}
                registeredServices={activeProject?.registered_services || []}
                flowView={flowView}
                onSelectNode={(nodeId) => setSelectedNodeId(nodeId)}
                onToggleCartridge={(id) => handleToggleCartridge(id)}
                onOpenAddPeer={() => {
                  setAddPeerModalOpen(true);
                  if (!issuedToken) handleGenerateJoinToken();
                }}
                onOpenPty={() => setTerminalDrawerOpen(true)}
                onOpenAiSettings={() => setAiEndpointModalOpen(true)}
                onOpenBrainDoc={(doc) => {
                  setBrainDocTab(doc);
                  setActiveNav("brain-vault");
                }}
                onOpenSecretsVault={() => {
                  setSettingsTab("secrets-vault");
                  setActiveNav("settings");
                }}
                onOpenReverseProxy={(port) => {
                  if (port) setPreviewPort(port);
                  setActiveNav("reverse-proxy");
                }}
                onOpenAccessControl={() => setActiveNav("access-control")}
                onOpenRemoteFiles={() => setActiveNav("workspace")}
                onDeployDemoService={() =>
                  handleQuickAction("deploy microservice 4050")
                }
                onHealService={(port) =>
                  handleQuickAction(`heal service ${port}`)
                }
                firewallPolicies={activeProject?.firewall_policies}
                onOpenFirewall={(nodeId) => {
                  if (nodeId) setSelectedNodeId(nodeId);
                  setActiveNav("firewall");
                }}
                onOpenSettings={(tab) => {
                  setSettingsTab(
                    (tab as
                      | "system-update"
                      | "watchdog-rbac"
                      | "setup-keys"
                      | "secrets-vault"
                      | "ai-providers"
                      | "mcp-server"
                      | "debug-console"
                      | "language") || "watchdog-rbac"
                  );
                  setActiveNav("settings");
                }}
              />
            )}

            {/* ═══════════════════════════════════════════════════════════════
                VIEW 2: NETBIRD PEERS & CLUSTER VIEW (`peers`)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "peers" && (
              <div className="mx-auto max-w-6xl p-6 space-y-5">
                <SynapseViewHeader
                  icon={<Server className="h-5 w-5" />}
                  accentColor="indigo"
                  title="Server & Mesh-Netzwerk"
                  description="Verwalte alle angeschlossenen Muscle-Server, verknüpfe Dienste über verschlüsselte P2P-Mesh-Tunnel oder stelle komplette Infrastruktur-Stacks und Cron-Playbooks per 1-Klick bereit."
                  actions={
                    <button
                      onClick={() => {
                        setAddPeerModalOpen(true);
                        if (!issuedToken) handleGenerateJoinToken();
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-netbird px-3.5 py-2 text-xs font-medium text-white hover:bg-netbird-500 transition shadow-sm"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Server hinzufügen</span>
                    </button>
                  }
                  subTabs={
                    <SynapseSubTabs
                      activeTab={peersSubTab}
                      onChange={(id) =>
                        setPeersSubTab(
                          id as "nodes" | "mesh" | "blueprints" | "playbooks"
                        )
                      }
                      tabs={[
                        {
                          id: "nodes",
                          label: "Server",
                          icon: <Server className="h-3.5 w-3.5" />,
                          badge: gatewayNodes.length,
                        },
                        {
                          id: "mesh",
                          label: "P2P Mesh-Links",
                          icon: <Network className="h-3.5 w-3.5" />,
                          badge: (activeProject?.peer_mesh_links || []).length,
                        },
                        {
                          id: "blueprints",
                          label: "Stack-Blueprints",
                          icon: <Sparkles className="h-3.5 w-3.5" />,
                          badge: blueprints.length,
                        },
                        {
                          id: "playbooks",
                          label: "Cron-Playbooks",
                          icon: <Activity className="h-3.5 w-3.5" />,
                          badge: (activeProject?.scheduled_playbooks || []).length,
                        },
                      ]}
                    />
                  }
                />

                {/* SUB-TAB 1: MUSCLE NODES TABLE */}
                {peersSubTab === "nodes" && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-nb-gray-900 bg-nb-gray-940 p-3">
                      <div className="flex flex-1 items-center gap-2 min-w-[240px]">
                        <Search className="h-4 w-4 text-nb-gray-400 ml-1" />
                        <input
                          type="text"
                          value={peerSearch}
                          onChange={(e) => setPeerSearch(e.target.value)}
                          placeholder="Server nach Name, Hostname oder IP filtern..."
                          className="flex-1 bg-transparent text-xs text-white placeholder:text-nb-gray-400 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[
                          { id: "ALL", label: "Alle Stufen" },
                          { id: "TIER_1_UNLEASHED", label: "Stufe 1 · Vollzugriff" },
                          {
                            id: "TIER_2_WORKSPACE_JAIL",
                            label: "Stufe 2 · Workspace",
                          },
                          {
                            id: "TIER_3_SUPERVISED",
                            label: "Stufe 3 · Überwacht",
                          },
                        ].map((tierOpt) => (
                          <button
                            key={tierOpt.id}
                            onClick={() => setPeerTierFilter(tierOpt.id)}
                            className={`rounded-md border px-2.5 py-1 font-mono text-[10px] transition ${
                              peerTierFilter === tierOpt.id
                                ? "border-netbird-500 bg-netbird-950 text-netbird"
                                : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-300 hover:bg-nb-gray-900"
                            }`}
                          >
                            {tierOpt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-nb-gray-900 bg-nb-gray-940">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-nb-gray-900 bg-nb-gray-930/70 text-[11px] font-medium uppercase text-nb-gray-400">
                          <tr>
                            <th className="py-3 px-3">Server / Status</th>
                            <th className="py-3 px-3">Autonomie-Stufe</th>
                            <th className="py-3 px-3">Host &amp; System</th>
                            <th className="py-3 px-3">Auslastung</th>
                            <th className="py-3 px-3 text-right">Aktionen</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-nb-gray-900">
                          {filteredPeers.map((gn) => {
                            const hb = gn.last_heartbeat;
                            const isAssigned =
                              activeProject?.assigned_nodes.some(
                                (a) => a.node_id === gn.node_id
                              );
                            const rowExpanded = Boolean(
                              expandedPeerRows[gn.node_id]
                            );
                            const nodeSvcs = (
                              activeProject?.registered_services || []
                            ).filter((s) => s.node_id === gn.node_id);

                            const tierHumanLabel =
                              gn.tier === "TIER_1_UNLEASHED"
                                ? "Stufe 1 · Vollzugriff"
                                : gn.tier === "TIER_2_WORKSPACE_JAIL"
                                  ? "Stufe 2 · Workspace"
                                  : "Stufe 3 · Überwacht";

                            return (
                              <React.Fragment key={gn.node_id}>
                                <tr
                                  onClick={() =>
                                    setExpandedPeerRows((prev) => ({
                                      ...prev,
                                      [gn.node_id]: !prev[gn.node_id],
                                    }))
                                  }
                                  className="cursor-pointer hover:bg-nb-gray-930/50 transition-colors"
                                >
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    <div className="flex items-center gap-2.5">
                                      <span
                                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                          gn.online
                                            ? "bg-emerald-400"
                                            : "bg-nb-gray-500"
                                        }`}
                                      />
                                      <div>
                                        <div className="flex items-center gap-1.5 font-mono font-semibold text-white">
                                          <span>{gn.node_id}</span>
                                          {rowExpanded ? (
                                            <ChevronUp className="h-3.5 w-3.5 text-nb-gray-400" />
                                          ) : (
                                            <ChevronDown className="h-3.5 w-3.5 text-nb-gray-400" />
                                          )}
                                        </div>
                                        <div className="text-[11px] text-nb-gray-400">
                                          {hb?.hostname || gn.remote_addr}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    <span className="rounded-md border border-netbird-500/50 bg-netbird-950 px-2 py-0.5 font-mono text-[10px] text-netbird">
                                      {tierHumanLabel}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 whitespace-nowrap">
                                    <div className="font-mono text-nb-gray-200">
                                      {hb?.private_ipv4 || "127.0.0.1"}
                                    </div>
                                    <div
                                      className="font-mono text-[10.5px] text-nb-gray-400 max-w-[140px] truncate"
                                      title={
                                        hb?.os_info ||
                                        hb?.os_arch ||
                                        "linux/amd64"
                                      }
                                    >
                                      {hb?.os_info
                                        ? hb.os_info.split("(")[0].trim()
                                        : hb?.os_arch || "linux/amd64"}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3">
                                    {hb ? (
                                      <div className="flex items-center gap-2 font-mono text-[11px] text-nb-gray-300 whitespace-nowrap">
                                        <span>
                                          CPU {hb.cpu_percent.toFixed(1)}%
                                        </span>
                                        <span>
                                          RAM {hb.ram_percent.toFixed(1)}%
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-nb-gray-500">—</span>
                                    )}
                                  </td>
                                  <td
                                    className="py-3 px-3 text-right"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                      <button
                                        type="button"
                                        disabled={
                                          systemUpdateBusy || !gn.online
                                        }
                                        onClick={() => {
                                          handleRunSystemUpdate(
                                            "update_muscle",
                                            gn.node_id
                                          );
                                        }}
                                        title="Diesen Muscle-Server Over-the-Air (OTA) aktualisieren & neu starten"
                                        className="rounded-md border border-emerald-500/40 bg-emerald-950/40 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-900/50 disabled:opacity-40"
                                      >
                                        {systemUpdateBusy
                                          ? "Update..."
                                          : "⬆️ OTA"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedNodeId(gn.node_id);
                                          setActiveNav("firewall");
                                        }}
                                        title="Firewall & Port-Schutz für diesen Server öffnen"
                                        className="rounded-md border border-sky-500/40 bg-sky-950/40 px-2 py-1 text-[11px] font-medium text-sky-300 hover:bg-sky-900/50"
                                      >
                                        🛡️ Firewall
                                      </button>
                                      <button
                                        onClick={() => {
                                          setSelectedNodeId(gn.node_id);
                                          setTerminalDrawerOpen(true);
                                        }}
                                        className="rounded-md border border-nb-gray-800 bg-nb-gray-920 px-2 py-1 text-[11px] text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white"
                                      >
                                        Terminal
                                      </button>
                                      <button
                                        onClick={() =>
                                          isAssigned
                                            ? handleUnassignNode(gn.node_id)
                                            : handleAssignNode(
                                                gn.node_id,
                                                gn.tier
                                              )
                                        }
                                        className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                                          isAssigned
                                            ? "border border-red-500/40 bg-red-950/40 text-red-400 hover:bg-red-950"
                                            : "bg-netbird text-white hover:bg-netbird-500"
                                        }`}
                                      >
                                        {isAssigned ? "Trennen" : "Zuweisen"}
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {rowExpanded && (
                                  <tr className="bg-nb-gray-950/80">
                                    <td colSpan={5} className="p-4">
                                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-xs">
                                        {/* Resource Bars */}
                                        <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-940 p-3 space-y-2">
                                          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-400">
                                            Live Ressourcen-Metriken
                                          </div>
                                          {[
                                            {
                                              label: "CPU",
                                              val: hb?.cpu_percent ?? 0,
                                              color: "bg-netbird",
                                            },
                                            {
                                              label: "RAM",
                                              val: hb?.ram_percent ?? 0,
                                              color: "bg-sky-400",
                                            },
                                            {
                                              label: "DISK",
                                              val: hb?.disk_percent ?? 0,
                                              color: "bg-emerald-400",
                                            },
                                          ].map((m) => (
                                            <div
                                              key={m.label}
                                              className="space-y-1 font-mono text-[11px]"
                                            >
                                              <div className="flex justify-between text-nb-gray-300">
                                                <span>{m.label}</span>
                                                <span className="text-white">
                                                  {m.val.toFixed(1)}%
                                                </span>
                                              </div>
                                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-nb-gray-900">
                                                <div
                                                  className={`h-full rounded-full ${m.color}`}
                                                  style={{
                                                    width: `${Math.min(
                                                      100,
                                                      Math.max(3, m.val)
                                                    )}%`,
                                                  }}
                                                />
                                              </div>
                                            </div>
                                          ))}
                                        </div>

                                        {/* Assigned Services on this Peer */}
                                        <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-940 p-3 space-y-2">
                                          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-400">
                                            Registrierte Dienste (
                                            {nodeSvcs.length})
                                          </div>
                                          {nodeSvcs.length === 0 ? (
                                            <div className="text-nb-gray-500 text-[11px]">
                                              Keine Dienste auf diesem Knoten.
                                            </div>
                                          ) : (
                                            <div className="space-y-1.5">
                                              {nodeSvcs.map((s) => (
                                                <button
                                                  key={s.service_id}
                                                  type="button"
                                                  onClick={() => {
                                                    setSelectedServiceId(
                                                      s.service_id
                                                    );
                                                    setPreviewPort(s.port);
                                                    setActiveNav(
                                                      "reverse-proxy"
                                                    );
                                                  }}
                                                  className="flex w-full items-center justify-between rounded border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1.5 text-left font-mono text-[11px] text-nb-gray-200 hover:border-netbird hover:text-white"
                                                >
                                                  <span className="truncate">
                                                    {s.name}
                                                  </span>
                                                  <span className="text-netbird">
                                                    :{s.port} →
                                                  </span>
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>

                                        {/* Quick Peer Actions & Connection Info */}
                                        <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-940 p-3 flex flex-col justify-between space-y-2">
                                          <div className="space-y-1 font-mono text-[11px] text-nb-gray-300">
                                            <div className="text-[10px] font-semibold uppercase tracking-wider text-nb-gray-400 mb-1">
                                              Verbindungs-Details
                                            </div>
                                            <div>
                                              Remote:{" "}
                                              <span className="text-white">
                                                {gn.remote_addr}
                                              </span>
                                            </div>
                                            <div>
                                              Aktive PTYs:{" "}
                                              <span className="text-white">
                                                {hb?.active_pty_sessions
                                                  ?.length ?? 0}
                                              </span>
                                            </div>
                                            <div>
                                              Verbunden seit:{" "}
                                              <span className="text-nb-gray-400">
                                                {gn.connected_at
                                                  ?.replace("T", " ")
                                                  .slice(0, 19)}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 pt-1">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedNodeId(gn.node_id);
                                                setActiveNav("workspace");
                                              }}
                                              className="flex-1 rounded border border-nb-gray-800 bg-nb-gray-950 py-1.5 text-[11px] font-medium text-nb-gray-200 hover:border-netbird hover:text-white"
                                            >
                                              Dateien öffnen
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setSelectedNodeId(gn.node_id);
                                                setTerminalDrawerOpen(true);
                                              }}
                                              className="flex-1 rounded bg-netbird py-1.5 text-[11px] font-medium text-white hover:bg-netbird-500"
                                            >
                                              Live Shell
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SUB-TAB 2: PEER-TO-PEER MESH LINKS (`core_link_peers`) */}
                {peersSubTab === "mesh" && (
                  <div className="rounded-xl border border-nb-gray-900 bg-nb-gray-940 p-5 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Network className="h-4 w-4 text-sky-400" />
                        Multi-Server Peer-to-Peer Mesh-Verbindungen (core_link_peers)
                      </h2>
                      <p className="text-xs text-nb-gray-400 mt-0.5">
                        Verbinde Dienste zwischen verschiedenen Muscle-Servern
                        über verschlüsselte mTLS-Loopback-Tunnels.
                      </p>
                    </div>
                    <datalist id="synapse-peer-nodes">
                      {Array.from(
                        new Set([
                          ...gatewayNodes.map((n) => n.node_id),
                          ...(activeProject?.assigned_nodes || []).map(
                            (n) => n.node_id
                          ),
                        ])
                      ).map((nid) => (
                        <option key={nid} value={nid} />
                      ))}
                    </datalist>
                    <form
                      onSubmit={handleAddMeshLink}
                      className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 text-xs"
                    >
                      <input
                        type="text"
                        list="synapse-peer-nodes"
                        value={meshSourceNode}
                        onChange={(e) => setMeshSourceNode(e.target.value)}
                        placeholder="Quell-Server (vps2)"
                        className="sm:col-span-3 rounded border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-2 font-mono text-xs text-white"
                      />
                      <input
                        type="text"
                        list="synapse-peer-nodes"
                        value={meshTargetNode}
                        onChange={(e) => setMeshTargetNode(e.target.value)}
                        placeholder="Ziel-Server (db-node)"
                        className="sm:col-span-3 rounded border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-2 font-mono text-xs text-white"
                      />
                      <input
                        type="number"
                        value={meshTargetPort}
                        onChange={(e) =>
                          setMeshTargetPort(Number(e.target.value) || 5432)
                        }
                        placeholder="Port (5432)"
                        className="sm:col-span-2 rounded border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-netbird"
                      />
                      <input
                        type="text"
                        value={meshAliasEnv}
                        onChange={(e) => setMeshAliasEnv(e.target.value)}
                        placeholder="ENV-Alias (PEER_DB_URL)"
                        className="sm:col-span-2 rounded border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-nb-gray-200"
                      />
                      <button
                        type="submit"
                        className="sm:col-span-2 rounded bg-netbird px-3 py-2 text-xs font-medium text-white hover:bg-netbird-500"
                      >
                        + Mesh-Link anlegen
                      </button>
                    </form>
                    <div className="space-y-2">
                      {(activeProject?.peer_mesh_links || []).length === 0 ? (
                        <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-950/70 px-4 py-3 text-xs text-nb-gray-400">
                          Noch keine P2P-Mesh-Verknüpfungen aktiv. Wähle oben Quell- und Ziel-Server sowie den Ziel-Port aus, um einen verschlüsselten mTLS-Loopback-Tunnel bereitzustellen.
                        </div>
                      ) : (
                        (activeProject?.peer_mesh_links || []).map((lnk) => (
                          <div
                            key={lnk.link_id}
                            className="flex items-center justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-930 px-4 py-2.5 font-mono text-xs"
                          >
                            <span className="text-nb-gray-200">
                              <strong className="text-white">
                                {lnk.source_node_id}
                              </strong>{" "}
                              ⇄{" "}
                              <strong className="text-sky-400">
                                {lnk.target_node_id}:
                                {lnk.target_port ||
                                  lnk.remote_port ||
                                  lnk.local_port ||
                                  5432}
                              </strong>{" "}
                              <span className="text-nb-gray-400">
                                ({lnk.alias_env || lnk.description || "mTLS-Tunnel"})
                              </span>
                            </span>
                            <button
                              onClick={() => handleRemoveMeshLink(lnk.link_id)}
                              className="text-nb-gray-500 hover:text-red-400"
                              title="Mesh-Link trennen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* SUB-TAB 3: 1-CLICK AI STACK BLUEPRINTS */}
                {peersSubTab === "blueprints" && (
                  <div className="rounded-xl border border-nb-gray-900 bg-nb-gray-940 p-5 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-netbird" />
                        1-Click AI Stack Blueprints
                      </h2>
                      <p className="text-xs text-nb-gray-400 mt-0.5">
                        Fertige Infrastruktur-Stacks mit einem Klick autonom
                        über den KI-Orchestrator bereitstellen.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {blueprints.map((bp) => (
                        <div
                          key={bp.id}
                          className="flex flex-col justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-930 p-4 space-y-3"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-white">
                                {bp.name}
                              </span>
                              <span className="rounded border border-netbird-500/40 bg-netbird-950 px-2 py-0.5 font-mono text-[9px] text-netbird">
                                {bp.category}
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs text-nb-gray-400 leading-relaxed">
                              {bp.description}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setCopilotDrawerOpen(true);
                              runStreamingPrompt(
                                bp.prompt || bp.promptCommand || ""
                              );
                            }}
                            className="w-full rounded-md bg-netbird/90 py-2 text-xs font-medium text-white hover:bg-netbird"
                          >
                            Stack per KI bereitstellen →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SUB-TAB 4: SCHEDULED AI PLAYBOOKS (CRON) */}
                {peersSubTab === "playbooks" && (
                  <div className="rounded-xl border border-nb-gray-900 bg-nb-gray-940 p-5 space-y-4">
                    <div>
                      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Activity className="h-4 w-4 text-emerald-400" />
                        Scheduled AI Playbooks (Cron-Wartung)
                      </h2>
                      <p className="text-xs text-nb-gray-400 mt-0.5">
                        Wiederkehrende autonome Health-Checks, Log-Bereinigungen
                        und Sicherheits-Audits.
                      </p>
                    </div>
                    <div className="space-y-2.5">
                      {(activeProject?.scheduled_playbooks || []).map((pb) => {
                        const cronLabel =
                          pb.cron || pb.cron_expression || "0 3 * * *";
                        return (
                          <div
                            key={pb.playbook_id}
                            className="flex items-center justify-between gap-3 rounded-lg border border-nb-gray-800 bg-nb-gray-930 p-3.5 text-xs"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white truncate">
                                  {pb.name}
                                </span>
                                <span className="rounded border border-nb-gray-700 bg-nb-gray-950 px-2 py-0.5 font-mono text-[10px] text-netbird">
                                  🕒 {cronLabel}
                                </span>
                              </div>
                              <p className="text-[11px] text-nb-gray-400 truncate mt-1">
                                {pb.prompt}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => {
                                  setCopilotDrawerOpen(true);
                                  runStreamingPrompt(pb.prompt);
                                }}
                                className="rounded border border-netbird-500/40 bg-netbird-950 px-2.5 py-1 font-mono text-[10px] text-netbird hover:bg-netbird hover:text-white"
                              >
                                Jetzt ausführen
                              </button>
                              <button
                                onClick={() => handleTogglePlaybook(pb)}
                                className={`rounded border px-2.5 py-1 font-mono text-[10px] ${
                                  pb.enabled
                                    ? "border-emerald-500/40 bg-emerald-950 text-emerald-400"
                                    : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-400"
                                }`}
                              >
                                {pb.enabled ? "AKTIV" : "PAUSIERT"}
                              </button>
                              <button
                                onClick={() =>
                                  handleDeletePlaybook(pb.playbook_id)
                                }
                                className="text-nb-gray-500 hover:text-red-400 p-1"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <form
                      onSubmit={handleAddPlaybook}
                      className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 pt-2 text-xs"
                    >
                      <input
                        type="text"
                        value={playbookName}
                        onChange={(e) => setPlaybookName(e.target.value)}
                        placeholder="Playbook-Name..."
                        className="rounded border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-white"
                      />
                      <input
                        type="text"
                        value={playbookCron}
                        onChange={(e) => setPlaybookCron(e.target.value)}
                        placeholder="0 */6 * * *"
                        className="rounded border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-netbird"
                      />
                      <input
                        type="text"
                        value={playbookPrompt}
                        onChange={(e) => setPlaybookPrompt(e.target.value)}
                        placeholder="KI-Anweisung..."
                        className="rounded border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-white"
                      />
                      <button
                        type="submit"
                        className="rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500"
                      >
                        + Cron hinzufügen
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                VIEW 2.5: SYNAPSE FIREWALL & PORT-SHIELD (`firewall`)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "firewall" && (
              <FirewallView
                activeProject={activeProject}
                gatewayNodes={gatewayNodes}
                selectedNodeId={selectedNodeId}
                setSelectedNodeId={setSelectedNodeId}
                liveFirewallPorts={liveFirewallPorts}
                firewallBusy={firewallBusy}
                firewallError={firewallError}
                setFirewallError={setFirewallError}
                fetchFirewallStatus={fetchFirewallStatus}
                handleFirewallAction={handleFirewallAction}
                fwRuleAction={fwRuleAction}
                setFwRuleAction={setFwRuleAction}
                fwIpInput={fwIpInput}
                setFwIpInput={setFwIpInput}
                fwRulePort={fwRulePort}
                setFwRulePort={setFwRulePort}
                fwRuleNote={fwRuleNote}
                setFwRuleNote={setFwRuleNote}
                handleAddFirewallIpRule={handleAddFirewallIpRule}
                onAskCopilot={(prompt) => {
                  setCopilotDrawerOpen(true);
                  runStreamingPrompt(prompt);
                }}
              />
            )}

            {/* ═══════════════════════════════════════════════════════════════
                VIEW 3: NETBIRD ACCESS CONTROL (`access-control`)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "access-control" && (
              <AccessRulesView
                activeProject={activeProject}
                cartridges={cartridges}
                pendingApprovals={pendingApprovals}
                selectedCartridgeId={selectedCartridgeId}
                setSelectedCartridgeId={setSelectedCartridgeId}
                showCustomCartModal={showCustomCartModal}
                setShowCustomCartModal={setShowCustomCartModal}
                customCartName={customCartName}
                setCustomCartName={setCustomCartName}
                customCartCategory={customCartCategory}
                setCustomCartCategory={setCustomCartCategory}
                customCartDesc={customCartDesc}
                setCustomCartDesc={setCustomCartDesc}
                customCartContent={customCartContent}
                setCustomCartContent={setCustomCartContent}
                handleCreateCustomCartridge={handleCreateCustomCartridge}
                handleToggleCartridge={handleToggleCartridge}
                handleResolveApproval={handleResolveApproval}
              />
            )}

            {/* ═══════════════════════════════════════════════════════════════
                VIEW 4: FLAT, CLEAN TABBED SERVICE WORKBENCH (`reverse-proxy`)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "reverse-proxy" &&
              (() => {
                const allSvcs = activeProject?.registered_services || [];
                const activeSvc =
                  allSvcs.find((s) => s.service_id === selectedServiceId) ||
                  allSvcs.find((s) => s.port === previewPort) ||
                  allSvcs[0];

                const activeExtUrl = activeSvc
                  ? `${gatewayUrl}/preview/${activeProject?.project_id}/${
                      activeSvc.node_id || primaryNode
                    }/${activeSvc.port}/`
                  : `${gatewayUrl}/preview/${activeProject?.project_id}/${
                      primaryNode || "node"
                    }/${previewPort}/`;

                const activeEndpoints = activeSvc?.endpoints || [];
                const bySelectedIdIdx = selectedEndpointId
                  ? activeEndpoints.findIndex(
                      (e, i) => `${e.id || i}::${e.label}` === selectedEndpointId
                    )
                  : -1;
                const byExactMatchIdx = activeEndpoints.findIndex(
                  (e) =>
                    e.method === serviceActionMethod &&
                    e.path === serviceActionPath &&
                    (e.sample_payload || "") === serviceActionPayload
                );
                const byMethodPathIdx = activeEndpoints.findIndex(
                  (e) =>
                    e.method === serviceActionMethod &&
                    e.path === serviceActionPath
                );
                const activeEndpointIdx =
                  bySelectedIdIdx !== -1
                    ? bySelectedIdIdx
                    : byExactMatchIdx !== -1
                    ? byExactMatchIdx
                    : byMethodPathIdx;

                return (
                  <div className="mx-auto flex max-w-6xl flex-col gap-5 p-6">
                    <SynapseViewHeader
                      icon={<Globe className="h-5 w-5" />}
                      accentColor="sky"
                      title="Services & Reverse-Proxy Workbench"
                      description="Teste Web-Oberflächen, HTTP-Endpunkte und SQLite-Datenbanken deiner Server direkt im Browser über den verschlüsselten Synapse-Tunnel – auch wenn deren Ports in der Firewall nach außen gesperrt sind."
                    />

                    {/* 1. FLUID SERVICE SELECTOR CARDS (Replaces rigid top folder tabs) */}
                    {allSvcs.length === 0 ? (
                      <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-6 text-center text-xs text-nb-gray-400">
                        Noch keine Dienste im Projekt registriert.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {allSvcs.map((svc) => {
                          const healthy =
                            svc.healthy !== false &&
                            svc.health_check?.status !== "UNHEALTHY";
                          const isSelected =
                            activeSvc?.service_id === svc.service_id;
                          const cat = svc.category || "backend";
                          const cleanName = svc.name
                            .replace(new RegExp(`\\s*:${svc.port}\\b`), "")
                            .trim();
                          const CatIcon =
                            cat === "webui"
                              ? Globe
                              : cat === "database"
                              ? Database
                              : Zap;

                          return (
                            <button
                              key={svc.service_id}
                              type="button"
                              onClick={() => {
                                setSelectedServiceId(svc.service_id);
                                setPreviewPort(svc.port);
                                setPreviewSubPath("/");
                                setServiceWorkspaceTab(
                                  svc.category === "webui"
                                    ? "preview"
                                    : "tester"
                                );
                                if (
                                  svc.endpoints &&
                                  svc.endpoints.length > 0
                                ) {
                                  const firstEp = svc.endpoints[0];
                                  setSelectedEndpointId(
                                    `${firstEp.id || 0}::${firstEp.label}`
                                  );
                                  setServiceActionMethod(firstEp.method);
                                  setServiceActionPath(firstEp.path);
                                  setServiceActionPayload(
                                    firstEp.sample_payload || ""
                                  );
                                  handleInvokeServiceAction({
                                    nodeId: svc.node_id,
                                    port: svc.port,
                                    method: firstEp.method,
                                    path: firstEp.path,
                                    payload: firstEp.sample_payload || "",
                                  });
                                } else {
                                  setSelectedEndpointId("");
                                }
                              }}
                              className={`group relative flex items-center gap-3.5 rounded-xl border p-3.5 text-left transition-all duration-150 ${
                                isSelected
                                  ? "border-netbird/80 bg-nb-gray-930 shadow-md ring-1 ring-netbird/25"
                                  : "border-nb-gray-800/80 bg-nb-gray-940/80 hover:border-nb-gray-700 hover:bg-nb-gray-930/60"
                              }`}
                            >
                              <div
                                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                                  isSelected
                                    ? "border-netbird/40 bg-netbird/15 text-netbird"
                                    : "border-nb-gray-800 bg-nb-gray-950 text-nb-gray-400 group-hover:text-nb-gray-200"
                                }`}
                              >
                                <CatIcon className="h-4 w-4" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-xs font-semibold text-white">
                                    {cleanName}
                                  </span>
                                  <span
                                    className={`h-2 w-2 shrink-0 rounded-full ${
                                      healthy
                                        ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                                        : "bg-red-500 animate-pulse"
                                    }`}
                                  />
                                </div>
                                <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-nb-gray-400 whitespace-nowrap">
                                  <span
                                    data-no-i18n="true"
                                    className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                      cat === "webui"
                                        ? "bg-sky-950/80 text-sky-300 border border-sky-500/30"
                                        : cat === "database"
                                        ? "bg-sky-950/80 text-sky-300 border border-sky-500/30"
                                        : "bg-amber-950/70 text-amber-300 border border-amber-500/30"
                                    }`}
                                  >
                                    {cat === "webui"
                                      ? "WebUI"
                                      : cat === "database"
                                      ? "DB"
                                      : "API"}
                                  </span>
                                  <span className="shrink-0 whitespace-nowrap text-nb-gray-300">
                                    Port {svc.port}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* 2. UNIFIED SERVICE WORKBENCH CARD */}
                    {activeSvc && (
                      <div className="flex flex-col overflow-hidden rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 shadow-lg">
                        {/* Single-Row Unified Workbench Header Bar */}
                        <div className="flex items-center justify-between gap-3 border-b border-nb-gray-800/80 bg-nb-gray-930/70 px-5 py-3">
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <span className="shrink-0 text-sm font-semibold text-white">
                              {activeSvc.name
                                .replace(
                                  new RegExp(`\\s*:${activeSvc.port}\\b`),
                                  ""
                                )
                                .trim()}
                            </span>
                            <span className="shrink-0 rounded-md border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 font-mono text-[11px] text-nb-gray-300">
                              {activeSvc.node_id}:{activeSvc.port}
                            </span>

                            {/* Compact Single-Line Proxy URL Pill */}
                            <a
                              href={activeExtUrl}
                              target="_blank"
                              rel="noreferrer"
                              title={activeExtUrl}
                              className="group flex min-w-0 items-center gap-2 rounded-lg border border-nb-gray-800/90 bg-nb-gray-950/90 px-2.5 py-1 font-mono text-[11px] text-nb-gray-300 transition hover:border-netbird/50 hover:text-white"
                            >
                              <Globe className="h-3.5 w-3.5 shrink-0 text-netbird" />
                              <span className="truncate max-w-[420px] xl:max-w-[540px]">
                                {activeExtUrl}
                              </span>
                              <span className="flex shrink-0 items-center gap-1 rounded bg-netbird/15 px-1.5 py-0.5 font-sans text-[10px] font-medium text-netbird group-hover:bg-netbird group-hover:text-white transition-colors">
                                <span>Extern</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </span>
                            </a>
                          </div>

                          {/* Framed Segmented Mode Switcher */}
                          <div className="flex shrink-0 items-center rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-1">
                            {[
                              {
                                id: "tester",
                                label: "API- & DB-Tester",
                                icon: Code2,
                              },
                              {
                                id: "preview",
                                label: "Web-Vorschau",
                                icon: Globe,
                              },
                            ].map((mode) => {
                              const ModeIcon = mode.icon;
                              const active = serviceWorkspaceTab === mode.id;
                              return (
                                <button
                                  key={mode.id}
                                  type="button"
                                  onClick={() =>
                                    setServiceWorkspaceTab(
                                      mode.id as "split" | "preview" | "tester"
                                    )
                                  }
                                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                                    active
                                      ? "bg-netbird text-white shadow-sm"
                                      : "text-nb-gray-400 hover:text-white"
                                  }`}
                                >
                                  <ModeIcon className="h-3.5 w-3.5" />
                                  <span>{mode.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 3. WORKBENCH BODY: API & DB TESTER */}
                        {serviceWorkspaceTab !== "preview" && (
                          <div className="grid grid-cols-1 divide-y divide-nb-gray-800/80 lg:grid-cols-12 lg:divide-y-0 lg:divide-x">
                            {/* Left 4 Cols: Clean Endpoint Cards */}
                            <div className="lg:col-span-4 bg-nb-gray-950/35 p-4 space-y-3">
                              <div className="flex items-center justify-between px-1">
                                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-400">
                                  Verfügbare Endpunkte
                                </span>
                                <span className="rounded-full border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 font-mono text-[10px] text-nb-gray-400">
                                  {activeEndpoints.length}
                                </span>
                              </div>

                              {activeEndpoints.length === 0 ? (
                                <div className="rounded-lg border border-nb-gray-800/60 bg-nb-gray-950/60 p-3.5 text-xs text-nb-gray-400">
                                  Sende rechts eine Anfrage an{" "}
                                  <code className="font-mono text-white">
                                    :{activeSvc.port}
                                  </code>
                                  .
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {activeEndpoints.map((ep, idx) => {
                                    const isCurrentEp =
                                      idx === activeEndpointIdx;
                                    // Strip duplicate leading HTTP verb from label (e.g. "GET / (Overview)" -> "/ (Overview)")
                                    const cleanLabel = ep.label
                                      .replace(
                                        new RegExp(`^${ep.method}\\s+`, "i"),
                                        ""
                                      )
                                      .trim();

                                    return (
                                      <button
                                        key={`${ep.id || idx}::${ep.label}`}
                                        type="button"
                                        onClick={() => {
                                          setSelectedServiceId(
                                            activeSvc.service_id
                                          );
                                          setSelectedEndpointId(
                                            `${ep.id || idx}::${ep.label}`
                                          );
                                          setPreviewPort(activeSvc.port);
                                          setServiceActionMethod(ep.method);
                                          setServiceActionPath(ep.path);
                                          setServiceActionPayload(
                                            ep.sample_payload || ""
                                          );
                                          handleInvokeServiceAction({
                                            nodeId: activeSvc.node_id,
                                            port: activeSvc.port,
                                            method: ep.method,
                                            path: ep.path,
                                            payload: ep.sample_payload || "",
                                          });
                                        }}
                                        className={`group flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-xs transition-all ${
                                          isCurrentEp
                                            ? "border-netbird/60 bg-netbird/10 text-white shadow-sm"
                                            : "border-nb-gray-800/70 bg-nb-gray-950/60 text-nb-gray-300 hover:border-nb-gray-700 hover:bg-nb-gray-900/70 hover:text-white"
                                        }`}
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            <span
                                              className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                                                ep.method === "POST"
                                                  ? "bg-amber-950/90 text-amber-300 border border-amber-500/30"
                                                  : ep.method === "SQL"
                                                  ? "bg-sky-950/90 text-sky-300 border border-sky-500/30"
                                                  : "bg-emerald-950/90 text-emerald-300 border border-emerald-500/30"
                                              }`}
                                            >
                                              {ep.method}
                                            </span>
                                            <span className="truncate font-mono text-xs font-medium text-white">
                                              {cleanLabel}
                                            </span>
                                          </div>
                                          {ep.description && (
                                            <div className="mt-1.5 line-clamp-2 leading-snug text-[11px] text-nb-gray-400">
                                              {ep.description}
                                            </div>
                                          )}
                                        </div>
                                        <span
                                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                                            isCurrentEp
                                              ? "border-netbird/50 bg-netbird text-white"
                                              : "border-nb-gray-800 bg-nb-gray-900 text-nb-gray-400 group-hover:border-netbird/40 group-hover:text-netbird"
                                          }`}
                                        >
                                          <Play className="h-3 w-3" />
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Right 8 Cols: Unified Request Composer + Response Studio */}
                            <div className="lg:col-span-8 p-5 space-y-4">
                              {/* Cohesive Request Composer Bar */}
                              <div className="flex items-center gap-2 rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-1.5 focus-within:border-netbird/60 transition-colors">
                                <select
                                  value={serviceActionMethod}
                                  onChange={(e) => {
                                    setSelectedEndpointId("");
                                    setServiceActionMethod(
                                      e.target.value as
                                        | "GET"
                                        | "POST"
                                        | "PUT"
                                        | "DELETE"
                                        | "SQL"
                                    );
                                  }}
                                  className="rounded-lg border border-nb-gray-800/80 bg-nb-gray-900 px-3 py-1.5 font-mono text-xs font-bold text-netbird focus:outline-none cursor-pointer"
                                >
                                  <option value="GET">GET</option>
                                  <option value="POST">POST</option>
                                  <option value="PUT">PUT</option>
                                  <option value="DELETE">DELETE</option>
                                  <option value="SQL">SQL</option>
                                </select>

                                <div className="h-5 w-px bg-nb-gray-800 shrink-0" />

                                <input
                                  type="text"
                                  value={serviceActionPath}
                                  onChange={(e) => {
                                    setSelectedEndpointId("");
                                    setServiceActionPath(e.target.value);
                                  }}
                                  placeholder={
                                    serviceActionMethod === "SQL"
                                      ? "/opt/axon/workspaces/.../pulse.db"
                                      : "/"
                                  }
                                  className="flex-1 bg-transparent px-2.5 py-1.5 font-mono text-xs text-white placeholder:text-nb-gray-500 focus:outline-none"
                                />

                                <button
                                  type="button"
                                  disabled={serviceActionBusy}
                                  onClick={() => handleInvokeServiceAction()}
                                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-netbird px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-netbird-500 disabled:opacity-50 transition-colors"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                  <span>
                                    {serviceActionBusy
                                      ? "Läuft..."
                                      : "Ausführen"}
                                  </span>
                                </button>
                              </div>

                              {(serviceActionMethod !== "GET" ||
                                serviceActionPayload.trim().length > 0) && (
                                <div className="space-y-1.5">
                                  <div className="px-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-400">
                                    {serviceActionMethod === "SQL"
                                      ? "SQL-Abfrage"
                                      : "Request-Body (JSON)"}
                                  </div>
                                  <textarea
                                    rows={3}
                                    value={serviceActionPayload}
                                    onChange={(e) => {
                                      setSelectedEndpointId("");
                                      setServiceActionPayload(e.target.value);
                                    }}
                                    placeholder={
                                      serviceActionMethod === "SQL"
                                        ? "SELECT * FROM events ORDER BY id DESC LIMIT 10;"
                                        : '{"action": "ping"}'
                                    }
                                    className="w-full rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-3.5 font-mono text-xs text-nb-gray-100 focus:border-netbird focus:outline-none"
                                  />
                                </div>
                              )}

                              {/* Structured Response Console */}
                              <div className="overflow-hidden rounded-xl border border-nb-gray-800/90 bg-nb-gray-950">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-nb-gray-800/80 bg-nb-gray-930/60 px-4 py-2.5 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                                    <span className="font-medium text-nb-gray-200">
                                      Antwort
                                    </span>
                                    <span className="font-mono text-[11px] text-nb-gray-400">
                                      ({activeSvc.name})
                                    </span>
                                  </div>

                                  {serviceActionResult && (
                                    <div className="flex items-center gap-2 font-mono text-[11px]">
                                      <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 text-nb-gray-300">
                                        {serviceActionResult.method}
                                      </span>
                                      <span
                                        className={`rounded border px-2 py-0.5 font-semibold ${
                                          serviceActionResult.ok
                                            ? "border-emerald-500/40 bg-emerald-950/80 text-emerald-300"
                                            : "border-red-500/40 bg-red-950/80 text-red-300"
                                        }`}
                                      >
                                        HTTP {serviceActionResult.status_code}
                                      </span>
                                      <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 text-nb-gray-400">
                                        {serviceActionResult.latency_ms} ms
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <pre className="max-h-80 min-h-[180px] overflow-auto p-4 font-mono text-xs whitespace-pre-wrap text-nb-gray-100 leading-relaxed">
                                  {serviceActionResult
                                    ? serviceActionResult.response_text
                                    : "Klicke links auf einen Endpunkt oder oben auf 'Ausführen'."}
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 4. WORKBENCH BODY: WEB PREVIEW */}
                        {serviceWorkspaceTab === "preview" && (
                          <div className="flex flex-col">
                            <div className="flex items-center justify-between gap-2 border-b border-nb-gray-800 bg-nb-gray-950 px-5 py-2.5 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] text-nb-gray-400">
                                  Pfad auf :{previewPort}
                                </span>
                                <input
                                  type="text"
                                  value={previewSubPath}
                                  onChange={(e) =>
                                    setPreviewSubPath(e.target.value || "/")
                                  }
                                  className="w-56 rounded-lg border border-nb-gray-800 bg-nb-gray-930 px-3 py-1 font-mono text-xs text-white focus:border-netbird focus:outline-none"
                                  placeholder="/"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewReloadNonce((n) => n + 1)
                                }
                                className="flex items-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-930 px-3 py-1.5 text-xs text-nb-gray-300 hover:text-white transition"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                <span>Neu laden</span>
                              </button>
                            </div>
                            <iframe
                              key={`${previewPort}-${previewSubPath}-${previewReloadNonce}`}
                              title="Synapse Reverse Proxy Preview"
                              src={`${gatewayUrl}/preview/${
                                activeProject?.project_id
                              }/${
                                activeSvc?.node_id ||
                                primaryNode ||
                                "unassigned"
                              }/${previewPort}${
                                previewSubPath.startsWith("/")
                                  ? previewSubPath
                                  : `/${previewSubPath}`
                              }`}
                              className="w-full bg-white h-[500px]"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

            {/* ═══════════════════════════════════════════════════════════════
                VIEW 5: FOCUSED BRAIN VAULT DOCUMENTS (`brain-vault`)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "brain-vault" && (
              <div className="mx-auto max-w-6xl p-6 space-y-5">
                <SynapseViewHeader
                  icon={<Brain className="h-5 w-5" />}
                  accentColor="purple"
                  title="Brain Vault (Architektur- & System-Gedächtnis)"
                  description="Das persistente Langzeit-Gedächtnis deines Projekts. Der KI-Orchestrator liest und aktualisiert Architecture.md (Topologie, Ports, Dienste) und Memory.md (Runbooks, gelöste Fehler) vollautomatisch."
                  actions={
                    <>
                      <button
                        onClick={() => setIsEditingMarkdown((v) => !v)}
                        className="flex items-center gap-1.5 rounded-xl border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 text-xs font-medium text-nb-gray-200 hover:text-white transition"
                      >
                        <Code2 className="h-3.5 w-3.5 text-netbird" />
                        <span>
                          {isEditingMarkdown ? "Leseansicht" : "Bearbeiten"}
                        </span>
                      </button>

                      {isEditingMarkdown && (
                        <button
                          onClick={() => handleSaveBrainDoc(brainDocTab)}
                          className="flex items-center gap-1.5 rounded-xl bg-netbird px-4 py-2 text-xs font-medium text-white hover:bg-netbird-500 transition shadow-sm"
                        >
                          <Save className="h-3.5 w-3.5" />
                          <span>Speichern</span>
                        </button>
                      )}
                    </>
                  }
                  subTabs={
                    <div className="flex flex-wrap items-center justify-between gap-3 w-full">
                      <SynapseSubTabs
                        activeTab={brainDocTab}
                        onChange={(doc) => {
                          setBrainDocTab(doc);
                          setIsEditingMarkdown(false);
                        }}
                        tabs={[
                          {
                            id: "Architecture.md",
                            label: "Architecture.md (System-Topologie)",
                            icon: <FileText className="h-3.5 w-3.5" />,
                          },
                          {
                            id: "Memory.md",
                            label: "Memory.md (KI-Erfahrungsschatz)",
                            icon: <BookOpen className="h-3.5 w-3.5" />,
                          },
                        ]}
                      />
                      <span className="hidden sm:inline font-mono text-[11px] text-nb-gray-400">
                        /projects/
                        {activeProject?.project_id || "synapse-cloud-demo"}/
                        {brainDocTab}
                      </span>
                    </div>
                  }
                />

                {/* Single Clean Document Reader / Editor Container */}
                <div className="flex flex-col overflow-hidden rounded-xl border border-nb-gray-900 bg-nb-gray-940">
                  <div className="p-6">
                    {isEditingMarkdown ? (
                      <textarea
                        value={
                          brainDocTab === "Architecture.md"
                            ? architectureMd
                            : memoryMd
                        }
                        onChange={(e) =>
                          brainDocTab === "Architecture.md"
                            ? setArchitectureMd(e.target.value)
                            : setMemoryMd(e.target.value)
                        }
                        className="h-[560px] w-full rounded-lg border border-nb-gray-800 bg-nb-gray-960 p-4 font-mono text-xs text-nb-gray-100 focus:border-netbird focus:outline-none"
                      />
                    ) : (
                      <RichMarkdownDocument
                        variant={
                          brainDocTab === "Memory.md"
                            ? "memory"
                            : "architecture"
                        }
                        markdown={
                          brainDocTab === "Architecture.md"
                            ? architectureMd
                            : memoryMd
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                VIEW 6: REMOTE WORKSPACE EXPLORER (`workspace`)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "workspace" && (
              <div className="mx-auto max-w-6xl p-6 space-y-5">
                <SynapseViewHeader
                  icon={<FolderGit2 className="h-5 w-5" />}
                  accentColor="indigo"
                  title="Remote-Dateien & Code-Editor"
                  description="Durchsuche und bearbeite Dateien direkt im isolierten Server-Workspace (/opt/axon/workspaces) oder wende Unified-Diff-Patches mit automatischem Backup-Schutz an."
                  actions={
                    <>
                      <button
                        onClick={() => setShowDiffDrawer((v) => !v)}
                        className="flex items-center gap-1.5 rounded-xl border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 text-xs font-medium text-nb-gray-200 hover:text-white transition"
                      >
                        <GitCompare className="h-3.5 w-3.5 text-netbird" />
                        <span>Unified-Diff-Patch</span>
                      </button>
                      <button
                        onClick={handleSaveRemoteFile}
                        className="flex items-center gap-1.5 rounded-xl bg-netbird px-4 py-2 text-xs font-medium text-white hover:bg-netbird-500 transition shadow-sm"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>Auf Server speichern</span>
                      </button>
                    </>
                  }
                />

                <div className="flex h-[620px] overflow-hidden rounded-xl border border-nb-gray-900 bg-nb-gray-940 shadow-lg">
                  <div
                    style={{ width: `${workspaceSidebarWidth}px` }}
                    className="relative shrink-0 border-r border-nb-gray-900 bg-nb-gray-940 p-3 flex flex-col justify-between"
                  >
                    {/* Mouse Drag Handle to Resize File Tree Sidebar */}
                    <div
                      title="Mit der Maus ziehen, um die Dateiliste breiter/schmaler zu machen"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const startX = e.clientX;
                        const startW = workspaceSidebarWidth;
                        const onMove = (ev: MouseEvent) => {
                          setWorkspaceSidebarWidth(
                            Math.max(
                              190,
                              Math.min(480, startW + (ev.clientX - startX))
                            )
                          );
                        };
                        const onUp = () => {
                          window.removeEventListener("mousemove", onMove);
                          window.removeEventListener("mouseup", onUp);
                        };
                        window.addEventListener("mousemove", onMove);
                        window.addEventListener("mouseup", onUp);
                      }}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-netbird/60 transition-colors z-20"
                    />
                    <div className="space-y-2 overflow-y-auto">
                      <div className="flex items-center justify-between px-2 py-1 text-xs font-medium text-nb-gray-300">
                        <span className="font-mono truncate">{remoteDir}</span>
                        <button
                          onClick={() => fetchRemoteDir(".")}
                          className="text-nb-gray-400 hover:text-white"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {remoteEntries.map((ent) => (
                        <div
                          key={ent.path}
                          className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs cursor-pointer ${
                            activeFilePath === ent.path
                              ? "bg-nb-gray-900 text-white"
                              : "text-nb-gray-400 hover:bg-nb-gray-900/50 hover:text-nb-gray-200"
                          }`}
                          onClick={() =>
                            ent.is_dir
                              ? fetchRemoteDir(ent.path)
                              : openRemoteFile(ent.path)
                          }
                        >
                          <div className="flex items-center gap-2 truncate">
                            {ent.is_dir ? (
                              <Folder className="h-3.5 w-3.5 text-netbird shrink-0" />
                            ) : (
                              <FileCode2 className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                            )}
                            <span className="truncate font-mono">{ent.name}</span>
                          </div>
                          {!ent.is_dir && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRemoteFile(ent.path);
                              }}
                              className="text-nb-gray-500 hover:text-red-400"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <form
                      onSubmit={handleCreateRemoteFile}
                      className="flex gap-1.5 pt-2 border-t border-nb-gray-900"
                    >
                      <input
                        type="text"
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        placeholder="Neuer Dateipfad..."
                        className="flex-1 rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1 font-mono text-xs text-white"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-netbird px-2.5 py-1 text-xs text-white hover:bg-netbird-500 transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>

                  <div className="flex flex-1 flex-col bg-nb-gray-960">
                    {showDiffDrawer && (
                      <div className="border-b border-nb-gray-900 bg-nb-gray-940 p-4 space-y-2">
                        <textarea
                          value={diffPatchText}
                          onChange={(e) => setDiffPatchText(e.target.value)}
                          placeholder="Unified-Diff einfügen (@@ -1,3 +1,4 @@)..."
                          className="h-28 w-full rounded-lg border border-nb-gray-800 bg-nb-gray-960 p-2.5 font-mono text-xs text-emerald-400"
                        />
                        <button
                          onClick={handleApplyUnifiedDiff}
                          className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 transition"
                        >
                          Unified-Diff anwenden
                        </button>
                      </div>
                    )}

                    <textarea
                      value={editorContent}
                      onChange={(e) => setEditorContent(e.target.value)}
                      className="flex-1 w-full resize-none bg-nb-gray-960 p-5 font-mono text-xs leading-relaxed text-nb-gray-100 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                VIEW 7: NETBIRD ACTIVITY AUDIT LOG (`activity`)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "activity" && (
              <AuditLogView
                filteredLogs={filteredLogs}
                totalLogsCount={auditLogs.length}
                activitySearch={activitySearch}
                setActivitySearch={setActivitySearch}
                activityStatusFilter={activityStatusFilter}
                setActivityStatusFilter={setActivityStatusFilter}
                expandedAuditRows={expandedAuditRows}
                setExpandedAuditRows={setExpandedAuditRows}
              />
            )}

            {/* ═══════════════════════════════════════════════════════════════
                VIEW 8: NETBIRD SETTINGS (`settings` — Setup Keys, Vault & AI)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "settings" && (
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
                        setSettingsTab(id);
                        if (id === "debug-console") fetchDebugSnapshot();
                        if (id === "system-update")
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
                                <strong className="text-nb-gray-200">
                                  Core Plane
                                </strong>{" "}
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

                        {systemUpdateStatus && (() => {
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

                      {/* 4 Primary Action Buttons (Clean Icons without duplicate Emojis) */}
                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          disabled={systemUpdateBusy}
                          onClick={() => handleRunSystemUpdate("update_all")}
                          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 transition"
                        >
                          <Zap className="h-3.5 w-3.5" />
                          <span>
                            Komplett-Update (Core + alle Muscles)
                          </span>
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
                            <strong>{systemUpdateActionLabel}</strong> — Bitte
                            einen Moment warten, während Git-Commits, Binaries
                            und Systemd-Daemons synchronisiert werden...
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
                                  {systemUpdateStatus.binaries.core_gateway
                                    .exists
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

                          {/* Right Card: Muscle Plane Nodes (Identical Info Structure as Core Plane) */}
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
                                        disabled={
                                          systemUpdateBusy || !node.online
                                        }
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
                                          systemUpdateStatus.binaries
                                            .axon_linux_amd64.sha256 ||
                                          "aktiv"
                                        ).slice(0, 16)}
                                        {systemUpdateStatus.binaries
                                          .axon_linux_amd64.exists
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
                          Erzeuge einen einmaligen Setup-Schlüssel für das automatische mTLS 1.3 Onboarding neuer Linux-Server oder das Umbinden bestehender Muscle-Knoten.
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
                        onChange={(e) =>
                          setJoinTier(e.target.value as AutonomyTier)
                        }
                        className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-white"
                      >
                        <option value="TIER_1_UNLEASHED">
                          TIER_1_UNLEASHED
                        </option>
                        <option value="TIER_2_WORKSPACE_JAIL">
                          TIER_2_WORKSPACE_JAIL
                        </option>
                        <option value="TIER_3_SUPERVISED">
                          TIER_3_SUPERVISED
                        </option>
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
                          <code className="font-mono text-amber-300">
                            {gatewayUrl}
                          </code>{" "}
                          durch die öffentlich oder per VPN erreichbare IP/Domain dieses Core-Servers ersetzen.
                        </span>
                      </div>
                    )}

                    {issuedToken ? (
                      <div className="space-y-4 pt-1">
                        <div className="rounded-xl border border-netbird-500/40 bg-nb-gray-950 p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-netbird">
                              1. Neuinstallation — Auf dem Ziel-Linux-Server ausführen, um axon zu installieren &amp; zu verbinden:
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  oneLineInstallerCmd
                                );
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
                                2. Bestehenden Muscle-Agenten per CLI umschalten (axon switch)
                              </span>
                              <p className="text-[11px] text-nb-gray-400">
                                Ist axon bereits installiert? Führe diesen Befehl aus, um ihn mit neuem Token an diesen Core zu binden (oder nutze axon profiles):
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(rebindCliCmd);
                                setCopiedRebindCmd(true);
                                setTimeout(
                                  () => setCopiedRebindCmd(false),
                                  2500
                                );
                              }}
                              className="rounded-md border border-sky-500/50 bg-sky-950 px-3 py-1 text-[11px] font-medium text-sky-300 hover:bg-sky-900 transition"
                            >
                              {copiedRebindCmd
                                ? "✔ CLI kopiert!"
                                : "CLI-Switch kopieren"}
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
                        <strong className="text-white">
                          Setup-Schlüssel erzeugen
                        </strong>
                        , um einen neuen Einmal-Token samt kopierfertigem Installations- und{" "}
                        <code className="font-mono text-sky-300">
                          axon switch
                        </code>
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
                          Geheimnisse werden lokal mit AES-256-GCM verschlüsselt gespeichert (Write-Only) und bei Bedarf sicher in Remote-Prozesse injiziert.
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
                            onChange={(e) =>
                              setEnablePromptCaching(e.target.checked)
                            }
                            className="rounded border-nb-gray-700 accent-netbird"
                          />
                          <div>
                            <div className="font-medium text-white">
                              Prompt- &amp; Dateisystem-Caching
                            </div>
                            <div className="text-[10px] text-nb-gray-400">
                              Statische System-Layer &amp; Datei-Lesezugriffe zwischenspeichern
                            </div>
                          </div>
                        </label>

                        <label className="flex items-center gap-2.5 rounded-lg border border-nb-gray-800 bg-nb-gray-920 p-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enableAutoWatchdog}
                            onChange={(e) =>
                              setEnableAutoWatchdog(e.target.checked)
                            }
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
                            Externer KI-Zugriff &amp; Model Context Protocol (MCP) Server (/api/mcp)
                          </h2>
                          <p className="text-xs text-nb-gray-400">
                            Erlaube externen KI-Agenten (Claude Desktop, Cursor, Windsurf, Antigravity, OpenCode oder eigenen REST/JSON-RPC-Bots), deinen Synapse Core &amp; Muscle sicher per MCP-Token zu steuern.
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
                              ✔ Neuer MCP-API-Schlüssel erzeugt (jetzt kopieren — wird als SHA-256-Hash gespeichert):
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
                              onClick={() =>
                                setShowMcpConfigExamples((v) => !v)
                              }
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
                            Noch keine MCP-API-Tokens erstellt. Klicke oben auf „+ MCP-API-Schlüssel erzeugen“.
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
                          const pid =
                            activeProject?.project_id || "synapse-cloud-demo";
                          const tokenVal =
                            issuedMcpToken || "syn_mcp_<DEIN_API_KEY>";
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
                                    1. MCP-Client-Konfiguration (mcp_config.json — Claude / Cursor / Antigravity)
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        mcpJsonSnippet
                                      );
                                      setCopiedMcpConfig("json");
                                      setTimeout(
                                        () => setCopiedMcpConfig(null),
                                        2000
                                      );
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
                                    2. Direkter REST / JSON-RPC Tool-Aufruf (curl / Eigener KI-Agent)
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        mcpCurlSnippet
                                      );
                                      setCopiedMcpConfig("curl");
                                      setTimeout(
                                        () => setCopiedMcpConfig(null),
                                        2000
                                      );
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
                              onClick={() =>
                                handleTestMcpEndpoint("resources/list")
                              }
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
                              Prüfe Live-mTLS-1.3- &amp; Yamux-Streams, verifiziere die AES-256-GCM-Tresor-Integrität und führe Diagnose-Checks auf Core und Muscle aus.
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
                              Automatische Benachrichtigungen bei Server-Ausfällen, hoher Last oder Selbstheilungs-Aktionen.
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
                              setTimeout(
                                () => setSettingsAlertNotice(null),
                                3500
                              );
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
                                {settingsAlertConfig.events
                                  .slice(0, 4)
                                  .map((ev) => (
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
                              Schütze das Control Center mit Admin-Passwort, Nur-Lesen-Operator-Passwort und optionaler 2FA-PIN.
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
                            onChange={(e) =>
                              setSettingsAdminPwd(e.target.value)
                            }
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
                            onChange={(e) =>
                              setSettingsOperatorPwd(e.target.value)
                            }
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
                                  admin_password:
                                    settingsAdminPwd || "synapse-admin",
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
                                setTimeout(
                                  () => setSettingsAuthNotice(null),
                                  3500
                                );
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
                                  setTimeout(
                                    () => setSettingsAuthNotice(null),
                                    3500
                                  );
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
                              Wähle die Anzeigesprache der Benutzeroberfläche. Weitere Sprachen können jederzeit über das Sprach-Register ergänzt werden.
                            </p>
                          </div>
                        </div>
                        <LanguageSwitcher variant="settings" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* ─────────────────────────────────────────────────────────────────
              RIGHT DOCKED AI COPILOT & REACT ORCHESTRATOR PANEL
              (Mouse-Resizable, Drag & Drop Vision, Prompt/Tool Caching & Rollback)
          ───────────────────────────────────────────────────────────────── */}
          {copilotDrawerOpen && (
            <aside
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOverChat(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.currentTarget === e.target) {
                  setIsDraggingOverChat(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOverChat(false);
                if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                  processDroppedOrSelectedFiles(e.dataTransfer.files);
                }
              }}
              style={{
                width: `${copilotWide ? 600 : copilotWidth}px`,
              }}
              className="relative flex shrink-0 flex-col border-l border-nb-gray-900 bg-nb-gray-940"
            >
              {/* Mouse-Drag Left Border Handle to Resize Copilot Panel */}
              <div
                title="Mit der Maus ziehen, um die Breite des KI-Chats frei anzupassen"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startW = copilotWide ? 600 : copilotWidth;
                  setCopilotWide(false);
                  const onMove = (ev: MouseEvent) => {
                    const nextW = startW - (ev.clientX - startX);
                    setCopilotWidth(Math.max(320, Math.min(820, nextW)));
                  };
                  const onUp = () => {
                    window.removeEventListener("mousemove", onMove);
                    window.removeEventListener("mouseup", onUp);
                  };
                  window.addEventListener("mousemove", onMove);
                  window.addEventListener("mouseup", onUp);
                }}
                className="absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 cursor-col-resize hover:bg-netbird/60 transition-colors z-30"
              />

              {/* Drag & Drop Vision Overlay */}
              {isDraggingOverChat && (
                <div
                  onDragLeave={() => setIsDraggingOverChat(false)}
                  className="pointer-events-none absolute inset-2 z-40 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-netbird bg-nb-gray-950/90 p-6 text-center backdrop-blur-sm"
                >
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-netbird-500/40 bg-netbird-950 text-netbird">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-white">
                    Drop Screenshots, Diagrams, or Logs Here
                  </p>
                  <p className="mt-1 text-xs text-nb-gray-300">
                    Synapse Vision will inspect your images and translate them
                    into server configs or bug fixes.
                  </p>
                </div>
              )}

              {/* Single Clean Header Bar + Optional Conversation Filter Strip */}
              <div className="border-b border-nb-gray-900 bg-nb-gray-950/60 px-3.5 py-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird/15 text-netbird">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <span className="truncate text-xs font-semibold text-white">
                      Synapse AI
                    </span>
                    <button
                      type="button"
                      onClick={() => setEnablePromptCaching((prev) => !prev)}
                      className={`inline-flex h-[22px] items-center justify-center gap-1 rounded-md border px-2 text-[10px] font-medium leading-none transition ${
                        enablePromptCaching
                          ? "border-emerald-500/35 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-950/90"
                          : "border-nb-gray-800 bg-nb-gray-930 text-nb-gray-400 hover:border-nb-gray-700 hover:text-nb-gray-200"
                      }`}
                      title={
                        enablePromptCaching
                          ? "Prompt- & Tool-Cache aktiv (Klicken zum Deaktivieren)"
                          : "Prompt- & Tool-Cache deaktiviert (Klicken zum Aktivieren)"
                      }
                    >
                      <Zap
                        className={`h-2.5 w-2.5 shrink-0 ${
                          enablePromptCaching
                            ? "text-emerald-400"
                            : "text-nb-gray-500"
                        }`}
                      />
                      <span>
                        {enablePromptCaching
                          ? latestCacheMetrics
                            ? `Cache (${latestCacheMetrics.cached_tokens} tok)`
                            : "Cache aktiv"
                          : "Cache aus"}
                      </span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (copilotWide) {
                          setCopilotWide(false);
                          setCopilotWidth(420);
                        } else {
                          setCopilotWide(true);
                          setCopilotWidth(600);
                        }
                      }}
                      className="inline-flex h-[22px] items-center justify-center rounded-md border border-nb-gray-800 bg-nb-gray-930 px-2 text-[10px] font-medium leading-none text-nb-gray-300 hover:border-nb-gray-700 hover:text-white transition"
                      title={
                        copilotWide
                          ? "Auf Standardbreite verkleinern"
                          : "Chat-Fenster verbreitern (oder linken Rand ziehen)"
                      }
                    >
                      {copilotWide ? "Kompakt" : "Breiter"}
                    </button>
                    <button
                      onClick={handleClearChat}
                      className="inline-flex h-[22px] items-center justify-center rounded-md border border-nb-gray-800 bg-nb-gray-930 px-2 text-[10px] font-medium leading-none text-nb-gray-400 hover:border-nb-gray-700 hover:text-white transition"
                      title="Konversation zurücksetzen"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => setCopilotDrawerOpen(false)}
                      className="text-nb-gray-400 hover:text-white p-0.5"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Interactive Filter Bar when conversation has multiple turns */}
                {chatHistory.length > 2 && (
                  <div className="flex items-center justify-between gap-1 rounded-lg border border-nb-gray-800/80 bg-nb-gray-940/80 p-1">
                    <div className="flex items-center gap-1">
                      {(
                        [
                          { id: "all", label: `Alle (${chatHistory.length})` },
                          {
                            id: "reports",
                            label: `KI-Antworten (${
                              chatHistory.filter((m) => m.role === "assistant")
                                .length
                            })`,
                          },
                          {
                            id: "user",
                            label: `Aktionen (${
                              chatHistory.filter((m) => m.role === "user").length
                            })`,
                          },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setChatMessageFilter(tab.id)}
                          className={`rounded-md px-2 py-0.5 font-mono text-[10px] transition ${
                            chatMessageFilter === tab.id
                              ? "bg-netbird text-white font-semibold"
                              : "text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <span className="hidden sm:inline px-1.5 font-mono text-[9px] text-nb-gray-400">
                      Interaktive Ansicht
                    </span>
                  </div>
                )}
              </div>

              {/* Chat Messages + Interactive Bento Cards + Grouped Topic Reports + Categorized Tool Pipeline */}
              <div
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto p-3.5 space-y-3.5"
              >
                {chatHistory.map((msg, idx) => {
                  if (
                    chatMessageFilter === "reports" &&
                    msg.role !== "assistant"
                  ) {
                    return null;
                  }
                  if (chatMessageFilter === "user" && msg.role !== "user") {
                    return null;
                  }

                  const thinkingOpen = expandedThinking[idx];
                  const rawContent = msg.content || "";

                  // ───────────────────────────────────────────────────────────
                  // 1. STRUCTURED USER MESSAGE RENDERING (No raw prompt dumps!)
                  // ───────────────────────────────────────────────────────────
                  if (msg.role === "user") {
                    const isSkillSystem =
                      rawContent.includes("[Skill: CheckSystem]") ||
                      rawContent.includes("[System-Check]");
                    const isSkillOpsec =
                      rawContent.includes("[Skill: CheckOpsec]") ||
                      rawContent.includes("[OpSec-Check]");
                    const isSkillUpdates =
                      rawContent.includes("[Skill: CheckUpdates]") ||
                      rawContent.includes("[Update & Funktionstest]") ||
                      rawContent.includes("[Nur Funktionstest]") ||
                      rawContent.includes("[Update-Entscheidung]");
                    const isSkillForensics = rawContent.includes(
                      "[Skill: DeepForensics]"
                    );
                    const isSkillSearch = rawContent.includes(
                      "[Skill: SkillSearch]"
                    );
                    const isInterviewMsg =
                      rawContent.includes("[Interview-Modus]") ||
                      rawContent.includes("[Interview-Antwort]");

                    const isStructuredAction =
                      isSkillSystem ||
                      isSkillOpsec ||
                      isSkillUpdates ||
                      isSkillForensics ||
                      isSkillSearch ||
                      isInterviewMsg;

                    if (isStructuredAction) {
                      const focusMatch = rawContent.match(
                        /(?:Zusätzlicher Nutzer-Fokus|Nutzer-Suchanfrage \/ Fokus|Zusätzliche Anweisung des Nutzers):\s*"([^"]+)"/
                      );
                      const userFocusText = focusMatch ? focusMatch[1] : null;
                      const isLongRawPrompt = rawContent.length > 260;
                      const showRaw = Boolean(expandedRawPrompts[idx]);

                      const actionMeta = isSkillSystem
                        ? {
                            badge: "SRE System-Tiefenscan",
                            title: "CheckSystem (6-Phasen Infrastruktur-Audit)",
                            summary:
                              userFocusText ||
                              "Prüft Host-Telemetrie, Ports, Quellcode, SQLite-Integrität, Logs & Brain-Sync.",
                            border:
                              "border-emerald-500/40 bg-gradient-to-br from-emerald-950/50 via-nb-gray-940 to-nb-gray-950",
                            pill: "border-emerald-500/40 bg-emerald-950/70 text-emerald-300",
                            icon: (
                              <Activity className="h-3.5 w-3.5 text-emerald-400" />
                            ),
                          }
                        : isSkillOpsec
                        ? {
                            badge: "DevSecOps Security-Audit",
                            title: "CheckOpsec (Sicherheits- & Socket-Prüfung)",
                            summary:
                              userFocusText ||
                              "Prüft Socket-Bindings, SSH-Härtung, Firewall, Dateirechte, Secrets & Header.",
                            border:
                              "border-sky-500/40 bg-gradient-to-br from-sky-950/50 via-nb-gray-940 to-nb-gray-950",
                            pill: "border-sky-500/40 bg-sky-950/70 text-sky-300",
                            icon: (
                              <Shield className="h-3.5 w-3.5 text-sky-400" />
                            ),
                          }
                        : isSkillUpdates
                        ? {
                            badge: "Muscle & Backend Updates",
                            title: rawContent.includes("[Update & Funktionstest]")
                              ? "Updates durchführen & End-to-End testen"
                              : rawContent.includes("[Nur Funktionstest]")
                              ? "End-to-End Funktionstest ausführen"
                              : "CheckUpdates (Versions- & Paket-Inspektion)",
                            summary:
                              userFocusText ||
                              (rawContent.length <= 240
                                ? rawContent.replace(/\*\*/g, "")
                                : "Prüft Axon-Binaries, Runtimes, Systempakete & Backends auf Updates."),
                            border:
                              "border-sky-500/40 bg-gradient-to-br from-sky-950/50 via-nb-gray-940 to-nb-gray-950",
                            pill: "border-sky-500/40 bg-sky-950/70 text-sky-300",
                            icon: (
                              <RefreshCw className="h-3.5 w-3.5 text-sky-400" />
                            ),
                          }
                        : isSkillForensics
                        ? {
                            badge: "Root-Cause Forensik",
                            title: "DeepForensics (Log- & Prozess-Tiefenanalyse)",
                            summary:
                              userFocusText ||
                              "Durchsucht Systemd-Journals, Logs, Datenbanken & Prozesse nach Fehlerursachen.",
                            border:
                              "border-sky-500/40 bg-gradient-to-br from-sky-950/50 via-nb-gray-940 to-nb-gray-950",
                            pill: "border-sky-500/40 bg-sky-950/70 text-sky-300",
                            icon: (
                              <Cpu className="h-3.5 w-3.5 text-sky-400" />
                            ),
                          }
                        : isSkillSearch
                        ? {
                            badge: "Deep-Search",
                            title: "SkillSearch (Code-, System- & UI-Suche)",
                            summary:
                              userFocusText ||
                              "Durchsucht Dateien, Ports, Datenbanken, Logs und UI-Funktionen.",
                            border:
                              "border-amber-500/40 bg-gradient-to-br from-amber-950/50 via-nb-gray-940 to-nb-gray-950",
                            pill: "border-amber-500/40 bg-amber-950/70 text-amber-300",
                            icon: (
                              <Search className="h-3.5 w-3.5 text-amber-400" />
                            ),
                          }
                        : {
                            badge: "Interaktives Interview",
                            title: rawContent.includes("[Interview-Modus]")
                              ? "Interview-Modus gestartet"
                              : "Interview-Entscheidung gesendet",
                            summary:
                              userFocusText ||
                              (rawContent.includes("JA, JETZT BEHEBEN")
                                ? "✅ Punkt jetzt live beheben & verifizieren"
                                : rawContent.includes("ÜBERSPRINGEN")
                                ? "⏭️ Punkt überspringen → weiter zum nächsten Befund"
                                : rawContent.includes("ALLE RESTLICHEN")
                                ? "⚡ Alle verbleibenden Punkte automatisch beheben"
                                : "Schrittweise Durchsprache der Befunde & Empfehlungen."),
                            border:
                              "border-netbird-500/40 bg-gradient-to-br from-netbird-950/50 via-nb-gray-940 to-nb-gray-950",
                            pill: "border-netbird-500/40 bg-netbird-950/70 text-netbird",
                            icon: (
                              <Sparkles className="h-3.5 w-3.5 text-netbird" />
                            ),
                          };

                      return (
                        <div
                          key={idx}
                          className={`ml-4 overflow-hidden rounded-xl border p-3 text-xs shadow-sm ${actionMeta.border}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {actionMeta.icon}
                              <span
                                className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${actionMeta.pill}`}
                              >
                                {actionMeta.badge}
                              </span>
                            </div>
                            {isLongRawPrompt && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedRawPrompts((prev) => ({
                                    ...prev,
                                    [idx]: !prev[idx],
                                  }))
                                }
                                className="rounded border border-nb-gray-800 bg-nb-gray-950/80 px-1.5 py-0.5 font-mono text-[9px] text-nb-gray-400 hover:text-white transition"
                              >
                                {showRaw ? "Kompakt ▲" : "Prompt-Details ▼"}
                              </button>
                            )}
                          </div>
                          <div className="mt-1.5 font-semibold text-white">
                            {actionMeta.title}
                          </div>
                          <div className="mt-0.5 text-[11px] text-nb-gray-300 leading-relaxed">
                            {actionMeta.summary}
                          </div>
                          {showRaw && (
                            <div className="mt-2 border-t border-nb-gray-800/80 pt-2">
                              <RichMarkdownDocument
                                markdown={rawContent}
                                variant="chat"
                              />
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Normal conversational User Bubble
                    return (
                      <div
                        key={idx}
                        className="ml-6 min-w-0 overflow-hidden break-words rounded-2xl rounded-tr-sm border border-netbird-500/40 bg-gradient-to-br from-netbird-950/70 via-netbird-950/40 to-nb-gray-940 p-3.5 text-xs text-white shadow-sm"
                      >
                        <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-netbird/90">
                          <span>Deine Anfrage</span>
                          {primaryNode && <span>@{primaryNode}</span>}
                        </div>
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mb-2.5 flex flex-wrap gap-2">
                            {msg.attachments.map((att) => (
                              <div
                                key={att.id}
                                className="group relative overflow-hidden rounded-md border border-nb-gray-700 bg-nb-gray-950"
                              >
                                {att.mime_type?.startsWith("image/") ? (
                                  <img
                                    src={att.data_url}
                                    alt={att.name}
                                    className="h-20 w-28 object-cover"
                                  />
                                ) : (
                                  <div className="flex h-14 w-28 items-center gap-1.5 px-2 font-mono text-[10px] text-nb-gray-200">
                                    <FileText className="h-3.5 w-3.5 shrink-0 text-netbird" />
                                    <span className="truncate">{att.name}</span>
                                  </div>
                                )}
                                <div className="bg-black/75 px-1.5 py-0.5 font-mono text-[9px] text-nb-gray-300 truncate max-w-[112px]">
                                  {att.name}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <RichMarkdownDocument
                          markdown={rawContent}
                          variant="chat"
                          onOpenPort={(port) => {
                            setPreviewPort(port);
                            setActiveNav("reverse-proxy");
                          }}
                          onOpenFile={(filePath) => {
                            setActiveNav("workspace");
                            openRemoteFile(filePath);
                          }}
                          onOpenBrainDoc={(doc) => {
                            setBrainDocTab(doc);
                            setActiveNav("brain-vault");
                          }}
                          onRunCommand={(cmd) => {
                            setTerminalDrawerOpen(true);
                            navigator.clipboard.writeText(cmd);
                            setStatusToast(
                              "Befehl kopiert & Live-Terminal geöffnet"
                            );
                            setTimeout(() => setStatusToast(""), 3000);
                          }}
                        />
                      </div>
                    );
                  }

                  // ───────────────────────────────────────────────────────────
                  // 2. ASSISTANT MESSAGE CARD (Varied Header + Grouped Sections + Categorized Tool Pipeline)
                  // ───────────────────────────────────────────────────────────
                  const isWatchdogMsg = rawContent.includes(
                    "Proactive Auto-Watchdog Triggered"
                  );
                  if (isWatchdogMsg) {
                    const prevMsg = idx > 0 ? chatHistory[idx - 1] : null;
                    if (
                      prevMsg &&
                      prevMsg.role === "assistant" &&
                      (prevMsg.content || "").includes(
                        "Proactive Auto-Watchdog Triggered"
                      )
                    ) {
                      // Skip consecutive duplicate watchdog cards; they are bundled into the first one of the run!
                      return null;
                    }
                    let bundleCount = 1;
                    for (let k = idx + 1; k < chatHistory.length; k++) {
                      if (
                        chatHistory[k].role === "assistant" &&
                        (chatHistory[k].content || "").includes(
                          "Proactive Auto-Watchdog Triggered"
                        )
                      ) {
                        bundleCount++;
                      } else {
                        break;
                      }
                    }

                    const watchdogExpanded = Boolean(expandedTurnTools[idx]);

                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-nb-gray-940 to-nb-gray-940 px-3 py-2 text-xs text-nb-gray-200 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-950/70 px-2 py-0.5 font-mono text-[9px] font-semibold text-amber-300 shrink-0">
                              🛡️ Auto-Watchdog ({bundleCount}x)
                            </span>
                            <span className="truncate text-[11px] font-medium text-white">
                              Selbstheilung für Microservice :4050 ausgeführt
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedTurnTools((prev) => ({
                                ...prev,
                                [idx]: !prev[idx],
                              }))
                            }
                            className="shrink-0 font-mono text-[10px] text-amber-300 hover:text-white"
                          >
                            {watchdogExpanded ? "Kompakt ▲" : "Details ▼"}
                          </button>
                        </div>
                        {watchdogExpanded && (
                          <div className="mt-2 border-t border-nb-gray-800/70 pt-2">
                            <RichMarkdownDocument
                              markdown={rawContent}
                              variant="chat"
                              onOpenPort={(port) => {
                                setPreviewPort(port);
                                setActiveNav("reverse-proxy");
                              }}
                              onOpenFile={(filePath) => {
                                setActiveNav("workspace");
                                openRemoteFile(filePath);
                              }}
                              onOpenBrainDoc={(doc) => {
                                setBrainDocTab(doc);
                                setActiveNav("brain-vault");
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  }

                  const prevUserText =
                    idx > 0 && chatHistory[idx - 1]?.role === "user"
                      ? chatHistory[idx - 1].content || ""
                      : "";

                  const assistantTheme =
                    prevUserText.includes("CheckOpsec") ||
                    prevUserText.includes("[OpSec-Check]")
                      ? {
                          label: "DevSecOps Security-Bericht",
                          badgeClass:
                            "border-sky-500/35 bg-sky-950/60 text-sky-300",
                          cardBorder: "border-sky-500/25",
                          icon: <Shield className="h-3 w-3 text-sky-400" />,
                        }
                      : prevUserText.includes("CheckUpdates") ||
                        prevUserText.includes("[Update")
                      ? {
                          label: "Update- & Test-Inspektor",
                          badgeClass:
                            "border-sky-500/35 bg-sky-950/60 text-sky-300",
                          cardBorder: "border-sky-500/25",
                          icon: <RefreshCw className="h-3 w-3 text-sky-400" />,
                        }
                      : prevUserText.includes("CheckSystem") ||
                        prevUserText.includes("[System-Check]")
                      ? {
                          label: "SRE System-Tiefenbericht",
                          badgeClass:
                            "border-emerald-500/35 bg-emerald-950/60 text-emerald-300",
                          cardBorder: "border-emerald-500/25",
                          icon: (
                            <Activity className="h-3 w-3 text-emerald-400" />
                          ),
                        }
                      : prevUserText.includes("DeepForensics")
                      ? {
                          label: "Root-Cause Forensik",
                          badgeClass:
                            "border-sky-500/35 bg-sky-950/60 text-sky-300",
                          cardBorder: "border-sky-500/25",
                          icon: <Cpu className="h-3 w-3 text-sky-400" />,
                        }
                      : prevUserText.includes("[Interview-")
                      ? {
                          label: "DevOps Interview-Begleiter",
                          badgeClass:
                            "border-netbird-500/40 bg-netbird-950/60 text-netbird",
                          cardBorder: "border-netbird-500/30",
                          icon: <Sparkles className="h-3 w-3 text-netbird" />,
                        }
                      : {
                          label:
                            idx === 0 ? "Synapse Control Center" : "Synapse AI",
                          badgeClass:
                            "border-nb-gray-700 bg-nb-gray-900 text-nb-gray-200",
                          cardBorder: "border-nb-gray-800/90",
                          icon: <Sparkles className="h-3 w-3 text-netbird" />,
                        };

                  const isWelcomeCard =
                    rawContent.startsWith("Welcome to **Synapse Control Center**") ||
                    rawContent.startsWith("Willkommen im **Synapse Control Center**") ||
                    rawContent.startsWith("Willkommen im Synapse AI Copilot") ||
                    rawContent.startsWith("Welcome to the Synapse AI Copilot");
                  const isResetCard =
                    rawContent.startsWith("Conversation context compacted") ||
                    rawContent.startsWith("Konversations-Kontext bereinigt") ||
                    rawContent === "Conversation history cleared." ||
                    rawContent === "Konversationsverlauf geleert.";

                  const displayContent = isWelcomeCard
                    ? locale === "de"
                      ? "Willkommen im **Synapse Control Center**. Deine interaktive Overlay-Topologie, Muscle-Server, `Rule Cartridges` und der `Brain Vault` sind auf der Hauptfläche abgebildet.\n\nNutze das **Control Center**, um Knoten frei anzuordnen, Sicherheits-Richtlinien zu steuern oder über `+ Server` einen neuen Linux-Host mit einem Befehl anzubinden."
                      : "Welcome to **Synapse Control Center**. Your interactive overlay topology, Muscle Peers, `Rule Cartridges`, and `Brain Vault` are mapped on the main canvas.\n\nUse the **Control Center** to drag nodes, toggle policies, or click `+ Server` to enroll a new Linux server with one command."
                    : isResetCard
                    ? locale === "de"
                      ? "Konversations-Kontext bereinigt. Bereit für neue Anweisungen (Prompt-Cache & Vision aktiv)."
                      : "Conversation context compacted and cleared. Ready for new instructions (Prompt Cache & Vision active)."
                    : rawContent.replace(
                        /^Executed `?([a-z0-9_]+)`? through the Synapse Core Interceptor \(`?([^)`]+)`?\)\.$/i,
                        locale === "de"
                          ? "✔ Tool `$1` erfolgreich über den Synapse Core Interceptor ausgeführt (`$2`)."
                          : "✔ Tool `$1` executed via Synapse Core Interceptor (`$2`)."
                      );

                  return (
                    <div
                      key={idx}
                      className={`min-w-0 overflow-hidden break-words rounded-2xl rounded-tl-sm border bg-nb-gray-930/95 p-3.5 text-xs text-nb-gray-100 shadow-sm ${assistantTheme.cardBorder}`}
                    >
                      {/* Assistant Card Header Bar */}
                      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-1.5 border-b border-nb-gray-800/70 pb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium whitespace-nowrap ${assistantTheme.badgeClass}`}
                          >
                            {assistantTheme.icon}
                            <span>{assistantTheme.label}</span>
                          </span>
                          {msg.toolResults && msg.toolResults.length > 0 && (
                            <span className="shrink-0 whitespace-nowrap rounded-full border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 font-mono text-[9px] text-nb-gray-300">
                              🛠️ {msg.toolResults.length}{" "}
                              {msg.toolResults.length === 1
                                ? "Schritt"
                                : "Schritte"}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {msg.thinking && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedThinking((prev) => ({
                                  ...prev,
                                  [idx]: !prev[idx],
                                }))
                              }
                              className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[9px] transition ${
                                thinkingOpen
                                  ? "border-netbird bg-netbird/20 text-white"
                                  : "border-nb-gray-800 bg-nb-gray-950 text-nb-gray-400 hover:text-white"
                              }`}
                              title="KI-Gedankengang (Reasoning Trace) ein-/ausblenden"
                            >
                              <Brain className="h-2.5 w-2.5 text-netbird" />
                              <span>Reasoning</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(rawContent);
                              setCopiedChatMsgIdx(idx);
                              setTimeout(() => setCopiedChatMsgIdx(null), 1800);
                            }}
                            title="Antwort als Markdown kopieren"
                            className="flex items-center gap-1 rounded-md border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[9px] text-nb-gray-400 hover:border-nb-gray-700 hover:text-white transition"
                          >
                            {copiedChatMsgIdx === idx ? (
                              <>
                                <Check className="h-2.5 w-2.5 text-emerald-400" />
                                <span className="text-emerald-400">Kopiert</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-2.5 w-2.5" />
                                <span>Kopieren</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Collapsible AI Reasoning / Thinking Trace */}
                      {msg.thinking && thinkingOpen && (
                        <div className="mb-3 rounded-xl border border-nb-gray-800 bg-nb-gray-950/90 p-2.5">
                          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-netbird">
                            <span className="flex items-center gap-1.5">
                              <Brain className="h-3 w-3" />
                              <span>AI Reasoning &amp; Context Trace</span>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedThinking((prev) => ({
                                  ...prev,
                                  [idx]: false,
                                }))
                              }
                              className="text-nb-gray-400 hover:text-white"
                            >
                              Schließen
                            </button>
                          </div>
                          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap border-t border-nb-gray-800 pt-1.5 font-mono text-[10px] text-nb-gray-400">
                            {msg.thinking}
                          </pre>
                        </div>
                      )}

                      {/* Rich Grouped & Interactive Document Content */}
                      <RichMarkdownDocument
                        markdown={displayContent}
                        variant="chat"
                        onOpenPort={(port) => {
                          setPreviewPort(port);
                          setActiveNav("reverse-proxy");
                        }}
                        onOpenFile={(filePath) => {
                          setActiveNav("workspace");
                          openRemoteFile(filePath);
                        }}
                        onOpenBrainDoc={(doc) => {
                          setBrainDocTab(doc);
                          setActiveNav("brain-vault");
                        }}
                        onRunCommand={(cmd) => {
                          setTerminalDrawerOpen(true);
                          navigator.clipboard.writeText(cmd);
                          setStatusToast(
                            "Befehl kopiert & Live-Terminal geöffnet"
                          );
                          setTimeout(() => setStatusToast(""), 3000);
                        }}
                      />

                      {/* Interactive Quick-Launch Skill Bento Grid inside Welcome Card (`idx === 0`) */}
                      {idx === 0 && (
                        <div className="mt-3 space-y-2 border-t border-nb-gray-800/80 pt-3">
                          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-nb-gray-400">
                            <span>Direktstart: Interaktive DevOps-Skills</span>
                            <span className="text-netbird">1-Klick Auswahl</span>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedChatSkill("CheckSystem");
                                setTimeout(
                                  () => chatInputRef.current?.focus(),
                                  50
                                );
                              }}
                              className="group flex flex-col items-start rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5 text-left transition hover:border-emerald-500/60 hover:bg-emerald-950/40"
                            >
                              <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
                                <Activity className="h-3.5 w-3.5 text-emerald-400" />
                                <span>System-Check</span>
                              </div>
                              <span className="mt-0.5 text-[10px] text-nb-gray-400 group-hover:text-nb-gray-200">
                                6-Phasen SRE &amp; DB Audit
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedChatSkill("CheckOpsec");
                                setTimeout(
                                  () => chatInputRef.current?.focus(),
                                  50
                                );
                              }}
                              className="group flex flex-col items-start rounded-xl border border-sky-500/30 bg-sky-950/20 p-2.5 text-left transition hover:border-sky-500/60 hover:bg-sky-950/40"
                            >
                              <div className="flex items-center gap-1.5 font-semibold text-sky-300">
                                <Shield className="h-3.5 w-3.5 text-sky-400" />
                                <span>OpSec-Audit</span>
                              </div>
                              <span className="mt-0.5 text-[10px] text-nb-gray-400 group-hover:text-nb-gray-200">
                                Ports, SSH, Firewall &amp; Keys
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedChatSkill("CheckUpdates");
                                setTimeout(
                                  () => chatInputRef.current?.focus(),
                                  50
                                );
                              }}
                              className="group flex flex-col items-start rounded-xl border border-sky-500/30 bg-sky-950/20 p-2.5 text-left transition hover:border-sky-500/60 hover:bg-sky-950/40"
                            >
                              <div className="flex items-center gap-1.5 font-semibold text-sky-300">
                                <RefreshCw className="h-3.5 w-3.5 text-sky-400" />
                                <span>Updates prüfen</span>
                              </div>
                              <span className="mt-0.5 text-[10px] text-nb-gray-400 group-hover:text-nb-gray-200">
                                Muscle, Backends &amp; Test
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedChatSkill("DeepForensics");
                                setTimeout(
                                  () => chatInputRef.current?.focus(),
                                  50
                                );
                              }}
                              className="group flex flex-col items-start rounded-xl border border-amber-500/30 bg-amber-950/20 p-2.5 text-left transition hover:border-amber-500/60 hover:bg-amber-950/40"
                            >
                              <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                                <Cpu className="h-3.5 w-3.5 text-amber-400" />
                                <span>Deep-Forensik</span>
                              </div>
                              <span className="mt-0.5 text-[10px] text-nb-gray-400 group-hover:text-nb-gray-200">
                                Logs, Prozesse &amp; Ursachen
                              </span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Post-Skill-Report "Interview" Button & Active Interview Step Controls */}
                      {msg.role === "assistant" && (() => {
                        const prevUserContent =
                          idx > 0 && chatHistory[idx - 1]?.role === "user"
                            ? chatHistory[idx - 1].content || ""
                            : "";
                        const isInterviewTurn =
                          (prevUserContent.includes("[Interview-Modus]") ||
                            prevUserContent.includes("[Interview-Antwort]")) &&
                          !prevUserContent.includes("Interview beenden") &&
                          !prevUserContent.includes("Alle restlichen Punkte");
                        const asksToFixOrSkip =
                          /beheben oder überspringen|soll ich diesen punkt/i.test(
                            msg.content
                          );
                        const showInterviewControls =
                          isInterviewTurn || asksToFixOrSkip;

                        const isUpdateCheckReport =
                          !showInterviewControls &&
                          !prevUserContent.includes("[Interview-") &&
                          !prevUserContent.includes("[Update-") &&
                          (prevUserContent.includes("[Skill: CheckUpdates]") ||
                            /sollen diese updates.*durchgeführt|muscle.*backend.*update-bericht/i.test(
                              msg.content
                            ));

                        const isSkillReport =
                          !showInterviewControls &&
                          !isUpdateCheckReport &&
                          !prevUserContent.includes("[Interview-") &&
                          msg.content.length > 260 &&
                          (prevUserContent.includes("[Skill: CheckSystem]") ||
                            prevUserContent.includes("[Skill: CheckOpsec]") ||
                            prevUserContent.includes("[Skill: DeepForensics]") ||
                            (msg.content.length > 400 &&
                              (msg.toolResults?.length || 0) >= 2 &&
                              /Empfehlung|Härtung|Befund|OpSec|Verbesserung|CheckSystem|CheckOpsec|Forensik/i.test(
                                msg.content
                              )));

                        if (isUpdateCheckReport) {
                          return (
                            <div className="mt-3 rounded-xl border border-sky-500/40 bg-gradient-to-br from-sky-950/35 via-nb-gray-940 to-nb-gray-940 p-3 space-y-2.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-sky-300">
                                  <RefreshCw className="h-3.5 w-3.5 text-sky-400" />
                                  <span>
                                    Muscle &amp; Backend Updates: Sollen die Updates durchgeführt &amp; getestet werden?
                                  </span>
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  disabled={chatBusy}
                                  onClick={() =>
                                    handleUpdateSkillDecision(
                                      "execute_and_test",
                                      msg.content
                                    )
                                  }
                                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-950/60 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-900/70 hover:text-white disabled:opacity-40 transition"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                  <span>
                                    Ja, Updates durchführen &amp; Funktionstest starten
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  disabled={chatBusy}
                                  onClick={() =>
                                    handleUpdateSkillDecision(
                                      "test_only",
                                      msg.content
                                    )
                                  }
                                  className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-950/50 px-2.5 py-1.5 text-[11px] font-medium text-sky-200 hover:bg-sky-900/60 hover:text-white disabled:opacity-40 transition"
                                >
                                  <Activity className="h-3.5 w-3.5 text-sky-400" />
                                  <span>Nur Funktionstest ausführen</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={chatBusy}
                                  onClick={() =>
                                    handleStartSkillInterview(msg.content)
                                  }
                                  className="flex items-center gap-1.5 rounded-lg border border-netbird-500/40 bg-netbird/15 px-2.5 py-1.5 text-[11px] font-medium text-netbird hover:bg-netbird/25 hover:text-white disabled:opacity-40 transition"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  <span>Einzeln im Interview durchgehen</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={chatBusy}
                                  onClick={() =>
                                    handleUpdateSkillDecision("skip", msg.content)
                                  }
                                  className="flex items-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1.5 text-[11px] text-nb-gray-400 hover:border-red-500/40 hover:text-red-300 disabled:opacity-40 transition"
                                >
                                  <X className="h-3 w-3" />
                                  <span>Nein, keine Updates</span>
                                </button>
                              </div>
                            </div>
                          );
                        }

                        if (showInterviewControls) {
                          return (
                            <div className="mt-3 rounded-xl border border-netbird-500/40 bg-gradient-to-br from-netbird-950/40 via-nb-gray-940 to-nb-gray-940 p-3 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-netbird">
                                  <Sparkles className="h-3 w-3" />
                                  <span>DevOps Interview-Modus: Deine Entscheidung</span>
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  disabled={chatBusy}
                                  onClick={() => handleInterviewStepResponse("fix")}
                                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-950/50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-900/70 hover:text-white disabled:opacity-40 transition"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                  <span>Ja, jetzt beheben</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={chatBusy}
                                  onClick={() => handleInterviewStepResponse("skip")}
                                  className="flex items-center gap-1.5 rounded-lg border border-nb-gray-700 bg-nb-gray-900 px-2.5 py-1.5 text-[11px] font-medium text-nb-gray-200 hover:border-nb-gray-500 hover:text-white disabled:opacity-40 transition"
                                >
                                  <ChevronRight className="h-3.5 w-3.5 text-nb-gray-400" />
                                  <span>Nicht beheben (Nächster Punkt)</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={chatBusy}
                                  onClick={() => handleInterviewStepResponse("fix_all")}
                                  className="flex items-center gap-1.5 rounded-lg border border-netbird-500/40 bg-netbird/15 px-2.5 py-1.5 text-[11px] font-medium text-netbird hover:bg-netbird/25 hover:text-white disabled:opacity-40 transition"
                                >
                                  <Zap className="h-3.5 w-3.5" />
                                  <span>Alle restlichen beheben</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={chatBusy}
                                  onClick={() => handleInterviewStepResponse("stop")}
                                  className="flex items-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2 py-1.5 text-[11px] text-nb-gray-400 hover:border-red-500/40 hover:text-red-300 disabled:opacity-40 transition"
                                >
                                  <X className="h-3 w-3" />
                                  <span>Interview beenden</span>
                                </button>
                              </div>
                              <p className="text-[10px] text-nb-gray-400">
                                Tipp: Du kannst auch direkt ins Textfeld schreiben, wenn die KI diesen Punkt auf eine bestimmte Weise anpassen soll.
                              </p>
                            </div>
                          );
                        }

                        if (isSkillReport) {
                          return (
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-netbird-500/40 bg-gradient-to-r from-netbird-950/45 via-nb-gray-940 to-nb-gray-940 px-3.5 py-2.5">
                              <div className="min-w-0">
                                <div className="font-semibold text-xs text-white">
                                  Befunde &amp; Empfehlungen Schritt für Schritt durchgehen?
                                </div>
                                <div className="text-[11px] text-nb-gray-400">
                                  Im Interview-Modus stellt dir die KI jeden Punkt einzeln vor und fragt dich, ob sie ihn direkt beheben soll.
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={chatBusy}
                                onClick={() => handleStartSkillInterview(msg.content)}
                                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-netbird px-3 py-1.5 text-xs font-semibold text-white hover:bg-netbird-500 disabled:opacity-40 transition shadow-sm"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>Interview starten</span>
                              </button>
                            </div>
                          );
                        }

                        return null;
                      })()}

                      {/* Categorized & Interactive Tool Execution Pipeline + Dedicated Registered Service Cards */}
                      {msg.toolResults && msg.toolResults.length > 0 && (() => {
                        const registeredTurnServices = msg.toolResults
                          .filter(
                            (tr) =>
                              tr.tool_name === "core_register_service" &&
                              Boolean(
                                (tr.output as Record<string, unknown>)
                                  ?.registered
                              )
                          )
                          .map(
                            (tr) =>
                              (
                                tr.output as {
                                  registered: {
                                    service_id: string;
                                    name: string;
                                    node_id: string;
                                    port: number;
                                    category?: string;
                                    description?: string;
                                    endpoints?: Array<{
                                      id: string;
                                      label: string;
                                      method:
                                        | "GET"
                                        | "POST"
                                        | "PUT"
                                        | "DELETE"
                                        | "SQL";
                                      path: string;
                                      sample_payload?: string;
                                    }>;
                                  };
                                }
                              ).registered
                          );

                        const turnToolsExpanded = Boolean(
                          expandedTurnTools[idx]
                        );
                        const activeCat =
                          turnToolCategoryFilter[idx] || "all";

                        const categorizeTool = (name: string) => {
                          if (
                            name.includes("pty") ||
                            name.includes("exec") ||
                            name.includes("command")
                          ) {
                            return "shell";
                          }
                          if (name.includes("fs") || name.includes("file")) {
                            return "fs";
                          }
                          if (name.includes("search")) {
                            return "search";
                          }
                          return "core";
                        };

                        const counts = {
                          shell: msg.toolResults.filter(
                            (t) => categorizeTool(t.tool_name) === "shell"
                          ).length,
                          fs: msg.toolResults.filter(
                            (t) => categorizeTool(t.tool_name) === "fs"
                          ).length,
                          search: msg.toolResults.filter(
                            (t) => categorizeTool(t.tool_name) === "search"
                          ).length,
                          core: msg.toolResults.filter(
                            (t) => categorizeTool(t.tool_name) === "core"
                          ).length,
                        };

                        const filteredTools = msg.toolResults
                          .map((tr, origIdx) => ({ tr, origIdx }))
                          .filter(
                            ({ tr }) =>
                              activeCat === "all" ||
                              categorizeTool(tr.tool_name) === activeCat
                          );

                        return (
                          <div className="mt-3 space-y-2 border-t border-nb-gray-800/80 pt-2.5">
                            {/* 1. Dedicated Highlight Boxes for Newly Registered Services (WebUI / Backend / DB) */}
                            {registeredTurnServices.length > 0 && (
                              <div className="space-y-2">
                                <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-400">
                                  Von außen erreichbare Dienste (
                                  {registeredTurnServices.length}):
                                </div>
                                {registeredTurnServices.map((reg) => {
                                  const liveSvc =
                                    (
                                      activeProject?.registered_services || []
                                    ).find(
                                      (s) =>
                                        s.service_id === reg.service_id ||
                                        s.port === reg.port
                                    ) || reg;
                                  const eps =
                                    liveSvc.endpoints || reg.endpoints || [];
                                  const cat = liveSvc.category || "backend";
                                  const catBadge =
                                    cat === "webui"
                                      ? "🌐 WebUI"
                                      : cat === "database"
                                      ? "🗄️ DB"
                                      : "⚡ API";

                                  return (
                                    <div
                                      key={reg.service_id}
                                      className="rounded-xl border border-netbird-500/40 bg-nb-gray-940 p-2.5 font-sans text-xs space-y-2"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[10px] text-netbird shrink-0">
                                            {catBadge}
                                          </span>
                                          <span className="truncate font-semibold text-white">
                                            {liveSvc.name || reg.service_id}
                                          </span>
                                          <span className="font-mono text-[10px] text-nb-gray-400 shrink-0">
                                            :{reg.port}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedServiceId(
                                              reg.service_id
                                            );
                                            setPreviewPort(reg.port);
                                            setActiveNav("reverse-proxy");
                                          }}
                                          className="shrink-0 rounded bg-netbird px-2 py-0.5 text-[10px] font-medium text-white hover:bg-netbird-500"
                                        >
                                          Öffnen →
                                        </button>
                                      </div>

                                      {eps.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {eps.map((ep) => (
                                            <button
                                              key={ep.id}
                                              type="button"
                                              onClick={() => {
                                                setSelectedServiceId(
                                                  reg.service_id
                                                );
                                                setPreviewPort(reg.port);
                                                setServiceActionMethod(
                                                  ep.method
                                                );
                                                setServiceActionPath(ep.path);
                                                setServiceActionPayload(
                                                  ep.sample_payload || ""
                                                );
                                                setActiveNav("reverse-proxy");
                                                handleInvokeServiceAction({
                                                  nodeId: reg.node_id,
                                                  port: reg.port,
                                                  method: ep.method,
                                                  path: ep.path,
                                                  payload:
                                                    ep.sample_payload || "",
                                                });
                                              }}
                                              className="rounded border border-nb-gray-800 bg-nb-gray-920 px-2 py-0.5 font-mono text-[10px] text-nb-gray-200 hover:border-netbird hover:text-white"
                                            >
                                              <strong className="text-netbird">
                                                {ep.method}
                                              </strong>{" "}
                                              {ep.label}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* 2. Interactive Categorized Tool Pipeline Bar */}
                            <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-950/90 p-2 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <div className="flex flex-wrap items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTurnToolCategoryFilter((prev) => ({
                                        ...prev,
                                        [idx]: "all",
                                      }));
                                      setExpandedTurnTools((prev) => ({
                                        ...prev,
                                        [idx]: !prev[idx],
                                      }));
                                    }}
                                    className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-medium transition ${
                                      turnToolsExpanded && activeCat === "all"
                                        ? "bg-netbird text-white"
                                        : "bg-nb-gray-900 text-nb-gray-300 hover:text-white"
                                    }`}
                                  >
                                    🛠️ Alle ({msg.toolResults.length})
                                  </button>
                                  {counts.search > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTurnToolCategoryFilter((prev) => ({
                                          ...prev,
                                          [idx]: "search",
                                        }));
                                        setExpandedTurnTools((prev) => ({
                                          ...prev,
                                          [idx]: true,
                                        }));
                                      }}
                                      className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${
                                        turnToolsExpanded &&
                                        activeCat === "search"
                                          ? "border-amber-500/50 bg-amber-950/70 text-amber-200"
                                          : "border-nb-gray-800 bg-nb-gray-930 text-amber-300/90 hover:border-amber-500/40"
                                      }`}
                                    >
                                      🔍 Deep-Search ({counts.search})
                                    </button>
                                  )}
                                  {counts.shell > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTurnToolCategoryFilter((prev) => ({
                                          ...prev,
                                          [idx]: "shell",
                                        }));
                                        setExpandedTurnTools((prev) => ({
                                          ...prev,
                                          [idx]: true,
                                        }));
                                      }}
                                      className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${
                                        turnToolsExpanded &&
                                        activeCat === "shell"
                                          ? "border-emerald-500/50 bg-emerald-950/70 text-emerald-200"
                                          : "border-nb-gray-800 bg-nb-gray-930 text-emerald-300/90 hover:border-emerald-500/40"
                                      }`}
                                    >
                                      🐚 Terminal ({counts.shell})
                                    </button>
                                  )}
                                  {counts.fs > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTurnToolCategoryFilter((prev) => ({
                                          ...prev,
                                          [idx]: "fs",
                                        }));
                                        setExpandedTurnTools((prev) => ({
                                          ...prev,
                                          [idx]: true,
                                        }));
                                      }}
                                      className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${
                                        turnToolsExpanded && activeCat === "fs"
                                          ? "border-sky-500/50 bg-sky-950/70 text-sky-200"
                                          : "border-nb-gray-800 bg-nb-gray-930 text-sky-300/90 hover:border-sky-500/40"
                                      }`}
                                    >
                                      📁 Dateien ({counts.fs})
                                    </button>
                                  )}
                                  {counts.core > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setTurnToolCategoryFilter((prev) => ({
                                          ...prev,
                                          [idx]: "core",
                                        }));
                                        setExpandedTurnTools((prev) => ({
                                          ...prev,
                                          [idx]: true,
                                        }));
                                      }}
                                      className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${
                                        turnToolsExpanded &&
                                        activeCat === "core"
                                          ? "border-netbird-500/50 bg-netbird-950/70 text-netbird"
                                          : "border-nb-gray-800 bg-nb-gray-930 text-netbird/90 hover:border-netbird-500/40"
                                      }`}
                                    >
                                      🧠 Core ({counts.core})
                                    </button>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedTurnTools((prev) => ({
                                      ...prev,
                                      [idx]: !prev[idx],
                                    }))
                                  }
                                  className="font-mono text-[10px] text-netbird hover:underline"
                                >
                                  {turnToolsExpanded
                                    ? "Einklappen ▲"
                                    : "Schritte öffnen ▼"}
                                </button>
                              </div>

                              {turnToolsExpanded && (
                                <div className="space-y-1.5 border-t border-nb-gray-800/70 pt-2">
                                  {filteredTools.map(({ tr, origIdx }) => {
                                    const key = `${idx}-${origIdx}`;
                                    const open = expandedTools[key];
                                    const cat = categorizeTool(tr.tool_name);
                                    const catColor =
                                      cat === "search"
                                        ? "text-amber-300"
                                        : cat === "shell"
                                        ? "text-emerald-300"
                                        : cat === "fs"
                                        ? "text-sky-300"
                                        : "text-netbird";

                                    return (
                                      <div
                                        key={key}
                                        className="rounded-lg border border-nb-gray-800/90 bg-nb-gray-940/90 px-2.5 py-1.5 font-mono text-[11px] transition hover:border-nb-gray-700"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setExpandedTools((prev) => ({
                                                ...prev,
                                                [key]: !prev[key],
                                              }))
                                            }
                                            className="flex flex-1 items-center justify-between text-left min-w-0"
                                          >
                                            <span className="flex items-center gap-1.5 min-w-0">
                                              <span className="rounded bg-nb-gray-900 px-1.5 py-0.2 text-[9px] text-nb-gray-400">
                                                #{origIdx + 1}
                                              </span>
                                              <span
                                                className={`truncate font-semibold ${catColor}`}
                                              >
                                                {tr.tool_name}
                                              </span>
                                              {tr.cached && (
                                                <span className="rounded bg-emerald-950 px-1.5 py-0.2 text-[9px] text-emerald-300 border border-emerald-500/30">
                                                  CACHED
                                                </span>
                                              )}
                                            </span>
                                            <span className="text-[10px] uppercase text-emerald-400 shrink-0 ml-2">
                                              {tr.status} {open ? "▲" : "▼"}
                                            </span>
                                          </button>

                                          {tr.rollback_snapshot_id && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleRollbackSnapshot(
                                                  tr.rollback_snapshot_id!,
                                                  tr.rollback_path
                                                )
                                              }
                                              title={`Rollback ${
                                                tr.rollback_path || "file"
                                              } to pre-write snapshot`}
                                              className="flex items-center gap-1 rounded border border-amber-500/40 bg-amber-950/50 px-1.5 py-0.5 text-[9px] text-amber-300 hover:bg-amber-900/60 hover:text-white"
                                            >
                                              <RotateCcw className="h-2.5 w-2.5" />
                                              <span>Rollback</span>
                                            </button>
                                          )}
                                        </div>
                                        {open && (
                                          <pre className="mt-1.5 max-h-44 overflow-auto rounded border border-nb-gray-800 bg-nb-gray-960 p-2 text-[10px] text-nb-gray-300">
                                            {JSON.stringify(tr.output, null, 2)}
                                          </pre>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Per-Turn Cache Savings Footer */}
                      {msg.cacheMetrics && (
                        <div className="mt-2 flex items-center justify-between border-t border-nb-gray-800/60 pt-1.5 font-mono text-[10px] text-nb-gray-400">
                          <span className="flex items-center gap-1 text-emerald-400">
                            <Zap className="h-2.5 w-2.5" />
                            <span>
                              {msg.cacheMetrics.cached_tokens} cached /{" "}
                              {msg.cacheMetrics.prompt_tokens} prompt tok
                            </span>
                          </span>
                          {msg.cacheMetrics.tool_cache_hits > 0 && (
                            <span className="text-sky-400">
                              {msg.cacheMetrics.tool_cache_hits} FS cache hit(s)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Live SSE ReAct Steps + Progressive Thinking & Token Stream */}
                {chatBusy && (
                  <div className="rounded-2xl border border-netbird-500/40 bg-gradient-to-b from-nb-gray-930 to-nb-gray-940 p-3.5 text-xs space-y-2.5 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-netbird font-semibold">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>
                          Senior DevOps KI-Analyse läuft ({liveSteps.length} Schritte · {chatElapsedSec}s)...
                        </span>
                      </div>
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2 py-0.5 font-mono text-[9px] text-emerald-300">
                        ⚡ Live Stream
                      </span>
                    </div>

                    {liveSteps.length > 0 && (
                      <div className="grid grid-cols-1 gap-1.5">
                        {liveSteps.map((s, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-nb-gray-800/80 bg-nb-gray-950/75 px-2.5 py-1.5 font-mono text-[11px] text-nb-gray-300 space-y-0.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex items-center gap-1.5">
                                <span className="rounded bg-nb-gray-900 px-1.5 py-0.2 text-[9px] text-netbird">
                                  #{s.step}
                                </span>
                                <span className="text-white font-semibold">
                                  {s.tool_name}
                                </span>
                                {s.cached && (
                                  <span className="rounded bg-emerald-950 px-1 text-[9px] text-emerald-300">
                                    CACHE HIT
                                  </span>
                                )}
                              </span>
                              <span className="text-netbird uppercase text-[10px]">
                                {s.status}
                              </span>
                            </div>
                            {s.detail && (
                              <div className="truncate text-[10px] text-nb-gray-400">
                                {s.detail}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {streamingThinkingText && (
                      <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-2.5 font-mono text-[10px] text-nb-gray-400 whitespace-pre-wrap">
                        <div className="mb-1 flex items-center gap-1 text-netbird">
                          <Brain className="h-3 w-3" />
                          <span>Thinking...</span>
                        </div>
                        {streamingThinkingText}
                      </div>
                    )}

                    {streamingReplyText && (
                      <div className="border-t border-nb-gray-800 pt-2.5 text-nb-gray-100 min-w-0 break-words">
                        <RichMarkdownDocument
                          markdown={streamingReplyText}
                          variant="chat"
                          onOpenPort={(port) => {
                            setPreviewPort(port);
                            setActiveNav("reverse-proxy");
                          }}
                          onOpenFile={(filePath) => {
                            setActiveNav("workspace");
                            openRemoteFile(filePath);
                          }}
                          onOpenBrainDoc={(doc) => {
                            setBrainDocTab(doc);
                            setActiveNav("brain-vault");
                          }}
                          onRunCommand={(cmd) => {
                            setTerminalDrawerOpen(true);
                            navigator.clipboard.writeText(cmd);
                            setStatusToast(
                              "Befehl kopiert & Live-Terminal geöffnet"
                            );
                            setTimeout(() => setStatusToast(""), 3000);
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Multimodal Prompt Input Box with Selected Skill Card, Thumbnail Strip, @-Mentions & Drag-and-Drop */}
              <form
                ref={chatComposerRef}
                onSubmit={handleSendPrompt}
                className="relative border-t border-nb-gray-900 bg-nb-gray-950 p-3 space-y-2"
              >
                {/* Selected Skill Card (Appears when CheckSystem, CheckOpsec, CheckUpdates, SkillSearch, or DeepForensics is clicked) */}
                {selectedChatSkill && (
                  <div
                    className={`flex items-start justify-between gap-2.5 rounded-lg border p-2.5 text-xs ${
                      selectedChatSkill === "CheckSystem"
                        ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-100"
                        : selectedChatSkill === "CheckOpsec"
                        ? "border-sky-500/40 bg-sky-950/30 text-sky-100"
                        : selectedChatSkill === "CheckUpdates"
                        ? "border-sky-500/40 bg-sky-950/30 text-sky-100"
                        : selectedChatSkill === "DeepForensics"
                        ? "border-amber-500/40 bg-amber-950/30 text-amber-100"
                        : "border-amber-500/40 bg-amber-950/30 text-amber-100"
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 font-semibold text-white">
                        {selectedChatSkill === "CheckSystem" ? (
                          <Activity className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        ) : selectedChatSkill === "CheckOpsec" ? (
                          <Shield className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                        ) : selectedChatSkill === "CheckUpdates" ? (
                          <RefreshCw className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                        ) : selectedChatSkill === "DeepForensics" ? (
                          <Cpu className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        ) : (
                          <Search className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                        )}
                        <span>Skill ausgewählt: {selectedChatSkill}</span>
                      </div>
                      <p className="text-[11px] text-nb-gray-300 leading-snug">
                        {selectedChatSkill === "CheckSystem"
                          ? "Mehrstufiger Senior-DevOps-Tiefenscan: Prüft Host, Ports, Quellcode, SQLite-Integrität, Logs & Brain-Sync mit erweiterten Suchfunktionen."
                          : selectedChatSkill === "CheckOpsec"
                          ? "Mehrstufiger DevSecOps-Tiefenaudit: Prüft offene Sockets, SSH, Firewall, Sysctl, Dateirechte, Code-Schwachstellen, Secrets & HTTP-Header."
                          : selectedChatSkill === "CheckUpdates"
                          ? "Muscle & Backend Update-Prüfung: Prüft Axon-Daemons, Workspace-Backends, Runtimes & OS-Pakete auf Updates und fragt danach nach Ausführung + Funktionstest."
                          : selectedChatSkill === "DeepForensics"
                          ? "Tiefgreifende DevOps-Forensik: Durchsucht alle Logs, Prozesse, Datenbanken und Quellcode-Dateien nach versteckten Fehlern & Root-Causes."
                          : "Erweiterte System-, Code-, Datenbank-, Log- & UI-Tiefensuche: Findet jede Funktion, Einstellung, Datei oder Zeile im gesamten System."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedChatSkill(null)}
                      className="rounded p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white shrink-0"
                      title="Skill abwählen"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* AI Skills Selector Popover */}
                {skillMenuOpen && (
                  <div className="absolute bottom-full left-3 right-3 mb-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-930 p-2 shadow-2xl z-30 space-y-1">
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-nb-gray-400">
                        Senior DevOps AI Skills &amp; Deep-Search
                      </span>
                      <button
                        type="button"
                        onClick={() => setSkillMenuOpen(false)}
                        className="rounded p-0.5 text-nb-gray-400 hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChatSkill("CheckUpdates");
                        setSkillMenuOpen(false);
                        setTimeout(() => chatInputRef.current?.focus(), 50);
                      }}
                      className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-nb-gray-900 transition"
                    >
                      <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-semibold text-xs text-sky-300">
                          <span>CheckUpdates</span>
                          <span className="rounded border border-sky-500/30 bg-sky-950/40 px-1.5 py-0.2 font-mono text-[9px] text-sky-300">
                            Muscle &amp; Backend Updates + Test
                          </span>
                        </div>
                        <p className="text-[11px] text-nb-gray-400 leading-snug">
                          Prüft alle Muscle-Server, Axon-Binaries, Runtimes, OS-Pakete &amp; Backends auf Updates, fragt nach Freigabe und führt danach einen Funktionstest durch.
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChatSkill("CheckSystem");
                        setSkillMenuOpen(false);
                        setTimeout(() => chatInputRef.current?.focus(), 50);
                      }}
                      className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-nb-gray-900 transition"
                    >
                      <Activity className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-semibold text-xs text-emerald-300">
                          <span>CheckSystem</span>
                          <span className="rounded border border-emerald-500/30 bg-emerald-950/40 px-1.5 py-0.2 font-mono text-[9px] text-emerald-300">
                            6-Phasen SRE Audit
                          </span>
                        </div>
                        <p className="text-[11px] text-nb-gray-400 leading-snug">
                          Tiefenscan wie durch einen Senior DevOps Engineer: Host, Ports, Quellcode-Grep, SQLite-Integrität, Logs &amp; Brain-Drift.
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChatSkill("CheckOpsec");
                        setSkillMenuOpen(false);
                        setTimeout(() => chatInputRef.current?.focus(), 50);
                      }}
                      className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-nb-gray-900 transition"
                    >
                      <Shield className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-semibold text-xs text-sky-300">
                          <span>CheckOpsec</span>
                          <span className="rounded border border-sky-500/30 bg-sky-950/40 px-1.5 py-0.2 font-mono text-[9px] text-sky-300">
                            DevSecOps Forensik
                          </span>
                        </div>
                        <p className="text-[11px] text-nb-gray-400 leading-snug">
                          Mehrstufiger Security-Audit: Socket-Bindings, SSH, Firewall, Sysctl, Dateirechte, Secret-Leak-Scan &amp; HTTP-Header.
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChatSkill("DeepForensics");
                        setSkillMenuOpen(false);
                        setTimeout(() => chatInputRef.current?.focus(), 50);
                      }}
                      className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-nb-gray-900 transition"
                    >
                      <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-semibold text-xs text-amber-300">
                          <span>DeepForensics</span>
                          <span className="rounded border border-amber-500/30 bg-amber-950/40 px-1.5 py-0.2 font-mono text-[9px] text-amber-300">
                            Root-Cause &amp; Logs
                          </span>
                        </div>
                        <p className="text-[11px] text-nb-gray-400 leading-snug">
                          Durchsucht sämtliche Logs, Journalctl, Prozesse, Datenbanken &amp; Code-Dateien nach Fehlern, Engpässen &amp; Ursachen.
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChatSkill("SkillSearch");
                        setSkillMenuOpen(false);
                        setTimeout(() => chatInputRef.current?.focus(), 50);
                      }}
                      className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-nb-gray-900 transition"
                    >
                      <Search className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-semibold text-xs text-amber-300">
                          <span>SkillSearch</span>
                          <span className="rounded border border-amber-500/30 bg-amber-950/40 px-1.5 py-0.2 font-mono text-[9px] text-amber-300">
                            Code-, System- &amp; UI-Suche
                          </span>
                        </div>
                        <p className="text-[11px] text-nb-gray-400 leading-snug">
                          Durchsucht UI-Sitemap, Server-Dateien, Code-Zeilen, Ports, DBs &amp; Brain Vault nach jeder gesuchten Funktion.
                        </p>
                      </div>
                    </button>
                  </div>
                )}

                {/* @-Context Mention Autocomplete Popover */}
                {mentionMenuOpen && mentionCandidates.length > 0 && (
                  <div className="absolute bottom-full left-3 right-3 mb-1.5 max-h-52 overflow-y-auto rounded-lg border border-nb-gray-800 bg-nb-gray-930 p-1.5 shadow-2xl z-30">
                    <div className="flex items-center justify-between px-2 py-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-nb-gray-400">
                        Insert @Context Mention
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMentionMenuOpen(false);
                          setMentionFilter("");
                          setChatInput((prev) => prev.replace(/(?:^|\s)@$/, ""));
                        }}
                        className="rounded p-0.5 text-nb-gray-400 hover:text-white"
                        title="Schließen"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    {mentionCandidates.map((cand) => (
                      <button
                        key={cand.token}
                        type="button"
                        onClick={() => insertMentionToken(cand.token)}
                        className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white"
                      >
                        <div>
                          <span className="font-mono font-semibold text-netbird">
                            {cand.token}
                          </span>
                          <span className="ml-2 text-[11px] text-nb-gray-400">
                            {cand.label}
                          </span>
                        </div>
                        <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[9px] text-nb-gray-400">
                          {cand.category}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Pending Drag & Drop / Pasted Image Attachment Thumbnails */}
                {chatAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pb-1">
                    {chatAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="relative flex items-center gap-2 rounded-md border border-netbird-500/40 bg-nb-gray-930 p-1.5 pr-6 text-[11px] text-nb-gray-200"
                      >
                        {att.mime_type?.startsWith("image/") ? (
                          <img
                            src={att.data_url}
                            alt={att.name}
                            className="h-9 w-9 rounded object-cover"
                          />
                        ) : (
                          <FileText className="h-5 w-5 text-netbird" />
                        )}
                        <div className="max-w-[110px] truncate font-mono text-[10px]">
                          {att.name}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setChatAttachments((prev) =>
                              prev.filter((x) => x.id !== att.id)
                            )
                          }
                          className="absolute right-1 top-1 rounded bg-nb-gray-900 p-0.5 text-nb-gray-400 hover:text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.log,.txt,.json,.md,.yml,.yaml"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      processDroppedOrSelectedFiles(e.target.files);
                      e.target.value = "";
                    }
                  }}
                />

                <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-920 p-2 focus-within:border-netbird transition">
                  <textarea
                    ref={chatInputRef}
                    rows={2}
                    value={chatInput}
                    onClick={() => {
                      setSkillMenuOpen(false);
                      if (!/(?:^|\s)@([a-zA-Z0-9._:-]*)$/.test(chatInput)) {
                        setMentionMenuOpen(false);
                      }
                    }}
                    onChange={(e) => handleChatInputChange(e.target.value)}
                    onPaste={handleChatPaste}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendPrompt();
                      }
                    }}
                    placeholder={
                      selectedChatSkill === "SkillSearch"
                        ? "Wonach suchst du? (z.B. Firewall, SQL, Ports)..."
                        : selectedChatSkill
                        ? `Optionaler Fokus für ${selectedChatSkill}...`
                        : "Frage Synapse AI (@ Kontext, Bilder)..."
                    }
                    className="w-full resize-none bg-transparent px-1.5 py-1 text-xs leading-relaxed text-white placeholder:text-nb-gray-400 focus:outline-none"
                  />

                  <div className="mt-1.5 flex items-center justify-between border-t border-nb-gray-800/80 pt-1.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        title="Attach image, screenshot, diagram, or log file (or Drag & Drop / Ctrl+V)"
                        className="flex h-7 items-center gap-1 rounded-md border border-nb-gray-800 bg-nb-gray-940 px-2 text-[11px] text-nb-gray-300 hover:border-netbird hover:text-white transition"
                      >
                        <Paperclip className="h-3 w-3" />
                        <span>Anhang</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (mentionMenuOpen) {
                            setMentionMenuOpen(false);
                            setMentionFilter("");
                            setChatInput((prev) => prev.replace(/(?:^|\s)@$/, ""));
                          } else {
                            setSkillMenuOpen(false);
                            setMentionFilter("");
                            setMentionMenuOpen(true);
                          }
                        }}
                        title="Mention a Peer, Service, or Brain Vault Doc (@)"
                        className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] transition ${
                          mentionMenuOpen
                            ? "border-netbird bg-netbird/15 text-netbird"
                            : "border-nb-gray-800 bg-nb-gray-940 text-nb-gray-300 hover:border-netbird hover:text-white"
                        }`}
                      >
                        <AtSign className="h-3 w-3" />
                        <span>Kontext</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setMentionMenuOpen(false);
                          setMentionFilter("");
                          setChatInput((prev) => prev.replace(/(?:^|\s)@$/, ""));
                          setSkillMenuOpen((v) => !v);
                        }}
                        title="AI Skills auswählen (CheckSystem, CheckOpsec, SkillSearch)"
                        className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition ${
                          skillMenuOpen || selectedChatSkill
                            ? "border-netbird bg-netbird/15 text-netbird"
                            : "border-nb-gray-800 bg-nb-gray-940 text-nb-gray-300 hover:border-netbird hover:text-white"
                        }`}
                      >
                        <Sparkles className="h-3 w-3 shrink-0" />
                        <span>Skills</span>
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={chatBusy}
                      className="flex h-7 items-center gap-1.5 rounded-md bg-netbird px-3 text-[11px] font-semibold text-white hover:bg-netbird-500 disabled:opacity-40 transition shadow-sm"
                    >
                      <Send className="h-3 w-3" />
                      <span>Senden</span>
                    </button>
                  </div>
                </div>
              </form>
            </aside>
          )}
        </div>

        {/* COLLAPSIBLE & MOUSE-RESIZABLE BOTTOM LIVE PTY TERMINAL BAR (`xterm.js`) */}
        <div className="relative shrink-0 border-t border-nb-gray-900 bg-nb-gray-950">
          {terminalDrawerOpen && (
            <div
              title="Mit der Maus ziehen, um die Höhe des Terminals anzupassen"
              onMouseDown={(e) => {
                e.preventDefault();
                const startY = e.clientY;
                const startH = terminalHeight;
                const onMove = (ev: MouseEvent) => {
                  const nextH = startH - (ev.clientY - startY);
                  setTerminalHeight(Math.max(150, Math.min(540, nextH)));
                };
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
              className="absolute top-0 left-0 right-0 h-1.5 -mt-0.5 cursor-row-resize hover:bg-netbird/60 transition-colors z-30"
            />
          )}
          <div className="flex h-9 items-center justify-between px-4 text-xs">
            <button
              onClick={() => setTerminalDrawerOpen((v) => !v)}
              className="flex items-center gap-2 font-mono text-[11px] text-nb-gray-300 hover:text-white"
            >
              <TerminalIcon className="h-3.5 w-3.5 text-netbird" />
              <span>Live Peer PTY Shell ({primaryNode || "offline"})</span>
            </button>

            <div className="flex items-center gap-4 font-mono text-[11px] text-nb-gray-400">
              {activeHeartbeat && (
                <span>
                  CPU {activeHeartbeat.cpu_percent.toFixed(1)}% · RAM{" "}
                  {activeHeartbeat.ram_percent.toFixed(1)}%
                </span>
              )}
              <button
                onClick={() => setTerminalDrawerOpen((v) => !v)}
                className="flex items-center gap-1 text-nb-gray-300 hover:text-white"
              >
                <span>{terminalDrawerOpen ? "Einklappen" : "Ausklappen"}</span>
                {terminalDrawerOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronUp className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {terminalDrawerOpen && (
            <div
              style={{ height: `${terminalHeight}px` }}
              className="border-t border-nb-gray-900 bg-nb-gray-960"
            >
              {primaryNode ? (
                <XTermTerminal
                  gatewayUrl={gatewayUrl}
                  projectId={activeProject?.project_id || "synapse-cloud-demo"}
                  nodeId={primaryNode}
                  sessionId={`default-${
                    activeProject?.project_id || "synapse-cloud-demo"
                  }`}
                />
              ) : (
                <div className="p-4 font-mono text-xs text-nb-gray-400">
                  Kein Muscle-Server verbunden. Klicke auf „+ Server“, um einen Linux-Knoten anzubinden.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ControlCenterModals
        addPeerModalOpen={addPeerModalOpen}
        setAddPeerModalOpen={setAddPeerModalOpen}
        gatewayUrl={gatewayUrl}
        setGatewayUrl={setGatewayUrl}
        joinTier={joinTier}
        setJoinTier={setJoinTier}
        joinNodeName={joinNodeName}
        setJoinNodeName={setJoinNodeName}
        handleGenerateJoinToken={handleGenerateJoinToken}
        oneLineInstallerCmd={oneLineInstallerCmd}
        copiedJoinCmd={copiedJoinCmd}
        setCopiedJoinCmd={setCopiedJoinCmd}
        rebindCliCmd={rebindCliCmd}
        copiedRebindCmd={copiedRebindCmd}
        setCopiedRebindCmd={setCopiedRebindCmd}
        aiEndpointModalOpen={aiEndpointModalOpen}
        setAiEndpointModalOpen={setAiEndpointModalOpen}
        handleSaveAiEndpoint={handleSaveAiEndpoint}
        provider={provider}
        setProvider={setProvider}
        baseUrl={baseUrl}
        setBaseUrl={setBaseUrl}
        modelName={modelName}
        setModelName={setModelName}
        handleSyncModels={handleSyncModels}
        syncingModels={syncingModels}
        modelSyncStatus={modelSyncStatus}
        discoveredModels={discoveredModels}
        apiKeySecretName={apiKeySecretName}
        apiKeyInput={apiKeyInput}
        setApiKeyInput={setApiKeyInput}
        secretKeys={secretKeys}
        enablePromptCaching={enablePromptCaching}
        setEnablePromptCaching={setEnablePromptCaching}
        enableAutoWatchdog={enableAutoWatchdog}
        setEnableAutoWatchdog={setEnableAutoWatchdog}
        newProjectModal={newProjectModal}
        setNewProjectModal={setNewProjectModal}
        newProjName={newProjName}
        setNewProjName={setNewProjName}
        loadWorkspace={loadWorkspace}
        commandPaletteOpen={commandPaletteOpen}
        setCommandPaletteOpen={setCommandPaletteOpen}
        commandQuery={commandQuery}
        setCommandQuery={setCommandQuery}
        sidebarItems={sidebarItems}
        setActiveNav={setActiveNav}
      />
    </div>
  );
}
