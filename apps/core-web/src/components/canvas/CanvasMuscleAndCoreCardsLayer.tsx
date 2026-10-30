"use client";

import React from "react";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Server,
  Shield,
  Terminal,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type {
  BlueprintItem,
  CartridgeMeta,
  CheckpointItem,
  GatewayNode,
  InteractiveControlCenterCanvasProps,
  IntrusionScanState,
  OffsiteBackupItem,
  Point,
  RegisteredService,
  TelemetrySample,
} from "@/components/canvas/canvasTypes";
import {
  CoreHubInspectorPanel,
  MuscleNodeInspectorPanel,
} from "@/components/canvas/CanvasInspectorDrawer";
import {
  DEFAULT_NODE_W,
  MIN_NODE_W,
} from "@/components/canvas/useCanvasViewportAndLayout";

export interface CanvasMuscleAndCoreCardsLayerProps {
  peerNodesToRender: GatewayNode[];
  effectivePositions: Record<string, Point>;
  expandedNodes: Record<string, boolean>;
  customDims: Record<string, { w?: number; minH?: number }>;
  draggingNodeId: string | null;
  resizingNodeId: string | null;
  nodeRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  lastDragMovedRef: React.MutableRefObject<boolean>;
  startNodeDrag: (e: React.PointerEvent, nodeId: string) => void;
  setHoveredNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  toggleExpandNode: (nodeId: string, e?: React.MouseEvent) => void;
  renderResizeHandles: (nodeId: string, isExpanded: boolean) => React.ReactNode;
  onOpenAddPeer: () => void;
  onSelectNode: (id: string) => void;
  onOpenPty: () => void;
  onOpenFirewall?: (nodeId?: string) => void;
  onOpenRemoteFiles: () => void;
  firewallPolicies?: InteractiveControlCenterCanvasProps["firewallPolicies"];
  authRole: "admin" | "operator";
  checkpoints: CheckpointItem[];
  checkpointBusyId: string | null;
  checkpointNotice: string | null;
  handleCreateCheckpoint: (nodeId: string) => void;
  handleRollbackCheckpoint: (chk: CheckpointItem) => void;
  intrusionBusyNode: string | null;
  intrusionNotice: string | null;
  intrusionMap: Record<string, IntrusionScanState>;
  handleScanIntrusions: (nodeId: string) => void;
  handleBlockAttackerIp: (nodeId: string, ip: string) => void;
  backupBusyId: string | null;
  backupNotice: string | null;
  offsiteBackups: OffsiteBackupItem[];
  handleCreateOffsiteBackup: (nodeId: string) => void;
  handleRestoreOffsiteBackup: (bkp: OffsiteBackupItem) => void;
  modelName: string;
  baseUrl: string;
  authEnabled: boolean;
  activeCartridges: string[];
  cartridges: CartridgeMeta[];
  secretKeysCount: number;
  blueprints: BlueprintItem[];
  blueprintBusyId: string | null;
  blueprintNotice: string | null;
  allServices: RegisteredService[];
  onOpenSettings?: (tab?: string) => void;
  onOpenBrainDoc: (doc: "Architecture.md" | "Memory.md") => void;
  onToggleCartridge: (id: string) => void;
  handleDeployBlueprint: (bp: BlueprintItem, action: "deploy" | "undeploy") => void;
  onOpenAiSettings: () => void;
  onOpenSecretsVault: () => void;
  onOpenAccessControl: () => void;
}

export function CanvasMuscleAndCoreCardsLayer({
  peerNodesToRender,
  effectivePositions,
  expandedNodes,
  customDims,
  draggingNodeId,
  resizingNodeId,
  nodeRefs,
  lastDragMovedRef,
  startNodeDrag,
  setHoveredNodeId,
  toggleExpandNode,
  renderResizeHandles,
  onOpenAddPeer,
  onSelectNode,
  onOpenPty,
  onOpenFirewall,
  onOpenRemoteFiles,
  firewallPolicies,
  authRole,
  checkpoints,
  checkpointBusyId,
  checkpointNotice,
  handleCreateCheckpoint,
  handleRollbackCheckpoint,
  intrusionBusyNode,
  intrusionNotice,
  intrusionMap,
  handleScanIntrusions,
  handleBlockAttackerIp,
  backupBusyId,
  backupNotice,
  offsiteBackups,
  handleCreateOffsiteBackup,
  handleRestoreOffsiteBackup,
  modelName,
  baseUrl,
  authEnabled,
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
  handleDeployBlueprint,
  onOpenAiSettings,
  onOpenSecretsVault,
  onOpenAccessControl,
}: CanvasMuscleAndCoreCardsLayerProps) {
  const { t } = useI18n();

  return (
    <>
      {/* 1. MIDDLE: INTERACTIVE MUSCLE SERVER CARDS */}
      {peerNodesToRender.map((gn) => {
        const nodeKey =
          gn.node_id === "empty" ? "peer:empty" : `peer:${gn.node_id}`;
        const pos = effectivePositions[nodeKey] || { x: 460, y: 120 };
        const hb = gn.last_heartbeat;
        const isExpanded = Boolean(expandedNodes[nodeKey]);
        const tierNum =
          gn.tier === "TIER_1_UNLEASHED"
            ? "1"
            : gn.tier === "TIER_2_WORKSPACE_JAIL"
            ? "2"
            : "3";
        const history = hb?.telemetry_history || [];

        const buildSparklinePoints = (
          selector: (s: TelemetrySample) => number
        ) => {
          const rawPts =
            history.length >= 2
              ? history.slice(-16).map(selector)
              : [0.22, 0.31, 0.26, 0.38, 0.29, 0.34, 0.25, 0.33];
          const minVal = Math.min(...rawPts);
          const maxVal = Math.max(...rawPts);
          const span = maxVal - minVal;
          return rawPts
            .map((v, idx) => {
              const x = (idx / Math.max(1, rawPts.length - 1)) * 72;
              const norm =
                span > 0.02
                  ? (v - minVal) / span
                  : 0.45 + Math.sin(idx * 1.3) * 0.22;
              const y = 17 - norm * 12;
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
        };

        const nodeCheckpoints = checkpoints.filter(
          (c) => !c.node_id || c.node_id === gn.node_id
        );

        const customW = customDims[nodeKey]?.w || DEFAULT_NODE_W;
        const customMinH = customDims[nodeKey]?.minH;

        return (
          <div
            key={nodeKey}
            data-canvas-node-id={nodeKey}
            ref={(el) => {
              nodeRefs.current[nodeKey] = el;
            }}
            style={{
              left: `${Math.round(pos.x)}px`,
              top: `${Math.round(pos.y)}px`,
              width: `${customW}px`,
              minWidth: `${MIN_NODE_W}px`,
              minHeight:
                isExpanded && customMinH ? `${customMinH}px` : undefined,
              zIndex:
                draggingNodeId === nodeKey || resizingNodeId === nodeKey
                  ? 30
                  : isExpanded
                  ? 25
                  : 10,
            }}
            onPointerDown={(e) => startNodeDrag(e, nodeKey)}
            onMouseEnter={() => setHoveredNodeId(nodeKey)}
            onMouseLeave={() => setHoveredNodeId(null)}
            onClick={(e) => {
              e.stopPropagation();
              if (lastDragMovedRef.current) {
                lastDragMovedRef.current = false;
                return;
              }
              if (gn.node_id === "empty") {
                onOpenAddPeer();
              } else {
                onSelectNode(gn.node_id);
                toggleExpandNode(nodeKey, e);
              }
            }}
            className={`pointer-events-auto absolute rounded-xl border bg-nb-gray-940 px-4 py-3.5 shadow-lg transition-colors duration-150 ${
              draggingNodeId === nodeKey || resizingNodeId === nodeKey
                ? "cursor-grabbing ring-2 ring-netbird shadow-2xl"
                : "cursor-grab hover:border-nb-gray-700 hover:bg-nb-gray-930"
            } ${
              isExpanded
                ? "border-netbird/80 ring-1 ring-netbird/30 shadow-2xl"
                : "border-nb-gray-800"
            }`}
          >
            {renderResizeHandles(nodeKey, isExpanded)}
            {gn.node_id === "empty" ? (
              <div className="flex items-center justify-between text-xs">
                <span className="text-nb-gray-300">
                  {t("Kein Server verbunden", "No server connected")}
                </span>
                <span className="text-netbird font-medium">
                  {t("+ Verbinden", "+ Connect")}
                </span>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-nb-gray-800 bg-nb-gray-950 text-netbird">
                      <Server className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            gn.online ? "bg-emerald-400" : "bg-nb-gray-500"
                          }`}
                        />
                        <span className="truncate font-mono text-xs font-semibold text-white">
                          {gn.node_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="truncate text-[11px] text-nb-gray-400">
                          {hb?.private_ipv4 || "Online"} ·{" "}
                          {t(`Stufe ${tierNum}`, `Tier ${tierNum}`)}
                        </span>
                        {(hb?.active_cores ?? 1) > 1 ? (
                          <span
                            title={
                              (hb?.connected_cores || []).join("\n") ||
                              t(
                                "Mit mehreren Cores verbunden",
                                "Connected to multiple Cores"
                              )
                            }
                            className="shrink-0 inline-flex items-center gap-1 rounded border border-violet-500/40 bg-violet-950/90 px-1.5 py-0.2 font-mono text-[8.5px] font-semibold text-violet-300"
                          >
                            <span>{hb?.active_cores} Cores</span>
                          </span>
                        ) : (
                          <span
                            title={
                              (hb?.connected_cores || []).join("\n") ||
                              t("Aktiver Core-Tunnel", "Active Core tunnel")
                            }
                            className="shrink-0 rounded border border-emerald-500/30 bg-emerald-950/80 px-1.2 py-0.2 font-mono text-[8.5px] text-emerald-300"
                          >
                            1 Core
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => toggleExpandNode(nodeKey, e)}
                    title={
                      isExpanded
                        ? t("Details einklappen", "Collapse details")
                        : t(
                            "Details direkt im Knoten aufklappen",
                            "Expand details inside node"
                          )
                    }
                    className="rounded-md p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white focus:outline-none focus-visible:outline-none transition"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* v0.5.0: Compact 60s CPU/RAM Live Sparklines & Quick-Action Bar on Muscle Card */}
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2.5 flex items-center justify-between gap-2 border-t border-nb-gray-800/80 pt-2"
                >
                  <div className="flex items-center gap-2.5 font-mono text-[9.5px] text-nb-gray-400">
                    <span
                      className="inline-flex items-center gap-1"
                      title={t(
                        "60s Echtzeit-CPU-Verlauf",
                        "60s real-time CPU sparkline"
                      )}
                    >
                      <span className="text-nb-gray-300">
                        CPU {(hb?.cpu_percent ?? 0.2).toFixed(1)}%
                      </span>
                      <svg
                        width="36"
                        height="12"
                        viewBox="0 0 72 20"
                        className="overflow-visible"
                      >
                        <polyline
                          fill="none"
                          stroke="#34d399"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={buildSparklinePoints((s) => s.cpu)}
                        />
                      </svg>
                    </span>
                    <span
                      className="inline-flex items-center gap-1"
                      title={t(
                        "60s Echtzeit-RAM-Verlauf",
                        "60s real-time RAM sparkline"
                      )}
                    >
                      <span className="text-nb-gray-300">
                        RAM {(hb?.ram_percent ?? 2.3).toFixed(1)}%
                      </span>
                      <svg
                        width="36"
                        height="12"
                        viewBox="0 0 72 20"
                        className="overflow-visible"
                      >
                        <polyline
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={buildSparklinePoints((s) => s.ram)}
                        />
                      </svg>
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectNode(gn.node_id);
                        onOpenPty();
                      }}
                      title={t(
                        "1-Klick Live-Terminal öffnen",
                        "1-Click Open Live Terminal"
                      )}
                      className="inline-flex items-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[9px] text-nb-gray-300 hover:border-netbird/60 hover:text-white transition"
                    >
                      <Terminal className="h-2.5 w-2.5 text-netbird" />
                      <span>PTY</span>
                    </button>
                    {onOpenFirewall && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFirewall(gn.node_id);
                        }}
                        title={t(
                          "Firewall für diesen Muscle öffnen",
                          "Open Firewall for this Muscle"
                        )}
                        className="inline-flex items-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[9px] text-nb-gray-300 hover:border-sky-500/60 hover:text-sky-300 transition"
                      >
                        <Shield className="h-2.5 w-2.5 text-sky-400" />
                        <span>FW</span>
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <MuscleNodeInspectorPanel
                    gn={gn}
                    hb={hb}
                    history={history}
                    buildSparklinePoints={buildSparklinePoints}
                    firewallPolicies={firewallPolicies}
                    onSelectNode={onSelectNode}
                    onOpenFirewall={onOpenFirewall}
                    onOpenPty={onOpenPty}
                    onOpenRemoteFiles={onOpenRemoteFiles}
                    authRole={authRole}
                    checkpointBusyId={checkpointBusyId}
                    checkpointNotice={checkpointNotice}
                    nodeCheckpoints={nodeCheckpoints}
                    onCreateCheckpoint={handleCreateCheckpoint}
                    onRollbackCheckpoint={handleRollbackCheckpoint}
                    intrusionBusyNode={intrusionBusyNode}
                    intrusionNotice={intrusionNotice}
                    intrusionMap={intrusionMap}
                    onScanIntrusions={handleScanIntrusions}
                    onBlockAttackerIp={handleBlockAttackerIp}
                    backupBusyId={backupBusyId}
                    backupNotice={backupNotice}
                    offsiteBackups={offsiteBackups}
                    onCreateOffsiteBackup={handleCreateOffsiteBackup}
                    onRestoreOffsiteBackup={handleRestoreOffsiteBackup}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 2. LEFT: UNIFIED SYNAPSE CORE HUB NODE */}
      {(() => {
        const nodeKey = "core:hub";
        const pos = effectivePositions[nodeKey] || { x: 60, y: 120 };
        const isExpanded = Boolean(expandedNodes[nodeKey]);
        const customW = customDims[nodeKey]?.w || DEFAULT_NODE_W;
        const customMinH = customDims[nodeKey]?.minH;

        return (
          <div
            data-canvas-node-id={nodeKey}
            ref={(el) => {
              nodeRefs.current[nodeKey] = el;
            }}
            style={{
              left: `${Math.round(pos.x)}px`,
              top: `${Math.round(pos.y)}px`,
              width: `${customW}px`,
              minWidth: `${MIN_NODE_W}px`,
              minHeight:
                isExpanded && customMinH ? `${customMinH}px` : undefined,
              zIndex:
                draggingNodeId === nodeKey || resizingNodeId === nodeKey
                  ? 30
                  : isExpanded
                  ? 25
                  : 10,
            }}
            onPointerDown={(e) => startNodeDrag(e, nodeKey)}
            onMouseEnter={() => setHoveredNodeId(nodeKey)}
            onMouseLeave={() => setHoveredNodeId(null)}
            onClick={(e) => {
              e.stopPropagation();
              if (lastDragMovedRef.current) {
                lastDragMovedRef.current = false;
                return;
              }
              toggleExpandNode(nodeKey, e);
            }}
            className={`pointer-events-auto absolute rounded-2xl border bg-nb-gray-940 p-4 shadow-xl transition-colors duration-150 ${
              draggingNodeId === nodeKey || resizingNodeId === nodeKey
                ? "cursor-grabbing ring-2 ring-netbird shadow-2xl"
                : "cursor-grab hover:border-netbird/70 hover:bg-nb-gray-930"
            } ${
              isExpanded
                ? "border-netbird ring-2 ring-netbird/30 shadow-2xl"
                : "border-nb-gray-800"
            }`}
          >
            {renderResizeHandles(nodeKey, isExpanded)}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-netbird-500/40 bg-netbird-950 text-netbird">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white">
                    Synapse Core Hub
                  </div>
                  <div className="truncate font-mono text-[10.5px] text-nb-gray-400 mt-0.5">
                    <span className="text-netbird font-semibold">
                      {modelName}
                    </span>
                    {" · "}
                    <span>
                      {t(
                        `${activeCartridges.length}/${cartridges.length} Regeln`,
                        `${activeCartridges.length}/${cartridges.length} Rules`
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => toggleExpandNode(nodeKey, e)}
                title={
                  isExpanded
                    ? t("Core Hub einklappen", "Collapse Core Hub")
                    : t(
                        "Core Hub Details aufklappen",
                        "Expand Core Hub details"
                      )
                }
                className="rounded-md p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white focus:outline-none focus-visible:outline-none transition"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>

            {isExpanded && (
              <CoreHubInspectorPanel
                modelName={modelName}
                baseUrl={baseUrl}
                authEnabled={authEnabled}
                authRole={authRole}
                activeCartridges={activeCartridges}
                cartridges={cartridges}
                secretKeysCount={secretKeysCount}
                blueprints={blueprints}
                blueprintBusyId={blueprintBusyId}
                blueprintNotice={blueprintNotice}
                allServices={allServices}
                onOpenSettings={onOpenSettings}
                onOpenBrainDoc={onOpenBrainDoc}
                onToggleCartridge={onToggleCartridge}
                onDeployBlueprint={handleDeployBlueprint}
                onOpenAiSettings={onOpenAiSettings}
                onOpenSecretsVault={onOpenSecretsVault}
                onOpenAccessControl={onOpenAccessControl}
              />
            )}
          </div>
        );
      })()}
    </>
  );
}
