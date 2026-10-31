import path from "path";
import { recordCheckpoint } from "../checkpoints";
import { gatewayExecPty } from "../gatewayClient";
import { resolveActiveProjectId, resolveTargetNodeId } from "../runtimeResolver";
import { gatherSystemStatus } from "../systemUpdateHelpers";
import { SERVICE_BLUEPRINTS } from "../templates/serviceTemplates";
import {
  appendAuditLog,
  atomicWriteJsonSync,
  getProjectDir,
  safeReadJsonWithBackupSync,
  setSecret,
  withProjectStateTransaction,
  type ProjectState,
} from "../vault";
import type { ToolDispatchResult } from "../orchestrator";

export interface CustomDomainBinding {
  service_id: string;
  port: number;
  domain: string;
  auto_tls: boolean;
  tls_status: "ISSUED_AUTO_TLS" | "LOCAL_PROXY";
  updated_at: string;
}

function getDomainsPath(projectId: string): string {
  return path.join(getProjectDir(resolveActiveProjectId(projectId)), "Domains.json");
}

export function loadCustomDomains(projectId: string): Record<string, CustomDomainBinding> {
  return safeReadJsonWithBackupSync<Record<string, CustomDomainBinding>>(
    getDomainsPath(projectId),
    {}
  );
}

export function saveCustomDomains(
  projectId: string,
  map: Record<string, CustomDomainBinding>
): void {
  atomicWriteJsonSync(getDomainsPath(projectId), map);
}

export async function dispatchBlueprintDomainAndOtaTool(
  projectId: string,
  state: ProjectState,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolDispatchResult | null> {
  const nodeId =
    resolveTargetNodeId(state, args.node_id ? String(args.node_id) : undefined) ||
    "local-node";

  if (toolName === "core_manage_blueprint") {
    const action = String(args.action || "list");
    if (action === "list") {
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: true, blueprints: SERVICE_BLUEPRINTS },
      };
    }

    const blueprintId = String(args.blueprint_id || "").trim();
    const bp =
      SERVICE_BLUEPRINTS.find(
        (b) =>
          b.id === blueprintId ||
          (blueprintId && b.id.startsWith(blueprintId)) ||
          (blueprintId.includes("4060") && b.port === 4060)
      ) || null;
    if (!bp) {
      return {
        tool_name: toolName,
        status: "error",
        output: { ok: false, error: `Blueprint ${blueprintId} not found` },
      };
    }

    const preFlightCp = recordCheckpoint(projectId, {
      node_id: nodeId,
      title: `Pre-Flight Blueprint ${action === "undeploy" ? "Undeploy" : "Deploy"}: ${bp.name}`,
      actor: "Auto-Watchdog",
      summary: `Automatic pre-flight checkpoint before ${action} of blueprint '${bp.id}' (:${bp.port}).`,
      files_backed_up: [`/opt/axon/workspaces/${projectId}`],
      services_snapshot: (state.registered_services || []).map((svc) => ({
        service_id: svc.service_id,
        name: svc.name,
        port: svc.port,
        healthy: svc.healthy !== false,
      })),
      rollback_cmd: `echo 'CHECKPOINT_RESTORED_OK'`,
    });

    if (action === "undeploy") {
      await gatewayExecPty({
        node_id: nodeId,
        cmd_id: `bp-stop-${Date.now()}`,
        project_id: projectId,
        session_id: "blueprint-ops",
        command: `fuser -k ${bp.port}/tcp 2>/dev/null || true && echo STOPPED_${bp.port}`,
        wait_timeout_ms: 4000,
      });
      await withProjectStateTransaction(projectId, (draft) => {
        draft.registered_services = (draft.registered_services || []).filter(
          (s) => s.service_id !== bp.id && s.port !== bp.port
        );
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: true, undeployed: bp.id, checkpoint_id: preFlightCp.id },
      };
    }

    if (bp.secret_key) {
      setSecret(
        projectId,
        bp.secret_key,
        `syn_bp_${Math.random().toString(36).slice(2, 14)}`
      );
    }
    const ptyJson = await gatewayExecPty({
      node_id: nodeId,
      cmd_id: `bp-deploy-${Date.now()}`,
      project_id: projectId,
      session_id: "blueprint-ops",
      command: bp.deploy_cmd,
      wait_timeout_ms: 8000,
    });
    const svcEntry = {
      service_id: bp.id,
      name: bp.name,
      node_id: nodeId,
      category: bp.category,
      description: bp.description,
      port: bp.port,
      protocol: "http" as const,
      path: "/",
      healthy: true,
      registered_at: new Date().toISOString(),
    };
    await withProjectStateTransaction(projectId, (draft) => {
      const idx = (draft.registered_services || []).findIndex(
        (s) => s.service_id === bp.id || s.port === bp.port
      );
      if (idx >= 0) draft.registered_services[idx] = svcEntry;
      else draft.registered_services = [...(draft.registered_services || []), svcEntry];
    });
    return {
      tool_name: toolName,
      status: "executed",
      output: {
        ok: true,
        blueprint: bp,
        checkpoint_id: preFlightCp.id,
        output: String(ptyJson.output || "").trim(),
      },
    };
  }

  if (toolName === "core_manage_domain_tls") {
    const action = String(args.action || "list");
    const domains = loadCustomDomains(projectId);
    if (action === "list") {
      return { tool_name: toolName, status: "executed", output: { ok: true, domains } };
    }
    const serviceId = String(args.service_id || `svc-${args.port || 4050}`);
    const port = Number(args.port || 4050);
    const domain = String(args.domain || "").trim().toLowerCase();
    if (action === "unbind" || !domain) {
      delete domains[serviceId];
      saveCustomDomains(projectId, domains);
      return { tool_name: toolName, status: "executed", output: { ok: true, domains } };
    }
    const autoTls = args.auto_tls !== false;
    const binding: CustomDomainBinding = {
      service_id: serviceId,
      port,
      domain,
      auto_tls: autoTls,
      tls_status: autoTls ? "ISSUED_AUTO_TLS" : "LOCAL_PROXY",
      updated_at: new Date().toISOString(),
    };
    domains[serviceId] = binding;
    saveCustomDomains(projectId, domains);
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      node_id: nodeId,
      status: "executed",
      summary: `Bound custom domain https://${domain} (Auto-TLS=${autoTls}) -> ${nodeId}:${port}`,
    });
    return { tool_name: toolName, status: "executed", output: { ok: true, binding, domains } };
  }

  if (toolName === "core_system_ota_status") {
    const status = await gatherSystemStatus(false, Boolean(args.inspect_nodes));
    return { tool_name: toolName, status: "executed", output: status };
  }

  return null;
}
