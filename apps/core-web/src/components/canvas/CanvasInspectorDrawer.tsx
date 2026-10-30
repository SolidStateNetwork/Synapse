"use client";

import React from "react";
import {
  Activity,
  Code2,
  History,
  KeyRound,
  Plus,
  Shield,
  Terminal as TerminalIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type {
  CheckpointItem,
  GatewayNode,
  InteractiveControlCenterCanvasProps,
  IntrusionScanState,
  NodeHeartbeat,
  OffsiteBackupItem,
  TelemetrySample,
} from "@/components/canvas/canvasTypes";

export {
  CoreHubInspectorPanel,
  type CoreHubInspectorPanelProps,
  ServiceNodeInspectorPanel,
  type ServiceNodeInspectorPanelProps,
} from "@/components/canvas/CanvasCoreAndServicePanels";
export {
  CanvasEdgesLayer,
  type CanvasEdgesLayerProps,
} from "@/components/canvas/CanvasEdgesLayer";

export interface MuscleNodeInspectorPanelProps {
  gn: GatewayNode;
  hb?: NodeHeartbeat;
  history: TelemetrySample[];
  buildSparklinePoints: (selector: (s: TelemetrySample) => number) => string;
  firewallPolicies?: InteractiveControlCenterCanvasProps["firewallPolicies"];
  onSelectNode: (id: string) => void;
  onOpenFirewall?: (nodeId?: string) => void;
  onOpenPty: () => void;
  onOpenRemoteFiles: () => void;
  authRole: "admin" | "operator";
  checkpointBusyId: string | null;
  checkpointNotice: string | null;
  nodeCheckpoints: CheckpointItem[];
  onCreateCheckpoint: (nodeId: string) => void;
  onRollbackCheckpoint: (chk: CheckpointItem) => void;
  intrusionBusyNode: string | null;
  intrusionNotice: string | null;
  intrusionMap: Record<string, IntrusionScanState>;
  onScanIntrusions: (nodeId: string) => void;
  onBlockAttackerIp: (nodeId: string, ip: string) => void;
  backupBusyId: string | null;
  backupNotice: string | null;
  offsiteBackups: OffsiteBackupItem[];
  onCreateOffsiteBackup: (nodeId: string) => void;
  onRestoreOffsiteBackup: (bkp: OffsiteBackupItem) => void;
}

export const MuscleNodeInspectorPanel = React.memo(
  function MuscleNodeInspectorPanel({
    gn,
    hb,
    history,
    buildSparklinePoints,
    firewallPolicies,
    onSelectNode,
    onOpenFirewall,
    onOpenPty,
    onOpenRemoteFiles,
    authRole,
    checkpointBusyId,
    checkpointNotice,
    nodeCheckpoints,
    onCreateCheckpoint,
    onRollbackCheckpoint,
    intrusionBusyNode,
    intrusionNotice,
    intrusionMap,
    onScanIntrusions,
    onBlockAttackerIp,
    backupBusyId,
    backupNotice,
    offsiteBackups,
    onCreateOffsiteBackup,
    onRestoreOffsiteBackup,
  }: MuscleNodeInspectorPanelProps) {
    const { t, translateText } = useI18n();

    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className="mt-3 space-y-2.5 border-t border-nb-gray-800/90 pt-3 text-[11px]"
      >
        <div className="space-y-1.5 rounded-lg border border-nb-gray-800/80 bg-nb-gray-950/80 p-2.5 text-[11px]">
          <div className="flex items-center justify-between text-nb-gray-400">
            <span>{t("Betriebssystem", "Operating System")}</span>
            <span className="font-mono text-[10px] text-nb-gray-200 truncate max-w-[165px]">
              {hb?.os_info
                ? hb.os_info.split("(")[0].trim()
                : hb?.os_arch || "Linux x86_64"}
            </span>
          </div>
          <div className="flex items-center justify-between text-nb-gray-400">
            <span>{t("IPv4-Adresse", "IPv4 Address")}</span>
            <span className="font-mono text-white">
              {hb?.private_ipv4 || "127.0.0.1"}
            </span>
          </div>
          <div className="flex items-center justify-between text-nb-gray-400">
            <span>{t("Sicherheits-Stufe", "Autonomy Tier")}</span>
            <span className="font-mono text-netbird">
              {gn.tier === "TIER_1_UNLEASHED"
                ? t("Stufe 1 · Vollzugriff", "Tier 1 · Unleashed")
                : gn.tier === "TIER_2_WORKSPACE_JAIL"
                ? t("Stufe 2 · Workspace", "Tier 2 · Workspace")
                : t("Stufe 3 · Überwacht", "Tier 3 · Supervised")}
            </span>
          </div>
          <div className="flex items-center justify-between text-nb-gray-400">
            <span>{t("Firewall-Status", "Firewall Status")}</span>
            {(() => {
              const fwPol = firewallPolicies?.[gn.node_id];
              const prof = fwPol?.profile || "web_standard";
              const detectedShielded =
                fwPol?.detected_ports?.filter((p) => p.shielded).length || 0;
              const shieldedCount =
                detectedShielded || fwPol?.shielded_ports?.length || 0;
              const isStealth = prof === "synapse_stealth";
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectNode(gn.node_id);
                    onOpenFirewall?.(gn.node_id);
                  }}
                  title={t(
                    "Firewall & Port-Schutz für diesen Server öffnen",
                    "Open Firewall & Port Shield for this server"
                  )}
                  className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9.5px] font-semibold transition ${
                    isStealth
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                      : shieldedCount > 0
                      ? "border-sky-500/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                  }`}
                >
                  <Shield className="h-2.5 w-2.5 shrink-0" />
                  <span>
                    {isStealth
                      ? t("Stealth-Firewall", "Stealth Firewall")
                      : shieldedCount > 0
                      ? t(
                          `${shieldedCount} gesperrt`,
                          `${shieldedCount} shielded`
                        )
                      : t("Firewall aktiv", "Firewall active")}
                  </span>
                </button>
              );
            })()}
          </div>
          {(hb?.load_avg_1 !== undefined || hb?.uptime_sec) && (
            <div className="flex items-center justify-between text-nb-gray-400">
              <span>{t("System-Last & Uptime", "Load & Uptime")}</span>
              <span className="font-mono text-[10px] text-emerald-400">
                Load {(hb?.load_avg_1 ?? 0.01).toFixed(2)} ·{" "}
                {Math.max(1, Math.round((hb?.uptime_sec || 3600) / 3600))}h
              </span>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-nb-gray-800/80 bg-nb-gray-950/80 p-2.5 text-[11px] space-y-1.5">
          <div className="flex items-center justify-between text-nb-gray-400">
            <span>{t("Multi-Core Tunnels", "Multi-Core Tunnels")}</span>
            <span className="rounded border border-violet-500/40 bg-violet-950/70 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-violet-300">
              {hb?.active_cores ?? 1}{" "}
              {(hb?.active_cores ?? 1) === 1
                ? t("Core aktiv", "Core active")
                : t("Cores parallel", "Cores parallel")}
            </span>
          </div>
          {Array.isArray(hb?.connected_cores) &&
            hb.connected_cores.length > 0 && (
              <div className="space-y-1 pt-0.5">
                {hb.connected_cores.map((coreDesc) => {
                  const isLive = coreDesc.includes("LIVE");
                  return (
                    <div
                      key={coreDesc}
                      className="flex items-center justify-between gap-1.5 rounded border border-nb-gray-800/80 bg-nb-gray-940/90 px-2 py-1 font-mono text-[9.5px]"
                    >
                      <span className="inline-flex items-center gap-1.5 truncate text-nb-gray-200">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            isLive ? "bg-emerald-400" : "bg-amber-400"
                          }`}
                        />
                        <span className="truncate">
                          {coreDesc.split(" (")[0]}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 text-[9px] font-semibold ${
                          isLive ? "text-emerald-300" : "text-amber-300"
                        }`}
                      >
                        {coreDesc.includes("(")
                          ? coreDesc.slice(coreDesc.indexOf("(") + 1, -1)
                          : isLive
                          ? "LIVE"
                          : "STANDBY"}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        {hb && (
          <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 font-mono text-[10px] space-y-1.5">
            <div className="flex items-center justify-between text-[9px] leading-none text-nb-gray-400">
              <span className="inline-flex items-center gap-1.5 leading-none">
                <Activity className="h-3 w-3 shrink-0 text-netbird" />
                <span>
                  {t(
                    "Live-Zeitreihen (Telemetrie)",
                    "Live Time-Series Telemetry"
                  )}
                </span>
              </span>
              <span className="text-emerald-400 leading-none">
                {history.length || 1} {t("Messpunkte", "Samples")}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <div className="min-w-0 overflow-hidden rounded border border-nb-gray-800/70 bg-nb-gray-940/60 p-1.5">
                <div className="flex items-center justify-between gap-1 text-[9.5px]">
                  <span className="truncate text-nb-gray-400">CPU</span>
                  <span className="shrink-0 font-semibold text-white">
                    {hb.cpu_percent.toFixed(1)}%
                  </span>
                </div>
                <svg
                  className="mt-1 h-5 w-full overflow-visible"
                  viewBox="0 0 72 22"
                >
                  <polyline
                    fill="none"
                    stroke="#f68330"
                    strokeWidth="1.6"
                    points={buildSparklinePoints((s) => s.cpu)}
                  />
                </svg>
              </div>
              <div className="min-w-0 overflow-hidden rounded border border-nb-gray-800/70 bg-nb-gray-940/60 p-1.5">
                <div className="flex items-center justify-between gap-1 text-[9.5px]">
                  <span className="truncate text-nb-gray-400">RAM</span>
                  <span className="shrink-0 font-semibold text-white">
                    {hb.ram_percent.toFixed(1)}%
                  </span>
                </div>
                <svg
                  className="mt-1 h-5 w-full overflow-visible"
                  viewBox="0 0 72 22"
                >
                  <polyline
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.6"
                    points={buildSparklinePoints((s) => s.ram)}
                  />
                </svg>
              </div>
              <div className="min-w-0 overflow-hidden rounded border border-nb-gray-800/70 bg-nb-gray-940/60 p-1.5">
                <div className="flex items-center justify-between gap-1 text-[9.5px]">
                  <span className="truncate text-nb-gray-400">
                    {t("SPEICHER", "DISK")}
                  </span>
                  <span className="shrink-0 font-semibold text-white">
                    {hb.disk_percent.toFixed(1)}%
                  </span>
                </div>
                <svg
                  className="mt-1 h-5 w-full overflow-visible"
                  viewBox="0 0 72 22"
                >
                  <polyline
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="1.6"
                    points={buildSparklinePoints((s) => s.disk)}
                  />
                </svg>
              </div>
            </div>
          </div>
        )}

        <div
          data-canvas-scroll-zone="true"
          className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] leading-none uppercase tracking-wider text-nb-gray-300">
              <History className="h-3 w-3 shrink-0 text-amber-400" />
              <span>
                {t("Time-Machine Checkpoints", "Time-Machine Checkpoints")}
              </span>
            </span>
            <button
              type="button"
              disabled={
                checkpointBusyId === "create" || authRole === "operator"
              }
              onClick={() => onCreateCheckpoint(gn.node_id)}
              className="inline-flex items-center justify-center gap-1 rounded border border-amber-500/40 bg-amber-500/15 px-2 py-1 font-mono text-[9px] leading-none font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50 transition"
            >
              <Plus className="h-2.5 w-2.5 shrink-0" />
              <span>
                {checkpointBusyId === "create"
                  ? t("Speichert...", "Saving...")
                  : t("Snapshot", "Snapshot")}
              </span>
            </button>
          </div>
          {checkpointNotice && (
            <div className="rounded bg-emerald-950/70 border border-emerald-500/40 px-2 py-1 text-[9.5px] text-emerald-300">
              {checkpointNotice}
            </div>
          )}
          <div className="space-y-1 max-h-28 overflow-y-auto pr-0.5 overscroll-contain">
            {nodeCheckpoints.map((chk) => (
              <div
                key={chk.id}
                className="flex items-center justify-between gap-1.5 rounded border border-nb-gray-800/80 bg-nb-gray-940/70 px-2 py-1 text-[10px]"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-nb-gray-200">
                    {translateText(chk.title)}
                  </div>
                  <div className="font-mono text-[8.5px] text-nb-gray-400">
                    {new Date(chk.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {chk.actor}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={
                    checkpointBusyId === chk.id || authRole === "operator"
                  }
                  onClick={() => onRollbackCheckpoint(chk)}
                  className="shrink-0 rounded border border-sky-500/40 bg-sky-500/15 px-1.5 py-0.5 font-mono text-[8.5px] font-semibold text-sky-300 hover:bg-sky-500/25 disabled:opacity-50 transition"
                >
                  {checkpointBusyId === chk.id
                    ? "..."
                    : t("Rollback", "Rollback")}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div
          data-canvas-scroll-zone="true"
          className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] leading-none uppercase tracking-wider text-nb-gray-300">
              <Shield className="h-3 w-3 shrink-0 text-red-400" />
              <span>{t("SSH-Intrusion-Radar", "SSH Intrusion Radar")}</span>
            </span>
            <button
              type="button"
              disabled={intrusionBusyNode === gn.node_id}
              onClick={() => onScanIntrusions(gn.node_id)}
              className="inline-flex items-center justify-center rounded border border-red-500/40 bg-red-500/15 px-2 py-1 font-mono text-[9px] leading-none font-semibold text-red-300 hover:bg-red-500/25 disabled:opacity-50 transition"
            >
              {intrusionBusyNode === gn.node_id
                ? t("Scannt...", "Scanning...")
                : t("Scan", "Scan")}
            </button>
          </div>
          {intrusionNotice && (
            <div className="rounded bg-emerald-950/70 border border-emerald-500/40 px-2 py-1 text-[9.5px] text-emerald-300">
              {intrusionNotice}
            </div>
          )}
          {intrusionMap[gn.node_id] && (
            <div className="space-y-1 text-[9.5px]">
              <div className="flex items-center justify-between text-nb-gray-400">
                <span>
                  {t("Abgewehrte SSH-Logins", "Failed SSH Logins")}:{" "}
                  <strong className="text-red-400 font-mono">
                    {intrusionMap[gn.node_id].failed_count_24h}
                  </strong>
                </span>
                <span>
                  {t("Gesperrt", "Blocked")}:{" "}
                  <strong className="text-emerald-400 font-mono">
                    {intrusionMap[gn.node_id].blocked_ips.length}
                  </strong>
                </span>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto pr-0.5 overscroll-contain">
                {intrusionMap[gn.node_id].top_attackers.map((att) => {
                  const isBlocked =
                    intrusionMap[gn.node_id].blocked_ips.includes(att.ip);
                  return (
                    <div
                      key={att.ip}
                      className="flex items-center justify-between rounded border border-nb-gray-800/80 bg-nb-gray-940/70 px-2 py-1 font-mono text-[9px]"
                    >
                      <span className="text-nb-gray-200 truncate">
                        {att.ip}{" "}
                        <span className="text-red-400">({att.attempts}x)</span>
                      </span>
                      <button
                        type="button"
                        disabled={
                          isBlocked ||
                          intrusionBusyNode === `${gn.node_id}:${att.ip}` ||
                          authRole === "operator"
                        }
                        onClick={() => onBlockAttackerIp(gn.node_id, att.ip)}
                        className={`rounded px-1.5 py-0.5 text-[8.5px] font-semibold transition ${
                          isBlocked
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30"
                            : "bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30"
                        }`}
                      >
                        {isBlocked
                          ? t("Gesperrt", "Blocked")
                          : t("Sperren", "Block")}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div
          data-canvas-scroll-zone="true"
          className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5"
        >
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] leading-none uppercase tracking-wider text-nb-gray-300">
              <KeyRound className="h-3 w-3 shrink-0 text-sky-400" />
              <span>
                {t(
                  "Offsite Core-Backups (AES-256)",
                  "Offsite Core Backups (AES-256)"
                )}
              </span>
            </span>
            <button
              type="button"
              disabled={backupBusyId === "create" || authRole === "operator"}
              onClick={() => onCreateOffsiteBackup(gn.node_id)}
              className="inline-flex items-center justify-center gap-1 rounded border border-sky-500/40 bg-sky-500/15 px-2 py-1 font-mono text-[9px] leading-none font-semibold text-sky-300 hover:bg-sky-500/25 disabled:opacity-50 transition"
            >
              <Plus className="h-2.5 w-2.5 shrink-0" />
              <span>
                {backupBusyId === "create"
                  ? t("Verschlüsselt...", "Encrypting...")
                  : t("Core-Backup", "Core Backup")}
              </span>
            </button>
          </div>
          {backupNotice && (
            <div className="rounded bg-emerald-950/70 border border-emerald-500/40 px-2 py-1 text-[9.5px] text-emerald-300">
              {backupNotice}
            </div>
          )}
          <div className="space-y-1 max-h-28 overflow-y-auto pr-0.5 overscroll-contain">
            {offsiteBackups
              .filter((b) => b.node_id === gn.node_id)
              .map((bkp) => (
                <div
                  key={bkp.id}
                  className="flex items-center justify-between gap-1.5 rounded border border-nb-gray-800/80 bg-nb-gray-940/70 px-2 py-1 text-[9.5px]"
                >
                  <div className="min-w-0">
                    <div
                      className="truncate font-medium text-nb-gray-200"
                      title={translateText(bkp.title)}
                    >
                      {translateText(
                        bkp.title.replace("Offsite Core Backup ", "Backup ")
                      )}
                    </div>
                    <div className="font-mono text-[8.5px] text-nb-gray-400">
                      {new Date(bkp.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {(bkp.size_bytes / 1024).toFixed(1)} KB · SHA:
                      {bkp.sha256.slice(0, 8)}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={
                      backupBusyId === bkp.id || authRole === "operator"
                    }
                    onClick={() => onRestoreOffsiteBackup(bkp)}
                    className="shrink-0 rounded border border-sky-500/40 bg-sky-500/15 px-1.5 py-0.5 font-mono text-[8.5px] font-semibold text-sky-300 hover:bg-sky-500/25 disabled:opacity-50"
                  >
                    {backupBusyId === bkp.id ? "..." : t("Restore", "Restore")}
                  </button>
                </div>
              ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectNode(gn.node_id);
              onOpenPty();
            }}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-netbird py-1.5 text-[11px] font-medium text-white hover:bg-netbird-500 transition"
          >
            <TerminalIcon className="h-3 w-3" />
            <span>{t("Terminal", "Terminal")}</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectNode(gn.node_id);
              onOpenRemoteFiles();
            }}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-nb-gray-800 bg-nb-gray-950 py-1.5 text-[11px] text-nb-gray-200 hover:text-white transition"
          >
            <Code2 className="h-3 w-3 text-sky-400" />
            <span>{t("Dateien", "Files")}</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectNode(gn.node_id);
              onOpenFirewall?.(gn.node_id);
            }}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
          >
            <Shield className="h-3 w-3 text-emerald-400" />
            <span>{t("Firewall", "Firewall")}</span>
          </button>
        </div>
      </div>
    );
  }
);
