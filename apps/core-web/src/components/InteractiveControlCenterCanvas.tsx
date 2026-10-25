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
  ChevronsUpDown,
  Code2,
  ExternalLink,
  FileText,
  FolderGit2,
  Globe,
  KeyRound,
  LayoutGrid,
  Maximize2,
  MonitorSmartphone,
  Plus,
  RotateCcw,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal as TerminalIcon,
  Wrench,
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
  dashed?: boolean;
}

export default function InteractiveControlCenterCanvas({
  flowView,
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
  onDeployDemoService,
  onHealService,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Pan & Zoom state
  const [pan, setPan] = useState<CanvasPos>({ x: 48, y: 40 });
  const [zoom, setZoom] = useState<number>(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  // Node positions (draggable by user) & measured DOM sizes
  const [positions, setPositions] = useState<Record<string, CanvasPos>>({});
  const [sizes, setSizes] = useState<
    Record<string, { w: number; h: number }>
  >({});

  // Active dragging node state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragNodeStartRef = useRef<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  // Interactive drag-to-connect cable from a handle
  const [connectingFrom, setConnectingFrom] = useState<{
    nodeId: string;
    startX: number;
    startY: number;
    currX: number;
    currY: number;
  } | null>(null);

  // Focus / Hover node highlighting (NetBird Focus mode)
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  const peerIdsKey = useMemo(
    () =>
      gatewayNodes.length > 0
        ? gatewayNodes.map((n) => n.node_id).join(",")
        : "empty",
    [gatewayNodes]
  );
  const cartridgeIdsKey = useMemo(
    () => cartridges.map((c) => c.id).join(","),
    [cartridges]
  );
  const activeCartridgesKey = useMemo(
    () => activeCartridges.join(","),
    [activeCartridges]
  );

  // Compute deterministic default layout coordinates for all nodes based on `flowView`
  const computeDefaultLayout = useCallback((): Record<string, CanvasPos> => {
    const next: Record<string, CanvasPos> = {};
    const peerIds =
      peerIdsKey !== "empty"
        ? peerIdsKey.split(",").map((id) => `peer:${id}`)
        : ["peer:empty"];

    const policyIds = [
      "policy:tier",
      ...(cartridgeIdsKey
        ? cartridgeIdsKey.split(",").map((id) => `policy:${id}`)
        : []),
      "policy:guardrail",
    ];

    const resourceIds = [
      "res:ai-provider",
      "res:brain-vault",
      "res:reverse-proxy",
    ];

    if (flowView === "ai-agent") {
      // AI Provider on the left -> Policies in center -> Peers & Vault on the right
      next["res:ai-provider"] = { x: 40, y: 180 };
      policyIds.forEach((pid, idx) => {
        next[pid] = { x: 420, y: 45 + idx * 66 };
      });
      peerIds.forEach((id, idx) => {
        next[id] = { x: 780, y: 30 + idx * 210 };
      });
      next["res:brain-vault"] = { x: 780, y: 245 };
      next["res:reverse-proxy"] = { x: 780, y: 445 };
      return next;
    }

    if (flowView === "groups") {
      // Brain Vault & Secrets on the left -> Policies in center -> Peers & Services on the right
      next["res:brain-vault"] = { x: 40, y: 120 };
      next["res:ai-provider"] = { x: 40, y: 340 };
      policyIds.forEach((pid, idx) => {
        next[pid] = { x: 430, y: 45 + idx * 66 };
      });
      peerIds.forEach((id, idx) => {
        next[id] = { x: 780, y: 60 + idx * 210 };
      });
      next["res:reverse-proxy"] = { x: 780, y: 290 };
      return next;
    }

    if (flowView === "networks") {
      // Reverse Proxy & Services prominent on the left -> Guardrails & Cartridges center -> Peers right
      next["res:reverse-proxy"] = { x: 40, y: 150 };
      next["res:ai-provider"] = { x: 40, y: 350 };
      policyIds.forEach((pid, idx) => {
        next[pid] = { x: 430, y: 45 + idx * 66 };
      });
      peerIds.forEach((id, idx) => {
        next[id] = { x: 780, y: 80 + idx * 210 };
      });
      next["res:brain-vault"] = { x: 780, y: 300 };
      return next;
    }

    // Default NetBird `Peer` View: Peers (Left x=40) -> Policies/Cartridges (Center x=420) -> Brain & Services (Right x=770)
    peerIds.forEach((id, idx) => {
      next[id] = { x: 40, y: 125 + idx * 210 };
    });

    policyIds.forEach((pid, idx) => {
      next[pid] = { x: 420, y: 42 + idx * 66 };
    });

    resourceIds.forEach((rid, idx) => {
      const yOffsets = [32, 148, 368];
      next[rid] = { x: 770, y: yOffsets[idx] ?? idx * 160 };
    });

    return next;
  }, [peerIdsKey, cartridgeIdsKey, flowView]);

  // Initialize or update layout when flowView changes or new nodes arrive
  useEffect(() => {
    const defaults = computeDefaultLayout();
    setPositions((prev) => {
      const merged: Record<string, CanvasPos> = { ...defaults };
      // Keep user-dragged coordinates unless flowView changed
      for (const k of Object.keys(defaults)) {
        if (prev[k]) {
          merged[k] = prev[k];
        }
      }
      return merged;
    });
  }, [computeDefaultLayout]);

  // Reset layout cleanly when switching FlowSelector tabs
  useEffect(() => {
    setPositions(computeDefaultLayout());
    setFocusedNodeId(null);
  }, [flowView, computeDefaultLayout]);

  // Measure every node's real DOM width/height so handles attach with 100% pixel accuracy
  const measureNodes = useCallback(() => {
    setSizes((prev) => {
      let changed = false;
      const nextSizes: Record<string, { w: number; h: number }> = { ...prev };
      for (const [id, el] of Object.entries(nodeRefs.current)) {
        if (el) {
          const w = el.offsetWidth || 260;
          const h = el.offsetHeight || 44;
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
  }, [
    measureNodes,
    gatewayNodes.length,
    cartridges.length,
    registeredServices.length,
    flowView,
  ]);

  // Auto-fit view on initial mount
  const handleFitView = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const targetW = 1120;
    const targetH = 540;
    const scaleX = (rect.width - 60) / targetW;
    const scaleY = (rect.height - 80) / targetH;
    const nextZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.65), 1.15);
    const offsetX = Math.max(24, (rect.width - targetW * nextZoom) / 2);
    const offsetY = Math.max(24, (rect.height - targetH * nextZoom) / 2);
    setZoom(Number(nextZoom.toFixed(2)));
    setPan({ x: Math.round(offsetX), y: Math.round(offsetY) });
  }, []);

  useEffect(() => {
    handleFitView();
  }, [handleFitView]);

  const handleResetLayout = () => {
    setPositions(computeDefaultLayout());
    handleFitView();
    setFocusedNodeId(null);
  };

  // Build dynamic edges between actual node IDs
  const edges = useMemo<CanvasEdge[]>(() => {
    const list: CanvasEdge[] = [];
    const peerIds =
      peerIdsKey !== "empty"
        ? peerIdsKey.split(",").map((id) => `peer:${id}`)
        : ["peer:empty"];
    const cartridgeList = cartridgeIdsKey ? cartridgeIdsKey.split(",") : [];
    const activeSet = new Set(
      activeCartridgesKey ? activeCartridgesKey.split(",") : []
    );

    const policyIds = [
      { id: "policy:tier", active: true, color: "#f68330" },
      ...cartridgeList.map((cid) => {
        const isOn = activeSet.has(cid);
        return {
          id: `policy:${cid}`,
          active: isOn,
          color: isOn ? "#31c48d" : "#474e57",
        };
      }),
      { id: "policy:guardrail", active: true, color: "#38bdf8" },
    ];

    for (const pid of peerIds) {
      for (const pol of policyIds) {
        list.push({
          id: `${pid}->${pol.id}`,
          from: pid,
          to: pol.id,
          color: pol.color,
          active: pol.active,
        });
      }
    }

    // Connect policies to right-hand resource frames
    list.push({
      id: "policy:tier->res:ai-provider",
      from: "policy:tier",
      to: "res:ai-provider",
      color: "#f68330",
      active: true,
    });
    list.push({
      id: "policy:tier->res:brain-vault",
      from: "policy:tier",
      to: "res:brain-vault",
      color: "#f68330",
      active: true,
    });

    cartridgeList.forEach((cid) => {
      const isOn = activeSet.has(cid);
      const targetRes =
        cid === "auto-ssl-caddy" || cid === "zero-trust-networking"
          ? "res:reverse-proxy"
          : "res:brain-vault";
      list.push({
        id: `policy:${cid}->${targetRes}`,
        from: `policy:${cid}`,
        to: targetRes,
        color: isOn ? "#31c48d" : "#474e57",
        active: isOn,
      });
    });

    list.push({
      id: "policy:guardrail->res:reverse-proxy",
      from: "policy:guardrail",
      to: "res:reverse-proxy",
      color: "#38bdf8",
      active: true,
    });

    return list;
  }, [peerIdsKey, cartridgeIdsKey, activeCartridgesKey]);

  // Determine which nodes/edges are highlighted when hovering or focusing a node
  const activeHighlightNode = hoveredNodeId || focusedNodeId;
  const connectedSet = useMemo(() => {
    if (!activeHighlightNode) return null;
    const set = new Set<string>([activeHighlightNode]);
    for (const e of edges) {
      if (e.from === activeHighlightNode || e.to === activeHighlightNode) {
        set.add(e.from);
        set.add(e.to);
      }
    }
    return set;
  }, [activeHighlightNode, edges]);

  // Global pointer move / up handlers for 60fps Node Dragging, Canvas Panning & Handle Cable Drawing
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (dragNodeStartRef.current) {
        const d = dragNodeStartRef.current;
        const dx = (e.clientX - d.startClientX) / zoom;
        const dy = (e.clientY - d.startClientY) / zoom;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
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

      if (connectingFrom && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left - pan.x) / zoom;
        const canvasY = (e.clientY - rect.top - pan.y) / zoom;
        setConnectingFrom((prev) =>
          prev ? { ...prev, currX: canvasX, currY: canvasY } : null
        );
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
      if (connectingFrom) {
        setConnectingFrom(null);
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
  }, [zoom, isPanning, connectingFrom, pan]);

  function startNodeDrag(e: React.PointerEvent, nodeId: string) {
    // Do not start drag if clicking an interactive button inside the card
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

  function startHandleConnect(
    e: React.PointerEvent,
    nodeId: string,
    side: "left" | "right"
  ) {
    e.stopPropagation();
    const pos = positions[nodeId] || { x: 0, y: 0 };
    const sz = sizes[nodeId] || { w: 260, h: 48 };
    const startX = side === "right" ? pos.x + sz.w : pos.x;
    const startY = pos.y + sz.h / 2;
    setConnectingFrom({
      nodeId,
      startX,
      startY,
      currX: startX,
      currY: startY,
    });
  }

  function completeHandleDrop(targetNodeId: string) {
    if (!connectingFrom || connectingFrom.nodeId === targetNodeId) return;
    // If dragging from a Peer or Resource to a Cartridge Pill, toggle that Cartridge!
    const policyPrefix = "policy:";
    let cartridgeId: string | null = null;
    if (
      targetNodeId.startsWith(policyPrefix) &&
      targetNodeId !== "policy:tier" &&
      targetNodeId !== "policy:guardrail"
    ) {
      cartridgeId = targetNodeId.slice(policyPrefix.length);
    } else if (
      connectingFrom.nodeId.startsWith(policyPrefix) &&
      connectingFrom.nodeId !== "policy:tier" &&
      connectingFrom.nodeId !== "policy:guardrail"
    ) {
      cartridgeId = connectingFrom.nodeId.slice(policyPrefix.length);
    }
    if (cartridgeId) {
      onToggleCartridge(cartridgeId);
    }
    setConnectingFrom(null);
  }

  function handleWheel(e: React.WheelEvent) {
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.07 : 0.93;
      setZoom((prev) =>
        Number(Math.min(Math.max(prev * factor, 0.45), 1.75).toFixed(2))
      );
    }
  }

  // Helper to compute exact handle coordinates for any pair of nodes
  function getEdgeCoords(fromId: string, toId: string) {
    const p1 = positions[fromId] || { x: 40, y: 120 };
    const s1 = sizes[fromId] || { w: 280, h: 64 };
    const p2 = positions[toId] || { x: 420, y: 120 };
    const s2 = sizes[toId] || { w: 245, h: 42 };

    // Determine whether p1 is to the left of p2 or vice versa
    const leftToRight = p1.x + s1.w / 2 <= p2.x + s2.w / 2;
    const x1 = leftToRight ? p1.x + s1.w : p1.x;
    const y1 = p1.y + s1.h / 2;
    const x2 = leftToRight ? p2.x : p2.x + s2.w;
    const y2 = p2.y + s2.h / 2;

    const dx = Math.max(Math.abs(x2 - x1) * 0.48, 55);
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
        setFocusedNodeId(null);
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
      {/* Top Floating NetBird Status & Quick Actions Bar */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-auto absolute left-5 right-5 top-4 z-20 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2.5 rounded-lg border border-nb-gray-800 bg-nb-gray-940/95 px-3.5 py-1.5 text-xs shadow-lg backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="animate-slow-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
          </span>
          <span className="font-medium text-white">Interactive Canvas</span>
          <span className="text-nb-gray-600">·</span>
          <span className="text-nb-gray-300 text-[11px]">
            Drag any node or handle · Scroll to zoom
          </span>
          {focusedNodeId && (
            <>
              <span className="text-nb-gray-600">·</span>
              <button
                onClick={() => setFocusedNodeId(null)}
                className="text-netbird hover:underline font-medium"
              >
                Exit Focus
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onDeployDemoService}
            className="flex items-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-940/95 px-3 py-1.5 text-xs text-nb-gray-200 shadow-lg hover:border-netbird hover:text-white transition"
          >
            <Zap className="h-3.5 w-3.5 text-netbird" />
            <span>Deploy Demo Service (:4050)</span>
          </button>
          <button
            onClick={handleResetLayout}
            className="flex items-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-940/95 px-3 py-1.5 text-xs text-nb-gray-300 shadow-lg hover:bg-nb-gray-900 hover:text-white transition"
            title="Auto-arrange nodes"
          >
            <LayoutGrid className="h-3.5 w-3.5 text-netbird" />
            <span>Auto-Layout</span>
          </button>
        </div>
      </div>

      {/* TRANSFORMED INFINITE GRAPH LAYER (SVG Edges + Draggable Node Cards) */}
      <div
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
        className="absolute left-0 top-0 h-[1200px] w-[1600px]"
      >
        {/* DYNAMIC PIXEL-ACCURATE BEZIER EDGES SVG LAYER */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          style={{ zIndex: 1 }}
        >
          <defs>
            <filter
              id="nb-edge-glow"
              x="-20%"
              y="-20%"
              width="140%"
              height="140%"
            >
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="2.5"
                floodColor="#f68330"
                floodOpacity="0.35"
              />
            </filter>
          </defs>

          {edges.map((edge) => {
            const { x1, y1, x2, y2, d } = getEdgeCoords(edge.from, edge.to);
            const isHighlighted =
              activeHighlightNode &&
              (edge.from === activeHighlightNode ||
                edge.to === activeHighlightNode);
            const isDimmed =
              activeHighlightNode && !isHighlighted;

            return (
              <g
                key={edge.id}
                style={{
                  opacity: isDimmed ? 0.14 : edge.active ? 0.95 : 0.35,
                  transition: "opacity 150ms ease",
                }}
              >
                {/* Soft halo path when highlighted */}
                {isHighlighted && (
                  <path
                    d={d}
                    fill="none"
                    stroke={edge.color}
                    strokeWidth={4.5}
                    strokeOpacity={0.22}
                  />
                )}
                {/* Primary NetBird animated dashed edge */}
                <path
                  d={d}
                  fill="none"
                  stroke={edge.color}
                  strokeWidth={isHighlighted ? 2.4 : 1.75}
                  strokeDasharray={edge.active ? "6 6" : "4 6"}
                  className={edge.active ? "cc-animated-edge" : ""}
                />
                {/* Exact Handle Endpoint Dots */}
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

          {/* Live User Drag-to-Connect Line */}
          {connectingFrom && (
            <path
              d={`M ${connectingFrom.startX} ${connectingFrom.startY} C ${
                connectingFrom.startX + 80
              } ${connectingFrom.startY}, ${connectingFrom.currX - 80} ${
                connectingFrom.currY
              }, ${connectingFrom.currX} ${connectingFrom.currY}`}
              fill="none"
              stroke="#f68330"
              strokeWidth={2.2}
              strokeDasharray="6 6"
              className="cc-animated-edge"
            />
          )}
        </svg>

        {/* ═══════════════════════════════════════════════════════════════════
            1. DRAGGABLE MUSCLE PEER NODES (`SelectPeerNode` 1:1 NetBird)
        ═══════════════════════════════════════════════════════════════════ */}
        {peerNodesToRender.map((gn) => {
          const nodeKey =
            gn.node_id === "empty" ? "peer:empty" : `peer:${gn.node_id}`;
          const pos = positions[nodeKey] || { x: 40, y: 125 };
          const hb = gn.last_heartbeat;
          const isSelected =
            primaryNode === gn.node_id || focusedNodeId === nodeKey;
          const isDimmed = connectedSet && !connectedSet.has(nodeKey);

          return (
            <div
              key={nodeKey}
              ref={(el) => {
                nodeRefs.current[nodeKey] = el;
              }}
              style={{
                left: pos.x,
                top: pos.y,
                zIndex: draggingNodeId === nodeKey ? 30 : 10,
                opacity: isDimmed ? 0.25 : 1,
              }}
              onPointerDown={(e) => startNodeDrag(e, nodeKey)}
              onPointerUp={() => completeHandleDrop(nodeKey)}
              onMouseEnter={() => setHoveredNodeId(nodeKey)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (gn.node_id !== "empty") {
                  onSelectNode(gn.node_id);
                  setFocusedNodeId((prev) =>
                    prev === nodeKey ? null : nodeKey
                  );
                }
              }}
              className={`group/peer absolute w-[295px] rounded-xl border bg-nb-gray-930/95 p-4 shadow-xl backdrop-blur transition-shadow ${
                draggingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-netbird shadow-2xl"
                  : "cursor-grab hover:bg-nb-gray-910"
              } ${
                isSelected
                  ? "border-netbird ring-1 ring-netbird/40"
                  : "border-nb-gray-800"
              }`}
            >
              {/* Left Interactive Handle (visible on hover for drag-to-connect) */}
              <div
                onPointerDown={(e) => startHandleConnect(e, nodeKey, "left")}
                title="Drag connection to any Policy Pill"
                className="absolute -left-2 top-1/2 -translate-y-1/2 flex h-4 w-4 cursor-crosshair items-center justify-center rounded-full border border-nb-gray-700 bg-nb-gray-940 opacity-0 group-hover/peer:opacity-100 hover:border-netbird hover:scale-125 transition"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-netbird" />
              </div>

              {/* Right Interactive Handle (visible on hover for drag-to-connect) */}
              <div
                onPointerDown={(e) => startHandleConnect(e, nodeKey, "right")}
                title="Drag connection to any Policy Pill"
                className="absolute -right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 cursor-crosshair items-center justify-center rounded-full border border-nb-gray-700 bg-nb-gray-940 opacity-0 group-hover/peer:opacity-100 hover:border-netbird hover:scale-125 transition"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-netbird" />
              </div>

              {gn.node_id === "empty" ? (
                <div className="text-center space-y-2.5 py-2">
                  <MonitorSmartphone className="mx-auto h-6 w-6 text-netbird" />
                  <div className="text-xs font-medium text-white">
                    No Muscle Peer Connected
                  </div>
                  <button
                    onClick={onOpenAddPeer}
                    className="rounded-md bg-netbird px-3 py-1.5 text-xs font-medium text-white hover:bg-netbird-500"
                  >
                    + Add First Peer
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between border-b border-nb-gray-800/70 pb-1.5">
                    <span className="font-mono text-[9px] font-semibold uppercase tracking-wider text-nb-gray-400">
                      Muscle Peer · Outbound mTLS
                    </span>
                    <span className="font-mono text-[9px] text-green-400">
                      ONLINE
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-nb-gray-800 bg-nb-gray-940 text-netbird">
                        <Server className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full bg-green-400" />
                          <span className="truncate font-mono text-xs font-semibold text-white">
                            {gn.node_id}
                          </span>
                        </div>
                        <div className="truncate font-mono text-[10px] text-nb-gray-400 mt-0.5">
                          {hb?.private_ipv4 || "127.0.0.1"} ·{" "}
                          {hb?.os_info || hb?.os_arch || "linux/amd64"}
                        </div>
                      </div>
                    </div>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-nb-gray-400" />
                  </div>

                  {hb && (
                    <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-lg border border-nb-gray-800/80 bg-nb-gray-950/90 px-2.5 py-2 font-mono text-[10px] text-nb-gray-300">
                      <div>
                        <span className="text-nb-gray-500">CPU </span>
                        <span className="text-white">
                          {hb.cpu_percent.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-nb-gray-500">RAM </span>
                        <span className="text-white">
                          {hb.ram_percent.toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-nb-gray-500">DSK </span>
                        <span className="text-white">
                          {hb.disk_percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-2.5 flex items-center justify-between text-[10px]">
                    <span className="rounded border border-netbird-500/40 bg-netbird-950 px-2 py-0.5 font-mono text-netbird">
                      {gn.tier}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPty();
                      }}
                      className="text-nb-gray-300 hover:text-white underline"
                    >
                      Open PTY Shell →
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* ═══════════════════════════════════════════════════════════════════
            2. DRAGGABLE POLICY & CARTRIDGE PILLS (`AgentPolicyNode` 1:1 NetBird)
        ═══════════════════════════════════════════════════════════════════ */}
        {/* 2A: Autonomy Tier Policy Pill */}
        {(() => {
          const nodeKey = "policy:tier";
          const pos = positions[nodeKey] || { x: 420, y: 42 };
          const isDimmed = connectedSet && !connectedSet.has(nodeKey);
          return (
            <div
              ref={(el) => {
                nodeRefs.current[nodeKey] = el;
              }}
              style={{
                left: pos.x,
                top: pos.y,
                zIndex: draggingNodeId === nodeKey ? 30 : 10,
                opacity: isDimmed ? 0.25 : 1,
              }}
              onPointerDown={(e) => startNodeDrag(e, nodeKey)}
              onPointerUp={() => completeHandleDrop(nodeKey)}
              onMouseEnter={() => setHoveredNodeId(nodeKey)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onClick={(e) => {
                e.stopPropagation();
                setFocusedNodeId((prev) => (prev === nodeKey ? null : nodeKey));
              }}
              className={`group/pill absolute flex w-[248px] items-center justify-between rounded-full border border-netbird-500/70 bg-nb-gray-940 px-3.5 py-2.5 shadow-lg transition-shadow ${
                draggingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-netbird shadow-2xl"
                  : "cursor-grab hover:border-netbird hover:bg-nb-gray-930"
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <span className="h-2 w-2 shrink-0 rounded-full bg-netbird" />
                <span className="truncate font-mono text-[11px] font-medium text-white">
                  {gatewayNodes[0]?.tier || joinTier}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenAccessControl();
                }}
                className="text-netbird hover:text-white"
                title="Open Autonomy Tier settings"
              >
                <Shield className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })()}

        {/* 2B: Pluggable DevOps Rule Cartridge Pills */}
        {cartridges.map((c, idx) => {
          const nodeKey = `policy:${c.id}`;
          const pos = positions[nodeKey] || {
            x: 420,
            y: 42 + (idx + 1) * 66,
          };
          const enabled = activeCartridges.includes(c.id);
          const isDimmed = connectedSet && !connectedSet.has(nodeKey);

          return (
            <div
              key={nodeKey}
              ref={(el) => {
                nodeRefs.current[nodeKey] = el;
              }}
              style={{
                left: pos.x,
                top: pos.y,
                zIndex: draggingNodeId === nodeKey ? 30 : 10,
                opacity: isDimmed ? 0.25 : 1,
              }}
              onPointerDown={(e) => startNodeDrag(e, nodeKey)}
              onPointerUp={() => completeHandleDrop(nodeKey)}
              onMouseEnter={() => setHoveredNodeId(nodeKey)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onClick={(e) => {
                e.stopPropagation();
                setFocusedNodeId((prev) => (prev === nodeKey ? null : nodeKey));
              }}
              className={`group/pill absolute flex w-[248px] items-center justify-between rounded-full border bg-nb-gray-940 px-3.5 py-2.5 shadow-md transition-all ${
                draggingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-netbird shadow-2xl"
                  : "cursor-grab hover:bg-nb-gray-930"
              } ${
                enabled
                  ? "border-nb-gray-800 hover:border-green-500/60"
                  : "border-nb-gray-800/70 opacity-70"
              }`}
            >
              <div className="flex items-center gap-2.5 truncate pr-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    enabled ? "bg-green-400" : "bg-nb-gray-500"
                  }`}
                />
                <span className="truncate text-[12px] text-nb-gray-200">
                  {c.name}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCartridge(c.id);
                }}
                className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-medium transition ${
                  enabled
                    ? "bg-green-950 text-green-400 border border-green-500/40 hover:bg-green-900"
                    : "bg-nb-gray-900 text-nb-gray-400 hover:text-white"
                }`}
                title="Click to toggle Cartridge ON/OFF"
              >
                {enabled ? "ON" : "OFF"}
              </button>
            </div>
          );
        })}

        {/* 2C: Deterministic Guardrail Pill */}
        {(() => {
          const nodeKey = "policy:guardrail";
          const pos = positions[nodeKey] || {
            x: 420,
            y: 42 + (cartridges.length + 1) * 66,
          };
          const isDimmed = connectedSet && !connectedSet.has(nodeKey);

          return (
            <div
              ref={(el) => {
                nodeRefs.current[nodeKey] = el;
              }}
              style={{
                left: pos.x,
                top: pos.y,
                zIndex: draggingNodeId === nodeKey ? 30 : 10,
                opacity: isDimmed ? 0.25 : 1,
              }}
              onPointerDown={(e) => startNodeDrag(e, nodeKey)}
              onPointerUp={() => completeHandleDrop(nodeKey)}
              onMouseEnter={() => setHoveredNodeId(nodeKey)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onClick={(e) => {
                e.stopPropagation();
                setFocusedNodeId((prev) => (prev === nodeKey ? null : nodeKey));
              }}
              className={`group/pill absolute flex w-[248px] items-center justify-between rounded-full border border-sky-500/40 bg-nb-gray-940 px-3.5 py-2.5 shadow-md ${
                draggingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-sky-400 shadow-2xl"
                  : "cursor-grab hover:bg-nb-gray-930"
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" />
                <span className="truncate text-[12px] text-nb-gray-200">
                  Self-Lockout &amp; Redaction Guard
                </span>
              </div>
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" />
            </div>
          );
        })()}

        {/* ═══════════════════════════════════════════════════════════════════
            3. DRAGGABLE RESOURCE FRAMES (AI Provider, Brain Vault, Proxy)
        ═══════════════════════════════════════════════════════════════════ */}
        {/* 3A: AI Orchestrator Provider Frame */}
        {(() => {
          const nodeKey = "res:ai-provider";
          const pos = positions[nodeKey] || { x: 770, y: 32 };
          const isDimmed = connectedSet && !connectedSet.has(nodeKey);
          return (
            <div
              ref={(el) => {
                nodeRefs.current[nodeKey] = el;
              }}
              style={{
                left: pos.x,
                top: pos.y,
                zIndex: draggingNodeId === nodeKey ? 30 : 10,
                opacity: isDimmed ? 0.25 : 1,
              }}
              onPointerDown={(e) => startNodeDrag(e, nodeKey)}
              onPointerUp={() => completeHandleDrop(nodeKey)}
              onMouseEnter={() => setHoveredNodeId(nodeKey)}
              onMouseLeave={() => setHoveredNodeId(null)}
              className={`absolute w-[310px] rounded-xl border border-nb-gray-800 bg-nb-gray-940/95 p-4 shadow-xl backdrop-blur ${
                draggingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-netbird shadow-2xl"
                  : "cursor-grab hover:border-netbird/60 hover:bg-nb-gray-930"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-white">
                      AI Provider ({modelName})
                    </div>
                    <div className="truncate font-mono text-[10px] text-nb-gray-400">
                      {baseUrl}
                    </div>
                  </div>
                </div>
                <button
                  onClick={onOpenAiSettings}
                  className="rounded border border-green-500/50 bg-green-950 px-2 py-0.5 font-mono text-[10px] text-green-400 hover:bg-green-900"
                >
                  CONFIGURE
                </button>
              </div>
            </div>
          );
        })()}

        {/* 3B: Project Brain Vault Frame */}
        {(() => {
          const nodeKey = "res:brain-vault";
          const pos = positions[nodeKey] || { x: 770, y: 148 };
          const isDimmed = connectedSet && !connectedSet.has(nodeKey);
          return (
            <div
              ref={(el) => {
                nodeRefs.current[nodeKey] = el;
              }}
              style={{
                left: pos.x,
                top: pos.y,
                zIndex: draggingNodeId === nodeKey ? 30 : 10,
                opacity: isDimmed ? 0.25 : 1,
              }}
              onPointerDown={(e) => startNodeDrag(e, nodeKey)}
              onPointerUp={() => completeHandleDrop(nodeKey)}
              onMouseEnter={() => setHoveredNodeId(nodeKey)}
              onMouseLeave={() => setHoveredNodeId(null)}
              className={`absolute w-[310px] rounded-xl border border-nb-gray-800 bg-nb-gray-940/95 p-3.5 shadow-xl backdrop-blur space-y-2 ${
                draggingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-green-400 shadow-2xl"
                  : "cursor-grab hover:border-nb-gray-700"
              }`}
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-nb-gray-100 flex items-center gap-2">
                  <FolderGit2 className="h-3.5 w-3.5 text-green-400" />
                  Project Brain Vault
                </span>
                <span className="font-mono text-[10px] text-nb-gray-400">
                  AES-256-GCM
                </span>
              </div>

              <div className="space-y-1.5">
                <button
                  onClick={() => onOpenBrainDoc("Architecture.md")}
                  className="flex w-full items-center justify-between rounded-lg border border-nb-gray-800/80 bg-nb-gray-930/80 px-3 py-2 text-xs text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-netbird" />
                    Architecture.md (Mermaid Specs)
                  </span>
                  <span className="text-[10px] text-nb-gray-400">Open →</span>
                </button>

                <button
                  onClick={() => onOpenBrainDoc("Memory.md")}
                  className="flex w-full items-center justify-between rounded-lg border border-nb-gray-800/80 bg-nb-gray-930/80 px-3 py-2 text-xs text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                    Memory.md (Journal)
                  </span>
                  <span className="text-[10px] text-nb-gray-400">Open →</span>
                </button>

                <button
                  onClick={onOpenSecretsVault}
                  className="flex w-full items-center justify-between rounded-lg border border-nb-gray-800/80 bg-nb-gray-930/80 px-3 py-2 text-xs text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5 text-yellow-400" />
                    Secrets.enc ({secretKeysCount} keys)
                  </span>
                  <span className="text-[10px] text-nb-gray-400">Vault →</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* 3C: Reverse Proxy Tunnels Frame */}
        {(() => {
          const nodeKey = "res:reverse-proxy";
          const pos = positions[nodeKey] || { x: 770, y: 368 };
          const isDimmed = connectedSet && !connectedSet.has(nodeKey);
          return (
            <div
              ref={(el) => {
                nodeRefs.current[nodeKey] = el;
              }}
              style={{
                left: pos.x,
                top: pos.y,
                zIndex: draggingNodeId === nodeKey ? 30 : 10,
                opacity: isDimmed ? 0.25 : 1,
              }}
              onPointerDown={(e) => startNodeDrag(e, nodeKey)}
              onPointerUp={() => completeHandleDrop(nodeKey)}
              onMouseEnter={() => setHoveredNodeId(nodeKey)}
              onMouseLeave={() => setHoveredNodeId(null)}
              className={`absolute w-[310px] rounded-xl border border-nb-gray-800 bg-nb-gray-940/95 p-3.5 shadow-xl backdrop-blur space-y-2 ${
                draggingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-sky-400 shadow-2xl"
                  : "cursor-grab hover:border-nb-gray-700"
              }`}
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-nb-gray-100 flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-sky-400" />
                  Reverse Proxy Tunnels ({registeredServices.length})
                </span>
                <button
                  onClick={() => onOpenReverseProxy()}
                  className="text-[11px] text-netbird hover:underline"
                >
                  Open Proxy →
                </button>
              </div>

              {registeredServices.length > 0 ? (
                <div className="space-y-1.5">
                  {registeredServices.map((svc) => {
                    const healthy =
                      svc.healthy !== false &&
                      svc.health_check?.status !== "UNHEALTHY";
                    return (
                      <div
                        key={svc.service_id}
                        className="flex items-center justify-between rounded-lg border border-nb-gray-800/80 bg-nb-gray-930 px-3 py-2 text-xs"
                      >
                        <button
                          onClick={() => onOpenReverseProxy(svc.port)}
                          className="flex items-center gap-2 truncate text-left hover:underline"
                        >
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              healthy
                                ? "bg-green-400"
                                : "bg-red-500 animate-pulse"
                            }`}
                          />
                          <span className="truncate font-medium text-white">
                            {svc.name}
                          </span>
                        </button>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-nb-gray-300">
                            127.0.0.1:{svc.port}
                          </span>
                          {!healthy && (
                            <button
                              onClick={() => onHealService(svc.port)}
                              className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-medium text-white hover:bg-red-500"
                              title="Ask AI to Diagnose & Fix"
                            >
                              Heal
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-nb-gray-800/60 bg-nb-gray-930/50 px-3 py-2 text-[11px] text-nb-gray-400">
                  No loopback services registered yet.
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Bottom-Left NetBird Viewport Controls (Zoom In / Zoom Out / Fit View / Reset) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-auto absolute bottom-4 left-5 z-20 flex items-center gap-1 rounded-lg border border-nb-gray-800 bg-nb-gray-940/95 p-1 shadow-xl backdrop-blur"
      >
        <button
          onClick={() =>
            setZoom((z) => Number(Math.min(z + 0.12, 1.75).toFixed(2)))
          }
          className="rounded p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title="Zoom In"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <span className="px-1.5 font-mono text-[10px] text-nb-gray-300">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() =>
            setZoom((z) => Number(Math.max(z - 0.12, 0.45).toFixed(2)))
          }
          className="rounded p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title="Zoom Out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <div className="h-3.5 w-[1px] bg-nb-gray-800 mx-0.5" />
        <button
          onClick={handleFitView}
          className="rounded p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title="Fit View"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleResetLayout}
          className="rounded p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title="Reset Node Positions"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Bottom-Center Floating NetBird Action Toolbar */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-xl border border-nb-gray-800 bg-nb-gray-940/95 px-3 py-2 shadow-2xl backdrop-blur"
      >
        <button
          onClick={onOpenAddPeer}
          className="flex items-center gap-1.5 rounded-lg bg-netbird px-3 py-1.5 text-xs font-medium text-white hover:bg-netbird-500"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Peer</span>
        </button>
        <button
          onClick={onOpenAccessControl}
          className="flex items-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-1.5 text-xs text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white"
        >
          <Shield className="h-3.5 w-3.5 text-green-400" />
          <span>Rule Cartridges</span>
        </button>
        <button
          onClick={onOpenRemoteFiles}
          className="flex items-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-1.5 text-xs text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white"
        >
          <Code2 className="h-3.5 w-3.5 text-sky-400" />
          <span>Remote Files</span>
        </button>
        <button
          onClick={onOpenPty}
          className="flex items-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-1.5 text-xs text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white"
        >
          <TerminalIcon className="h-3.5 w-3.5 text-netbird" />
          <span>Live PTY</span>
        </button>
      </div>
    </div>
  );
}
