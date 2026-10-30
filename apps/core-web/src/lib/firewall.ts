import crypto from "crypto";
import {
  appendAuditLog,
  ensureProjectVault,
  withProjectStateTransaction,
  type FirewallIpRule,
  type FirewallNodePolicy,
  type FirewallPortItem,
  type ProjectState,
} from "./vault";
import { resolveActiveProjectId, resolveTargetNodeId } from "./runtimeResolver";
import { safeFetchJson } from "./safeFetch";

const CORE_GATEWAY_URL =
  process.env.CORE_GATEWAY_URL || "http://127.0.0.1:8081";

export function getOrCreateNodeFirewallPolicy(
  state: ProjectState,
  nodeId: string
): FirewallNodePolicy {
  if (!state.firewall_policies) {
    state.firewall_policies = {};
  }
  const existing = state.firewall_policies[nodeId];
  if (existing) {
    return existing;
  }
  const created: FirewallNodePolicy = {
    node_id: nodeId,
    profile: "web_standard",
    backend: "iptables + ufw (Synapse Shield)",
    anti_lockout_active: true,
    rollback_guard_seconds: 15,
    ssh_port: 22,
    shielded_ports: [],
    ip_rules: [],
    detected_ports: [],
    last_synced_at: new Date().toISOString(),
  };
  state.firewall_policies[nodeId] = created;
  return created;
}

export async function inspectNodeFirewall(
  projectId: string,
  nodeId?: string
): Promise<{
  policy: FirewallNodePolicy;
  ports: FirewallPortItem[];
  summary: {
    total_ports: number;
    public_unshielded_count: number;
    shielded_count: number;
    local_only_count: number;
    ip_rules_count: number;
  };
  live_node_reached: boolean;
}> {
  const resolvedProjectId = resolveActiveProjectId(projectId);
  const state = ensureProjectVault(resolvedProjectId);
  const targetNodeId = resolveTargetNodeId(state, nodeId) || "unassigned-node";
  const policy = getOrCreateNodeFirewallPolicy(state, targetNodeId);

  const pyInspect = `
import json, re, subprocess
def sh(cmd):
    try:
        return subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT, timeout=6, text=True)
    except Exception:
        return ""
ss_out = sh("ss -tulpn")
ipt_out = sh("iptables -S SYNAPSE_FW 2>/dev/null || iptables -S INPUT 2>/dev/null")
ufw_out = sh("ufw status 2>/dev/null")
shielded_ports = set()
for m in re.finditer(r"--dport\\s+(\\d+)\\s+-j\\s+(DROP|REJECT)", ipt_out):
    shielded_ports.add(int(m.group(1)))
for m in re.finditer(r"(\\d+)/(tcp|udp)\\s+DENY", ufw_out):
    shielded_ports.add(int(m.group(1)))
ports_map = {}
ssh_port = 22
for line in ss_out.splitlines():
    line = line.strip()
    if not line or line.startswith("Netid"):
        continue
    parts = line.split()
    if len(parts) < 5 or ":" not in parts[4]:
        continue
    proto = "udp" if parts[0].startswith("udp") else "tcp"
    host_part, port_str = parts[4].rsplit(":", 1)
    if not port_str.isdigit():
        continue
    port = int(port_str)
    host_clean = host_part.strip("[]").split("%")[0]
    is_local = host_clean in ("127.0.0.1", "::1") or host_clean.startswith("127.")
    exposure = "local" if is_local else "public"
    proc_name = "system"
    pid_val = None
    proc_match = re.search(r'users:\\(\\("([^"]+)",pid=(\\d+)', line)
    if proc_match:
        proc_name = proc_match.group(1)
        pid_val = int(proc_match.group(2))
    if proc_name == "sshd" and port != 22:
        ssh_port = port
    key = f"{proto}:{port}"
    existing = ports_map.get(key)
    if not existing or (existing["exposure"] == "local" and exposure == "public"):
        ports_map[key] = {
            "port": port,
            "protocol": proto,
            "bind_address": "127.0.0.1" if is_local else "0.0.0.0",
            "exposure": exposure,
            "process": proc_name,
            "pid": pid_val,
            "shielded": port in shielded_ports,
        }
backend = "UFW + SYNAPSE_FW Shield" if "Status: active" in ufw_out else "iptables + SYNAPSE_FW Shield"
print("SYNAPSE_FW_JSON:" + json.dumps({
    "backend": backend,
    "ssh_port": ssh_port,
    "shielded_ports": sorted(list(shielded_ports)),
    "ports": sorted(list(ports_map.values()), key=lambda x: x["port"])
}))
`;

  let liveReached = false;
  let rawPorts: Array<{
    port: number;
    protocol: "tcp" | "udp";
    bind_address: string;
    exposure: "public" | "local";
    process: string;
    pid?: number;
    shielded: boolean;
  }> = [];

  if (targetNodeId !== "unassigned-node") {
    try {
      await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/rpc/fs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: targetNodeId,
          request_id: `fw-fs-${Date.now()}`,
          project_id: resolvedProjectId,
          tier: "TIER_1_UNLEASHED",
          operation: "write_file",
          path: ".synapse_fw_inspect.py",
          content: pyInspect,
          file_mode: "0755",
        }),
        timeoutMs: 4000,
      });

      const ptyRes = await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/rpc/pty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: targetNodeId,
          cmd_id: `fw-scan-${Date.now()}`,
          session_id: `fw-v1-${resolvedProjectId}`,
          project_id: resolvedProjectId,
          tier: "TIER_1_UNLEASHED",
          command: `python3 .synapse_fw_inspect.py; rm -f .synapse_fw_inspect.py`,
          wait_timeout_ms: 8000,
        }),
        timeoutMs: 9000,
      });

      if (ptyRes.ok) {
        const ptyData = await ptyRes.json();
        const out = String(ptyData.output || "");
        const markerIdx = out.indexOf("SYNAPSE_FW_JSON:");
        if (markerIdx !== -1) {
          const jsonLine = out
            .slice(markerIdx + "SYNAPSE_FW_JSON:".length)
            .trim()
            .split("\n")[0];
          const parsed = JSON.parse(jsonLine);
          liveReached = true;
          if (parsed.backend) policy.backend = String(parsed.backend);
          if (typeof parsed.ssh_port === "number") {
            policy.ssh_port = parsed.ssh_port;
          }
          if (Array.isArray(parsed.ports)) {
            rawPorts = parsed.ports;
          }
          if (Array.isArray(parsed.shielded_ports)) {
            const merged = new Set<number>([
              ...policy.shielded_ports,
              ...parsed.shielded_ports.map((n: unknown) => Number(n)),
            ]);
            policy.shielded_ports = Array.from(merged)
              .filter((p) => p > 0 && p !== policy.ssh_port)
              .sort((a, b) => a - b);
          }
        }
      }
    } catch {
      // Fallback if node is unreachable
    }
  }

  if (rawPorts.length === 0) {
    rawPorts = [
      {
        port: policy.ssh_port || 22,
        protocol: "tcp",
        bind_address: "0.0.0.0",
        exposure: "public",
        process: "sshd",
        shielded: false,
      },
      ...state.registered_services
        .filter((s) => s.node_id === targetNodeId)
        .map((s) => ({
          port: s.port,
          protocol: "tcp" as "tcp" | "udp",
          bind_address: s.bind_address || "0.0.0.0",
          exposure: (s.bind_address === "127.0.0.1" ? "local" : "public") as
            | "public"
            | "local",
          process: s.unit_or_container || "python3",
          shielded: policy.shielded_ports.includes(s.port),
        })),
    ];
  }

  const nodeServices = state.registered_services.filter(
    (s) => s.node_id === targetNodeId
  );

  const enrichedPorts: FirewallPortItem[] = rawPorts
    .map((item) => {
      const matchedSvc = nodeServices.find((s) => s.port === item.port);
      const isSsh =
        item.port === (policy.ssh_port || 22) || item.process === "sshd";
      const isShielded =
        !isSsh &&
        (item.shielded || policy.shielded_ports.includes(item.port));

      let label = matchedSvc?.name;
      if (!label) {
        if (isSsh) label = "SSH Server-Zugang (Anti-Lockout)";
        else if (item.port === 80 || item.port === 443)
          label = "Webserver (HTTP/HTTPS)";
        else if (item.port === 53) label = "DNS Resolver";
        else label = `Prozess: ${item.process}`;
      }

      return {
        port: item.port,
        protocol: item.protocol,
        bind_address: item.bind_address,
        exposure: item.exposure,
        process: item.process,
        pid: item.pid,
        service_name: label,
        shielded: isShielded,
        system_protected: isSsh,
      };
    })
    .sort((a, b) => {
      const rank = (p: FirewallPortItem) => {
        if (p.exposure === "public" && !p.shielded && !p.system_protected)
          return 0;
        if (p.shielded) return 1;
        if (p.system_protected) return 2;
        return 3;
      };
      const rDiff = rank(a) - rank(b);
      return rDiff !== 0 ? rDiff : a.port - b.port;
    });

  policy.detected_ports = enrichedPorts;
  policy.last_synced_at = new Date().toISOString();
  await withProjectStateTransaction(resolvedProjectId, (draft) => {
    draft.firewall_policies = {
      ...(draft.firewall_policies || {}),
      [targetNodeId]: policy,
    };
  });

  const publicUnshielded = enrichedPorts.filter(
    (p) => p.exposure === "public" && !p.shielded && !p.system_protected
  ).length;
  const shieldedCount = enrichedPorts.filter((p) => p.shielded).length;
  const localOnlyCount = enrichedPorts.filter(
    (p) => p.exposure === "local"
  ).length;

  return {
    policy,
    ports: enrichedPorts,
    summary: {
      total_ports: enrichedPorts.length,
      public_unshielded_count: publicUnshielded,
      shielded_count: shieldedCount,
      local_only_count: localOnlyCount,
      ip_rules_count: policy.ip_rules.length,
    },
    live_node_reached: liveReached,
  };
}

async function syncFirewallChainOnNode(
  projectId: string,
  nodeId: string,
  policy: FirewallNodePolicy
): Promise<{ applied_on_node: boolean; details: string }> {
  const sshPort = policy.ssh_port || 22;
  const shieldedPorts = Array.from(new Set(policy.shielded_ports)).filter(
    (p) => p > 0 && p <= 65535 && p !== sshPort
  );

  const pyApply = `
import subprocess
SSH_PORT = ${JSON.stringify(sshPort)}
SHIELDED_PORTS = ${JSON.stringify(shieldedPorts)}
IP_RULES = ${JSON.stringify(policy.ip_rules || [])}
def run(cmd):
    subprocess.run(cmd, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
run("iptables-save > /tmp/synapse-fw-backup.rules 2>/dev/null || true")
run("rm -f /tmp/synapse-fw-confirmed")
run("(sleep 15; if [ ! -f /tmp/synapse-fw-confirmed ] && [ -f /tmp/synapse-fw-backup.rules ]; then iptables-restore < /tmp/synapse-fw-backup.rules 2>/dev/null || true; fi) >/dev/null 2>&1 &")
run("iptables -N SYNAPSE_FW 2>/dev/null || true")
run("iptables -F SYNAPSE_FW")
run("iptables -C INPUT -j SYNAPSE_FW 2>/dev/null || iptables -I INPUT 1 -j SYNAPSE_FW")
run("iptables -A SYNAPSE_FW -i lo -j ACCEPT")
run("iptables -A SYNAPSE_FW -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT")
run(f"iptables -A SYNAPSE_FW -p tcp --dport {SSH_PORT} -j ACCEPT")
for r in IP_RULES:
    ip = str(r.get("ip_or_cidr", "")).strip()
    if not ip or ip in ("127.0.0.1", "localhost", "0.0.0.0", "0.0.0.0/0"):
        continue
    action = "ACCEPT" if r.get("action") == "allow" else "DROP"
    port = r.get("port")
    proto = r.get("protocol") or "tcp"
    if port and int(port) > 0 and int(port) != SSH_PORT:
        if proto in ("tcp", "udp"):
            run(f"iptables -A SYNAPSE_FW ! -i lo -s {ip} -p {proto} --dport {int(port)} -j {action}")
        else:
            run(f"iptables -A SYNAPSE_FW ! -i lo -s {ip} -p tcp --dport {int(port)} -j {action}")
            run(f"iptables -A SYNAPSE_FW ! -i lo -s {ip} -p udp --dport {int(port)} -j {action}")
    else:
        if action == "DROP":
            run(f"iptables -A SYNAPSE_FW ! -i lo -s {ip} -j DROP")
        else:
            run(f"iptables -A SYNAPSE_FW -s {ip} -j ACCEPT")
for p in SHIELDED_PORTS:
    if int(p) == SSH_PORT:
        continue
    run(f"iptables -A SYNAPSE_FW ! -i lo -p tcp --dport {int(p)} -j DROP")
    run(f"iptables -A SYNAPSE_FW ! -i lo -p udp --dport {int(p)} -j DROP")
run("iptables -A SYNAPSE_FW -j RETURN")
print("SYNAPSE_FW_APPLIED_OK")
`;

  if (nodeId && nodeId !== "unassigned-node") {
    try {
      await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/rpc/fs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: nodeId,
          request_id: `fw-apply-fs-${Date.now()}`,
          project_id: projectId,
          tier: "TIER_1_UNLEASHED",
          operation: "write_file",
          path: ".synapse_fw_apply.py",
          content: pyApply,
          file_mode: "0755",
        }),
        timeoutMs: 4000,
      });

      const ptyRes = await safeFetchJson(`${CORE_GATEWAY_URL}/api/v1/rpc/pty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: nodeId,
          cmd_id: `fw-apply-${Date.now()}`,
          session_id: `fw-v1-${projectId}`,
          project_id: projectId,
          tier: "TIER_1_UNLEASHED",
          command: `python3 .synapse_fw_apply.py && touch /tmp/synapse-fw-confirmed; rm -f .synapse_fw_apply.py`,
          wait_timeout_ms: 8000,
        }),
        timeoutMs: 9000,
      });

      if (ptyRes.ok) {
        const ptyData = await ptyRes.json();
        const out = String(ptyData.output || "");
        if (out.includes("SYNAPSE_FW_APPLIED_OK")) {
          return {
            applied_on_node: true,
            details: `SYNAPSE_FW chain updated on ${nodeId} (Anti-Lockout + 15s Rollback Guard confirmed, ${shieldedPorts.length} ports shielded, ${policy.ip_rules.length} IP rules).`,
          };
        }
      }
    } catch {
      // Fallback if node is offline
    }
  }

  return {
    applied_on_node: false,
    details: `Firewall policy saved in Core Vault for ${nodeId} (will enforce on next sync).`,
  };
}

export interface FirewallActionInput {
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
  protocol?: "tcp" | "udp" | "any";
  note?: string;
  rule_id?: string;
  actor?: "user" | "ai_orchestrator";
}

export async function executeFirewallAction(
  projectId: string,
  input: FirewallActionInput
) {
  const resolvedProjectId = resolveActiveProjectId(projectId);
  const state = ensureProjectVault(resolvedProjectId);
  const targetNodeId =
    resolveTargetNodeId(state, input.node_id) || "unassigned-node";

  if (input.action === "inspect") {
    return inspectNodeFirewall(resolvedProjectId, targetNodeId);
  }

  const current = await inspectNodeFirewall(resolvedProjectId, targetNodeId);
  const policy = getOrCreateNodeFirewallPolicy(state, targetNodeId);
  const sshPort = policy.ssh_port || 22;
  let summaryMsg = "";

  if (input.action === "set_profile") {
    const profile = input.profile || "web_standard";
    policy.profile = profile;

    if (profile === "synapse_stealth") {
      const publicPorts = current.ports
        .filter((p) => p.exposure === "public" && p.port !== sshPort)
        .map((p) => p.port);
      const standardAppPorts = [
        80, 443, 3000, 4050, 4070, 4085, 4090, 5432, 6379, 8080,
      ];
      policy.shielded_ports = Array.from(
        new Set([...publicPorts, ...standardAppPorts])
      )
        .filter((p) => p !== sshPort)
        .sort((a, b) => a - b);
      summaryMsg = `Activated 'Synapse Stealth (Zero-Port)' firewall profile on ${targetNodeId} (all app ports shielded from internet; SSH :${sshPort} & Synapse Tunnel protected)`;
    } else if (profile === "web_standard") {
      const publicInternalPorts = current.ports
        .filter(
          (p) =>
            p.exposure === "public" &&
            p.port !== sshPort &&
            p.port !== 80 &&
            p.port !== 443 &&
            p.port !== 53
        )
        .map((p) => p.port);
      policy.shielded_ports = Array.from(new Set(publicInternalPorts)).sort(
        (a, b) => a - b
      );
      summaryMsg = `Activated 'Web-Server Standard' firewall profile on ${targetNodeId} (SSH :${sshPort} & HTTP/S :80/:443 open; ${policy.shielded_ports.length} internal ports shielded)`;
    } else {
      summaryMsg = `Switched firewall profile on ${targetNodeId} to 'Custom'`;
    }
  } else if (input.action === "shield_port") {
    const port = Number(input.port || 0);
    if (port === sshPort) {
      throw new Error(
        `Anti-Lockout Schutz: SSH-Port :${sshPort} darf nicht gesperrt werden, damit du dich niemals selbst aussperrst.`
      );
    }
    if (port > 0 && port <= 65535) {
      if (!policy.shielded_ports.includes(port)) {
        policy.shielded_ports = [...policy.shielded_ports, port].sort(
          (a, b) => a - b
        );
      }
      summaryMsg = `Shielded port :${port} on ${targetNodeId} from public internet (remains accessible via Synapse Tunnel 127.0.0.1:${port})`;
    }
  } else if (input.action === "unshield_port") {
    const port = Number(input.port || 0);
    policy.shielded_ports = policy.shielded_ports.filter((p) => p !== port);
    summaryMsg = `Opened port :${port} on ${targetNodeId} for external traffic`;
  } else if (input.action === "add_ip_rule") {
    const rawIp = String(input.ip_or_cidr || "").trim();
    if (!rawIp || !/^[0-9a-fA-F:./]+$/.test(rawIp)) {
      throw new Error(
        "Bitte eine gültige IPv4/IPv6-Adresse oder CIDR angeben (z. B. 203.0.113.50 oder 10.0.0.0/24)."
      );
    }
    if (
      input.rule_action === "block" &&
      (rawIp === "127.0.0.1" || rawIp === "0.0.0.0/0" || rawIp === "::1")
    ) {
      throw new Error(
        "Anti-Lockout Schutz: 127.0.0.1 oder 0.0.0.0/0 dürfen nicht als globale IP-Sperre eingetragen werden."
      );
    }
    const newRule: FirewallIpRule = {
      rule_id: `fw-ip-${crypto.randomBytes(3).toString("hex")}`,
      ip_or_cidr: rawIp,
      action: input.rule_action === "block" ? "block" : "allow",
      port: input.port ? Number(input.port) : null,
      protocol: input.protocol || "tcp",
      note: input.note ? String(input.note).trim() : undefined,
      created_at: new Date().toISOString(),
    };
    policy.ip_rules = [
      newRule,
      ...policy.ip_rules.filter(
        (r) =>
          !(
            r.ip_or_cidr === newRule.ip_or_cidr &&
            r.port === newRule.port &&
            r.action === newRule.action
          )
      ),
    ];
    summaryMsg = `Added firewall IP rule: ${newRule.action.toUpperCase()} ${newRule.ip_or_cidr}${
      newRule.port ? ` on port :${newRule.port}` : " (all ports)"
    } on ${targetNodeId}`;
  } else if (input.action === "remove_ip_rule") {
    const ruleId = String(input.rule_id || "");
    policy.ip_rules = policy.ip_rules.filter((r) => r.rule_id !== ruleId);
    summaryMsg = `Removed firewall IP rule ${ruleId} on ${targetNodeId}`;
  }

  await withProjectStateTransaction(resolvedProjectId, (draft) => {
    draft.firewall_policies = {
      ...(draft.firewall_policies || {}),
      [targetNodeId]: policy,
    };
  });

  const syncRes = await syncFirewallChainOnNode(
    resolvedProjectId,
    targetNodeId,
    policy
  );

  appendAuditLog(resolvedProjectId, {
    timestamp: new Date().toISOString(),
    actor: input.actor || "user",
    tool_name: "node_firewall_control",
    node_id: targetNodeId,
    status: "executed",
    summary: `${summaryMsg} — ${syncRes.details}`,
    args: input as unknown as Record<string, unknown>,
  });

  const refreshed = await inspectNodeFirewall(resolvedProjectId, targetNodeId);
  return {
    ok: true,
    ...refreshed,
    sync: syncRes,
    message: summaryMsg,
  };
}
