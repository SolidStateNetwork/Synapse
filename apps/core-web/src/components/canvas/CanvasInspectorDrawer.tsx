"use client";

import React from "react";
import {
  Activity,
  ArrowLeftRight,
  Bot,
  ChevronRight,
  Code2,
  Cpu,
  FileText,
  Globe,
  History,
  KeyRound,
  Link2,
  Lock,
  Plus,
  Server,
  Shield,
  Sparkles,
  Terminal as TerminalIcon,
  Wrench,
  Zap,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type {
  BlueprintItem,
  CanvasEdge,
  CanvasPos,
  CartridgeMeta,
  ChaosResultState,
  CheckpointItem,
  DomainBindingItem,
  GatewayNode,
  InteractiveControlCenterCanvasProps,
  IntrusionScanState,
  NodeHeartbeat,
  OffsiteBackupItem,
  RegisteredService,
  ServiceMeshLink,
  TelemetrySample,
} from "@/components/canvas/canvasTypes";

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

export function CanvasEdgesLayer({
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
          const x1 = p1.x + w1;
          const y1 = p1.y + 31;
          const x2 = p2.x + w2;
          const y2 = p2.y + 31;

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

          const badgeW = Math.max(
            68,
            Math.round(link.protocol.length * 5.8 + 16)
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
            protocol: link.protocol,
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
}

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

export function MuscleNodeInspectorPanel({
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

export interface CoreHubInspectorPanelProps {
  modelName: string;
  baseUrl: string;
  authEnabled: boolean;
  authRole: "admin" | "operator";
  activeCartridges: string[];
  cartridges: CartridgeMeta[];
  secretKeysCount: number;
  blueprints: BlueprintItem[];
  blueprintBusyId: string | null;
  blueprintNotice: string | null;
  allServices: RegisteredService[];
  onOpenSettings?: (focusSection?: string) => void;
  onOpenBrainDoc: (doc: "Architecture.md" | "Memory.md") => void;
  onToggleCartridge: (id: string) => void;
  onDeployBlueprint: (bp: BlueprintItem, action: "deploy" | "undeploy") => void;
  onOpenAiSettings: () => void;
  onOpenSecretsVault: () => void;
  onOpenAccessControl: () => void;
}

export function CoreHubInspectorPanel({
  modelName,
  baseUrl,
  authEnabled,
  authRole,
  activeCartridges,
  cartridges,
  secretKeysCount,
  blueprints,
  blueprintBusyId,
  blueprintNotice,
  allServices,
  onOpenSettings,
  onOpenBrainDoc,
  onToggleCartridge,
  onDeployBlueprint,
  onOpenAiSettings,
  onOpenSecretsVault,
  onOpenAccessControl,
}: CoreHubInspectorPanelProps) {
  const { t, translateText } = useI18n();

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-3 space-y-2.5 border-t border-nb-gray-800/90 pt-2.5 text-[11px]"
    >
      {/* 1. CLEAN KEY-VALUE OVERVIEW BOX */}
      <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-nb-gray-400">
          <span>{t("Aktives KI-Modell", "Active AI Model")}</span>
          <span className="font-mono text-[10.5px] font-semibold text-netbird">
            {modelName}
          </span>
        </div>
        <div className="flex items-center justify-between text-nb-gray-400 gap-2">
          <span className="shrink-0">
            {t("API-Endpunkt", "API Endpoint")}
          </span>
          <span className="truncate font-mono text-[10px] text-nb-gray-300">
            {baseUrl.replace(/^https?:\/\//, "")}
          </span>
        </div>
        <div className="flex items-center justify-between text-nb-gray-400">
          <span>{t("Wächter & Alarme", "Watchdog & Alerts")}</span>
          <button
            type="button"
            onClick={() => onOpenSettings?.("watchdog-rbac")}
            className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
          >
            <span>
              {authEnabled
                ? t("RBAC aktiv", "RBAC active")
                : t("Konfigurieren", "Configure")}
            </span>
          </button>
        </div>
        <div className="pt-1 border-t border-nb-gray-800/70 flex items-center justify-between gap-2">
          <span className="text-nb-gray-400 shrink-0">
            {t("Brain-Dokumente", "Brain Docs")}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onOpenBrainDoc("Architecture.md")}
              className="rounded border border-nb-gray-800 bg-nb-gray-900 px-2 py-0.5 font-mono text-[9.5px] text-nb-gray-200 hover:border-netbird hover:text-white transition"
            >
              Arch.md
            </button>
            <button
              type="button"
              onClick={() => onOpenBrainDoc("Memory.md")}
              className="rounded border border-nb-gray-800 bg-nb-gray-900 px-2 py-0.5 font-mono text-[9.5px] text-nb-gray-200 hover:border-netbird hover:text-white transition"
            >
              Memory.md
            </button>
          </div>
        </div>
      </div>

      {/* 2. SECURITY CARTRIDGES TOGGLE LIST */}
      <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] leading-none uppercase tracking-wider text-nb-gray-300">
            <Shield className="h-3 w-3 shrink-0 text-emerald-400" />
            <span>{t("Sicherheits-Cartridges", "Security Cartridges")}</span>
          </span>
          <span className="font-mono text-[9px] leading-none text-emerald-400">
            {activeCartridges.length}/{cartridges.length} {t("aktiv", "active")}
          </span>
        </div>
        <div className="space-y-1">
          {cartridges.map((c) => {
            const enabled = activeCartridges.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onToggleCartridge(c.id)}
                className="flex w-full items-center justify-between rounded border border-nb-gray-800/80 bg-nb-gray-940/70 px-2 py-1 text-[10px] hover:border-nb-gray-700 transition"
              >
                <span className="truncate text-nb-gray-200 pr-2">
                  {translateText(c.name)}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[8.5px] font-semibold ${
                    enabled
                      ? "border border-emerald-500/30 bg-emerald-950 text-emerald-400"
                      : "bg-nb-gray-900 text-nb-gray-500"
                  }`}
                >
                  {enabled ? t("AKTIV", "ON") : t("AUS", "OFF")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. 1-CLICK BLUEPRINT CATALOG */}
      {blueprints.length > 0 && (
        <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] leading-none uppercase tracking-wider text-nb-gray-300">
              <Sparkles className="h-3 w-3 shrink-0 text-sky-400" />
              <span>{t("1-Click Blueprints", "1-Click Blueprints")}</span>
            </span>
            <span className="font-mono text-[9px] leading-none text-nb-gray-400">
              {blueprints.length} {t("Vorlagen", "Templates")}
            </span>
          </div>
          {blueprintNotice && (
            <div className="rounded bg-emerald-950/70 border border-emerald-500/40 px-2 py-1 text-[9.5px] text-emerald-300">
              {blueprintNotice}
            </div>
          )}
          <div className="space-y-1">
            {blueprints.map((bp) => {
              const isDeployed = allServices.some(
                (s) => s.service_id === bp.id || s.port === bp.port
              );
              return (
                <div
                  key={bp.id}
                  className="flex items-center justify-between gap-1.5 rounded border border-nb-gray-800/80 bg-nb-gray-940/70 px-2 py-1 text-[9.5px]"
                >
                  <div className="min-w-0 flex-1 pr-1">
                    <div className="truncate font-medium text-nb-gray-200">
                      {translateText(bp.name)}
                    </div>
                    <div className="truncate text-[8.5px] text-nb-gray-400">
                      {translateText(bp.description)}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={
                      blueprintBusyId === bp.id || authRole === "operator"
                    }
                    onClick={() =>
                      onDeployBlueprint(
                        bp,
                        isDeployed ? "undeploy" : "deploy"
                      )
                    }
                    className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[8.5px] font-semibold transition ${
                      isDeployed
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40"
                        : "border-sky-500/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25"
                    } disabled:opacity-50`}
                  >
                    {blueprintBusyId === bp.id
                      ? "..."
                      : isDeployed
                      ? t("Stoppen", "Stop")
                      : t("Starten", "Deploy")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. UNIFIED 3-BUTTON FOOTER BAR */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenAiSettings}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-netbird py-1.5 text-[11px] font-medium text-white hover:bg-netbird-500 transition"
        >
          <Bot className="h-3 w-3" />
          <span>{t("KI-Modell", "AI Model")}</span>
        </button>
        <button
          type="button"
          onClick={onOpenSecretsVault}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-nb-gray-800 bg-nb-gray-950 py-1.5 text-[11px] text-nb-gray-200 hover:text-white transition"
        >
          <KeyRound className="h-3 w-3 text-amber-400" />
          <span>
            {t(`Tresor (${secretKeysCount})`, `Vault (${secretKeysCount})`)}
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenAccessControl}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
        >
          <Shield className="h-3 w-3 text-emerald-400" />
          <span>{t("Regeln", "Rules")}</span>
        </button>
      </div>
    </div>
  );
}

export interface ServiceNodeInspectorPanelProps {
  svc: RegisteredService;
  allServices: RegisteredService[];
  serviceLinks: ServiceMeshLink[];
  domainBindings: Record<string, DomainBindingItem>;
  domainEditorOpen: Record<string, boolean>;
  domainInputMap: Record<string, string>;
  domainNoticeMap: Record<string, string>;
  serviceLogsMap: Record<
    string,
    { lines: string[]; errorCount: number; open: boolean }
  >;
  logBusyId: string | null;
  chaosBusyId: string | null;
  chaosResultMap: Record<string, ChaosResultState>;
  authRole: "admin" | "operator";
  onOpenReverseProxy: (port: number) => void;
  onHealService: (port: number) => void;
  onToggleServiceLink: (fromId: string, toId: string) => void;
  onTailServiceLogs: (svc: RegisteredService) => void;
  onToggleDomainEditor: (serviceId: string) => void;
  onChangeDomainInput: (serviceId: string, value: string) => void;
  onSaveServiceDomain: (svc: RegisteredService) => void;
  onRunChaosTest: (svc: RegisteredService) => void;
}

export function ServiceNodeInspectorPanel({
  svc,
  allServices,
  serviceLinks,
  domainBindings,
  domainEditorOpen,
  domainInputMap,
  domainNoticeMap,
  serviceLogsMap,
  logBusyId,
  chaosBusyId,
  chaosResultMap,
  authRole,
  onOpenReverseProxy,
  onHealService,
  onToggleServiceLink,
  onTailServiceLogs,
  onToggleDomainEditor,
  onChangeDomainInput,
  onSaveServiceDomain,
  onRunChaosTest,
}: ServiceNodeInspectorPanelProps) {
  const { t, translateText } = useI18n();

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-3 space-y-2.5 border-t border-nb-gray-800/90 pt-2.5 text-[11px]"
    >
      {/* FEATURE 1: AUTO-DISCOVERY RUNTIME & CONTAINER BADGES */}
      <div className="flex flex-wrap items-center gap-1.5">
        {svc.auto_discovered && (
          <span className="inline-flex items-center justify-center rounded border border-sky-500/40 bg-sky-500/15 px-1.5 py-1 font-mono text-[9px] leading-none font-semibold text-sky-300">
            {t("AUTO-ERKANNT", "AUTO-DISCOVERED")}
          </span>
        )}
        {svc.container_name && (
          <span className="inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/15 px-1.5 py-1 font-mono text-[9px] leading-none text-sky-300 truncate max-w-[180px]">
            <Server className="h-2.5 w-2.5 shrink-0 text-sky-400" />
            <span className="truncate">{svc.container_name}</span>
          </span>
        )}
        {svc.process_name && (
          <span className="inline-flex items-center gap-1 rounded border border-nb-gray-700 bg-nb-gray-950 px-1.5 py-1 font-mono text-[9px] leading-none text-nb-gray-300">
            <Cpu className="h-2.5 w-2.5 shrink-0 text-nb-gray-400" />
            <span>{svc.process_name}</span>
          </span>
        )}
        {domainBindings[svc.service_id]?.domain && (
          <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-1 font-mono text-[9px] leading-none text-emerald-300 truncate max-w-[200px]">
            <Lock className="h-2.5 w-2.5 shrink-0 text-emerald-400" />
            <span className="truncate">
              https://{domainBindings[svc.service_id].domain}
            </span>
          </span>
        )}
      </div>

      {svc.description && (
        <p className="text-[11px] text-nb-gray-300 leading-relaxed">
          {translateText(svc.description)}
        </p>
      )}

      {svc.endpoints && svc.endpoints.length > 0 && (
        <div className="space-y-1">
          <div className="font-mono text-[9.5px] uppercase tracking-wider text-nb-gray-400">
            {t(
              "Verfügbare Aktionen & Endpunkte",
              "Available Actions & Endpoints"
            )}
          </div>
          {svc.endpoints.map((ep) => (
            <button
              key={ep.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenReverseProxy(svc.port);
              }}
              className="flex w-full items-center justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1.5 text-[10.5px] text-nb-gray-200 hover:border-sky-400 transition"
            >
              <span className="truncate">
                <strong className="font-mono text-netbird mr-1.5">
                  {ep.method}
                </strong>
                {translateText(ep.label)
                  .replace(new RegExp(`^${ep.method}\\s+`, "i"), "")
                  .trim()}
              </span>
              <ChevronRight className="h-3 w-3 shrink-0 text-nb-gray-500" />
            </button>
          ))}
        </div>
      )}

      {/* FEATURE 6: SERVICE-TO-SERVICE MESH LINKS */}
      {allServices.length > 1 && (
        <div className="space-y-2 rounded-lg border border-nb-gray-800/80 bg-nb-gray-950 p-2.5">
          <div className="flex items-center gap-1.5 font-mono text-[9.5px] leading-none uppercase tracking-wider text-sky-300">
            <Link2 className="h-3 w-3 shrink-0 text-sky-400" />
            <span>
              {t(
                "Service-Mesh Datenfluss-Verbindungen",
                "Service-Mesh Data Flow Links"
              )}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allServices
              .filter((other) => other.service_id !== svc.service_id)
              .map((other) => {
                const linked = serviceLinks.some(
                  (l) =>
                    l.fromServiceId === svc.service_id &&
                    l.toServiceId === other.service_id
                );
                return (
                  <button
                    key={other.service_id}
                    type="button"
                    onClick={() =>
                      onToggleServiceLink(svc.service_id, other.service_id)
                    }
                    className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[9.5px] leading-none transition ${
                      linked
                        ? "border-sky-500/60 bg-sky-500/20 text-sky-200 font-medium"
                        : "border-nb-gray-800 bg-nb-gray-900 text-nb-gray-300 hover:border-nb-gray-700 hover:text-white"
                    }`}
                  >
                    {linked ? (
                      <ArrowLeftRight className="h-2.5 w-2.5 shrink-0 text-sky-300" />
                    ) : (
                      <Plus className="h-2.5 w-2.5 shrink-0 text-nb-gray-400" />
                    )}
                    <span className="leading-none">
                      {translateText(other.name)}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* ROUND-2 FEATURES 2, 5, 6: LIVE-LOGS TAIL, CUSTOM DOMAIN/TLS & CHAOS-TEST */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          disabled={logBusyId === svc.service_id}
          onClick={() => onTailServiceLogs(svc)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-950 py-1.5 font-mono text-[9.5px] leading-none text-nb-gray-200 hover:border-sky-400 hover:text-white transition"
        >
          <FileText className="h-3 w-3 shrink-0 text-sky-400" />
          <span>
            {logBusyId === svc.service_id
              ? "..."
              : t("Live-Logs", "Live Logs")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onToggleDomainEditor(svc.service_id)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-950 py-1.5 font-mono text-[9.5px] leading-none text-nb-gray-200 hover:border-emerald-400 hover:text-white transition"
        >
          <Lock className="h-3 w-3 shrink-0 text-emerald-400" />
          <span>{t("Domain/TLS", "Domain/TLS")}</span>
        </button>
        <button
          type="button"
          disabled={
            chaosBusyId === svc.service_id || authRole === "operator"
          }
          onClick={() => onRunChaosTest(svc)}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 py-1.5 font-mono text-[9.5px] leading-none font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50 transition"
        >
          <Zap className="h-3 w-3 shrink-0 text-amber-400" />
          <span>
            {chaosBusyId === svc.service_id
              ? "..."
              : t("Chaos-Test", "Chaos Test")}
          </span>
        </button>
      </div>

      {/* ROUND-2 FEATURE 2: INLINE LIVE LOGS TAIL CONSOLE */}
      {serviceLogsMap[svc.service_id]?.open && (
        <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 font-mono text-[9px] space-y-1">
          <div className="flex items-center justify-between text-nb-gray-400">
            <span>{t("Letzte Log-Zeilen", "Recent Log Lines")}</span>
            <span
              className={
                serviceLogsMap[svc.service_id].errorCount > 0
                  ? "text-red-400 font-semibold"
                  : "text-emerald-400"
              }
            >
              {serviceLogsMap[svc.service_id].errorCount}{" "}
              {t("Fehler", "Errors")}
            </span>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-0.5 rounded bg-black/50 p-1.5 text-[8.5px] text-nb-gray-300 overscroll-contain">
            {serviceLogsMap[svc.service_id].lines
              .slice(-40)
              .map((line, idx) => (
                <div
                  key={idx}
                  className={`truncate ${
                    /error|fail|exception|panic/i.test(line)
                      ? "text-red-400"
                      : "text-nb-gray-300"
                  }`}
                >
                  {line}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ROUND-2 FEATURE 5: INLINE CUSTOM DOMAIN & AUTO-HTTPS EDITOR */}
      {domainEditorOpen[svc.service_id] && (
        <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5 text-[10px]">
          <div className="flex items-center justify-between font-mono text-[9px] text-nb-gray-400">
            <span>
              {t(
                "Custom Domain & Auto-HTTPS",
                "Custom Domain & Auto-HTTPS"
              )}
            </span>
            <span className="text-emerald-400">TLS 1.3</span>
          </div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={
                domainInputMap[svc.service_id] ??
                domainBindings[svc.service_id]?.domain ??
                `${svc.service_id}.synapse.local`
              }
              onChange={(e) =>
                onChangeDomainInput(svc.service_id, e.target.value)
              }
              placeholder="app.example.com"
              className="flex-1 rounded border border-nb-gray-800 bg-nb-gray-940 px-2 py-1 font-mono text-[9.5px] text-white"
            />
            <button
              type="button"
              onClick={() => onSaveServiceDomain(svc)}
              className="rounded bg-emerald-600 px-2 py-1 font-mono text-[9px] font-semibold text-white hover:bg-emerald-500 transition"
            >
              {t("Speichern", "Save")}
            </button>
          </div>
          {domainNoticeMap[svc.service_id] && (
            <div className="text-[9px] text-emerald-400 font-mono">
              {domainNoticeMap[svc.service_id]}
            </div>
          )}
        </div>
      )}

      {/* ROUND-2 FEATURE 6: INLINE CHAOS-ENGINEERING RESILIENCE STOPWATCH REPORT */}
      {chaosResultMap[svc.service_id] && (
        <div className="rounded-lg border border-amber-500/40 bg-nb-gray-950 p-2 space-y-1 font-mono text-[9px]">
          <div className="flex items-center justify-between">
            <span className="text-amber-300 font-semibold">
              ⚡ {t("Resilienz-Test", "Resilience Test")}
            </span>
            <span className="rounded bg-emerald-950 border border-emerald-500/40 px-1.5 py-0.5 text-[8.5px] text-emerald-300">
              MTTR: {chaosResultMap[svc.service_id].mttr_ms} ms
            </span>
          </div>
          {chaosResultMap[svc.service_id].steps.map((st, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-[8.5px] text-nb-gray-300"
            >
              <span className="truncate pr-1">✔ {translateText(st.step)}</span>
              <span className="text-nb-gray-400 shrink-0">
                {st.elapsed_ms} ms
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5 pt-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenReverseProxy(svc.port);
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-netbird py-2 text-[11px] font-medium text-white hover:bg-netbird-500 transition"
        >
          <Globe className="h-3.5 w-3.5" />
          <span>
            {t("Vorschau & Tester öffnen", "Open Preview & Tester")}
          </span>
        </button>
        {svc.healthy === false && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onHealService(svc.port);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-600 py-1.5 text-[11px] font-medium text-white hover:bg-red-500 transition"
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>{t("Auto-Heal starten", "Start Auto-Heal")}</span>
          </button>
        )}
      </div>
    </div>
  );
}
