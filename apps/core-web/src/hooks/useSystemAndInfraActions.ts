"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AutonomyTier,
  ChatItem,
  GatewayNode,
  NavSection,
  ProjectState,
} from "@/types/synapse";
import {
  useFirewallAndMcpActions,
  LiveFirewallPortItem,
} from "./useFirewallAndMcpActions";

export type { LiveFirewallPortItem };

export interface SystemUpdateStatusData {
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

interface UseSystemAndInfraActionsParams {
  locale: string;
  activeProject: ProjectState | null;
  activeNav: NavSection;
  settingsTab: string;
  selectedNodeId: string;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string>>;
  gatewayNodes: GatewayNode[];
  joinTier: AutonomyTier;
  setSelectedCartridgeId: React.Dispatch<React.SetStateAction<string>>;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatItem[]>>;
  showToast: (msg: string, durationMs?: number) => void;
  loadWorkspace: (projectId?: string, syncAiSettings?: boolean) => Promise<void>;
}

export function useSystemAndInfraActions({
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
}: UseSystemAndInfraActionsParams) {
  const isDe = locale === "de";

  const [systemUpdateBusy, setSystemUpdateBusy] = useState(false);
  const [systemUpdateActionLabel, setSystemUpdateActionLabel] = useState("");
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [systemUpdateStatus, setSystemUpdateStatus] =
    useState<SystemUpdateStatusData | null>(null);
  const [systemUpdateSteps, setSystemUpdateSteps] = useState<
    Array<{
      step: string;
      status: "ok" | "warn" | "error";
      detail: string;
      duration_ms: number;
    }>
  >([]);

  const [debugModeEnabled, setDebugModeEnabled] = useState(false);
  const [debugSnapshot, setDebugSnapshot] = useState<Record<
    string,
    unknown
  > | null>(null);
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

  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [newSecretKey, setNewSecretKey] = useState("");
  const [newSecretVal, setNewSecretVal] = useState("");

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

  const fwAndMcp = useFirewallAndMcpActions({
    isDe,
    activeProject,
    activeNav,
    selectedNodeId,
    gatewayNodes,
    showToast,
    loadWorkspace,
  });

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
    const keyUpper = newSecretKey.trim().toUpperCase();
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
    showToast(
      isDe
        ? `${keyUpper} im Vault verschlüsselt`
        : `Encrypted ${keyUpper} in Vault`
    );
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
          content: isDe
            ? `Genehmigt & ausgeführt: \`${data.approval.tool_name}\` (${approvalId}).`
            : `Approved & executed \`${data.approval.tool_name}\` (${approvalId}).`,
          toolResults: [data.execution],
        },
      ]);
    }
    await loadWorkspace(activeProject.project_id);
  }

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
        description:
          customCartDesc.trim() || "Custom user-defined policy cartridge",
        content: customCartContent,
      }),
    });
    const data = await res.json();
    if (data.cartridge) {
      setSelectedCartridgeId(data.cartridge.id);
      setShowCustomCartModal(false);
      setCustomCartName("");
      setCustomCartDesc("");
      showToast(
        isDe
          ? `Cartridge erstellt & aktiviert: ${data.cartridge.name}`
          : `Created & enabled Cartridge: ${data.cartridge.name}`
      );
      await loadWorkspace(activeProject.project_id);
    }
  }

  async function handleAddPlaybook(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProject || !playbookName.trim() || !playbookPrompt.trim())
      return;
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
    showToast(
      isDe
        ? "Geplantes KI-Playbook gespeichert"
        : "Scheduled AI Playbook saved"
    );
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
    if (!activeProject || !meshSourceNode.trim() || !meshTargetNode.trim())
      return;
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
    showToast(
      isDe
        ? `Mesh-Link aktiv: ${meshSourceNode.trim()} -> ${meshTargetNode.trim()}:${meshTargetPort}`
        : `Linked ${meshSourceNode.trim()} -> ${meshTargetNode.trim()}:${meshTargetPort}`
    );
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
    const pid = activeProject?.project_id || "default-project";
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
      setDebugModeEnabled(Boolean(cw?.debug_enabled || gw?.debug_enabled));
    } catch {
      // ignore
    }
  }, [activeProject?.project_id]);

  async function handleToggleDebugMode() {
    const pid = activeProject?.project_id || "default-project";
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
    showToast(
      next
        ? isDe
          ? "Debug-Modus AKTIVIERT (Core + Gateway + Muscle Traces)"
          : "Debug Mode ENABLED (Core + Gateway + Muscle traces)"
        : isDe
        ? "Debug-Modus DEAKTIVIERT"
        : "Debug Mode DISABLED"
    );
    await fetchDebugSnapshot();
  }

  async function handleRunSelfTest() {
    const pid = activeProject?.project_id || "default-project";
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

  const fetchSystemUpdateStatus = useCallback(
    async (checkRemote = false, inspectNodes = true) => {
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
    },
    []
  );

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
    const pid = activeProject?.project_id || "default-project";
    setSystemUpdateBusy(true);
    setSystemUpdateActionLabel(
      action === "check"
        ? isDe ? "Prüfe Git & Muscle Versionen..." : "Checking Git & Muscle versions..."
        : action === "update_core"
        ? isDe ? "Aktualisiere Core Plane..." : "Updating Core Plane..."
        : action === "update_muscle"
        ? targetNodeId ? `OTA-Update (${targetNodeId})...` : isDe ? "OTA-Update auf allen Muscle-Knoten..." : "OTA update on all Muscle nodes..."
        : isDe ? "Komplett-Update (Core + Muscle OTA)..." : "Full update (Core + Muscle OTA)..."
    );
    try {
      const res = await fetch("/api/system-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, project_id: pid, node_id: targetNodeId }),
      });
      const data = await res.json();
      if (data.status) setSystemUpdateStatus(data.status);
      if (Array.isArray(data.steps)) setSystemUpdateSteps(data.steps);
      showToast(
        data.success
          ? action === "check"
            ? isDe ? "Versionsprüfung abgeschlossen" : "Version check completed"
            : isDe ? "System-Update erfolgreich durchgeführt!" : "System update completed successfully!"
          : isDe ? "Update mit Hinweisen/Warnungen beendet" : "Update finished with warnings",
        4000
      );
      await loadWorkspace(pid);
    } catch (err) {
      setSystemUpdateSteps([
        {
          step: isDe ? "System-Update Anfrage" : "System Update Request",
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

  return {
    systemUpdateBusy, systemUpdateActionLabel, showReleaseNotes, setShowReleaseNotes,
    systemUpdateStatus, setSystemUpdateStatus, systemUpdateSteps, setSystemUpdateSteps,
    fetchSystemUpdateStatus, handleRunSystemUpdate, debugModeEnabled, debugSnapshot,
    selfTestChecks, runningSelfTest, fetchDebugSnapshot, handleToggleDebugMode, handleRunSelfTest,
    issuedToken, newSecretKey, setNewSecretKey, newSecretVal, setNewSecretVal,
    handleGenerateJoinToken, handleAssignNode, handleUnassignNode, handleToggleCartridge,
    handleAddSecret, handleDeleteSecret, handleResolveApproval, showCustomCartModal, setShowCustomCartModal,
    customCartName, setCustomCartName, customCartCategory, setCustomCartCategory,
    customCartDesc, setCustomCartDesc, customCartContent, setCustomCartContent, handleCreateCustomCartridge,
    playbookName, setPlaybookName, playbookCron, setPlaybookCron, playbookPrompt, setPlaybookPrompt,
    handleAddPlaybook, handleTogglePlaybook, handleDeletePlaybook, meshSourceNode, setMeshSourceNode,
    meshTargetNode, setMeshTargetNode, meshTargetPort, setMeshTargetPort, meshAliasEnv, setMeshAliasEnv,
    handleAddMeshLink, handleRemoveMeshLink, ...fwAndMcp,
  };
}
