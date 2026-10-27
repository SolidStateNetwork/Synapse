"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Bot,
  ChevronRight,
  Code2,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  FolderGit2,
  Globe,
  KeyRound,
  Maximize2,
  MonitorSmartphone,
  Plus,
  RotateCcw,
  Server,
  Shield,
  Sparkles,
  Terminal as TerminalIcon,
  Wrench,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

export type AutonomyTier =
  | "TIER_1_UNLEASHED"
  | "TIER_2_WORKSPACE_JAIL"
  | "TIER_3_SUPERVISED";

export type FlowView = "peers" | "ai-agent" | "groups" | "networks";

interface NodeHeartbeat {
  node_id: string;
  hostname: string;
  os_arch: string;
  os_info?: string;
  public_ipv4?: string;
  private_ipv4?: string;
  tier: AutonomyTier;
  cpu_percent: number;
  ram_percent: number;
  disk_percent: number;
  active_pty_sessions: string[];
  timestamp_unix: number;
}

interface GatewayNode {
  node_id: string;
  tier: AutonomyTier;
  remote_addr: string;
  connected_at: string;
  online: boolean;
  last_heartbeat?: NodeHeartbeat;
}

interface CartridgeMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
}

interface RegisteredService {
  service_id: string;
  node_id: string;
  name: string;
  category?: "webui" | "backend" | "database" | "worker";
  description?: string;
  db_path?: string;
  endpoints?: Array<{
    id: string;
    label: string;
    method: "GET" | "POST" | "PUT" | "DELETE" | "SQL";
    path: string;
    description?: string;
    sample_payload?: string;
  }>;
  port: number;
  protocol: "http" | "tcp";
  path?: string;
  healthy?: boolean;
  health_check?: {
    type: "HTTP" | "TCP" | "SYSTEMD" | "EXEC";
    target: string;
    interval_sec: number;
    status: "HEALTHY" | "UNHEALTHY" | "UNKNOWN";
    last_checked?: string;
    last_error?: string;
  };
}

interface Props {
  flowView: FlowView;
  gatewayNodes: GatewayNode[];
  primaryNode: string;
  activeCartridges: string[];
  cartridges: CartridgeMeta[];
  registeredServices: RegisteredService[];
  secretKeysCount: number;
  modelName: string;
  baseUrl: string;
  joinTier: AutonomyTier;
  onSelectNode: (nodeId: string) => void;
  onToggleCartridge: (cartridgeId: string) => void;
  onOpenAddPeer: () => void;
  onOpenPty: () => void;
  onOpenAiSettings: () => void;
  onOpenBrainDoc: (doc: "Architecture.md" | "Memory.md") => void;
  onOpenSecretsVault: () => void;
  onOpenReverseProxy: (port?: number) => void;
  onOpenAccessControl: () => void;
  onOpenRemoteFiles: () => void;
  onDeployDemoService: () => void;
  onHealService: (port: number) => void;
}

interface CanvasPos {
  x: number;
  y: number;
}

interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  color: string;
  active: boolean;
}

type InspectedTarget =
  | { kind: "peer"; nodeId: string }
  | { kind: "core" }
  | { kind: "service"; serviceId: string }
  | null;

export default function InteractiveControlCenterCanvas({
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
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [pan, setPan] = useState<CanvasPos>({ x: 60, y: 60 });
  const [zoom, setZoom] = useState<number>(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const [positions, setPositions] = useState<Record<string, CanvasPos>>({});
  const [sizes, setSizes] = useState<
    Record<string, { w: number; h: number }>
  >({});

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragNodeStartRef = useRef<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  // Progressive Disclosure: Click any node to open its clean detail drawer
  const [inspected, setInspected] = useState<InspectedTarget>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const peerIdsKey = useMemo(
    () =>
      gatewayNodes.length > 0
        ? gatewayNodes.map((n) => n.node_id).join(",")
        : "empty",
    [gatewayNodes]
  );

  const serviceIdsKey = useMemo(
    () =>
      registeredServices.length > 0
        ? registeredServices.map((s) => s.service_id).join(",")
        : "empty",
    [registeredServices]
  );

  // Clean 3-column Hub-and-Spoke layout:
  // Left: Muscle Peers -> Center: 1 Unified Synapse Core Hub -> Right: Reachable Services
  const computeDefaultLayout = useCallback((): Record<string, CanvasPos> => {
    const next: Record<string, CanvasPos> = {};
    const peerIds =
      peerIdsKey !== "empty"
        ? peerIdsKey.split(",").map((id) => `peer:${id}`)
        : ["peer:empty"];

    const serviceIds =
      serviceIdsKey !== "empty"
        ? serviceIdsKey.split(",").map((id) => `svc:${id}`)
        : ["svc:empty"];

    const maxRows = Math.max(peerIds.length, serviceIds.length, 2);
    const centerHeight = maxRows * 110;
    const coreY = Math.max(120, Math.round(centerHeight / 2) - 10);

    peerIds.forEach((id, idx) => {
      const totalH = (peerIds.length - 1) * 115;
      const startY = Math.max(80, coreY - Math.round(totalH / 2));
      next[id] = { x: 60, y: startY + idx * 115 };
    });

    next["core:hub"] = { x: 430, y: coreY - 24 };

    serviceIds.forEach((id, idx) => {
      const totalH = (serviceIds.length - 1) * 100;
      const startY = Math.max(80, coreY - Math.round(totalH / 2));
      next[id] = { x: 800, y: startY + idx * 100 };
    });

    return next;
  }, [peerIdsKey, serviceIdsKey]);

  useEffect(() => {
    const defaults = computeDefaultLayout();
    setPositions((prev) => {
      const merged: Record<string, CanvasPos> = { ...defaults };
      for (const k of Object.keys(defaults)) {
        if (prev[k]) {
          merged[k] = prev[k];
        }
      }
      return merged;
    });
  }, [computeDefaultLayout]);

  const measureNodes = useCallback(() => {
    setSizes((prev) => {
      let changed = false;
      const nextSizes: Record<string, { w: number; h: number }> = { ...prev };
      for (const [id, el] of Object.entries(nodeRefs.current)) {
        if (el) {
          const w = el.offsetWidth || 240;
          const h = el.offsetHeight || 64;
          if (!prev[id] || prev[id].w !== w || prev[id].h !== h) {
            nextSizes[id] = { w, h };
            changed = true;
          }
        }
      }
      return changed ? nextSizes : prev;
    });
  }, []);

  useEffect(() => {
    measureNodes();
    const timer = setTimeout(measureNodes, 80);
    window.addEventListener("resize", measureNodes);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measureNodes);
    };
  }, [measureNodes, gatewayNodes.length, registeredServices.length]);

  const handleFitView = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const targetW = 1120;
    const targetH = 440;
    const scaleX = (rect.width - 80) / targetW;
    const scaleY = (rect.height - 80) / targetH;
    const nextZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.7), 1.12);
    const offsetX = Math.max(32, (rect.width - targetW * nextZoom) / 2);
    const offsetY = Math.max(32, (rect.height - targetH * nextZoom) / 2);
    setZoom(Number(nextZoom.toFixed(2)));
    setPan({ x: Math.round(offsetX), y: Math.round(offsetY) });
  }, []);

  useEffect(() => {
    handleFitView();
  }, [handleFitView]);

  const handleResetLayout = () => {
    setPositions(computeDefaultLayout());
    handleFitView();
  };

  // Clean Hub-and-Spoke edges (no crossing spaghetti!)
  const edges = useMemo<CanvasEdge[]>(() => {
    const list: CanvasEdge[] = [];
    const peerIds =
      peerIdsKey !== "empty"
        ? peerIdsKey.split(",").map((id) => `peer:${id}`)
        : ["peer:empty"];
    const serviceIds =
      serviceIdsKey !== "empty"
        ? serviceIdsKey.split(",").map((id) => `svc:${id}`)
        : ["svc:empty"];

    for (const pid of peerIds) {
      list.push({
        id: `${pid}->core:hub`,
        from: pid,
        to: "core:hub",
        color: "#f68330",
        active: pid !== "peer:empty",
      });
    }

    for (const sid of serviceIds) {
      list.push({
        id: `core:hub->${sid}`,
        from: "core:hub",
        to: sid,
        color: "#38bdf8",
        active: sid !== "svc:empty",
      });
    }

    return list;
  }, [peerIdsKey, serviceIdsKey]);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (dragNodeStartRef.current) {
        const d = dragNodeStartRef.current;
        const dx = (e.clientX - d.startClientX) / zoom;
        const dy = (e.clientY - d.startClientY) / zoom;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          d.moved = true;
        }
        setPositions((prev) => ({
          ...prev,
          [d.nodeId]: {
            x: Math.round(d.origX + dx),
            y: Math.round(d.origY + dy),
          },
        }));
        return;
      }

      if (isPanning && panStartRef.current) {
        const p = panStartRef.current;
        setPan({
          x: p.panX + (e.clientX - p.startX),
          y: p.panY + (e.clientY - p.startY),
        });
      }
    }

    function onPointerUp() {
      if (dragNodeStartRef.current) {
        dragNodeStartRef.current = null;
        setDraggingNodeId(null);
      }
      if (isPanning) {
        setIsPanning(false);
        panStartRef.current = null;
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [zoom, isPanning]);

  function startNodeDrag(e: React.PointerEvent, nodeId: string) {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a")) {
      return;
    }
    e.stopPropagation();
    const pos = positions[nodeId] || { x: 0, y: 0 };
    setDraggingNodeId(nodeId);
    dragNodeStartRef.current = {
      nodeId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
    };
  }

  function handleWheel(e: React.WheelEvent) {
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.07 : 0.93;
      setZoom((prev) =>
        Number(Math.min(Math.max(prev * factor, 0.5), 1.6).toFixed(2))
      );
    }
  }

  function getEdgeCoords(fromId: string, toId: string) {
    const p1 = positions[fromId] || { x: 60, y: 120 };
    const defaultS1 =
      fromId === "core:hub"
        ? { w: 265, h: 108 }
        : fromId.startsWith("peer:")
        ? { w: 250, h: 66 }
        : { w: 255, h: 62 };
    const defaultS2 =
      toId === "core:hub"
        ? { w: 265, h: 108 }
        : toId.startsWith("peer:")
        ? { w: 250, h: 66 }
        : { w: 255, h: 62 };

    const s1 = sizes[fromId] || defaultS1;
    const s2 = sizes[toId] || defaultS2;

    const c1CenterX = p1.x + s1.w / 2;
    const c2CenterX = p2.x + s2.w / 2;
    const leftToRight = c1CenterX <= c2CenterX;

    const x1 = leftToRight ? p1.x + s1.w : p1.x;
    const y1 = p1.y + s1.h / 2;
    const x2 = leftToRight ? p2.x : p2.x + s2.w;
    const y2 = p2.y + s2.h / 2;

    const dx = Math.max(Math.abs(x2 - x1) * 0.45, 48);
    const c1x = leftToRight ? x1 + dx : x1 - dx;
    const c2x = leftToRight ? x2 - dx : x2 + dx;
    const d = `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;

    return { x1, y1, x2, y2, d };
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

  const inspectedPeer =
    inspected?.kind === "peer"
      ? gatewayNodes.find((n) => n.node_id === inspected.nodeId) || null
      : null;

  const inspectedService =
    inspected?.kind === "service"
      ? registeredServices.find((s) => s.service_id === inspected.serviceId) ||
        null
      : null;

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        setInspected(null);
        setIsPanning(true);
        panStartRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          panX: pan.x,
          panY: pan.y,
        };
      }}
      className={`nb-canvas-grid relative h-full w-full overflow-hidden select-none ${
        isPanning ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      {/* Subtle Top-Left Hint Pill */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-auto absolute left-5 top-4 z-20 flex items-center gap-2 rounded-full border border-nb-gray-800/80 bg-nb-gray-940/90 px-3.5 py-1.5 text-[11px] text-nb-gray-300 backdrop-blur"
      >
        <span className="h-2 w-2 rounded-full bg-green-400" />
        <span>Klicke auf ein Element für Details</span>
      </div>

      {/* TRANSFORMED GRAPH LAYER */}
      <div
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
        className="absolute left-0 top-0 h-[1000px] w-[1400px]"
      >
        {/* Subtle Column Labels */}
        <div
          style={{ left: 60, top: 28 }}
          className="pointer-events-none absolute font-mono text-[10px] font-medium uppercase tracking-widest text-nb-gray-500"
        >
          Server (Peers)
        </div>
        <div
          style={{ left: 430, top: 28 }}
          className="pointer-events-none absolute font-mono text-[10px] font-medium uppercase tracking-widest text-nb-gray-500"
        >
          Synapse Core
        </div>
        <div
          style={{ left: 800, top: 28 }}
          className="pointer-events-none absolute font-mono text-[10px] font-medium uppercase tracking-widest text-nb-gray-500"
        >
          Erreichbare Services
        </div>

        {/* CLEAN BEZIER EDGES (Zero-Lag Solid Base + Smooth Directional Flow) */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          style={{ zIndex: 1 }}
        >
          {edges.map((edge) => {
            const { x1, y1, x2, y2, d } = getEdgeCoords(edge.from, edge.to);
            const isHovered =
              hoveredNodeId &&
              (edge.from === hoveredNodeId || edge.to === hoveredNodeId);

            return (
              <g
                key={edge.id}
                style={{
                  opacity: isHovered ? 1 : edge.active ? 0.85 : 0.3,
                }}
              >
                {/* Solid underlying connection track (never jitters while dragging) */}
                <path
                  d={d}
                  fill="none"
                  stroke={edge.color}
                  strokeOpacity={isHovered ? 0.45 : 0.22}
                  strokeWidth={isHovered ? 2.4 : 1.6}
                />
                {/* Animated directional dash stream */}
                <path
                  d={d}
                  fill="none"
                  stroke={edge.color}
                  strokeWidth={isHovered ? 2.2 : 1.6}
                  strokeLinecap="round"
                  strokeDasharray="8 8"
                  className={
                    edge.active && !draggingNodeId ? "cc-animated-edge" : ""
                  }
                />
                {/* Smooth travelling packet pulse */}
                {edge.active && (
                  <circle r={2.8} fill={edge.color}>
                    <animateMotion
                      dur="2.2s"
                      repeatCount="indefinite"
                      path={d}
                    />
                  </circle>
                )}
                {/* Port anchor dots */}
                <circle
                  cx={x1}
                  cy={y1}
                  r={3.2}
                  fill="#181a1d"
                  stroke={edge.color}
                  strokeWidth={1.8}
                />
                <circle
                  cx={x2}
                  cy={y2}
                  r={3.2}
                  fill="#181a1d"
                  stroke={edge.color}
                  strokeWidth={1.8}
                />
              </g>
            );
          })}
        </svg>

        {/* 1. LEFT: MINIMALIST SERVER CARDS (GPU-accelerated translate3d, zero CSS position transition lag) */}
        {peerNodesToRender.map((gn) => {
          const nodeKey =
            gn.node_id === "empty" ? "peer:empty" : `peer:${gn.node_id}`;
          const pos = positions[nodeKey] || { x: 60, y: 120 };
          const hb = gn.last_heartbeat;
          const isSelected =
            (inspected?.kind === "peer" && inspected.nodeId === gn.node_id) ||
            primaryNode === gn.node_id;

          return (
            <div
              key={nodeKey}
              ref={(el) => {
                nodeRefs.current[nodeKey] = el;
              }}
              style={{
                left: 0,
                top: 0,
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                willChange: "transform",
                zIndex: draggingNodeId === nodeKey ? 30 : 10,
              }}
              onPointerDown={(e) => startNodeDrag(e, nodeKey)}
              onMouseEnter={() => setHoveredNodeId(nodeKey)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (gn.node_id === "empty") {
                  onOpenAddPeer();
                } else {
                  onSelectNode(gn.node_id);
                  setInspected({ kind: "peer", nodeId: gn.node_id });
                }
              }}
              className={`absolute w-[250px] rounded-xl border bg-nb-gray-940 px-4 py-3.5 shadow-lg transition-colors duration-150 ${
                draggingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-netbird shadow-2xl"
                  : "cursor-pointer hover:border-nb-gray-700 hover:bg-nb-gray-930"
              } ${
                isSelected
                  ? "border-netbird/80 ring-1 ring-netbird/30"
                  : "border-nb-gray-800"
              }`}
            >
              {gn.node_id === "empty" ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-nb-gray-300">Kein Server verbunden</span>
                  <span className="text-netbird font-medium">+ Verbinden</span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-nb-gray-800 bg-nb-gray-950 text-netbird">
                      <Server className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            gn.online ? "bg-green-400" : "bg-nb-gray-500"
                          }`}
                        />
                        <span className="truncate font-mono text-xs font-semibold text-white">
                          {gn.node_id}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-nb-gray-400 mt-0.5">
                        {hb?.private_ipv4 || "Online"} ·{" "}
                        {gn.tier === "TIER_1_UNLEASHED"
                          ? "Tier 1"
                          : gn.tier === "TIER_2_WORKSPACE_JAIL"
                          ? "Tier 2"
                          : "Tier 3"}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-nb-gray-500" />
                </div>
              )}
            </div>
          );
        })}

        {/* 2. CENTER: UNIFIED SYNAPSE CORE HUB NODE */}
        {(() => {
          const nodeKey = "core:hub";
          const pos = positions[nodeKey] || { x: 430, y: 120 };
          const isSelected = inspected?.kind === "core";

          return (
            <div
              ref={(el) => {
                nodeRefs.current[nodeKey] = el;
              }}
              style={{
                left: 0,
                top: 0,
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                willChange: "transform",
                zIndex: draggingNodeId === nodeKey ? 30 : 10,
              }}
              onPointerDown={(e) => startNodeDrag(e, nodeKey)}
              onMouseEnter={() => setHoveredNodeId(nodeKey)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onClick={(e) => {
                e.stopPropagation();
                setInspected({ kind: "core" });
              }}
              className={`absolute w-[265px] rounded-2xl border bg-nb-gray-940 p-4 shadow-xl transition-colors duration-150 ${
                draggingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-netbird shadow-2xl"
                  : "cursor-pointer hover:border-netbird/70 hover:bg-nb-gray-930"
              } ${
                isSelected
                  ? "border-netbird ring-2 ring-netbird/30"
                  : "border-nb-gray-800"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-netbird-500/40 bg-netbird-950 text-netbird">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white">
                      Synapse Core Hub
                    </div>
                    <div className="truncate font-mono text-[11px] text-netbird mt-0.5">
                      {modelName}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-nb-gray-500" />
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-nb-gray-800/80 pt-2.5 text-[11px] text-nb-gray-400">
                <span className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{activeCartridges.length} Regeln aktiv</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <FolderGit2 className="h-3.5 w-3.5 text-sky-400" />
                  <span>Brain Vault</span>
                </span>
              </div>
            </div>
          );
        })()}

        {/* 3. RIGHT: MINIMALIST REACHABLE SERVICE CARDS */}
        {(registeredServices.length > 0
          ? registeredServices
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
          const pos = positions[nodeKey] || { x: 800, y: 120 };
          const healthy =
            svc.healthy !== false && svc.health_check?.status !== "UNHEALTHY";
          const isSelected =
            inspected?.kind === "service" &&
            inspected.serviceId === svc.service_id;
          const cat = svc.category || "backend";

          return (
            <div
              key={nodeKey}
              ref={(el) => {
                nodeRefs.current[nodeKey] = el;
              }}
              style={{
                left: 0,
                top: 0,
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                willChange: "transform",
                zIndex: draggingNodeId === nodeKey ? 30 : 10,
              }}
              onPointerDown={(e) => startNodeDrag(e, nodeKey)}
              onMouseEnter={() => setHoveredNodeId(nodeKey)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (svc.service_id !== "empty") {
                  setInspected({ kind: "service", serviceId: svc.service_id });
                }
              }}
              className={`absolute w-[255px] rounded-xl border bg-nb-gray-940 px-4 py-3 shadow-lg transition-colors duration-150 ${
                draggingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-sky-400 shadow-2xl"
                  : "cursor-pointer hover:border-nb-gray-700 hover:bg-nb-gray-930"
              } ${
                isSelected
                  ? "border-sky-400 ring-1 ring-sky-400/30"
                  : "border-nb-gray-800"
              }`}
            >
              {svc.service_id === "empty" ? (
                <div className="text-xs text-nb-gray-400 py-1">
                  Noch keine Dienste bereitgestellt
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-nb-gray-800 bg-nb-gray-950 text-sky-400">
                      {cat === "database" ? (
                        <Database className="h-4 w-4 text-purple-400" />
                      ) : cat === "webui" ? (
                        <Globe className="h-4 w-4 text-sky-400" />
                      ) : (
                        <Zap className="h-4 w-4 text-netbird" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            healthy
                              ? "bg-green-400"
                              : "bg-red-500 animate-pulse"
                          }`}
                        />
                        <span className="truncate text-xs font-semibold text-white">
                          {svc.name}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] text-nb-gray-400 mt-0.5">
                        {cat === "webui"
                          ? "WebUI"
                          : cat === "database"
                          ? "Datenbank"
                          : "Backend API"}{" "}
                        · :{svc.port}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-nb-gray-500" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PROGRESSIVE DISCLOSURE: SLIDE-OVER DETAIL INSPECTOR (ON CLICK)
      ═══════════════════════════════════════════════════════════════════ */}
      {inspected && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute right-4 top-4 bottom-4 z-30 flex w-[340px] flex-col rounded-2xl border border-nb-gray-800 bg-nb-gray-940/95 p-5 shadow-2xl backdrop-blur overflow-y-auto"
        >
          {/* CASE 1: INSPECTING A MUSCLE SERVER */}
          {inspectedPeer && (
            <div className="space-y-4">
              <div className="flex items-start justify-between border-b border-nb-gray-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        inspectedPeer.online ? "bg-green-400" : "bg-nb-gray-500"
                      }`}
                    />
                    <h3 className="font-mono text-sm font-semibold text-white">
                      {inspectedPeer.node_id}
                    </h3>
                  </div>
                  <p className="text-[11px] text-nb-gray-400 mt-0.5">
                    {inspectedPeer.last_heartbeat?.os_info ||
                      inspectedPeer.last_heartbeat?.os_arch ||
                      "Linux x86_64"}
                  </p>
                </div>
                <button
                  onClick={() => setInspected(null)}
                  className="rounded-lg p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-nb-gray-400">
                  <span>IPv4-Adresse</span>
                  <span className="font-mono text-white">
                    {inspectedPeer.last_heartbeat?.private_ipv4 || "127.0.0.1"}
                  </span>
                </div>
                <div className="flex justify-between text-nb-gray-400">
                  <span>Sicherheits-Stufe</span>
                  <span className="font-mono text-netbird">
                    {inspectedPeer.tier}
                  </span>
                </div>
              </div>

              {inspectedPeer.last_heartbeat && (
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-3 font-mono text-xs">
                  <div>
                    <div className="text-[10px] text-nb-gray-400">CPU</div>
                    <div className="mt-0.5 font-semibold text-white">
                      {inspectedPeer.last_heartbeat.cpu_percent.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-nb-gray-400">RAM</div>
                    <div className="mt-0.5 font-semibold text-white">
                      {inspectedPeer.last_heartbeat.ram_percent.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-nb-gray-400">DISK</div>
                    <div className="mt-0.5 font-semibold text-white">
                      {inspectedPeer.last_heartbeat.disk_percent.toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    onSelectNode(inspectedPeer.node_id);
                    onOpenPty();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-netbird py-2.5 text-xs font-medium text-white hover:bg-netbird-500 transition"
                >
                  <TerminalIcon className="h-3.5 w-3.5" />
                  <span>Live Terminal öffnen</span>
                </button>
                <button
                  onClick={() => {
                    onSelectNode(inspectedPeer.node_id);
                    onOpenRemoteFiles();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-nb-gray-800 bg-nb-gray-930 py-2.5 text-xs font-medium text-nb-gray-200 hover:text-white transition"
                >
                  <Code2 className="h-3.5 w-3.5 text-sky-400" />
                  <span>Dateien durchsuchen</span>
                </button>
              </div>
            </div>
          )}

          {/* CASE 2: INSPECTING SYNAPSE CORE HUB */}
          {inspected.kind === "core" && (
            <div className="space-y-5">
              <div className="flex items-start justify-between border-b border-nb-gray-800 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Synapse Core Hub
                  </h3>
                  <p className="text-[11px] text-nb-gray-400 mt-0.5">
                    KI-Engine, Brain Vault &amp; aktive Sicherheitsregeln
                  </p>
                </div>
                <button
                  onClick={() => setInspected(null)}
                  className="rounded-lg p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* AI Engine */}
              <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-white">{modelName}</span>
                  <button
                    onClick={onOpenAiSettings}
                    className="text-[11px] text-netbird hover:underline"
                  >
                    Ändern →
                  </button>
                </div>
                <div className="truncate font-mono text-[10px] text-nb-gray-400">
                  {baseUrl}
                </div>
              </div>

              {/* Brain Vault */}
              <div className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-wider text-nb-gray-400">
                  Projekt-Dokumentation &amp; Tresor
                </div>
                <button
                  onClick={() => onOpenBrainDoc("Architecture.md")}
                  className="flex w-full items-center justify-between rounded-xl border border-nb-gray-800 bg-nb-gray-930 px-3 py-2 text-xs text-nb-gray-200 hover:border-netbird"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-netbird" />
                    <span>Architecture.md</span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-nb-gray-500" />
                </button>
                <button
                  onClick={() => onOpenBrainDoc("Memory.md")}
                  className="flex w-full items-center justify-between rounded-xl border border-nb-gray-800 bg-nb-gray-930 px-3 py-2 text-xs text-nb-gray-200 hover:border-netbird"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                    <span>Memory.md</span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-nb-gray-500" />
                </button>
                <button
                  onClick={onOpenSecretsVault}
                  className="flex w-full items-center justify-between rounded-xl border border-nb-gray-800 bg-nb-gray-930 px-3 py-2 text-xs text-nb-gray-200 hover:border-netbird"
                >
                  <span className="flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                    <span>Secrets.enc ({secretKeysCount})</span>
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-nb-gray-500" />
                </button>
              </div>

              {/* Rule Cartridges Quick Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-nb-gray-400">
                    Sicherheits-Cartridges
                  </span>
                  <button
                    onClick={onOpenAccessControl}
                    className="text-[11px] text-netbird hover:underline"
                  >
                    Details →
                  </button>
                </div>
                <div className="space-y-1.5">
                  {cartridges.map((c) => {
                    const enabled = activeCartridges.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => onToggleCartridge(c.id)}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-nb-gray-800/80 bg-nb-gray-950 px-3 py-2 text-xs hover:border-nb-gray-700"
                      >
                        <span className="truncate text-nb-gray-200 pr-2">
                          {c.name}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold ${
                            enabled
                              ? "bg-green-950 text-green-400"
                              : "bg-nb-gray-900 text-nb-gray-500"
                          }`}
                        >
                          {enabled ? "ON" : "OFF"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* CASE 3: INSPECTING A SERVICE */}
          {inspectedService && (
            <div className="space-y-4">
              <div className="flex items-start justify-between border-b border-nb-gray-800 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {inspectedService.name}
                  </h3>
                  <p className="font-mono text-[11px] text-nb-gray-400 mt-0.5">
                    {inspectedService.node_id}:{inspectedService.port}
                  </p>
                </div>
                <button
                  onClick={() => setInspected(null)}
                  className="rounded-lg p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {inspectedService.description && (
                <p className="text-xs text-nb-gray-300 leading-relaxed">
                  {inspectedService.description}
                </p>
              )}

              {inspectedService.endpoints &&
                inspectedService.endpoints.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-nb-gray-400">
                      Verfügbare Aktionen
                    </div>
                    <div className="space-y-1.5">
                      {inspectedService.endpoints.map((ep) => (
                        <button
                          key={ep.id}
                          onClick={() =>
                            onOpenReverseProxy(inspectedService.port)
                          }
                          className="flex w-full items-center justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 text-xs text-nb-gray-200 hover:border-netbird"
                        >
                          <span>
                            <strong className="font-mono text-netbird mr-1.5">
                              {ep.method}
                            </strong>
                            {ep.label}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-nb-gray-500" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => onOpenReverseProxy(inspectedService.port)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-netbird py-2.5 text-xs font-medium text-white hover:bg-netbird-500 transition"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>Vorschau &amp; Tester öffnen</span>
                </button>
                {inspectedService.healthy === false && (
                  <button
                    onClick={() => onHealService(inspectedService.port)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-2 text-xs font-medium text-white hover:bg-red-500"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    <span>Auto-Heal starten</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom-Left Zoom Controls */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-auto absolute bottom-4 left-5 z-20 flex items-center gap-1 rounded-xl border border-nb-gray-800 bg-nb-gray-940/90 p-1 shadow-lg backdrop-blur"
      >
        <button
          onClick={() =>
            setZoom((z) => Number(Math.min(z + 0.12, 1.6).toFixed(2)))
          }
          className="rounded-lg p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title="Zoom In"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <span className="px-1.5 font-mono text-[10px] text-nb-gray-300">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() =>
            setZoom((z) => Number(Math.max(z - 0.12, 0.5).toFixed(2)))
          }
          className="rounded-lg p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title="Zoom Out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <div className="h-3.5 w-[1px] bg-nb-gray-800 mx-0.5" />
        <button
          onClick={handleFitView}
          className="rounded-lg p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title="Ansicht zentrieren"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleResetLayout}
          className="rounded-lg p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title="Layout zurücksetzen"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
