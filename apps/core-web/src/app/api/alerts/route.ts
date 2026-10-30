import { NextRequest, NextResponse } from "next/server";
import {
  dispatchAlertEvent,
  loadAlertConfig,
  saveAlertConfig,
} from "@/lib/alerts";
import { ensureProjectVault } from "@/lib/vault";
import {
  resolveActiveProjectId,
  resolveTargetNodeId,
  safeParseRequestJson,
} from "@/lib/runtimeResolver";

const GATEWAY_URL = process.env.CORE_GATEWAY_URL || "http://127.0.0.1:8081";

export async function GET(req: NextRequest) {
  const projectId = resolveActiveProjectId(
    req.nextUrl.searchParams.get("project_id")
  );
  const config = loadAlertConfig(projectId);
  return NextResponse.json({ config });
}

export async function POST(req: NextRequest) {
  try {
    const body = await safeParseRequestJson(req);
    const projectId = resolveActiveProjectId(
      String(body.project_id || body.projectId || "")
    );
    const action = String(body.action || "");
    const cfg = loadAlertConfig(projectId);

    if (action === "configure") {
      if (body.enabled !== undefined) cfg.enabled = Boolean(body.enabled);
      if (body.telegram_enabled !== undefined)
        cfg.telegram_enabled = Boolean(body.telegram_enabled);
      if (body.telegram_bot_token !== undefined)
        cfg.telegram_bot_token = String(body.telegram_bot_token).trim();
      if (body.telegram_chat_id !== undefined)
        cfg.telegram_chat_id = String(body.telegram_chat_id).trim();
      if (body.discord_enabled !== undefined)
        cfg.discord_enabled = Boolean(body.discord_enabled);
      if (body.discord_webhook_url !== undefined)
        cfg.discord_webhook_url = String(body.discord_webhook_url).trim();
      if (body.webhook_enabled !== undefined)
        cfg.webhook_enabled = Boolean(body.webhook_enabled);
      if (body.webhook_url !== undefined)
        cfg.webhook_url = String(body.webhook_url).trim();
      if (body.cpu_threshold !== undefined)
        cfg.cpu_threshold = Number(body.cpu_threshold) || 85;
      if (body.ram_threshold !== undefined)
        cfg.ram_threshold = Number(body.ram_threshold) || 85;
      if (body.disk_threshold !== undefined)
        cfg.disk_threshold = Number(body.disk_threshold) || 85;
      if (body.alert_on_service_down !== undefined)
        cfg.alert_on_service_down = Boolean(body.alert_on_service_down);
      if (body.alert_on_peer_offline !== undefined)
        cfg.alert_on_peer_offline = Boolean(body.alert_on_peer_offline);
      if (body.auto_heal_services !== undefined)
        cfg.auto_heal_services = Boolean(body.auto_heal_services);

      saveAlertConfig(projectId, cfg);
      return NextResponse.json({ ok: true, config: cfg });
    }

    if (action === "test_alert") {
      const state = ensureProjectVault(projectId);
      const targetNode =
        resolveTargetNodeId(state, String(body.node_id || "")) || "local-node";
      const evt = await dispatchAlertEvent(projectId, {
        severity: "INFO",
        title: "Test Push Notification",
        message:
          String(body.message || "") ||
          "24/7 Proactive Watchdog verified from Synapse Control Center.",
        node_id: targetNode,
      });
      return NextResponse.json({
        ok: true,
        event: evt,
        config: loadAlertConfig(projectId),
      });
    }

    if (action === "evaluate") {
      const triggered: unknown[] = [];
      try {
        const res = await fetch(`${GATEWAY_URL}/api/v1/nodes`, {
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const data = await res.json();
          const nodes = Array.isArray(data.nodes) ? data.nodes : [];
          for (const n of nodes) {
            const hb = n.last_heartbeat;
            if (!hb) continue;
            if (hb.cpu_percent >= cfg.cpu_threshold) {
              triggered.push(
                await dispatchAlertEvent(projectId, {
                  severity: "WARNING",
                  title: `High CPU Usage on ${n.node_id} (${hb.cpu_percent.toFixed(1)}%)`,
                  message: `CPU exceeded threshold of ${cfg.cpu_threshold}%.`,
                  node_id: n.node_id,
                })
              );
            }
            if (hb.ram_percent >= cfg.ram_threshold) {
              triggered.push(
                await dispatchAlertEvent(projectId, {
                  severity: "WARNING",
                  title: `High RAM Usage on ${n.node_id} (${hb.ram_percent.toFixed(1)}%)`,
                  message: `Memory exceeded threshold of ${cfg.ram_threshold}%.`,
                  node_id: n.node_id,
                })
              );
            }
            if (hb.disk_percent >= cfg.disk_threshold) {
              triggered.push(
                await dispatchAlertEvent(projectId, {
                  severity: "CRITICAL",
                  title: `Disk Space Critical on ${n.node_id} (${hb.disk_percent.toFixed(1)}%)`,
                  message: `Root disk exceeded threshold of ${cfg.disk_threshold}%.`,
                  node_id: n.node_id,
                })
              );
            }
            if (cfg.alert_on_service_down && Array.isArray(hb.services)) {
              for (const svc of hb.services) {
                if (!svc.healthy) {
                  triggered.push(
                    await dispatchAlertEvent(projectId, {
                      severity: "CRITICAL",
                      title: `Service Down: ${svc.name} (:${svc.port})`,
                      message: `Service ${svc.service_id} on ${n.node_id} failed health check (${svc.last_error || "unhealthy"}).`,
                      node_id: n.node_id,
                      service_id: svc.service_id,
                      auto_healed: cfg.auto_heal_services,
                    })
                  );
                }
              }
            }
          }
        }
      } catch {
        // ignore
      }
      return NextResponse.json({
        ok: true,
        triggered_count: triggered.length,
        triggered,
        config: loadAlertConfig(projectId),
      });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown alert action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Alerts API error",
      },
      { status: 500 }
    );
  }
}
