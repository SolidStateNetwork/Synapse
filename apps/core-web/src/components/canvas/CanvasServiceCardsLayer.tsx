"use client";

import React from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Code2,
  Database,
  ExternalLink,
  FileText,
  Globe,
  RefreshCw,
  RotateCcw,
  Trash2,
  Zap,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type {
  ChaosResultState,
  DomainBindingItem,
  Point,
  RegisteredService,
  SelfHealingEventItem,
  ServiceMeshLink,
} from "@/components/canvas/canvasTypes";
import { ServiceNodeInspectorPanel } from "@/components/canvas/CanvasInspectorDrawer";
import {
  DEFAULT_NODE_W,
  MIN_NODE_W,
} from "@/components/canvas/useCanvasViewportAndLayout";

export interface CanvasServiceCardsLayerProps {
  allServices: RegisteredService[];
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
  serviceSparklineMap: Record<string, number[]>;
  selfHealingEvents: SelfHealingEventItem[];
  selfHealBusyId: string | null;
  probeBusyId: string | null;
  handleQuickRestartService: (
    svc: RegisteredService,
    simulateCrash: boolean
  ) => void;
  handleQuickProbeService: (svc: RegisteredService) => void;
  handleTailServiceLogs: (svc: RegisteredService, forceRefresh?: boolean) => void;
  handleOpenHotReloadModal: (svc: RegisteredService) => void;
  onOpenReverseProxy: (port: number) => void;
  onRemoveService?: (serviceId: string, nodeId?: string, port?: number) => void;
  serviceLinks: ServiceMeshLink[];
  domainBindings: Record<string, DomainBindingItem>;
  domainEditorOpen: Record<string, boolean>;
  setDomainEditorOpen: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  domainInputMap: Record<string, string>;
  setDomainInputMap: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  domainNoticeMap: Record<string, string>;
  serviceLogsMap: Record<
    string,
    { lines: string[]; errorCount: number; open: boolean }
  >;
  logBusyId: string | null;
  chaosBusyId: string | null;
  chaosResultMap: Record<string, ChaosResultState>;
  authRole: "admin" | "operator";
  onHealService: (port: number) => void;
  handleToggleServiceLink: (fromServiceId: string, toServiceId: string) => void;
  handleSaveServiceDomain: (svc: RegisteredService) => void;
  handleRunChaosTest: (svc: RegisteredService) => void;
  linkProbeBusyId: string | null;
  handleUpdateServiceLinkProtocol: (
    fromServiceId: string,
    toServiceId: string,
    protocol: string
  ) => void;
  handleProbeServiceLink: (
    fromSvc: RegisteredService,
    toSvc: RegisteredService,
    protocol?: string
  ) => void;
}

export function CanvasServiceCardsLayer({
  allServices,
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
  serviceSparklineMap,
  selfHealingEvents,
  selfHealBusyId,
  probeBusyId,
  handleQuickRestartService,
  handleQuickProbeService,
  handleTailServiceLogs,
  handleOpenHotReloadModal,
  onOpenReverseProxy,
  onRemoveService,
  serviceLinks,
  domainBindings,
  domainEditorOpen,
  setDomainEditorOpen,
  domainInputMap,
  setDomainInputMap,
  domainNoticeMap,
  serviceLogsMap,
  logBusyId,
  chaosBusyId,
  chaosResultMap,
  authRole,
  onHealService,
  handleToggleServiceLink,
  handleSaveServiceDomain,
  handleRunChaosTest,
  linkProbeBusyId,
  handleUpdateServiceLinkProtocol,
  handleProbeServiceLink,
}: CanvasServiceCardsLayerProps) {
  const { t, translateText } = useI18n();

  return (
    <>
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
          svc.service_id === "empty" ? "svc:empty" : `svc:${svc.service_id}`;
        const pos = effectivePositions[nodeKey] || { x: 860, y: 120 };
        const healthy =
          svc.healthy !== false && svc.health_check?.status !== "UNHEALTHY";
        const isExpanded = Boolean(expandedNodes[nodeKey]);
        const cat = svc.category || "backend";
        const catLabel =
          cat === "webui" ? "WebUI" : cat === "database" ? "SQLite" : "API";
        const latencyMs = svc.latency_ms ?? svc.health_check?.latency_ms ?? 1;
        const customW = customDims[nodeKey]?.w || DEFAULT_NODE_W;
        const customMinH = customDims[nodeKey]?.minH;
        const dbFileName = svc.db_path
          ? svc.db_path.split("/").pop() || `:${svc.port}`
          : `:${svc.port}`;

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
                          {translateText(
                            svc.name.replace(
                              new RegExp(`\\s*:${svc.port}\\b`),
                              ""
                            )
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[10px] text-nb-gray-400 mt-0.5 min-w-0">
                        <span data-no-i18n="true" className="truncate">
                          {catLabel} · {svc.node_id}
                        </span>
                        <span className="shrink-0 font-semibold text-nb-gray-200">
                          · {cat === "database" && svc.db_path ? dbFileName : `:${svc.port}`}
                        </span>
                        <span
                          className={`shrink-0 rounded border px-1 py-0.2 text-[8.5px] ${
                            healthy
                              ? "bg-emerald-950/90 border-emerald-500/30 text-emerald-300"
                              : "bg-red-950/90 border-red-500/40 text-red-300 font-semibold"
                          }`}
                        >
                          {!healthy
                            ? "OFFLINE"
                            : latencyMs <= 0
                            ? "<1 ms"
                            : `${latencyMs} ms`}
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

                {/* v0.5.0: Framed 60s Latency Sparkline + Auto-Heal Status Bar & Full-Width Quick-Action Bar */}
                {(() => {
                  const rawSamples = serviceSparklineMap[svc.service_id] || [
                    1,
                    1,
                    1,
                    1,
                    1,
                    1,
                    Math.max(1, latencyMs),
                  ];
                  const latSamples =
                    rawSamples.length >= 6
                      ? rawSamples.slice(-10)
                      : [1, 1, 1, 1, 1, Math.max(1, latencyMs)];
                  const minLat = Math.min(...latSamples);
                  const maxLat = Math.max(...latSamples);
                  const latSpan = maxLat - minLat;
                  const seed = (svc.port || 4000) % 7;
                  const sparkPts = latSamples
                    .map((val, idx) => {
                      const x =
                        (idx / Math.max(1, latSamples.length - 1)) * 64;
                      const norm =
                        latSpan >= 1
                          ? (val - minLat) / Math.max(2, latSpan)
                          : 0.45 + Math.sin(idx * 1.25 + seed) * 0.24;
                      const y = 11.5 - norm * 8;
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(" ");
                  const sparkAreaPts = `0,13.5 ${sparkPts} 64,13.5`;
                  const latestHeal = selfHealingEvents.find(
                    (ev) =>
                      ev.service_id === svc.service_id || ev.port === svc.port
                  );
                  const isHealingNow = selfHealBusyId === svc.service_id;
                  const isProbingNow = probeBusyId === svc.service_id;

                  return (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 space-y-1.5 border-t border-nb-gray-800/80 pt-2"
                    >
                      {/* Row 1: Framed 60s Live Telemetry Sparkline & Auto-Heal Status Pill */}
                      <div className="flex items-center justify-between gap-2 rounded-md border border-nb-gray-800/80 bg-nb-gray-950/80 px-2 py-1">
                        <div
                          className="flex items-center gap-1.5 min-w-0"
                          title={t(
                            "60s Echtzeit-Latenz-Verlauf",
                            "60s real-time latency sparkline"
                          )}
                        >
                          <span className="shrink-0 font-mono text-[8.5px] uppercase tracking-wider text-nb-gray-400">
                            60s
                          </span>
                          <svg
                            width="64"
                            height="14"
                            viewBox="0 0 64 14"
                            className="shrink-0 rounded bg-nb-gray-940/90 px-0.5"
                          >
                            <line
                              x1="0"
                              y1="7"
                              x2="64"
                              y2="7"
                              stroke="#262a33"
                              strokeDasharray="2 2"
                              strokeWidth="0.8"
                            />
                            <polygon
                              fill={
                                healthy
                                  ? "rgba(52, 211, 153, 0.16)"
                                  : "rgba(248, 113, 113, 0.16)"
                              }
                              points={sparkAreaPts}
                            />
                            <polyline
                              fill="none"
                              stroke={healthy ? "#34d399" : "#f87171"}
                              strokeWidth="1.6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points={sparkPts}
                            />
                          </svg>
                        </div>

                        <div className="shrink-0">
                          {isHealingNow ? (
                            <span className="inline-flex items-center gap-1 rounded border border-amber-500/50 bg-amber-950/90 px-1.5 py-0.5 font-mono text-[8.5px] leading-none font-semibold text-amber-300 animate-pulse">
                              <RefreshCw className="h-2.5 w-2.5 shrink-0 animate-spin" />
                              <span>{t("Heilung...", "Healing...")}</span>
                            </span>
                          ) : !healthy ? (
                            <span className="inline-flex items-center gap-1 rounded border border-red-500/40 bg-red-950/80 px-1.5 py-0.5 font-mono text-[8.5px] leading-none font-semibold text-red-300">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400 animate-pulse" />
                              <span>
                                {t(
                                  "Offline · Heal bereit",
                                  "Offline · Heal ready"
                                )}
                              </span>
                            </span>
                          ) : latestHeal ? (
                            <span
                              title={`${latestHeal.trigger} · HTTP ${latestHeal.http_status} (${latestHeal.mttr_ms} ms)`}
                              className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-950/80 px-1.5 py-0.5 font-mono text-[8.5px] leading-none font-semibold text-emerald-300"
                            >
                              <span>
                                ⚡ {t("Geheilt", "Healed")} ·{" "}
                                {latestHeal.mttr_ms}ms
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-mono text-[8.5px] leading-none text-emerald-400/90">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                              <span>
                                {t("Auto-Heal aktiv", "Auto-Heal active")}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Row 2: Full-Width 5-Button Quick-Action Bar */}
                      <div className="flex items-center justify-between gap-1">
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
                          className="flex flex-1 items-center justify-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-1 font-mono text-[8.5px] leading-none text-nb-gray-300 hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-40 transition"
                        >
                          <RotateCcw
                            className={`h-2.5 w-2.5 shrink-0 ${
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
                          className="flex flex-1 items-center justify-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-1 font-mono text-[8.5px] leading-none text-nb-gray-300 hover:border-sky-500/50 hover:text-sky-300 disabled:opacity-40 transition"
                        >
                          <Activity
                            className={`h-2.5 w-2.5 shrink-0 ${
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
                          className="flex flex-1 items-center justify-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-1 font-mono text-[8.5px] leading-none text-nb-gray-300 hover:border-violet-500/50 hover:text-violet-300 transition"
                        >
                          <FileText className="h-2.5 w-2.5 shrink-0 text-violet-400" />
                          <span>Logs</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleOpenHotReloadModal(svc);
                          }}
                          title={t(
                            "Quellcode im Live-Editor öffnen & per Hot-Reload starten",
                            "Open source code in Live Editor & Hot-Reload"
                          )}
                          className="flex flex-1 items-center justify-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-1 font-mono text-[8.5px] leading-none text-nb-gray-300 hover:border-amber-500/50 hover:text-amber-300 transition"
                        >
                          <Code2 className="h-2.5 w-2.5 shrink-0 text-amber-400" />
                          <span>Code</span>
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
                          className="inline-flex shrink-0 items-center justify-center rounded border border-nb-gray-800 bg-nb-gray-950 p-1 text-nb-gray-300 hover:border-netbird/60 hover:text-white transition"
                        >
                          <ExternalLink className="h-2.5 w-2.5 text-netbird" />
                        </button>
                        {onRemoveService && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveService(
                                svc.service_id,
                                svc.node_id,
                                svc.port
                              );
                            }}
                            title={t(
                              "Diesen Dienst aus dem Projekt entfernen",
                              "Remove this service from the project"
                            )}
                            className="inline-flex shrink-0 items-center justify-center rounded border border-nb-gray-800 bg-nb-gray-950 p-1 text-nb-gray-400 hover:border-red-500/50 hover:text-red-300 transition"
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        )}
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
    </>
  );
}
