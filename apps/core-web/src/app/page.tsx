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
import ReverseProxyView from "@/components/views/ReverseProxyView";
import PeersView from "@/components/views/PeersView";
import SettingsView from "@/components/views/SettingsView";
import CopilotDrawer from "@/components/drawers/CopilotDrawer";
import BottomPtyDrawer from "@/components/drawers/BottomPtyDrawer";
import {
  BrainVaultView,
  WorkspaceExplorerView,
} from "@/components/views/BrainVaultAndWorkspaceViews";
import ControlCenterModals from "@/components/modals/ControlCenterModals";
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
        setProjects(data.projects || []);
        setActiveProject(data.active_project);
        if (syncAiSettings || !isEditingMarkdownRef.current) {
          setArchitectureMd(data.architecture_md || "");
          setMemoryMd(data.memory_md || "");
        }
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
      } finally {
        if (!syncAiSettings) {
          pollInFlightRef.current = false;
        }
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
              <PeersView
                activeProject={activeProject}
                gatewayNodes={gatewayNodes}
                filteredPeers={filteredPeers}
                blueprints={blueprints}
                peersSubTab={peersSubTab}
                setPeersSubTab={setPeersSubTab}
                peerSearch={peerSearch}
                setPeerSearch={setPeerSearch}
                peerTierFilter={peerTierFilter}
                setPeerTierFilter={setPeerTierFilter}
                expandedPeerRows={expandedPeerRows}
                setExpandedPeerRows={setExpandedPeerRows}
                systemUpdateBusy={systemUpdateBusy}
                onRunSystemUpdate={(action, targetNodeId) => {
                  handleRunSystemUpdate(action, targetNodeId);
                }}
                onOpenAddPeerModal={() => {
                  setAddPeerModalOpen(true);
                  if (!issuedToken) handleGenerateJoinToken();
                }}
                onSelectNodeAndNavigate={(nodeId, nav) => {
                  setSelectedNodeId(nodeId);
                  setActiveNav(nav);
                }}
                onOpenTerminalForNode={(nodeId) => {
                  setSelectedNodeId(nodeId);
                  setTerminalDrawerOpen(true);
                }}
                onAssignNode={handleAssignNode}
                onUnassignNode={handleUnassignNode}
                onOpenServiceInProxy={(serviceId, port) => {
                  setSelectedServiceId(serviceId);
                  setPreviewPort(port);
                  setActiveNav("reverse-proxy");
                }}
                meshSourceNode={meshSourceNode}
                setMeshSourceNode={setMeshSourceNode}
                meshTargetNode={meshTargetNode}
                setMeshTargetNode={setMeshTargetNode}
                meshTargetPort={meshTargetPort}
                setMeshTargetPort={setMeshTargetPort}
                meshAliasEnv={meshAliasEnv}
                setMeshAliasEnv={setMeshAliasEnv}
                onAddMeshLink={handleAddMeshLink}
                onRemoveMeshLink={handleRemoveMeshLink}
                onRunPromptInCopilot={(prompt) => {
                  setCopilotDrawerOpen(true);
                  runStreamingPrompt(prompt);
                }}
                playbookName={playbookName}
                setPlaybookName={setPlaybookName}
                playbookCron={playbookCron}
                setPlaybookCron={setPlaybookCron}
                playbookPrompt={playbookPrompt}
                setPlaybookPrompt={setPlaybookPrompt}
                onAddPlaybook={handleAddPlaybook}
                onTogglePlaybook={handleTogglePlaybook}
                onDeletePlaybook={handleDeletePlaybook}
              />
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
            {activeNav === "reverse-proxy" && (
              <ReverseProxyView
                activeProject={activeProject}
                primaryNode={primaryNode}
                gatewayUrl={gatewayUrl}
                selectedServiceId={selectedServiceId}
                setSelectedServiceId={setSelectedServiceId}
                previewPort={previewPort}
                setPreviewPort={setPreviewPort}
                previewSubPath={previewSubPath}
                setPreviewSubPath={setPreviewSubPath}
                previewReloadNonce={previewReloadNonce}
                setPreviewReloadNonce={setPreviewReloadNonce}
                serviceWorkspaceTab={serviceWorkspaceTab}
                setServiceWorkspaceTab={setServiceWorkspaceTab}
                selectedEndpointId={selectedEndpointId}
                setSelectedEndpointId={setSelectedEndpointId}
                serviceActionMethod={serviceActionMethod}
                setServiceActionMethod={setServiceActionMethod}
                serviceActionPath={serviceActionPath}
                setServiceActionPath={setServiceActionPath}
                serviceActionPayload={serviceActionPayload}
                setServiceActionPayload={setServiceActionPayload}
                serviceActionBusy={serviceActionBusy}
                serviceActionResult={serviceActionResult}
                handleInvokeServiceAction={handleInvokeServiceAction}
              />
            )}

            {/* ═══════════════════════════════════════════════════════════════
                VIEW 5: FOCUSED BRAIN VAULT DOCUMENTS (`brain-vault`)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "brain-vault" && (
              <BrainVaultView
                projectId={activeProject?.project_id || "synapse-cloud-demo"}
                brainDocTab={brainDocTab}
                setBrainDocTab={setBrainDocTab}
                isEditingMarkdown={isEditingMarkdown}
                setIsEditingMarkdown={setIsEditingMarkdown}
                architectureMd={architectureMd}
                setArchitectureMd={setArchitectureMd}
                memoryMd={memoryMd}
                setMemoryMd={setMemoryMd}
                handleSaveBrainDoc={handleSaveBrainDoc}
              />
            )}

            {/* ═══════════════════════════════════════════════════════════════
                VIEW 6: REMOTE WORKSPACE EXPLORER (`workspace`)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "workspace" && (
              <WorkspaceExplorerView
                showDiffDrawer={showDiffDrawer}
                setShowDiffDrawer={setShowDiffDrawer}
                handleSaveRemoteFile={handleSaveRemoteFile}
                workspaceSidebarWidth={workspaceSidebarWidth}
                setWorkspaceSidebarWidth={setWorkspaceSidebarWidth}
                remoteDir={remoteDir}
                fetchRemoteDir={fetchRemoteDir}
                remoteEntries={remoteEntries}
                activeFilePath={activeFilePath}
                openRemoteFile={openRemoteFile}
                handleDeleteRemoteFile={handleDeleteRemoteFile}
                handleCreateRemoteFile={handleCreateRemoteFile}
                newFileName={newFileName}
                setNewFileName={setNewFileName}
                diffPatchText={diffPatchText}
                setDiffPatchText={setDiffPatchText}
                handleApplyUnifiedDiff={handleApplyUnifiedDiff}
                editorContent={editorContent}
                setEditorContent={setEditorContent}
              />
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
              <SettingsView
                activeProject={activeProject}
                primaryNode={primaryNode}
                settingsTab={settingsTab}
                setSettingsTab={setSettingsTab}
                secretKeys={secretKeys}
                debugModeEnabled={debugModeEnabled}
                fetchDebugSnapshot={fetchDebugSnapshot}
                fetchSystemUpdateStatus={fetchSystemUpdateStatus}
                systemUpdateBusy={systemUpdateBusy}
                systemUpdateActionLabel={systemUpdateActionLabel}
                systemUpdateStatus={systemUpdateStatus}
                systemUpdateSteps={systemUpdateSteps}
                setSystemUpdateSteps={setSystemUpdateSteps}
                showReleaseNotes={showReleaseNotes}
                setShowReleaseNotes={setShowReleaseNotes}
                handleRunSystemUpdate={handleRunSystemUpdate}
                gatewayUrl={gatewayUrl}
                setGatewayUrl={setGatewayUrl}
                joinNodeName={joinNodeName}
                setJoinNodeName={setJoinNodeName}
                joinTier={joinTier}
                setJoinTier={setJoinTier}
                handleGenerateJoinToken={handleGenerateJoinToken}
                issuedToken={issuedToken}
                oneLineInstallerCmd={oneLineInstallerCmd}
                copiedJoinCmd={copiedJoinCmd}
                setCopiedJoinCmd={setCopiedJoinCmd}
                rebindCliCmd={rebindCliCmd}
                copiedRebindCmd={copiedRebindCmd}
                setCopiedRebindCmd={setCopiedRebindCmd}
                newSecretKey={newSecretKey}
                setNewSecretKey={setNewSecretKey}
                newSecretVal={newSecretVal}
                setNewSecretVal={setNewSecretVal}
                handleAddSecret={handleAddSecret}
                handleDeleteSecret={handleDeleteSecret}
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
                enablePromptCaching={enablePromptCaching}
                setEnablePromptCaching={setEnablePromptCaching}
                enableAutoWatchdog={enableAutoWatchdog}
                setEnableAutoWatchdog={setEnableAutoWatchdog}
                handleSaveAiEndpoint={handleSaveAiEndpoint}
                mcpKeyName={mcpKeyName}
                setMcpKeyName={setMcpKeyName}
                mcpKeyScopeMode={mcpKeyScopeMode}
                setMcpKeyScopeMode={setMcpKeyScopeMode}
                handleCreateMcpKey={handleCreateMcpKey}
                issuedMcpToken={issuedMcpToken}
                copiedMcpToken={copiedMcpToken}
                setCopiedMcpToken={setCopiedMcpToken}
                showMcpConfigExamples={showMcpConfigExamples}
                setShowMcpConfigExamples={setShowMcpConfigExamples}
                copiedMcpConfig={copiedMcpConfig}
                setCopiedMcpConfig={setCopiedMcpConfig}
                handleRevokeMcpKey={handleRevokeMcpKey}
                handleTestMcpEndpoint={handleTestMcpEndpoint}
                mcpTestOutput={mcpTestOutput}
                handleToggleDebugMode={handleToggleDebugMode}
                handleRunSelfTest={handleRunSelfTest}
                runningSelfTest={runningSelfTest}
                selfTestChecks={selfTestChecks}
                debugSnapshot={debugSnapshot}
                settingsAlertConfig={settingsAlertConfig}
                setSettingsAlertConfig={setSettingsAlertConfig}
                settingsAlertNotice={settingsAlertNotice}
                setSettingsAlertNotice={setSettingsAlertNotice}
                settingsAuthEnabled={settingsAuthEnabled}
                setSettingsAuthEnabled={setSettingsAuthEnabled}
                settingsAdminPwd={settingsAdminPwd}
                setSettingsAdminPwd={setSettingsAdminPwd}
                settingsOperatorPwd={settingsOperatorPwd}
                setSettingsOperatorPwd={setSettingsOperatorPwd}
                settingsTotpPin={settingsTotpPin}
                setSettingsTotpPin={setSettingsTotpPin}
                settingsAuthNotice={settingsAuthNotice}
                setSettingsAuthNotice={setSettingsAuthNotice}
              />
            )}
          </main>

          {/* ─────────────────────────────────────────────────────────────────
              RIGHT DOCKED AI COPILOT & REACT ORCHESTRATOR PANEL
          ───────────────────────────────────────────────────────────────── */}
          {copilotDrawerOpen && (
            <CopilotDrawer
              locale={locale}
              activeProject={activeProject}
              primaryNode={primaryNode}
              copilotWide={copilotWide}
              setCopilotWide={setCopilotWide}
              copilotWidth={copilotWidth}
              setCopilotWidth={setCopilotWidth}
              setCopilotDrawerOpen={setCopilotDrawerOpen}
              isDraggingOverChat={isDraggingOverChat}
              setIsDraggingOverChat={setIsDraggingOverChat}
              processDroppedOrSelectedFiles={processDroppedOrSelectedFiles}
              enablePromptCaching={enablePromptCaching}
              setEnablePromptCaching={setEnablePromptCaching}
              latestCacheMetrics={latestCacheMetrics}
              handleClearChat={handleClearChat}
              chatHistory={chatHistory}
              chatMessageFilter={chatMessageFilter}
              setChatMessageFilter={setChatMessageFilter}
              chatScrollRef={chatScrollRef}
              chatInputRef={chatInputRef}
              chatComposerRef={chatComposerRef}
              fileInputRef={fileInputRef}
              expandedThinking={expandedThinking}
              setExpandedThinking={setExpandedThinking}
              expandedRawPrompts={expandedRawPrompts}
              setExpandedRawPrompts={setExpandedRawPrompts}
              copiedChatMsgIdx={copiedChatMsgIdx}
              setCopiedChatMsgIdx={setCopiedChatMsgIdx}
              expandedTurnTools={expandedTurnTools}
              setExpandedTurnTools={setExpandedTurnTools}
              turnToolCategoryFilter={turnToolCategoryFilter}
              setTurnToolCategoryFilter={setTurnToolCategoryFilter}
              expandedTools={expandedTools}
              setExpandedTools={setExpandedTools}
              setPreviewPort={setPreviewPort}
              setActiveNav={setActiveNav}
              openRemoteFile={openRemoteFile}
              setBrainDocTab={setBrainDocTab}
              setTerminalDrawerOpen={setTerminalDrawerOpen}
              setStatusToast={setStatusToast}
              setSelectedChatSkill={setSelectedChatSkill}
              selectedChatSkill={selectedChatSkill}
              chatBusy={chatBusy}
              chatElapsedSec={chatElapsedSec}
              liveSteps={liveSteps}
              streamingThinkingText={streamingThinkingText}
              streamingReplyText={streamingReplyText}
              handleUpdateSkillDecision={handleUpdateSkillDecision}
              handleStartSkillInterview={handleStartSkillInterview}
              handleInterviewStepResponse={handleInterviewStepResponse}
              setSelectedServiceId={setSelectedServiceId}
              setServiceActionMethod={setServiceActionMethod}
              setServiceActionPath={setServiceActionPath}
              setServiceActionPayload={setServiceActionPayload}
              handleInvokeServiceAction={handleInvokeServiceAction}
              handleRollbackSnapshot={handleRollbackSnapshot}
              handleSendPrompt={handleSendPrompt}
              skillMenuOpen={skillMenuOpen}
              setSkillMenuOpen={setSkillMenuOpen}
              mentionMenuOpen={mentionMenuOpen}
              setMentionMenuOpen={setMentionMenuOpen}
              setMentionFilter={setMentionFilter}
              mentionCandidates={mentionCandidates}
              insertMentionToken={insertMentionToken}
              chatAttachments={chatAttachments}
              setChatAttachments={setChatAttachments}
              chatInput={chatInput}
              setChatInput={setChatInput}
              handleChatInputChange={handleChatInputChange}
              handleChatPaste={handleChatPaste}
            />
          )}
        </div>

        {/* COLLAPSIBLE & MOUSE-RESIZABLE BOTTOM LIVE PTY TERMINAL BAR (`xterm.js`) */}
        <BottomPtyDrawer
          terminalDrawerOpen={terminalDrawerOpen}
          setTerminalDrawerOpen={setTerminalDrawerOpen}
          terminalHeight={terminalHeight}
          setTerminalHeight={setTerminalHeight}
          primaryNode={primaryNode}
          activeHeartbeat={activeHeartbeat}
          gatewayUrl={gatewayUrl}
          activeProject={activeProject}
        />
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
