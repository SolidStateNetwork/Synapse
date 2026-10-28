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
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
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
  Move,
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
  firewallPolicies?: Record<
    string,
    {
      profile: "web_standard" | "synapse_stealth" | "custom";
      shielded_ports?: number[];
      ip_rules?: unknown[];
    }
  >;
  onOpenFirewall?: (nodeId?: string) => void;
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
  firewallPolicies,
  onOpenFirewall,
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
  const lastDragMovedRef = useRef<boolean>(false);
  const dragNodeStartRef = useRef<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  // Progressive Disclosure: Click any node to open its clean detail drawer, or expand inline on canvas
  const [inspected, setInspected] = useState<InspectedTarget>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [inspectorPos, setInspectorPos] = useState<CanvasPos | null>(null);
  const dragInspectorRef = useRef<{
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);

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
        ? registeredServices
            .map((s) => `${s.service_id}@${s.node_id || ""}`)
            .join(",")
        : "empty",
    [registeredServices]
  );

  // Clean 3-column Hierarchical Layout:
  // Left: Synapse Core Hub -> Center: Muscle Peers -> Right: Services grouped directly behind their owning Muscle
  const buildHierarchicalLayout = useCallback(
    (expanded: boolean): Record<string, CanvasPos> => {
      const next: Record<string, CanvasPos> = {};
      const rawPeerIds =
        peerIdsKey !== "empty" ? peerIdsKey.split(",") : ["empty"];
      const peerStep = expanded ? 205 : 118;
      const svcStep = expanded ? 226 : 98;

      const servicesByPeer = new Map<string, RegisteredService[]>();
      for (const pid of rawPeerIds) {
        servicesByPeer.set(pid, []);
      }
      for (const svc of registeredServices) {
        const targetPeer =
          svc.node_id && servicesByPeer.has(svc.node_id)
            ? svc.node_id
            : rawPeerIds[0];
        servicesByPeer.get(targetPeer)?.push(svc);
      }

      let cursorY = expanded ? 20 : 36;
      const peerYs: number[] = [];

      rawPeerIds.forEach((rawId) => {
        const peerKey = `peer:${rawId}`;
        const owned = servicesByPeer.get(rawId) || [];
        if (owned.length > 0) {
          const firstSvcY = cursorY;
          owned.forEach((svc, idx) => {
            next[`svc:${svc.service_id}`] = {
              x: 790,
              y: firstSvcY + idx * svcStep,
            };
          });
          const lastSvcY = firstSvcY + (owned.length - 1) * svcStep;
          const peerY = Math.round((firstSvcY + lastSvcY) / 2);
          next[peerKey] = { x: 420, y: peerY };
          peerYs.push(peerY);
          cursorY = Math.max(lastSvcY + svcStep, peerY + peerStep) + 14;
        } else {
          const peerY = cursorY;
          next[peerKey] = { x: 420, y: peerY };
          peerYs.push(peerY);
          cursorY += peerStep;
        }
      });

      const minPeerY = peerYs.length > 0 ? Math.min(...peerYs) : 120;
      const maxPeerY = peerYs.length > 0 ? Math.max(...peerYs) : 120;
      const midPeerY = Math.round((minPeerY + maxPeerY) / 2);

      next["core:hub"] = {
        x: 48,
        y: Math.max(36, midPeerY - (expanded ? 60 : 18)),
      };

      if (registeredServices.length === 0) {
        next["svc:empty"] = { x: 790, y: midPeerY };
      }

      return next;
    },
    [peerIdsKey, registeredServices]
  );

  const computeDefaultLayout = useCallback(
    (): Record<string, CanvasPos> => buildHierarchicalLayout(false),
    [buildHierarchicalLayout]
  );

  useEffect(() => {
    setPositions(computeDefaultLayout());
  }, [computeDefaultLayout]);

  const measureNodes = useCallback(() => {
    setSizes((prev) => {
      let changed = false;
      const nextSizes: Record<string, { w: number; h: number }> = { ...prev };
      for (const [id, el] of Object.entries(nodeRefs.current)) {
        if (el) {
          const w = el.offsetWidth || 255;
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
    const timer = setTimeout(measureNodes, 60);
    window.addEventListener("resize", measureNodes);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measureNodes);
    };
  }, [measureNodes, gatewayNodes.length, registeredServices.length, expandedNodes]);

  const toggleExpandNode = useCallback((nodeKey: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedNodes((prev) => {
      const nextExpanded = !prev[nodeKey];
      const next = { ...prev, [nodeKey]: nextExpanded };
      // If a peer or service card is expanded/collapsed, shift cards below it in the same column so they never overlap
      if (nodeKey.startsWith("svc:") || nodeKey.startsWith("peer:")) {
        const prefix = nodeKey.startsWith("svc:") ? "svc:" : "peer:";
        const deltaY = nextExpanded ? 120 : -120;
        setPositions((posPrev) => {
          const curY = posPrev[nodeKey]?.y ?? 0;
          const nextPos = { ...posPrev };
          for (const k of Object.keys(nextPos)) {
            if (k.startsWith(prefix) && k !== nodeKey && (nextPos[k]?.y ?? 0) > curY) {
              nextPos[k] = {
                x: nextPos[k].x,
                y: Math.max(24, nextPos[k].y + deltaY),
              };
            }
          }
          return nextPos;
        });
      }
      return next;
    });
    setTimeout(measureNodes, 30);
    setTimeout(measureNodes, 120);
  }, [measureNodes]);

  const allExpanded = useMemo(() => {
    const keys = [
      "core:hub",
      ...gatewayNodes.map((n) => `peer:${n.node_id}`),
      ...registeredServices.map((s) => `svc:${s.service_id}`),
    ];
    return keys.length > 0 && keys.every((k) => expandedNodes[k]);
  }, [gatewayNodes, registeredServices, expandedNodes]);

  const handleToggleExpandAll = () => {
    const target = !allExpanded;
    const next: Record<string, boolean> = { "core:hub": target };
    gatewayNodes.forEach((n) => {
      next[`peer:${n.node_id}`] = target;
    });
    registeredServices.forEach((s) => {
      next[`svc:${s.service_id}`] = target;
    });
    setExpandedNodes(next);
    // Adjust vertical spacing so expanded cards never overlap
    setPositions(() => buildHierarchicalLayout(target));
    if (target) {
      setZoom(0.75);
      setPan({ x: 64, y: 18 });
    } else {
      handleFitView();
    }
    setTimeout(measureNodes, 40);
    setTimeout(measureNodes, 150);
  };

  const handleFitView = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const targetW = 1110;
    const targetH = 440;
    const scaleX = (rect.width - 64) / targetW;
    const scaleY = (rect.height - 64) / targetH;
    const nextZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.72), 1.08);
    const offsetX = Math.max(28, (rect.width - targetW * nextZoom) / 2);
    const offsetY = Math.max(24, (rect.height - targetH * nextZoom) / 2.8);
    setZoom(Number(nextZoom.toFixed(2)));
    setPan({ x: Math.round(offsetX), y: Math.round(offsetY) });
  }, []);

  useEffect(() => {
    handleFitView();
  }, [handleFitView]);

  const handleResetLayout = () => {
    setExpandedNodes({});
    setInspectorPos(null);
    setPositions(computeDefaultLayout());
    handleFitView();
  };

  // Clean 3-tier hierarchical edges:
  // Core Hub (Left) -> Muscle Peer (Middle) -> Owned Services (Right)
  const edges = useMemo<CanvasEdge[]>(() => {
    const list: CanvasEdge[] = [];
    const rawPeerIds =
      peerIdsKey !== "empty" ? peerIdsKey.split(",") : ["empty"];
    const peerIds = rawPeerIds.map((id) => `peer:${id}`);

    for (const pid of peerIds) {
      list.push({
        id: `core:hub->${pid}`,
        from: "core:hub",
        to: pid,
        color: "#f68330",
        active: pid !== "peer:empty",
      });
    }

    if (registeredServices.length === 0) {
      const firstPeer = peerIds[0] || "core:hub";
      list.push({
        id: `${firstPeer}->svc:empty`,
        from: firstPeer,
        to: "svc:empty",
        color: "#38bdf8",
        active: false,
      });
    } else {
      for (const svc of registeredServices) {
        const ownerPeerKey =
          svc.node_id && rawPeerIds.includes(svc.node_id)
            ? `peer:${svc.node_id}`
            : peerIds[0] || "core:hub";
        list.push({
          id: `${ownerPeerKey}->svc:${svc.service_id}`,
          from: ownerPeerKey,
          to: `svc:${svc.service_id}`,
          color: "#38bdf8",
          active: true,
        });
      }
    }

    return list;
  }, [peerIdsKey, serviceIdsKey, registeredServices]);

  useEffect(() => {
    let rafId: number | null = null;
    let latestEvent: PointerEvent | null = null;

    function flushPointerMove() {
      rafId = null;
      const e = latestEvent;
      if (!e) return;

      if (dragInspectorRef.current) {
        const d = dragInspectorRef.current;
        setInspectorPos({
          x: Math.max(12, Math.round(d.origX + (e.clientX - d.startClientX))),
          y: Math.max(12, Math.round(d.origY + (e.clientY - d.startClientY))),
        });
        return;
      }

      if (dragNodeStartRef.current) {
        const d = dragNodeStartRef.current;
        const dx = (e.clientX - d.startClientX) / zoom;
        const dy = (e.clientY - d.startClientY) / zoom;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          d.moved = true;
          lastDragMovedRef.current = true;
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

    function onPointerMove(e: PointerEvent) {
      if (
        !dragInspectorRef.current &&
        !dragNodeStartRef.current &&
        !(isPanning && panStartRef.current)
      ) {
        return;
      }
      latestEvent = e;
      if (rafId === null) {
        rafId = window.requestAnimationFrame(flushPointerMove);
      }
    }

    function onPointerUp() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      latestEvent = null;
      if (dragInspectorRef.current) {
        dragInspectorRef.current = null;
      }
      if (dragNodeStartRef.current) {
        dragNodeStartRef.current = null;
        setDraggingNodeId(null);
      }
      if (isPanning) {
        setIsPanning(false);
        panStartRef.current = null;
      }
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
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
    lastDragMovedRef.current = false;
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
    const p2 = positions[toId] || { x: 430, y: 120 };
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
      {/* TRANSFORMED GRAPH LAYER */}
      <div
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
        className="absolute left-0 top-0 h-[1000px] w-[1400px]"
      >
        {/* GPU-ACCELERATED MULTI-LAYER NEURAL / MESH FLOW EDGES (Zero SVG Filters, Zero Hover Jump) */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          style={{ zIndex: 1 }}
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
              const secondaryColor = isPeerEdge ? "#fbbf24" : "#34d399";

              // IMPORTANT: Keep durations & delays 100% invariant across hover states so particles NEVER jump!
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
        </svg>

        {/* 1. MIDDLE: INTERACTIVE MUSCLE SERVER CARDS (Draggable + Inline Expandable) */}
        {peerNodesToRender.map((gn) => {
          const nodeKey =
            gn.node_id === "empty" ? "peer:empty" : `peer:${gn.node_id}`;
          const pos = positions[nodeKey] || { x: 420, y: 120 };
          const hb = gn.last_heartbeat;
          const isSelected =
            inspected?.kind === "peer" && inspected.nodeId === gn.node_id;
          const isExpanded = Boolean(expandedNodes[nodeKey]);

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
                zIndex: draggingNodeId === nodeKey ? 30 : isExpanded ? 20 : 10,
              }}
              onPointerDown={(e) => startNodeDrag(e, nodeKey)}
              onMouseEnter={() => setHoveredNodeId(nodeKey)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onDoubleClick={(e) => {
                if (gn.node_id !== "empty") toggleExpandNode(nodeKey, e);
              }}
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
                  setInspected({ kind: "peer", nodeId: gn.node_id });
                }
              }}
              className={`absolute w-[255px] rounded-xl border bg-nb-gray-940 px-4 py-3.5 shadow-lg transition-colors duration-150 ${
                draggingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-netbird shadow-2xl"
                  : "cursor-grab hover:border-nb-gray-700 hover:bg-nb-gray-930"
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
                              gn.online ? "bg-green-400" : "bg-nb-gray-500"
                            }`}
                          />
                          <span className="truncate font-mono text-xs font-semibold text-white">
                            {gn.node_id}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="truncate text-[11px] text-nb-gray-400">
                            {hb?.private_ipv4 || "Online"} ·{" "}
                            {gn.tier === "TIER_1_UNLEASHED"
                              ? "Tier 1"
                              : gn.tier === "TIER_2_WORKSPACE_JAIL"
                              ? "Tier 2"
                              : "Tier 3"}
                          </span>
                          {(() => {
                            const fwPol = firewallPolicies?.[gn.node_id];
                            const prof = fwPol?.profile || "web_standard";
                            const shieldedCount = fwPol?.shielded_ports?.length || 0;
                            const isStealth = prof === "synapse_stealth";
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectNode(gn.node_id);
                                  onOpenFirewall?.(gn.node_id);
                                }}
                                title="Firewall & Port-Schutz für diesen Server öffnen"
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
                                    ? "Stealth-Firewall"
                                    : shieldedCount > 0
                                    ? `FW · ${shieldedCount} gesperrt`
                                    : "Firewall aktiv"}
                                </span>
                              </button>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => toggleExpandNode(nodeKey, e)}
                      title={
                        isExpanded
                          ? "Details einklappen"
                          : "Details direkt im Knoten aufklappen"
                      }
                      className="rounded-md p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white transition"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* INLINE EXPANDED PEER METRICS & QUICK ACTIONS */}
                  {isExpanded && (
                    <div className="mt-3 space-y-2.5 border-t border-nb-gray-800/80 pt-2.5 text-[11px]">
                      {hb && (
                        <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 font-mono text-[10px]">
                          <div>
                            <div className="text-nb-gray-400">CPU</div>
                            <div className="font-semibold text-white">
                              {hb.cpu_percent.toFixed(1)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-nb-gray-400">RAM</div>
                            <div className="font-semibold text-white">
                              {hb.ram_percent.toFixed(1)}%
                            </div>
                          </div>
                          <div>
                            <div className="text-nb-gray-400">DISK</div>
                            <div className="font-semibold text-white">
                              {hb.disk_percent.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectNode(gn.node_id);
                            onOpenPty();
                          }}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-netbird py-1.5 text-[11px] font-medium text-white hover:bg-netbird-500"
                        >
                          <TerminalIcon className="h-3 w-3" />
                          <span>Terminal</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectNode(gn.node_id);
                            onOpenRemoteFiles();
                          }}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-nb-gray-800 bg-nb-gray-950 py-1.5 text-[11px] text-nb-gray-200 hover:text-white"
                        >
                          <Code2 className="h-3 w-3 text-sky-400" />
                          <span>Dateien</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectNode(gn.node_id);
                            onOpenFirewall?.(gn.node_id);
                          }}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                        >
                          <Shield className="h-3 w-3 text-emerald-400" />
                          <span>Firewall</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* 2. LEFT: UNIFIED SYNAPSE CORE HUB NODE (Draggable + Inline Expandable) */}
        {(() => {
          const nodeKey = "core:hub";
          const pos = positions[nodeKey] || { x: 48, y: 120 };
          const isSelected = inspected?.kind === "core";
          const isExpanded = Boolean(expandedNodes[nodeKey]);

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
                zIndex: draggingNodeId === nodeKey ? 30 : isExpanded ? 20 : 10,
              }}
              onPointerDown={(e) => startNodeDrag(e, nodeKey)}
              onMouseEnter={() => setHoveredNodeId(nodeKey)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onDoubleClick={(e) => toggleExpandNode(nodeKey, e)}
              onClick={(e) => {
                e.stopPropagation();
                if (lastDragMovedRef.current) {
                  lastDragMovedRef.current = false;
                  return;
                }
                setInspected({ kind: "core" });
              }}
              className={`absolute w-[275px] rounded-2xl border bg-nb-gray-940 p-4 shadow-xl transition-colors duration-150 ${
                draggingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-netbird shadow-2xl"
                  : "cursor-grab hover:border-netbird/70 hover:bg-nb-gray-930"
              } ${
                isSelected
                  ? "border-netbird ring-2 ring-netbird/30"
                  : "border-nb-gray-800"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
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
                <button
                  type="button"
                  onClick={(e) => toggleExpandNode(nodeKey, e)}
                  title={
                    isExpanded
                      ? "Core Hub einklappen"
                      : "Regeln & Brain Vault direkt aufklappen"
                  }
                  className="rounded-md p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white transition"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
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

              {/* INLINE EXPANDED CORE HUB CONTROLS */}
              {isExpanded && (
                <div className="mt-3 space-y-2.5 border-t border-nb-gray-800/80 pt-2.5 text-[11px]">
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenBrainDoc("Architecture.md");
                      }}
                      className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2 py-1.5 font-mono text-[10px] text-nb-gray-200 hover:border-netbird hover:text-white truncate"
                    >
                      Arch.md
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenBrainDoc("Memory.md");
                      }}
                      className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2 py-1.5 font-mono text-[10px] text-nb-gray-200 hover:border-netbird hover:text-white truncate"
                    >
                      Memory.md
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSecretsVault();
                      }}
                      className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2 py-1.5 font-mono text-[10px] text-amber-300 hover:border-amber-500 truncate"
                    >
                      Vault ({secretKeysCount})
                    </button>
                  </div>

                  <div className="space-y-1">
                    {cartridges.slice(0, 4).map((c) => {
                      const enabled = activeCartridges.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleCartridge(c.id);
                          }}
                          className="flex w-full items-center justify-between rounded-lg border border-nb-gray-800/80 bg-nb-gray-950 px-2.5 py-1 text-[10px] hover:border-nb-gray-700"
                        >
                          <span className="truncate text-nb-gray-200 pr-2">
                            {c.name}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.2 font-mono text-[9px] font-semibold ${
                              enabled
                                ? "bg-green-950 text-green-400"
                                : "bg-nb-gray-900 text-nb-gray-500"
                            }`}
                          >
                            {enabled ? "ON" : "OFF"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 3. RIGHT: INTERACTIVE SERVICE CARDS (Draggable + Inline Expandable) */}
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
          const pos = positions[nodeKey] || { x: 790, y: 120 };
          const healthy =
            svc.healthy !== false && svc.health_check?.status !== "UNHEALTHY";
          const isSelected =
            inspected?.kind === "service" &&
            inspected.serviceId === svc.service_id;
          const isExpanded = Boolean(expandedNodes[nodeKey]);
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
                zIndex: draggingNodeId === nodeKey ? 30 : isExpanded ? 20 : 10,
              }}
              onPointerDown={(e) => startNodeDrag(e, nodeKey)}
              onMouseEnter={() => setHoveredNodeId(nodeKey)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onDoubleClick={(e) => {
                if (svc.service_id !== "empty") toggleExpandNode(nodeKey, e);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (lastDragMovedRef.current) {
                  lastDragMovedRef.current = false;
                  return;
                }
                if (svc.service_id !== "empty") {
                  setInspected({ kind: "service", serviceId: svc.service_id });
                }
              }}
              className={`absolute w-[275px] rounded-xl border bg-nb-gray-940 px-4 py-3 shadow-lg transition-colors duration-150 ${
                draggingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-sky-400 shadow-2xl"
                  : "cursor-grab hover:border-nb-gray-700 hover:bg-nb-gray-930"
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
                <div>
                  <div className="flex items-center justify-between gap-2">
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
                        <div className="font-mono text-[10px] text-nb-gray-400 mt-0.5 truncate">
                          {cat === "webui"
                            ? "WebUI"
                            : cat === "database"
                            ? "Datenbank"
                            : "Backend API"}{" "}
                          · {svc.node_id} · :{svc.port}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => toggleExpandNode(nodeKey, e)}
                      title={
                        isExpanded
                          ? "Service einklappen"
                          : "Endpunkte & Aktionen direkt aufklappen"
                      }
                      className="rounded-md p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white transition"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* INLINE EXPANDED SERVICE ENDPOINTS & TESTER BUTTON */}
                  {isExpanded && (
                    <div className="mt-2.5 space-y-2 border-t border-nb-gray-800/80 pt-2 text-[11px]">
                      {svc.endpoints && svc.endpoints.length > 0 && (
                        <div className="space-y-1">
                          {svc.endpoints.slice(0, 3).map((ep) => (
                            <button
                              key={ep.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenReverseProxy(svc.port);
                              }}
                              className="flex w-full items-center justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1 text-[10px] text-nb-gray-200 hover:border-sky-400"
                            >
                              <span className="truncate">
                                <strong className="font-mono text-netbird mr-1.5">
                                  {ep.method}
                                </strong>
                                {ep.label}
                              </span>
                              <ChevronRight className="h-3 w-3 shrink-0 text-nb-gray-500" />
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenReverseProxy(svc.port);
                        }}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-netbird py-1.5 text-[11px] font-medium text-white hover:bg-netbird-500"
                      >
                        <Globe className="h-3 w-3" />
                        <span>Tester &amp; Vorschau öffnen</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PROGRESSIVE DISCLOSURE: DRAGGABLE FLOATING DETAIL INSPECTOR
      ═══════════════════════════════════════════════════════════════════ */}
      {inspected && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          style={
            inspectorPos
              ? {
                  left: `${inspectorPos.x}px`,
                  top: `${inspectorPos.y}px`,
                  right: "auto",
                  bottom: "auto",
                  maxHeight: "calc(100% - 32px)",
                }
              : undefined
          }
          className={`pointer-events-auto absolute z-30 flex w-[340px] flex-col rounded-2xl border border-nb-gray-800 bg-nb-gray-940/95 p-4 shadow-2xl backdrop-blur overflow-y-auto ${
            inspectorPos ? "" : "right-4 top-4 bottom-4"
          }`}
        >
          {/* Draggable Window Handle */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              const el = e.currentTarget.parentElement;
              const rect = el?.getBoundingClientRect();
              const parentRect = containerRef.current?.getBoundingClientRect();
              const curX = inspectorPos
                ? inspectorPos.x
                : rect && parentRect
                ? rect.left - parentRect.left
                : 400;
              const curY = inspectorPos
                ? inspectorPos.y
                : rect && parentRect
                ? rect.top - parentRect.top
                : 16;
              dragInspectorRef.current = {
                startClientX: e.clientX,
                startClientY: e.clientY,
                origX: curX,
                origY: curY,
              };
            }}
            className="mb-2 flex cursor-move items-center justify-between rounded-lg bg-nb-gray-950/70 px-2.5 py-1 text-[10px] text-nb-gray-400 hover:text-nb-gray-200"
            title="Mit der Maus ziehen, um das Detailfenster frei zu verschieben"
          >
            <span className="flex items-center gap-1.5 font-mono">
              <Move className="h-3 w-3 text-netbird" />
              <span>Detail-Inspektor (frei verschiebbar)</span>
            </span>
            <button
              type="button"
              onClick={() => setInspected(null)}
              className="rounded p-0.5 text-nb-gray-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
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

      {/* Bottom-Left Zoom & Expand Controls */}
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
          onClick={handleToggleExpandAll}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title="Alle Knoten auf dem Canvas auf- oder zuklappen"
        >
          <ChevronsUpDown className="h-3.5 w-3.5 text-netbird" />
          <span>{allExpanded ? "Alle einklappen" : "Alle erweitern"}</span>
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
