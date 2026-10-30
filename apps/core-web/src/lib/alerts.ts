import fs from "fs";
import path from "path";
import {
  atomicWriteJsonSync,
  ensureProjectVault,
  getProjectDir,
  safeReadJsonWithBackupSync,
} from "@/lib/vault";
import { resolveActiveProjectId, resolveTargetNodeId } from "@/lib/runtimeResolver";
import { safeFetchJson } from "./safeFetch";

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
  const projDir = getProjectDir(resolveActiveProjectId(projectId));
  fs.mkdirSync(projDir, { recursive: true });
  return path.join(projDir, "Alerts.json");
}

export function loadAlertConfig(projectId: string): AlertConfig {
  const resolvedProjectId = resolveActiveProjectId(projectId);
  const filePath = getAlertsFilePath(resolvedProjectId);
  const parsed = safeReadJsonWithBackupSync<Partial<AlertConfig> | null>(
    filePath,
    null
  );
  if (parsed && typeof parsed === "object") {
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

  const state = ensureProjectVault(resolvedProjectId);
  const primaryNodeId = resolveTargetNodeId(state);
  const svcCount = (state.registered_services || []).length;

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
        message: primaryNodeId
          ? `Monitoring ${primaryNodeId} (CPU < 85%, RAM < 85%, Disk < 85%) and ${svcCount} registered service(s).`
          : "Watchdog armed and ready. Enroll a Muscle node to begin hardware and service telemetry monitoring.",
        node_id: primaryNodeId || undefined,
        dispatched_to: ["Local Event Bus"],
      },
    ],
    updated_at: new Date().toISOString(),
  };
  saveAlertConfig(resolvedProjectId, initial);
  return initial;
}

export function saveAlertConfig(projectId: string, cfg: AlertConfig): void {
  const filePath = getAlertsFilePath(projectId);
  cfg.updated_at = new Date().toISOString();
  cfg.events = (cfg.events || []).slice(0, 60);
  atomicWriteJsonSync(filePath, cfg);
}

export async function dispatchAlertEvent(
  projectId: string,
  event: Omit<AlertEvent, "id" | "timestamp" | "dispatched_to">
): Promise<AlertEvent> {
  const resolvedProjectId = resolveActiveProjectId(projectId);
  const cfg = loadAlertConfig(resolvedProjectId);
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
    const tgRes = await safeFetchJson(
      `https://api.telegram.org/bot${cfg.telegram_bot_token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cfg.telegram_chat_id,
          text: textBody.replace(/\*\*/g, "*"),
          parse_mode: "Markdown",
        }),
        timeoutMs: 6000,
      }
    );
    dispatched.push(
      tgRes.ok
        ? "Telegram (OK)"
        : tgRes.status > 0
        ? `Telegram (${tgRes.status})`
        : "Telegram (Unreachable)"
    );
  }

  if (cfg.enabled && cfg.discord_enabled && cfg.discord_webhook_url) {
    const dcRes = await safeFetchJson(cfg.discord_webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: textBody }),
      timeoutMs: 6000,
    });
    dispatched.push(
      dcRes.ok
        ? "Discord (OK)"
        : dcRes.status > 0
        ? `Discord (${dcRes.status})`
        : "Discord (Unreachable)"
    );
  }

  if (cfg.enabled && cfg.webhook_enabled && cfg.webhook_url) {
    const whRes = await safeFetchJson(cfg.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "synapse-core-watchdog",
        project_id: resolvedProjectId,
        ...event,
        timestamp: new Date().toISOString(),
      }),
      timeoutMs: 6000,
    });
    dispatched.push(
      whRes.ok
        ? "Webhook (OK)"
        : whRes.status > 0
        ? `Webhook (${whRes.status})`
        : "Webhook (Unreachable)"
    );
  }

  const fullEvent: AlertEvent = {
    ...event,
    id: `alt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    dispatched_to: dispatched,
  };

  cfg.events = [fullEvent, ...(cfg.events || []).slice(0, 59)];
  saveAlertConfig(resolvedProjectId, cfg);
  return fullEvent;
}
