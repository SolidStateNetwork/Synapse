"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
  Bot,
  BookOpen,
  Check,
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
  const [selectedCartridgeId, setSelectedCartridgeId] =
    useState<string>("docker-first");

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
  const [chatBusy, setChatBusy] = useState(false);
  const [liveSteps, setLiveSteps] = useState<
    Array<{
      step: number;
      tool_name: string;
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
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<
    "all" | "webui" | "backend" | "database"
  >("all");
  const [serviceWorkspaceTab, setServiceWorkspaceTab] = useState<
    "split" | "preview" | "tester"
  >("split");
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
      const pid = projectId || activeProject?.project_id || "synapse-cloud-demo";
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
    attachmentsToSend?: ChatAttachment[]
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
          messages: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
            attachments: m.attachments,
          })),
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
                  status: "running",
                },
              ]);
            } else if (evt.type === "step_done" && evt.result) {
              setLiveSteps((prev) =>
                prev.map((s) =>
                  s.step === evt.step && s.tool_name === evt.result.tool_name
                    ? {
                        ...s,
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
    if ((!chatInput.trim() && chatAttachments.length === 0) || chatBusy) return;
    const text = chatInput.trim();
    const atts = [...chatAttachments];
    setChatInput("");
    setChatAttachments([]);
    setMentionMenuOpen(false);
    await runStreamingPrompt(text, undefined, atts);
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
      label: "Projekt-Übersicht",
      icon: Network,
    },
    {
      id: "reverse-proxy",
      section: "Übersicht & Dienste",
      label: "Services & Live-Preview",
      icon: Globe,
      badge:
        unhealthyServices.length > 0
          ? `${unhealthyServices.length} !`
          : activeProject?.registered_services?.length || undefined,
      badgeColor: unhealthyServices.length > 0 ? "red" : "green",
    },
    {
      id: "peers",
      section: "Übersicht & Dienste",
      label: "Peers & Cluster",
      icon: MonitorSmartphone,
      badge: gatewayNodes.length,
      badgeColor: gatewayNodes.length > 0 ? "green" : undefined,
    },
    {
      id: "brain-vault",
      section: "Projekt & Dateien",
      label: "Brain Vault (Doku)",
      icon: BookOpen,
    },
    {
      id: "workspace",
      section: "Projekt & Dateien",
      label: "Remote Files (Code)",
      icon: Code2,
    },
    {
      id: "access-control",
      section: "Sicherheit & System",
      label: "Regeln & Freigaben",
      icon: Shield,
      badge:
        pendingApprovals.length > 0
          ? pendingApprovals.length
          : activeProject?.active_cartridges?.length || 0,
      badgeColor: pendingApprovals.length > 0 ? "orange" : undefined,
    },
    {
      id: "activity",
      section: "Sicherheit & System",
      label: "Audit-Log",
      icon: Activity,
      badge: auditLogs.length || undefined,
    },
    {
      id: "settings",
      section: "Sicherheit & System",
      label: "Einstellungen & Debug",
      icon: Settings,
    },
  ];

  return (
    <div className="dark flex h-screen w-screen overflow-hidden bg-nb-gray-950 text-nb-gray-100">
      {/* ═══════════════════════════════════════════════════════════════════════
          1:1 NETBIRD LEFT VERTICAL SIDEBAR NAVIGATION
      ═══════════════════════════════════════════════════════════════════════ */}
      <aside
        className={`flex shrink-0 flex-col justify-between border-r border-nb-gray-900 bg-nb-gray-950 transition-all duration-200 ${
          sidebarCollapsed ? "w-[68px]" : "w-[238px]"
        }`}
      >
        {/* Top Brand + Project Switcher */}
        <div className="space-y-3 p-3.5">
          <div className="flex items-center justify-between px-1.5">
            <div
              onClick={() => setActiveNav("control-center")}
              className="flex cursor-pointer items-center gap-2.5"
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
              className="rounded-md p-1.5 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
                title="Create New Project Vault"
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
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-[0.46rem] text-[0.84rem] font-normal transition-colors ${
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
                      {!sidebarCollapsed && item.badge !== undefined && (
                        <span
                          className={`rounded-md border px-1.5 py-0.5 font-mono text-[10px] leading-none ${
                            item.badgeColor === "orange"
                              ? "border-netbird-500 bg-netbird-950 text-netbird"
                              : item.badgeColor === "red"
                              ? "border-red-500 bg-red-950/60 text-red-400 animate-pulse"
                              : item.badgeColor === "green"
                              ? "border-green-500/60 bg-green-950 text-green-400"
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

        {/* Bottom Sidebar NavigationUsageInfo Card (NetBird Style) */}
        <div className="p-3.5 space-y-2.5">
          {!sidebarCollapsed ? (
            <div className="rounded-lg border border-nb-gray-900 bg-nb-gray-940 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-nb-gray-200 flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      activeProject?.planning_only
                        ? "bg-amber-400"
                        : "bg-green-400"
                    }`}
                  />
                  {activeProject?.planning_only
                    ? "Planning-Only"
                    : "mTLS 1.3 Mesh"}
                </span>
                <span className="font-mono text-[10px] text-nb-gray-400">
                  :8443 Yamux
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-nb-gray-400">
                <span>Connected Peers</span>
                <span className="font-mono text-nb-gray-200">
                  {gatewayNodes.filter((n) => n.online).length} /{" "}
                  {gatewayNodes.length || 1}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-nb-gray-900">
                <div
                  className="h-full rounded-full bg-netbird transition-all"
                  style={{
                    width:
                      gatewayNodes.length > 0 ? "100%" : "20%",
                  }}
                />
              </div>
              <button
                onClick={() => {
                  setAddPeerModalOpen(true);
                  if (!issuedToken) handleGenerateJoinToken();
                }}
                className="w-full rounded-md border border-netbird-500/40 bg-netbird-950/70 py-1.5 text-center text-xs font-medium text-netbird hover:bg-netbird hover:text-white transition-colors"
              >
                + Add Muscle Peer
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setAddPeerModalOpen(true);
                if (!issuedToken) handleGenerateJoinToken();
              }}
              className="flex w-full items-center justify-center rounded-md bg-netbird p-2 text-white hover:bg-netbird-500"
              title="Add Peer"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN WORKSPACE COLUMN (Top NetBird ControlCenterHeader + Content + PTY)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TOP NETBIRD HEADER BAR (`ControlCenterHeader` + `FlowSelector`) */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-nb-gray-900 bg-nb-gray-950 px-5">
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
                className="hidden md:flex cursor-pointer items-center gap-1.5 rounded-md border border-green-500/40 bg-green-950/70 px-2.5 py-1 text-[11px] text-green-400 hover:bg-green-950"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="font-mono">{primaryNode}</span>
              </div>
            ) : (
              <button
                onClick={() => {
                  setAddPeerModalOpen(true);
                  handleGenerateJoinToken();
                }}
                className="hidden md:flex items-center gap-1.5 rounded-md border border-amber-500/50 bg-yellow-950/70 px-2.5 py-1 text-[11px] text-yellow-400 hover:bg-yellow-950"
              >
                <Lock className="h-3 w-3" />
                <span>Planning-Only · Add Peer</span>
              </button>
            )}
          </div>

          {/* Center: NetBird `FlowSelector` SegmentedTabs (when in Control Center) */}
          {activeNav === "control-center" && (
            <div className="hidden lg:flex items-center rounded-lg border border-nb-gray-800/80 bg-nb-gray-930 p-1">
              {[
                {
                  id: "peers",
                  label: "Peer",
                  icon: MonitorSmartphone,
                },
                {
                  id: "ai-agent",
                  label: "AI Agent",
                  icon: Bot,
                },
                {
                  id: "groups",
                  label: "Vault & Groups",
                  icon: FolderGit2,
                },
                {
                  id: "networks",
                  label: "Networks & Services",
                  icon: Network,
                },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = flowView === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setFlowView(tab.id as FlowView)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "bg-nb-gray-900 text-white shadow-sm border border-nb-gray-800"
                        : "text-nb-gray-400 hover:text-nb-gray-200"
                    }`}
                  >
                    <Icon size={12} className={active ? "text-netbird" : ""} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Right: Unhealthy Alert + Search (Ctrl+K) + AI Model Pill + Copilot Toggle + Add Peer */}
          <div className="flex items-center gap-2">
            {statusToast && (
              <span className="hidden xl:inline-block rounded-md border border-green-500/40 bg-green-950 px-2.5 py-1 font-mono text-[11px] text-green-400">
                {statusToast}
              </span>
            )}

            {unhealthyServices.length > 0 && (
              <button
                onClick={() =>
                  handleQuickAction(
                    `diagnose and auto-heal service ${unhealthyServices[0].port}`
                  )
                }
                className="flex items-center gap-1.5 rounded-md border border-red-500 bg-red-950/60 px-2.5 py-1 text-xs font-medium text-red-400 hover:bg-red-900/50 animate-pulse"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Heal :{unhealthyServices[0].port}</span>
              </button>
            )}

            <button
              onClick={() => {
                setActiveNav("settings");
                setSettingsTab("debug-console");
                fetchDebugSnapshot();
              }}
              className={`hidden sm:flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                debugModeEnabled
                  ? "border-amber-500/60 bg-amber-950/60 text-amber-300"
                  : "border-nb-gray-800/80 bg-nb-gray-920 text-nb-gray-300 hover:text-white"
              }`}
              title="Open Core & Muscle Debug Mode & Self-Test Inspector"
            >
              <Activity className="h-3.5 w-3.5 text-amber-400" />
              <span>{debugModeEnabled ? "DEBUG: ON" : "Debug"}</span>
            </button>

            <button
              onClick={() => {
                setCommandPaletteOpen(true);
                setCommandQuery("");
              }}
              className="hidden sm:flex items-center gap-2 rounded-md border border-nb-gray-800/80 bg-nb-gray-920 px-2.5 py-1.5 text-xs text-nb-gray-300 hover:bg-nb-gray-910 hover:text-white"
              title="Command Palette (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5 text-nb-gray-400" />
              <span className="font-mono text-[11px]">Ctrl+K</span>
            </button>

            <button
              onClick={() => setAiEndpointModalOpen(true)}
              className="hidden md:flex items-center gap-1.5 rounded-md border border-nb-gray-800/80 bg-nb-gray-920 px-3 py-1.5 text-xs text-nb-gray-200 hover:bg-nb-gray-910 hover:text-white"
              title="Configure AI Provider & Custom Base URL"
            >
              <Settings2 className="h-3.5 w-3.5 text-netbird" />
              <span className="font-mono text-[11px]">{modelName}</span>
            </button>

            <button
              onClick={() => setCopilotDrawerOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                copilotDrawerOpen
                  ? "border-netbird-500/60 bg-netbird-950 text-netbird"
                  : "border-nb-gray-800/80 bg-nb-gray-920 text-nb-gray-300 hover:text-white"
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
              className="flex items-center gap-1.5 rounded-md bg-netbird px-3.5 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-netbird-500 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Peer</span>
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
                      label: `Muscle-Server (${gatewayNodes.length})`,
                      icon: Server,
                    },
                    {
                      id: "mesh",
                      label: `P2P Mesh-Links (${
                        (activeProject?.peer_mesh_links || []).length
                      })`,
                      icon: Network,
                    },
                    {
                      id: "blueprints",
                      label: `1-Click Stack Blueprints (${blueprints.length})`,
                      icon: Sparkles,
                    },
                    {
                      id: "playbooks",
                      label: `Cron-Playbooks (${
                        (activeProject?.scheduled_playbooks || []).length
                      })`,
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

                {/* Pluggable Rule Cartridges Grid + Inspector */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-5 space-y-3">
                    {cartridges.map((c) => {
                      const enabled =
                        activeProject?.active_cartridges?.includes(c.id);
                      const selected = selectedCartridgeId === c.id;
                      return (
                        <div
                          key={c.id}
                          onClick={() => setSelectedCartridgeId(c.id)}
                          className={`cursor-pointer rounded-lg border p-4 transition-all ${
                            selected
                              ? "border-netbird bg-nb-gray-930"
                              : "border-nb-gray-900 bg-nb-gray-940 hover:bg-nb-gray-930/60"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${
                                  enabled ? "bg-green-400" : "bg-nb-gray-500"
                                }`}
                              />
                              <span className="text-sm font-semibold text-white">
                                {c.name}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleCartridge(c.id);
                              }}
                              className={`rounded-md border px-2.5 py-1 font-mono text-[10px] font-medium transition ${
                                enabled
                                  ? "border-green-500 bg-green-950 text-green-400"
                                  : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-400 hover:text-white"
                              }`}
                            >
                              {enabled ? "ENABLED" : "DISABLED"}
                            </button>
                          </div>
                          <p className="mt-1.5 text-xs text-nb-gray-400">
                            {c.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="lg:col-span-7 rounded-lg border border-nb-gray-900 bg-nb-gray-940 p-6">
                    {currentCartridge && (
                      <RichMarkdownDocument
                        markdown={currentCartridge.content}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                VIEW 4: SORTED SERVICES, REVERSE PROXY & LIVE PREVIEW (`reverse-proxy`)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "reverse-proxy" &&
              (() => {
                const allSvcs = activeProject?.registered_services || [];
                const webuiSvcs = allSvcs.filter((s) => s.category === "webui");
                const dbSvcs = allSvcs.filter((s) => s.category === "database");
                const backendSvcs = allSvcs.filter(
                  (s) => s.category !== "webui" && s.category !== "database"
                );

                const activeSvc =
                  allSvcs.find((s) => s.service_id === selectedServiceId) ||
                  allSvcs.find((s) => s.port === previewPort) ||
                  allSvcs[0];

                const categoryGroups = [
                  {
                    id: "webui" as const,
                    title: "🌐 WebUIs & Frontends",
                    badge: "🌐 WebUI",
                    badgeStyle:
                      "border-sky-500/40 bg-sky-950/60 text-sky-300",
                    items: webuiSvcs,
                  },
                  {
                    id: "backend" as const,
                    title: "⚡ Backend & REST APIs",
                    badge: "⚡ Backend API",
                    badgeStyle:
                      "border-netbird-500/40 bg-netbird-950/60 text-netbird",
                    items: backendSvcs,
                  },
                  {
                    id: "database" as const,
                    title: "🗄️ Datenbanken",
                    badge: "🗄️ Database",
                    badgeStyle:
                      "border-purple-500/40 bg-purple-950/60 text-purple-300",
                    items: dbSvcs,
                  },
                ].filter(
                  (g) =>
                    (serviceCategoryFilter === "all" ||
                      serviceCategoryFilter === g.id) &&
                    g.items.length > 0
                );

                const activeExtUrl = activeSvc
                  ? `${gatewayUrl}/preview/${activeProject?.project_id}/${
                      activeSvc.node_id || primaryNode
                    }/${activeSvc.port}/`
                  : `${gatewayUrl}/preview/${activeProject?.project_id}/${
                      primaryNode || "node"
                    }/${previewPort}/`;

                return (
                  <div className="mx-auto flex max-w-6xl flex-col gap-5 p-6">
                    {/* TOP HEADER & CATEGORY FILTER TABS */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-nb-gray-900 pb-4">
                      <div>
                        <h1 className="text-xl font-medium text-nb-gray-100">
                          Erreichbare Projekt-Dienste, Reverse-Proxy &amp; Live-Preview
                        </h1>
                        <p className="text-xs text-nb-gray-400 mt-0.5">
                          Alle von der KI angelegten WebUIs, Backend-APIs und
                          Datenbanken sauber nach Kategorie sortiert — links
                          auswählen, rechts live testen.
                        </p>
                      </div>

                      {/* Category Filter Pills */}
                      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-1">
                        {[
                          {
                            id: "all",
                            label: `Alle (${allSvcs.length})`,
                          },
                          {
                            id: "webui",
                            label: `🌐 WebUI (${webuiSvcs.length})`,
                          },
                          {
                            id: "backend",
                            label: `⚡ Backend API (${backendSvcs.length})`,
                          },
                          {
                            id: "database",
                            label: `🗄️ Datenbank (${dbSvcs.length})`,
                          },
                        ].map((tab) => {
                          const active = serviceCategoryFilter === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() =>
                                setServiceCategoryFilter(
                                  tab.id as
                                    | "all"
                                    | "webui"
                                    | "backend"
                                    | "database"
                                )
                              }
                              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                                active
                                  ? "bg-netbird text-white shadow-sm"
                                  : "text-nb-gray-400 hover:text-white"
                              }`}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* MASTER-DETAIL SPLIT: LEFT SORTED DIRECTORY (4 COLS) + RIGHT WORKSPACE (8 COLS) */}
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                      {/* LEFT 4 COLUMNS: SORTED SERVICE DIRECTORY BY CATEGORY */}
                      <div className="lg:col-span-4 space-y-5">
                        {categoryGroups.length === 0 ? (
                          <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-5 text-center text-xs text-nb-gray-400">
                            Keine Dienste in dieser Kategorie gefunden.
                          </div>
                        ) : (
                          categoryGroups.map((group) => (
                            <div key={group.id} className="space-y-2.5">
                              <div className="flex items-center justify-between border-b border-nb-gray-800/80 pb-1.5">
                                <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-nb-gray-300">
                                  {group.title}
                                </span>
                                <span className="rounded bg-nb-gray-900 px-1.5 py-0.5 font-mono text-[10px] text-nb-gray-400">
                                  {group.items.length}
                                </span>
                              </div>

                              <div className="space-y-2.5">
                                {group.items.map((svc) => {
                                  const healthy =
                                    svc.healthy !== false &&
                                    svc.health_check?.status !== "UNHEALTHY";
                                  const isSelected =
                                    activeSvc?.service_id === svc.service_id;

                                  return (
                                    <div
                                      key={svc.service_id}
                                      onClick={() => {
                                        setSelectedServiceId(svc.service_id);
                                        setPreviewPort(svc.port);
                                        setPreviewSubPath("/");
                                        if (
                                          svc.endpoints &&
                                          svc.endpoints.length > 0
                                        ) {
                                          const firstEp = svc.endpoints[0];
                                          setServiceActionMethod(
                                            firstEp.method
                                          );
                                          setServiceActionPath(firstEp.path);
                                          setServiceActionPayload(
                                            firstEp.sample_payload || ""
                                          );
                                        }
                                      }}
                                      className={`cursor-pointer rounded-xl border p-3.5 transition-all space-y-2 ${
                                        isSelected
                                          ? "border-netbird bg-nb-gray-930 ring-1 ring-netbird/40 shadow-md"
                                          : "border-nb-gray-800 bg-nb-gray-940 hover:border-nb-gray-700"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span
                                            className={`h-2 w-2 shrink-0 rounded-full ${
                                              healthy
                                                ? "bg-green-400"
                                                : "bg-red-500 animate-pulse"
                                            }`}
                                          />
                                          <span className="truncate text-xs font-semibold text-white">
                                            {svc.name}
                                          </span>
                                        </div>
                                        <span className="shrink-0 rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[10px] text-nb-gray-300">
                                          {svc.node_id}:{svc.port}
                                        </span>
                                      </div>

                                      <p className="text-[11px] text-nb-gray-400 line-clamp-2">
                                        {svc.description ||
                                          "Von außen erreichbar über den Reverse-Proxy."}
                                      </p>

                                      <div className="flex items-center justify-between pt-0.5 text-[10px]">
                                        <span
                                          className={`rounded border px-1.5 py-0.5 font-mono ${group.badgeStyle}`}
                                        >
                                          {group.badge}
                                        </span>
                                        <span className="font-mono text-nb-gray-400">
                                          {(svc.endpoints || []).length}{" "}
                                          Option(en) →
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* RIGHT 8 COLUMNS: FOCUSED DETAIL WORKSPACE FOR SELECTED SERVICE */}
                      <div className="lg:col-span-8 space-y-4">
                        {/* STEP 1: SELECTED SERVICE HEADER & EXTERNAL REACHABILITY BOX */}
                        {activeSvc && (
                          <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-4 space-y-3.5 shadow-lg">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                                      activeSvc.category === "webui"
                                        ? "border-sky-500/40 bg-sky-950/60 text-sky-300"
                                        : activeSvc.category === "database"
                                        ? "border-purple-500/40 bg-purple-950/60 text-purple-300"
                                        : "border-netbird-500/40 bg-netbird-950/60 text-netbird"
                                    }`}
                                  >
                                    {activeSvc.category === "webui"
                                      ? "🌐 WebUI / Frontend"
                                      : activeSvc.category === "database"
                                      ? "🗄️ Database Engine"
                                      : "⚡ Backend REST API"}
                                  </span>
                                  <h2 className="text-base font-semibold text-white">
                                    {activeSvc.name}
                                  </h2>
                                  <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 font-mono text-[11px] text-nb-gray-300">
                                    {activeSvc.node_id}:{activeSvc.port}
                                  </span>
                                </div>
                                <p className="text-xs text-nb-gray-400">
                                  {activeSvc.description ||
                                    "Von außen erreichbar über den Synapse Reverse-Proxy Tunnel."}
                                </p>
                              </div>

                              {/* Workspace View Switcher (Split / Only Preview / Only Tester) */}
                              <div className="flex items-center rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-0.5 text-[11px]">
                                {[
                                  { id: "split", label: "Split-Ansicht" },
                                  { id: "preview", label: "Live-Preview" },
                                  { id: "tester", label: "Input-Tester" },
                                ].map((mode) => (
                                  <button
                                    key={mode.id}
                                    type="button"
                                    onClick={() =>
                                      setServiceWorkspaceTab(
                                        mode.id as
                                          | "split"
                                          | "preview"
                                          | "tester"
                                      )
                                    }
                                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                                      serviceWorkspaceTab === mode.id
                                        ? "bg-netbird text-white"
                                        : "text-nb-gray-400 hover:text-white"
                                    }`}
                                  >
                                    {mode.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* External Reverse-Proxy URL Banner */}
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3.5 py-2 text-xs">
                              <div className="flex items-center gap-2 truncate">
                                <Globe className="h-3.5 w-3.5 shrink-0 text-netbird" />
                                <span className="text-nb-gray-400">
                                  Von außen erreichbar:
                                </span>
                                <a
                                  href={activeExtUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="truncate font-mono text-netbird hover:underline"
                                >
                                  {activeExtUrl}
                                </a>
                              </div>
                              <a
                                href={activeExtUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 rounded-md border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-1 text-[11px] font-medium text-white hover:border-netbird"
                              >
                                <span>Im Browser öffnen</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>

                            {/* STEP 2: SORTED CLICKABLE OPTIONS FOR THE SELECTED SERVICE */}
                            {activeSvc.endpoints &&
                              activeSvc.endpoints.length > 0 && (
                                <div className="space-y-2 pt-1">
                                  <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-400">
                                    Klickbare Optionen &amp; vordefinierte
                                    Test-Inputs ({activeSvc.endpoints.length}):
                                  </div>
                                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {activeSvc.endpoints.map((ep) => (
                                      <button
                                        key={ep.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedServiceId(
                                            activeSvc.service_id
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
                                        className="flex items-center justify-between gap-2 rounded-lg border border-nb-gray-800 bg-nb-gray-930 px-3 py-2 text-left text-xs hover:border-netbird hover:bg-nb-gray-900 transition"
                                      >
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span
                                              className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                                                ep.method === "POST"
                                                  ? "bg-amber-950 text-amber-300 border border-amber-500/30"
                                                  : ep.method === "SQL"
                                                  ? "bg-purple-950 text-purple-300 border border-purple-500/30"
                                                  : "bg-emerald-950 text-emerald-300 border border-emerald-500/30"
                                              }`}
                                            >
                                              {ep.method}
                                            </span>
                                            <span className="truncate font-medium text-white">
                                              {ep.label}
                                            </span>
                                          </div>
                                          {ep.description && (
                                            <div className="mt-0.5 truncate text-[10px] text-nb-gray-400">
                                              {ep.description}
                                            </div>
                                          )}
                                        </div>
                                        <Play className="h-3 w-3 shrink-0 text-netbird" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                          </div>
                        )}

                        {/* STEP 3: INTERACTIVE INPUT TESTER BOX (SHOWN IN 'split' OR 'tester' MODE) */}
                        {(serviceWorkspaceTab === "split" ||
                          serviceWorkspaceTab === "tester") && (
                          <div className="flex flex-col rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-4 space-y-3 shadow-lg">
                            <div className="flex items-center justify-between border-b border-nb-gray-800 pb-2.5">
                              <div>
                                <h3 className="text-xs font-semibold text-white flex items-center gap-2">
                                  <Zap className="h-3.5 w-3.5 text-netbird" />
                                  Interaktive Input- &amp; Datenbank-Box (Live
                                  Request / SQL Tester)
                                </h3>
                                <p className="text-[11px] text-nb-gray-400">
                                  Bearbeite Methode, Pfad oder Payload und
                                  klicke auf &bdquo;Ausführen&ldquo;.
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 text-xs">
                              <select
                                value={serviceActionMethod}
                                onChange={(e) =>
                                  setServiceActionMethod(
                                    e.target.value as
                                      | "GET"
                                      | "POST"
                                      | "PUT"
                                      | "DELETE"
                                      | "SQL"
                                  )
                                }
                                className="rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3 py-1.5 font-mono text-xs font-semibold text-netbird"
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
                                onChange={(e) =>
                                  setServiceActionPath(e.target.value)
                                }
                                placeholder={
                                  serviceActionMethod === "SQL"
                                    ? "/opt/axon/workspaces/.../pulse.db"
                                    : "/api/events"
                                }
                                className="flex-1 min-w-[200px] rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3 py-1.5 font-mono text-xs text-white"
                              />

                              <button
                                type="button"
                                disabled={serviceActionBusy}
                                onClick={() => handleInvokeServiceAction()}
                                className="flex items-center gap-1.5 rounded-md bg-netbird px-4 py-1.5 text-xs font-medium text-white hover:bg-netbird-500 disabled:opacity-50"
                              >
                                <Play className="h-3 w-3" />
                                <span>
                                  {serviceActionBusy
                                    ? "Läuft..."
                                    : "Ausführen"}
                                </span>
                              </button>
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              <div className="space-y-1">
                                <label className="block font-mono text-[10px] uppercase text-nb-gray-400">
                                  {serviceActionMethod === "SQL"
                                    ? "SQL Query Input (SQLite / DB):"
                                    : "Request Body / JSON Input (optional bei GET):"}
                                </label>
                                <textarea
                                  rows={5}
                                  value={serviceActionPayload}
                                  onChange={(e) =>
                                    setServiceActionPayload(e.target.value)
                                  }
                                  placeholder={
                                    serviceActionMethod === "SQL"
                                      ? "SELECT * FROM events ORDER BY id DESC LIMIT 10;"
                                      : '{"action": "ping", "message": "Test"}'
                                  }
                                  className="w-full rounded-md border border-nb-gray-800 bg-nb-gray-950 p-2.5 font-mono text-xs text-nb-gray-100 focus:border-netbird focus:outline-none"
                                />
                              </div>

                              <div className="flex flex-col rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-3 font-mono text-[11px] space-y-1.5">
                                <div className="flex items-center justify-between border-b border-nb-gray-800/80 pb-1 text-[10px]">
                                  <span className="text-nb-gray-400">
                                    Live Response Output
                                  </span>
                                  {serviceActionResult && (
                                    <span
                                      className={
                                        serviceActionResult.ok
                                          ? "text-green-400"
                                          : "text-red-400"
                                      }
                                    >
                                      {serviceActionResult.method} · Status{" "}
                                      {serviceActionResult.status_code} ·{" "}
                                      {serviceActionResult.latency_ms} ms
                                    </span>
                                  )}
                                </div>
                                <pre className="max-h-36 flex-1 overflow-auto whitespace-pre-wrap text-nb-gray-200">
                                  {serviceActionResult
                                    ? serviceActionResult.response_text
                                    : "Wähle oben eine Option oder klicke auf 'Ausführen', um die Live-Antwort zu sehen."}
                                </pre>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* STEP 4: LIVE EMBEDDED REVERSE-PROXY IFRAME (SHOWN IN 'split' OR 'preview' MODE) */}
                        {(serviceWorkspaceTab === "split" ||
                          serviceWorkspaceTab === "preview") && (
                          <div className="flex flex-col overflow-hidden rounded-xl border border-nb-gray-800 bg-nb-gray-940 shadow-xl">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-nb-gray-900 bg-nb-gray-930 px-4 py-2.5 text-xs">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Globe className="h-3.5 w-3.5 text-netbird" />
                                <span className="font-semibold text-white mr-1">
                                  Live-Preview:
                                </span>
                                <span className="font-mono text-nb-gray-300">
                                  {gatewayUrl}/preview/
                                  {activeProject?.project_id}/
                                  {activeSvc?.node_id || primaryNode || "node"}/
                                </span>
                                <input
                                  type="number"
                                  value={previewPort}
                                  onChange={(e) =>
                                    setPreviewPort(
                                      Number(e.target.value) || 3000
                                    )
                                  }
                                  className="w-20 rounded border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 font-mono text-xs text-netbird"
                                />
                                <input
                                  type="text"
                                  value={previewSubPath}
                                  onChange={(e) =>
                                    setPreviewSubPath(e.target.value || "/")
                                  }
                                  className="w-36 rounded border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 font-mono text-xs text-white"
                                  placeholder="/"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewReloadNonce((n) => n + 1)
                                  }
                                  className="rounded border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-1 text-[11px] text-nb-gray-300 hover:text-white"
                                >
                                  Neu laden
                                </button>
                                <a
                                  href={`${gatewayUrl}/preview/${
                                    activeProject?.project_id
                                  }/${activeSvc?.node_id || primaryNode}/${previewPort}${
                                    previewSubPath.startsWith("/")
                                      ? previewSubPath
                                      : `/${previewSubPath}`
                                  }`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1.5 text-nb-gray-300 hover:text-white"
                                >
                                  <span>Neuer Tab</span>
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </div>
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
                              className="w-full bg-white h-[440px]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

            {/* ═══════════════════════════════════════════════════════════════
                VIEW 5: BRAIN VAULT DOCUMENTS (`brain-vault`)
            ═══════════════════════════════════════════════════════════════ */}
            {activeNav === "brain-vault" && (
              <div className="mx-auto max-w-6xl p-6 space-y-6">
                {/* NetBird Page Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl font-medium text-nb-gray-100">
                      Project Brain Vault
                    </h1>
                    <p className="text-xs text-nb-gray-400 mt-0.5">
                      Persistent cognitive state (
                      <code className="font-mono text-nb-gray-200">
                        /projects/{activeProject?.project_id || "synapse-cloud-demo"}/
                      </code>
                      ), Mermaid architecture specs, engineering journal, and
                      AES-256-GCM secrets.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setActiveNav("control-center")}
                      className="flex items-center gap-1.5 rounded-md border border-nb-gray-800 bg-nb-gray-930 px-3 py-1.5 text-xs text-nb-gray-300 hover:border-nb-gray-700 hover:text-white transition"
                    >
                      <Network className="h-3.5 w-3.5 text-netbird" />
                      <span>View on Canvas</span>
                    </button>
                    <button
                      onClick={() => setIsEditingMarkdown((v) => !v)}
                      className="flex items-center gap-1.5 rounded-md border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-1.5 text-xs font-medium text-nb-gray-100 hover:bg-nb-gray-900 hover:text-white transition"
                    >
                      <Code2 className="h-3.5 w-3.5 text-netbird" />
                      <span>
                        {isEditingMarkdown ? "Reader View" : "Edit Raw Markdown"}
                      </span>
                    </button>
                    {isEditingMarkdown && (
                      <button
                        onClick={() => handleSaveBrainDoc(brainDocTab)}
                        className="flex items-center gap-1.5 rounded-md bg-netbird px-4 py-1.5 text-xs font-medium text-white hover:bg-netbird-500 transition"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>Save {brainDocTab}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 4-Card NetBird Vault Artifact Selector Bar */}
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                  <button
                    onClick={() => {
                      setBrainDocTab("Architecture.md");
                      setIsEditingMarkdown(false);
                    }}
                    className={`flex flex-col justify-between rounded-lg border p-4 text-left transition ${
                      brainDocTab === "Architecture.md"
                        ? "border-netbird bg-nb-gray-930 ring-1 ring-netbird/30"
                        : "border-nb-gray-900 bg-nb-gray-940 hover:border-nb-gray-800 hover:bg-nb-gray-930/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-mono text-xs font-semibold text-white">
                            Architecture.md
                          </div>
                          <div className="text-[11px] text-nb-gray-400">
                            Mermaid &amp; File Specs
                          </div>
                        </div>
                      </div>
                      <span className="rounded border border-netbird-500/40 bg-netbird-950 px-2 py-0.5 font-mono text-[10px] text-netbird">
                        ACTIVE
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setBrainDocTab("Memory.md");
                      setIsEditingMarkdown(false);
                    }}
                    className={`flex flex-col justify-between rounded-lg border p-4 text-left transition ${
                      brainDocTab === "Memory.md"
                        ? "border-netbird bg-nb-gray-930 ring-1 ring-netbird/30"
                        : "border-nb-gray-900 bg-nb-gray-940 hover:border-nb-gray-800 hover:bg-nb-gray-930/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-500/40 bg-sky-950/60 text-sky-400">
                          <BookOpen className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-mono text-xs font-semibold text-white">
                            Memory.md
                          </div>
                          <div className="text-[11px] text-nb-gray-400">
                            Engineering Journal
                          </div>
                        </div>
                      </div>
                      <span className="rounded border border-nb-gray-800 bg-nb-gray-920 px-2 py-0.5 font-mono text-[10px] text-nb-gray-300">
                        LOG
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveNav("peers")}
                    className="flex flex-col justify-between rounded-lg border border-nb-gray-900 bg-nb-gray-940 p-4 text-left transition hover:border-nb-gray-800 hover:bg-nb-gray-930/60"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-green-500/40 bg-green-950 text-green-400">
                          <Server className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-mono text-xs font-semibold text-white">
                            State.json
                          </div>
                          <div className="text-[11px] text-nb-gray-400">
                            {gatewayNodes.length} Peer(s) ·{" "}
                            {(activeProject?.registered_services || []).length}{" "}
                            Service(s)
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-nb-gray-400" />
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setSettingsTab("secrets-vault");
                      setActiveNav("settings");
                    }}
                    className="flex flex-col justify-between rounded-lg border border-nb-gray-900 bg-nb-gray-940 p-4 text-left transition hover:border-nb-gray-800 hover:bg-nb-gray-930/60"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-yellow-500/40 bg-yellow-950/60 text-yellow-400">
                          <KeyRound className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-mono text-xs font-semibold text-white">
                            Secrets.enc
                          </div>
                          <div className="text-[11px] text-nb-gray-400">
                            {secretKeys.length} AES-256-GCM Key(s)
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-nb-gray-400" />
                    </div>
                  </button>
                </div>

                {/* Main 12-Column NetBird Document + State Inspector Grid */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                  {/* Left 8 Columns: Active Vault Document */}
                  <div className="lg:col-span-8 flex flex-col overflow-hidden rounded-lg border border-nb-gray-900 bg-nb-gray-940">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-nb-gray-900 bg-nb-gray-930 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FolderGit2 className="h-4 w-4 text-netbird" />
                        <span className="font-mono text-xs font-medium text-white">
                          /projects/{activeProject?.project_id || "synapse-cloud-demo"}/
                          {brainDocTab}
                        </span>
                      </div>
                      <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 font-mono text-[10px] text-nb-gray-400">
                        {brainDocTab === "Architecture.md"
                          ? "System Prompt Context: Always Injected"
                          : "Chronological Audit & Learnings"}
                      </span>
                    </div>

                    <div className="p-5">
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
                          className="h-[520px] w-full rounded-md border border-nb-gray-800 bg-nb-gray-960 p-4 font-mono text-xs text-nb-gray-100 focus:border-netbird focus:outline-none"
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

                  {/* Right 4 Columns: Live State.json & Policy Context */}
                  <div className="lg:col-span-4 space-y-4">
                    {/* Card 1: Enrolled Muscle Peers */}
                    <div className="rounded-lg border border-nb-gray-900 bg-nb-gray-940 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-nb-gray-100 flex items-center gap-2">
                          <Server className="h-3.5 w-3.5 text-netbird" />
                          Assigned Muscle Peers
                        </span>
                        <span className="font-mono text-[10px] text-green-400">
                          {gatewayNodes.length} ONLINE
                        </span>
                      </div>

                      {gatewayNodes.length > 0 ? (
                        <div className="space-y-2">
                          {gatewayNodes.map((gn) => (
                            <div
                              key={gn.node_id}
                              className="flex items-center justify-between rounded-md border border-nb-gray-800 bg-nb-gray-930 px-3 py-2 text-xs"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="h-2 w-2 rounded-full bg-green-400 shrink-0" />
                                <span className="font-mono font-medium text-white truncate">
                                  {gn.node_id}
                                </span>
                              </div>
                              <span className="rounded border border-netbird-500/40 bg-netbird-950 px-1.5 py-0.5 font-mono text-[10px] text-netbird">
                                {gn.tier.replace("TIER_", "T")}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-md border border-nb-gray-800/70 bg-nb-gray-930/60 p-3 text-xs text-nb-gray-400">
                          No Muscle Peers enrolled yet.
                        </div>
                      )}
                    </div>

                    {/* Card 2: Active Rule Cartridges */}
                    <div className="rounded-lg border border-nb-gray-900 bg-nb-gray-940 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-nb-gray-100 flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-green-400" />
                          Active Rule Cartridges
                        </span>
                        <button
                          onClick={() => setActiveNav("access-control")}
                          className="text-[11px] text-netbird hover:underline"
                        >
                          Configure →
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {cartridges.map((c) => {
                          const enabled =
                            activeProject?.active_cartridges?.includes(c.id);
                          return (
                            <div
                              key={c.id}
                              onClick={() => handleToggleCartridge(c.id)}
                              className="flex cursor-pointer items-center justify-between rounded-md border border-nb-gray-800 bg-nb-gray-930 px-3 py-2 text-xs hover:border-nb-gray-700"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    enabled ? "bg-green-400" : "bg-nb-gray-500"
                                  }`}
                                />
                                <span className="text-nb-gray-200 truncate">
                                  {c.name}
                                </span>
                              </div>
                              <span
                                className={`font-mono text-[10px] ${
                                  enabled ? "text-green-400" : "text-nb-gray-500"
                                }`}
                              >
                                {enabled ? "ON" : "OFF"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Card 3: Registered Loopback Services */}
                    <div className="rounded-lg border border-nb-gray-900 bg-nb-gray-940 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-nb-gray-100 flex items-center gap-2">
                          <Globe className="h-3.5 w-3.5 text-sky-400" />
                          Loopback Tunnels (`State.json`)
                        </span>
                        <button
                          onClick={() => setActiveNav("reverse-proxy")}
                          className="text-[11px] text-netbird hover:underline"
                        >
                          Proxy →
                        </button>
                      </div>

                      {(activeProject?.registered_services || []).length > 0 ? (
                        <div className="space-y-1.5">
                          {(activeProject?.registered_services || []).map(
                            (svc) => (
                              <div
                                key={svc.service_id}
                                onClick={() => {
                                  setPreviewPort(svc.port);
                                  setActiveNav("reverse-proxy");
                                }}
                                className="flex cursor-pointer items-center justify-between rounded-md border border-nb-gray-800 bg-nb-gray-930 px-3 py-2 text-xs hover:bg-nb-gray-900"
                              >
                                <span className="font-medium text-white">
                                  {svc.name}
                                </span>
                                <span className="font-mono text-[11px] text-nb-gray-300">
                                  127.0.0.1:{svc.port}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      ) : (
                        <div className="rounded-md border border-nb-gray-800/70 bg-nb-gray-930/60 p-3 text-xs text-nb-gray-400">
                          No loopback services registered yet.
                        </div>
                      )}
                    </div>
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
              className="relative flex w-[400px] shrink-0 flex-col border-l border-nb-gray-900 bg-nb-gray-940"
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
                      className={`rounded-lg p-3.5 text-xs ${
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

                      <RichMarkdownDocument markdown={msg.content} />

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
                        <span>ReAct Loop &amp; Live Stream...</span>
                      </div>
                      <span className="font-mono text-[10px] text-emerald-400">
                        ⚡ Prefix Cached
                      </span>
                    </div>

                    {liveSteps.map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between font-mono text-[11px] text-nb-gray-300"
                      >
                        <span className="flex items-center gap-1.5">
                          <span>
                            #{s.step} {s.tool_name}
                          </span>
                          {s.cached && (
                            <span className="rounded bg-emerald-950 px-1 text-[9px] text-emerald-300">
                              CACHE HIT
                            </span>
                          )}
                        </span>
                        <span className="text-netbird uppercase">
                          {s.status}
                        </span>
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
                      <div className="border-t border-nb-gray-800 pt-2 text-nb-gray-100">
                        <RichMarkdownDocument markdown={streamingReplyText} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Multimodal Prompt Input Box with Thumbnail Strip, @-Mentions & Drag-and-Drop */}
              <form
                onSubmit={handleSendPrompt}
                className="relative border-t border-nb-gray-900 bg-nb-gray-950 p-3 space-y-2"
              >
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
                    className="flex h-[46px] w-[42px] shrink-0 items-center justify-center rounded-md border border-nb-gray-800 bg-nb-gray-920 text-nb-gray-300 hover:border-netbird hover:text-white transition"
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
                    className="flex h-[46px] w-[42px] shrink-0 items-center justify-center rounded-md border border-nb-gray-800 bg-nb-gray-920 text-nb-gray-300 hover:border-netbird hover:text-white transition"
                  >
                    <AtSign className="h-3.5 w-3.5" />
                  </button>

                  <textarea
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
                    placeholder="Ask Synapse AI, type @ to mention, or drop/paste images..."
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
