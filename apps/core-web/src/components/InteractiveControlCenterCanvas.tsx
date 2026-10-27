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
  Database,
  ExternalLink,
  FileText,
  FolderGit2,
  Globe,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  Maximize2,
  MonitorSmartphone,
  Network,
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
  const [centerMode, setCenterMode] = useState<"overview" | "canvas">(
    "overview"
  );
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

  // Categorized services for structured sorting
  const groupedServices = useMemo(() => {
    const webui = registeredServices.filter((s) => s.category === "webui");
    const database = registeredServices.filter(
      (s) => s.category === "database"
    );
    const backend = registeredServices.filter(
      (s) => s.category !== "webui" && s.category !== "database"
    );
    return { webui, backend, database };
  }, [registeredServices]);

  // Compute deterministic non-overlapping layout coordinates for all nodes based on `flowView`
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

    const peerBlockHeight = peerIds.length * 225;

    if (flowView === "ai-agent") {
      next["res:ai-provider"] = { x: 40, y: 120 };
      next["res:brain-vault"] = { x: 40, y: 240 };
      policyIds.forEach((pid, idx) => {
        next[pid] = { x: 430, y: 70 + idx * 62 };
      });
      peerIds.forEach((id, idx) => {
        next[id] = { x: 780, y: 70 + idx * 225 };
      });
      next["res:reverse-proxy"] = {
        x: 780,
        y: 70 + Math.max(peerBlockHeight, 225) + 20,
      };
      return next;
    }

    if (flowView === "groups") {
      next["res:brain-vault"] = { x: 40, y: 80 };
      next["res:ai-provider"] = { x: 40, y: 310 };
      policyIds.forEach((pid, idx) => {
        next[pid] = { x: 430, y: 70 + idx * 62 };
      });
      peerIds.forEach((id, idx) => {
        next[id] = { x: 780, y: 70 + idx * 225 };
      });
      next["res:reverse-proxy"] = {
        x: 780,
        y: 70 + Math.max(peerBlockHeight, 225) + 20,
      };
      return next;
    }

    if (flowView === "networks") {
      next["res:reverse-proxy"] = { x: 40, y: 80 };
      next["res:ai-provider"] = { x: 40, y: 350 };
      policyIds.forEach((pid, idx) => {
        next[pid] = { x: 430, y: 70 + idx * 62 };
      });
      peerIds.forEach((id, idx) => {
        next[id] = { x: 780, y: 70 + idx * 225 };
      });
      next["res:brain-vault"] = {
        x: 780,
        y: 70 + Math.max(peerBlockHeight, 225) + 20,
      };
      return next;
    }

    // Default `peers` View: Column 1 (x=40) Peers -> Column 2 (x=430) Policies -> Column 3 (x=780) Resources
    peerIds.forEach((id, idx) => {
      next[id] = { x: 40, y: 75 + idx * 225 };
    });

    policyIds.forEach((pid, idx) => {
      next[pid] = { x: 430, y: 75 + idx * 60 };
    });

    next["res:ai-provider"] = { x: 780, y: 75 };
    next["res:brain-vault"] = { x: 780, y: 185 };
    next["res:reverse-proxy"] = { x: 780, y: 405 };

    return next;
  }, [peerIdsKey, cartridgeIdsKey, flowView]);

  // Initialize or update layout when flowView changes or new nodes arrive
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
    if (centerMode !== "canvas") return;
    measureNodes();
    const timer = setTimeout(measureNodes, 80);
    window.addEventListener("resize", measureNodes);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measureNodes);
    };
  }, [
    centerMode,
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
    const targetW = 1140;
    const targetH = 620;
    const scaleX = (rect.width - 60) / targetW;
    const scaleY = (rect.height - 90) / targetH;
    const nextZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.62), 1.1);
    const offsetX = Math.max(24, (rect.width - targetW * nextZoom) / 2);
    const offsetY = Math.max(28, (rect.height - targetH * nextZoom) / 2);
    setZoom(Number(nextZoom.toFixed(2)));
    setPan({ x: Math.round(offsetX), y: Math.round(offsetY) });
  }, []);

  useEffect(() => {
    if (centerMode === "canvas") {
      handleFitView();
    }
  }, [centerMode, handleFitView]);

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

  function getEdgeCoords(fromId: string, toId: string) {
    const p1 = positions[fromId] || { x: 40, y: 120 };
    const s1 = sizes[fromId] || { w: 280, h: 64 };
    const p2 = positions[toId] || { x: 430, y: 120 };
    const s2 = sizes[toId] || { w: 245, h: 42 };

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
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* ═══════════════════════════════════════════════════════════════════
          TOP CONTROL-CENTER SUB-BAR (Structured Overview vs. Topology Graph)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-nb-gray-900 bg-nb-gray-940/90 px-6 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-0.5">
            <button
              type="button"
              onClick={() => setCenterMode("overview")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                centerMode === "overview"
                  ? "bg-netbird text-white shadow-sm"
                  : "text-nb-gray-400 hover:text-white"
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Strukturierte Übersicht</span>
            </button>
            <button
              type="button"
              onClick={() => setCenterMode("canvas")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                centerMode === "canvas"
                  ? "bg-netbird text-white shadow-sm"
                  : "text-nb-gray-400 hover:text-white"
              }`}
            >
              <Network className="h-3.5 w-3.5" />
              <span>Interaktiver Topologie-Graph</span>
            </button>
          </div>
          <span className="hidden md:inline-block text-[11px] text-nb-gray-400 ml-2">
            {centerMode === "overview"
              ? "Alle Server, Dienste (WebUI / API / DB) und Sicherheitsregeln sauber nach Kategorien sortiert."
              : "Visuelle mTLS-Overlay-Topologie (Knoten frei verschiebbar · Scroll zum Zoomen)."}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {centerMode === "canvas" && (
            <button
              type="button"
              onClick={handleResetLayout}
              className="flex items-center gap-1.5 rounded-md border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-1 text-xs text-nb-gray-300 hover:text-white"
            >
              <LayoutGrid className="h-3.5 w-3.5 text-netbird" />
              <span>Auto-Layout</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenReverseProxy()}
            className="flex items-center gap-1.5 rounded-md border border-sky-500/40 bg-sky-950/50 px-3 py-1 text-xs font-medium text-sky-300 hover:bg-sky-900/60"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Services &amp; Live-Preview ({registeredServices.length})</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MODE 1: CLEAN, SORTED DASHBOARD OVERVIEW (`overview`)
      ═══════════════════════════════════════════════════════════════════ */}
      {centerMode === "overview" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-6xl space-y-6">
            {/* ROW 1: 4 CLEAR SUMMARY KPI CARDS */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* KPI 1: Muscle Peers */}
              <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-nb-gray-400">
                    1. Muscle Peers (Server)
                  </span>
                  <Server className="h-4 w-4 text-netbird" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-white">
                    {gatewayNodes.filter((n) => n.online).length}
                    <span className="text-sm font-normal text-nb-gray-400">
                      {" "}
                      / {gatewayNodes.length || 0} Online
                    </span>
                  </span>
                  <span className="font-mono text-[10px] text-green-400">
                    mTLS 1.3
                  </span>
                </div>
                <div className="text-[11px] text-nb-gray-400 truncate">
                  Primär:{" "}
                  <strong className="font-mono text-nb-gray-200">
                    {primaryNode || "Kein Server"}
                  </strong>
                </div>
              </div>

              {/* KPI 2: Reachable Services */}
              <div
                onClick={() => onOpenReverseProxy()}
                className="cursor-pointer rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-4 space-y-2 hover:border-sky-500/50 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-nb-gray-400">
                    2. Erreichbare Dienste
                  </span>
                  <Globe className="h-4 w-4 text-sky-400" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-white">
                    {registeredServices.length}
                  </span>
                  <span className="text-[11px] text-netbird hover:underline">
                    Alle öffnen →
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px] text-nb-gray-300">
                  <span className="rounded bg-sky-950/70 px-1.5 py-0.5 text-sky-300">
                    {groupedServices.webui.length} WebUI
                  </span>
                  <span className="rounded bg-netbird-950/70 px-1.5 py-0.5 text-netbird">
                    {groupedServices.backend.length} API
                  </span>
                  <span className="rounded bg-purple-950/70 px-1.5 py-0.5 text-purple-300">
                    {groupedServices.database.length} DB
                  </span>
                </div>
              </div>

              {/* KPI 3: Security & Rule Cartridges */}
              <div
                onClick={onOpenAccessControl}
                className="cursor-pointer rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-4 space-y-2 hover:border-emerald-500/50 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-nb-gray-400">
                    3. Sicherheit &amp; Regeln
                  </span>
                  <Shield className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-white">
                    {activeCartridges.length}
                    <span className="text-sm font-normal text-nb-gray-400">
                      {" "}
                      / {cartridges.length} aktiv
                    </span>
                  </span>
                </div>
                <div className="font-mono text-[10px] text-netbird truncate">
                  {gatewayNodes[0]?.tier || joinTier}
                </div>
              </div>

              {/* KPI 4: AI Provider & Brain Vault */}
              <div
                onClick={onOpenAiSettings}
                className="cursor-pointer rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-4 space-y-2 hover:border-netbird/50 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-nb-gray-400">
                    4. KI-Engine &amp; Vault
                  </span>
                  <Bot className="h-4 w-4 text-netbird" />
                </div>
                <div className="truncate font-mono text-base font-bold text-white">
                  {modelName}
                </div>
                <div className="flex items-center justify-between text-[11px] text-nb-gray-400">
                  <span>{secretKeysCount} Secrets (AES-256)</span>
                  <span className="text-netbird">Konfigurieren →</span>
                </div>
              </div>
            </div>

            {/* ROW 2: 3 CLEARLY SORTED COLUMNS */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* COLUMN 1 (4 Cols): VERBUNDENE MUSCLE PEERS (SERVER) */}
              <div className="lg:col-span-4 space-y-3">
                <div className="flex items-center justify-between border-b border-nb-gray-800 pb-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-nb-gray-200 flex items-center gap-2">
                    <Server className="h-3.5 w-3.5 text-netbird" />
                    <span>1. Verbundene Server (Peers)</span>
                  </h2>
                  <button
                    onClick={onOpenAddPeer}
                    className="text-[11px] font-medium text-netbird hover:underline"
                  >
                    + Server hinzufügen
                  </button>
                </div>

                {gatewayNodes.length === 0 ? (
                  <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-5 text-center space-y-3">
                    <MonitorSmartphone className="mx-auto h-7 w-7 text-netbird" />
                    <div className="text-xs font-medium text-white">
                      Noch kein Muscle-Server verbunden
                    </div>
                    <button
                      onClick={onOpenAddPeer}
                      className="rounded-md bg-netbird px-3.5 py-1.5 text-xs font-medium text-white hover:bg-netbird-500"
                    >
                      + Ersten Server verbinden
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {gatewayNodes.map((gn) => {
                      const hb = gn.last_heartbeat;
                      const isPrimary = primaryNode === gn.node_id;
                      return (
                        <div
                          key={gn.node_id}
                          onClick={() => onSelectNode(gn.node_id)}
                          className={`cursor-pointer rounded-xl border p-4 transition space-y-3 ${
                            isPrimary
                              ? "border-netbird bg-nb-gray-930 ring-1 ring-netbird/30"
                              : "border-nb-gray-800 bg-nb-gray-940 hover:border-nb-gray-700"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2.5 w-2.5 rounded-full ${
                                    gn.online
                                      ? "bg-green-400"
                                      : "bg-nb-gray-500"
                                  }`}
                                />
                                <span className="font-mono text-sm font-semibold text-white">
                                  {gn.node_id}
                                </span>
                              </div>
                              <div className="mt-0.5 font-mono text-[11px] text-nb-gray-400">
                                {hb?.private_ipv4 || "127.0.0.1"} ·{" "}
                                {hb?.os_info || hb?.os_arch || "linux/amd64"}
                              </div>
                            </div>
                            <span className="rounded border border-netbird-500/40 bg-netbird-950 px-2 py-0.5 font-mono text-[10px] text-netbird">
                              {gn.tier.replace("TIER_", "T")}
                            </span>
                          </div>

                          {hb && (
                            <div className="grid grid-cols-3 gap-2 rounded-lg border border-nb-gray-800/80 bg-nb-gray-950 p-2.5 font-mono text-[10px]">
                              <div>
                                <div className="text-nb-gray-400">CPU</div>
                                <div className="text-xs font-semibold text-white">
                                  {hb.cpu_percent.toFixed(1)}%
                                </div>
                              </div>
                              <div>
                                <div className="text-nb-gray-400">RAM</div>
                                <div className="text-xs font-semibold text-white">
                                  {hb.ram_percent.toFixed(1)}%
                                </div>
                              </div>
                              <div>
                                <div className="text-nb-gray-400">DISK</div>
                                <div className="text-xs font-semibold text-white">
                                  {hb.disk_percent.toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1 text-xs">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectNode(gn.node_id);
                                onOpenRemoteFiles();
                              }}
                              className="flex items-center gap-1 text-nb-gray-300 hover:text-white"
                            >
                              <Code2 className="h-3.5 w-3.5 text-sky-400" />
                              <span>Dateien</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectNode(gn.node_id);
                                onOpenPty();
                              }}
                              className="flex items-center gap-1 text-netbird hover:underline font-medium"
                            >
                              <TerminalIcon className="h-3.5 w-3.5" />
                              <span>Live PTY Terminal →</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* COLUMN 2 (5 Cols): ERREICHBARE PROJEKT-DIENSTE (SORTIERT NACH KATEGORIEN) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between border-b border-nb-gray-800 pb-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-nb-gray-200 flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-sky-400" />
                    <span>
                      2. Erreichbare Dienste (WebUI · Backend · Datenbank)
                    </span>
                  </h2>
                  <button
                    onClick={() => onOpenReverseProxy()}
                    className="text-[11px] font-medium text-netbird hover:underline"
                  >
                    Live-Preview &amp; Tester →
                  </button>
                </div>

                {registeredServices.length === 0 ? (
                  <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-5 text-center space-y-3">
                    <Globe className="mx-auto h-7 w-7 text-sky-400" />
                    <div className="text-xs font-medium text-white">
                      Noch keine Dienste in diesem Projekt registriert
                    </div>
                    <p className="text-[11px] text-nb-gray-400">
                      Sobald die KI eine WebUI, ein Backend oder eine Datenbank
                      anlegt, erscheint hier automatisch eine klickbare Box.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {[
                      {
                        key: "webui",
                        title: "🌐 WebUIs & Frontends",
                        badgeClass:
                          "border-sky-500/40 bg-sky-950/60 text-sky-300",
                        items: groupedServices.webui,
                      },
                      {
                        key: "backend",
                        title: "⚡ Backend & REST APIs",
                        badgeClass:
                          "border-netbird-500/40 bg-netbird-950/60 text-netbird",
                        items: groupedServices.backend,
                      },
                      {
                        key: "database",
                        title: "🗄️ Datenbanken",
                        badgeClass:
                          "border-purple-500/40 bg-purple-950/60 text-purple-300",
                        items: groupedServices.database,
                      },
                    ]
                      .filter((group) => group.items.length > 0)
                      .map((group) => (
                        <div key={group.key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-semibold text-nb-gray-300">
                              {group.title} ({group.items.length})
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            {group.items.map((svc) => {
                              const healthy =
                                svc.healthy !== false &&
                                svc.health_check?.status !== "UNHEALTHY";
                              return (
                                <div
                                  key={svc.service_id}
                                  onClick={() => onOpenReverseProxy(svc.port)}
                                  className="cursor-pointer rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-3.5 hover:border-netbird/60 transition space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
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
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[10px] text-nb-gray-300">
                                        {svc.node_id}:{svc.port}
                                      </span>
                                      <span className="rounded bg-netbird/20 border border-netbird/40 px-2 py-0.5 text-[10px] font-medium text-netbird">
                                        Öffnen →
                                      </span>
                                    </div>
                                  </div>

                                  {svc.description && (
                                    <p className="text-[11px] text-nb-gray-400 line-clamp-2">
                                      {svc.description}
                                    </p>
                                  )}

                                  {svc.endpoints && svc.endpoints.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-0.5">
                                      {svc.endpoints.slice(0, 4).map((ep) => (
                                        <span
                                          key={ep.id}
                                          className="rounded border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 font-mono text-[10px] text-nb-gray-300"
                                        >
                                          <strong className="text-netbird">
                                            {ep.method}
                                          </strong>{" "}
                                          {ep.label}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* COLUMN 3 (3 Cols): BRAIN VAULT & AKTIVE REGELN */}
              <div className="lg:col-span-3 space-y-4">
                {/* Brain Vault Box */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-nb-gray-800 pb-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-nb-gray-200 flex items-center gap-2">
                      <FolderGit2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>3. Projekt Brain Vault</span>
                    </h2>
                  </div>

                  <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-3 space-y-2">
                    <button
                      onClick={() => onOpenBrainDoc("Architecture.md")}
                      className="flex w-full items-center justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-930 px-3 py-2 text-xs text-nb-gray-200 hover:border-netbird hover:text-white transition"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-netbird" />
                        <span>Architecture.md</span>
                      </span>
                      <span className="text-[10px] text-nb-gray-400">
                        Öffnen →
                      </span>
                    </button>

                    <button
                      onClick={() => onOpenBrainDoc("Memory.md")}
                      className="flex w-full items-center justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-930 px-3 py-2 text-xs text-nb-gray-200 hover:border-netbird hover:text-white transition"
                    >
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                        <span>Memory.md (Journal)</span>
                      </span>
                      <span className="text-[10px] text-nb-gray-400">
                        Öffnen →
                      </span>
                    </button>

                    <button
                      onClick={onOpenSecretsVault}
                      className="flex w-full items-center justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-930 px-3 py-2 text-xs text-nb-gray-200 hover:border-netbird hover:text-white transition"
                    >
                      <span className="flex items-center gap-2">
                        <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                        <span>Secrets.enc ({secretKeysCount})</span>
                      </span>
                      <span className="text-[10px] text-nb-gray-400">
                        Tresor →
                      </span>
                    </button>
                  </div>
                </div>

                {/* Rule Cartridges Box */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between border-b border-nb-gray-800 pb-2">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-nb-gray-200 flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-netbird" />
                      <span>DevOps Rule Cartridges</span>
                    </h2>
                    <button
                      onClick={onOpenAccessControl}
                      className="text-[11px] text-netbird hover:underline"
                    >
                      Alle →
                    </button>
                  </div>

                  <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-3 space-y-1.5">
                    {cartridges.map((c) => {
                      const enabled = activeCartridges.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => onToggleCartridge(c.id)}
                          className="flex cursor-pointer items-center justify-between rounded-lg border border-nb-gray-800/80 bg-nb-gray-930 px-2.5 py-1.5 text-xs hover:border-nb-gray-700"
                        >
                          <span className="truncate text-nb-gray-200 pr-2">
                            {c.name}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold ${
                              enabled
                                ? "bg-green-950 text-green-400 border border-green-500/40"
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
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODE 2: INTERACTIVE TOPOLOGY GRAPH CANVAS (`canvas`)
      ═══════════════════════════════════════════════════════════════════ */}
      {centerMode === "canvas" && (
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
          className={`nb-canvas-grid relative flex-1 w-full overflow-hidden select-none ${
            isPanning ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          {/* TRANSFORMED INFINITE GRAPH LAYER (Column Headers + SVG Edges + Draggable Node Cards) */}
          <div
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: "0 0",
            }}
            className="absolute left-0 top-0 h-[1200px] w-[1600px]"
          >
            {/* COLUMN LANE HEADERS FOR CLEAR VISUAL STRUCTURE */}
            <div
              style={{ left: 40, top: 24 }}
              className="pointer-events-none absolute w-[295px] rounded-lg border border-nb-gray-800/80 bg-nb-gray-940/90 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-300"
            >
              1. Muscle Peers (Enrolled Nodes)
            </div>
            <div
              style={{ left: 430, top: 24 }}
              className="pointer-events-none absolute w-[248px] rounded-lg border border-nb-gray-800/80 bg-nb-gray-940/90 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-300"
            >
              2. Security &amp; Rule Cartridges
            </div>
            <div
              style={{ left: 780, top: 24 }}
              className="pointer-events-none absolute w-[310px] rounded-lg border border-nb-gray-800/80 bg-nb-gray-940/90 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-300"
            >
              3. AI Engine, Brain Vault &amp; Services
            </div>

            {/* DYNAMIC PIXEL-ACCURATE BEZIER EDGES SVG LAYER */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              style={{ zIndex: 1 }}
            >
              {edges.map((edge) => {
                const { x1, y1, x2, y2, d } = getEdgeCoords(edge.from, edge.to);
                const isHighlighted =
                  activeHighlightNode &&
                  (edge.from === activeHighlightNode ||
                    edge.to === activeHighlightNode);
                const isDimmed = activeHighlightNode && !isHighlighted;

                return (
                  <g
                    key={edge.id}
                    style={{
                      opacity: isDimmed ? 0.12 : edge.active ? 0.85 : 0.25,
                      transition: "opacity 150ms ease",
                    }}
                  >
                    {isHighlighted && (
                      <path
                        d={d}
                        fill="none"
                        stroke={edge.color}
                        strokeWidth={4.5}
                        strokeOpacity={0.22}
                      />
                    )}
                    <path
                      d={d}
                      fill="none"
                      stroke={edge.color}
                      strokeWidth={isHighlighted ? 2.4 : 1.6}
                      strokeDasharray={edge.active ? "6 6" : "4 6"}
                      className={edge.active ? "cc-animated-edge" : ""}
                    />
                    <circle
                      cx={x1}
                      cy={y1}
                      r={3}
                      fill="#181a1d"
                      stroke={edge.color}
                      strokeWidth={1.6}
                    />
                    <circle
                      cx={x2}
                      cy={y2}
                      r={3}
                      fill="#181a1d"
                      stroke={edge.color}
                      strokeWidth={1.6}
                    />
                  </g>
                );
              })}

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

            {/* 1. DRAGGABLE MUSCLE PEER NODES */}
            {peerNodesToRender.map((gn) => {
              const nodeKey =
                gn.node_id === "empty" ? "peer:empty" : `peer:${gn.node_id}`;
              const pos = positions[nodeKey] || { x: 40, y: 75 };
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
                  <div
                    onPointerDown={(e) =>
                      startHandleConnect(e, nodeKey, "left")
                    }
                    title="Drag connection to any Policy Pill"
                    className="absolute -left-2 top-1/2 -translate-y-1/2 flex h-4 w-4 cursor-crosshair items-center justify-center rounded-full border border-nb-gray-700 bg-nb-gray-940 opacity-0 group-hover/peer:opacity-100 hover:border-netbird hover:scale-125 transition"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-netbird" />
                  </div>

                  <div
                    onPointerDown={(e) =>
                      startHandleConnect(e, nodeKey, "right")
                    }
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

            {/* 2A: Autonomy Tier Policy Pill */}
            {(() => {
              const nodeKey = "policy:tier";
              const pos = positions[nodeKey] || { x: 430, y: 75 };
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
                    setFocusedNodeId((prev) =>
                      prev === nodeKey ? null : nodeKey
                    );
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
                x: 430,
                y: 75 + (idx + 1) * 60,
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
                    setFocusedNodeId((prev) =>
                      prev === nodeKey ? null : nodeKey
                    );
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
                x: 430,
                y: 75 + (cartridges.length + 1) * 60,
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
                    setFocusedNodeId((prev) =>
                      prev === nodeKey ? null : nodeKey
                    );
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

            {/* 3A: AI Orchestrator Provider Frame */}
            {(() => {
              const nodeKey = "res:ai-provider";
              const pos = positions[nodeKey] || { x: 780, y: 75 };
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
              const pos = positions[nodeKey] || { x: 780, y: 185 };
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
                      <span className="text-[10px] text-nb-gray-400">
                        Open →
                      </span>
                    </button>

                    <button
                      onClick={() => onOpenBrainDoc("Memory.md")}
                      className="flex w-full items-center justify-between rounded-lg border border-nb-gray-800/80 bg-nb-gray-930/80 px-3 py-2 text-xs text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white"
                    >
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                        Memory.md (Journal)
                      </span>
                      <span className="text-[10px] text-nb-gray-400">
                        Open →
                      </span>
                    </button>

                    <button
                      onClick={onOpenSecretsVault}
                      className="flex w-full items-center justify-between rounded-lg border border-nb-gray-800/80 bg-nb-gray-930/80 px-3 py-2 text-xs text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white"
                    >
                      <span className="flex items-center gap-2">
                        <KeyRound className="h-3.5 w-3.5 text-yellow-400" />
                        Secrets.enc ({secretKeysCount} keys)
                      </span>
                      <span className="text-[10px] text-nb-gray-400">
                        Vault →
                      </span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 3C: Reverse Proxy Tunnels Frame */}
            {(() => {
              const nodeKey = "res:reverse-proxy";
              const pos = positions[nodeKey] || { x: 780, y: 405 };
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
                      Reverse Proxy Services ({registeredServices.length})
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
                        const catBadge =
                          svc.category === "webui"
                            ? "🌐"
                            : svc.category === "database"
                            ? "🗄️"
                            : "⚡";
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
                              <span>{catBadge}</span>
                              <span className="truncate font-medium text-white">
                                {svc.name}
                              </span>
                            </button>
                            <span className="font-mono text-[10px] text-nb-gray-300">
                              :{svc.port}
                            </span>
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

          {/* Bottom-Left Viewport Controls */}
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
        </div>
      )}
    </div>
  );
}
