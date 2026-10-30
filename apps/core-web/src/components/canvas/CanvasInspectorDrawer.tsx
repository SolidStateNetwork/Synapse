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
  CanvasEdge,
  CanvasPos,
  CheckpointItem,
  GatewayNode,
  InteractiveControlCenterCanvasProps,
  IntrusionScanState,
  NodeHeartbeat,
  OffsiteBackupItem,
  ServiceMeshLink,
  TelemetrySample,
} from "@/components/canvas/canvasTypes";

export {
  CoreHubInspectorPanel,
  type CoreHubInspectorPanelProps,
  ServiceNodeInspectorPanel,
  type ServiceNodeInspectorPanelProps,
} from "@/components/canvas/CanvasCoreAndServicePanels";

export interface CanvasEdgesLayerProps {
  pan: CanvasPos;
  zoom: number;
  edges: CanvasEdge[];
  hoveredNodeId: string | null;
  getEdgeCoords: (
    fromId: string,
    toId: string
  ) => { x1: number; y1: number; x2: number; y2: number; d: string };
  serviceLinks: ServiceMeshLink[];
  effectivePositions: Record<string, CanvasPos>;
  customDims: Record<string, { w: number; minH?: number }>;
  sizes: Record<string, { w: number; h: number }>;
  defaultNodeW: number;
}

export const CanvasEdgesLayer = React.memo(function CanvasEdgesLayer({
  pan,
  zoom,
  edges,
  hoveredNodeId,
  getEdgeCoords,
  serviceLinks,
  effectivePositions,
  customDims,
  sizes,
  defaultNodeW,
}: CanvasEdgesLayerProps) {
  return (
    <svg
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
      style={{
        transform: `translate(${Math.round(pan.x)}px, ${Math.round(pan.y)}px) scale(${zoom})`,
        transformOrigin: "0 0",
        zIndex: 1,
      }}
      className="pointer-events-none absolute left-0 top-0 h-[1000px] w-[1400px] overflow-visible"
    >
      {(() => {
        const renderedPorts = new Set<string>();
        return edges.map((edge, idx) => {
          const { x1, y1, x2, y2, d } = getEdgeCoords(edge.from, edge.to);
          const isHovered = Boolean(
            hoveredNodeId &&
              (edge.from === hoveredNodeId || edge.to === hoveredNodeId)
          );
          const isPeerEdge =
            edge.from === "core:hub" || edge.to === "core:hub";
          const secondaryColor = isPeerEdge ? "#f68330" : "#38bdf8";

          // Keep durations & delays 100% invariant across hover states so particles NEVER jump
          const staggerSec = ((idx * 0.77) % 3.1).toFixed(2);
          const reverseStaggerSec = (((idx + 2) * 1.15) % 3.9).toFixed(2);
          const forwardDur = `${(3.2 + (idx % 3) * 0.42).toFixed(2)}s`;
          const reverseDur = `${(4.4 + (idx % 2) * 0.55).toFixed(2)}s`;

          const port1Key = `${Math.round(x1)},${Math.round(y1)}`;
          const port2Key = `${Math.round(x2)},${Math.round(y2)}`;
          const drawPort1 = !renderedPorts.has(port1Key);
          const drawPort2 = !renderedPorts.has(port2Key);
          renderedPorts.add(port1Key);
          renderedPorts.add(port2Key);

          return (
            <g
              key={edge.id}
              style={{
                opacity: isHovered ? 1 : edge.active ? 0.92 : 0.3,
                transition: "opacity 180ms ease",
              }}
            >
              {/* 1. Ambient Outer Glow Conduit (Pure Vector — Zero Filter Lag) */}
              <path
                d={d}
                fill="none"
                stroke={edge.color}
                strokeOpacity={isHovered ? 0.28 : 0.09}
                strokeWidth={isHovered ? 8 : 5}
                strokeLinecap="round"
                style={{
                  transition: "stroke-opacity 180ms ease, stroke-width 180ms ease",
                }}
              />

              {/* 2. Solid Grounded Base Track */}
              <path
                d={d}
                fill="none"
                stroke={edge.color}
                strokeOpacity={isHovered ? 0.55 : 0.24}
                strokeWidth={isHovered ? 2.2 : 1.5}
                strokeLinecap="round"
                style={{
                  transition: "stroke-opacity 180ms ease, stroke-width 180ms ease",
                }}
              />

              {/* 3. Continuous Flowing Stream Wave (GPU CSS Keyframes) */}
              {edge.active && (
                <path
                  d={d}
                  fill="none"
                  stroke={edge.color}
                  strokeOpacity={isHovered ? 0.95 : 0.62}
                  strokeWidth={isHovered ? 2.1 : 1.6}
                  strokeLinecap="round"
                  strokeDasharray="6 10"
                  className="cc-animated-edge"
                  style={{
                    transition: "stroke-opacity 180ms ease, stroke-width 180ms ease",
                  }}
                />
              )}

              {/* 4. Traveling Energy Streak (Dual-Layer Vector Comet — Zero Filter Lag) */}
              {edge.active && (
                <g>
                  <path
                    d={d}
                    fill="none"
                    stroke={secondaryColor}
                    strokeOpacity={isHovered ? 0.35 : 0.2}
                    strokeWidth={isHovered ? 6.5 : 5}
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray="11 110"
                    className="synapse-comet-path"
                    style={{
                      animationDuration: forwardDur,
                      animationDelay: `-${staggerSec}s`,
                    }}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={secondaryColor}
                    strokeOpacity={isHovered ? 0.98 : 0.82}
                    strokeWidth={isHovered ? 2.6 : 2}
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray="11 110"
                    className="synapse-comet-path"
                    style={{
                      animationDuration: forwardDur,
                      animationDelay: `-${staggerSec}s`,
                    }}
                  />
                </g>
              )}

              {/* 5. Primary Forward Data Packet (GPU CSS Motion Path + Concentric Vector Glow) */}
              {edge.active && (
                <g
                  className="synapse-packet-fwd"
                  style={{
                    offsetPath: `path("${d}")`,
                    animationDuration: forwardDur,
                    animationDelay: `-${staggerSec}s`,
                  }}
                >
                  <circle
                    r={isHovered ? 8.5 : 7}
                    fill={edge.color}
                    fillOpacity={isHovered ? 0.26 : 0.16}
                  />
                  <circle
                    r={isHovered ? 4.8 : 4}
                    fill={edge.color}
                    fillOpacity={isHovered ? 0.65 : 0.48}
                  />
                  <circle r={isHovered ? 2.4 : 2} fill="#ffffff" />
                </g>
              )}

              {/* 6. Bi-Directional Return / Telemetry Heartbeat Pulse (Reverse GPU CSS Motion Path) */}
              {edge.active && (
                <g
                  className="synapse-packet-rev"
                  style={{
                    offsetPath: `path("${d}")`,
                    animationDuration: reverseDur,
                    animationDelay: `-${reverseStaggerSec}s`,
                  }}
                >
                  <circle
                    r={isHovered ? 6 : 5}
                    fill={secondaryColor}
                    fillOpacity={isHovered ? 0.28 : 0.18}
                  />
                  <circle
                    r={isHovered ? 2.6 : 2.1}
                    fill={secondaryColor}
                    fillOpacity={0.95}
                  />
                </g>
              )}

              {/* 7. Deduplicated Port Socket Rings (Drawn Once per Unique Port Coordinate) */}
              {drawPort1 && (
                <g>
                  {edge.active && (
                    <circle
                      cx={x1}
                      cy={y1}
                      r={3.8}
                      fill="none"
                      stroke={edge.color}
                      strokeWidth={1.2}
                      className="synapse-port-ring"
                      style={{ animationDelay: `-${staggerSec}s` }}
                    />
                  )}
                  <circle
                    cx={x1}
                    cy={y1}
                    r={3.6}
                    fill="#181a1d"
                    stroke={edge.color}
                    strokeWidth={2}
                  />
                  <circle cx={x1} cy={y1} r={1.5} fill={edge.color} />
                </g>
              )}

              {drawPort2 && (
                <g>
                  {edge.active && (
                    <circle
                      cx={x2}
                      cy={y2}
                      r={3.8}
                      fill="none"
                      stroke={edge.color}
                      strokeWidth={1.2}
                      className="synapse-port-ring"
                      style={{ animationDelay: `-${reverseStaggerSec}s` }}
                    />
                  )}
                  <circle
                    cx={x2}
                    cy={y2}
                    r={3.6}
                    fill="#181a1d"
                    stroke={edge.color}
                    strokeWidth={2}
                  />
                  <circle cx={x2} cy={y2} r={1.5} fill={edge.color} />
                </g>
              )}
            </g>
          );
        });
      })()}

      {/* FEATURE 6: SERVICE-TO-SERVICE MESH DATA-FLOW ARCS */}
      {(() => {
        const labelItems: Array<{
          id: string;
          midX: number;
          midY: number;
          badgeW: number;
          protocol: string;
          isHovered: boolean;
        }> = [];
        const usedYs: number[] = [];

        const sortedLinks = [...serviceLinks].sort((a, b) => {
          const pa1 = effectivePositions[`svc:${a.fromServiceId}`];
          const pa2 = effectivePositions[`svc:${a.toServiceId}`];
          const pb1 = effectivePositions[`svc:${b.fromServiceId}`];
          const pb2 = effectivePositions[`svc:${b.toServiceId}`];
          const spanA = pa1 && pa2 ? Math.abs(pa2.y - pa1.y) : 0;
          const spanB = pb1 && pb2 ? Math.abs(pb2.y - pb1.y) : 0;
          return spanA - spanB;
        });

        const arcElements = sortedLinks.map((link, lIdx) => {
          const fromKey = `svc:${link.fromServiceId}`;
          const toKey = `svc:${link.toServiceId}`;
          const p1 = effectivePositions[fromKey];
          const p2 = effectivePositions[toKey];
          if (!p1 || !p2) return null;

          const w1 =
            customDims[fromKey]?.w || sizes[fromKey]?.w || defaultNodeW;
          const w2 =
            customDims[toKey]?.w || sizes[toKey]?.w || defaultNodeW;
          const h1 =
            sizes[fromKey]?.h && sizes[fromKey].h <= 80
              ? sizes[fromKey].h
              : 58;
          const h2 =
            sizes[toKey]?.h && sizes[toKey].h <= 80 ? sizes[toKey].h : 58;
          const x1 = p1.x + w1;
          const y1 = p1.y + h1 / 2;
          const x2 = p2.x + w2;
          const y2 = p2.y + h2 / 2;

          const baseRightX = Math.max(x1, x2);
          const arcOffset = 78 + lIdx * 28;
          const ctrlX = baseRightX + arcOffset;
          const d = `M ${x1} ${y1} C ${ctrlX} ${y1}, ${ctrlX} ${y2}, ${x2} ${y2}`;

          const evalBezier = (tParam: number) => {
            const u = 1 - tParam;
            const bx =
              u * u * u * x1 +
              3 * u * u * tParam * ctrlX +
              3 * u * tParam * tParam * ctrlX +
              tParam * tParam * tParam * x2;
            const by =
              u * u * u * y1 +
              3 * u * u * tParam * y1 +
              3 * u * tParam * tParam * y2 +
              tParam * tParam * tParam * y2;
            return { bx: Math.round(bx), by: Math.round(by) };
          };

          let chosenT = 0.5;
          let pt = evalBezier(chosenT);
          if (usedYs.some((uy) => Math.abs(uy - pt.by) < 34)) {
            const cand1 = evalBezier(0.32);
            const cand2 = evalBezier(0.68);
            const dist1 = Math.min(
              ...usedYs.map((uy) => Math.abs(uy - cand1.by))
            );
            const dist2 = Math.min(
              ...usedYs.map((uy) => Math.abs(uy - cand2.by))
            );
            pt = dist1 >= dist2 ? cand1 : cand2;
          }
          usedYs.push(pt.by);

          const labelText = `${link.protocol} · ${link.latency_ms ?? 1}ms`;
          const badgeW = Math.max(
            68,
            Math.round(labelText.length * 5.6 + 16)
          );
          const safeMidX = Math.max(
            pt.bx,
            baseRightX + Math.ceil(badgeW / 2) + 16
          );

          const isHovered =
            hoveredNodeId === fromKey || hoveredNodeId === toKey;

          labelItems.push({
            id: link.id,
            midX: safeMidX,
            midY: pt.by,
            badgeW,
            protocol: labelText,
            isHovered,
          });

          return (
            <g
              key={`arc-${link.id}`}
              style={{
                opacity: isHovered ? 1 : 0.78,
                transition: "opacity 180ms ease",
              }}
            >
              <path
                d={d}
                fill="none"
                stroke="#38bdf8"
                strokeOpacity={isHovered ? 0.35 : 0.14}
                strokeWidth={isHovered ? 6 : 3.5}
                strokeLinecap="round"
              />
              <path
                d={d}
                fill="none"
                stroke="#38bdf8"
                strokeOpacity={isHovered ? 0.95 : 0.65}
                strokeWidth={1.6}
                strokeDasharray="4 6"
                className="cc-animated-edge"
              />
              <g
                className="synapse-packet-fwd"
                style={{
                  offsetPath: `path("${d}")`,
                  animationDuration: `${(2.8 + lIdx * 0.4).toFixed(2)}s`,
                }}
              >
                <circle r={4.5} fill="#38bdf8" fillOpacity={0.45} />
                <circle r={2} fill="#e0f2fe" />
              </g>
            </g>
          );
        });

        return (
          <>
            {arcElements}
            {labelItems.map((lbl) => (
              <g
                key={`lbl-${lbl.id}`}
                transform={`translate(${lbl.midX}, ${lbl.midY})`}
                style={{
                  opacity: lbl.isHovered ? 1 : 0.96,
                  transition: "opacity 180ms ease",
                }}
              >
                <rect
                  x={-Math.round(lbl.badgeW / 2)}
                  y={-9}
                  width={lbl.badgeW}
                  height={18}
                  rx={6}
                  fill="#16181b"
                  stroke="#38bdf8"
                  strokeOpacity={0.65}
                  strokeWidth={1.1}
                />
                <text
                  x={0}
                  y={3}
                  textAnchor="middle"
                  fill="#bae6fd"
                  fontSize={8.5}
                  fontFamily="monospace"
                >
                  {lbl.protocol}
                </text>
              </g>
            ))}
          </>
        );
      })()}
    </svg>
  );
});

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
                      ? t(`${shieldedCount} gesperrt`, `${shieldedCount} shielded`)
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

        {/* MULTI-CORE TUNNEL TELEMETRY */}
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
          {Array.isArray(hb?.connected_cores) && hb.connected_cores.length > 0 && (
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
                      <span className="truncate">{coreDesc.split(" (")[0]}</span>
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

        {/* FEATURE 2: LIVE TIME-SERIES TELEMETRY SPARKLINES */}
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
                <svg className="mt-1 h-5 w-full overflow-visible" viewBox="0 0 72 22">
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
                <svg className="mt-1 h-5 w-full overflow-visible" viewBox="0 0 72 22">
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
                <svg className="mt-1 h-5 w-full overflow-visible" viewBox="0 0 72 22">
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

        {/* FEATURE 4: 1-CLICK SNAP & ROLLBACK TIME-MACHINE CHECKPOINTS */}
        <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] leading-none uppercase tracking-wider text-nb-gray-300">
              <History className="h-3 w-3 shrink-0 text-amber-400" />
              <span>{t("Time-Machine Checkpoints", "Time-Machine Checkpoints")}</span>
            </span>
            <button
              type="button"
              disabled={checkpointBusyId === "create" || authRole === "operator"}
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

        {/* ROUND-2 FEATURE 3: LIVE SSH-INTRUSION-RADAR & AUTO-ATTACKER BLOCKER */}
        <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5">
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

        {/* ROUND-2 FEATURE 4: AUTOMATED ENCRYPTED OFFSITE BACKUPS (AES-256-GCM) */}
        <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5">
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
                    <div className="truncate font-medium text-nb-gray-200">
                      {translateText(bkp.title)}
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
