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

const XTermTerminal = dynamic(() => import("@/components/XTermTerminal"), {
  ssr: false,
});

type AutonomyTier =
  | "TIER_1_UNLEASHED"
  | "TIER_2_WORKSPACE_JAIL"
  | "TIER_3_SUPERVISED";

type NavSection =
  | "control-center"
  | "peers"
  | "access-control"
  | "reverse-proxy"
  | "brain-vault"
  | "workspace"
  | "activity"
  | "settings";

type FlowView = "peers" | "ai-agent" | "groups" | "networks";

interface NodeHeartbeat {
  node_id: string;
  hostname: string;
  os_arch: string;
  os_info?: string;
  public_ipv4?: string;
  private_ipv4?: string;
  tier: AutonomyTier;
  cpu_percent: number;
  ram_percent: number;
  ram_used_bytes: number;
  ram_total_bytes: number;
  disk_percent: number;
  active_pty_sessions: string[];
  pty_session_details?: Array<{
    session_id: string;
    cwd: string;
    running_cmd?: string | null;
  }>;
  services?: Array<{
    service_id: string;
    name: string;
    port: number;
    protocol: string;
    healthy: boolean;
    last_error?: string;
  }>;
  timestamp_unix: number;
}

interface PendingApproval {
  approval_id: string;
  created_at: string;
  tool_name: string;
  node_id: string;
  arguments: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
}

interface AIProviderSettings {
  provider: string;
  base_url: string;
  model: string;
  api_key_secret_name: string;
  enable_prompt_caching?: boolean;
  enable_auto_watchdog?: boolean;
}

interface ProjectState {
  project_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  planning_only: boolean;
  assigned_nodes: Array<{
    node_id: string;
    tier: AutonomyTier;
    online: boolean;
    hostname?: string;
    os_arch?: string;
    os_info?: string;
    last_seen_unix?: number;
  }>;
  active_cartridges: string[];
  registered_services: Array<{
    service_id: string;
    node_id: string;
    name: string;
    category?: "webui" | "backend" | "database" | "worker";
    description?: string;
    db_path?: string;
    endpoints?: Array<{
      id: string;
      label: string;
      method: "GET" | "POST" | "PUT" | "DELETE" | "SQL";
      path: string;
      description?: string;
      sample_payload?: string;
    }>;
    port: number;
    protocol: "http" | "tcp";
    path?: string;
    healthy?: boolean;
    health_check?: {
      type: "HTTP" | "TCP" | "SYSTEMD" | "EXEC";
      target: string;
      interval_sec: number;
      status: "HEALTHY" | "UNHEALTHY" | "UNKNOWN";
      last_checked?: string;
      last_error?: string;
    };
  }>;
  active_pty_sessions: string[];
  telemetry: Record<string, NodeHeartbeat>;
  pending_approvals: PendingApproval[];
  ai_settings?: AIProviderSettings;
  peer_mesh_links?: Array<{
    link_id: string;
    source_node_id: string;
    target_node_id: string;
    target_port: number;
    protocol: "tcp" | "http";
    alias_env: string;
    created_at: string;
  }>;
  scheduled_playbooks?: Array<{
    playbook_id: string;
    name: string;
    cron: string;
    prompt: string;
    target_node_id?: string;
    enabled: boolean;
    last_run_at?: string;
    last_status?: "ok" | "error";
  }>;
  mcp_api_keys?: Array<{
    key_id: string;
    name: string;
    token_prefix: string;
    scopes: Array<"read" | "execute" | "admin">;
    created_at: string;
    last_used_at?: string;
  }>;
}

interface StackBlueprint {
  id: string;
  name: string;
  category: string;
  description: string;
  cartridges: string[];
  prompt: string;
}

interface AuditEntry {
  timestamp: string;
  actor: "ai" | "user" | "policy_interceptor";
  tool_name: string;
  node_id?: string;
  status:
    | "executed"
    | "blocked"
    | "requires_approval"
    | "approved"
    | "rejected"
    | "error";
  summary: string;
  args?: Record<string, unknown>;
}

interface CartridgeMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
}

interface GatewayNode {
  node_id: string;
  tier: AutonomyTier;
  remote_addr: string;
  connected_at: string;
  online: boolean;
  last_heartbeat?: NodeHeartbeat;
}

interface FsEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  mode: string;
  mod_time_unix: number;
}

interface ChatAttachment {
  id: string;
  name: string;
  mime_type: string;
  data_url: string;
  size_bytes?: number;
}

interface PromptCacheMetrics {
  cached_tokens: number;
  prompt_tokens: number;
  completion_tokens?: number;
  tool_cache_hits: number;
  provider_cache_active: boolean;
}

interface ToolResultItem {
  tool_name: string;
  status: string;
  output: unknown;
  cached?: boolean;
  rollback_snapshot_id?: string;
  rollback_path?: string;
}

interface ChatItem {
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  thinking?: string;
  cacheMetrics?: PromptCacheMetrics;
  toolResults?: ToolResultItem[];
}

const PROVIDER_PRESETS: Record<
  string,
  { label: string; defaultUrl: string; defaultModel: string }
> = {
  "openai-compatible": {
    label: "Custom OpenAI-Compatible (vLLM / LiteLLM / OpenAI)",
    defaultUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o",
  },
  openrouter: {
    label: "OpenRouter.ai",
    defaultUrl: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-3.5-sonnet",
  },
  ollama: {
    label: "Ollama / Local vLLM",
    defaultUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "llama3.1",
  },
  anthropic: {
    label: "Anthropic Messages API",
    defaultUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-sonnet-latest",
  },
  "synapse-autonomous": {
    label: "Synapse Deterministic Engine",
    defaultUrl: "builtin://synapse-core",
    defaultModel: "synapse-v1-deterministic",
  },
};

export default function SynapseNetBirdControlCenter() {
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
    | "setup-keys"
    | "secrets-vault"
    | "ai-providers"
    | "mcp-server"
    | "debug-console"
  >("setup-keys");
  const [mcpKeyName, setMcpKeyName] = useState("External AI Agent (MCP)");
  const [mcpKeyScopeMode, setMcpKeyScopeMode] = useState<"read-exec" | "read-only">("read-exec");
  const [issuedMcpToken, setIssuedMcpToken] = useState<string | null>(null);
  const [copiedMcpToken, setCopiedMcpToken] = useState(false);
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
  const [selectedChatSkill, setSelectedChatSkill] = useState<
    "CheckSystem" | "CheckOpsec" | "SkillSearch" | "DeepForensics" | null
  >(null);
  const [skillMenuOpen, setSkillMenuOpen] = useState<boolean>(false);
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
        "Welcome to **Synapse Control Center**. Your interactive overlay topology, Muscle Peers, `Rule Cartridges`, and `Brain Vault` are mapped on the main canvas.\n\nUse the **Control Center** to drag nodes, toggle policies, or click `+ Add Peer` to enroll a new Linux server with one command.",
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
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
      setMentionMenuOpen(true);
    } else {
      setMentionMenuOpen(false);
    }
  }

  function insertMentionToken(token: string) {
    const replaced = chatInput.replace(
      /(?:^|\s)@([a-zA-Z0-9._:-]*)$/,
      (m) => (m.startsWith(" ") ? ` ${token} ` : `${token} `)
    );
    setChatInput(replaced);
    setMentionMenuOpen(false);
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

    if (activeSkill === "SkillSearch") {
      const node = primaryNode || "vps2-muscle";
      const searchQuery =
        text ||
        "Gib mir eine vollständige Übersicht über alle Funktionen in der UI sowie alle Dateien, Datenbanken, Ports und Dienste auf dem Server.";
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
        `Antworte ausführlich und präzise auf Deutsch mit exakten Fundstellen (UI-Pfad, Dateipfad, Zeilennummer, Port, Prozess oder DB-Tabelle).`,
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
        `6. **Phase 6 — Großer Senior-DevOps-Abschlussbericht (auf Deutsch):**`,
        `   - Erstelle eine übersichtliche Status-Tabelle aller geprüften Subsysteme (Host, Muscle-Agent, jeder einzelne Backend-/WebUI-Service, Datenbanken, Logs, Brain-Sync).`,
        `   - Belege jeden Befund mit echten Daten aus deiner Untersuchung (PIDs, Ports, Dateipfade, Zeilen, DB-Tabellen, Antwortzeiten).`,
        `   - Gib konkrete, priorisierte **Verbesserungsempfehlungen** (Architektur, Stabilität, Auto-Restart/Systemd, Logging, Performance).`,
      ]
        .filter(Boolean)
        .join("\n");

      const displayMsg = text
        ? `🔍 **[Skill: CheckSystem]** ${text}`
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
        `5. **Phase 5 — Umfassender DevSecOps-Bericht (auf Deutsch):**`,
        `   - Gliedere alle Befunde nach Schweregrad (**KRITISCH / HOCH / MITTEL / NIEDRIG / OK**) mit exakten technischen Nachweisen (Port, Datei, Zeilennummer, Konfigurationswert).`,
        `   - Vergib einen fundierten **OpSec-Score (0–100)** und liefere sofort ausführbare Härtungsmaßnahmen.`,
      ]
        .filter(Boolean)
        .join("\n");

      const displayMsg = text
        ? `🛡️ **[Skill: CheckOpsec]** ${text}`
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
        "Untersuche alle Logs, Prozesse, Datenbanken und Quellcode-Dateien auf versteckte Fehler, Warnungen, Performance-Engpässe oder Inkonsistenzen.";
      const aiForensicsPrompt = [
        `Du führst jetzt den Skill **DeepForensics** (Tiefgreifende DevOps-Fehler-, Log-, Code- & Datenbank-Forensik) für \`${activeProject.project_id}\` auf \`@${node}\` aus.`,
        `FORENSIK-AUFTRAG / FOKUS: "${focusTopic}"`,
        ``,
        `ARBEITE WIE EIN SENIOR DEVOPS TROUBLESHOOTER: Gehe gründlich und systematisch in mehreren Schritten vor:`,
        `1. **Log- & Crash-Analyse:** Starte \`node_deep_search\` mit \`search_mode: "log_scan"\` auf \`@${node}\`, um alle Applikations-Logs, \`/tmp/*.log\`, \`journalctl\` und Container-Logs auszuwerten.`,
        `2. **Prozess-, Port- & Ressourcen-Analyse:** Starte \`node_deep_search\` mit \`search_mode: "process_and_port_map"\`, um hängende Prozesse, Speicherverbrauch, Antwortzeiten und HTTP-Statuscodes aller Dienste zu prüfen.`,
        `3. **Code- & Datenbank-Tiefenprüfung:** Nutze \`node_deep_search\` mit \`search_mode: "content_grep"\` und \`"sqlite_inspect"\` sowie \`node_fs_operation\` (\`read_file\`), um den relevanten Quellcode und die Datenbank-Tabellen Zeile für Zeile auf Ursachen (Root Cause) zu untersuchen.`,
        `4. **Forensischer Diagnosebericht (auf Deutsch):** Präsentiere die genaue Ursache (Root Cause), alle gefundenen Belege (Logs, Codezeilen, DB-Status) und die exakte technische Lösung.`,
      ].join("\n");

      const displayMsg = `🔬 **[Skill: DeepForensics]** ${focusTopic}`;
      await runStreamingPrompt(aiForensicsPrompt, undefined, atts, displayMsg);
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
        activityStatusFilter === "ALL" || l.status === activityStatusFilter;
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
    : `sudo axon switch --core ${gatewayUrl.replace(/\/$/, "")} --token <NEW_TOKEN> --tier ${joinTier} --restart`;

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
    cron: string;
    prompt: string;
    enabled: boolean;
  }) {
    if (!activeProject) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upsert_playbook",
        project_id: activeProject.project_id,
        playbook_id: pb.playbook_id,
        name: pb.name,
        cron: pb.cron,
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
                    <span className="rounded bg-netbird-950 border border-netbird-500/40 px-1.5 py-0.5 font-mono text-[9px] text-netbird">
                      v0.2
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

        {/* Minimalist Bottom Mesh Status Pill */}
        <div className="p-3.5">
          {sidebarCollapsed ? (
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
                    : "bg-green-400"
                }`}
              />
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-nb-gray-900 bg-nb-gray-940/70 px-3 py-2 text-[11px] text-nb-gray-400">
              <span className="flex items-center gap-2 text-nb-gray-200">
                <span
                  className={`h-2 w-2 rounded-full ${
                    activeProject?.planning_only
                      ? "bg-amber-400"
                      : "bg-green-400"
                  }`}
                />
                {activeProject?.planning_only ? "Planning-Only" : "mTLS 1.3 Mesh"}
              </span>
              <span className="font-mono text-[10px] text-nb-gray-400">
                {gatewayNodes.filter((n) => n.online).length} online
              </span>
            </div>
          )}
        </div>
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
                className="hidden md:flex cursor-pointer items-center gap-1.5 rounded-full border border-green-500/30 bg-green-950/50 px-2.5 py-0.5 text-[11px] text-green-400 hover:bg-green-950 transition"
                title="Verbundenen Server anzeigen"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                <span className="font-mono">{primaryNode}</span>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAddPeerModalOpen(true);
                  handleGenerateJoinToken();
                }}
                className="hidden md:flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-yellow-950/50 px-2.5 py-0.5 text-[11px] text-yellow-400 hover:bg-yellow-950"
              >
                <Lock className="h-3 w-3" />
                <span>Planning-Only</span>
              </button>
            )}
          </div>

          {/* Right: Essential Global Controls (Copilot + Server) */}
          <div className="flex items-center gap-2">
            {statusToast && (
              <span className="hidden xl:inline-block rounded-md border border-green-500/40 bg-green-950 px-2.5 py-1 font-mono text-[11px] text-green-400">
                {statusToast}
              </span>
            )}

            <button
              onClick={() => setCopilotDrawerOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
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
              className="flex items-center gap-1.5 rounded-lg bg-netbird px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-netbird-500 transition-colors"
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
                <strong>Service Health Alert:</strong>{" "}
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
                <span>Ask AI to Diagnose &amp; Fix</span>
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
          <div className="relative flex-1 overflow-y-auto">
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
              />
            )}

            {/* ═══════════════════════════════════════════════════════════════
                VIEW 2: NETBIRD PEERS & CLUSTER VIEW (`peers`)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "peers" && (
              <div className="mx-auto max-w-6xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-medium text-nb-gray-100">
                      Peers, Cluster-Mesh &amp; Stack-Blueprints
                    </h1>
                    <p className="text-xs text-nb-gray-400 mt-0.5">
                      Übersichtlich sortiert nach verbundenen Muscle-Servern,
                      Peer-to-Peer Mesh-Tunnels, 1-Click Stacks und Cron-Jobs.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setAddPeerModalOpen(true);
                      if (!issuedToken) handleGenerateJoinToken();
                    }}
                    className="flex items-center gap-2 rounded-md bg-netbird px-4 py-2 text-xs font-medium text-white hover:bg-netbird-500"
                  >
                    <Plus className="h-4 w-4" />
                    <span>+ Server hinzufügen</span>
                  </button>
                </div>

                {/* Clean 4-Tab Sub-Navigation for Peers & Cluster */}
                <div className="flex flex-wrap items-center gap-2 border-b border-nb-gray-900 pb-3">
                  {[
                    {
                      id: "nodes",
                      label: "Server",
                      icon: Server,
                    },
                    {
                      id: "mesh",
                      label: "P2P Mesh-Links",
                      icon: Network,
                    },
                    {
                      id: "blueprints",
                      label: "Stack-Blueprints",
                      icon: Sparkles,
                    },
                    {
                      id: "playbooks",
                      label: "Cron-Playbooks",
                      icon: Activity,
                    },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = peersSubTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() =>
                          setPeersSubTab(
                            tab.id as
                              | "nodes"
                              | "mesh"
                              | "blueprints"
                              | "playbooks"
                          )
                        }
                        className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition ${
                          active
                            ? "border-netbird bg-nb-gray-900 text-white"
                            : "border-nb-gray-800/80 bg-nb-gray-940 text-nb-gray-400 hover:text-white"
                        }`}
                      >
                        <Icon
                          className={`h-3.5 w-3.5 ${
                            active ? "text-netbird" : ""
                          }`}
                        />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

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
                          "ALL",
                          "TIER_1_UNLEASHED",
                          "TIER_2_WORKSPACE_JAIL",
                          "TIER_3_SUPERVISED",
                        ].map((tierOpt) => (
                          <button
                            key={tierOpt}
                            onClick={() => setPeerTierFilter(tierOpt)}
                            className={`rounded-md border px-2.5 py-1 font-mono text-[10px] transition ${
                              peerTierFilter === tierOpt
                                ? "border-netbird-500 bg-netbird-950 text-netbird"
                                : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-300 hover:bg-nb-gray-900"
                            }`}
                          >
                            {tierOpt === "ALL" ? "Alle Tiers" : tierOpt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-nb-gray-900 bg-nb-gray-940">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-nb-gray-900 bg-nb-gray-930/70 text-[11px] font-medium uppercase text-nb-gray-400">
                          <tr>
                            <th className="py-3 px-4">Server / Status</th>
                            <th className="py-3 px-4">Autonomy Tier</th>
                            <th className="py-3 px-4">Adresse (IPv4)</th>
                            <th className="py-3 px-4">OS / Arch</th>
                            <th className="py-3 px-4">Auslastung</th>
                            <th className="py-3 px-4 text-right">Aktionen</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-nb-gray-900">
                          {filteredPeers.map((gn) => {
                            const hb = gn.last_heartbeat;
                            const isAssigned =
                              activeProject?.assigned_nodes.some(
                                (a) => a.node_id === gn.node_id
                              );
                            return (
                              <tr
                                key={gn.node_id}
                                className="hover:bg-nb-gray-930/50 transition-colors"
                              >
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`h-2.5 w-2.5 rounded-full ${
                                        gn.online
                                          ? "bg-green-400"
                                          : "bg-nb-gray-500"
                                      }`}
                                    />
                                    <div>
                                      <div className="font-mono font-semibold text-white">
                                        {gn.node_id}
                                      </div>
                                      <div className="text-[11px] text-nb-gray-400">
                                        {hb?.hostname || gn.remote_addr}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="rounded-md border border-netbird-500/50 bg-netbird-950 px-2.5 py-1 font-mono text-[10px] text-netbird">
                                    {gn.tier}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 font-mono text-nb-gray-200">
                                  {hb?.private_ipv4 || "127.0.0.1"}
                                </td>
                                <td className="py-3.5 px-4 font-mono text-nb-gray-300">
                                  {hb?.os_info || hb?.os_arch || "linux/amd64"}
                                </td>
                                <td className="py-3.5 px-4">
                                  {hb ? (
                                    <div className="flex items-center gap-3 font-mono text-[11px] text-nb-gray-300">
                                      <span>
                                        CPU {hb.cpu_percent.toFixed(1)}%
                                      </span>
                                      <span>
                                        RAM {hb.ram_percent.toFixed(1)}%
                                      </span>
                                      <span>
                                        DSK {hb.disk_percent.toFixed(1)}%
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-nb-gray-500">—</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right space-x-2">
                                  <button
                                    onClick={() => {
                                      setSelectedNodeId(gn.node_id);
                                      setTerminalDrawerOpen(true);
                                    }}
                                    className="rounded-md border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-1 text-[11px] text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white"
                                  >
                                    Terminal
                                  </button>
                                  <button
                                    onClick={() =>
                                      isAssigned
                                        ? handleUnassignNode(gn.node_id)
                                        : handleAssignNode(gn.node_id, gn.tier)
                                    }
                                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                                      isAssigned
                                        ? "border border-red-500/40 bg-red-950/40 text-red-400 hover:bg-red-950"
                                        : "bg-netbird text-white hover:bg-netbird-500"
                                    }`}
                                  >
                                    {isAssigned ? "Unassign" : "Assign"}
                                  </button>
                                </td>
                              </tr>
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
                        Multi-Server Peer-to-Peer Mesh Links (`core_link_peers`)
                      </h2>
                      <p className="text-xs text-nb-gray-400 mt-0.5">
                        Verbinde Dienste zwischen verschiedenen Muscle-Servern
                        über verschlüsselte mTLS-Loopback-Tunnels.
                      </p>
                    </div>
                    <form
                      onSubmit={handleAddMeshLink}
                      className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 text-xs"
                    >
                      <input
                        type="text"
                        value={meshSourceNode}
                        onChange={(e) => setMeshSourceNode(e.target.value)}
                        placeholder="Source peer (z.B. vps2-muscle)"
                        className="rounded border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
                      />
                      <input
                        type="text"
                        value={meshTargetNode}
                        onChange={(e) => setMeshTargetNode(e.target.value)}
                        placeholder="Target peer (z.B. vps2-db-node)"
                        className="rounded border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
                      />
                      <input
                        type="number"
                        value={meshTargetPort}
                        onChange={(e) =>
                          setMeshTargetPort(Number(e.target.value) || 5432)
                        }
                        placeholder="Port (5432)"
                        className="rounded border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-netbird"
                      />
                      <button
                        type="submit"
                        className="rounded bg-netbird px-3 py-2 text-xs font-medium text-white hover:bg-netbird-500"
                      >
                        + Mesh-Link anlegen
                      </button>
                    </form>
                    <div className="space-y-2">
                      {(activeProject?.peer_mesh_links || []).map((lnk) => (
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
                              {lnk.target_node_id}:{lnk.target_port}
                            </strong>{" "}
                            <span className="text-nb-gray-400">
                              ({lnk.alias_env})
                            </span>
                          </span>
                          <button
                            onClick={() => handleRemoveMeshLink(lnk.link_id)}
                            className="text-nb-gray-500 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
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
                              runStreamingPrompt(bp.prompt);
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
                      {(activeProject?.scheduled_playbooks || []).map((pb) => (
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
                                {pb.cron}
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
                                  ? "border-green-500/40 bg-green-950 text-green-400"
                                  : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-400"
                              }`}
                            >
                              {pb.enabled ? "ON" : "OFF"}
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
                      ))}
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
                VIEW 3: NETBIRD ACCESS CONTROL (`access-control`)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "access-control" && (
              <div className="mx-auto max-w-6xl p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-medium text-nb-gray-100">
                      Access Control, Guardrails &amp; Rule Cartridges
                    </h1>
                    <p className="text-xs text-nb-gray-400 mt-0.5">
                      Configure modular DevOps Rule Cartridges, inspect hardcoded
                      node guardrails, and review Tier-3 human-in-the-loop
                      approvals with visual diff highlighting.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCustomCartModal((v) => !v)}
                    className="flex items-center gap-1.5 rounded-md bg-netbird px-3.5 py-2 text-xs font-medium text-white hover:bg-netbird-500"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>New Custom Cartridge</span>
                  </button>
                </div>

                {showCustomCartModal && (
                  <form
                    onSubmit={handleCreateCustomCartridge}
                    className="rounded-lg border border-netbird-500/50 bg-nb-gray-940 p-5 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">
                        Create Custom Rule Cartridge (`.md`)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCustomCartModal(false)}
                        className="text-nb-gray-400 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <input
                        type="text"
                        value={customCartName}
                        onChange={(e) => setCustomCartName(e.target.value)}
                        placeholder="Cartridge Name (e.g. HIPAA Compliance)"
                        className="rounded border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-white"
                      />
                      <input
                        type="text"
                        value={customCartCategory}
                        onChange={(e) => setCustomCartCategory(e.target.value)}
                        placeholder="Category (e.g. Security)"
                        className="rounded border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-white"
                      />
                      <input
                        type="text"
                        value={customCartDesc}
                        onChange={(e) => setCustomCartDesc(e.target.value)}
                        placeholder="Short description..."
                        className="rounded border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-white"
                      />
                    </div>
                    <textarea
                      value={customCartContent}
                      onChange={(e) => setCustomCartContent(e.target.value)}
                      rows={5}
                      className="w-full rounded border border-nb-gray-800 bg-nb-gray-960 p-3 font-mono text-xs text-nb-gray-100"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="submit"
                        className="rounded-md bg-netbird px-4 py-1.5 text-xs font-medium text-white hover:bg-netbird-500"
                      >
                        Save &amp; Enable Cartridge
                      </button>
                    </div>
                  </form>
                )}

                {/* Pending Tier-3 Approvals Gate with Visual Unified Diff Highlighting */}
                {pendingApprovals.length > 0 && (
                  <div className="rounded-lg border border-netbird-500/60 bg-netbird-950/30 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-netbird flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4" />
                        Pending Tier-3 Supervised Approvals (
                        {pendingApprovals.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {pendingApprovals.map((req) => {
                        const rawPreview = String(
                          req.arguments?.command ||
                            req.arguments?.content_or_patch ||
                            req.arguments?.content ||
                            JSON.stringify(req.arguments, null, 2)
                        );
                        return (
                          <div
                            key={req.approval_id}
                            className="rounded-lg border border-nb-gray-800 bg-nb-gray-940 p-4 space-y-2.5"
                          >
                            <div className="flex items-center justify-between font-mono text-xs">
                              <span className="font-semibold text-white">
                                {req.tool_name}
                              </span>
                              <span className="text-nb-gray-400">
                                {req.node_id}
                              </span>
                            </div>
                            <div className="max-h-40 overflow-auto rounded bg-nb-gray-960 p-2.5 font-mono text-[11px] space-y-0.5">
                              {rawPreview.split("\n").map((line, idx) => {
                                const isAdd =
                                  line.startsWith("+") && !line.startsWith("+++");
                                const isDel =
                                  line.startsWith("-") && !line.startsWith("---");
                                const isHunk = line.startsWith("@@");
                                return (
                                  <div
                                    key={idx}
                                    className={`px-1 rounded-sm whitespace-pre-wrap break-all ${
                                      isAdd
                                        ? "bg-green-950/70 text-green-300"
                                        : isDel
                                        ? "bg-red-950/70 text-red-300"
                                        : isHunk
                                        ? "bg-sky-950/60 text-sky-300"
                                        : "text-nb-gray-200"
                                    }`}
                                  >
                                    {line}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() =>
                                  handleResolveApproval(
                                    req.approval_id,
                                    "approve"
                                  )
                                }
                                className="flex-1 rounded-md bg-green-600 py-1.5 text-xs font-medium text-white hover:bg-green-500"
                              >
                                Approve &amp; Execute
                              </button>
                              <button
                                onClick={() =>
                                  handleResolveApproval(req.approval_id, "reject")
                                }
                                className="flex-1 rounded-md border border-red-500/50 bg-red-950/50 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pluggable Rule Cartridges Grid with On-Demand Markdown Inspector */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {cartridges.map((c) => {
                      const enabled =
                        activeProject?.active_cartridges?.includes(c.id);
                      const selected = selectedCartridgeId === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() =>
                            setSelectedCartridgeId(selected ? "" : c.id)
                          }
                          className={`cursor-pointer rounded-xl border p-4 transition-all ${
                            selected
                              ? "border-netbird bg-nb-gray-930 ring-1 ring-netbird/30"
                              : "border-nb-gray-900 bg-nb-gray-940 hover:border-nb-gray-800"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  enabled ? "bg-green-400" : "bg-nb-gray-500"
                                }`}
                              />
                              <span className="truncate text-sm font-semibold text-white">
                                {c.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-nb-gray-400 hover:text-white">
                                {selected ? "Ausblenden" : "Details"}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleCartridge(c.id);
                                }}
                                className={`rounded-md border px-2.5 py-1 font-mono text-[10px] font-medium transition ${
                                  enabled
                                    ? "border-green-500/50 bg-green-950/70 text-green-400"
                                    : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-400 hover:text-white"
                                }`}
                              >
                                {enabled ? "AKTIV" : "AUS"}
                              </button>
                            </div>
                          </div>
                          <p className="mt-1.5 text-xs text-nb-gray-400 line-clamp-1">
                            {c.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* On-Demand Cartridge Specification Drawer */}
                  {selectedCartridgeId && currentCartridge && (
                    <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-5 space-y-3">
                      <div className="flex items-center justify-between border-b border-nb-gray-800 pb-3">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-netbird" />
                          <span className="text-sm font-semibold text-white">
                            {currentCartridge.name} — Regel-Spezifikation
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedCartridgeId("")}
                          className="rounded-md p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <RichMarkdownDocument
                        markdown={currentCartridge.content}
                      />
                    </div>
                  )}
                </div>
              </div>
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
                  <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
                    {/* SINGLE CLEAN WORKBENCH CONTAINER (No nested boxes, no duplicate top filter bar) */}
                    <div className="flex flex-col overflow-hidden rounded-xl border border-nb-gray-800 bg-nb-gray-940">
                      {/* 1. SERVICE TABS (Reiter) */}
                      <div className="flex items-end gap-1 overflow-x-auto border-b border-nb-gray-800 bg-nb-gray-950 px-3 pt-2">
                        {allSvcs.length === 0 ? (
                          <div className="px-4 py-2.5 text-xs text-nb-gray-400">
                            Noch keine Dienste im Projekt registriert.
                          </div>
                        ) : (
                          allSvcs.map((svc) => {
                            const healthy =
                              svc.healthy !== false &&
                              svc.health_check?.status !== "UNHEALTHY";
                            const isSelected =
                              activeSvc?.service_id === svc.service_id;
                            const cat = svc.category || "backend";

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
                                className={`relative flex shrink-0 items-center gap-2 rounded-t-lg px-4 py-2.5 text-xs transition-colors ${
                                  isSelected
                                    ? "-mb-px border-x border-t-2 border-nb-gray-800 border-t-netbird bg-nb-gray-930 font-semibold text-white z-10"
                                    : "text-nb-gray-400 hover:bg-nb-gray-900/60 hover:text-nb-gray-200"
                                }`}
                              >
                                <span
                                  className={`h-2 w-2 shrink-0 rounded-full ${
                                    healthy
                                      ? "bg-green-400"
                                      : "bg-red-500 animate-pulse"
                                  }`}
                                />
                                <span className="truncate max-w-[200px]">
                                  {svc.name}
                                </span>
                                <span className="font-mono text-[10px] text-nb-gray-400">
                                  {cat === "webui"
                                    ? "WebUI"
                                    : cat === "database"
                                    ? "DB"
                                    : "API"}{" "}
                                  :{svc.port}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>

                      {/* 2. FLAT ADDRESS & VIEW BAR (No inner boxes, zero overlap) */}
                      {activeSvc && (
                        <div className="flex items-center justify-between gap-4 border-b border-nb-gray-800 bg-nb-gray-930 px-4 py-2.5 text-xs">
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <Globe className="h-3.5 w-3.5 shrink-0 text-netbird" />
                            <span className="shrink-0 font-mono text-[11px] text-nb-gray-400">
                              {activeSvc.node_id}:{activeSvc.port}
                            </span>
                            <span className="text-nb-gray-700">·</span>
                            <a
                              href={activeExtUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="truncate font-mono text-[11px] text-nb-gray-200 hover:text-netbird hover:underline"
                            >
                              {activeExtUrl}
                            </a>
                            <a
                              href={activeExtUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-netbird hover:underline ml-1"
                            >
                              <span>Extern</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>

                          {/* Simple 2-Button View Switcher (Never overlaps) */}
                          <div className="flex shrink-0 items-center gap-1">
                            {[
                              { id: "tester", label: "API- & DB-Tester" },
                              { id: "preview", label: "Web-Vorschau" },
                            ].map((mode) => (
                              <button
                                key={mode.id}
                                type="button"
                                onClick={() =>
                                  setServiceWorkspaceTab(
                                    mode.id as "split" | "preview" | "tester"
                                  )
                                }
                                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                                  serviceWorkspaceTab === mode.id
                                    ? "bg-netbird text-white"
                                    : "text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
                                }`}
                              >
                                {mode.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 3. FLAT WORKSPACE BODY (Divided cleanly by a thin line, not nested boxes) */}
                      {activeSvc && serviceWorkspaceTab !== "preview" && (
                        <div className="grid grid-cols-1 divide-y divide-nb-gray-800 lg:grid-cols-12 lg:divide-y-0 lg:divide-x">
                          {/* Left 4 Cols: Flat Endpoint List */}
                          <div className="lg:col-span-4 p-4 space-y-2">
                            <div className="px-1 pb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-400">
                              Verfügbare Optionen
                            </div>

                            {(activeSvc.endpoints || []).length === 0 ? (
                              <div className="px-1 text-xs text-nb-gray-400">
                                Sende rechts eine Anfrage an{" "}
                                <code className="font-mono text-white">
                                  :{activeSvc.port}
                                </code>
                                .
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {activeEndpoints.map((ep, idx) => {
                                  const isCurrentEp =
                                    idx === activeEndpointIdx;
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
                                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-xs transition ${
                                        isCurrentEp
                                          ? "bg-nb-gray-900 text-white border-l-2 border-l-netbird"
                                          : "text-nb-gray-300 hover:bg-nb-gray-930 hover:text-white"
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span
                                            className={`font-mono text-[10px] font-bold ${
                                              ep.method === "POST"
                                                ? "text-amber-400"
                                                : ep.method === "SQL"
                                                ? "text-purple-400"
                                                : "text-emerald-400"
                                            }`}
                                          >
                                            {ep.method}
                                          </span>
                                          <span className="truncate font-medium">
                                            {ep.label}
                                          </span>
                                        </div>
                                        {ep.description && (
                                          <div className="mt-0.5 truncate text-[11px] text-nb-gray-500">
                                            {ep.description}
                                          </div>
                                        )}
                                      </div>
                                      <Play className="h-3 w-3 shrink-0 text-netbird" />
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Right 8 Cols: Flat Request Bar + Output */}
                          <div className="lg:col-span-8 p-4 space-y-3">
                            <div className="flex items-center gap-2 text-xs">
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
                                className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 font-mono text-xs font-semibold text-netbird focus:outline-none"
                              >
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="DELETE">DELETE</option>
                                <option value="SQL">SQL</option>
                              </select>

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
                                className="flex-1 rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 font-mono text-xs text-white focus:border-netbird focus:outline-none"
                              />

                              <button
                                type="button"
                                disabled={serviceActionBusy}
                                onClick={() => handleInvokeServiceAction()}
                                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-netbird px-4 py-2 text-xs font-medium text-white hover:bg-netbird-500 disabled:opacity-50"
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
                                className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-3 font-mono text-xs text-nb-gray-100 focus:border-netbird focus:outline-none"
                              />
                            )}

                            {/* Single flat dark output area */}
                            <div className="rounded-lg bg-nb-gray-950 p-3.5 font-mono text-xs space-y-2">
                              <div className="flex items-center justify-between border-b border-nb-gray-900 pb-2 text-[11px]">
                                <span className="text-nb-gray-400">
                                  Antwort ({activeSvc.name})
                                </span>
                                {serviceActionResult && (
                                  <span
                                    className={
                                      serviceActionResult.ok
                                        ? "text-green-400"
                                        : "text-red-400"
                                    }
                                  >
                                    {serviceActionResult.method} · HTTP{" "}
                                    {serviceActionResult.status_code} ·{" "}
                                    {serviceActionResult.latency_ms} ms
                                  </span>
                                )}
                              </div>
                              <pre className="max-h-72 min-h-[160px] overflow-auto whitespace-pre-wrap text-nb-gray-100 leading-relaxed">
                                {serviceActionResult
                                  ? serviceActionResult.response_text
                                  : "Klicke links auf eine Option oder auf 'Ausführen'."}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 4. FLAT WEB PREVIEW (Shown when 'preview' is selected) */}
                      {activeSvc && serviceWorkspaceTab === "preview" && (
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between gap-2 border-b border-nb-gray-800 bg-nb-gray-950 px-4 py-2 text-xs">
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
                                className="w-48 rounded border border-nb-gray-800 bg-nb-gray-930 px-2.5 py-1 font-mono text-xs text-white focus:border-netbird focus:outline-none"
                                placeholder="/"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewReloadNonce((n) => n + 1)
                              }
                              className="rounded border border-nb-gray-800 bg-nb-gray-930 px-2.5 py-1 text-[11px] text-nb-gray-300 hover:text-white"
                            >
                              Neu laden
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
                            className="w-full bg-white h-[480px]"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

            {/* ═══════════════════════════════════════════════════════════════
                VIEW 5: FOCUSED BRAIN VAULT DOCUMENTS (`brain-vault`)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "brain-vault" && (
              <div className="mx-auto max-w-5xl p-6 space-y-5">
                {/* Clean Header + Document Switcher */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-nb-gray-900 pb-4">
                  <div>
                    <h1 className="text-xl font-medium text-nb-gray-100">
                      Brain Vault
                    </h1>
                    <p className="text-xs text-nb-gray-400 mt-0.5">
                      Persistente Architektur-Spezifikation und technisches
                      Projekt-Gedächtnis für den KI-Orchestrator.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* 2-Tab Document Switcher */}
                    <div className="flex items-center rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-1 text-xs">
                      {(["Architecture.md", "Memory.md"] as const).map(
                        (doc) => {
                          const active = brainDocTab === doc;
                          return (
                            <button
                              key={doc}
                              onClick={() => {
                                setBrainDocTab(doc);
                                setIsEditingMarkdown(false);
                              }}
                              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition ${
                                active
                                  ? "bg-nb-gray-900 text-white border border-nb-gray-800"
                                  : "text-nb-gray-400 hover:text-white"
                              }`}
                            >
                              <FileText className="h-3.5 w-3.5 text-netbird" />
                              <span>{doc}</span>
                            </button>
                          );
                        }
                      )}
                    </div>

                    <button
                      onClick={() => setIsEditingMarkdown((v) => !v)}
                      className="flex items-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-930 px-3 py-1.5 text-xs font-medium text-nb-gray-200 hover:text-white transition"
                    >
                      <Code2 className="h-3.5 w-3.5 text-netbird" />
                      <span>
                        {isEditingMarkdown ? "Leseansicht" : "Bearbeiten"}
                      </span>
                    </button>

                    {isEditingMarkdown && (
                      <button
                        onClick={() => handleSaveBrainDoc(brainDocTab)}
                        className="flex items-center gap-1.5 rounded-lg bg-netbird px-4 py-1.5 text-xs font-medium text-white hover:bg-netbird-500 transition"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>Speichern</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Focused Document Reader / Editor */}
                <div className="flex flex-col overflow-hidden rounded-xl border border-nb-gray-900 bg-nb-gray-940">
                  <div className="flex items-center justify-between border-b border-nb-gray-900 bg-nb-gray-930 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <FolderGit2 className="h-4 w-4 text-netbird" />
                      <span className="font-mono text-xs font-medium text-white">
                        /projects/{activeProject?.project_id || "synapse-cloud-demo"}/
                        {brainDocTab}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-nb-gray-400">
                      {brainDocTab === "Architecture.md"
                        ? "System-Architektur & Komponenten"
                        : "Chronologisches Engineering-Log"}
                    </span>
                  </div>

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
                        className="h-[540px] w-full rounded-lg border border-nb-gray-800 bg-nb-gray-960 p-4 font-mono text-xs text-nb-gray-100 focus:border-netbird focus:outline-none"
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
              <div className="flex h-full overflow-hidden">
                <div className="w-64 shrink-0 border-r border-nb-gray-900 bg-nb-gray-940 p-3 flex flex-col justify-between">
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
                      placeholder="New file path..."
                      className="flex-1 rounded border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1 font-mono text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="rounded bg-netbird px-2.5 py-1 text-xs text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>

                <div className="flex flex-1 flex-col bg-nb-gray-960">
                  <div className="flex items-center justify-between border-b border-nb-gray-900 bg-nb-gray-940 px-4 py-2.5">
                    <span className="font-mono text-xs text-nb-gray-200">
                      {activeFilePath}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowDiffDrawer((v) => !v)}
                        className="flex items-center gap-1.5 rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3 py-1 text-xs text-nb-gray-200 hover:text-white"
                      >
                        <GitCompare className="h-3.5 w-3.5 text-netbird" />
                        <span>Unified Diff Patch</span>
                      </button>
                      <button
                        onClick={handleSaveRemoteFile}
                        className="flex items-center gap-1.5 rounded-md bg-netbird px-3.5 py-1 text-xs font-medium text-white hover:bg-netbird-500"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>Save to Peer</span>
                      </button>
                    </div>
                  </div>

                  {showDiffDrawer && (
                    <div className="border-b border-nb-gray-900 bg-nb-gray-940 p-4 space-y-2">
                      <textarea
                        value={diffPatchText}
                        onChange={(e) => setDiffPatchText(e.target.value)}
                        placeholder="Paste unified diff (@@ -1,3 +1,4 @@)..."
                        className="h-28 w-full rounded border border-nb-gray-800 bg-nb-gray-960 p-2.5 font-mono text-xs text-green-400"
                      />
                      <button
                        onClick={handleApplyUnifiedDiff}
                        className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white"
                      >
                        Apply Unified Diff
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
            )}

            {/* ═══════════════════════════════════════════════════════════════
                VIEW 7: NETBIRD ACTIVITY AUDIT LOG (`activity`)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "activity" && (
              <div className="mx-auto max-w-6xl p-6 space-y-5">
                <div>
                  <h1 className="text-xl font-medium text-nb-gray-100">
                    Activity &amp; Immutable Audit Log (`Audit.jsonl`)
                  </h1>
                  <p className="text-xs text-nb-gray-400 mt-0.5">
                    Cryptographic trail of every AI tool call, policy intercept,
                    and operator action.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-nb-gray-900 bg-nb-gray-940 p-3">
                  <div className="flex flex-1 items-center gap-2">
                    <Search className="h-4 w-4 text-nb-gray-400 ml-1" />
                    <input
                      type="text"
                      value={activitySearch}
                      onChange={(e) => setActivitySearch(e.target.value)}
                      placeholder="Search events by tool name, peer, or summary..."
                      className="flex-1 bg-transparent text-xs text-white placeholder:text-nb-gray-400 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[
                      "ALL",
                      "executed",
                      "blocked",
                      "requires_approval",
                    ].map((st) => (
                      <button
                        key={st}
                        onClick={() => setActivityStatusFilter(st)}
                        className={`rounded-md border px-2.5 py-1 font-mono text-[10px] uppercase transition ${
                          activityStatusFilter === st
                            ? "border-netbird-500 bg-netbird-950 text-netbird"
                            : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-300"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-nb-gray-900 bg-nb-gray-940">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-nb-gray-900 bg-nb-gray-930/70 text-[11px] font-medium uppercase text-nb-gray-400">
                      <tr>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Actor</th>
                        <th className="py-3 px-4">Tool / Event</th>
                        <th className="py-3 px-4">Summary</th>
                        <th className="py-3 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nb-gray-900 font-mono">
                      {filteredLogs.map((log, i) => (
                        <tr key={i} className="hover:bg-nb-gray-930/40">
                          <td className="py-3 px-4 text-nb-gray-400 whitespace-nowrap">
                            {log.timestamp.replace("T", " ").slice(0, 19)}
                          </td>
                          <td className="py-3 px-4 text-nb-gray-200">
                            {log.actor}
                          </td>
                          <td className="py-3 px-4 text-netbird">
                            {log.tool_name}
                          </td>
                          <td className="py-3 px-4 text-nb-gray-200 max-w-md truncate">
                            {log.summary}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span
                              className={`rounded border px-2 py-0.5 text-[10px] uppercase ${
                                log.status === "executed" ||
                                log.status === "approved"
                                  ? "border-green-500/50 bg-green-950 text-green-400"
                                  : log.status === "blocked" ||
                                    log.status === "rejected" ||
                                    log.status === "error"
                                  ? "border-red-500/50 bg-red-950 text-red-400"
                                  : "border-netbird-500/50 bg-netbird-950 text-netbird"
                              }`}
                            >
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                VIEW 8: NETBIRD SETTINGS (`settings` — Setup Keys, Vault & AI)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "settings" && (
              <div className="mx-auto max-w-5xl p-6 space-y-6">
                <div>
                  <h1 className="text-xl font-medium text-nb-gray-100">
                    Settings
                  </h1>
                  <p className="text-xs text-nb-gray-400 mt-0.5">
                    Manage Setup Keys (One-Command Peer Enrollment), AES-256-GCM
                    Encrypted Secrets Vault, and AI Providers.
                  </p>
                </div>

                <div className="flex items-center gap-2 border-b border-nb-gray-900 pb-3">
                  {[
                    {
                      id: "setup-keys",
                      label: "Setup Keys (Peer Onboarding)",
                      icon: Server,
                    },
                    {
                      id: "secrets-vault",
                      label: `Encrypted Vault (${secretKeys.length})`,
                      icon: KeyRound,
                    },
                    {
                      id: "ai-providers",
                      label: "AI Providers & Base URL",
                      icon: Bot,
                    },
                    {
                      id: "mcp-server",
                      label: `External AI / MCP API (${
                        (activeProject?.mcp_api_keys || []).length
                      })`,
                      icon: Sparkles,
                    },
                    {
                      id: "debug-console",
                      label: `Debug & Self-Test (${
                        debugModeEnabled ? "ON" : "OFF"
                      })`,
                      icon: Activity,
                    },
                  ].map((t) => {
                    const Icon = t.icon;
                    const active = settingsTab === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setSettingsTab(t.id as typeof settingsTab);
                          if (t.id === "debug-console") fetchDebugSnapshot();
                        }}
                        className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-medium transition ${
                          active
                            ? "bg-nb-gray-900 text-white border border-nb-gray-800"
                            : "text-nb-gray-400 hover:text-white"
                        }`}
                      >
                        <Icon
                          className={`h-3.5 w-3.5 ${
                            active ? "text-netbird" : ""
                          }`}
                        />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                {settingsTab === "setup-keys" && (
                  <div className="rounded-lg border border-nb-gray-900 bg-nb-gray-940 p-6 space-y-4">
                    <h2 className="text-base font-medium text-white">
                      One-Time Peer Setup Keys
                    </h2>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <input
                        type="text"
                        value={gatewayUrl}
                        onChange={(e) => setGatewayUrl(e.target.value)}
                        placeholder="http://<CORE_IP>:8081"
                        className="w-56 rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-netbird"
                      />
                      <input
                        type="text"
                        value={joinNodeName}
                        onChange={(e) => setJoinNodeName(e.target.value)}
                        placeholder="Peer Name (optional, e.g. prod-01)"
                        className="w-52 rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
                      />
                      <select
                        value={joinTier}
                        onChange={(e) =>
                          setJoinTier(e.target.value as AutonomyTier)
                        }
                        className="rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-white"
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
                        className="rounded-md bg-netbird px-4 py-2 text-xs font-medium text-white hover:bg-netbird-500"
                      >
                        Generate Setup Key
                      </button>
                    </div>

                    {oneLineInstallerCmd && (
                      <div className="rounded-lg border border-netbird-500/40 bg-nb-gray-950 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-netbird">
                            1. Fresh Install — Run on target Linux host to install `axon` &amp; connect via token:
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                oneLineInstallerCmd
                              );
                              setCopiedJoinCmd(true);
                              setTimeout(() => setCopiedJoinCmd(false), 2500);
                            }}
                            className="rounded bg-netbird px-3 py-1 text-[11px] font-medium text-white"
                          >
                            {copiedJoinCmd ? "✔ Copied!" : "Copy Command"}
                          </button>
                        </div>
                        <pre className="overflow-x-auto rounded bg-nb-gray-960 p-3 font-mono text-xs text-green-400">
                          {oneLineInstallerCmd}
                        </pre>
                      </div>
                    )}

                    <div className="rounded-lg border border-sky-500/40 bg-nb-gray-950 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-medium text-sky-400">
                            2. Switch / Rebind Existing Muscle Agent via CLI (`axon switch`)
                          </span>
                          <p className="text-[11px] text-nb-gray-400">
                            Already have `axon` installed? Run this in your shell to connect it to this Core with a new token (or use `axon profiles` to switch saved Cores):
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(rebindCliCmd);
                            setCopiedRebindCmd(true);
                            setTimeout(() => setCopiedRebindCmd(false), 2500);
                          }}
                          className="rounded border border-sky-500/50 bg-sky-950 px-3 py-1 text-[11px] font-medium text-sky-300 hover:bg-sky-900"
                        >
                          {copiedRebindCmd ? "✔ Copied CLI!" : "Copy CLI Switch"}
                        </button>
                      </div>
                      <pre className="overflow-x-auto rounded bg-nb-gray-960 p-3 font-mono text-xs text-sky-300">
                        {rebindCliCmd}
                      </pre>
                    </div>
                  </div>
                )}

                {settingsTab === "secrets-vault" && (
                  <div className="rounded-lg border border-nb-gray-900 bg-nb-gray-940 p-6 space-y-4">
                    <h2 className="text-base font-medium text-white">
                      AES-256-GCM Encrypted Secrets Vault (`Secrets.enc`)
                    </h2>
                    <form onSubmit={handleAddSecret} className="flex gap-2.5">
                      <input
                        type="text"
                        value={newSecretKey}
                        onChange={(e) => setNewSecretKey(e.target.value)}
                        placeholder="SECRET_KEY_NAME"
                        className="flex-1 rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-white"
                      />
                      <input
                        type="password"
                        value={newSecretVal}
                        onChange={(e) => setNewSecretVal(e.target.value)}
                        placeholder="Secret plaintext value (write-only)..."
                        className="flex-1 rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-white"
                      />
                      <button
                        type="submit"
                        className="rounded-md bg-netbird px-4 py-2 text-xs font-medium text-white hover:bg-netbird-500"
                      >
                        Encrypt &amp; Save
                      </button>
                    </form>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {secretKeys.map((k) => (
                        <div
                          key={k}
                          className="flex items-center justify-between rounded-md border border-nb-gray-800 bg-nb-gray-930 px-3.5 py-2.5 font-mono text-xs"
                        >
                          <span className="text-netbird">{k}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-nb-gray-400">
                              AES-256-GCM
                            </span>
                            <button
                              onClick={() => handleDeleteSecret(k)}
                              className="text-nb-gray-400 hover:text-red-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {settingsTab === "ai-providers" && (
                  <div className="rounded-lg border border-nb-gray-900 bg-nb-gray-940 p-6">
                    <form
                      onSubmit={handleSaveAiEndpoint}
                      className="space-y-4 text-xs max-w-xl"
                    >
                      <div>
                        <label className="block text-nb-gray-200 font-medium mb-1.5">
                          Provider Preset
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
                          className="w-full rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 text-xs text-white"
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
                          API Base URL
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            className="flex-1 rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-netbird"
                          />
                          <button
                            type="button"
                            onClick={handleSyncModels}
                            className="rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-nb-gray-200 hover:text-white"
                          >
                            Fetch /models
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-nb-gray-200 font-medium mb-1.5">
                          Model Name
                        </label>
                        <input
                          type="text"
                          value={modelName}
                          onChange={(e) => setModelName(e.target.value)}
                          className="w-full rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-nb-gray-200 font-medium mb-1.5">
                          API Key (Encrypted in `Secrets.enc` as{" "}
                          <code>{apiKeySecretName}</code>)
                        </label>
                        <input
                          type="password"
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          placeholder="sk-..."
                          className="w-full rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-white"
                        />
                      </div>

                      <button
                        type="submit"
                        className="rounded-md bg-netbird px-5 py-2 text-xs font-medium text-white hover:bg-netbird-500"
                      >
                        Save AI Provider
                      </button>
                    </form>
                  </div>
                )}

                {settingsTab === "mcp-server" && (
                  <div className="space-y-5">
                    <div className="rounded-lg border border-nb-gray-900 bg-nb-gray-940 p-6 space-y-4">
                      <div>
                        <h2 className="text-base font-medium text-white flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-netbird" />
                          External AI Access &amp; Model Context Protocol (MCP) Server (`/api/mcp`)
                        </h2>
                        <p className="text-xs text-nb-gray-400 mt-0.5">
                          Allow external AI agents (Claude Desktop, Cursor, Windsurf, Antigravity, OpenCode, or custom REST/JSON-RPC bots) to control your Synapse Core &amp; Muscle peers securely via an MCP API Token.
                        </p>
                      </div>

                      <form
                        onSubmit={handleCreateMcpKey}
                        className="flex flex-wrap items-center gap-2.5 text-xs"
                      >
                        <input
                          type="text"
                          value={mcpKeyName}
                          onChange={(e) => setMcpKeyName(e.target.value)}
                          placeholder="Client name (e.g. Claude Desktop / Cursor)"
                          className="flex-1 min-w-[220px] rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-white"
                        />
                        <select
                          value={mcpKeyScopeMode}
                          onChange={(e) =>
                            setMcpKeyScopeMode(
                              e.target.value as "read-exec" | "read-only"
                            )
                          }
                          className="rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-white"
                        >
                          <option value="read-exec">
                            Full Access (Read + Execute PTY/FS + Admin)
                          </option>
                          <option value="read-only">
                            Read-Only (Inspect Peers, Files &amp; Brain Docs)
                          </option>
                        </select>
                        <button
                          type="submit"
                          className="rounded-md bg-netbird px-4 py-2 text-xs font-medium text-white hover:bg-netbird-500"
                        >
                          + Generate MCP API Key
                        </button>
                      </form>

                      {issuedMcpToken && (
                        <div className="rounded-lg border border-green-500/50 bg-green-950/20 p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-green-400">
                              ✔ New MCP API Key Generated (copy now — stored as SHA-256 hash):
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(issuedMcpToken);
                                setCopiedMcpToken(true);
                                setTimeout(() => setCopiedMcpToken(false), 2500);
                              }}
                              className="rounded bg-green-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-green-500"
                            >
                              {copiedMcpToken ? "✔ Copied Token!" : "Copy Token"}
                            </button>
                          </div>
                          <pre className="overflow-x-auto rounded bg-nb-gray-960 p-3 font-mono text-xs text-green-300">
                            {issuedMcpToken}
                          </pre>
                        </div>
                      )}

                      {/* Active MCP API Keys List */}
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-nb-gray-300">
                          Active External AI / MCP Tokens
                        </div>
                        {(activeProject?.mcp_api_keys || []).length === 0 ? (
                          <div className="rounded border border-nb-gray-800 bg-nb-gray-950 p-3 text-xs text-nb-gray-400">
                            No MCP API tokens created yet. Click &ldquo;+ Generate MCP API Key&rdquo; above to issue one.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {(activeProject?.mcp_api_keys || []).map((k) => (
                              <div
                                key={k.key_id}
                                className="flex items-center justify-between rounded border border-nb-gray-800 bg-nb-gray-950 px-3.5 py-2 text-xs"
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
                                  Revoke
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* MCP Client Config & REST Examples */}
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 pt-2">
                        <div className="rounded-md border border-nb-gray-800 bg-nb-gray-950 p-4 space-y-2">
                          <div className="text-xs font-semibold text-sky-400">
                            1. MCP Client Config (`mcp_config.json` — Claude / Cursor / Antigravity)
                          </div>
                          <pre className="overflow-x-auto rounded bg-nb-gray-960 p-3 font-mono text-[11px] text-nb-gray-200 leading-relaxed">
{`{
  "mcpServers": {
    "synapse-core": {
      "url": "${
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost:3000"
      }/api/mcp?project_id=${activeProject?.project_id || "synapse-cloud-demo"}",
      "headers": {
        "Authorization": "Bearer ${issuedMcpToken || "syn_mcp_<YOUR_TOKEN>"}"
      }
    }
  }
}`}
                          </pre>
                        </div>

                        <div className="rounded-md border border-nb-gray-800 bg-nb-gray-950 p-4 space-y-2">
                          <div className="text-xs font-semibold text-emerald-400">
                            2. Direct REST / JSON-RPC Tool Call (`curl` / Custom AI Agent)
                          </div>
                          <pre className="overflow-x-auto rounded bg-nb-gray-960 p-3 font-mono text-[11px] text-nb-gray-200 leading-relaxed">
{`# Execute any tool directly via REST or JSON-RPC 2.0:
curl -X POST ${
  typeof window !== "undefined"
    ? window.location.origin
    : "http://localhost:3000"
}/api/mcp \\
  -H "Authorization: Bearer ${issuedMcpToken || "syn_mcp_<YOUR_TOKEN>"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "node_pty_exec",
    "arguments": {
      "node_id": "${primaryNode || "node-01"}",
      "session_id": "mcp-shell",
      "command": "uname -a && uptime"
    }
  }'`}
                          </pre>
                        </div>
                      </div>

                      {/* Interactive Live MCP Tester */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-nb-gray-300">
                            Live MCP Protocol Tester (`JSON-RPC 2.0`)
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleTestMcpEndpoint("tools/list")}
                              className="rounded border border-netbird-500/40 bg-netbird-950 px-3 py-1 font-mono text-[11px] text-netbird hover:bg-netbird hover:text-white"
                            >
                              Test `tools/list` (10 Tools)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleTestMcpEndpoint("resources/list")
                              }
                              className="rounded border border-nb-gray-800 bg-nb-gray-920 px-3 py-1 font-mono text-[11px] text-nb-gray-200 hover:text-white"
                            >
                              Test `resources/list`
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTestMcpEndpoint("call_state")}
                              className="rounded border border-nb-gray-800 bg-nb-gray-920 px-3 py-1 font-mono text-[11px] text-nb-gray-200 hover:text-white"
                            >
                              Call `synapse_get_project_state`
                            </button>
                          </div>
                        </div>
                        {mcpTestOutput && (
                          <pre className="max-h-72 overflow-auto rounded-md border border-nb-gray-800 bg-nb-gray-960 p-3.5 font-mono text-[11px] text-green-400">
                            {mcpTestOutput}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === "debug-console" && (
                  <div className="space-y-5">
                    <div className="rounded-lg border border-nb-gray-900 bg-nb-gray-940 p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-base font-medium text-white flex items-center gap-2">
                            <Activity className="h-4 w-4 text-amber-400" />
                            Core &amp; Muscle Debug Mode + End-to-End Self-Test
                          </h2>
                          <p className="text-xs text-nb-gray-400 mt-0.5">
                            Inspect live mTLS 1.3 + Yamux stream traces, verify AES-256-GCM Vault integrity, and run diagnostic checks on both Core and Muscle.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleToggleDebugMode}
                            className={`rounded-md border px-3.5 py-2 font-mono text-xs font-medium transition ${
                              debugModeEnabled
                                ? "border-amber-500 bg-amber-950 text-amber-300"
                                : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-300 hover:text-white"
                            }`}
                          >
                            {debugModeEnabled
                              ? "● Debug Mode: ENABLED"
                              : "○ Enable Debug Mode"}
                          </button>
                          <button
                            onClick={handleRunSelfTest}
                            disabled={runningSelfTest}
                            className="rounded-md bg-netbird px-4 py-2 text-xs font-medium text-white hover:bg-netbird-500 disabled:opacity-50"
                          >
                            {runningSelfTest
                              ? "Running Self-Test..."
                              : "▶ Run 5-Step Self-Test"}
                          </button>
                          <button
                            onClick={fetchDebugSnapshot}
                            className="rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-nb-gray-300 hover:text-white"
                          >
                            Refresh
                          </button>
                        </div>
                      </div>

                      {selfTestChecks.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <div className="text-xs font-semibold uppercase tracking-wider text-nb-gray-300">
                            End-to-End Diagnostic Checks
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            {selfTestChecks.map((chk) => (
                              <div
                                key={chk.id}
                                className="flex items-center justify-between gap-3 rounded-md border border-nb-gray-800 bg-nb-gray-950 p-3 text-xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                                        chk.status === "PASS"
                                          ? "bg-green-950 text-green-400 border border-green-500/40"
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
                      <div className="rounded-md border border-nb-gray-800 bg-nb-gray-950 p-4 space-y-2">
                        <div className="text-xs font-semibold text-sky-400">
                          CLI Debug Commands for Core &amp; Muscle (`axon debug` / `--debug`)
                        </div>
                        <pre className="overflow-x-auto rounded bg-nb-gray-960 p-3 font-mono text-[11px] text-nb-gray-200 leading-relaxed">
{`# 1. Run 5-step Muscle diagnostic doctor (checks X.509 cert, Core HTTP latency, mTLS 1.3 handshake & FS permissions)
sudo axon debug

# 2. Persist Debug Mode on the Muscle agent and run with live microsecond Yamux & PTY stream logs
sudo axon debug --enable
axon run --debug --core ${gatewayUrl.replace(/\/$/, "")}${issuedToken ? ` --token ${issuedToken}` : " --token <JOIN_TOKEN>"}

# 3. Start Core Gateway with verbose mTLS / Yamux / RPC debug trace logging
SYNAPSE_DEBUG=1 ./bin/core-gateway --debug`}
                        </pre>
                      </div>

                      {/* Live JSON Snapshot of Core Web + Core Gateway Ring Buffer */}
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-nb-gray-300">
                          Live Core Web &amp; Gateway Diagnostic Snapshot (`/api/debug`)
                        </div>
                        <pre className="max-h-80 overflow-auto rounded-md border border-nb-gray-800 bg-nb-gray-960 p-3.5 font-mono text-[11px] text-green-400">
                          {debugSnapshot
                            ? JSON.stringify(debugSnapshot, null, 2)
                            : "Click 'Refresh' or 'Run 5-Step Self-Test' to inspect live Core & Gateway state."}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────────
              RIGHT DOCKED AI COPILOT & REACT ORCHESTRATOR PANEL
              (With Drag & Drop Vision, Prompt/Tool Caching, Live Thinking & Rollback)
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
              className={`relative flex shrink-0 flex-col border-l border-nb-gray-900 bg-nb-gray-940 transition-all duration-200 ${
                copilotWide ? "w-[580px]" : "w-[410px]"
              }`}
            >
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

              {/* Header + Prompt Cache Status Badge */}
              <div className="border-b border-nb-gray-900 px-4 py-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-netbird" />
                    <span className="text-xs font-semibold text-white">
                      Synapse AI Orchestrator
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCopilotWide((w) => !w)}
                      className="rounded px-2 py-0.5 text-[10px] text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
                      title={
                        copilotWide
                          ? "Auf Standardbreite verkleinern"
                          : "Chat-Fenster verbreitern"
                      }
                    >
                      {copilotWide ? "Kompakt" : "Breiter"}
                    </button>
                    <button
                      onClick={handleClearChat}
                      className="rounded px-2 py-0.5 text-[10px] text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
                      title="Clear conversation"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setCopilotDrawerOpen(false)}
                      className="text-nb-gray-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
                  <span
                    className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 font-mono text-emerald-300"
                    title="Static 5-Layer System Prefix & Read-Only FS Calls Cached"
                  >
                    <Zap className="h-2.5 w-2.5 text-emerald-400" />
                    {latestCacheMetrics ? (
                      <span>
                        Cache: {latestCacheMetrics.cached_tokens} tok
                        {latestCacheMetrics.tool_cache_hits > 0
                          ? ` · ${latestCacheMetrics.tool_cache_hits} FS hit(s)`
                          : ""}
                      </span>
                    ) : (
                      <span>Prefix &amp; Tool Cache Ready</span>
                    )}
                  </span>

                  <span className="font-mono text-nb-gray-400">
                    Vision · @Mentions · Rollback
                  </span>
                </div>
              </div>

              {/* Chat Messages + Multimodal Previews + Reasoning + Rollback */}
              <div
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-3.5"
              >
                {chatHistory.map((msg, idx) => {
                  const thinkingOpen = expandedThinking[idx];
                  return (
                    <div
                      key={idx}
                      className={`min-w-0 overflow-hidden break-words rounded-lg p-3.5 text-xs ${
                        msg.role === "user"
                          ? "ml-5 border border-netbird-500/40 bg-netbird-950/50 text-white"
                          : "border border-nb-gray-800/80 bg-nb-gray-930 text-nb-gray-100"
                      }`}
                    >
                      {/* Attached Vision Images / Files inside User Message */}
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

                      {/* Collapsible AI Reasoning / Thinking Trace */}
                      {msg.thinking && (
                        <div className="mb-2.5 rounded border border-nb-gray-800 bg-nb-gray-950/80 px-2.5 py-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedThinking((prev) => ({
                                ...prev,
                                [idx]: !prev[idx],
                              }))
                            }
                            className="flex w-full items-center justify-between font-mono text-[10px] text-nb-gray-300 hover:text-white"
                          >
                            <span className="flex items-center gap-1.5">
                              <Brain className="h-3 w-3 text-netbird" />
                              <span>AI Reasoning &amp; Context Trace</span>
                            </span>
                            <span>{thinkingOpen ? "Hide" : "Show"}</span>
                          </button>
                          {thinkingOpen && (
                            <pre className="mt-1.5 whitespace-pre-wrap border-t border-nb-gray-800 pt-1.5 font-mono text-[10px] text-nb-gray-400">
                              {msg.thinking}
                            </pre>
                          )}
                        </div>
                      )}

                      <RichMarkdownDocument
                        markdown={msg.content}
                        variant="chat"
                      />

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

                        const isSkillReport =
                          !showInterviewControls &&
                          !prevUserContent.includes("[Interview-") &&
                          (prevUserContent.includes("[Skill: CheckSystem]") ||
                            prevUserContent.includes("[Skill: CheckOpsec]") ||
                            prevUserContent.includes("[Skill: DeepForensics]") ||
                            (msg.content.length > 400 &&
                              (msg.toolResults?.length || 0) >= 2 &&
                              /Empfehlung|Härtung|Befund|OpSec|Verbesserung|CheckSystem|CheckOpsec|Forensik/i.test(
                                msg.content
                              )));

                        if (showInterviewControls) {
                          return (
                            <div className="mt-3 rounded-lg border border-netbird-500/40 bg-nb-gray-940 p-2.5 space-y-2">
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
                                  className="flex items-center gap-1.5 rounded-md border border-emerald-500/50 bg-emerald-950/50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-900/70 hover:text-white disabled:opacity-40 transition"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                  <span>Ja, jetzt beheben</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={chatBusy}
                                  onClick={() => handleInterviewStepResponse("skip")}
                                  className="flex items-center gap-1.5 rounded-md border border-nb-gray-700 bg-nb-gray-900 px-2.5 py-1.5 text-[11px] font-medium text-nb-gray-200 hover:border-nb-gray-500 hover:text-white disabled:opacity-40 transition"
                                >
                                  <ChevronRight className="h-3.5 w-3.5 text-nb-gray-400" />
                                  <span>Nicht beheben (Nächster Punkt)</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={chatBusy}
                                  onClick={() => handleInterviewStepResponse("fix_all")}
                                  className="flex items-center gap-1.5 rounded-md border border-netbird-500/40 bg-netbird/15 px-2.5 py-1.5 text-[11px] font-medium text-netbird hover:bg-netbird/25 hover:text-white disabled:opacity-40 transition"
                                >
                                  <Zap className="h-3.5 w-3.5" />
                                  <span>Alle restlichen beheben</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={chatBusy}
                                  onClick={() => handleInterviewStepResponse("stop")}
                                  className="flex items-center gap-1.5 rounded-md border border-nb-gray-800 bg-nb-gray-950 px-2 py-1.5 text-[11px] text-nb-gray-400 hover:border-red-500/40 hover:text-red-300 disabled:opacity-40 transition"
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
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-netbird-500/40 bg-nb-gray-940 px-3 py-2">
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
                                className="flex shrink-0 items-center gap-1.5 rounded-md bg-netbird px-3 py-1.5 text-xs font-semibold text-white hover:bg-netbird-500 disabled:opacity-40 transition shadow-sm"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>Interview starten</span>
                              </button>
                            </div>
                          );
                        }

                        return null;
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

                      {/* Cleanly Sorted Tool Calls Summary + Dedicated Registered Service Cards */}
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

                        return (
                          <div className="mt-2.5 space-y-2 border-t border-nb-gray-800 pt-2">
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
                                      className="rounded-lg border border-netbird-500/40 bg-nb-gray-940 p-2.5 font-sans text-xs space-y-2"
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

                            {/* 2. Collapsible Technical Tool Execution Log */}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedTurnTools((prev) => ({
                                  ...prev,
                                  [idx]: !prev[idx],
                                }))
                              }
                              className="flex w-full items-center justify-between rounded border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1.5 font-mono text-[10px] text-nb-gray-300 hover:border-nb-gray-700 hover:text-white"
                            >
                              <span>
                                🛠️ {msg.toolResults.length} ausgeführte
                                Tool-Schritte
                              </span>
                              <span className="text-netbird">
                                {turnToolsExpanded
                                  ? "Ausblenden ▲"
                                  : "Details anzeigen ▼"}
                              </span>
                            </button>

                            {turnToolsExpanded && (
                              <div className="space-y-1.5 pl-1">
                                {msg.toolResults.map((tr, tIdx) => {
                                  const key = `${idx}-${tIdx}`;
                                  const open = expandedTools[key];
                                  return (
                                    <div
                                      key={key}
                                      className="rounded border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1.5 font-mono text-[11px]"
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
                                          className="flex flex-1 items-center justify-between text-left"
                                        >
                                          <span className="flex items-center gap-1.5 text-netbird">
                                            <span>{tr.tool_name}</span>
                                            {tr.cached && (
                                              <span className="rounded bg-emerald-950 px-1.5 py-0.2 text-[9px] text-emerald-300 border border-emerald-500/30">
                                                CACHED
                                              </span>
                                            )}
                                          </span>
                                          <span className="text-[10px] uppercase text-green-400">
                                            {tr.status}
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
                                        <pre className="mt-1.5 max-h-36 overflow-auto text-[10px] text-nb-gray-300">
                                          {JSON.stringify(tr.output, null, 2)}
                                        </pre>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}

                {/* Live SSE ReAct Steps + Progressive Thinking & Token Stream */}
                {chatBusy && (
                  <div className="rounded-lg border border-netbird-500/40 bg-nb-gray-930 p-3 text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-netbird font-medium">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>
                          Senior DevOps KI-Analyse läuft ({liveSteps.length} Schritte · {chatElapsedSec}s)...
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-emerald-400">
                        ⚡ Deep-Search &amp; Prefix Cache
                      </span>
                    </div>

                    {liveSteps.map((s, i) => (
                      <div
                        key={i}
                        className="rounded border border-nb-gray-800/80 bg-nb-gray-950/60 px-2.5 py-1.5 font-mono text-[11px] text-nb-gray-300 space-y-0.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5">
                            <span className="text-white">
                              #{s.step} {s.tool_name}
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

                    {streamingThinkingText && (
                      <div className="rounded border border-nb-gray-800 bg-nb-gray-950 p-2 font-mono text-[10px] text-nb-gray-400 whitespace-pre-wrap">
                        <div className="mb-1 flex items-center gap-1 text-netbird">
                          <Brain className="h-3 w-3" />
                          <span>Thinking...</span>
                        </div>
                        {streamingThinkingText}
                      </div>
                    )}

                    {streamingReplyText && (
                      <div className="border-t border-nb-gray-800 pt-2 text-nb-gray-100 min-w-0 break-words">
                        <RichMarkdownDocument
                          markdown={streamingReplyText}
                          variant="chat"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Multimodal Prompt Input Box with Selected Skill Card, Thumbnail Strip, @-Mentions & Drag-and-Drop */}
              <form
                onSubmit={handleSendPrompt}
                className="relative border-t border-nb-gray-900 bg-nb-gray-950 p-3 space-y-2"
              >
                {/* Selected Skill Card (Appears when CheckSystem, CheckOpsec, SkillSearch, or DeepForensics is clicked) */}
                {selectedChatSkill && (
                  <div
                    className={`flex items-start justify-between gap-2.5 rounded-lg border p-2.5 text-xs ${
                      selectedChatSkill === "CheckSystem"
                        ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-100"
                        : selectedChatSkill === "CheckOpsec"
                        ? "border-sky-500/40 bg-sky-950/30 text-sky-100"
                        : selectedChatSkill === "DeepForensics"
                        ? "border-purple-500/40 bg-purple-950/30 text-purple-100"
                        : "border-amber-500/40 bg-amber-950/30 text-amber-100"
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 font-semibold text-white">
                        {selectedChatSkill === "CheckSystem" ? (
                          <Activity className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        ) : selectedChatSkill === "CheckOpsec" ? (
                          <Shield className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                        ) : selectedChatSkill === "DeepForensics" ? (
                          <Cpu className="h-3.5 w-3.5 shrink-0 text-purple-400" />
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
                      <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-purple-400" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-semibold text-xs text-purple-300">
                          <span>DeepForensics</span>
                          <span className="rounded border border-purple-500/30 bg-purple-950/40 px-1.5 py-0.2 font-mono text-[9px] text-purple-300">
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
                  <div className="absolute bottom-full left-3 right-3 mb-1.5 max-h-48 overflow-y-auto rounded-lg border border-nb-gray-800 bg-nb-gray-930 p-1.5 shadow-2xl z-30">
                    <div className="px-2 py-1 font-mono text-[10px] uppercase text-nb-gray-400">
                      Insert @Context Mention
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

                <div className="flex items-stretch gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Attach image, screenshot, diagram, or log file (or Drag & Drop / Ctrl+V)"
                    className="flex h-[46px] w-[38px] shrink-0 items-center justify-center rounded-md border border-nb-gray-800 bg-nb-gray-920 text-nb-gray-300 hover:border-netbird hover:text-white transition"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const next = chatInput.endsWith("@")
                        ? chatInput
                        : `${chatInput}${
                            chatInput && !chatInput.endsWith(" ") ? " @" : "@"
                          }`;
                      handleChatInputChange(next);
                    }}
                    title="Mention a Peer, Service, or Brain Vault Doc (@)"
                    className="flex h-[46px] w-[38px] shrink-0 items-center justify-center rounded-md border border-nb-gray-800 bg-nb-gray-920 text-nb-gray-300 hover:border-netbird hover:text-white transition"
                  >
                    <AtSign className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSkillMenuOpen((v) => !v)}
                    title="AI Skills auswählen (CheckSystem, CheckOpsec, SkillSearch)"
                    className={`flex h-[46px] shrink-0 items-center gap-1 rounded-md border px-2.5 text-[11px] font-medium transition ${
                      skillMenuOpen || selectedChatSkill
                        ? "border-netbird bg-netbird/15 text-netbird"
                        : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-300 hover:border-netbird hover:text-white"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span>Skills</span>
                  </button>

                  <textarea
                    ref={chatInputRef}
                    rows={2}
                    value={chatInput}
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
                        ? "Wonach suchst du im System? (z.B. Firewall, SQL, SSH Keys, Logs)..."
                        : selectedChatSkill
                        ? `Optional: Eigenen Fokus für ${selectedChatSkill} ergänzen...`
                        : "Ask Synapse AI, type @ to mention, or drop/paste images..."
                    }
                    className="h-[46px] flex-1 resize-none rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3 py-1.5 text-xs leading-4 text-white placeholder:text-nb-gray-400 focus:border-netbird focus:outline-none"
                  />

                  <button
                    type="submit"
                    disabled={chatBusy}
                    className="flex h-[46px] w-[42px] shrink-0 items-center justify-center rounded-md bg-netbird text-xs font-medium text-white hover:bg-netbird-500 disabled:opacity-40 transition"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            </aside>
          )}
        </div>

        {/* COLLAPSIBLE BOTTOM LIVE PTY TERMINAL BAR (`xterm.js`) */}
        <div className="shrink-0 border-t border-nb-gray-900 bg-nb-gray-950">
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
                <span>{terminalDrawerOpen ? "Hide" : "Expand"}</span>
                {terminalDrawerOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronUp className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {terminalDrawerOpen && (
            <div className="h-60 border-t border-nb-gray-900 bg-nb-gray-960">
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
                  No Muscle Peer connected. Click &ldquo;+ Add Peer&rdquo; to
                  enroll a Linux node.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 1: NETBIRD "ADD PEER" ONE-COMMAND SETUP MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {addPeerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-lg border border-nb-gray-800 bg-nb-gray-940 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-nb-gray-900 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md border border-netbird-500/40 bg-netbird-950 text-netbird">
                  <MonitorSmartphone className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-medium text-white">
                    Add New Muscle Peer (Linux / Docker)
                  </h3>
                  <p className="text-xs text-nb-gray-400">
                    One-command installation with automatic token login &amp;
                    mTLS 1.3 enrollment.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAddPeerModalOpen(false)}
                className="text-nb-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
              <div>
                <label className="block text-nb-gray-300 mb-1">
                  Core Gateway URL
                </label>
                <input
                  type="text"
                  value={gatewayUrl}
                  onChange={(e) => setGatewayUrl(e.target.value)}
                  className="w-full rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-netbird"
                />
              </div>
              <div>
                <label className="block text-nb-gray-300 mb-1">
                  Autonomy Tier
                </label>
                <select
                  value={joinTier}
                  onChange={(e) => setJoinTier(e.target.value as AutonomyTier)}
                  className="w-full rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-white"
                >
                  <option value="TIER_1_UNLEASHED">TIER_1_UNLEASHED</option>
                  <option value="TIER_2_WORKSPACE_JAIL">
                    TIER_2_WORKSPACE_JAIL
                  </option>
                  <option value="TIER_3_SUPERVISED">TIER_3_SUPERVISED</option>
                </select>
              </div>
              <div>
                <label className="block text-nb-gray-300 mb-1">
                  Peer ID (Optional)
                </label>
                <input
                  type="text"
                  value={joinNodeName}
                  onChange={(e) => setJoinNodeName(e.target.value)}
                  placeholder="e.g. prod-node-01"
                  className="w-full rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-nb-gray-200">
                  Run this single command on your Linux server:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGenerateJoinToken}
                    className="rounded border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-1 text-[11px] text-nb-gray-300 hover:text-white"
                  >
                    Rotate Token
                  </button>
                  {oneLineInstallerCmd && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(oneLineInstallerCmd);
                        setCopiedJoinCmd(true);
                        setTimeout(() => setCopiedJoinCmd(false), 2500);
                      }}
                      className="flex items-center gap-1 rounded bg-netbird px-3 py-1 text-[11px] font-medium text-white hover:bg-netbird-500"
                    >
                      <Copy className="h-3 w-3" />
                      <span>{copiedJoinCmd ? "Copied!" : "Copy"}</span>
                    </button>
                  )}
                </div>
              </div>
              <pre className="overflow-x-auto rounded-md border border-nb-gray-800 bg-nb-gray-960 p-3.5 font-mono text-xs text-green-400">
                {oneLineInstallerCmd || "Generating setup token..."}
              </pre>
            </div>

            <div className="space-y-2 border-t border-nb-gray-900 pt-3">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-medium text-sky-400">
                    Or switch an existing Muscle via CLI (`axon switch`):
                  </span>
                  <p className="text-[11px] text-nb-gray-400">
                    Rebind an installed Muscle agent to this Core with a new token (old Core profile is saved under `axon profiles`):
                  </p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(rebindCliCmd);
                    setCopiedRebindCmd(true);
                    setTimeout(() => setCopiedRebindCmd(false), 2500);
                  }}
                  className="flex items-center gap-1 rounded border border-sky-500/50 bg-sky-950 px-3 py-1 text-[11px] font-medium text-sky-300 hover:bg-sky-900"
                >
                  <Copy className="h-3 w-3" />
                  <span>{copiedRebindCmd ? "Copied CLI!" : "Copy CLI"}</span>
                </button>
              </div>
              <pre className="overflow-x-auto rounded-md border border-nb-gray-800 bg-nb-gray-960 p-3 font-mono text-xs text-sky-300">
                {rebindCliCmd}
              </pre>
            </div>

            <div className="flex items-center justify-between border-t border-nb-gray-900 pt-3 text-xs text-nb-gray-400">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                Waiting for incoming mTLS 1.3 + Yamux peer handshake...
              </span>
              <button
                onClick={() => setAddPeerModalOpen(false)}
                className="rounded-md border border-nb-gray-800 bg-nb-gray-920 px-4 py-1.5 text-xs text-white hover:bg-nb-gray-900"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL 2: CUSTOM API BASE URL & MODEL CONFIGURATION
      ═══════════════════════════════════════════════════════════════════════ */}
      {aiEndpointModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-lg border border-nb-gray-800 bg-nb-gray-940 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-nb-gray-900 pb-3.5">
              <div>
                <h3 className="text-base font-medium text-white">
                  AI Provider &amp; Custom API Base URL
                </h3>
                <p className="text-xs text-nb-gray-400 mt-0.5">
                  Connect OpenRouter, vLLM, LiteLLM, Ollama, or OpenAI.
                </p>
              </div>
              <button
                onClick={() => setAiEndpointModalOpen(false)}
                className="text-nb-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAiEndpoint} className="space-y-4 text-xs">
              <div>
                <label className="block text-nb-gray-300 font-medium mb-1.5">
                  Provider Preset
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
                  className="w-full rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2.5 text-xs text-white"
                >
                  {Object.entries(PROVIDER_PRESETS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-nb-gray-300 font-medium mb-1.5">
                  API Base URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="flex-1 rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-netbird"
                  />
                  <button
                    type="button"
                    onClick={handleSyncModels}
                    disabled={syncingModels}
                    className="flex items-center gap-1.5 rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-nb-gray-200 hover:text-white"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        syncingModels ? "animate-spin" : ""
                      }`}
                    />
                    <span>Fetch Models</span>
                  </button>
                </div>
                {modelSyncStatus && (
                  <p className="mt-1 font-mono text-[11px] text-netbird">
                    {modelSyncStatus}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-nb-gray-300 font-medium mb-1.5">
                  Model Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="flex-1 rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-white"
                  />
                  {discoveredModels.length > 0 && (
                    <select
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      className="max-w-[180px] rounded-md border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-2 font-mono text-xs text-netbird"
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
                <label className="block text-nb-gray-300 font-medium mb-1.5">
                  API Key (Encrypted in `Secrets.enc` as{" "}
                  <code>{apiKeySecretName}</code>)
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={
                    secretKeys.includes(apiKeySecretName)
                      ? "•••••••• (Saved in Secrets.enc)"
                      : "sk-..."
                  }
                  className="w-full rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1">
                <label className="flex items-center gap-2.5 rounded-md border border-nb-gray-800 bg-nb-gray-920 p-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enablePromptCaching}
                    onChange={(e) => setEnablePromptCaching(e.target.checked)}
                    className="rounded border-nb-gray-700 accent-netbird"
                  />
                  <div>
                    <div className="font-medium text-white">
                      Prompt &amp; FS Caching
                    </div>
                    <div className="text-[10px] text-nb-gray-400">
                      Cache static system layers &amp; file reads
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 rounded-md border border-nb-gray-800 bg-nb-gray-920 p-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableAutoWatchdog}
                    onChange={(e) => setEnableAutoWatchdog(e.target.checked)}
                    className="rounded border-nb-gray-700 accent-netbird"
                  />
                  <div>
                    <div className="font-medium text-white">
                      Proactive Auto-Watchdog
                    </div>
                    <div className="text-[10px] text-nb-gray-400">
                      Auto-heal crashed services in background
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-nb-gray-900">
                <button
                  type="button"
                  onClick={() => setAiEndpointModalOpen(false)}
                  className="rounded-md border border-nb-gray-800 bg-nb-gray-920 px-4 py-2 text-xs text-nb-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-netbird px-5 py-2 text-xs font-medium text-white hover:bg-netbird-500"
                >
                  Save Provider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE NEW PROJECT VAULT */}
      {newProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newProjName.trim()) return;
              const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "create_project",
                  new_project_id: newProjName,
                  name: newProjName,
                }),
              });
              const data = await res.json();
              setNewProjName("");
              setNewProjectModal(false);
              if (data.project?.project_id) {
                await loadWorkspace(data.project.project_id, true);
              }
            }}
            className="w-full max-w-sm rounded-lg border border-nb-gray-800 bg-nb-gray-940 p-5 space-y-4"
          >
            <div className="flex items-center justify-between text-sm font-medium text-white">
              <span>Create New Project Vault</span>
              <button
                type="button"
                onClick={() => setNewProjectModal(false)}
                className="text-nb-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
              placeholder="Project name (e.g. prod-mesh)"
              className="w-full rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 text-xs text-white"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-md bg-netbird px-4 py-2 text-xs font-medium text-white hover:bg-netbird-500"
              >
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: CTRL+K COMMAND PALETTE */}
      {commandPaletteOpen && (
        <div
          onClick={() => setCommandPaletteOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 pt-24 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-lg border border-nb-gray-800 bg-nb-gray-940 shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-nb-gray-900 px-4 py-3">
              <Search className="h-4 w-4 text-netbird" />
              <input
                type="text"
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Jump to Control Center, Peers, Access Control, Proxy..."
                className="flex-1 bg-transparent text-xs text-white placeholder:text-nb-gray-400 focus:outline-none"
              />
              <span className="rounded border border-nb-gray-800 bg-nb-gray-920 px-1.5 py-0.5 font-mono text-[10px] text-nb-gray-400">
                ESC
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {sidebarItems
                .filter(
                  (i) =>
                    !commandQuery.trim() ||
                    i.label.toLowerCase().includes(commandQuery.toLowerCase())
                )
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveNav(item.id);
                      setCommandPaletteOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-md px-3.5 py-2 text-left text-xs text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white"
                  >
                    <span>{item.label}</span>
                    <span className="font-mono text-[10px] text-netbird">
                      Navigate
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
