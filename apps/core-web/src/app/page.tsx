"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  Database,
  FileCode2,
  FolderGit2,
  Globe,
  HardDrive,
  KeyRound,
  Lock,
  Play,
  Plus,
  RefreshCw,
  Send,
  Server,
  ShieldAlert,
  ShieldCheck,
  Terminal as TerminalIcon,
  XCircle,
} from "lucide-react";
import type { AutonomyTier, NodeHeartbeat } from "@proto/tunnel";
import MermaidTopologyView from "@/components/MermaidTopologyView";
import RemoteWorkspaceExplorer from "@/components/RemoteWorkspaceExplorer";

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

export default function SynapseDashboard() {
  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectState | null>(null);
  const [architectureMd, setArchitectureMd] = useState("");
  const [memoryMd, setMemoryMd] = useState("");
  const [secretKeys, setSecretKeys] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [cartridges, setCartridges] = useState<CartridgeMeta[]>([]);
  const [gatewayNodes, setGatewayNodes] = useState<GatewayNode[]>([]);
  const [gatewayUrl, setGatewayUrl] = useState("http://127.0.0.1:8081");

  const [activeTab, setActiveTab] = useState<
    | "orchestrator"
    | "vault"
    | "explorer"
    | "terminal"
    | "preview"
    | "nodes"
    | "audit"
  >("orchestrator");

  // AI Orchestrator chat state
  const [provider, setProvider] = useState("synapse-autonomous");
  const [modelName, setModelName] = useState("gpt-4o");
  const [apiKey, setApiKey] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([
    {
      role: "assistant",
      content:
        "Welcome to **Synapse Control Plane (The Brain)**. Select or assign an **Axon Muscle Node** to unlock remote PTY & Atomic FS tools, or operate in **Planning-Only Mode** to architect your system and manage encrypted secrets.",
    },
  ]);

  // Enrollment & Secret forms
  const [joinTier, setJoinTier] = useState<AutonomyTier>(
    "TIER_2_WORKSPACE_JAIL"
  );
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [manualNodeId, setManualNodeId] = useState("");
  const [newSecretKey, setNewSecretKey] = useState("");
  const [newSecretVal, setNewSecretVal] = useState("");
  const [newProjName, setNewProjName] = useState("");

  // Live Preview selection
  const [previewPort, setPreviewPort] = useState<number>(3000);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");

  const loadDashboard = useCallback(async (projectId?: string) => {
    const pid = projectId || "synapse-cloud-demo";
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

      const firstNode =
        data.active_project?.assigned_nodes?.[0]?.node_id ||
        data.gateway_nodes?.[0]?.node_id ||
        "";
      setSelectedNodeId((prev) => prev || firstNode);
    } catch {
      // ignore transient network errors
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(() => {
      loadDashboard(activeProject?.project_id);
    }, 5000);
    return () => clearInterval(interval);
  }, [loadDashboard, activeProject?.project_id]);

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
          model: modelName,
          api_key: apiKey,
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
      await loadDashboard(activeProject.project_id);
    } finally {
      setChatBusy(false);
    }
  }

  async function handleQuickTool(
    toolName: string,
    args: Record<string, unknown>
  ) {
    if (!activeProject) return;
    setChatBusy(true);
    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: activeProject.project_id,
          direct_tool: { name: toolName, arguments: args },
        }),
      });
      const data = await res.json();
      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          toolResults: data.tool_results,
        },
      ]);
      await loadDashboard(activeProject.project_id);
    } finally {
      setChatBusy(false);
    }
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
    if (data.token) {
      setIssuedToken(data.token);
    }
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
    await loadDashboard(activeProject.project_id);
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
    await loadDashboard(activeProject.project_id);
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
    await loadDashboard(activeProject.project_id);
  }

  async function handleSaveBrainDoc(
    document: "Architecture.md" | "Memory.md",
    content: string
  ) {
    if (!activeProject) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_doc",
        project_id: activeProject.project_id,
        document,
        content,
      }),
    });
    await loadDashboard(activeProject.project_id);
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
    await loadDashboard(activeProject.project_id);
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
    await loadDashboard(activeProject.project_id);
  }

  async function handleCreateProject(e: React.FormEvent) {
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
    if (data.project?.project_id) {
      await loadDashboard(data.project.project_id);
    }
  }

  const pendingApprovals = (activeProject?.pending_approvals || []).filter(
    (a) => a.status === "pending"
  );

  const primaryNode =
    selectedNodeId ||
    activeProject?.assigned_nodes?.[0]?.node_id ||
    gatewayNodes[0]?.node_id ||
    "";

  return (
    <div className="flex min-h-screen flex-col bg-[#090a0f] text-slate-100">
      {/* Top Control Plane Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 bg-[#0c0e17]/90 px-6 py-3.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white">
                SYNAPSE
              </span>
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-mono font-medium text-emerald-400 border border-emerald-500/30">
                BRAIN &amp; MUSCLE v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Stateless Control Plane &amp; mTLS/Yamux Remote Execution Nodes
            </p>
          </div>
        </div>

        {/* Project Switcher & Mode Indicator */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={activeProject?.project_id || ""}
            onChange={(e) => loadDashboard(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>
                Vault: {p.name} ({p.project_id})
              </option>
            ))}
          </select>

          {activeProject?.planning_only ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300">
              <Lock className="h-3.5 w-3.5" />
              <span>Planning-Only Mode (0 Nodes Assigned)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>
                Execution Unlocked ({activeProject?.assigned_nodes.length}{" "}
                Node(s))
              </span>
            </div>
          )}

          <button
            onClick={() => loadDashboard(activeProject?.project_id)}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/70 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            title="Refresh Telemetry & Vault"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Left Sidebar: Telemetry, Cartridges & Navigation */}
        <aside className="w-full border-b border-slate-800/80 bg-[#0b0d14] p-4 lg:w-80 lg:border-b-0 lg:border-r flex flex-col gap-5">
          {/* Navigation Tabs */}
          <nav className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
            {[
              {
                id: "orchestrator",
                label: "AI Orchestrator & Chat",
                icon: Bot,
              },
              {
                id: "vault",
                label: "Project Brain Vault",
                icon: FolderGit2,
              },
              {
                id: "explorer",
                label: "Remote Workspace FS",
                icon: FileCode2,
              },
              {
                id: "terminal",
                label: "Live PTY (xterm.js)",
                icon: TerminalIcon,
              },
              {
                id: "preview",
                label: "Live-Preview Proxy",
                icon: Globe,
              },
              {
                id: "nodes",
                label: "Axon Nodes & PKI",
                icon: Server,
              },
              {
                id: "audit",
                label: `Audit Log (${auditLogs.length})`,
                icon: ShieldAlert,
              },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as typeof activeTab)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                    active
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Assigned Muscle Nodes & 5s Hardware Telemetry */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-emerald-400" />
                Muscle Telemetry (5s)
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {gatewayNodes.length} live
              </span>
            </div>

            {activeProject?.assigned_nodes.length === 0 ? (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs text-amber-300/90">
                No Axon nodes assigned to this project. Project is locked in{" "}
                <strong>Planning-Only Mode</strong>.
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeProject?.assigned_nodes.map((n) => {
                  const hb =
                    activeProject.telemetry?.[n.node_id] ||
                    gatewayNodes.find((gn) => gn.node_id === n.node_id)
                      ?.last_heartbeat;
                  return (
                    <div
                      key={n.node_id}
                      className="rounded-lg border border-slate-800 bg-[#090b10] p-2.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-slate-200 flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              n.online ? "bg-emerald-400" : "bg-slate-500"
                            }`}
                          />
                          {n.node_id}
                        </span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400">
                          {n.tier.replace("TIER_", "T")}
                        </span>
                      </div>
                      {hb ? (
                        <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                          <div className="flex justify-between">
                            <span>CPU:</span>
                            <span className="font-mono text-slate-200">
                              {hb.cpu_percent.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>RAM:</span>
                            <span className="font-mono text-slate-200">
                              {hb.ram_percent.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Disk (/):</span>
                            <span className="font-mono text-slate-200">
                              {hb.disk_percent.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-slate-400">
                          Awaiting 5s gopsutil heartbeat...
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pluggable Rule Cartridges (/cartridges/*.md) */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileCode2 className="h-3.5 w-3.5 text-cyan-400" />
                Rule Cartridges
              </span>
              <span className="text-[11px] text-slate-400">
                /cartridges/*.md
              </span>
            </div>
            <div className="space-y-1.5">
              {cartridges.map((c) => {
                const enabled =
                  activeProject?.active_cartridges.includes(c.id) ?? false;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleToggleCartridge(c.id)}
                    className={`w-full text-left rounded-lg border p-2 text-xs transition ${
                      enabled
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                        : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span className="font-mono">{c.id}.md</span>
                      <span className="text-[10px] uppercase">
                        {enabled ? "ACTIVE" : "OFF"}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[11px] opacity-80">
                      {c.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Primary Workspace Pane */}
        <section className="flex-1 p-6 overflow-y-auto">
          {/* TIER_3_SUPERVISED Pending Approvals Banner */}
          {pendingApprovals.length > 0 && (
            <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <div className="flex items-center gap-2 text-amber-300 font-semibold text-sm mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  TIER_3_SUPERVISED Interceptor — {pendingApprovals.length} Tool
                  Call(s) Awaiting Approval
                </span>
              </div>
              <div className="space-y-2">
                {pendingApprovals.map((appr) => (
                  <div
                    key={appr.approval_id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-[#0b0d14] p-3 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-amber-300">
                        [{appr.approval_id}] {appr.tool_name}
                      </span>{" "}
                      on node{" "}
                      <span className="font-mono text-emerald-400">
                        {appr.node_id}
                      </span>
                      <pre className="mt-1 max-w-2xl overflow-x-auto rounded bg-slate-900 p-2 font-mono text-[11px] text-slate-300">
                        {JSON.stringify(appr.arguments, null, 2)}
                      </pre>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleResolveApproval(appr.approval_id, "approve")
                        }
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-500"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve &amp; Execute
                      </button>
                      <button
                        onClick={() =>
                          handleResolveApproval(appr.approval_id, "reject")
                        }
                        className="flex items-center gap-1 rounded-lg bg-rose-600/80 px-3 py-1.5 font-medium text-white hover:bg-rose-600"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 1: AI ORCHESTRATOR & POLICY INTERCEPTOR */}
          {activeTab === "orchestrator" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2 flex flex-col rounded-xl border border-slate-800 bg-[#0c0e17] overflow-hidden">
                {/* Provider Config Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/60 px-4 py-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-300">
                      AI Engine:
                    </span>
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
                    >
                      <option value="synapse-autonomous">
                        Synapse Autonomous (Built-in Deterministic)
                      </option>
                      <option value="openai">OpenAI Compatible</option>
                      <option value="anthropic">Anthropic Claude</option>
                      <option value="ollama">Ollama Local LLM</option>
                    </select>
                    <input
                      type="text"
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      placeholder="Model (e.g. gpt-4o, llama3.1)"
                      className="w-36 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
                    />
                    {(provider === "openai" || provider === "anthropic") && (
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="API Key (optional if set in env)"
                        className="w-44 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
                      />
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">
                    5 Schemas Active
                  </span>
                </div>

                {/* Chat Transcript */}
                <div className="flex-1 space-y-4 p-4 max-h-[500px] overflow-y-auto">
                  {chatHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className={`rounded-xl p-3.5 text-sm ${
                        item.role === "user"
                          ? "ml-8 bg-emerald-500/10 border border-emerald-500/30 text-slate-100"
                          : "mr-8 bg-slate-900/90 border border-slate-800 text-slate-200"
                      }`}
                    >
                      <div className="mb-1 text-[11px] font-mono uppercase text-slate-400">
                        {item.role === "user"
                          ? "Operator"
                          : "Synapse Brain Orchestrator"}
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed text-xs">
                        {item.content}
                      </div>
                      {item.toolResults && item.toolResults.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {item.toolResults.map((tr, tIdx) => (
                            <div
                              key={tIdx}
                              className="rounded-lg border border-slate-700/80 bg-[#07090e] p-2.5 font-mono text-[11px]"
                            >
                              <div className="flex items-center justify-between text-emerald-400 mb-1">
                                <span>Tool: {tr.tool_name}</span>
                                <span className="uppercase">{tr.status}</span>
                              </div>
                              <pre className="overflow-x-auto text-slate-300 max-h-48">
                                {JSON.stringify(tr.output, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Chat Input */}
                <form
                  onSubmit={handleSendMessage}
                  className="flex items-center gap-2 border-t border-slate-800 bg-slate-900/40 p-3"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={
                      activeProject?.planning_only
                        ? "Planning-Only Mode: Ask to update Architecture.md or test '$ uname -a' lock..."
                        : "Enter instruction or '$ <shell_command>' to execute via Sentinel PTY..."
                    }
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={chatBusy}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{chatBusy ? "Running..." : "Send"}</span>
                  </button>
                </form>
              </div>

              {/* Direct Tool Dispatcher & Guardrail Verification Panel */}
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-800 bg-[#0c0e17] p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-3">
                    AI Tool Schema Quick-Dispatch
                  </h3>
                  <p className="text-xs text-slate-400 mb-3">
                    Directly invoke the 5 Synapse AI tools through the Core
                    Policy Interceptor:
                  </p>
                  <div className="space-y-2">
                    <button
                      onClick={() =>
                        handleQuickTool("core_update_brain_doc", {
                          document: "Memory.md",
                          mode: "append",
                          content: `- **[${new Date().toISOString()}]** Verified Brain & Muscle mTLS Yamux state.`,
                        })
                      }
                      className="w-full flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs hover:border-emerald-500/40"
                    >
                      <span className="font-mono text-cyan-300">
                        core_update_brain_doc
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Append Memory.md
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        handleQuickTool("core_register_service", {
                          service_id: "web-preview-3000",
                          name: "App Server :3000",
                          node_id: primaryNode || "node-local",
                          protocol: "http",
                          port: 3000,
                          path: "/",
                        })
                      }
                      className="w-full flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs hover:border-emerald-500/40"
                    >
                      <span className="font-mono text-cyan-300">
                        core_register_service
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Port 3000
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        handleQuickTool("node_pty_exec", {
                          node_id: primaryNode,
                          command: "uname -a && pwd && id",
                          wait_timeout_ms: 10000,
                        })
                      }
                      className="w-full flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs hover:border-emerald-500/40"
                    >
                      <span className="font-mono text-emerald-300">
                        node_pty_exec
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Sentinel PTY Probe
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        handleQuickTool("node_pty_exec", {
                          node_id: primaryNode,
                          command: "sudo systemctl stop axon.service",
                          wait_timeout_ms: 5000,
                        })
                      }
                      className="w-full flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs hover:border-rose-500/50"
                    >
                      <span className="font-mono text-rose-300">
                        node_pty_exec (Guardrail Test)
                      </span>
                      <span className="text-[11px] text-rose-300">
                        Self-Lockout Block
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        handleQuickTool("node_fs_operation", {
                          node_id: primaryNode,
                          operation: "list_dir",
                          path: ".",
                        })
                      }
                      className="w-full flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs hover:border-emerald-500/40"
                    >
                      <span className="font-mono text-emerald-300">
                        node_fs_operation
                      </span>
                      <span className="text-[11px] text-slate-400">
                        list_dir (.)
                      </span>
                    </button>

                    <button
                      onClick={async () => {
                        if (!activeProject) return;
                        const prompt = "deploy microservice 4050";
                        const nextHistory: ChatItem[] = [
                          ...chatHistory,
                          { role: "user", content: prompt },
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
                              content: data.reply,
                              toolResults: data.tool_results,
                            },
                          ]);
                          await loadDashboard(activeProject.project_id);
                        } finally {
                          setChatBusy(false);
                        }
                      }}
                      className="w-full flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs hover:bg-emerald-500/25"
                    >
                      <span className="font-mono font-semibold text-emerald-300">
                        Multi-Step Autonomous Loop
                      </span>
                      <span className="text-[11px] text-emerald-200">
                        FS + PTY + Service + Vault
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROJECT BRAIN VAULT */}
          {activeTab === "vault" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Project Brain Vault —{" "}
                    <span className="font-mono text-emerald-400">
                      /var/lib/synapse/projects/{activeProject?.project_id}/
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    The Core holds zero developer runtimes. All project state is
                    persisted in 5 deterministic Vault artifacts.
                  </p>
                </div>
                <form
                  onSubmit={handleCreateProject}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={newProjName}
                    onChange={(e) => setNewProjName(e.target.value)}
                    placeholder="New project ID..."
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100"
                  />
                  <button
                    type="submit"
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    New Vault
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Architecture.md */}
                <div className="rounded-xl border border-slate-800 bg-[#0c0e17] p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-semibold text-emerald-400">
                      1. Architecture.md (Mermaid Topology &amp; Remote Layout)
                    </span>
                    <button
                      onClick={() =>
                        handleSaveBrainDoc("Architecture.md", architectureMd)
                      }
                      className="rounded bg-emerald-600/20 border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-600/30"
                    >
                      Save Architecture.md
                    </button>
                  </div>
                  <textarea
                    value={architectureMd}
                    onChange={(e) => setArchitectureMd(e.target.value)}
                    rows={12}
                    className="w-full flex-1 rounded-lg border border-slate-800 bg-[#07090e] p-3 font-mono text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Memory.md */}
                <div className="rounded-xl border border-slate-800 bg-[#0c0e17] p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-semibold text-cyan-400">
                      2. Memory.md (Chronological Engineering Journal)
                    </span>
                    <button
                      onClick={() => handleSaveBrainDoc("Memory.md", memoryMd)}
                      className="rounded bg-cyan-600/20 border border-cyan-500/40 px-2.5 py-1 text-xs text-cyan-300 hover:bg-cyan-600/30"
                    >
                      Save Memory.md
                    </button>
                  </div>
                  <textarea
                    value={memoryMd}
                    onChange={(e) => setMemoryMd(e.target.value)}
                    rows={12}
                    className="w-full flex-1 rounded-lg border border-slate-800 bg-[#07090e] p-3 font-mono text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Visual Mermaid Topology Graph */}
              <MermaidTopologyView markdown={architectureMd} />

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Secrets.enc (AES-256-GCM) */}
                <div className="rounded-xl border border-slate-800 bg-[#0c0e17] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                      <KeyRound className="h-4 w-4" />
                      3. Secrets.enc (AES-256-GCM Encrypted Vault)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Auto-redacted as [REDACTED_SECRET:KEY]
                    </span>
                  </div>

                  <form
                    onSubmit={handleAddSecret}
                    className="flex flex-wrap gap-2 mb-3"
                  >
                    <input
                      type="text"
                      value={newSecretKey}
                      onChange={(e) => setNewSecretKey(e.target.value)}
                      placeholder="SECRET_KEY (e.g. DB_PASSWORD)"
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-200"
                    />
                    <input
                      type="password"
                      value={newSecretVal}
                      onChange={(e) => setNewSecretVal(e.target.value)}
                      placeholder="Secret value..."
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-200"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
                    >
                      Encrypt &amp; Store
                    </button>
                  </form>

                  <div className="space-y-1.5">
                    {secretKeys.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        No secrets stored yet.
                      </p>
                    ) : (
                      secretKeys.map((k) => (
                        <div
                          key={k}
                          className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#07090e] px-3 py-2 text-xs font-mono"
                        >
                          <span className="text-amber-300">{k}</span>
                          <span className="text-slate-400">
                            [AES-256-GCM ENCRYPTED]
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* State.json Snapshot */}
                <div className="rounded-xl border border-slate-800 bg-[#0c0e17] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                      <Database className="h-4 w-4" />
                      4. State.json (Single Source of Truth)
                    </span>
                  </div>
                  <pre className="max-h-60 overflow-auto rounded-lg border border-slate-800 bg-[#07090e] p-3 font-mono text-[11px] text-slate-300">
                    {JSON.stringify(activeProject, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2.5: REMOTE WORKSPACE ATOMIC FILESYSTEM EXPLORER */}
          {activeTab === "explorer" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Remote Node Workspace Explorer (`STREAM_TYPE_RPC_FS`)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Inspect, atomically write, or patch files with Unified Diffs
                    directly on the remote Axon Muscle Node (`/opt/axon/workspaces/
                    {activeProject?.project_id}`).
                  </p>
                </div>
              </div>
              <RemoteWorkspaceExplorer
                projectId={activeProject?.project_id || "synapse-cloud-demo"}
                nodeId={primaryNode}
                onAuditRefresh={() => loadDashboard(activeProject?.project_id)}
              />
            </div>
          )}

          {/* TAB 3: LIVE STATEFUL PTY TERMINAL (xterm.js) */}
          {activeTab === "terminal" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Persistent Stateful PTY Session (`creack/pty` + `xterm.js`)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Mirrors the real-time shell byte-stream over Yamux{" "}
                    <code className="text-emerald-400">STREAM_TYPE_PTY</code>{" "}
                    and preserves CWD &amp; environment variables across AI tool
                    calls.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Target Node:</span>
                  <select
                    value={primaryNode}
                    onChange={(e) => setSelectedNodeId(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-slate-200"
                  >
                    <option value="">-- Select Node --</option>
                    {gatewayNodes.map((n) => (
                      <option key={n.node_id} value={n.node_id}>
                        {n.node_id} ({n.tier})
                      </option>
                    ))}
                    {activeProject?.assigned_nodes.map((n) => (
                      <option key={`assigned-${n.node_id}`} value={n.node_id}>
                        {n.node_id} (assigned)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!primaryNode ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-200">
                  No Axon Muscle Node is currently selected or connected. Enroll
                  a node in the <strong>Axon Nodes &amp; PKI</strong> tab to
                  open a live PTY stream.
                </div>
              ) : (
                <XTermTerminal
                  gatewayUrl={gatewayUrl}
                  projectId={activeProject?.project_id || "synapse-cloud-demo"}
                  nodeId={primaryNode}
                  sessionId={`default-${
                    activeProject?.project_id || "synapse-cloud-demo"
                  }`}
                />
              )}
            </div>
          )}

          {/* TAB 4: LIVE-PREVIEW TCP/HTTP REVERSE PROXY */}
          {activeTab === "preview" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Live TCP/HTTP Port-Forwarding Reverse Proxy
                  </h2>
                  <p className="text-xs text-slate-400">
                    Tunnels{" "}
                    <code className="text-emerald-400">
                      127.0.0.1:&lt;port&gt;
                    </code>{" "}
                    from the remote Axon Muscle Node directly into this
                    authenticated WebUI iframe via{" "}
                    <code className="text-cyan-400">
                      /preview/{activeProject?.project_id}/
                      {primaryNode || "<node_id>"}/{previewPort}
                    </code>
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="number"
                    value={previewPort}
                    onChange={(e) =>
                      setPreviewPort(Number(e.target.value) || 3000)
                    }
                    className="w-24 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-slate-200"
                  />
                  <a
                    href={`${gatewayUrl}/preview/${
                      activeProject?.project_id || "synapse-cloud-demo"
                    }/${primaryNode || "node-local"}/${previewPort}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-500"
                  >
                    Open in New Tab
                  </a>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#07090e]">
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/70 px-4 py-2 text-xs font-mono text-slate-300">
                  <span>
                    GET {gatewayUrl}/preview/
                    {activeProject?.project_id || "synapse-cloud-demo"}/
                    {primaryNode || "unassigned"}/{previewPort}/
                  </span>
                  <span className="text-emerald-400">
                    STREAM_TYPE_PORT_FORWARD
                  </span>
                </div>
                <iframe
                  title="Synapse Live Preview"
                  src={`${gatewayUrl}/preview/${
                    activeProject?.project_id || "synapse-cloud-demo"
                  }/${primaryNode || "unassigned"}/${previewPort}/`}
                  className="h-[520px] w-full bg-white"
                />
              </div>
            </div>
          )}

          {/* TAB 5: AXON NODES & ONE-TIME CSR BOOTSTRAPPING */}
          {activeTab === "nodes" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-[#0c0e17] p-5 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  1. Enroll New Axon Muscle Node (mTLS CSR Bootstrap)
                </h3>
                <p className="text-xs text-slate-400">
                  Generate a one-time join token. When you run{" "}
                  <code className="text-emerald-400">
                    axon join &lt;token&gt;
                  </code>{" "}
                  on a remote Linux server, the agent generates an ECDSA P-256
                  keypair, submits an X.509 CSR, and establishes an outbound{" "}
                  <code className="text-cyan-400">hashicorp/yamux</code> reverse
                  tunnel.
                </p>

                <div className="space-y-3">
                  <label className="block text-xs font-medium text-slate-300">
                    Node Autonomy Tier
                  </label>
                  <select
                    value={joinTier}
                    onChange={(e) =>
                      setJoinTier(e.target.value as AutonomyTier)
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="TIER_1_UNLEASHED">
                      TIER_1_UNLEASHED — Full Root/Sudo Server Provisioning
                    </option>
                    <option value="TIER_2_WORKSPACE_JAIL">
                      TIER_2_WORKSPACE_JAIL — Path-Jailed to
                      /opt/axon/workspaces/&lt;project_id&gt;
                    </option>
                    <option value="TIER_3_SUPERVISED">
                      TIER_3_SUPERVISED — Read Immediate; Write/Exec Requires
                      WebUI Approval
                    </option>
                  </select>

                  <button
                    onClick={handleGenerateJoinToken}
                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    <KeyRound className="h-4 w-4" />
                    Generate One-Time CSR Join Token
                  </button>
                </div>

                {issuedToken && (
                  <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs space-y-2.5">
                    <div className="font-semibold text-emerald-300">
                      Option A — Zero-Dependency One-Liner (Downloads binary + systemd):
                    </div>
                    <pre className="overflow-x-auto rounded bg-[#07090e] p-2.5 font-mono text-[11px] text-emerald-400">
                      {`curl -fsSL ${gatewayUrl}/install.sh | sh -s -- ${issuedToken} ${joinTier}`}
                    </pre>
                    <div className="font-semibold text-cyan-300">
                      Option B — Direct CLI Enrollment:
                    </div>
                    <pre className="overflow-x-auto rounded bg-[#07090e] p-2.5 font-mono text-[11px] text-cyan-400">
                      {`axon join --core ${gatewayUrl} --tier ${joinTier} --run ${issuedToken}`}
                    </pre>
                  </div>
                )}

                <div className="border-t border-slate-800 pt-4">
                  <h4 className="text-xs font-semibold text-slate-300 mb-2">
                    Assign Node to Project{" "}
                    <span className="text-emerald-400">
                      {activeProject?.project_id}
                    </span>
                  </h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualNodeId}
                      onChange={(e) => setManualNodeId(e.target.value)}
                      placeholder="Node ID (e.g. node-prod-01)"
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-200"
                    />
                    <button
                      onClick={() => handleAssignNode(manualNodeId, joinTier)}
                      className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                    >
                      Assign to Project
                    </button>
                  </div>
                </div>
              </div>

              {/* Connected Nodes on Core Gateway */}
              <div className="rounded-xl border border-slate-800 bg-[#0c0e17] p-5 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-cyan-400" />
                  2. Connected mTLS + Yamux Nodes ({gatewayNodes.length})
                </h3>

                {gatewayNodes.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No active Axon reverse tunnels currently connected to{" "}
                    <code>{gatewayUrl}</code>.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {gatewayNodes.map((gn) => {
                      const isAssigned = activeProject?.assigned_nodes.some(
                        (an) => an.node_id === gn.node_id
                      );
                      return (
                        <div
                          key={gn.node_id}
                          className="rounded-lg border border-slate-800 bg-[#07090e] p-3.5 text-xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-mono font-bold text-emerald-400">
                                {gn.node_id}
                              </span>
                              <span className="ml-2 text-slate-400">
                                ({gn.remote_addr})
                              </span>
                            </div>
                            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                              {gn.tier}
                            </span>
                          </div>
                          {gn.last_heartbeat && (
                            <div className="grid grid-cols-3 gap-2 rounded bg-slate-900/70 p-2 font-mono text-[11px]">
                              <div>
                                CPU: {gn.last_heartbeat.cpu_percent.toFixed(1)}%
                              </div>
                              <div>
                                RAM: {gn.last_heartbeat.ram_percent.toFixed(1)}%
                              </div>
                              <div>
                                Disk:{" "}
                                {gn.last_heartbeat.disk_percent.toFixed(1)}%
                              </div>
                            </div>
                          )}
                          <div className="flex justify-end">
                            {isAssigned ? (
                              <button
                                onClick={() => handleUnassignNode(gn.node_id)}
                                className="rounded border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-300"
                              >
                                Unassign from Project
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  handleAssignNode(gn.node_id, gn.tier)
                                }
                                className="flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white"
                              >
                                <Play className="h-3 w-3" />
                                Assign to {activeProject?.project_id}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: IMMUTABLE APPEND-ONLY AUDIT LOG (Audit.jsonl) */}
          {activeTab === "audit" && (
            <div className="rounded-xl border border-slate-800 bg-[#0c0e17] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    5. Immutable Append-Only Audit Log (`Audit.jsonl`)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Every AI tool call, Policy Interceptor block, and user
                    approval is recorded in{" "}
                    <code className="text-emerald-400">
                      /var/lib/synapse/projects/{activeProject?.project_id}
                      /Audit.jsonl
                    </code>
                    .
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {auditLogs.map((log, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-[#07090e] p-3 text-xs font-mono"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{log.timestamp}</span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-cyan-300">
                          {log.actor}
                        </span>
                        <span className="font-bold text-emerald-400">
                          {log.tool_name}
                        </span>
                        {log.node_id && (
                          <span className="text-amber-300">@{log.node_id}</span>
                        )}
                      </div>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] uppercase ${
                          log.status === "executed" || log.status === "approved"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : log.status === "paused_tier3"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-rose-500/15 text-rose-300"
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <div className="text-slate-300">{log.summary}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
