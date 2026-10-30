import {
  buildDefaultServiceEndpoints,
  fetchGatewayNodes,
  pushNodeHealthTargets,
} from "@/lib/orchestrator";
import { executeAutonomousSelfHeal } from "@/lib/self-healing";
import { withProjectStateTransaction, type ProjectState } from "@/lib/vault";

const activeWatchdogHeals = new Set<string>();
const lastSyncedTargetsSig = new Map<string, string>();

const CATEGORY_ORDER: Record<string, number> = {
  webui: 1,
  backend: 2,
  database: 3,
};

export async function syncProjectTelemetryAndWatchdog(
  projectId: string
): Promise<{
  state: ProjectState;
  liveNodes: Awaited<ReturnType<typeof fetchGatewayNodes>>;
}> {
  const liveNodes = await fetchGatewayNodes();

  const watchdogTargets: Array<{
    service_id: string;
    name: string;
    node_id: string;
    port: number;
  }> = [];

  const state = await withProjectStateTransaction(projectId, (draft) => {
    for (const live of liveNodes) {
      if (!live.node_id) continue;
      const existsInProject = draft.assigned_nodes.some(
        (a) => a.node_id === live.node_id
      );
      if (!existsInProject) {
        draft.assigned_nodes.push({
          node_id: live.node_id,
          tier: live.tier || "TIER_2_WORKSPACE_JAIL",
          online: Boolean(live.online),
          status: live.online ? "ONLINE" : "OFFLINE",
        });
        draft.planning_only = false;
      }
    }

    for (const tNodeId of Object.keys(draft.telemetry || {})) {
      if (!draft.assigned_nodes.some((a) => a.node_id === tNodeId)) {
        delete draft.telemetry[tNodeId];
      }
    }

    for (const assigned of draft.assigned_nodes) {
      const match = liveNodes.find((n) => n.node_id === assigned.node_id);
      assigned.online = Boolean(match?.online);
      assigned.status = assigned.online ? "ONLINE" : "OFFLINE";
      if (match?.last_heartbeat) {
        const hb = match.last_heartbeat;
        draft.telemetry[assigned.node_id] = hb;
        assigned.hostname = hb.hostname;
        assigned.os_arch = hb.os_arch;
        assigned.os_info = hb.os_info || hb.os_arch;
        assigned.last_seen_unix = hb.timestamp_unix;
        if (typeof hb.active_cores === "number" && hb.active_cores > 0) {
          assigned.active_cores = hb.active_cores;
        }
        if (Array.isArray(hb.connected_cores)) {
          assigned.connected_cores = hb.connected_cores;
        }
        assigned.network = {
          public_ipv4: hb.public_ipv4 || null,
          private_ipv4: hb.private_ipv4 || "127.0.0.1",
        };
        assigned.active_pty_sessions =
          hb.pty_session_details ||
          (hb.active_pty_sessions || []).map((sid) => ({
            session_id: sid,
            cwd: `/opt/axon/workspaces/${projectId}`,
            running_cmd: null,
          }));

        if (Array.isArray(hb.services)) {
          const dismissedSet = new Set<string>(draft.dismissed_services || []);
          draft.registered_services = draft.registered_services.filter(
            (s, i, arr) => {
              if (
                dismissedSet.has(s.service_id) ||
                dismissedSet.has(`port:${s.port}`)
              ) {
                return false;
              }
              if (!s.service_id.startsWith("auto-svc-")) {
                return (
                  arr.findIndex(
                    (o) =>
                      o.node_id === s.node_id &&
                      o.port === s.port &&
                      (o.category || "backend") === (s.category || "backend")
                  ) === i
                );
              }
              return !arr.some(
                (other, oi) =>
                  oi !== i &&
                  other.node_id === s.node_id &&
                  other.port === s.port &&
                  !other.service_id.startsWith("auto-svc-")
              );
            }
          );
          for (const liveSvc of hb.services) {
            if (!liveSvc.service_id || !liveSvc.port) continue;
            if (
              !liveSvc.healthy ||
              dismissedSet.has(liveSvc.service_id) ||
              dismissedSet.has(`port:${liveSvc.port}`)
            ) {
              continue;
            }
            const exists = draft.registered_services.some(
              (s) =>
                s.node_id === assigned.node_id &&
                (s.service_id === liveSvc.service_id || s.port === liveSvc.port)
            );
            if (!exists) {
              draft.registered_services.push({
                service_id: liveSvc.service_id,
                name: liveSvc.name || liveSvc.service_id,
                node_id: assigned.node_id,
                protocol: "http",
                port: liveSvc.port,
                path: "/",
                healthy: Boolean(liveSvc.healthy),
                consecutive_failures: 0,
                registered_at: new Date().toISOString(),
              });
            }
          }

          for (const svc of draft.registered_services) {
            if (svc.node_id !== assigned.node_id) continue;
            const liveSvc = hb.services.find(
              (ls) =>
                ls.service_id === svc.service_id || ls.port === svc.port
            );
            if (liveSvc) {
              svc.healthy = liveSvc.healthy;
              if (liveSvc.healthy) {
                svc.consecutive_failures = 0;
              } else {
                svc.consecutive_failures = (svc.consecutive_failures || 0) + 1;
                const lastHealMs = svc.last_auto_heal_at
                  ? new Date(svc.last_auto_heal_at).getTime()
                  : 0;
                const cooldownPassed = Date.now() - lastHealMs > 10_000;
                if (
                  svc.auto_heal !== false &&
                  draft.ai_settings?.enable_auto_watchdog !== false &&
                  (svc.consecutive_failures || 0) >= 1 &&
                  cooldownPassed
                ) {
                  svc.last_auto_heal_at = new Date().toISOString();
                  svc.consecutive_failures = 0;
                  watchdogTargets.push({
                    service_id: svc.service_id,
                    name: svc.name,
                    node_id: svc.node_id,
                    port: svc.port,
                  });
                }
              }

              svc.health_check = {
                type:
                  svc.health_check?.type ||
                  ((svc.protocol?.toUpperCase() || "HTTP") as
                    | "HTTP"
                    | "TCP"
                    | "EXEC"),
                target:
                  svc.health_check?.target ||
                  `http://127.0.0.1:${svc.port}${svc.path || "/"}`,
                interval_sec: svc.health_check?.interval_sec || 15,
                status: liveSvc.healthy ? "HEALTHY" : "UNHEALTHY",
                last_checked: new Date(hb.timestamp_unix * 1000).toISOString(),
                last_error: liveSvc.last_error,
              };
            }
          }
        }
      }
    }

    for (const svc of draft.registered_services) {
      if (!svc.category) {
        if (
          /db|sqlite|postgres|mysql|redis|mongo|sql/i.test(
            `${svc.service_id} ${svc.name}`
          )
        ) {
          svc.category = "database";
        } else if (
          /web|ui|frontend|dashboard|portal|app/i.test(
            `${svc.service_id} ${svc.name}`
          )
        ) {
          svc.category = "webui";
        } else {
          svc.category = "backend";
        }
      }
      if (!svc.description) {
        svc.description =
          svc.category === "webui"
            ? `Interactive WebUI reachable from outside via Synapse Reverse Proxy (127.0.0.1:${svc.port})`
            : svc.category === "database"
            ? `Interactive Database & Storage Engine on ${svc.node_id} (127.0.0.1:${svc.port})`
            : `Reachable Backend REST API via Synapse Reverse Proxy (127.0.0.1:${svc.port})`;
      }
      if (!Array.isArray(svc.endpoints) || svc.endpoints.length === 0) {
        svc.endpoints = buildDefaultServiceEndpoints(
          projectId,
          svc.service_id,
          svc.name,
          svc.category,
          svc.path || "/",
          svc.db_path
        );
      }
    }

    draft.registered_services.sort((a, b) => {
      const rankA = CATEGORY_ORDER[a.category || "backend"] ?? 50;
      const rankB = CATEGORY_ORDER[b.category || "backend"] ?? 50;
      if (rankA !== rankB) return rankA - rankB;
      return (a.port || 0) - (b.port || 0);
    });
  });

  for (const assigned of state.assigned_nodes) {
    if (!assigned.online) continue;
    const match = liveNodes.find((n) => n.node_id === assigned.node_id);
    const targetSyncKey = `${assigned.node_id}:${match?.connected_at || ""}:${state.registered_services
      .filter((s) => s.node_id === assigned.node_id)
      .map((s) => `${s.service_id}:${s.port}`)
      .join(",")}`;
    if (lastSyncedTargetsSig.get(assigned.node_id) !== targetSyncKey) {
      lastSyncedTargetsSig.set(assigned.node_id, targetSyncKey);
      void pushNodeHealthTargets(state, assigned.node_id).catch(() => {});
    }
  }

  if (watchdogTargets.length > 0) {
    void (async () => {
      for (const target of watchdogTargets) {
        const healKey = `${projectId}:${target.node_id}:${target.port}`;
        if (activeWatchdogHeals.has(healKey)) continue;
        activeWatchdogHeals.add(healKey);
        try {
          await executeAutonomousSelfHeal({
            projectId,
            nodeId: target.node_id,
            serviceId: target.service_id,
            serviceName: target.name,
            port: target.port,
            trigger: "auto_watchdog",
          });
        } catch {
          // ignore background watchdog error
        } finally {
          activeWatchdogHeals.delete(healKey);
        }
      }
    })();
  }

  return { state, liveNodes };
}
