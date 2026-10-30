"use client";

import React, { useCallback, useEffect, useState } from "react";
import { safeFetchJson } from "@/lib/safeFetch";
import { GatewayNode, NavSection, ProjectState } from "@/types/synapse";

export interface LiveFirewallPortItem {
  port: number;
  protocol: "tcp" | "udp";
  bind_address: string;
  exposure: "public" | "local";
  process: string;
  pid?: number;
  service_name?: string;
  shielded: boolean;
  system_protected?: boolean;
}

export function useFirewallAndMcpActions({
  isDe,
  activeProject,
  activeNav,
  selectedNodeId,
  gatewayNodes,
  showToast,
  loadWorkspace,
}: {
  isDe: boolean;
  activeProject: ProjectState | null;
  activeNav: NavSection;
  selectedNodeId: string;
  gatewayNodes: GatewayNode[];
  showToast: (msg: string, durationMs?: number) => void;
  loadWorkspace: (projectId?: string, syncAiSettings?: boolean) => Promise<void>;
}) {
  const [mcpKeyName, setMcpKeyName] = useState("External AI Agent (MCP)");
  const [mcpKeyScopeMode, setMcpKeyScopeMode] = useState<
    "read-exec" | "read-only"
  >("read-exec");
  const [issuedMcpToken, setIssuedMcpToken] = useState<string | null>(null);
  const [copiedMcpToken, setCopiedMcpToken] = useState(false);
  const [showMcpConfigExamples, setShowMcpConfigExamples] = useState(false);
  const [copiedMcpConfig, setCopiedMcpConfig] = useState<
    "json" | "curl" | null
  >(null);
  const [mcpTestOutput, setMcpTestOutput] = useState<string>("");

  const [firewallBusy, setFirewallBusy] = useState(false);
  const [firewallError, setFirewallError] = useState("");
  const [fwIpInput, setFwIpInput] = useState("");
  const [fwRuleAction, setFwRuleAction] = useState<"block" | "allow">("block");
  const [fwRulePort, setFwRulePort] = useState("");
  const [fwRuleNote, setFwRuleNote] = useState("");
  const [liveFirewallPorts, setLiveFirewallPorts] = useState<
    LiveFirewallPortItem[]
  >([]);

  async function handleCreateMcpKey(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProject) return;
    const scopes =
      mcpKeyScopeMode === "read-only" ? ["read"] : ["read", "execute", "admin"];
    const res = await safeFetchJson("/api/mcp", {
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
      showToast(
        isDe
          ? "Externer KI / MCP API-Token generiert"
          : "Generated External AI / MCP API Token"
      );
      await loadWorkspace(activeProject.project_id);
    }
  }

  async function handleRevokeMcpKey(keyId: string) {
    if (!activeProject) return;
    await safeFetchJson("/api/mcp", {
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

  async function handleTestMcpEndpoint(
    method: "tools/list" | "resources/list" | "call_state"
  ) {
    const pid = activeProject?.project_id || "default-project";
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

    const res = await safeFetchJson("/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setMcpTestOutput(JSON.stringify(data, null, 2));
  }

  const fetchFirewallStatus = useCallback(
    async (targetNode?: string) => {
      const pid = activeProject?.project_id || "default-project";
      const nid =
        targetNode ||
        selectedNodeId ||
        activeProject?.assigned_nodes?.[0]?.node_id ||
        gatewayNodes[0]?.node_id ||
        "local-node";
      setFirewallBusy(true);
      setFirewallError("");
      try {
        const res = await safeFetchJson(
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
    const pid = activeProject?.project_id || "default-project";
    const nid =
      payload.node_id ||
      selectedNodeId ||
      activeProject?.assigned_nodes?.[0]?.node_id ||
      gatewayNodes[0]?.node_id ||
      "local-node";
    setFirewallBusy(true);
    setFirewallError("");
    try {
      const res = await safeFetchJson("/api/firewall", {
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
        setFirewallError(
          data.error ||
            (isDe ? "Firewall-Aktion fehlgeschlagen" : "Firewall action failed")
        );
      } else {
        if (Array.isArray(data.ports)) {
          setLiveFirewallPorts(data.ports);
        }
        if (data.message) {
          showToast(data.message, 3500);
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

  return {
    mcpKeyName,
    setMcpKeyName,
    mcpKeyScopeMode,
    setMcpKeyScopeMode,
    issuedMcpToken,
    copiedMcpToken,
    setCopiedMcpToken,
    showMcpConfigExamples,
    setShowMcpConfigExamples,
    copiedMcpConfig,
    setCopiedMcpConfig,
    mcpTestOutput,
    handleCreateMcpKey,
    handleRevokeMcpKey,
    handleTestMcpEndpoint,
    firewallBusy,
    firewallError,
    setFirewallError,
    fwIpInput,
    setFwIpInput,
    fwRuleAction,
    setFwRuleAction,
    fwRulePort,
    setFwRulePort,
    fwRuleNote,
    setFwRuleNote,
    liveFirewallPorts,
    fetchFirewallStatus,
    handleFirewallAction,
    handleAddFirewallIpRule,
  };
}
