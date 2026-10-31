import { resolveTargetNodeId } from "../runtimeResolver";
import {
  deployCustomServiceOnMuscle,
  executeAutonomousSelfHeal,
  executeLiveServiceProbe,
  loadSelfHealingStore,
  probeServiceLinkOnMuscle,
  updateSelfHealingPolicy,
} from "../self-healing";
import type { ProjectState } from "../vault";
import type { ToolDispatchResult } from "../orchestrator";

export async function dispatchResilienceAndMeshTool(
  projectId: string,
  state: ProjectState,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolDispatchResult | null> {
  const nodeId =
    resolveTargetNodeId(state, args.node_id ? String(args.node_id) : undefined) ||
    "local-node";

  if (toolName === "core_manage_self_healing") {
    const action = String(args.action || "inspect");

    if (action === "inspect") {
      const store = loadSelfHealingStore(projectId);
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: true, policy: store.policy, events: store.events.slice(0, 20) },
      };
    }

    if (action === "configure") {
      const updated = updateSelfHealingPolicy(projectId, {
        enabled: args.enabled !== undefined ? Boolean(args.enabled) : undefined,
        max_latency_ms: args.max_latency_ms ? Number(args.max_latency_ms) : undefined,
        failure_threshold: args.failure_threshold ? Number(args.failure_threshold) : undefined,
        cooldown_seconds: args.cooldown_seconds ? Number(args.cooldown_seconds) : undefined,
        capture_forensic_logs:
          args.capture_forensic_logs !== undefined ? Boolean(args.capture_forensic_logs) : undefined,
        notify_watchdog:
          args.notify_watchdog !== undefined ? Boolean(args.notify_watchdog) : undefined,
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: true, policy: updated.policy },
      };
    }

    if (action === "heal_now" || action === "simulate_crash") {
      const port = Number(args.port || 4050);
      const serviceId = String(args.service_id || `svc-${port}`);
      const serviceName = String(args.service_name || serviceId);
      const simulateCrash = action === "simulate_crash" || Boolean(args.simulate_crash);
      const event = await executeAutonomousSelfHeal({
        projectId,
        nodeId,
        serviceId,
        serviceName,
        port,
        containerName: args.container_name ? String(args.container_name) : undefined,
        trigger: simulateCrash ? "crash_simulation" : "quick_restart",
        simulateCrash,
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: true, event, policy: loadSelfHealingStore(projectId).policy },
      };
    }
  }

  if (toolName === "core_probe_service_mesh") {
    const action = String(args.action || "probe_service");

    if (action === "probe_service") {
      const port = Number(args.port || 4050);
      const serviceId = String(args.service_id || `svc-${port}`);
      const res = await executeLiveServiceProbe({ projectId, nodeId, serviceId, port });
      return { tool_name: toolName, status: "executed", output: res };
    }

    if (action === "probe_link") {
      const fromPort = Number(args.from_port || 4090);
      const toPort = Number(args.to_port || 4085);
      const res = await probeServiceLinkOnMuscle({
        projectId,
        nodeId,
        fromServiceId: String(args.from_service_id || `svc-${fromPort}`),
        toServiceId: String(args.to_service_id || `svc-${toPort}`),
        fromPort,
        toPort,
        protocol: String(args.protocol || "HTTP REST"),
      });
      return { tool_name: toolName, status: "executed", output: res };
    }

    if (action === "deploy_custom_service") {
      const port = Number(args.port || 4095);
      if (!Number.isInteger(port) || port < 1024 || port > 65535) {
        return {
          tool_name: toolName,
          status: "error",
          output: { ok: false, error: "Invalid port (must be 1024..65535)" },
        };
      }
      const category =
        args.category === "webui" || args.category === "database" || args.category === "backend"
          ? args.category
          : "backend";
      const runtime =
        args.runtime === "static_webui" ||
        args.runtime === "sqlite_rest" ||
        args.runtime === "python_http"
          ? args.runtime
          : undefined;
      const res = await deployCustomServiceOnMuscle({
        projectId,
        nodeId,
        name: String(args.name || "Custom Microservice").trim(),
        port,
        category,
        runtime,
        description: args.description ? String(args.description) : undefined,
        autoHeal: args.auto_heal !== false,
      });
      return { tool_name: toolName, status: res.ok ? "executed" : "error", output: res };
    }
  }

  return null;
}
