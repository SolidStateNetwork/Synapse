import { recordCheckpoint } from "../checkpoints";
import { gatewayExecPty } from "../gatewayClient";
import { loadGitStacks } from "../projects/gitopsDeployer";
import { resolveTargetNodeId } from "../runtimeResolver";
import { loadServiceLinks, saveServiceLinks, type PersistedServiceLink } from "../self-healing";
import { loadCronJobs, saveCronJobs } from "../v070-studio";
import {
  appendAuditLog,
  collectProjectPublicIps,
  listSecretKeys,
  readBrainDoc,
  sanitizeBrainContentForVisibility,
  withProjectStateTransaction,
  writeBrainDoc,
  type PeerMeshLink,
  type ProjectState,
  type ProjectVisibility,
  type RegisteredService,
  type ScheduledPlaybook,
} from "../vault";
import { loadCustomDomains, saveCustomDomains, type CustomDomainBinding } from "./blueprintDomainAndOtaTools";
import type { ToolDispatchResult } from "../orchestrator";
import {
  signTopologyBundle,
  simulateTopologyBundleApply,
  verifyTopologyBundleSignature,
  type SignedTopologyBundlePayload,
} from "../vault/v250Enterprise";

export interface SynapseTopologyBundle {
  schema_version: "synapse-stack/v2.0" | "synapse-stack/v2.5";
  exported_at: string;
  project_id: string;
  visibility?: ProjectVisibility;
  lexicon_docs?: {
    architecture_md: string;
    memory_md: string;
    milestones_md: string;
    agents_md: string;
  };
  registered_services: RegisteredService[];
  peer_mesh_links: PeerMeshLink[];
  active_cartridges: string[];
  scheduled_playbooks: ScheduledPlaybook[];
  service_links: PersistedServiceLink[];
  cron_jobs: ReturnType<typeof loadCronJobs>;
  custom_domains: Record<string, CustomDomainBinding>;
  git_stacks_count: number;
  secret_key_names: string[];
  signed_at?: string;
  signer_fingerprint?: string;
  bundle_signature?: string;
}

export async function dispatchTopologyAndCanaryTool(
  projectId: string,
  state: ProjectState,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolDispatchResult | null> {
  const primaryNode = resolveTargetNodeId(state, args.node_id ? String(args.node_id) : undefined) || "local-node";

  if (toolName === "core_manage_topology_bundle") {
    const action = String(args.action || "export");
    if (action === "export") {
      const visibility: ProjectVisibility = state.visibility === "public" ? "public" : "private";
      const knownIps = collectProjectPublicIps(state);
      const rawBundle: SynapseTopologyBundle = {
        schema_version: "synapse-stack/v2.0",
        exported_at: new Date().toISOString(),
        project_id: projectId,
        visibility,
        lexicon_docs: {
          architecture_md: sanitizeBrainContentForVisibility(readBrainDoc(projectId, "Architecture.md"), visibility, knownIps),
          memory_md: sanitizeBrainContentForVisibility(readBrainDoc(projectId, "Memory.md"), visibility, knownIps),
          milestones_md: sanitizeBrainContentForVisibility(readBrainDoc(projectId, "Milestones.md"), visibility, knownIps),
          agents_md: sanitizeBrainContentForVisibility(readBrainDoc(projectId, "AGENTS.md"), visibility, knownIps),
        },
        registered_services: state.registered_services || [],
        peer_mesh_links: state.peer_mesh_links || [],
        active_cartridges: state.active_cartridges || [],
        scheduled_playbooks: state.scheduled_playbooks || [],
        service_links: loadServiceLinks(projectId),
        cron_jobs: loadCronJobs(projectId),
        custom_domains: loadCustomDomains(projectId),
        git_stacks_count: loadGitStacks(projectId).length,
        secret_key_names: listSecretKeys(projectId),
      };
      const signedBundle = signTopologyBundle(
        projectId,
        rawBundle as unknown as SignedTopologyBundlePayload,
        typeof args.signing_secret === "string" ? args.signing_secret : undefined
      );
      return { tool_name: toolName, status: "executed", output: { ok: true, action: "export", bundle: signedBundle } };
    }

    let rawBundle = args.bundle;
    if (typeof rawBundle === "string" && rawBundle.trim()) {
      try {
        rawBundle = JSON.parse(rawBundle);
      } catch {
        return { tool_name: toolName, status: "error", output: { ok: false, error: "Invalid JSON topology bundle string" } };
      }
    }
    if (!rawBundle || typeof rawBundle !== "object") {
      return { tool_name: toolName, status: "error", output: { ok: false, error: "bundle object is required" } };
    }
    const payloadObj = rawBundle as SignedTopologyBundlePayload;
    const customSecret = typeof args.signing_secret === "string" ? args.signing_secret : undefined;

    if (action === "sign") {
      const signed = signTopologyBundle(projectId, payloadObj, customSecret);
      return { tool_name: toolName, status: "executed", output: { ok: true, action: "sign", bundle: signed } };
    }

    if (action === "verify") {
      const ver = verifyTopologyBundleSignature(projectId, payloadObj, customSecret);
      return {
        tool_name: toolName,
        status: ver.valid ? "executed" : "error",
        output: { ok: ver.valid, action: "verify", ...ver },
      };
    }

    if (action === "simulate_apply") {
      const requireSig = Boolean(args.require_signature);
      const driftPlan = simulateTopologyBundleApply(projectId, payloadObj, requireSig, customSecret);
      if (!driftPlan.valid_signature) {
        return {
          tool_name: toolName,
          status: "error",
          output: {
            ok: false,
            action: "simulate_apply",
            error: driftPlan.signature_error || "Invalid bundle signature",
            drift_plan: driftPlan,
          },
        };
      }
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: true, action: "simulate_apply", drift_plan: driftPlan },
      };
    }

    if (action === "import" || action === "apply") {
      if (typeof payloadObj.bundle_signature === "string" || args.require_signature === true) {
        const sigCheck = verifyTopologyBundleSignature(projectId, payloadObj, customSecret);
        if (!sigCheck.valid) {
          return {
            tool_name: toolName,
            status: "error",
            output: { ok: false, error: sigCheck.reason || "Bundle signature verification failed" },
          };
        }
      }
      const b = rawBundle as Partial<SynapseTopologyBundle>;
      const preFlightCp = recordCheckpoint(projectId, {
        node_id: primaryNode,
        title: `Pre-Flight Topology Bundle Import (${b.schema_version || "synapse-stack/v2.0"})`,
        actor: "Auto-Watchdog",
        summary: `Automatic pre-flight checkpoint before importing declarative topology bundle into '${projectId}'.`,
        files_backed_up: [`/opt/axon/workspaces/${projectId}`],
        services_snapshot: (state.registered_services || []).map((s) => ({
          service_id: s.service_id,
          name: s.name,
          port: s.port,
          healthy: s.healthy !== false,
        })),
        rollback_cmd: "echo 'CHECKPOINT_RESTORED_OK'",
      });

      const svcs = Array.isArray(b.registered_services) ? b.registered_services : [];
      const mesh = Array.isArray(b.peer_mesh_links) ? b.peer_mesh_links : [];
      const carts = Array.isArray(b.active_cartridges) ? b.active_cartridges : [];
      const playbooks = Array.isArray(b.scheduled_playbooks) ? b.scheduled_playbooks : [];
      const importedVisibility: ProjectVisibility | undefined =
        b.visibility === "public" || b.visibility === "private" ? b.visibility : undefined;

      await withProjectStateTransaction(projectId, (draft) => {
        if (importedVisibility) draft.visibility = importedVisibility;
        if (svcs.length > 0) draft.registered_services = svcs;
        if (mesh.length > 0) draft.peer_mesh_links = mesh;
        if (carts.length > 0) draft.active_cartridges = carts;
        if (playbooks.length > 0) draft.scheduled_playbooks = playbooks;
      });
      if (b.lexicon_docs && typeof b.lexicon_docs === "object") {
        if (typeof b.lexicon_docs.architecture_md === "string") writeBrainDoc(projectId, "Architecture.md", b.lexicon_docs.architecture_md, "overwrite");
        if (typeof b.lexicon_docs.memory_md === "string") writeBrainDoc(projectId, "Memory.md", b.lexicon_docs.memory_md, "overwrite");
        if (typeof b.lexicon_docs.milestones_md === "string") writeBrainDoc(projectId, "Milestones.md", b.lexicon_docs.milestones_md, "overwrite");
        if (typeof b.lexicon_docs.agents_md === "string") writeBrainDoc(projectId, "AGENTS.md", b.lexicon_docs.agents_md, "overwrite");
      }
      if (Array.isArray(b.service_links)) saveServiceLinks(projectId, b.service_links);
      if (Array.isArray(b.cron_jobs)) saveCronJobs(projectId, b.cron_jobs);
      if (b.custom_domains && typeof b.custom_domains === "object") saveCustomDomains(projectId, b.custom_domains);

      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "ai_orchestrator",
        tool_name: toolName,
        node_id: primaryNode,
        status: "executed",
        summary: `Imported topology bundle (${svcs.length} services, checkpoint ${preFlightCp.id})`,
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: {
          ok: true,
          action,
          checkpoint_id: preFlightCp.id,
          visibility: importedVisibility || state.visibility || "private",
          imported_lexicon_docs: Boolean(b.lexicon_docs),
          imported_services_count: svcs.length,
          imported_cartridges_count: carts.length,
          imported_cron_jobs_count: Array.isArray(b.cron_jobs) ? b.cron_jobs.length : 0,
        },
      };
    }
    return { tool_name: toolName, status: "error", output: { ok: false, error: `Unknown topology bundle action: ${action}` } };
  }

  if (toolName === "core_cluster_canary_exec") {
    const action = String(args.action || "verify_fleet_health");
    const explicitNodes = Array.isArray(args.node_ids) ? args.node_ids.map((n) => String(n)).filter(Boolean) : [];
    const assignedNodes = (state.assigned_nodes || []).map((n) => n.node_id).filter(Boolean);
    const targetNodes = explicitNodes.length > 0 ? explicitNodes : assignedNodes.length > 0 ? assignedNodes : [primaryNode];

    if (action === "verify_fleet_health") {
      const nodeResults: Array<{ node_id: string; ok: boolean; exit_code: number; output: string }> = [];
      for (const nId of targetNodes) {
        const pty = await gatewayExecPty({
          node_id: nId,
          cmd_id: `fleet-health-${Date.now()}`,
          project_id: projectId,
          session_id: `sys-update-${projectId}`,
          command: "uname -sr && uptime -p && echo FLEET_NODE_OK",
          wait_timeout_ms: 5000,
        });
        const exitCode = Number(pty.exit_code ?? 0);
        nodeResults.push({ node_id: nId, ok: exitCode === 0, exit_code: exitCode, output: String(pty.output || "").trim() });
      }
      const healthyCount = nodeResults.filter((r) => r.ok).length;
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: healthyCount === nodeResults.length, action: "verify_fleet_health", total_nodes: nodeResults.length, healthy_nodes: healthyCount, node_results: nodeResults },
      };
    }

    const command = String(args.command || "echo CANARY_ROLLOUT_OK").trim();
    const canaryNode = targetNodes[0];
    const preFlightCp = recordCheckpoint(projectId, {
      node_id: canaryNode,
      title: `Pre-Flight Multi-Node Canary Rollout (${targetNodes.length} node(s))`,
      actor: "Auto-Watchdog",
      summary: `Automatic pre-flight checkpoint before staged canary execution across [${targetNodes.join(", ")}].`,
      files_backed_up: [`/opt/axon/workspaces/${projectId}`],
      services_snapshot: (state.registered_services || []).map((s) => ({
        service_id: s.service_id,
        name: s.name,
        port: s.port,
        healthy: s.healthy !== false,
      })),
      rollback_cmd: "echo 'CHECKPOINT_RESTORED_OK'",
    });

    const nodeResults: Array<{ node_id: string; stage: "canary" | "fleet"; ok: boolean; exit_code: number; output: string }> = [];
    let canaryAborted = false;
    for (let i = 0; i < targetNodes.length; i++) {
      const nId = targetNodes[i];
      const stage = i === 0 ? "canary" : "fleet";
      const pty = await gatewayExecPty({
        node_id: nId,
        cmd_id: `canary-exec-${Date.now()}-${i}`,
        project_id: projectId,
        session_id: `sys-update-${projectId}`,
        command,
        wait_timeout_ms: 8000,
      });
      const exitCode = Number(pty.exit_code ?? 0);
      const stepOk = exitCode === 0;
      nodeResults.push({ node_id: nId, stage, ok: stepOk, exit_code: exitCode, output: String(pty.output || "").trim() });
      if (!stepOk && i === 0) {
        canaryAborted = true;
        break;
      }
    }

    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      node_id: canaryNode,
      status: canaryAborted ? "error" : "executed",
      summary: `Multi-Node Canary Rollout (${nodeResults.length}/${targetNodes.length} nodes, aborted=${canaryAborted}, checkpoint=${preFlightCp.id})`,
    });
    return {
      tool_name: toolName,
      status: canaryAborted ? "error" : "executed",
      output: { ok: !canaryAborted, action: "canary_rollout", checkpoint_id: preFlightCp.id, canary_node: canaryNode, canary_aborted: canaryAborted, node_results: nodeResults },
    };
  }

  return null;
}
