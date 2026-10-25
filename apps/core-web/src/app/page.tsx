"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Code2,
  Command,
  Cpu,
  Edit3,
  Eye,
  ExternalLink,
  FileCode2,
  FileText,
  Folder,
  GitCompare,
  Globe,
  KeyRound,
  Layers,
  Loader2,
  Lock,
  Network,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from "lucide-react";
import type { AutonomyTier, FsEntry, NodeHeartbeat } from "@proto/tunnel";
import RichMarkdownDocument from "@/components/RichMarkdownDocument";

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

export default function SynapseCalmStudio() {
  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectState | null>(null);
  const [architectureMd, setArchitectureMd] = useState("");
  const [memoryMd, setMemoryMd] = useState("");
  const [secretKeys, setSecretKeys] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [cartridges, setCartridges] = useState<CartridgeMeta[]>([]);
  const [gatewayNodes, setGatewayNodes] = useState<GatewayNode[]>([]);
  const [gatewayUrl, setGatewayUrl] = useState("http://127.0.0.1:8081");

  // Focused 2026 Studio Navigation (Only ONE focused main view at a time!)
  const [mainStageView, setMainStageView] = useState<
    "brain" | "workspace" | "preview" | "infrastructure"
  >("brain");
  const [brainSubTab, setBrainSubTab] = useState<
    "architecture" | "memory" | "cartridges"
  >("architecture");
  const [selectedCartridgeId, setSelectedCartridgeId] =
    useState<string>("docker-first");
  const [isEditingMarkdown, setIsEditingMarkdown] = useState(false);

  // Collapsible Bottom Terminal Drawer (Closed by default so user is never overwhelmed!)
  const [terminalDrawerOpen, setTerminalDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"pty" | "audit">("pty");
  const [aiEndpointModalOpen, setAiEndpointModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");

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
  const [statusToast, setStatusToast] = useState<string>("");

  // AI Provider & Custom Base URL Configuration
  const [provider, setProvider] = useState("openai-compatible");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [modelName, setModelName] = useState("gpt-4o");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeySecretName, setApiKeySecretName] = useState("LLM_API_KEY");
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [syncingModels, setSyncingModels] = useState(false);
  const [modelSyncStatus, setModelSyncStatus] = useState("");

  // Copilot Chat & Live SSE Step Streaming State
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [liveSteps, setLiveSteps] = useState<
    Array<{
      step: number;
      tool_name: string;
      status: "running" | "executed" | "blocked" | "requires_approval" | "error";
    }>
  >([]);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>(
    {}
  );
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([
    {
      role: "assistant",
      content:
        "Welcome to **Synapse Studio**. Your project documents (`Architecture.md`, `Memory.md`, and `Rule Cartridges`) are rendered cleanly on the right.\n\nPress **`Ctrl+K`** (`⌘K`) for the Command Palette or click the **API Endpoint pill** in the top-right to configure any custom `Base URL`.",
    },
  ]);

  // Node Enrollment & Secrets
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [joinTier, setJoinTier] = useState<AutonomyTier>(
    "TIER_2_WORKSPACE_JAIL"
  );
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
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

        if (syncAiSettings && Array.isArray(data.chat_history)) {
          if (data.chat_history.length > 0) {
            setChatHistory(data.chat_history);
          } else {
            setChatHistory([
              {
                role: "assistant",
                content:
                  "Welcome to **Synapse Studio**. Your project documents (`Architecture.md`, `Memory.md`, and `Rule Cartridges`) are rendered cleanly on the right.\n\nPress **`Ctrl+K`** (`⌘K`) for the Command Palette or click the **API Endpoint pill** in the top-right to configure any custom `Base URL`.",
              },
            ]);
          }
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

  // Global Ctrl+K / Cmd+K Command Palette Shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
        setCommandQuery("");
      } else if (e.key === "Escape") {
        setCommandPaletteOpen(false);
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

  async function handleApplyDiff() {
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
      setEditorContent(tr.output.content || editorContent);
      setDiffPatchText("");
      setShowDiffDrawer(false);
      setStatusToast(`Applied Unified Diff to ${activeFilePath}`);
      setTimeout(() => setStatusToast(""), 3000);
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
    setStatusToast(`Saved API Endpoint: ${baseUrl}`);
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

  async function runStreamingPrompt(
    promptText: string,
    overrideProvider?: string
  ) {
    if (!activeProject || !promptText.trim()) return;
    const userMsg: ChatItem = { role: "user", content: promptText };
    const nextHistory = [...chatHistory, userMsg];
    setChatHistory(nextHistory);
    setChatBusy(true);
    setLiveSteps([]);

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
          const line = frame
            .split("\n")
            .find((l) => l.startsWith("data:"));
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
                    ? { ...s, status: evt.result.status }
                    : s
                )
              );
            } else if (evt.type === "complete") {
              setChatHistory((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: evt.reply || "Completed.",
                  toolResults: evt.tool_results,
                },
              ]);
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
      if (primaryNode) fetchRemoteDir(remoteDir);
    } finally {
      setChatBusy(false);
      setLiveSteps([]);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !activeProject) return;
    const text = chatInput;
    setChatInput("");
    await runStreamingPrompt(text);
  }

  async function handleQuickAction(promptText: string) {
    if (!activeProject) return;
    await runStreamingPrompt(promptText, "synapse-autonomous");
  }

  async function handleClearChat() {
    if (!activeProject) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "clear_chat",
        project_id: activeProject.project_id,
      }),
    });
    setChatHistory([
      {
        role: "assistant",
        content:
          "Conversation history compacted & cleared (`Chat.jsonl` reset).",
      },
    ]);
    setStatusToast("Cleared Chat.jsonl");
    setTimeout(() => setStatusToast(""), 3000);
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

  const currentCartridge =
    cartridges.find((c) => c.id === selectedCartridgeId) || cartridges[0];

  return (
    <div className="flex h-screen w-screen flex-col bg-[#07070a] text-zinc-100 overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════════════════
          CLEAN 2026 TOP NAVIGATION BAR (Airy, Minimal, Focused)
      ═══════════════════════════════════════════════════════════════════════ */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#0a0a0f]/90 px-5 backdrop-blur-md">
        {/* Left: Brand & Project Selector */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-sm">
              <Cpu className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight text-white text-sm">
              Synapse
            </span>
          </div>

          <span className="text-zinc-700">/</span>

          <div className="flex items-center gap-1.5">
            <select
              value={activeProject?.project_id || ""}
              onChange={(e) => loadWorkspace(e.target.value, true)}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-white/[0.15] focus:border-emerald-500 focus:outline-none"
            >
              {projects.map((p) => (
                <option
                  key={p.project_id}
                  value={p.project_id}
                  className="bg-zinc-900"
                >
                  {p.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => setNewProjectModal(true)}
              className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
              title="New Project Vault"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {activeProject?.planning_only ? (
            <span className="hidden sm:flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
              <Lock className="h-3 w-3" />
              Planning-Only
            </span>
          ) : (
            <span className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {primaryNode}
            </span>
          )}
        </div>

        {/* Center: 4 Clean Primary Stage Pills */}
        <nav className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
          {[
            {
              id: "brain",
              label: "Brain & Architecture",
              icon: BookOpen,
            },
            {
              id: "workspace",
              label: "Remote Code",
              icon: Code2,
            },
            {
              id: "preview",
              label: "Live App Preview",
              icon: Globe,
            },
            {
              id: "infrastructure",
              label: `Nodes & Vault (${gatewayNodes.length})`,
              icon: Server,
            },
          ].map((item) => {
            const Icon = item.icon;
            const active = mainStageView === item.id;
            return (
              <button
                key={item.id}
                onClick={() =>
                  setMainStageView(item.id as typeof mainStageView)
                }
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? "bg-white/[0.1] text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${
                    active ? "text-emerald-400" : "text-zinc-500"
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Command Palette (Ctrl+K) & Custom Base URL Pill */}
        <div className="flex items-center gap-2">
          {statusToast && (
            <span className="hidden lg:inline-block rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] text-emerald-300">
              {statusToast}
            </span>
          )}

          <button
            onClick={() => {
              setCommandPaletteOpen(true);
              setCommandQuery("");
            }}
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-xs text-zinc-400 transition hover:border-white/[0.18] hover:text-zinc-200"
            title="Open Command Palette (Ctrl+K)"
          >
            <Command className="h-3.5 w-3.5 text-zinc-500" />
            <span className="font-mono text-[11px]">Ctrl+K</span>
          </button>

          <button
            onClick={() => setAiEndpointModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 transition hover:border-emerald-500/40 hover:bg-white/[0.06]"
          >
            <Settings2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-medium text-white">{modelName}</span>
            <span className="hidden md:inline text-zinc-500">·</span>
            <span className="hidden md:inline font-mono text-[11px] text-zinc-400 max-w-[160px] truncate">
              {baseUrl.replace(/^https?:\/\//, "")}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          CALM 2-COLUMN STUDIO WORKSPACE (Left: AI Copilot | Right: Focused Stage)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: Clean AI Orchestrator & Conversation Stream (400px) */}
        <aside className="flex w-[400px] shrink-0 flex-col border-r border-white/[0.07] bg-[#09090e] overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold tracking-wide text-zinc-200">
                AI Orchestrator
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleClearChat}
                disabled={chatBusy}
                title="Compact / Clear Conversation History (Chat.jsonl)"
                className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
              </button>
              <button
                onClick={() => handleQuickAction("deploy microservice 4050")}
                disabled={chatBusy}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                <Play className="h-3 w-3" />
                Auto-Deploy :4050
              </button>
            </div>
          </div>

          {/* TIER_3_SUPERVISED Approval Banner (Only visible when needed) */}
          {pendingApprovals.length > 0 && (
            <div className="border-b border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                <span>Approval Required (TIER_3_SUPERVISED)</span>
              </div>
              {pendingApprovals.map((appr) => (
                <div
                  key={appr.approval_id}
                  className="rounded-lg border border-amber-500/30 bg-black/60 p-2.5 text-xs space-y-2"
                >
                  <div className="font-mono text-amber-200">
                    {appr.tool_name} on {appr.node_id}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleResolveApproval(appr.approval_id, "approve")
                      }
                      className="flex-1 rounded-md bg-emerald-600 py-1 font-medium text-white"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() =>
                        handleResolveApproval(appr.approval_id, "reject")
                      }
                      className="flex-1 rounded-md bg-rose-600 py-1 font-medium text-white"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Conversation Messages with Formatted Markdown */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatHistory.map((item, idx) => (
              <div
                key={idx}
                className={`rounded-2xl p-4 ${
                  item.role === "user"
                    ? "ml-6 border border-emerald-500/25 bg-emerald-500/[0.08] text-white"
                    : "border border-white/[0.06] bg-white/[0.02] text-zinc-200"
                }`}
              >
                <div className="mb-1.5 text-[11px] font-medium text-zinc-500">
                  {item.role === "user" ? "You" : "Synapse Brain"}
                </div>

                <RichMarkdownDocument
                  markdown={item.content}
                  variant="chat"
                />

                {/* Clean Collapsible Tool Execution Pills */}
                {item.toolResults && item.toolResults.length > 0 && (
                  <div className="mt-3 space-y-1.5 pt-2 border-t border-white/[0.06]">
                    {item.toolResults.map((tr, tIdx) => {
                      const pillKey = `${idx}-${tIdx}`;
                      const isExp = expandedTools[pillKey];
                      return (
                        <div
                          key={tIdx}
                          className="rounded-lg border border-white/[0.07] bg-[#060609] text-xs overflow-hidden"
                        >
                          <button
                            onClick={() =>
                              setExpandedTools((p) => ({
                                ...p,
                                [pillKey]: !p[pillKey],
                              }))
                            }
                            className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-white/[0.02]"
                          >
                            <span className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-300">
                              {isExp ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                              <span>{tr.tool_name}</span>
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${
                                tr.status === "executed"
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : "bg-rose-500/15 text-rose-300"
                              }`}
                            >
                              {tr.status}
                            </span>
                          </button>
                          {isExp && (
                            <pre className="border-t border-white/[0.06] p-3 overflow-x-auto font-mono text-[11px] text-zinc-400 max-h-44">
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

            {/* Live SSE Tool-Step Progress Card */}
            {chatBusy && (
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Synapse Brain executing...</span>
                </div>
                {liveSteps.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {liveSteps.map((ls, sIdx) => (
                      <div
                        key={`${ls.step}-${ls.tool_name}-${sIdx}`}
                        className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/50 px-2.5 py-1.5 font-mono text-[11px]"
                      >
                        <span className="text-zinc-300">
                          Step {ls.step}: {ls.tool_name}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
                            ls.status === "running"
                              ? "bg-amber-500/20 text-amber-300 animate-pulse"
                              : ls.status === "executed"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-rose-500/20 text-rose-300"
                          }`}
                        >
                          {ls.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subtle Quick Actions & Input Box */}
          <div className="border-t border-white/[0.07] bg-[#0a0a0f] p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { label: "$ uname -a", cmd: "$ uname -a && pwd" },
                { label: "List files", cmd: "list files" },
                {
                  label: "Test Guardrail",
                  cmd: "$ sudo systemctl stop axon.service",
                },
              ].map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleQuickAction(chip.cmd)}
                  className="shrink-0 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-[11px] text-zinc-400 hover:border-emerald-500/30 hover:text-zinc-200"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <form
              onSubmit={handleSendMessage}
              className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-[#060609] px-3 py-2 focus-within:border-emerald-500/50"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Synapse or run '$ <command>'..."
                className="flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={chatBusy}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </aside>

        {/* RIGHT COLUMN: Spacious Main Stage + Collapsible Bottom Drawer */}
        <main className="flex flex-1 flex-col min-w-0 bg-[#07070a] overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {/* ───────────────────────────────────────────────────────────────
                STAGE 1: BRAIN & ARCHITECTURE (Formatted Markdown & Timeline!)
            ─────────────────────────────────────────────────────────────── */}
            {mainStageView === "brain" && (
              <div className="mx-auto max-w-4xl px-8 py-8 space-y-6">
                {/* Document Sub-Navigation Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
                  <div className="flex items-center gap-2">
                    {[
                      {
                        id: "architecture",
                        label: "System Architecture",
                        icon: Network,
                      },
                      {
                        id: "memory",
                        label: "Engineering Journal",
                        icon: FileText,
                      },
                      {
                        id: "cartridges",
                        label: `Rule Cartridges (${
                          activeProject?.active_cartridges.length || 0
                        } Active)`,
                        icon: Layers,
                      },
                    ].map((sub) => {
                      const Icon = sub.icon;
                      const active = brainSubTab === sub.id;
                      return (
                        <button
                          key={sub.id}
                          onClick={() => {
                            setBrainSubTab(sub.id as typeof brainSubTab);
                            setIsEditingMarkdown(false);
                          }}
                          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition ${
                            active
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Clean Preview vs Edit Source Toggle */}
                  {brainSubTab !== "cartridges" && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditingMarkdown((v) => !v)}
                        className="flex items-center gap-1.5 rounded-xl border border-white/[0.09] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.07]"
                      >
                        {isEditingMarkdown ? (
                          <>
                            <Eye className="h-3.5 w-3.5 text-emerald-400" />
                            <span>Rendered View</span>
                          </>
                        ) : (
                          <>
                            <Edit3 className="h-3.5 w-3.5 text-zinc-400" />
                            <span>Edit Markdown</span>
                          </>
                        )}
                      </button>

                      {isEditingMarkdown && (
                        <button
                          onClick={() =>
                            handleSaveBrainDoc(
                              brainSubTab === "architecture"
                                ? "Architecture.md"
                                : "Memory.md"
                            )
                          }
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                        >
                          <Save className="h-3.5 w-3.5" />
                          <span>Save Changes</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* SUB-TAB 1A: ARCHITECTURE.MD (Rich Rendered View vs Source) */}
                {brainSubTab === "architecture" &&
                  (isEditingMarkdown ? (
                    <textarea
                      value={architectureMd}
                      onChange={(e) => setArchitectureMd(e.target.value)}
                      rows={20}
                      spellCheck={false}
                      className="w-full rounded-2xl border border-white/[0.1] bg-[#0b0b10] p-5 font-mono text-xs leading-relaxed text-zinc-200 focus:border-emerald-500 focus:outline-none"
                    />
                  ) : (
                    <div className="rounded-2xl border border-white/[0.07] bg-[#0b0b11] p-7 shadow-xl">
                      <RichMarkdownDocument
                        markdown={architectureMd}
                        variant="architecture"
                      />
                    </div>
                  ))}

                {/* SUB-TAB 1B: MEMORY.MD (Chronological Timeline Cards vs Source) */}
                {brainSubTab === "memory" &&
                  (isEditingMarkdown ? (
                    <textarea
                      value={memoryMd}
                      onChange={(e) => setMemoryMd(e.target.value)}
                      rows={20}
                      spellCheck={false}
                      className="w-full rounded-2xl border border-white/[0.1] bg-[#0b0b10] p-5 font-mono text-xs leading-relaxed text-zinc-200 focus:border-emerald-500 focus:outline-none"
                    />
                  ) : (
                    <div className="rounded-2xl border border-white/[0.07] bg-[#0b0b11] p-7 shadow-xl">
                      <RichMarkdownDocument
                        markdown={memoryMd}
                        variant="memory"
                      />
                    </div>
                  ))}

                {/* SUB-TAB 1C: PLUGGABLE RULE CARTRIDGES (Formatted Reader + Toggle) */}
                {brainSubTab === "cartridges" && (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <div className="space-y-2.5">
                      {cartridges.map((c) => {
                        const enabled =
                          activeProject?.active_cartridges.includes(c.id) ??
                          false;
                        const selected = currentCartridge?.id === c.id;
                        return (
                          <div
                            key={c.id}
                            onClick={() => setSelectedCartridgeId(c.id)}
                            className={`cursor-pointer rounded-2xl border p-4 transition ${
                              selected
                                ? "border-emerald-500/40 bg-white/[0.04]"
                                : "border-white/[0.07] bg-[#0b0b11] hover:border-white/[0.15]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-white">
                                {c.name}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleCartridge(c.id);
                                }}
                                className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium transition ${
                                  enabled
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                    : "bg-white/[0.05] text-zinc-400"
                                }`}
                              >
                                {enabled ? "Active" : "Disabled"}
                              </button>
                            </div>
                            <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">
                              {c.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="lg:col-span-2 rounded-2xl border border-white/[0.07] bg-[#0b0b11] p-7 shadow-xl">
                      {currentCartridge && (
                        <RichMarkdownDocument
                          markdown={currentCartridge.content}
                          variant="cartridge"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ───────────────────────────────────────────────────────────────
                STAGE 2: REMOTE WORKSPACE CODE & ATOMIC FS
            ─────────────────────────────────────────────────────────────── */}
            {mainStageView === "workspace" && (
              <div className="flex h-full min-h-[600px]">
                {/* File Tree Column */}
                <div className="w-64 shrink-0 border-r border-white/[0.07] bg-[#09090e] p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300">
                      Files ({remoteDir})
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => fetchRemoteDir(".")}
                        className="rounded px-2 py-0.5 text-[11px] text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                      >
                        Root
                      </button>
                      <button
                        onClick={() => fetchRemoteDir(remoteDir)}
                        className="rounded p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newFileName.trim()) return;
                      setActiveFilePath(newFileName.trim());
                      setEditorContent(
                        `// ${newFileName.trim()} — Synapse Workspace\n`
                      );
                      setNewFileName("");
                    }}
                    className="flex gap-1.5"
                  >
                    <input
                      type="text"
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      placeholder="New file path..."
                      className="flex-1 rounded-lg border border-white/[0.08] bg-zinc-900 px-2.5 py-1.5 font-mono text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-600 px-2.5 text-white hover:bg-emerald-500"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </form>

                  <div className="flex-1 space-y-1 overflow-y-auto">
                    {remoteEntries.map((entry) => (
                      <div
                        key={entry.path}
                        className="group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs hover:bg-white/[0.04]"
                      >
                        <button
                          onClick={() =>
                            entry.is_dir
                              ? fetchRemoteDir(entry.path)
                              : openRemoteFile(entry.path)
                          }
                          className="flex flex-1 items-center gap-2 truncate text-left font-mono text-zinc-300 hover:text-emerald-300"
                        >
                          {entry.is_dir ? (
                            <Folder className="h-4 w-4 shrink-0 text-amber-400" />
                          ) : (
                            <FileCode2 className="h-4 w-4 shrink-0 text-cyan-400" />
                          )}
                          <span className="truncate">{entry.name}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteRemoteFile(entry.path)}
                          className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Code Editor Area */}
                <div className="flex flex-1 flex-col bg-[#07070a]">
                  <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#0a0a0f] px-5 py-2.5">
                    <span className="font-mono text-xs text-emerald-300">
                      {activeFilePath}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowDiffDrawer((v) => !v)}
                        className="flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.03] px-3 py-1 text-xs text-zinc-300 hover:bg-white/[0.07]"
                      >
                        <GitCompare className="h-3.5 w-3.5 text-amber-400" />
                        <span>Unified Diff</span>
                      </button>
                      <button
                        onClick={handleSaveRemoteFile}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1 text-xs font-medium text-white hover:bg-emerald-500"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>Save File</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-1 min-h-0">
                    <textarea
                      value={editorContent}
                      onChange={(e) => setEditorContent(e.target.value)}
                      spellCheck={false}
                      className="flex-1 resize-none bg-[#07070a] p-6 font-mono text-xs leading-relaxed text-zinc-200 focus:outline-none"
                    />
                    {showDiffDrawer && (
                      <div className="w-80 border-l border-white/[0.07] bg-[#09090e] p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between text-xs font-medium text-amber-300">
                          <span>Apply Unified Diff</span>
                          <button
                            onClick={handleApplyDiff}
                            className="rounded-lg bg-amber-600 px-2.5 py-1 text-white"
                          >
                            Apply Patch
                          </button>
                        </div>
                        <textarea
                          value={diffPatchText}
                          onChange={(e) => setDiffPatchText(e.target.value)}
                          spellCheck={false}
                          placeholder={`@@ -1,3 +1,3 @@\n-const port = 3000;\n+const port = 4050;`}
                          className="flex-1 resize-none rounded-xl border border-white/[0.08] bg-black p-3 font-mono text-xs text-amber-200 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ───────────────────────────────────────────────────────────────
                STAGE 3: LIVE APP PREVIEW (Clean Browser Frame)
            ─────────────────────────────────────────────────────────────── */}
            {mainStageView === "preview" && (
              <div className="flex h-full flex-col p-6">
                <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0b0b11] shadow-2xl">
                  <div className="flex items-center justify-between border-b border-white/[0.07] bg-[#0e0e15] px-4 py-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-rose-500/60" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
                      <span className="ml-2 font-mono text-zinc-400">
                        {gatewayUrl}/preview/{activeProject?.project_id}/
                        {primaryNode || "node"}/
                      </span>
                      <input
                        type="number"
                        value={previewPort}
                        onChange={(e) =>
                          setPreviewPort(Number(e.target.value) || 3000)
                        }
                        className="w-20 rounded-md border border-white/[0.1] bg-zinc-900 px-2 py-0.5 font-mono text-xs text-emerald-300"
                      />
                    </div>
                    <a
                      href={`${gatewayUrl}/preview/${activeProject?.project_id}/${primaryNode}/${previewPort}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-zinc-400 hover:text-white"
                    >
                      <span>Open in New Tab</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <iframe
                    title="Synapse Live Preview"
                    src={`${gatewayUrl}/preview/${activeProject?.project_id}/${
                      primaryNode || "unassigned"
                    }/${previewPort}/`}
                    className="flex-1 w-full bg-white min-h-[520px]"
                  />
                </div>
              </div>
            )}

            {/* ───────────────────────────────────────────────────────────────
                STAGE 4: NODES, TELEMETRY & SECRETS VAULT
            ─────────────────────────────────────────────────────────────── */}
            {mainStageView === "infrastructure" && (
              <div className="mx-auto max-w-4xl px-8 py-8 space-y-8">
                {/* Connected Axon Nodes */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#0b0b11] p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-base font-semibold text-white">
                        Axon Muscle Nodes (mTLS 1.3 + Yamux)
                      </h2>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Enroll external Linux servers with a one-liner or manage
                        autonomy tiers.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={joinTier}
                        onChange={(e) =>
                          setJoinTier(e.target.value as AutonomyTier)
                        }
                        className="rounded-xl border border-white/[0.09] bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200"
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
                        className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                      >
                        Generate Join Command
                      </button>
                    </div>
                  </div>

                  {issuedToken && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] p-4 space-y-2">
                      <div className="text-xs font-medium text-emerald-300">
                        Run on your Linux server to enroll via CSR:
                      </div>
                      <pre className="overflow-x-auto rounded-lg bg-black/80 p-3 font-mono text-xs text-emerald-400">
                        {`curl -fsSL ${gatewayUrl}/install.sh | sh -s -- ${issuedToken} ${joinTier}`}
                      </pre>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {gatewayNodes.map((gn) => {
                      const isAssigned = activeProject?.assigned_nodes.some(
                        (a) => a.node_id === gn.node_id
                      );
                      return (
                        <div
                          key={gn.node_id}
                          className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm font-semibold text-white flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-emerald-400" />
                              {gn.node_id}
                            </span>
                            <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 font-mono text-[10px] text-cyan-300">
                              {gn.tier}
                            </span>
                          </div>
                          {gn.last_heartbeat && (
                            <div className="grid grid-cols-3 gap-2 rounded-lg bg-black/40 p-2.5 font-mono text-xs text-zinc-300">
                              <div>
                                CPU {gn.last_heartbeat.cpu_percent.toFixed(1)}%
                              </div>
                              <div>
                                RAM {gn.last_heartbeat.ram_percent.toFixed(1)}%
                              </div>
                              <div>
                                DSK {gn.last_heartbeat.disk_percent.toFixed(1)}%
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() =>
                              isAssigned
                                ? handleUnassignNode(gn.node_id)
                                : handleAssignNode(gn.node_id, gn.tier)
                            }
                            className={`w-full rounded-lg py-1.5 text-xs font-medium ${
                              isAssigned
                                ? "border border-rose-500/30 bg-rose-500/10 text-rose-300"
                                : "bg-emerald-600 text-white"
                            }`}
                          >
                            {isAssigned
                              ? "Unassign from Project"
                              : "Assign to Project"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Encrypted Secrets Vault */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#0b0b11] p-6 space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-white flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-amber-400" />
                      Encrypted Secrets Vault (`Secrets.enc`)
                    </h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      AES-256-GCM encrypted keys. Automatically injected into
                      PTY sessions and redacted as{" "}
                      <code className="text-amber-300">
                        [REDACTED_SECRET:KEY]
                      </code>
                      .
                    </p>
                  </div>

                  <form onSubmit={handleAddSecret} className="flex gap-2.5">
                    <input
                      type="text"
                      value={newSecretKey}
                      onChange={(e) => setNewSecretKey(e.target.value)}
                      placeholder="SECRET_NAME (e.g. STRIPE_SECRET_KEY)"
                      className="flex-1 rounded-xl border border-white/[0.09] bg-zinc-900 px-3.5 py-2 font-mono text-xs text-zinc-200"
                    />
                    <input
                      type="password"
                      value={newSecretVal}
                      onChange={(e) => setNewSecretVal(e.target.value)}
                      placeholder="Secret value..."
                      className="flex-1 rounded-xl border border-white/[0.09] bg-zinc-900 px-3.5 py-2 font-mono text-xs text-zinc-200"
                    />
                    <button
                      type="submit"
                      className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-500"
                    >
                      Encrypt &amp; Save
                    </button>
                  </form>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {secretKeys.map((k) => (
                      <div
                        key={k}
                        className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 font-mono text-xs"
                      >
                        <span className="text-amber-300">{k}</span>
                        <span className="text-[10px] text-zinc-500">
                          AES-256-GCM
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════════
              COLLAPSIBLE BOTTOM TERMINAL & AUDIT BAR (Sleek Drawer)
          ═══════════════════════════════════════════════════════════════════ */}
          <div className="shrink-0 border-t border-white/[0.07] bg-[#0a0a0f]">
            <div className="flex h-9 items-center justify-between px-4 text-xs">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setDrawerTab("pty");
                    setTerminalDrawerOpen((v) =>
                      drawerTab === "pty" ? !v : true
                    );
                  }}
                  className={`flex items-center gap-1.5 font-mono text-[11px] transition ${
                    terminalDrawerOpen && drawerTab === "pty"
                      ? "text-emerald-400 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <TerminalIcon className="h-3.5 w-3.5" />
                  <span>Live PTY Terminal ({primaryNode || "offline"})</span>
                </button>

                <button
                  onClick={() => {
                    setDrawerTab("audit");
                    setTerminalDrawerOpen((v) =>
                      drawerTab === "audit" ? !v : true
                    );
                  }}
                  className={`flex items-center gap-1.5 font-mono text-[11px] transition ${
                    terminalDrawerOpen && drawerTab === "audit"
                      ? "text-cyan-400 font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Audit Log ({auditLogs.length})</span>
                </button>
              </div>

              <div className="flex items-center gap-4 font-mono text-[11px] text-zinc-500">
                {activeHeartbeat && (
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3 w-3 text-emerald-400" />
                    CPU {activeHeartbeat.cpu_percent.toFixed(1)}% · RAM{" "}
                    {activeHeartbeat.ram_percent.toFixed(1)}%
                  </span>
                )}
                <button
                  onClick={() => setTerminalDrawerOpen((v) => !v)}
                  className="flex items-center gap-1 text-zinc-400 hover:text-white"
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
              <div className="h-60 border-t border-white/[0.06] bg-[#060609]">
                {drawerTab === "pty" ? (
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
                    <div className="p-4 font-mono text-xs text-zinc-500">
                      No Axon Muscle Node connected.
                    </div>
                  )
                ) : (
                  <div className="h-full overflow-y-auto divide-y divide-white/[0.04] p-3 font-mono text-xs">
                    {auditLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1.5 px-2"
                      >
                        <div className="flex items-center gap-3 truncate">
                          <span className="text-zinc-500">
                            {log.timestamp.slice(11, 19)}
                          </span>
                          <span className="text-emerald-400">
                            {log.tool_name}
                          </span>
                          <span className="truncate text-zinc-300">
                            {log.summary}
                          </span>
                        </div>
                        <span className="ml-2 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] uppercase text-zinc-300">
                          {log.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: CUSTOM API BASE URL & MODEL CONFIGURATION
      ═══════════════════════════════════════════════════════════════════════ */}
      {aiEndpointModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#0c0c12] p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3.5">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Custom API Base URL &amp; Model Settings
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Connect OpenRouter, vLLM, LiteLLM, Ollama, DeepSeek, or any
                  OpenAI/Anthropic compatible endpoint.
                </p>
              </div>
              <button
                onClick={() => setAiEndpointModalOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAiEndpoint} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">
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
                  className="w-full rounded-xl border border-white/[0.1] bg-zinc-900 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  {Object.entries(PROVIDER_PRESETS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">
                  API Base URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://openrouter.ai/api/v1 or http://10.0.0.5:11434/v1"
                    className="flex-1 rounded-xl border border-white/[0.1] bg-zinc-900 px-3.5 py-2.5 font-mono text-xs text-emerald-300 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSyncModels}
                    disabled={syncingModels}
                    className="flex items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.08]"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        syncingModels ? "animate-spin" : ""
                      }`}
                    />
                    Fetch Models
                  </button>
                </div>
                {modelSyncStatus && (
                  <p className="mt-1.5 font-mono text-[11px] text-cyan-300">
                    {modelSyncStatus}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">
                  Model Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="e.g. gpt-4o, anthropic/claude-3.5-sonnet"
                    className="flex-1 rounded-xl border border-white/[0.1] bg-zinc-900 px-3.5 py-2.5 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                  {discoveredModels.length > 0 && (
                    <select
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      className="max-w-[190px] rounded-xl border border-white/[0.1] bg-zinc-900 px-2.5 py-2.5 font-mono text-xs text-emerald-300"
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
                <label className="block text-zinc-300 font-medium mb-1.5">
                  API Key (Encrypted in Vault `Secrets.enc` as{" "}
                  <code>{apiKeySecretName}</code>)
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={
                    secretKeys.includes(apiKeySecretName)
                      ? "•••••••• (Saved in Secrets.enc — leave blank to keep)"
                      : "sk-..."
                  }
                  className="w-full rounded-xl border border-white/[0.1] bg-zinc-900 px-3.5 py-2.5 font-mono text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setAiEndpointModalOpen(false)}
                  className="rounded-xl border border-white/[0.08] px-4 py-2 text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-medium text-white hover:bg-emerald-500"
                >
                  <Check className="h-3.5 w-3.5" />
                  Save Endpoint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW PROJECT VAULT */}
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
            className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[#0c0c12] p-5 space-y-4"
          >
            <div className="flex items-center justify-between text-sm font-semibold text-white">
              <span>Create New Project Vault</span>
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
              placeholder="Project name (e.g. payment-gateway)"
              className="w-full rounded-xl border border-white/[0.1] bg-zinc-900 px-3.5 py-2 text-xs text-white"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white"
              >
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: CTRL+K / CMD+K COMMAND PALETTE (2026 Developer Studio)
      ═══════════════════════════════════════════════════════════════════════ */}
      {commandPaletteOpen && (
        <div
          onClick={() => setCommandPaletteOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 pt-24 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0c0c13] shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
              <Search className="h-4 w-4 text-emerald-400" />
              <input
                type="text"
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Type a command or search views, endpoints, actions..."
                className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
              />
              <span className="rounded border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                ESC
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {[
                {
                  id: "view-arch",
                  label: "View: System Architecture (Architecture.md)",
                  category: "Brain Stage",
                  run: () => {
                    setMainStageView("brain");
                    setBrainSubTab("architecture");
                  },
                },
                {
                  id: "view-mem",
                  label: "View: Engineering Journal Timeline (Memory.md)",
                  category: "Brain Stage",
                  run: () => {
                    setMainStageView("brain");
                    setBrainSubTab("memory");
                  },
                },
                {
                  id: "view-cart",
                  label: "View: Pluggable Rule Cartridges",
                  category: "Brain Stage",
                  run: () => {
                    setMainStageView("brain");
                    setBrainSubTab("cartridges");
                  },
                },
                {
                  id: "view-code",
                  label: "Stage: Remote Code & Atomic Unified Diff Editor",
                  category: "Workspace",
                  run: () => setMainStageView("workspace"),
                },
                {
                  id: "view-preview",
                  label: "Stage: Live App Preview (Zero-Port-Forwarding Proxy)",
                  category: "Preview",
                  run: () => setMainStageView("preview"),
                },
                {
                  id: "view-infra",
                  label: "Stage: Axon Muscle Nodes & Encrypted Secrets Vault",
                  category: "Infrastructure",
                  run: () => setMainStageView("infrastructure"),
                },
                {
                  id: "cfg-api",
                  label:
                    "Configure Custom API Base URL & Model (OpenRouter / Ollama / vLLM)",
                  category: "AI Settings",
                  run: () => setAiEndpointModalOpen(true),
                },
                {
                  id: "act-deploy",
                  label: "Autonomous Action: Deploy Microservice on Port 4050",
                  category: "Orchestrator",
                  run: () => handleQuickAction("deploy microservice 4050"),
                },
                {
                  id: "act-term",
                  label: "Toggle Bottom Live PTY Terminal Drawer",
                  category: "Terminal",
                  run: () => setTerminalDrawerOpen((v) => !v),
                },
                {
                  id: "act-clear-chat",
                  label: "Compact / Clear Conversation History (Chat.jsonl)",
                  category: "Orchestrator",
                  run: () => handleClearChat(),
                },
                {
                  id: "act-new-proj",
                  label: "Create New Project Vault",
                  category: "Projects",
                  run: () => setNewProjectModal(true),
                },
              ]
                .filter(
                  (item) =>
                    !commandQuery.trim() ||
                    item.label
                      .toLowerCase()
                      .includes(commandQuery.toLowerCase()) ||
                    item.category
                      .toLowerCase()
                      .includes(commandQuery.toLowerCase())
                )
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCommandPaletteOpen(false);
                      item.run();
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-xs text-zinc-200 transition hover:bg-emerald-500/15 hover:text-white"
                  >
                    <span>{item.label}</span>
                    <span className="rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                      {item.category}
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
