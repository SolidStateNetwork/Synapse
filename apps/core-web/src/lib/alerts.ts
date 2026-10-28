import fs from "fs";
import path from "path";

export interface AlertEvent {
  id: string;
  timestamp: string;
  severity: "CRITICAL" | "WARNING" | "INFO" | "RESOLVED";
  title: string;
  message: string;
  node_id?: string;
  service_id?: string;
  dispatched_to: string[];
  auto_healed?: boolean;
}

export interface AlertConfig {
  enabled: boolean;
  telegram_enabled: boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;
  discord_enabled: boolean;
  discord_webhook_url: string;
  webhook_enabled: boolean;
  webhook_url: string;
  cpu_threshold: number;
  ram_threshold: number;
  disk_threshold: number;
  alert_on_service_down: boolean;
  alert_on_peer_offline: boolean;
  auto_heal_services: boolean;
  events: AlertEvent[];
  updated_at: string;
}

function getAlertsFilePath(projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9._-]/g, "") || "synapse-cloud-demo";
  const vaultRoot =
    process.env.SYNAPSE_VAULT_DIR ||
    path.join(process.cwd(), ".synapse-data", "projects");
  const projDir = path.join(vaultRoot, safeId);
  fs.mkdirSync(projDir, { recursive: true });
  return path.join(projDir, "Alerts.json");
}

export function loadAlertConfig(projectId: string): AlertConfig {
  const filePath = getAlertsFilePath(projectId);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<AlertConfig>;
      return {
        enabled: parsed.enabled ?? true,
        telegram_enabled: Boolean(parsed.telegram_enabled),
        telegram_bot_token: parsed.telegram_bot_token || "",
        telegram_chat_id: parsed.telegram_chat_id || "",
        discord_enabled: Boolean(parsed.discord_enabled),
        discord_webhook_url: parsed.discord_webhook_url || "",
        webhook_enabled: Boolean(parsed.webhook_enabled),
        webhook_url: parsed.webhook_url || "",
        cpu_threshold: parsed.cpu_threshold ?? 85,
        ram_threshold: parsed.ram_threshold ?? 85,
        disk_threshold: parsed.disk_threshold ?? 85,
        alert_on_service_down: parsed.alert_on_service_down ?? true,
        alert_on_peer_offline: parsed.alert_on_peer_offline ?? true,
        auto_heal_services: parsed.auto_heal_services ?? true,
        events: Array.isArray(parsed.events) ? parsed.events : [],
        updated_at: parsed.updated_at || new Date().toISOString(),
      };
    }
  } catch {
    // fallback
  }

  const initial: AlertConfig = {
    enabled: true,
    telegram_enabled: false,
    telegram_bot_token: "",
    telegram_chat_id: "",
    discord_enabled: false,
    discord_webhook_url: "",
    webhook_enabled: false,
    webhook_url: "",
    cpu_threshold: 85,
    ram_threshold: 85,
    disk_threshold: 85,
    alert_on_service_down: true,
    alert_on_peer_offline: true,
    auto_heal_services: true,
    events: [
      {
        id: "alt-boot-watchdog",
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        severity: "INFO",
        title: "24/7 Watchdog & Alert Engine Armed",
        message:
          "Monitoring vps2-muscle (CPU < 85%, RAM < 85%, Disk < 85%) and 5 active services.",
        node_id: "vps2-muscle",
        dispatched_to: ["Local Event Bus"],
      },
    ],
    updated_at: new Date().toISOString(),
  };
  saveAlertConfig(projectId, initial);
  return initial;
}

export function saveAlertConfig(projectId: string, cfg: AlertConfig): void {
  const filePath = getAlertsFilePath(projectId);
  cfg.updated_at = new Date().toISOString();
  cfg.events = (cfg.events || []).slice(0, 60);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmpPath, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmpPath, filePath);
}

export async function dispatchAlertEvent(
  projectId: string,
  event: Omit<AlertEvent, "id" | "timestamp" | "dispatched_to">
): Promise<AlertEvent> {
  const cfg = loadAlertConfig(projectId);
  const dispatched: string[] = ["Watchdog Log"];

  const textBody = `🚨 **[Synapse ${event.severity}] ${event.title}**\n${event.message}${
    event.node_id ? `\nNode: \`${event.node_id}\`` : ""
  }`;

  if (
    cfg.enabled &&
    cfg.telegram_enabled &&
    cfg.telegram_bot_token &&
    cfg.telegram_chat_id
  ) {
    try {
      const tgRes = await fetch(
        `https://api.telegram.org/bot${cfg.telegram_bot_token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: cfg.telegram_chat_id,
            text: textBody.replace(/\*\*/g, "*"),
            parse_mode: "Markdown",
          }),
        }
      );
      dispatched.push(tgRes.ok ? "Telegram (OK)" : `Telegram (${tgRes.status})`);
    } catch {
      dispatched.push("Telegram (Unreachable)");
    }
  }

  if (cfg.enabled && cfg.discord_enabled && cfg.discord_webhook_url) {
    try {
      const dcRes = await fetch(cfg.discord_webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: textBody }),
      });
      dispatched.push(dcRes.ok ? "Discord (OK)" : `Discord (${dcRes.status})`);
    } catch {
      dispatched.push("Discord (Unreachable)");
    }
  }

  if (cfg.enabled && cfg.webhook_enabled && cfg.webhook_url) {
    try {
      const whRes = await fetch(cfg.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "synapse-core-watchdog",
          project_id: projectId,
          ...event,
          timestamp: new Date().toISOString(),
        }),
      });
      dispatched.push(whRes.ok ? "Webhook (OK)" : `Webhook (${whRes.status})`);
    } catch {
      dispatched.push("Webhook (Unreachable)");
    }
  }

  const fullEvent: AlertEvent = {
    ...event,
    id: `alt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    dispatched_to: dispatched,
  };

  cfg.events = [fullEvent, ...(cfg.events || []).slice(0, 59)];
  saveAlertConfig(projectId, cfg);
  return fullEvent;
}
