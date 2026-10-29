"use client";

import React, { useMemo } from "react";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Database,
  Globe,
  Lock,
  Maximize2,
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
        </div>
      </div>
    );
  }
);

export default InteractiveControlCenterCanvas;
