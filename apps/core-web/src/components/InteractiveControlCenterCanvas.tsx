"use client";

import React, { useMemo } from "react";
import {
  Activity,
  Bot,
  ExternalLink,
  FileText,
  RefreshCw,
  Shield,
  Terminal,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Database,
  Globe,
  Lock,
  Maximize2,
  Plus,
  X,
  RotateCcw,
  Server,
  Unlock,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type {
  AutonomyTier,
  FlowView,
  GatewayNode,
  InteractiveControlCenterCanvasProps as Props,
  RegisteredService,
  TelemetrySample,
} from "@/components/canvas/canvasTypes";
import {
  CanvasEdgesLayer,
  CoreHubInspectorPanel,
  MuscleNodeInspectorPanel,
  ServiceNodeInspectorPanel,
} from "@/components/canvas/CanvasInspectorDrawer";
import { useCanvasOpsController } from "@/components/canvas/useCanvasOpsController";
import {
  DEFAULT_NODE_W,
  MIN_NODE_W,
  useCanvasViewportAndLayout,
} from "@/components/canvas/useCanvasViewportAndLayout";

export type { AutonomyTier, FlowView };

const InteractiveControlCenterCanvas = React.memo(
  function InteractiveControlCenterCanvas({
    gatewayNodes,
    primaryNode,
    activeCartridges,
    cartridges,
    registeredServices,
    secretKeysCount,
    modelName,
    baseUrl,
    joinTier,
    onSelectNode,
    onToggleCartridge,
    onOpenAddPeer,
    onOpenPty,
    onOpenAiSettings,
    onOpenBrainDoc,
    onOpenSecretsVault,
    onOpenReverseProxy,
    onOpenAccessControl,
    onOpenRemoteFiles,
    onHealService,
    firewallPolicies,
    onOpenFirewall,
    onOpenSettings,
  }: Props) {
    const { t, translateText } = useI18n();

    // Feature 1: Merge registeredServices with real-time Auto-Discovered services from Muscle heartbeats
    const allServices = useMemo<RegisteredService[]>(() => {
      const map = new Map<string, RegisteredService>();
      for (const s of registeredServices) {
        map.set(s.service_id, { ...s });
      }
      for (const gn of gatewayNodes) {
        const hbServices = gn.last_heartbeat?.services || [];
        for (const live of hbServices) {
          if (!live.service_id || !live.port) continue;
          const existing =
            map.get(live.service_id) ||
            Array.from(map.values()).find(
              (item) => item.node_id === gn.node_id && item.port === live.port
            );
          if (existing) {
            existing.healthy = live.healthy;
            existing.latency_ms = live.latency_ms;
            if (live.process_name) existing.process_name = live.process_name;
            if (live.container_name)
              existing.container_name = live.container_name;
            if (live.auto_discovered || live.service_id.startsWith("auto-")) {
              existing.auto_discovered = true;
            }
          } else {
            const lower = `${live.service_id} ${live.name}`.toLowerCase();
            const cat: "webui" | "backend" | "database" =
              live.category === "webui" ||
              live.category === "database" ||
              live.category === "backend"
                ? live.category
                : lower.includes("db") ||
                  lower.includes("sqlite") ||
                  lower.includes("postgres") ||
                  lower.includes("redis")
                ? "database"
                : lower.includes("web") || lower.includes("ui")
                ? "webui"
                : "backend";
            map.set(live.service_id, {
              service_id: live.service_id,
              node_id: gn.node_id,
              name: live.name,
              category: cat,
              port: live.port,
              protocol: "http",
              path: "/",
              healthy: live.healthy,
              latency_ms: live.latency_ms,
              auto_discovered: true,
              process_name: live.process_name,
              container_name: live.container_name,
            });
          }
        }
      }
      return Array.from(map.values());
    }, [registeredServices, gatewayNodes]);

    const {
      authEnabled,
      authLocked,
      setAuthLocked,
      authRole,
      showAuthConfig,
      unlockPwdInput,
      setUnlockPwdInput,
      unlockPinInput,
      setUnlockPinInput,
      authNotice,
      checkpoints,
      checkpointBusyId,
      checkpointNotice,
      showAlertChannels,
      serviceLinks,
      blueprints,
      blueprintBusyId,
      blueprintNotice,
      serviceLogsMap,
      logBusyId,
      intrusionMap,
      intrusionBusyNode,
      intrusionNotice,
      offsiteBackups,
      backupBusyId,
      backupNotice,
      domainBindings,
      domainEditorOpen,
      setDomainEditorOpen,
      domainInputMap,
      setDomainInputMap,
      domainNoticeMap,
      chaosResultMap,
      chaosBusyId,
      handleDeployBlueprint,
      handleCreateOffsiteBackup,
      handleRestoreOffsiteBackup,
      handleScanIntrusions,
      handleBlockAttackerIp,
      handleTailServiceLogs,
      handleSaveServiceDomain,
      handleRunChaosTest,
      handleCreateCheckpoint,
      handleRollbackCheckpoint,
      handleUnlockDashboard,
      handleToggleServiceLink,
      selfHealingEvents,
      selfHealBusyId,
      probeBusyId,
      serviceSparklineMap,
      handleQuickRestartService,
      handleQuickProbeService,
      linkProbeBusyId,
      handleUpdateServiceLinkProtocol,
      handleProbeServiceLink,
      showCustomServiceModal,
      setShowCustomServiceModal,
      customSvcName,
      setCustomSvcName,
      customSvcPort,
      setCustomSvcPort,
      customSvcCategory,
      setCustomSvcCategory,
      customSvcRuntime,
      setCustomSvcRuntime,
      customSvcAutoHeal,
      setCustomSvcAutoHeal,
      customSvcBusy,
      customSvcNotice,
      showSelfHealingDrawer,
      setShowSelfHealingDrawer,
      handleDeployCustomService,
    } = useCanvasOpsController({
      primaryNode,
      allServices,
      t,
    });

    const {
      containerRef,
      nodeRefs,
      pan,
      zoom,
      zoomRef,
      isPanning,
      sizes,
      draggingNodeId,
      lastDragMovedRef,
      hoveredNodeId,
      setHoveredNodeId,
      expandedNodes,
      customDims,
      resizingNodeId,
      effectivePositions,
      toggleExpandNode,
      allExpanded,
      handleFitView,
      applyZoomAtPoint,
      handleToggleExpandAll,
      handleResetLayout,
      edges,
      startNodeResize,
      resetNodeSize,
      startNodeDrag,
      getEdgeCoords,
      startCanvasPan,
    } = useCanvasViewportAndLayout({
      gatewayNodes,
      allServices,
      serviceLinks,
      measureDependencySnapshot: [
        serviceLogsMap,
        intrusionMap,
        offsiteBackups.length,
        domainEditorOpen,
        chaosResultMap,
        showAlertChannels,
        showAuthConfig,
      ],
    });

    function renderResizeHandles(nodeId: string, isExpanded: boolean) {
      return (
        <>
          <div
            data-resize-handle="true"
            onPointerDown={(e) => startNodeResize(e, nodeId, "w")}
            onDoubleClick={(e) => resetNodeSize(e, nodeId)}
            onClick={(e) => e.stopPropagation()}
            title={t(
              "Ziehen, um Breite zu ändern (Doppelklick = Standardgröße)",
              "Drag to resize width (Double-click = reset size)"
            )}
            className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-xl hover:bg-netbird/35 transition-colors z-20"
          />
          <div
            data-resize-handle="true"
            onPointerDown={(e) =>
              startNodeResize(e, nodeId, isExpanded ? "wh" : "w")
            }
            onDoubleClick={(e) => resetNodeSize(e, nodeId)}
            onClick={(e) => e.stopPropagation()}
            title={
              isExpanded
                ? t(
                    "Ecke ziehen, um Breite & Höhe frei zu ändern (Doppelklick = Zurücksetzen)",
                    "Drag corner to resize width & height (Double-click = reset)"
                  )
                : t(
                    "Ziehen, um Breite zu ändern (Doppelklick = Zurücksetzen)",
                    "Drag to resize width (Double-click = reset)"
                  )
            }
            className={`absolute bottom-1 right-1 flex h-4 w-4 ${
              isExpanded ? "cursor-nwse-resize" : "cursor-ew-resize"
            } items-end justify-end p-0.5 text-nb-gray-500 hover:text-netbird transition-colors z-30`}
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path
                d="M8 1L1 8M8 4.5L4.5 8M8 8L8 8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </>
      );
    }

    const peerNodesToRender =
      gatewayNodes.length > 0
        ? gatewayNodes
        : [
            {
              node_id: "empty",
              tier: joinTier,
              remote_addr: "",
              connected_at: "",
              online: false,
            } as GatewayNode,
          ];

    return (
      <div
        ref={containerRef}
        onPointerDown={startCanvasPan}
        className={`nb-canvas-grid relative h-full w-full overflow-hidden select-none ${
          isPanning ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {/* 1. ANIMATED SVG EDGES LAYER */}
        <CanvasEdgesLayer
          pan={pan}
          zoom={zoom}
          edges={edges}
          hoveredNodeId={hoveredNodeId}
          getEdgeCoords={getEdgeCoords}
          serviceLinks={serviceLinks}
          effectivePositions={effectivePositions}
          customDims={customDims}
          sizes={sizes}
          defaultNodeW={DEFAULT_NODE_W}
        />

        {/* 2. CRISP VECTOR HTML CARDS LAYER */}
        <div
          style={{
            left: `${Math.round(pan.x)}px`,
            top: `${Math.round(pan.y)}px`,
            zIndex: 2,
          }}
          className="pointer-events-none absolute left-0 top-0"
        >
          <div
            style={{
              zoom: zoom,
            }}
            className="pointer-events-none relative h-[1000px] w-[1400px]"
          >
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
                const pts =
                  history.length >= 2
                    ? history.map(selector)
                    : [
                        selector({
                          ts: 0,
                          cpu: hb?.cpu_percent || 1,
                          ram: hb?.ram_percent || 2,
                          disk: hb?.disk_percent || 1,
                          latency_ms: 1,
                        }),
                        selector({
                          ts: 1,
                          cpu: hb?.cpu_percent || 1,
                          ram: hb?.ram_percent || 2,
                          disk: hb?.disk_percent || 1,
                          latency_ms: 1,
                        }),
                      ];
                const maxVal = Math.max(20, ...pts);
                return pts
                  .map((v, idx) => {
                    const x = (idx / Math.max(1, pts.length - 1)) * 72;
                    const y = 20 - Math.min(18, Math.max(2, (v / maxVal) * 18));
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
                                  gn.online
                                    ? "bg-emerald-400"
                                    : "bg-nb-gray-500"
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
                                    t("Mit mehreren Cores verbunden", "Connected to multiple Cores")
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
                              <span className="hidden">
                              </span>
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

            {/* 3. RIGHT: INTERACTIVE SERVICE CARDS */}
            {(allServices.length > 0
              ? allServices
              : [
                  {
                    service_id: "empty",
                    node_id: "",
                    name: "Keine Services",
                    port: 0,
                    protocol: "http" as const,
                  },
                ]
            ).map((svc) => {
              const nodeKey =
                svc.service_id === "empty"
                  ? "svc:empty"
                  : `svc:${svc.service_id}`;
              const pos = effectivePositions[nodeKey] || { x: 860, y: 120 };
              const healthy =
                svc.healthy !== false &&
                svc.health_check?.status !== "UNHEALTHY";
              const isExpanded = Boolean(expandedNodes[nodeKey]);
              const cat = svc.category || "backend";
              const catLabel =
                cat === "webui"
                  ? "WebUI"
                  : cat === "database"
                  ? "SQLite"
                  : "API";
              const latencyMs =
                svc.latency_ms ?? svc.health_check?.latency_ms ?? 1;
              const customW = customDims[nodeKey]?.w || DEFAULT_NODE_W;
              const customMinH = customDims[nodeKey]?.minH;

              return (
                <div
                  key={nodeKey}
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
                    if (svc.service_id !== "empty") {
                      toggleExpandNode(nodeKey, e);
                    }
                  }}
                  className={`pointer-events-auto absolute rounded-xl border bg-nb-gray-940 px-4 py-3 shadow-lg transition-colors duration-150 ${
                    draggingNodeId === nodeKey || resizingNodeId === nodeKey
                      ? "cursor-grabbing ring-2 ring-sky-400 shadow-2xl"
                      : "cursor-grab hover:border-nb-gray-700 hover:bg-nb-gray-930"
                  } ${
                    isExpanded
                      ? "border-sky-400 ring-1 ring-sky-400/30 shadow-2xl"
                      : "border-nb-gray-800"
                  }`}
                >
                  {renderResizeHandles(nodeKey, isExpanded)}
                  {svc.service_id === "empty" ? (
                    <div className="text-xs text-nb-gray-400 py-1">
                      {t(
                        "Noch keine Dienste bereitgestellt",
                        "No services deployed yet"
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-nb-gray-800 bg-nb-gray-950 text-sky-400">
                            {cat === "database" ? (
                              <Database className="h-4 w-4 text-sky-400" />
                            ) : cat === "webui" ? (
                              <Globe className="h-4 w-4 text-sky-400" />
                            ) : (
                              <Zap className="h-4 w-4 text-netbird" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  healthy
                                    ? "bg-emerald-400"
                                    : "bg-red-500 animate-pulse"
                                }`}
                              />
                              <span className="truncate text-xs font-semibold text-white">
                                {translateText(svc.name)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 font-mono text-[10px] text-nb-gray-400 mt-0.5 min-w-0">
                              <span data-no-i18n="true" className="truncate">
                                {catLabel} · {svc.node_id}
                              </span>
                              <span className="shrink-0 font-semibold text-nb-gray-200">
                                · :{svc.port}
                              </span>
                              <span className="shrink-0 rounded bg-emerald-950/90 border border-emerald-500/30 px-1 py-0.2 text-[8.5px] text-emerald-300">
                                {latencyMs <= 0 ? "<1 ms" : `${latencyMs} ms`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => toggleExpandNode(nodeKey, e)}
                          title={
                            isExpanded
                              ? t("Service einklappen", "Collapse service")
                              : t(
                                  "Endpunkte & Aktionen direkt aufklappen",
                                  "Expand endpoints & actions"
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

                                            {/* v0.5.0: 60s Latency Sparkline, Autonomous Self-Healing Badge & 1-Click Quick-Actions */}
                      {(() => {
                        const latSamples = serviceSparklineMap[
                          svc.service_id
                        ] || [1, 1, 1, 1, 1, Math.max(1, latencyMs)];
                        const maxLat = Math.max(10, ...latSamples);
                        const sparkPts = latSamples
                          .map((val, idx) => {
                            const x =
                              (idx / Math.max(1, latSamples.length - 1)) * 56;
                            const y =
                              14 - Math.min(12, Math.max(2, (val / maxLat) * 12));
                            return `${x.toFixed(1)},${y.toFixed(1)}`;
                          })
                          .join(" ");
                        const latestHeal = selfHealingEvents.find(
                          (ev) =>
                            ev.service_id === svc.service_id ||
                            ev.port === svc.port
                        );
                        const isHealingNow = selfHealBusyId === svc.service_id;
                        const isProbingNow = probeBusyId === svc.service_id;

                        return (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2 flex items-center justify-between gap-1.5 border-t border-nb-gray-800/80 pt-1.5"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="inline-flex items-center gap-1 font-mono text-[9px] text-nb-gray-400"
                                title={t(
                                  "60s Echtzeit-Latenz-Verlauf",
                                  "60s real-time latency sparkline"
                                )}
                              >
                                <svg
                                  width="44"
                                  height="14"
                                  viewBox="0 0 56 14"
                                  className="overflow-visible shrink-0"
                                >
                                  <polyline
                                    fill="none"
                                    stroke={healthy ? "#34d399" : "#f87171"}
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    points={sparkPts}
                                  />
                                </svg>
                              </span>
                              {isHealingNow ? (
                                <span className="inline-flex items-center gap-1 rounded border border-amber-500/50 bg-amber-950/80 px-1.5 py-0.2 font-mono text-[8.5px] font-semibold text-amber-300 animate-pulse">
                                  <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                                  <span>{t("Heilung...", "Healing...")}</span>
                                </span>
                              ) : latestHeal ? (
                                <span
                                  title={`${latestHeal.trigger} · HTTP ${latestHeal.http_status} (${latestHeal.mttr_ms} ms)`}
                                  className="shrink-0 whitespace-nowrap inline-flex items-center gap-0.5 rounded border border-emerald-500/40 bg-emerald-950/80 px-1.2 py-0.2 font-mono text-[8px] font-semibold text-emerald-300"
                                >
                                  <span>⚡ {latestHeal.mttr_ms}ms</span>
                                </span>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={isHealingNow}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleQuickRestartService(svc, false);
                                }}
                                title={t(
                                  "1-Klick Service-Neustart & Auto-Heal Runbook",
                                  "1-Click Service Restart & Auto-Heal Runbook"
                                )}
                                className="inline-flex items-center gap-0.5 rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[8.5px] text-nb-gray-300 hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-40 transition"
                              >
                                <RotateCcw
                                  className={`h-2.5 w-2.5 ${
                                    isHealingNow
                                      ? "animate-spin text-emerald-400"
                                      : "text-emerald-400"
                                  }`}
                                />
                                <span>{t("Heal", "Heal")}</span>
                              </button>
                              <button
                                type="button"
                                disabled={isProbingNow}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleQuickProbeService(svc);
                                }}
                                title={t(
                                  "1-Klick Live-Health- & Latenz-Probe",
                                  "1-Click Live Health & Latency Probe"
                                )}
                                className="inline-flex items-center gap-0.5 rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[8.5px] text-nb-gray-300 hover:border-sky-500/50 hover:text-sky-300 disabled:opacity-40 transition"
                              >
                                <Activity
                                  className={`h-2.5 w-2.5 ${
                                    isProbingNow
                                      ? "animate-pulse text-sky-400"
                                      : "text-sky-400"
                                  }`}
                                />
                                <span>Probe</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isExpanded) toggleExpandNode(nodeKey, e);
                                  void handleTailServiceLogs(svc);
                                }}
                                title={t(
                                  "1-Klick Live-Log-Stream aufklappen",
                                  "1-Click Expand Live Log Stream"
                                )}
                                className="inline-flex items-center gap-0.5 rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[8.5px] text-nb-gray-300 hover:border-violet-500/50 hover:text-violet-300 transition"
                              >
                                <FileText className="h-2.5 w-2.5 text-violet-400" />
                                <span>Logs</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenReverseProxy(svc.port);
                                }}
                                title={t(
                                  "Im Reverse-Proxy / API-Tester öffnen",
                                  "Open in Reverse Proxy / API Tester"
                                )}
                                className="inline-flex items-center rounded border border-nb-gray-800 bg-nb-gray-950 p-1 text-nb-gray-300 hover:border-netbird/60 hover:text-white transition"
                              >
                                <ExternalLink className="h-2.5 w-2.5 text-netbird" />
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {isExpanded && (
                        <ServiceNodeInspectorPanel
                          svc={svc}
                          allServices={allServices}
                          serviceLinks={serviceLinks}
                          domainBindings={domainBindings}
                          domainEditorOpen={domainEditorOpen}
                          domainInputMap={domainInputMap}
                          domainNoticeMap={domainNoticeMap}
                          serviceLogsMap={serviceLogsMap}
                          logBusyId={logBusyId}
                          chaosBusyId={chaosBusyId}
                          chaosResultMap={chaosResultMap}
                          authRole={authRole}
                          onOpenReverseProxy={onOpenReverseProxy}
                          onHealService={onHealService}
                          onToggleServiceLink={handleToggleServiceLink}
                          onTailServiceLogs={handleTailServiceLogs}
                          onToggleDomainEditor={(serviceId) =>
                            setDomainEditorOpen((prev) => ({
                              ...prev,
                              [serviceId]: !prev[serviceId],
                            }))
                          }
                          onChangeDomainInput={(serviceId, value) =>
                            setDomainInputMap((prev) => ({
                              ...prev,
                              [serviceId]: value,
                            }))
                          }
                          onSaveServiceDomain={handleSaveServiceDomain}
                          onRunChaosTest={handleRunChaosTest}
                          linkProbeBusyId={linkProbeBusyId}
                          onUpdateServiceLinkProtocol={
                            handleUpdateServiceLinkProtocol
                          }
                          onProbeServiceLink={handleProbeServiceLink}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* FEATURE 3: ZERO-TRUST WEBUI LOCK OVERLAY */}
        {authLocked && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute inset-0 z-50 flex items-center justify-center bg-nb-gray-950/90 backdrop-blur-md p-4"
          >
            <form
              onSubmit={handleUnlockDashboard}
              className="w-full max-w-sm rounded-2xl border border-nb-gray-800 bg-nb-gray-940 p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-netbird/40 bg-netbird-950 text-netbird">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {t(
                      "Synapse Control Center gesperrt",
                      "Synapse Control Center Locked"
                    )}
                  </h3>
                  <p className="text-xs text-nb-gray-400">
                    {t(
                      "Bitte mit Admin- oder Operator-Passwort entsperren",
                      "Unlock with Admin or Operator password"
                    )}
                  </p>
                </div>
              </div>
              {authNotice && (
                <div className="rounded-lg border border-red-500/40 bg-red-950/60 px-3 py-2 text-xs text-red-300">
                  {authNotice}
                </div>
              )}
              <div className="space-y-2.5">
                <input
                  type="password"
                  value={unlockPwdInput}
                  onChange={(e) => setUnlockPwdInput(e.target.value)}
                  placeholder={t("Passwort eingeben...", "Enter password...")}
                  className="w-full rounded-xl border border-nb-gray-800 bg-nb-gray-950 px-3.5 py-2.5 text-xs text-white focus:border-netbird focus:outline-none"
                  autoFocus
                />
                <input
                  type="text"
                  value={unlockPinInput}
                  onChange={(e) => setUnlockPinInput(e.target.value)}
                  placeholder={t(
                    "2FA-PIN (falls aktiviert)...",
                    "2FA PIN (if enabled)..."
                  )}
                  className="w-full rounded-xl border border-nb-gray-800 bg-nb-gray-950 px-3.5 py-2 text-xs text-white focus:border-netbird focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-netbird py-2.5 text-xs font-semibold text-white hover:bg-netbird-500 transition"
              >
                <Unlock className="h-4 w-4" />
                <span>
                  {t("Control Center entsperren", "Unlock Control Center")}
                </span>
              </button>
            </form>
          </div>
        )}

        {/* Bottom-Left Zoom, Expand & Lock Controls */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute bottom-4 left-5 z-20 flex items-center gap-1 rounded-xl border border-nb-gray-800 bg-nb-gray-940/90 p-1 shadow-lg backdrop-blur"
        >
          <button
            onClick={() => applyZoomAtPoint(zoomRef.current * 1.15)}
            className="rounded-lg p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <span className="px-1.5 font-mono text-[10px] text-nb-gray-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => applyZoomAtPoint(zoomRef.current / 1.15)}
            className="rounded-lg p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <div className="h-3.5 w-[1px] bg-nb-gray-800 mx-0.5" />
          <button
            onClick={handleToggleExpandAll}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
            title={t(
              "Alle Knoten auf dem Canvas auf- oder zuklappen",
              "Expand or collapse all canvas nodes"
            )}
          >
            <ChevronsUpDown className="h-3.5 w-3.5 text-netbird" />
            <span>
              {allExpanded
                ? t("Alle einklappen", "Collapse all")
                : t("Alle erweitern", "Expand all")}
            </span>
          </button>
          <div className="h-3.5 w-[1px] bg-nb-gray-800 mx-0.5" />
          <button
            onClick={() => setAuthLocked(true)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-nb-gray-900"
            title={t("Dashboard sperren (RBAC)", "Lock Dashboard (RBAC)")}
          >
            <Lock className="h-3.5 w-3.5" />
            <span>
              {authRole === "operator"
                ? t("Operator (Nur-Lesen)", "Operator (Read-Only)")
                : t("Sperren", "Lock")}
            </span>
          </button>
          <div className="h-3.5 w-[1px] bg-nb-gray-800 mx-0.5" />
          <button
            onClick={() => handleFitView(effectivePositions)}
            className="rounded-lg p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
            title={t("Ansicht zentrieren", "Center view")}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleResetLayout}
            className="rounded-lg p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
            title={t("Layout zurücksetzen", "Reset layout")}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <div className="h-3.5 w-[1px] bg-nb-gray-800 mx-0.5" />
          <button
            type="button"
            onClick={() => setShowCustomServiceModal(true)}
            className="flex items-center gap-1 rounded-lg bg-netbird px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-netbird-500 transition shadow-sm"
            title={t(
              "Eigenen Dienst in 10 Sekunden live auf vps2-muscle bereitstellen",
              "Deploy custom service live on vps2-muscle in 10 seconds"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{t("+ Neuer Service", "+ New Service")}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowSelfHealingDrawer((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-900/60 transition"
            title={t(
              "Self-Healing & Incident Center öffnen",
              "Open Self-Healing & Incident Center"
            )}
          >
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              {t(
                `Self-Healing (${selfHealingEvents.length})`,
                `Self-Healing (${selfHealingEvents.length})`
              )}
            </span>
          </button>
        </div>

        {/* v0.6.0: 1-CLICK CUSTOM SERVICE BUILDER MODAL ON CANVAS */}
        {showCustomServiceModal && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-nb-gray-950/85 backdrop-blur-sm p-4"
          >
            <form
              onSubmit={handleDeployCustomService}
              className="w-full max-w-md rounded-2xl border border-nb-gray-800 bg-nb-gray-940 p-5 shadow-2xl space-y-4 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-netbird/40 bg-netbird-950 text-netbird">
                    <Plus className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {t(
                        "1-Click Custom Service Builder (v0.6.0)",
                        "1-Click Custom Service Builder (v0.6.0)"
                      )}
                    </h3>
                    <p className="text-[11px] text-nb-gray-400">
                      {t(
                        `Rollt deinen Dienst direkt live auf ${primaryNode || "vps2-muscle"} aus`,
                        `Rolls out your service live on ${primaryNode || "vps2-muscle"}`
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomServiceModal(false)}
                  className="rounded-lg p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {customSvcNotice && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-3 py-2 font-mono text-[11px] text-emerald-300">
                  {customSvcNotice}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-nb-gray-300 mb-1">
                    {t("Service-Name", "Service Name")}
                  </label>
                  <input
                    type="text"
                    required
                    value={customSvcName}
                    onChange={(e) => setCustomSvcName(e.target.value)}
                    placeholder={t(
                      "z.B. Edge Metrics API",
                      "e.g. Edge Metrics API"
                    )}
                    className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 text-xs text-white focus:border-netbird focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-nb-gray-300 mb-1">
                    {t("Port", "Port")}
                  </label>
                  <input
                    type="number"
                    required
                    min={1024}
                    max={65535}
                    value={customSvcPort}
                    onChange={(e) => setCustomSvcPort(e.target.value)}
                    className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 font-mono text-xs text-netbird focus:border-netbird focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-medium text-nb-gray-300 mb-1">
                    {t("Kategorie", "Category")}
                  </label>
                  <select
                    value={customSvcCategory}
                    onChange={(e) => {
                      const cat = e.target.value as
                        | "backend"
                        | "webui"
                        | "database";
                      setCustomSvcCategory(cat);
                      setCustomSvcRuntime(
                        cat === "webui"
                          ? "static_webui"
                          : cat === "database"
                          ? "sqlite_rest"
                          : "python_http"
                      );
                    }}
                    className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 text-xs text-white"
                  >
                    <option value="backend">
                      {t("Backend / REST API", "Backend / REST API")}
                    </option>
                    <option value="webui">
                      {t("Interaktive WebUI", "Interactive WebUI")}
                    </option>
                    <option value="database">
                      {t("SQLite Datenbank-API", "SQLite Database API")}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-nb-gray-300 mb-1">
                    {t("Runtime-Template", "Runtime Template")}
                  </label>
                  <select
                    value={customSvcRuntime}
                    onChange={(e) =>
                      setCustomSvcRuntime(
                        e.target.value as
                          | "python_http"
                          | "static_webui"
                          | "sqlite_rest"
                      )
                    }
                    className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 font-mono text-xs text-sky-300"
                  >
                    <option value="python_http">Python JSON Microservice</option>
                    <option value="static_webui">Dark HTML5 Live WebUI</option>
                    <option value="sqlite_rest">SQLite3 WAL Storage Engine</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2.5 rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={customSvcAutoHeal}
                  onChange={(e) => setCustomSvcAutoHeal(e.target.checked)}
                  className="rounded border-nb-gray-700 accent-netbird"
                />
                <div>
                  <div className="font-semibold text-white">
                    {t(
                      "⚡ Autonomous Self-Healing aktivieren",
                      "⚡ Enable Autonomous Self-Healing"
                    )}
                  </div>
                  <div className="text-[10.5px] text-nb-gray-400">
                    {t(
                      "Überwacht den Port 24/7 und startet den Dienst bei Absturz automatisch neu",
                      "Monitors the port 24/7 and automatically restarts the service on crash"
                    )}
                  </div>
                </div>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomServiceModal(false)}
                  className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-4 py-2 text-xs text-nb-gray-300 hover:text-white"
                >
                  {t("Abbrechen", "Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={customSvcBusy}
                  className="flex items-center gap-1.5 rounded-lg bg-netbird px-5 py-2 text-xs font-semibold text-white hover:bg-netbird-500 disabled:opacity-50 transition"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>
                    {customSvcBusy
                      ? t("Wird ausgerollt...", "Deploying...")
                      : t("Jetzt live bereitstellen", "Deploy Live Now")}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* v0.6.0: SELF-HEALING & INCIDENT TIMELINE OVERLAY ON CANVAS */}
        {showSelfHealingDrawer && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="pointer-events-auto absolute bottom-16 left-5 z-30 w-[440px] max-w-[92vw] rounded-2xl border border-nb-gray-800 bg-nb-gray-940/95 p-4 shadow-2xl backdrop-blur-md space-y-3 text-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold text-white">
                  {t(
                    "Self-Healing & Incident Center",
                    "Self-Healing & Incident Center"
                  )}
                </span>
                <span className="rounded border border-emerald-500/40 bg-emerald-950/70 px-1.5 py-0.5 font-mono text-[9.5px] text-emerald-300">
                  {selfHealingEvents.length} {t("Ereignisse", "Events")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowSelfHealingDrawer(false)}
                className="rounded p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {selfHealingEvents.length === 0 ? (
                <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-4 text-center text-nb-gray-400">
                  {t(
                    "Noch keine Self-Healing-Ereignisse aufgezeichnet.",
                    "No self-healing events recorded yet."
                  )}
                </div>
              ) : (
                selfHealingEvents.slice(0, 8).map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-3 space-y-1.5 font-mono text-[10px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white truncate">
                        ⚡ {ev.service_name} (:{ev.port})
                      </span>
                      <span className="shrink-0 rounded border border-emerald-500/40 bg-emerald-950 px-1.5 py-0.5 text-[9px] text-emerald-300">
                        MTTR {ev.mttr_ms} ms · HTTP {ev.http_status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-nb-gray-400">
                      <span>
                        {ev.node_id} · {ev.trigger}
                      </span>
                      <span>
                        {ev.timestamp.replace("T", " ").slice(0, 19)}
                      </span>
                    </div>
                    {ev.log_snapshot && ev.log_snapshot.length > 0 && (
                      <div className="rounded bg-black/50 p-1.5 text-[8.5px] text-nb-gray-300 truncate">
                        {ev.log_snapshot[ev.log_snapshot.length - 1]}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default InteractiveControlCenterCanvas;
