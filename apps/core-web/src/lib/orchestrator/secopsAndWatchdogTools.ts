import { dispatchAlertEvent, loadAlertConfig, saveAlertConfig, type AlertEvent } from "../alerts";
import { resolveKnownNodeIps, resolveTargetNodeId } from "../runtimeResolver";
import { safeFetchJson } from "../safeFetch";
import { appendAuditLog, withProjectStateTransaction, type ProjectState } from "../vault";
import { fetchGatewayNodes, type ToolDispatchResult } from "../orchestrator";

export async function evaluateNodeWatchdogAlerts(
  projectId: string,
  liveNodesInput?: Awaited<ReturnType<typeof fetchGatewayNodes>>
): Promise<{ triggered_count: number; triggered: AlertEvent[] }> {
  const cfg = loadAlertConfig(projectId);
  const triggered: AlertEvent[] = [];
  if (!cfg.enabled) {
    return { triggered_count: 0, triggered };
  }
  const nodes = liveNodesInput || (await fetchGatewayNodes());
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
  return { triggered_count: triggered.length, triggered };
}

export async function dispatchSecopsAndWatchdogTool(
  coreGatewayUrl: string,
  projectId: string,
  state: ProjectState,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolDispatchResult | null> {
  if (toolName === "core_manage_alerts") {
    const action = String(args.action || "inspect");
    const cfg = loadAlertConfig(projectId);

    if (action === "inspect") {
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: true, config: cfg, events_count: cfg.events.length },
      };
    }

    if (action === "configure") {
      if (args.enabled !== undefined) cfg.enabled = Boolean(args.enabled);
      if (args.cpu_threshold !== undefined) cfg.cpu_threshold = Number(args.cpu_threshold) || 85;
      if (args.ram_threshold !== undefined) cfg.ram_threshold = Number(args.ram_threshold) || 85;
      if (args.disk_threshold !== undefined) cfg.disk_threshold = Number(args.disk_threshold) || 85;
      if (args.alert_on_service_down !== undefined) cfg.alert_on_service_down = Boolean(args.alert_on_service_down);
      if (args.auto_heal_services !== undefined) cfg.auto_heal_services = Boolean(args.auto_heal_services);
      if (args.webhook_enabled !== undefined) cfg.webhook_enabled = Boolean(args.webhook_enabled);
      if (args.webhook_url !== undefined) cfg.webhook_url = String(args.webhook_url).trim();
      saveAlertConfig(projectId, cfg);
      return { tool_name: toolName, status: "executed", output: { ok: true, config: cfg } };
    }

    if (action === "test_alert") {
      const nodeId = resolveTargetNodeId(state, args.node_id ? String(args.node_id) : undefined) || "local-node";
      const evt = await dispatchAlertEvent(projectId, {
        severity: "INFO",
        title: String(args.title || "AI Watchdog Test Notification"),
        message: String(args.message || "24/7 Proactive Watchdog verified by Synapse AI Orchestrator."),
        node_id: nodeId,
      });
      return { tool_name: toolName, status: "executed", output: { ok: true, event: evt } };
    }

    if (action === "evaluate") {
      const res = await evaluateNodeWatchdogAlerts(projectId);
      return { tool_name: toolName, status: "executed", output: { ok: true, ...res, config: loadAlertConfig(projectId) } };
    }
  }

  if (toolName === "core_intrusion_scan") {
    const action = String(args.action || "scan");
    const nodeId = resolveTargetNodeId(state, args.node_id ? String(args.node_id) : undefined) || "local-node";

    if (action === "block_ip") {
      const attackerIp = String(args.ip || "").trim();
      if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(attackerIp)) {
        return { tool_name: toolName, status: "error", output: { ok: false, error: "Invalid IPv4 address" } };
      }
      let blockedIps: string[] = [];
      await withProjectStateTransaction(projectId, (draft) => {
        if (!draft.firewall_policies) draft.firewall_policies = {};
        const pol = draft.firewall_policies[nodeId] || {
          node_id: nodeId,
          profile: "web_standard",
          anti_lockout_active: true,
          rollback_guard_seconds: 60,
          ssh_port: 22,
          shielded_ports: [],
          ip_rules: [],
          last_synced_at: new Date().toISOString(),
        };
        if (!pol.ip_rules.some((r) => r.ip_or_cidr === attackerIp)) {
          pol.ip_rules.push({
            rule_id: `intrusion-block-${Date.now()}`,
            ip_or_cidr: attackerIp,
            action: "block",
            protocol: "any",
            note: "Auto-blocked by Synapse AI SSH Intrusion Radar",
            created_at: new Date().toISOString(),
          });
        }
        draft.firewall_policies[nodeId] = pol;
        blockedIps = pol.ip_rules.filter((r) => r.action === "block").map((r) => r.ip_or_cidr);
      });
      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "ai_orchestrator",
        tool_name: toolName,
        node_id: nodeId,
        status: "executed",
        summary: `Blocked brute-force attacker IP ${attackerIp} on ${nodeId}`,
      });
      return { tool_name: toolName, status: "executed", output: { ok: true, blocked_ip: attackerIp, blocked_ips: blockedIps } };
    }

    const scanCmd = `FAILED_COUNT=$(journalctl -u ssh -u sshd --no-pager -n 400 2>/dev/null | grep -iE "Failed password|Invalid user" | wc -l); ACCEPTED_COUNT=$(journalctl -u ssh -u sshd --no-pager -n 400 2>/dev/null | grep -iE "Accepted " | wc -l); TOP_IPS=$(journalctl -u ssh -u sshd --no-pager -n 400 2>/dev/null | grep -iE "Failed password|Invalid user" | grep -oE "([0-9]{1,3}\\.){3}[0-9]{1,3}" | sort | uniq -c | sort -nr | head -n 5 | awk '{print $2 ":" $1}' | tr '\\n' ','); printf "INTRUSION_%s|%s|%s|%s\\n" "RESULT" "$FAILED_COUNT" "$ACCEPTED_COUNT" "$TOP_IPS"`;
    const ptyRes = await safeFetchJson(`${coreGatewayUrl}/api/v1/rpc/pty`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        node_id: nodeId,
        cmd_id: `intrusion-scan-${Date.now()}`,
        project_id: projectId,
        session_id: `security-radar-${projectId}`,
        command: scanCmd,
        wait_timeout_ms: 5000,
      }),
      timeoutMs: 6500,
    });
    const out = ptyRes.ok ? String((await ptyRes.json()).output || "") : "";
    const match = out.split(/\r?\n/).find((l) => l.includes("INTRUSION_RESULT|"));
    let failedAttempts = 0;
    let acceptedCount = 0;
    const attackers: Array<{ ip: string; attempts: number }> = [];
    const knownNodeIps = resolveKnownNodeIps(state);
    if (match) {
      const parts = match.slice(match.indexOf("INTRUSION_RESULT|")).trim().split("|");
      failedAttempts = Number(parts[1] || 0);
      acceptedCount = Number(parts[2] || 0);
      for (const item of (parts[3] || "").split(",").filter(Boolean)) {
        const [ip, cnt] = item.split(":");
        if (ip && !knownNodeIps.has(ip)) attackers.push({ ip, attempts: Number(cnt || 1) });
      }
    }
    const blockedIps = (state.firewall_policies?.[nodeId]?.ip_rules || [])
      .filter((r) => r.action === "block")
      .map((r) => r.ip_or_cidr);

    return {
      tool_name: toolName,
      status: "executed",
      output: { ok: true, node_id: nodeId, failed_count_24h: failedAttempts, accepted_count_24h: acceptedCount, top_attackers: attackers, blocked_ips: blockedIps },
    };
  }

  return null;
}
