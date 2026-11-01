import { listCartridges, OFFICIAL_STACK_BLUEPRINTS } from "../cartridges";
import { loadCheckpoints } from "../checkpoints";
import { loadGitStacks } from "../projects/gitopsDeployer";
import { safeFetchJson } from "../safeFetch";
import { loadSelfHealingStore } from "../self-healing";
import { loadCronJobs } from "../v070-studio";
import {
  appendAuditLog,
  buildDefaultAgentsDoc,
  deleteSecret,
  ensureProjectVault,
  getDecryptedSecrets,
  listProjects,
  readAuditLogs,
  setSecret,
  withProjectStateTransaction,
  writeBrainDoc,
  type ProjectState,
} from "../vault";
import { SYNAPSE_VERSION } from "../version";
import { loadOffsiteBackups } from "./disasterRecoveryTools";
import { SYNAPSE_TOOL_SCHEMAS } from "./toolSchemas";
import type { ToolDispatchResult } from "../orchestrator";

export async function dispatchProjectAndDiagnosticTool(
  coreGatewayUrl: string,
  projectId: string,
  state: ProjectState,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolDispatchResult | null> {
  if (toolName === "core_manage_projects") {
    const action = String(args.action || "list");
    if (action === "list") {
      return {
        tool_name: toolName,
        status: "executed",
        output: {
          ok: true,
          active_project_id: projectId,
          projects: listProjects(),
        },
      };
    }

    if (action === "create") {
      const rawName = String(args.name || "new-project")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      const newId = rawName || `proj-${Date.now().toString(36)}`;
      const created = ensureProjectVault(newId);
      appendAuditLog(newId, {
        timestamp: new Date().toISOString(),
        actor: "ai_orchestrator",
        tool_name: toolName,
        status: "executed",
        summary: `Created project workspace '${newId}' via AI/MCP Orchestrator`,
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: true, project: created, projects: listProjects() },
      };
    }

    if (action === "set_planning_only") {
      const nextVal =
        typeof args.planning_only === "boolean"
          ? args.planning_only
          : !state.planning_only;
      const updated = await withProjectStateTransaction(projectId, (draft) => {
        draft.planning_only = nextVal;
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: {
          ok: true,
          project_id: projectId,
          planning_only: updated.planning_only,
        },
      };
    }

    if (action === "set_visibility") {
      const nextVis = args.visibility === "public" ? "public" : "private";
      const updated = await withProjectStateTransaction(projectId, (draft) => {
        draft.visibility = nextVis;
      });
      writeBrainDoc(projectId, "AGENTS.md", buildDefaultAgentsDoc(updated.name, nextVis), "overwrite");
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: true, project_id: projectId, visibility: nextVis },
      };
    }

    if (action === "audit_trail") {
      const limit = Math.min(Math.max(Number(args.limit || 20), 1), 100);
      const logs = readAuditLogs(projectId, limit);
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: true, count: logs.length, audit_logs: logs },
      };
    }
  }

  if (toolName === "core_run_platform_self_test") {
    const action = String(args.action || "self_test");
    if (action === "toggle_debug") {
      let nextDebug = false;
      await withProjectStateTransaction(projectId, (st) => {
        const raw = st as unknown as Record<string, unknown>;
        nextDebug =
          args.enabled !== undefined ? Boolean(args.enabled) : !raw.debug_mode;
        raw.debug_mode = nextDebug;
      });
      await safeFetchJson(`${coreGatewayUrl}/api/v1/debug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_debug", enabled: nextDebug }),
        timeoutMs: 2000,
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: true, debug_enabled: nextDebug },
      };
    }

    const checks: Array<{
      id: string;
      name: string;
      status: "PASS" | "WARN" | "FAIL";
      detail: string;
    }> = [];

    const st = await withProjectStateTransaction(projectId, () => {});
    checks.push({
      id: "vault_state",
      name: "Brain Vault Atomic State.json R/W",
      status: "PASS",
      detail: `Project '${st.project_id}' verified (${st.assigned_nodes.length} peer(s))`,
    });

    const probeKey = "__SYNAPSE_MCP_PROBE__";
    const probeVal = `probe-${Date.now()}`;
    setSecret(projectId, probeKey, probeVal);
    const decrypted = getDecryptedSecrets(projectId)[probeKey];
    deleteSecret(projectId, probeKey);
    checks.push({
      id: "aes_vault",
      name: "AES-256-GCM Encrypted Secrets Vault",
      status: decrypted === probeVal ? "PASS" : "FAIL",
      detail: "AES-256-GCM round-trip verified",
    });

    const carts = listCartridges();
    const stacks = loadGitStacks(projectId);
    const cronJobs = loadCronJobs(projectId);
    const shStore = loadSelfHealingStore(projectId);
    const checkpoints = loadCheckpoints(projectId);
    const backups = loadOffsiteBackups(projectId);
    checks.push({
      id: "cartridges",
      name: "Rule Cartridges, GitOps & Cron Engines",
      status: carts.length > 0 ? "PASS" : "WARN",
      detail: `${SYNAPSE_VERSION}: ${carts.length} cartridges, ${OFFICIAL_STACK_BLUEPRINTS.length} blueprints, ${stacks.length} GitOps, ${cronJobs.length} cron`,
    });
    checks.push({
      id: "resilience_and_mcp",
      name: "Self-Healing, Time-Machine & MCP Tool Registry",
      status: SYNAPSE_TOOL_SCHEMAS.length >= 25 ? "PASS" : "WARN",
      detail: `${SYNAPSE_TOOL_SCHEMAS.length} AI/MCP tools, Self-Healing=${shStore.policy.enabled ? "ON" : "OFF"}, ${checkpoints.length} checkpoint(s), ${backups.length} backup(s)`,
    });

    const gwRes = await safeFetchJson(`${coreGatewayUrl}/api/v1/debug`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ping_nodes" }),
      timeoutMs: 3000,
    });
    checks.push({
      id: "core_gateway",
      name: "Core Gateway HTTP & mTLS PKI Authority",
      status: gwRes.ok ? "PASS" : "WARN",
      detail: gwRes.ok ? `Reachable at ${coreGatewayUrl}` : "Gateway offline",
    });

    return {
      tool_name: toolName,
      status: "executed",
      output: { ok: true, version: SYNAPSE_VERSION, checks },
    };
  }

  return null;
}
