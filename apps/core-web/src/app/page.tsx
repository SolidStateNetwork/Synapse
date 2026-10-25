"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
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
  Network,
  Play,
  Plus,
  RefreshCw,
  Save,
  Send,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal as TerminalIcon,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import type { AutonomyTier, FsEntry, NodeHeartbeat } from "@proto/tunnel";
import MermaidTopologyView from "@/components/MermaidTopologyView";

const XTermTerminal = dynamic(() => import("@/components/XTermTerminal"), {
  ssr: false,
});

interface AssignedNode {
  node_id: string;
  tier: AutonomyTier;
  hostname?: string;
  os_arch?: string;
  online?: boolean;
  last_seen_unix?: number;
}

interface RegisteredService {
  service_id: string;
  name: string;
  node_id: string;
  protocol: "http" | "tcp";
  port: number;
  path?: string;
  healthy?: boolean;
  registered_at: string;
}

interface PendingApproval {
  approval_id: string;
  tool_name: string;
  node_id: string;
  arguments: Record<string, unknown>;
  created_at: string;
  status: "pending" | "approved" | "rejected";
}

interface AIProviderSettings {
  provider: string;
  base_url: string;
  model: string;
  api_key_secret_name?: string;
}

interface ProjectState {
  project_id: string;
  name: string;
  description: string;
  planning_only: boolean;
  assigned_nodes: AssignedNode[];
  active_cartridges: string[];
  registered_services: RegisteredService[];
  active_pty_sessions: string[];
  telemetry: Record<string, NodeHeartbeat>;
  pending_approvals: PendingApproval[];
  ai_settings?: AIProviderSettings;
}

interface CartridgeMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
}

interface AuditEntry {
  timestamp: string;
  actor: string;
  tool_name: string;
  node_id?: string;
  status: string;
  summary: string;
  args?: Record<string, unknown>;
}

interface GatewayNode {
  node_id: string;
  tier: AutonomyTier;
  remote_addr: string;
  connected_at: string;
  online: boolean;
  last_heartbeat?: NodeHeartbeat;
}

interface ChatItem {
  role: "user" | "assistant";
  content: string;
  toolResults?: Array<{
    tool_name: string;
    status: string;
    output: unknown;
    approval_id?: string;
  }>;
}

const PROVIDER_PRESETS: Record<
  string,
  { label: string; defaultUrl: string; defaultModel: string }
> = {
  "openai-compatible": {
    label: "Custom OpenAI-Compatible API",
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

export default function SynapseWorkbench() {
  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectState | null>(null);
  const [architectureMd, setArchitectureMd] = useState("");
  const [memoryMd, setMemoryMd] = useState("");
  const [secretKeys, setSecretKeys] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [cartridges, setCartridges] = useState<CartridgeMeta[]>([]);
  const [gatewayNodes, setGatewayNodes] = useState<GatewayNode[]>([]);
  const [gatewayUrl, setGatewayUrl] = useState("http://127.0.0.1:8081");

  // 2026 IDE Layout States
  const [leftSidebarView, setLeftSidebarView] = useState<
    "explorer" | "vault" | "nodes" | "cartridges"
  >("explorer");
  const [centerView, setCenterView] = useState<
    "code" | "architecture" | "memory" | "preview" | "secrets"
  >("code");
  const [bottomDockView, setBottomDockView] = useState<"pty" | "audit">("pty");
  const [bottomDockOpen, setBottomDockOpen] = useState(true);
  const [aiEndpointModalOpen, setAiEndpointModalOpen] = useState(false);

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
  const [editorStatus, setEditorStatus] = useState<string>("Ready");

  // AI Provider & Custom Base URL Configuration
  const [provider, setProvider] = useState("openai-compatible");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [modelName, setModelName] = useState("gpt-4o");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeySecretName, setApiKeySecretName] = useState("LLM_API_KEY");
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [syncingModels, setSyncingModels] = useState(false);
  const [modelSyncStatus, setModelSyncStatus] = useState("");

  // Copilot Chat State
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>(
    {}
  );
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([
    {
      role: "assistant",
      content:
        "Synapse Core Ready. Click the **API Endpoint badge** in the top bar to set any custom `Base URL` (OpenRouter, vLLM, Ollama, LiteLLM, or OpenAI), or run `$ <cmd>` / `deploy microservice 4050` directly.",
    },
  ]);

  // Node Enrollment & Secrets
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [joinTier, setJoinTier] = useState<AutonomyTier>(
    "TIER_2_WORKSPACE_JAIL"
  );
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [manualNodeId, setManualNodeId] = useState("");
  const [newSecretKey, setNewSecretKey] = useState("");
  const [newSecretVal, setNewSecretVal] = useState("");
  const [previewPort, setPreviewPort] = useState<number>(3000);
  const [newProjectModal, setNewProjectModal] = useState(false);
  const [newProjName, setNewProjName] = useState("");

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
        setGatewayNodes(data.gateway_nodes || []);
        if (data.gateway_url) setGatewayUrl(data.gateway_url);

        if (syncAiSettings && data.active_project?.ai_settings) {
          const ai = data.active_project.ai_settings as AIProviderSettings;
          setProvider(ai.provider || "openai-compatible");
          setBaseUrl(ai.base_url || "https://api.openai.com/v1");
          setModelName(ai.model || "gpt-4o");
          setApiKeySecretName(ai.api_key_secret_name || "LLM_API_KEY");
        }

        const firstNode =
          data.active_project?.assigned_nodes?.[0]?.node_id ||
          data.gateway_nodes?.[0]?.node_id ||
          "";
        setSelectedNodeId((prev) => prev || firstNode);
      } catch {
        // ignore transient network error
      }
    },
    [activeProject?.project_id]
  );

  useEffect(() => {
    loadWorkspace("synapse-cloud-demo", true);
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

  // Load Remote Directory Tree
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
      setEditorStatus(`Reading ${filePath}...`);
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
          setCenterView("code");
          setEditorStatus(`Loaded ${filePath}`);
        } else {
          setEditorStatus(tr?.output?.error || "Read failed");
        }
      } catch {
        setEditorStatus("Error reading file");
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
    setEditorStatus(`Saving ${activeFilePath}...`);
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
    if (tr?.status === "paused_tier3") {
      setEditorStatus(`Paused by TIER_3_SUPERVISED (${tr.approval_id})`);
    } else if (tr?.output?.success) {
      setEditorStatus(`Saved ${activeFilePath} atomically`);
      fetchRemoteDir(remoteDir);
    } else {
      setEditorStatus(tr?.output?.error || "Write error");
    }
    loadWorkspace(activeProject.project_id);
  }

  async function handleApplyDiff() {
    if (!activeProject || !primaryNode || !activeFilePath || !diffPatchText)
      return;
    setEditorStatus("Applying Unified Diff...");
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
      setEditorContent(tr.output.content || editorContent);
      setDiffPatchText("");
      setShowDiffDrawer(false);
      setEditorStatus(`Patched ${activeFilePath}`);
    } else {
      setEditorStatus(tr?.output?.error || "Diff failed");
    }
    loadWorkspace(activeProject.project_id);
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

  // Save Custom Base URL & Provider Settings
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
        api_key: apiKeyInput,
      }),
    });
    setApiKeyInput("");
    setAiEndpointModalOpen(false);
    await loadWorkspace(activeProject.project_id, true);
  }

  // Discover Models from Custom Base URL (/v1/models)
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

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !activeProject) return;
    const userMsg: ChatItem = { role: "user", content: chatInput };
    const nextHistory = [...chatHistory, userMsg];
    setChatHistory(nextHistory);
    setChatInput("");
    setChatBusy(true);

    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: activeProject.project_id,
          provider,
          base_url: baseUrl,
          model: modelName,
          api_key: apiKeyInput,
          messages: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "Completed.",
          toolResults: data.tool_results,
        },
      ]);
      await loadWorkspace(activeProject.project_id);
      if (primaryNode) fetchRemoteDir(remoteDir);
    } finally {
      setChatBusy(false);
    }
  }

  async function handleQuickAction(promptText: string) {
    if (!activeProject) return;
    const nextHistory: ChatItem[] = [
      ...chatHistory,
      { role: "user", content: promptText },
    ];
    setChatHistory(nextHistory);
    setChatBusy(true);
    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: activeProject.project_id,
          provider: "synapse-autonomous",
          base_url: baseUrl,
          model: modelName,
          messages: nextHistory.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "Executed.",
          toolResults: data.tool_results,
        },
      ]);
      await loadWorkspace(activeProject.project_id);
      if (primaryNode) fetchRemoteDir(remoteDir);
    } finally {
      setChatBusy(false);
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
    setEditorStatus(`Saved ${doc} to Brain Vault`);
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
    setManualNodeId("");
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

  const activeHeartbeat =
    (primaryNode && activeProject?.telemetry?.[primaryNode]) ||
    gatewayNodes.find((n) => n.node_id === primaryNode)?.last_heartbeat;

  return (
    <div className="flex h-screen w-screen flex-col bg-[#060609] text-zinc-200 overflow-hidden select-none">
      {/* ═══════════════════════════════════════════════════════════════════════
          TOP COMMAND BAR (38px — Linear / Cursor / Zed 2026 Style)
      ═══════════════════════════════════════════════════════════════════════ */}
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#09090d] px-3 text-xs">
        {/* Left: Brand + Project Selector + Mode Pill */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 font-mono font-semibold tracking-tight text-white">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
              <Cpu className="h-3.5 w-3.5" />
            </span>
            <span>SYNAPSE</span>
            <span className="text-[10px] text-zinc-500 font-normal">/</span>
          </div>

          <select
            value={activeProject?.project_id || ""}
            onChange={(e) => loadWorkspace(e.target.value, true)}
            className="rounded border border-white/[0.08] bg-zinc-900/90 px-2 py-1 font-mono text-[11px] text-zinc-200 focus:border-emerald-500/60 focus:outline-none"
          >
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>
                {p.project_id}
              </option>
            ))}
          </select>

          <button
            onClick={() => setNewProjectModal(true)}
            className="rounded border border-white/[0.07] bg-white/[0.02] p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"
            title="Create New Project Brain Vault"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>

          {activeProject?.planning_only ? (
            <span className="flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">
              <Lock className="h-3 w-3" />
              PLANNING-ONLY
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
              <ShieldCheck className="h-3 w-3" />
              MUSCLE ACTIVE ({primaryNode})
            </span>
          )}
        </div>

        {/* Center: Workbench Editor Mode Switcher */}
        <div className="hidden md:flex items-center gap-1 rounded-md border border-white/[0.06] bg-[#060609] p-0.5">
          {[
            { id: "code", label: activeFilePath || "Code", icon: FileCode2 },
            { id: "architecture", label: "Architecture.md", icon: Network },
            { id: "memory", label: "Memory.md", icon: FileText },
            {
              id: "secrets",
              label: `Secrets (${secretKeys.length})`,
              icon: KeyRound,
            },
            {
              id: "preview",
              label: `Live Preview :${previewPort}`,
              icon: Globe,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isAct = centerView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCenterView(tab.id as typeof centerView)}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[11px] transition ${
                  isAct
                    ? "bg-white/[0.08] text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className="h-3 w-3 text-emerald-400" />
                <span className="max-w-[140px] truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Custom API Base URL Trigger + Terminal Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAiEndpointModalOpen(true)}
            className="flex items-center gap-2 rounded border border-white/[0.09] bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-zinc-300 hover:border-emerald-500/40 hover:bg-white/[0.06]"
            title="Configure Custom LLM API Base URL, Provider & Model"
          >
            <Settings2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-emerald-300">{modelName}</span>
            <span className="hidden sm:inline text-zinc-500">•</span>
            <span className="hidden sm:inline max-w-[170px] truncate text-zinc-400">
              {baseUrl.replace(/^https?:\/\//, "")}
            </span>
            <ChevronDown className="h-3 w-3 text-zinc-500" />
          </button>

          <button
            onClick={() => setBottomDockOpen((v) => !v)}
            className={`rounded border p-1.5 transition ${
              bottomDockOpen
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-white/[0.07] bg-white/[0.02] text-zinc-400"
            }`}
            title="Toggle Persistent PTY & Audit Dock"
          >
            <TerminalIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN 4-PANE IDE BODY (Activity Bar | Left Sidebar | Center | Right AI)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* 1. Ultra-Slim Activity Bar (44px) */}
        <aside className="flex w-11 shrink-0 flex-col items-center justify-between border-r border-white/[0.07] bg-[#08080c] py-2.5">
          <div className="flex flex-col items-center gap-2">
            {[
              {
                id: "explorer",
                title: "Remote Workspace Explorer (STREAM_TYPE_RPC_FS)",
                icon: Folder,
              },
              {
                id: "vault",
                title: "Project Brain Vault Artifacts",
                icon: FolderGit2,
              },
              {
                id: "nodes",
                title: "Axon Muscle Nodes & mTLS Enrollment",
                icon: Server,
              },
              {
                id: "cartridges",
                title: "Pluggable Rule Cartridges (/cartridges/*.md)",
                icon: Layers,
              },
            ].map((item) => {
              const Icon = item.icon;
              const active = leftSidebarView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() =>
                    setLeftSidebarView(item.id as typeof leftSidebarView)
                  }
                  title={item.title}
                  className={`relative flex h-8 w-8 items-center justify-center rounded-md transition ${
                    active
                      ? "bg-white/[0.08] text-emerald-400"
                      : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 h-4 w-0.5 rounded-r bg-emerald-400" />
                  )}
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setAiEndpointModalOpen(true)}
              title="API Base URL & Provider Settings"
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
        </aside>

        {/* 2. Left Context Sidebar (250px) */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-white/[0.07] bg-[#08080c] text-xs overflow-hidden">
          {/* VIEW A: REMOTE WORKSPACE FILE TREE */}
          {leftSidebarView === "explorer" && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Workspace ({remoteDir})
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fetchRemoteDir(".")}
                    className="rounded px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                  >
                    root
                  </button>
                  <button
                    onClick={() => fetchRemoteDir(remoteDir)}
                    className="rounded p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Quick New File Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newFileName.trim()) return;
                  setActiveFilePath(newFileName.trim());
                  setEditorContent(
                    `// ${newFileName.trim()} — Synapse Workspace\n`
                  );
                  setCenterView("code");
                  setNewFileName("");
                }}
                className="flex items-center border-b border-white/[0.06] px-2 py-1.5 gap-1"
              >
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="New file (e.g. app.ts)..."
                  className="w-full rounded bg-zinc-900/90 px-2 py-1 font-mono text-[11px] text-zinc-200 border border-white/[0.06] focus:border-emerald-500/50 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded bg-white/[0.06] p-1 text-zinc-300 hover:bg-emerald-500/20 hover:text-emerald-300"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </form>

              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                {activeProject?.planning_only ? (
                  <div className="p-3 text-[11px] text-amber-300/80 font-mono">
                    Project is in Planning-Only Mode. Assign an Axon node to
                    browse remote files.
                  </div>
                ) : remoteEntries.length === 0 ? (
                  <div className="p-3 text-[11px] text-zinc-500 font-mono">
                    Empty workspace directory.
                  </div>
                ) : (
                  remoteEntries.map((entry) => {
                    const isSelected = activeFilePath.endsWith(entry.name);
                    return (
                      <div
                        key={entry.path}
                        className={`group flex items-center justify-between rounded px-2 py-1 font-mono text-[11px] transition ${
                          isSelected
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                        }`}
                      >
                        <button
                          onClick={() =>
                            entry.is_dir
                              ? fetchRemoteDir(entry.path)
                              : openRemoteFile(entry.path)
                          }
                          className="flex flex-1 items-center gap-1.5 truncate text-left"
                        >
                          {entry.is_dir ? (
                            <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400/90" />
                          ) : (
                            <FileCode2 className="h-3.5 w-3.5 shrink-0 text-cyan-400/90" />
                          )}
                          <span className="truncate">{entry.name}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteRemoteFile(entry.path)}
                          className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* VIEW B: PROJECT BRAIN VAULT ARTIFACTS */}
          {leftSidebarView === "vault" && (
            <div className="flex flex-1 flex-col p-2 space-y-1">
              <div className="px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Brain Vault (/var/lib/synapse)
              </div>
              {[
                {
                  id: "architecture",
                  name: "Architecture.md",
                  desc: "Mermaid Topology & Layout",
                },
                {
                  id: "memory",
                  name: "Memory.md",
                  desc: "Engineering Journal",
                },
                {
                  id: "secrets",
                  name: "Secrets.enc",
                  desc: `AES-256-GCM (${secretKeys.length} keys)`,
                },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCenterView(item.id as typeof centerView)}
                  className={`flex flex-col rounded-md px-2.5 py-2 text-left transition ${
                    centerView === item.id
                      ? "bg-white/[0.08] text-white"
                      : "text-zinc-400 hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="font-mono text-[11px] text-emerald-300">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-zinc-500">{item.desc}</span>
                </button>
              ))}
            </div>
          )}

          {/* VIEW C: AXON MUSCLE NODES & PKI */}
          {leftSidebarView === "nodes" && (
            <div className="flex flex-1 flex-col overflow-y-auto p-2.5 space-y-3">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Axon Nodes ({gatewayNodes.length} online)
              </div>

              {gatewayNodes.map((gn) => {
                const isAssigned = activeProject?.assigned_nodes.some(
                  (a) => a.node_id === gn.node_id
                );
                return (
                  <div
                    key={gn.node_id}
                    className="rounded border border-white/[0.07] bg-white/[0.02] p-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-emerald-300 font-semibold">
                        {gn.node_id}
                      </span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-cyan-300">
                        {gn.tier.replace("TIER_", "T")}
                      </span>
                    </div>
                    {gn.last_heartbeat && (
                      <div className="grid grid-cols-3 gap-1 font-mono text-[10px] text-zinc-400">
                        <span>
                          CPU {gn.last_heartbeat.cpu_percent.toFixed(0)}%
                        </span>
                        <span>
                          RAM {gn.last_heartbeat.ram_percent.toFixed(0)}%
                        </span>
                        <span>
                          DSK {gn.last_heartbeat.disk_percent.toFixed(0)}%
                        </span>
                      </div>
                    )}
                    <button
                      onClick={() =>
                        isAssigned
                          ? handleUnassignNode(gn.node_id)
                          : handleAssignNode(gn.node_id, gn.tier)
                      }
                      className={`w-full rounded py-1 font-mono text-[10px] ${
                        isAssigned
                          ? "border border-rose-500/30 bg-rose-500/10 text-rose-300"
                          : "bg-emerald-600 text-white"
                      }`}
                    >
                      {isAssigned ? "Unassign Node" : "Assign to Project"}
                    </button>
                  </div>
                );
              })}

              <div className="border-t border-white/[0.07] pt-3 space-y-2">
                <span className="font-mono text-[10px] uppercase text-zinc-400">
                  Enroll New Muscle Node
                </span>
                <select
                  value={joinTier}
                  onChange={(e) => setJoinTier(e.target.value as AutonomyTier)}
                  className="w-full rounded border border-white/[0.08] bg-zinc-900 px-2 py-1 font-mono text-[10px] text-zinc-200"
                >
                  <option value="TIER_1_UNLEASHED">TIER_1_UNLEASHED</option>
                  <option value="TIER_2_WORKSPACE_JAIL">
                    TIER_2_WORKSPACE_JAIL
                  </option>
                  <option value="TIER_3_SUPERVISED">TIER_3_SUPERVISED</option>
                </select>
                <button
                  onClick={handleGenerateJoinToken}
                  className="w-full rounded bg-emerald-600 py-1.5 font-mono text-[11px] font-medium text-white hover:bg-emerald-500"
                >
                  Generate CSR Token
                </button>
                {issuedToken && (
                  <pre className="overflow-x-auto rounded border border-emerald-500/30 bg-black p-2 font-mono text-[10px] text-emerald-400">
                    {`curl -fsSL ${gatewayUrl}/install.sh | sh -s -- ${issuedToken} ${joinTier}`}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* VIEW D: PLUGGABLE RULE CARTRIDGES */}
          {leftSidebarView === "cartridges" && (
            <div className="flex flex-1 flex-col overflow-y-auto p-2.5 space-y-2">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Rule Cartridges (/cartridges)
              </div>
              {cartridges.map((c) => {
                const active =
                  activeProject?.active_cartridges.includes(c.id) ?? false;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleToggleCartridge(c.id)}
                    className={`w-full rounded border p-2 text-left transition ${
                      active
                        ? "border-emerald-500/40 bg-emerald-500/10 text-zinc-100"
                        : "border-white/[0.06] bg-white/[0.01] text-zinc-500 hover:border-white/[0.15]"
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className={active ? "text-emerald-300" : ""}>
                        {c.id}.md
                      </span>
                      <span className="text-[9px]">
                        {active ? "ON" : "OFF"}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[10px] opacity-80">
                      {c.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* 3. Center Workbench Area (Editor / Topology / Preview + Dockable Bottom PTY) */}
        <main className="flex flex-1 flex-col min-w-0 bg-[#060609] overflow-hidden">
          {/* Upper Editor / Canvas Pane */}
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            {/* CODE & UNIFIED DIFF EDITOR */}
            {centerView === "code" && (
              <div className="flex flex-1 flex-col min-h-0">
                <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#08080c] px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-zinc-500">
                      {primaryNode || "local"}:/opt/axon/workspaces/
                      {activeProject?.project_id}/
                    </span>
                    <span className="text-emerald-300 font-medium">
                      {activeFilePath}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setShowDiffDrawer((v) => !v)}
                      className={`flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[11px] ${
                        showDiffDrawer
                          ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                          : "border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-white"
                      }`}
                    >
                      <GitCompare className="h-3 w-3" />
                      Unified Diff
                    </button>
                    <button
                      onClick={handleSaveRemoteFile}
                      className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-0.5 font-mono text-[11px] font-medium text-white hover:bg-emerald-500"
                    >
                      <Save className="h-3 w-3" />
                      Save (Atomic)
                    </button>
                  </div>
                </div>

                <div className="flex flex-1 min-h-0 overflow-hidden">
                  <textarea
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    spellCheck={false}
                    placeholder="// Select a file from the left Explorer or run 'deploy microservice 4050'..."
                    className="flex-1 resize-none bg-[#060609] p-4 font-mono text-[12px] leading-relaxed text-zinc-200 focus:outline-none"
                  />

                  {showDiffDrawer && (
                    <div className="flex w-80 flex-col border-l border-white/[0.07] bg-[#08080c] p-3 space-y-2">
                      <div className="flex items-center justify-between font-mono text-[11px] text-amber-300">
                        <span>Apply Unified Diff</span>
                        <button
                          onClick={handleApplyDiff}
                          className="rounded bg-amber-600 px-2 py-0.5 text-[10px] text-white"
                        >
                          Apply Patch
                        </button>
                      </div>
                      <textarea
                        value={diffPatchText}
                        onChange={(e) => setDiffPatchText(e.target.value)}
                        spellCheck={false}
                        placeholder={`@@ -1,3 +1,3 @@\n-const port = 3000;\n+const port = 4050;`}
                        className="flex-1 resize-none rounded border border-white/[0.07] bg-black p-2 font-mono text-[11px] text-amber-200 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ARCHITECTURE.MD + VISUAL MERMAID TOPOLOGY */}
            {centerView === "architecture" && (
              <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#08080c] px-3 py-1.5">
                  <span className="font-mono text-[11px] text-emerald-300">
                    Vault://Architecture.md — Living System Topology
                  </span>
                  <button
                    onClick={() => handleSaveBrainDoc("Architecture.md")}
                    className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-0.5 font-mono text-[11px] text-white hover:bg-emerald-500"
                  >
                    <Save className="h-3 w-3" />
                    Save Architecture.md
                  </button>
                </div>
                <div className="grid flex-1 grid-cols-1 lg:grid-cols-2 min-h-0 overflow-hidden">
                  <textarea
                    value={architectureMd}
                    onChange={(e) => setArchitectureMd(e.target.value)}
                    spellCheck={false}
                    className="resize-none border-r border-white/[0.06] bg-[#060609] p-4 font-mono text-[12px] leading-relaxed text-zinc-200 focus:outline-none"
                  />
                  <div className="overflow-y-auto p-4 bg-[#07070b]">
                    <MermaidTopologyView markdown={architectureMd} />
                  </div>
                </div>
              </div>
            )}

            {/* MEMORY.MD ENGINEERING JOURNAL */}
            {centerView === "memory" && (
              <div className="flex flex-1 flex-col min-h-0">
                <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#08080c] px-3 py-1.5">
                  <span className="font-mono text-[11px] text-cyan-300">
                    Vault://Memory.md — Chronological Engineering Journal
                  </span>
                  <button
                    onClick={() => handleSaveBrainDoc("Memory.md")}
                    className="flex items-center gap-1 rounded bg-cyan-600 px-2.5 py-0.5 font-mono text-[11px] text-white hover:bg-cyan-500"
                  >
                    <Save className="h-3 w-3" />
                    Save Memory.md
                  </button>
                </div>
                <textarea
                  value={memoryMd}
                  onChange={(e) => setMemoryMd(e.target.value)}
                  spellCheck={false}
                  className="flex-1 resize-none bg-[#060609] p-4 font-mono text-[12px] leading-relaxed text-zinc-200 focus:outline-none"
                />
              </div>
            )}

            {/* SECRETS.ENC VAULT MANAGER */}
            {centerView === "secrets" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="max-w-2xl space-y-4">
                  <div>
                    <h2 className="font-mono text-sm font-semibold text-white">
                      AES-256-GCM Encrypted Secrets Vault (`Secrets.enc`)
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Injected automatically into remote PTY sessions and
                      scrubbed as{" "}
                      <code className="text-amber-300">
                        [REDACTED_SECRET:KEY]
                      </code>{" "}
                      before reaching the LLM context window.
                    </p>
                  </div>

                  <form onSubmit={handleAddSecret} className="flex gap-2">
                    <input
                      type="text"
                      value={newSecretKey}
                      onChange={(e) => setNewSecretKey(e.target.value)}
                      placeholder="KEY_NAME (e.g. DATABASE_URL)"
                      className="flex-1 rounded border border-white/[0.08] bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-200"
                    />
                    <input
                      type="password"
                      value={newSecretVal}
                      onChange={(e) => setNewSecretVal(e.target.value)}
                      placeholder="Secret value..."
                      className="flex-1 rounded border border-white/[0.08] bg-zinc-900 px-3 py-1.5 font-mono text-xs text-zinc-200"
                    />
                    <button
                      type="submit"
                      className="rounded bg-emerald-600 px-4 py-1.5 font-mono text-xs font-medium text-white hover:bg-emerald-500"
                    >
                      Encrypt
                    </button>
                  </form>

                  <div className="divide-y divide-white/[0.06] rounded border border-white/[0.07] bg-[#08080c]">
                    {secretKeys.length === 0 ? (
                      <div className="p-4 font-mono text-xs text-zinc-500">
                        Zero encrypted keys in Secrets.enc
                      </div>
                    ) : (
                      secretKeys.map((k) => (
                        <div
                          key={k}
                          className="flex items-center justify-between px-3.5 py-2 font-mono text-xs"
                        >
                          <span className="text-amber-300">{k}</span>
                          <span className="text-[10px] text-zinc-500">
                            AES-256-GCM • REDACTED IN PTY
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* LIVE-PREVIEW REVERSE PROXY IFRAME */}
            {centerView === "preview" && (
              <div className="flex flex-1 flex-col min-h-0">
                <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#08080c] px-3 py-1.5 font-mono text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400">TUNNEL</span>
                    <span className="text-zinc-400">
                      {gatewayUrl}/preview/{activeProject?.project_id}/
                      {primaryNode || "node"}/
                    </span>
                    <input
                      type="number"
                      value={previewPort}
                      onChange={(e) =>
                        setPreviewPort(Number(e.target.value) || 3000)
                      }
                      className="w-16 rounded border border-white/[0.1] bg-zinc-900 px-1.5 py-0.5 text-zinc-200"
                    />
                  </div>
                  <a
                    href={`${gatewayUrl}/preview/${activeProject?.project_id}/${primaryNode}/${previewPort}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-zinc-400 hover:text-white"
                  >
                    <span>Open External</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <iframe
                  title="Live Preview"
                  src={`${gatewayUrl}/preview/${activeProject?.project_id}/${
                    primaryNode || "unassigned"
                  }/${previewPort}/`}
                  className="flex-1 w-full bg-white"
                />
              </div>
            )}
          </div>

          {/* Lower Dockable Panel: Persistent Stateful PTY (`xterm.js`) & Immutable `Audit.jsonl` */}
          {bottomDockOpen && (
            <div className="flex h-56 shrink-0 flex-col border-t border-white/[0.08] bg-[#060609]">
              <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#09090d] px-3 py-1">
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <button
                    onClick={() => setBottomDockView("pty")}
                    className={`flex items-center gap-1.5 py-0.5 border-b-2 transition ${
                      bottomDockView === "pty"
                        ? "border-emerald-400 text-white"
                        : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <TerminalIcon className="h-3 w-3 text-emerald-400" />
                    <span>TERMINAL (PTY)</span>
                  </button>
                  <button
                    onClick={() => setBottomDockView("audit")}
                    className={`flex items-center gap-1.5 py-0.5 border-b-2 transition ${
                      bottomDockView === "audit"
                        ? "border-emerald-400 text-white"
                        : "border-transparent text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <ShieldAlert className="h-3 w-3 text-cyan-400" />
                    <span>AUDIT.JSONL ({auditLogs.length})</span>
                  </button>
                </div>

                <button
                  onClick={() => setBottomDockOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden">
                {bottomDockView === "pty" ? (
                  primaryNode ? (
                    <XTermTerminal
                      gatewayUrl={gatewayUrl}
                      projectId={
                        activeProject?.project_id || "synapse-cloud-demo"
                      }
                      nodeId={primaryNode}
                      sessionId={`default-${
                        activeProject?.project_id || "synapse-cloud-demo"
                      }`}
                    />
                  ) : (
                    <div className="p-3 font-mono text-xs text-zinc-500">
                      No Axon Muscle Node connected.
                    </div>
                  )
                ) : (
                  <div className="h-full overflow-y-auto divide-y divide-white/[0.04] p-2 font-mono text-[11px]">
                    {auditLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1 px-2 hover:bg-white/[0.02]"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-zinc-600">
                            {log.timestamp.slice(11, 19)}
                          </span>
                          <span className="text-emerald-400">
                            {log.tool_name}
                          </span>
                          <span className="truncate text-zinc-400">
                            {log.summary}
                          </span>
                        </div>
                        <span
                          className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase ${
                            log.status === "executed"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-amber-500/15 text-amber-300"
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        {/* 4. Right AI Copilot & Autonomous Orchestrator Dock (370px) */}
        <aside className="flex w-[370px] shrink-0 flex-col border-l border-white/[0.07] bg-[#08080c] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-white">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span>AI ORCHESTRATOR</span>
            </div>
            <button
              onClick={() => handleQuickAction("deploy microservice 4050")}
              disabled={chatBusy}
              className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300 hover:bg-emerald-500/20"
            >
              <Play className="h-2.5 w-2.5" />
              Auto-Deploy :4050
            </button>
          </div>

          {/* TIER_3_SUPERVISED Inline Approvals */}
          {pendingApprovals.length > 0 && (
            <div className="border-b border-amber-500/30 bg-amber-500/10 p-2.5 space-y-2">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>TIER_3_SUPERVISED APPROVAL</span>
              </div>
              {pendingApprovals.map((appr) => (
                <div
                  key={appr.approval_id}
                  className="rounded border border-amber-500/30 bg-black/60 p-2 font-mono text-[10px] space-y-1.5"
                >
                  <div className="text-amber-200">
                    {appr.tool_name} @ {appr.node_id}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() =>
                        handleResolveApproval(appr.approval_id, "approve")
                      }
                      className="flex-1 rounded bg-emerald-600 py-1 text-white"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() =>
                        handleResolveApproval(appr.approval_id, "reject")
                      }
                      className="flex-1 rounded bg-rose-600 py-1 text-white"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Chat Message Stream */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatHistory.map((item, idx) => (
              <div
                key={idx}
                className={`rounded-lg border p-2.5 text-xs ${
                  item.role === "user"
                    ? "border-emerald-500/25 bg-emerald-500/[0.06] text-zinc-100 ml-4"
                    : "border-white/[0.06] bg-white/[0.02] text-zinc-300"
                }`}
              >
                <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-zinc-500">
                  <span>{item.role === "user" ? "YOU" : "SYNAPSE BRAIN"}</span>
                </div>
                <div className="whitespace-pre-wrap leading-relaxed text-[12px]">
                  {item.content}
                </div>

                {/* Compact Collapsible Execution Pills */}
                {item.toolResults && item.toolResults.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {item.toolResults.map((tr, tIdx) => {
                      const pillKey = `${idx}-${tIdx}`;
                      const isExp = expandedTools[pillKey];
                      return (
                        <div
                          key={tIdx}
                          className="rounded border border-white/[0.07] bg-[#050508] font-mono text-[10px]"
                        >
                          <button
                            onClick={() =>
                              setExpandedTools((p) => ({
                                ...p,
                                [pillKey]: !p[pillKey],
                              }))
                            }
                            className="flex w-full items-center justify-between px-2 py-1 text-left"
                          >
                            <span className="flex items-center gap-1.5 text-emerald-400">
                              {isExp ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                              <span>{tr.tool_name}</span>
                            </span>
                            <span
                              className={`uppercase ${
                                tr.status === "executed"
                                  ? "text-emerald-400"
                                  : "text-rose-400"
                              }`}
                            >
                              {tr.status}
                            </span>
                          </button>
                          {isExp && (
                            <pre className="border-t border-white/[0.06] p-2 overflow-x-auto text-zinc-400 max-h-40">
                              {JSON.stringify(tr.output, null, 2)}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick Command Chips */}
          <div className="flex items-center gap-1 overflow-x-auto border-t border-white/[0.05] px-2.5 py-1.5">
            {[
              { label: "$ uname -a", cmd: "$ uname -a && pwd" },
              { label: "ls workspace", cmd: "list files" },
              {
                label: "Test Guardrail",
                cmd: "$ sudo systemctl stop axon.service",
              },
            ].map((chip) => (
              <button
                key={chip.label}
                onClick={() => handleQuickAction(chip.cmd)}
                className="shrink-0 rounded border border-white/[0.07] bg-white/[0.02] px-2 py-0.5 font-mono text-[10px] text-zinc-400 hover:border-emerald-500/30 hover:text-zinc-200"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Prompt Composer */}
          <form
            onSubmit={handleSendMessage}
            className="border-t border-white/[0.07] bg-[#09090d] p-2.5"
          >
            <div className="flex items-center gap-1.5 rounded-md border border-white/[0.09] bg-[#050508] px-2.5 py-1.5 focus-within:border-emerald-500/50">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask AI or run '$ <cmd>'..."
                className="flex-1 bg-transparent font-mono text-xs text-zinc-100 focus:outline-none"
              />
              <button
                type="submit"
                disabled={chatBusy}
                className="rounded bg-emerald-600 p-1.5 text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                <Send className="h-3 w-3" />
              </button>
            </div>
          </form>
        </aside>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          BOTTOM IDE STATUS BAR (22px)
      ═══════════════════════════════════════════════════════════════════════ */}
      <footer className="flex h-6 shrink-0 items-center justify-between border-t border-white/[0.07] bg-[#09090d] px-3 font-mono text-[10px] text-zinc-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            mTLS+Yamux: {gatewayNodes.length} Node(s)
          </span>
          {activeHeartbeat && (
            <span>
              CPU {activeHeartbeat.cpu_percent.toFixed(1)}% • RAM{" "}
              {activeHeartbeat.ram_percent.toFixed(1)}%
            </span>
          )}
          <span className="text-zinc-400">{editorStatus}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAiEndpointModalOpen(true)}
            className="hover:text-emerald-300"
          >
            Endpoint: {baseUrl} ({modelName})
          </button>
          <span>Cartridges: {activeProject?.active_cartridges.length || 0}</span>
        </div>
      </footer>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: CUSTOM API BASE URL & MODEL CONFIGURATION
      ═══════════════════════════════════════════════════════════════════════ */}
      {aiEndpointModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-white/[0.1] bg-[#0b0b10] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
              <div>
                <h3 className="font-mono text-sm font-semibold text-white">
                  AI Provider &amp; Custom Base URL Configuration
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Connect any OpenAI-compatible API (OpenRouter, vLLM, LiteLLM,
                  Ollama, DeepSeek) or Anthropic proxy.
                </p>
              </div>
              <button
                onClick={() => setAiEndpointModalOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAiEndpoint} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-mono text-[11px] text-zinc-400 mb-1">
                  Provider Protocol Preset
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
                  className="w-full rounded border border-white/[0.1] bg-zinc-900 px-3 py-2 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  {Object.entries(PROVIDER_PRESETS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-mono text-[11px] text-zinc-400 mb-1">
                  Custom API Base URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1 or http://10.0.0.5:11434/v1"
                    className="flex-1 rounded border border-white/[0.1] bg-zinc-900 px-3 py-2 font-mono text-xs text-emerald-300 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSyncModels}
                    disabled={syncingModels}
                    className="flex items-center gap-1.5 rounded border border-white/[0.1] bg-white/[0.04] px-3 py-2 font-mono text-[11px] text-zinc-200 hover:bg-white/[0.08]"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        syncingModels ? "animate-spin" : ""
                      }`}
                    />
                    Fetch /models
                  </button>
                </div>
                {modelSyncStatus && (
                  <p className="mt-1 font-mono text-[10px] text-cyan-300">
                    {modelSyncStatus}
                  </p>
                )}
              </div>

              <div>
                <label className="block font-mono text-[11px] text-zinc-400 mb-1">
                  Model Identifier
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="e.g. gpt-4o, claude-3-5-sonnet, deepseek-chat"
                    className="flex-1 rounded border border-white/[0.1] bg-zinc-900 px-3 py-2 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                  {discoveredModels.length > 0 && (
                    <select
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      className="max-w-[180px] rounded border border-white/[0.1] bg-zinc-900 px-2 py-2 font-mono text-xs text-emerald-300"
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

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="block font-mono text-[11px] text-zinc-400 mb-1">
                    Vault Secret Name
                  </label>
                  <input
                    type="text"
                    value={apiKeySecretName}
                    onChange={(e) => setApiKeySecretName(e.target.value)}
                    className="w-full rounded border border-white/[0.1] bg-zinc-900 px-2.5 py-2 font-mono text-xs text-amber-300"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-mono text-[11px] text-zinc-400 mb-1">
                    API Key (Encrypted in Vault Secrets.enc)
                  </label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={
                      secretKeys.includes(apiKeySecretName)
                        ? "•••••••• (Stored in Secrets.enc — leave blank to keep)"
                        : "sk-..."
                    }
                    className="w-full rounded border border-white/[0.1] bg-zinc-900 px-3 py-2 font-mono text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setAiEndpointModalOpen(false)}
                  className="rounded border border-white/[0.08] px-3 py-1.5 font-mono text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded bg-emerald-600 px-4 py-1.5 font-mono text-xs font-medium text-white hover:bg-emerald-500"
                >
                  <Check className="h-3.5 w-3.5" />
                  Save Endpoint to Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW PROJECT BRAIN VAULT */}
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
            className="w-full max-w-sm rounded-xl border border-white/[0.1] bg-[#0b0b10] p-4 space-y-3"
          >
            <div className="flex items-center justify-between font-mono text-xs font-semibold text-white">
              <span>Initialize New Project Brain Vault</span>
              <button
                type="button"
                onClick={() => setNewProjectModal(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
              placeholder="project-id (e.g. edge-api-v2)"
              className="w-full rounded border border-white/[0.1] bg-zinc-900 px-3 py-2 font-mono text-xs text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                className="rounded bg-emerald-600 px-3 py-1.5 font-mono text-xs text-white"
              >
                Create Vault
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
