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
import { useI18n } from "@/lib/i18n";

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
  const { t, translateText } = useI18n();
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
  const hasUserDraggedRef = useRef<boolean>(false);
  const dragNodeStartRef = useRef<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

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

  // Clean 3-column Hierarchical Layout with Pixel-Perfect Vertical Center Alignment:
  // Left (x=60): Synapse Core Hub -> Center (x=460): Muscle Peers -> Right (x=860): Services behind their owning Muscle
  const buildHierarchicalLayout = useCallback((): Record<string, CanvasPos> => {
    const next: Record<string, CanvasPos> = {};
    const rawPeerIds =
      peerIdsKey !== "empty" ? peerIdsKey.split(",") : ["empty"];
    const peerStep = 118;
    const svcStep = 94;

    const CORE_BASE_H = 108;
    const PEER_BASE_H = 88;
    const SVC_BASE_H = 62;

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

    let cursorY = 48;
    const peerCenterYs: number[] = [];

    rawPeerIds.forEach((rawId) => {
      const peerKey = `peer:${rawId}`;
      const owned = servicesByPeer.get(rawId) || [];
      if (owned.length > 0) {
        let firstSvcY = cursorY;
        let lastSvcY = firstSvcY + (owned.length - 1) * svcStep;
        let groupCenterY =
          (firstSvcY + SVC_BASE_H / 2 + (lastSvcY + SVC_BASE_H / 2)) / 2;
        let peerY = Math.round(groupCenterY - PEER_BASE_H / 2);

        if (peerY < 28) {
          const shift = 28 - peerY;
          firstSvcY += shift;
          lastSvcY += shift;
          groupCenterY += shift;
          peerY = 28;
        }

        owned.forEach((svc, idx) => {
          next[`svc:${svc.service_id}`] = {
            x: 860,
            y: Math.round(firstSvcY + idx * svcStep),
          };
        });

        next[peerKey] = { x: 460, y: peerY };
        peerCenterYs.push(peerY + PEER_BASE_H / 2);
        cursorY = Math.max(
          lastSvcY + SVC_BASE_H + 36,
          peerY + PEER_BASE_H + 36
        );
      } else {
        const peerY = cursorY;
        next[peerKey] = { x: 460, y: peerY };
        peerCenterYs.push(peerY + PEER_BASE_H / 2);
        cursorY += Math.max(PEER_BASE_H + 36, peerStep);
      }
    });

    const minCenterY =
      peerCenterYs.length > 0 ? Math.min(...peerCenterYs) : 200;
    const maxCenterY =
      peerCenterYs.length > 0 ? Math.max(...peerCenterYs) : 200;
    const midCenterY = (minCenterY + maxCenterY) / 2;

    next["core:hub"] = {
      x: 60,
      y: Math.max(28, Math.round(midCenterY - CORE_BASE_H / 2)),
    };

    if (registeredServices.length === 0) {
      next["svc:empty"] = {
        x: 860,
        y: Math.max(28, Math.round(midCenterY - SVC_BASE_H / 2)),
      };
    }

    return next;
  }, [peerIdsKey, registeredServices]);

  const computeDefaultLayout = useCallback(
    (): Record<string, CanvasPos> => buildHierarchicalLayout(),
    [buildHierarchicalLayout]
  );

  useEffect(() => {
    hasUserDraggedRef.current = false;
  }, [peerIdsKey, serviceIdsKey]);

  useEffect(() => {
    if (!hasUserDraggedRef.current) {
      setPositions(computeDefaultLayout());
    }
  }, [computeDefaultLayout]);

  const measureNodes = useCallback(() => {
    setSizes((prev) => {
      let changed = false;
      const nextSizes: Record<string, { w: number; h: number }> = { ...prev };
      for (const [id, el] of Object.entries(nodeRefs.current)) {
        if (el) {
          const w = el.offsetWidth || 300;
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

  // Compute effective positions: when any card is expanded downward as a single unified box,
  // automatically push sibling cards below it in the same column down by the exact extra height!
  const effectivePositions = useMemo(() => {
    const out: Record<string, CanvasPos> = { ...positions };
    const shiftColumn = (prefix: "peer:" | "svc:", baseH: number, fallbackExpandedH: number) => {
      const keys = Object.keys(out)
        .filter((k) => k.startsWith(prefix))
        .sort((a, b) => (out[a]?.y ?? 0) - (out[b]?.y ?? 0));
      let extraShiftY = 0;
      for (const k of keys) {
        const basePos = out[k];
        if (!basePos) continue;
        out[k] = {
          x: basePos.x,
          y: Math.round(basePos.y + extraShiftY),
        };
        if (expandedNodes[k]) {
          const actualH = sizes[k]?.h || fallbackExpandedH;
          const delta = Math.max(0, actualH - baseH);
          extraShiftY += delta + 10;
        }
      }
    };
    shiftColumn("peer:", 88, 250);
    shiftColumn("svc:", 62, 235);
    return out;
  }, [positions, expandedNodes, sizes]);

  const toggleExpandNode = useCallback(
    (nodeKey: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setExpandedNodes((prev) => ({
        ...prev,
        [nodeKey]: !prev[nodeKey],
      }));
      setTimeout(measureNodes, 25);
      setTimeout(measureNodes, 110);
    },
    [measureNodes]
  );

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
    setTimeout(measureNodes, 40);
    setTimeout(measureNodes, 150);
  };

  const handleFitView = useCallback(
    (layoutOverride?: Record<string, CanvasPos>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const activeLayout =
        layoutOverride && Object.keys(layoutOverride).length > 0
          ? layoutOverride
          : Object.keys(positions).length > 0
          ? positions
          : computeDefaultLayout();

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const [key, pos] of Object.entries(activeLayout)) {
        if (!pos) continue;
        const w = sizes[key]?.w || 275;
        const h =
          sizes[key]?.h ||
          (key === "core:hub" ? 108 : key.startsWith("peer:") ? 88 : 62);
        if (pos.x < minX) minX = pos.x;
        if (pos.y < minY) minY = pos.y;
        if (pos.x + w > maxX) maxX = pos.x + w;
        if (pos.y + h > maxY) maxY = pos.y + h;
      }

      if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        minX = 60;
        minY = 48;
        maxX = 1135;
        maxY = 502;
      }

      const contentW = Math.max(400, maxX - minX);
      const contentH = Math.max(240, maxY - minY);
      const scaleX = (rect.width - 96) / contentW;
      const scaleY = (rect.height - 96) / contentH;
      const nextZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.72), 1.05);
      const roundedZoom = Number(nextZoom.toFixed(2));

      const panX = Math.round(
        (rect.width - contentW * roundedZoom) / 2 - minX * roundedZoom
      );
      const panY = Math.round(
        (rect.height - contentH * roundedZoom) / 2 - minY * roundedZoom
      );

      setZoom(roundedZoom);
      setPan({ x: panX, y: panY });
    },
    [positions, sizes, computeDefaultLayout]
  );

  useEffect(() => {
    if (!hasUserDraggedRef.current) {
      handleFitView();
    }
  }, [handleFitView]);

  const handleResetLayout = () => {
    hasUserDraggedRef.current = false;
    setExpandedNodes({});
    const fresh = computeDefaultLayout();
    setPositions(fresh);
    handleFitView(fresh);
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

      if (dragNodeStartRef.current) {
        const d = dragNodeStartRef.current;
        const dx = (e.clientX - d.startClientX) / zoom;
        const dy = (e.clientY - d.startClientY) / zoom;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          d.moved = true;
          lastDragMovedRef.current = true;
          hasUserDraggedRef.current = true;
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
      if (!dragNodeStartRef.current && !(isPanning && panStartRef.current)) {
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
    const p1 = effectivePositions[fromId] || { x: 60, y: 120 };
    const p2 = effectivePositions[toId] || { x: 460, y: 120 };
    const headerH1 =
      fromId === "core:hub" ? 108 : fromId.startsWith("peer:") ? 88 : 62;
    const headerH2 =
      toId === "core:hub" ? 108 : toId.startsWith("peer:") ? 88 : 62;

    const w1 = sizes[fromId]?.w || 300;
    const w2 = sizes[toId]?.w || 300;

    const c1CenterX = p1.x + w1 / 2;
    const c2CenterX = p2.x + w2 / 2;
    const leftToRight = c1CenterX <= c2CenterX;

    const x1 = leftToRight ? p1.x + w1 : p1.x;
    const y1 = p1.y + headerH1 / 2;
    const x2 = leftToRight ? p2.x : p2.x + w2;
    const y2 = p2.y + headerH2 / 2;

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

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
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

        {/* 1. MIDDLE: INTERACTIVE MUSCLE SERVER CARDS (Single Unified Expandable Box) */}
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
                zIndex: draggingNodeId === nodeKey ? 30 : isExpanded ? 25 : 10,
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
              className={`absolute w-[300px] rounded-xl border bg-nb-gray-940 px-4 py-3.5 shadow-lg transition-colors duration-150 ${
                draggingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-netbird shadow-2xl"
                  : "cursor-grab hover:border-nb-gray-700 hover:bg-nb-gray-930"
              } ${
                isExpanded
                  ? "border-netbird/80 ring-1 ring-netbird/30 shadow-2xl"
                  : "border-nb-gray-800"
              }`}
            >
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
                            {t(`Stufe ${tierNum}`, `Tier ${tierNum}`)}
                          </span>
                          {(() => {
                            const fwPol = firewallPolicies?.[gn.node_id];
                            const prof = fwPol?.profile || "web_standard";
                            const shieldedCount =
                              fwPol?.shielded_ports?.length || 0;
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
                                        `FW · ${shieldedCount} gesperrt`,
                                        `FW · ${shieldedCount} shielded`
                                      )
                                    : t("Firewall aktiv", "Firewall active")}
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
                          ? t("Details einklappen", "Collapse details")
                          : t(
                              "Details direkt im Knoten aufklappen",
                              "Expand details inside node"
                            )
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

                  {/* ATTACHED UNIFIED BOTTOM DETAILS FOR MUSCLE SERVER */}
                  {isExpanded && (
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
                      </div>

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
                            <div className="text-nb-gray-400">
                              {t("SPEICHER", "DISK")}
                            </div>
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
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* 2. LEFT: UNIFIED SYNAPSE CORE HUB NODE (Single Unified Expandable Box) */}
        {(() => {
          const nodeKey = "core:hub";
          const pos = effectivePositions[nodeKey] || { x: 60, y: 120 };
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
                zIndex: draggingNodeId === nodeKey ? 30 : isExpanded ? 25 : 10,
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
              className={`absolute w-[300px] rounded-2xl border bg-nb-gray-940 p-4 shadow-xl transition-colors duration-150 ${
                draggingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-netbird shadow-2xl"
                  : "cursor-grab hover:border-netbird/70 hover:bg-nb-gray-930"
              } ${
                isExpanded
                  ? "border-netbird ring-2 ring-netbird/30 shadow-2xl"
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
                      ? t("Core Hub einklappen", "Collapse Core Hub")
                      : t(
                          "Regeln & Brain Vault direkt aufklappen",
                          "Expand Rules & Brain Vault"
                        )
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
                  <span>
                    {t(
                      `${activeCartridges.length} Regeln aktiv`,
                      `${activeCartridges.length} Rules active`
                    )}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <FolderGit2 className="h-3.5 w-3.5 text-sky-400" />
                  <span>{t("Brain-Tresor", "Brain Vault")}</span>
                </span>
              </div>

              {/* ATTACHED UNIFIED BOTTOM DETAILS FOR SYNAPSE CORE HUB */}
              {isExpanded && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 space-y-3 border-t border-nb-gray-800/90 pt-3 text-[11px]"
                >
                  <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-nb-gray-400">
                        {t("Aktives KI-Modell", "Active AI Model")}
                      </span>
                      <button
                        type="button"
                        onClick={onOpenAiSettings}
                        className="text-[10.5px] font-medium text-netbird hover:underline"
                      >
                        {t("Ändern →", "Change →")}
                      </button>
                    </div>
                    <div className="truncate font-mono text-[10px] text-nb-gray-300">
                      {baseUrl}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="font-mono text-[9.5px] uppercase tracking-wider text-nb-gray-400">
                      {t(
                        "Projekt-Dokumentation & Tresor",
                        "Project Documentation & Vault"
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenBrainDoc("Architecture.md")}
                        className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2 py-1.5 font-mono text-[10px] text-nb-gray-200 hover:border-netbird hover:text-white truncate"
                      >
                        Arch.md
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenBrainDoc("Memory.md")}
                        className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2 py-1.5 font-mono text-[10px] text-nb-gray-200 hover:border-netbird hover:text-white truncate"
                      >
                        Memory.md
                      </button>
                      <button
                        type="button"
                        onClick={onOpenSecretsVault}
                        className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2 py-1.5 font-mono text-[10px] text-amber-300 hover:border-amber-500 truncate"
                      >
                        {t(
                          `Tresor (${secretKeysCount})`,
                          `Vault (${secretKeysCount})`
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9.5px] uppercase tracking-wider text-nb-gray-400">
                        {t("Sicherheits-Cartridges", "Security Cartridges")}
                      </span>
                      <button
                        type="button"
                        onClick={onOpenAccessControl}
                        className="text-[10.5px] text-netbird hover:underline"
                      >
                        {t("Alle Regeln →", "All Rules →")}
                      </button>
                    </div>
                    <div className="space-y-1">
                      {cartridges.map((c) => {
                        const enabled = activeCartridges.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => onToggleCartridge(c.id)}
                            className="flex w-full items-center justify-between rounded-lg border border-nb-gray-800/80 bg-nb-gray-950 px-2.5 py-1.5 text-[10.5px] hover:border-nb-gray-700 transition"
                          >
                            <span className="truncate text-nb-gray-200 pr-2">
                              {translateText(c.name)}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold ${
                                enabled
                                  ? "bg-green-950 text-green-400"
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
                </div>
              )}
            </div>
          );
        })()}

        {/* 3. RIGHT: INTERACTIVE SERVICE CARDS (Single Unified Expandable Box) */}
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
          const pos = effectivePositions[nodeKey] || { x: 860, y: 120 };
          const healthy =
            svc.healthy !== false && svc.health_check?.status !== "UNHEALTHY";
          const isExpanded = Boolean(expandedNodes[nodeKey]);
          const cat = svc.category || "backend";
          const catLabel =
            cat === "webui"
              ? t("Web-Oberfläche", "WebUI")
              : cat === "database"
              ? t("Datenbank", "Database")
              : t("Backend-API", "Backend API");

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
                zIndex: draggingNodeId === nodeKey ? 30 : isExpanded ? 25 : 10,
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
              className={`absolute w-[300px] rounded-xl border bg-nb-gray-940 px-4 py-3 shadow-lg transition-colors duration-150 ${
                draggingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-sky-400 shadow-2xl"
                  : "cursor-grab hover:border-nb-gray-700 hover:bg-nb-gray-930"
              } ${
                isExpanded
                  ? "border-sky-400 ring-1 ring-sky-400/30 shadow-2xl"
                  : "border-nb-gray-800"
              }`}
            >
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
                            {translateText(svc.name)}
                          </span>
                        </div>
                        <div className="font-mono text-[10px] text-nb-gray-400 mt-0.5 truncate">
                          {catLabel} · {svc.node_id} · :{svc.port}
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
                      className="rounded-md p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white transition"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* ATTACHED UNIFIED BOTTOM DETAILS FOR SERVICE */}
                  {isExpanded && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 space-y-2.5 border-t border-nb-gray-800/90 pt-2.5 text-[11px]"
                    >
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
                                {translateText(ep.label)}
                              </span>
                              <ChevronRight className="h-3 w-3 shrink-0 text-nb-gray-500" />
                            </button>
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
                            {t(
                              "Vorschau & Tester öffnen",
                              "Open Preview & Tester"
                            )}
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
                            <span>
                              {t("Auto-Heal starten", "Start Auto-Heal")}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

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
          onClick={() => handleFitView()}
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
