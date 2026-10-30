"use client";

import React, { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import type {
  AutonomyTier,
  FlowView,
  GatewayNode,
  InteractiveControlCenterCanvasProps as Props,
  RegisteredService,
} from "@/components/canvas/canvasTypes";
import { CanvasEdgesLayer } from "@/components/canvas/CanvasInspectorDrawer";
import { CanvasModalsAndToolbar } from "@/components/canvas/CanvasModalsAndToolbar";
import { CanvasMuscleAndCoreCardsLayer } from "@/components/canvas/CanvasMuscleAndCoreCardsLayer";
import { CanvasServiceCardsLayer } from "@/components/canvas/CanvasServiceCardsLayer";
import { useCanvasOpsController } from "@/components/canvas/useCanvasOpsController";
import {
  DEFAULT_NODE_W,
  useCanvasViewportAndLayout,
} from "@/components/canvas/useCanvasViewportAndLayout";

export type { AutonomyTier, FlowView };

const CATEGORY_SORT_RANK: Record<string, number> = {
  backend: 1,
  webui: 2,
  database: 3,
};

const InteractiveControlCenterCanvas = React.memo(
  function InteractiveControlCenterCanvas({
    gatewayNodes,
    primaryNode,
    activeCartridges,
    cartridges,
    registeredServices,
    dismissedServices,
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
    onRemoveService,
    firewallPolicies,
    onOpenFirewall,
    onOpenSettings,
  }: Props) {
    const { t } = useI18n();

    // Merge registeredServices with real-time Auto-Discovered services from Muscle heartbeats
    const allServices = useMemo<RegisteredService[]>(() => {
      const dismissedSet = new Set<string>(dismissedServices || []);
      const map = new Map<string, RegisteredService>();
      for (const s of registeredServices) {
        if (
          dismissedSet.has(s.service_id) ||
          dismissedSet.has(`port:${s.port}`)
        ) {
          continue;
        }
        map.set(s.service_id, { ...s });
      }
      for (const gn of gatewayNodes) {
        const hbServices = gn.last_heartbeat?.services || [];
        for (const live of hbServices) {
          if (!live.service_id || !live.port) continue;
          if (
            dismissedSet.has(live.service_id) ||
            dismissedSet.has(`port:${live.port}`)
          ) {
            continue;
          }
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
          } else if (live.healthy) {
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
      const list = Array.from(map.values());
      list.sort((a, b) => {
        const rankA = CATEGORY_SORT_RANK[a.category || "backend"] ?? 10;
        const rankB = CATEGORY_SORT_RANK[b.category || "backend"] ?? 10;
        if (rankA !== rankB) return rankA - rankB;
        return (a.port || 0) - (b.port || 0);
      });
      return list;
    }, [registeredServices, dismissedServices, gatewayNodes]);

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
      hotReloadModalSvc,
      setHotReloadModalSvc,
      hotReloadFilePath,
      setHotReloadFilePath,
      hotReloadCode,
      setHotReloadCode,
      hotReloadLoading,
      hotReloadSaving,
      hotReloadNotice,
      handleOpenHotReloadModal,
      handleSaveAndHotReloadCode,
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
            <CanvasMuscleAndCoreCardsLayer
              peerNodesToRender={peerNodesToRender}
              effectivePositions={effectivePositions}
              expandedNodes={expandedNodes}
              customDims={customDims}
              draggingNodeId={draggingNodeId}
              resizingNodeId={resizingNodeId}
              nodeRefs={nodeRefs}
              lastDragMovedRef={lastDragMovedRef}
              startNodeDrag={startNodeDrag}
              setHoveredNodeId={setHoveredNodeId}
              toggleExpandNode={toggleExpandNode}
              renderResizeHandles={renderResizeHandles}
              onOpenAddPeer={onOpenAddPeer}
              onSelectNode={onSelectNode}
              onOpenPty={onOpenPty}
              onOpenFirewall={onOpenFirewall}
              onOpenRemoteFiles={onOpenRemoteFiles}
              firewallPolicies={firewallPolicies}
              authRole={authRole}
              checkpoints={checkpoints}
              checkpointBusyId={checkpointBusyId}
              checkpointNotice={checkpointNotice}
              handleCreateCheckpoint={handleCreateCheckpoint}
              handleRollbackCheckpoint={handleRollbackCheckpoint}
              intrusionBusyNode={intrusionBusyNode}
              intrusionNotice={intrusionNotice}
              intrusionMap={intrusionMap}
              handleScanIntrusions={handleScanIntrusions}
              handleBlockAttackerIp={handleBlockAttackerIp}
              backupBusyId={backupBusyId}
              backupNotice={backupNotice}
              offsiteBackups={offsiteBackups}
              handleCreateOffsiteBackup={handleCreateOffsiteBackup}
              handleRestoreOffsiteBackup={handleRestoreOffsiteBackup}
              modelName={modelName}
              baseUrl={baseUrl}
              authEnabled={authEnabled}
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
              handleDeployBlueprint={handleDeployBlueprint}
              onOpenAiSettings={onOpenAiSettings}
              onOpenSecretsVault={onOpenSecretsVault}
              onOpenAccessControl={onOpenAccessControl}
            />

            <CanvasServiceCardsLayer
              allServices={allServices}
              effectivePositions={effectivePositions}
              expandedNodes={expandedNodes}
              customDims={customDims}
              draggingNodeId={draggingNodeId}
              resizingNodeId={resizingNodeId}
              nodeRefs={nodeRefs}
              lastDragMovedRef={lastDragMovedRef}
              startNodeDrag={startNodeDrag}
              setHoveredNodeId={setHoveredNodeId}
              toggleExpandNode={toggleExpandNode}
              renderResizeHandles={renderResizeHandles}
              serviceSparklineMap={serviceSparklineMap}
              selfHealingEvents={selfHealingEvents}
              selfHealBusyId={selfHealBusyId}
              probeBusyId={probeBusyId}
              handleQuickRestartService={handleQuickRestartService}
              handleQuickProbeService={handleQuickProbeService}
              handleTailServiceLogs={handleTailServiceLogs}
              handleOpenHotReloadModal={handleOpenHotReloadModal}
              onOpenReverseProxy={onOpenReverseProxy}
              onRemoveService={onRemoveService}
              serviceLinks={serviceLinks}
              domainBindings={domainBindings}
              domainEditorOpen={domainEditorOpen}
              setDomainEditorOpen={setDomainEditorOpen}
              domainInputMap={domainInputMap}
              setDomainInputMap={setDomainInputMap}
              domainNoticeMap={domainNoticeMap}
              serviceLogsMap={serviceLogsMap}
              logBusyId={logBusyId}
              chaosBusyId={chaosBusyId}
              chaosResultMap={chaosResultMap}
              authRole={authRole}
              onHealService={onHealService}
              handleToggleServiceLink={handleToggleServiceLink}
              handleSaveServiceDomain={handleSaveServiceDomain}
              handleRunChaosTest={handleRunChaosTest}
              linkProbeBusyId={linkProbeBusyId}
              handleUpdateServiceLinkProtocol={handleUpdateServiceLinkProtocol}
              handleProbeServiceLink={handleProbeServiceLink}
            />
          </div>
        </div>

        <CanvasModalsAndToolbar
          primaryNode={primaryNode}
          allServices={allServices}
          authLocked={authLocked}
          setAuthLocked={setAuthLocked}
          authRole={authRole}
          authNotice={authNotice}
          unlockPwdInput={unlockPwdInput}
          setUnlockPwdInput={setUnlockPwdInput}
          unlockPinInput={unlockPinInput}
          setUnlockPinInput={setUnlockPinInput}
          handleUnlockDashboard={handleUnlockDashboard}
          zoom={zoom}
          zoomRef={zoomRef}
          applyZoomAtPoint={applyZoomAtPoint}
          allExpanded={allExpanded}
          handleToggleExpandAll={handleToggleExpandAll}
          effectivePositions={effectivePositions}
          handleFitView={handleFitView}
          handleResetLayout={handleResetLayout}
          showCustomServiceModal={showCustomServiceModal}
          setShowCustomServiceModal={setShowCustomServiceModal}
          customSvcName={customSvcName}
          setCustomSvcName={setCustomSvcName}
          customSvcPort={customSvcPort}
          setCustomSvcPort={setCustomSvcPort}
          customSvcCategory={customSvcCategory}
          setCustomSvcCategory={setCustomSvcCategory}
          customSvcRuntime={customSvcRuntime}
          setCustomSvcRuntime={setCustomSvcRuntime}
          customSvcAutoHeal={customSvcAutoHeal}
          setCustomSvcAutoHeal={setCustomSvcAutoHeal}
          customSvcBusy={customSvcBusy}
          customSvcNotice={customSvcNotice}
          handleDeployCustomService={handleDeployCustomService}
          hotReloadModalSvc={hotReloadModalSvc}
          setHotReloadModalSvc={setHotReloadModalSvc}
          hotReloadFilePath={hotReloadFilePath}
          setHotReloadFilePath={setHotReloadFilePath}
          hotReloadCode={hotReloadCode}
          setHotReloadCode={setHotReloadCode}
          hotReloadLoading={hotReloadLoading}
          hotReloadSaving={hotReloadSaving}
          hotReloadNotice={hotReloadNotice}
          handleSaveAndHotReloadCode={handleSaveAndHotReloadCode}
          showSelfHealingDrawer={showSelfHealingDrawer}
          setShowSelfHealingDrawer={setShowSelfHealingDrawer}
          selfHealingEvents={selfHealingEvents}
          selfHealBusyId={selfHealBusyId}
          handleQuickRestartService={handleQuickRestartService}
        />
      </div>
    );
  }
);

export default InteractiveControlCenterCanvas;
