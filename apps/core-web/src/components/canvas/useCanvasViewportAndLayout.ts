"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CanvasEdge,
  CanvasPos,
  GatewayNode,
  RegisteredService,
  ServiceMeshLink,
} from "@/components/canvas/canvasTypes";

export interface UseCanvasViewportAndLayoutParams {
  gatewayNodes: GatewayNode[];
  allServices: RegisteredService[];
  serviceLinks: ServiceMeshLink[];
  measureDependencySnapshot: unknown[];
}

export const DEFAULT_NODE_W = 340;
export const MIN_NODE_W = 340;
export const MAX_NODE_W = 680;

export function useCanvasViewportAndLayout({
  gatewayNodes,
  allServices,
  serviceLinks,
  measureDependencySnapshot,
}: UseCanvasViewportAndLayoutParams) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [pan, setPan] = useState<CanvasPos>({ x: 60, y: 60 });
  const [zoom, setZoom] = useState<number>(1);
  const panRef = useRef<CanvasPos>({ x: 60, y: 60 });
  const zoomRef = useRef<number>(1);
  panRef.current = pan;
  zoomRef.current = zoom;

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
  const hasUserViewportAdjustedRef = useRef<boolean>(false);
  const lastTopologyKeyRef = useRef<string>("");
  const dragNodeStartRef = useRef<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(
    {}
  );
  const [customDims, setCustomDims] = useState<
    Record<string, { w: number; minH?: number }>
  >({});
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const resizeStartRef = useRef<{
    nodeId: string;
    mode: "w" | "wh";
    startClientX: number;
    startClientY: number;
    origW: number;
    origH: number;
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
      allServices.length > 0
        ? allServices
            .map((s) => `${s.service_id}@${s.node_id || ""}`)
            .join(",")
        : "empty",
    [allServices]
  );

  const allServicesRef = useRef(allServices);
  allServicesRef.current = allServices;

  const buildHierarchicalLayout = useCallback((): Record<string, CanvasPos> => {
    const next: Record<string, CanvasPos> = {};
    const rawPeerIds =
      peerIdsKey !== "empty" ? peerIdsKey.split(",") : ["empty"];
    const peerStep = 118;
    const svcStep = 94;

    const CORE_BASE_H = 74;
    const PEER_BASE_H = 74;
    const SVC_BASE_H = 62;

    const currentServices = allServicesRef.current;
    const servicesByPeer = new Map<string, RegisteredService[]>();
    for (const pid of rawPeerIds) {
      servicesByPeer.set(pid, []);
    }
    for (const svc of currentServices) {
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
            x: 824,
            y: Math.round(firstSvcY + idx * svcStep),
          };
        });

        next[peerKey] = { x: 430, y: peerY };
        peerCenterYs.push(peerY + PEER_BASE_H / 2);
        cursorY = Math.max(
          lastSvcY + SVC_BASE_H + 36,
          peerY + PEER_BASE_H + 36
        );
      } else {
        const peerY = cursorY;
        next[peerKey] = { x: 430, y: peerY };
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
      x: 36,
      y: Math.max(28, Math.round(midCenterY - CORE_BASE_H / 2)),
    };

    if (currentServices.length === 0) {
      next["svc:empty"] = {
        x: 824,
        y: Math.max(28, Math.round(midCenterY - SVC_BASE_H / 2)),
      };
    }

    return next;
  }, [peerIdsKey, serviceIdsKey]);

  const computeDefaultLayout = useCallback(
    (): Record<string, CanvasPos> => buildHierarchicalLayout(),
    [buildHierarchicalLayout]
  );

  const measureNodes = useCallback(() => {
    setSizes((prev) => {
      let changed = false;
      const nextSizes: Record<string, { w: number; h: number }> = { ...prev };
      for (const [id, el] of Object.entries(nodeRefs.current)) {
        if (el) {
          const w = el.offsetWidth || DEFAULT_NODE_W;
          const h = el.offsetHeight || 66;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    measureNodes,
    gatewayNodes.length,
    allServices.length,
    expandedNodes,
    customDims,
    ...measureDependencySnapshot,
  ]);

  const effectivePositions = useMemo(() => {
    const out: Record<string, CanvasPos> = { ...positions };
    if (
      expandedNodes["core:hub"] &&
      out["core:hub"] &&
      !hasUserDraggedRef.current
    ) {
      out["core:hub"] = {
        x: out["core:hub"].x,
        y: Math.min(out["core:hub"].y, 48),
      };
    }
    const coreW =
      customDims["core:hub"]?.w || sizes["core:hub"]?.w || DEFAULT_NODE_W;
    const coreExtraW = Math.max(0, coreW - DEFAULT_NODE_W);
    let maxPeerExtraW = 0;
    for (const k of Object.keys(out)) {
      if (k.startsWith("peer:")) {
        const pw = customDims[k]?.w || sizes[k]?.w || DEFAULT_NODE_W;
        maxPeerExtraW = Math.max(
          maxPeerExtraW,
          Math.max(0, pw - DEFAULT_NODE_W)
        );
      }
    }

    const shiftColumn = (
      prefix: "peer:" | "svc:",
      baseH: number,
      fallbackExpandedH: number,
      extraShiftX: number
    ) => {
      const keys = Object.keys(out)
        .filter((k) => k.startsWith(prefix))
        .sort((a, b) => (out[a]?.y ?? 0) - (out[b]?.y ?? 0));
      let extraShiftY = 0;
      keys.forEach((k, idx) => {
        const basePos = out[k];
        if (!basePos) return;
        const startY =
          prefix === "peer:" &&
          idx === 0 &&
          expandedNodes[k] &&
          !hasUserDraggedRef.current
            ? Math.min(basePos.y, 48)
            : basePos.y;
        out[k] = {
          x: Math.round(basePos.x + extraShiftX),
          y: Math.round(startY + extraShiftY),
        };
        if (expandedNodes[k]) {
          const actualH =
            sizes[k]?.h || customDims[k]?.minH || fallbackExpandedH;
          const delta = Math.max(0, actualH - baseH);
          extraShiftY += delta + 10;
        }
      });
    };
    shiftColumn("peer:", 74, 250, coreExtraW);
    shiftColumn("svc:", 62, 235, coreExtraW + maxPeerExtraW);
    return out;
  }, [positions, expandedNodes, sizes, customDims]);

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
      ...allServices.map((s) => `svc:${s.service_id}`),
    ];
    return keys.length > 0 && keys.every((k) => expandedNodes[k]);
  }, [gatewayNodes, allServices, expandedNodes]);

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
        const w = sizes[key]?.w || DEFAULT_NODE_W;
        const h =
          sizes[key]?.h ||
          (key === "core:hub" ? 108 : key.startsWith("peer:") ? 88 : 62);
        const extraRight =
          key.startsWith("svc:") && serviceLinks.length > 0 ? 155 : 0;
        if (pos.x < minX) minX = pos.x;
        if (pos.y < minY) minY = pos.y;
        if (pos.x + w + extraRight > maxX) maxX = pos.x + w + extraRight;
        if (pos.y + h > maxY) maxY = pos.y + h;
      }

      if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        minX = 36;
        minY = 48;
        maxX = 1164;
        maxY = 502;
      }

      const contentW = Math.max(400, maxX - minX);
      const contentH = Math.max(240, maxY - minY);
      const scaleX = (rect.width - 48) / contentW;
      const scaleY = (rect.height - 64) / contentH;
      const minScale = layoutOverride ? 0.56 : 0.78;
      const nextZoom = Math.min(
        Math.max(Math.min(scaleX, scaleY), minScale),
        1.05
      );
      const roundedZoom = Number(nextZoom.toFixed(2));

      const panX = Math.round(
        (rect.width - contentW * roundedZoom) / 2 - minX * roundedZoom
      );
      const panY = Math.round(
        (rect.height - contentH * roundedZoom) / 2 - minY * roundedZoom
      );

      const nextPan = { x: panX, y: Math.max(16, panY) };
      zoomRef.current = roundedZoom;
      panRef.current = nextPan;
      setZoom(roundedZoom);
      setPan(nextPan);
    },
    [positions, sizes, computeDefaultLayout, serviceLinks.length]
  );

  const applyZoomAtPoint = useCallback(
    (targetZoomRaw: number, clientX?: number, clientY?: number) => {
      const prevZoom = zoomRef.current;
      const prevPan = panRef.current;
      const nextZoom = Number(
        Math.min(Math.max(targetZoomRaw, 0.25), 3.0).toFixed(3)
      );
      if (nextZoom === prevZoom) return;

      const rect = containerRef.current?.getBoundingClientRect();
      const anchorX =
        clientX !== undefined && rect
          ? clientX - rect.left
          : rect
          ? rect.width / 2
          : window.innerWidth / 2;
      const anchorY =
        clientY !== undefined && rect
          ? clientY - rect.top
          : rect
          ? rect.height / 2
          : window.innerHeight / 2;

      const worldX = (anchorX - prevPan.x) / prevZoom;
      const worldY = (anchorY - prevPan.y) / prevZoom;

      const nextPan = {
        x: Math.round(anchorX - worldX * nextZoom),
        y: Math.round(anchorY - worldY * nextZoom),
      };

      hasUserViewportAdjustedRef.current = true;
      zoomRef.current = nextZoom;
      panRef.current = nextPan;
      setZoom(nextZoom);
      setPan(nextPan);
    },
    []
  );

  const handleToggleExpandAll = useCallback(() => {
    const target = !allExpanded;
    const next: Record<string, boolean> = { "core:hub": target };
    gatewayNodes.forEach((n) => {
      next[`peer:${n.node_id}`] = target;
    });
    allServices.forEach((s) => {
      next[`svc:${s.service_id}`] = target;
    });
    setExpandedNodes(next);
    setTimeout(measureNodes, 35);
    setTimeout(() => {
      measureNodes();
      if (!target && !hasUserViewportAdjustedRef.current) {
        handleFitView();
      }
    }, 150);
  }, [allExpanded, gatewayNodes, allServices, measureNodes, handleFitView]);

  useEffect(() => {
    const topoKey = `${peerIdsKey}|${serviceIdsKey}`;
    if (lastTopologyKeyRef.current !== topoKey) {
      lastTopologyKeyRef.current = topoKey;
      if (!hasUserDraggedRef.current) {
        const fresh = computeDefaultLayout();
        setPositions(fresh);
        if (!hasUserViewportAdjustedRef.current) {
          handleFitView(fresh);
        }
      }
    }
  }, [peerIdsKey, serviceIdsKey, computeDefaultLayout, handleFitView]);

  const handleResetLayout = useCallback(() => {
    hasUserDraggedRef.current = false;
    hasUserViewportAdjustedRef.current = false;
    setExpandedNodes({});
    setCustomDims({});
    const fresh = computeDefaultLayout();
    setPositions(fresh);
    handleFitView(fresh);
  }, [computeDefaultLayout, handleFitView]);

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

    if (allServices.length === 0) {
      const firstPeer = peerIds[0] || "core:hub";
      list.push({
        id: `${firstPeer}->svc:empty`,
        from: firstPeer,
        to: "svc:empty",
        color: "#38bdf8",
        active: false,
      });
    } else {
      for (const svc of allServices) {
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
  }, [peerIdsKey, allServices]);

  useEffect(() => {
    let rafId: number | null = null;
    let latestEvent: PointerEvent | null = null;

    function flushPointerMove() {
      rafId = null;
      const e = latestEvent;
      if (!e) return;

      if (resizeStartRef.current) {
        const r = resizeStartRef.current;
        const currentZoom = zoomRef.current || 1;
        const dx = (e.clientX - r.startClientX) / currentZoom;
        const dy = (e.clientY - r.startClientY) / currentZoom;
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
          return;
        }
        lastDragMovedRef.current = true;
        const nextW = Math.round(
          Math.min(MAX_NODE_W, Math.max(MIN_NODE_W, r.origW + dx))
        );
        const naturalMinH = r.nodeId.startsWith("svc:") ? 58 : 66;
        const minBaseH = Math.min(r.origH, naturalMinH);
        const rawNextH = Math.round(Math.max(minBaseH, r.origH + dy));
        const nextMinH =
          r.mode === "wh"
            ? rawNextH <= naturalMinH
              ? undefined
              : rawNextH
            : undefined;
        setCustomDims((prev) => ({
          ...prev,
          [r.nodeId]: {
            w: nextW,
            minH: r.mode === "wh" ? nextMinH : prev[r.nodeId]?.minH,
          },
        }));
        measureNodes();
        return;
      }

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
        const dx = e.clientX - p.startX;
        const dy = e.clientY - p.startY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          hasUserViewportAdjustedRef.current = true;
        }
        const nextPan = {
          x: p.panX + dx,
          y: p.panY + dy,
        };
        panRef.current = nextPan;
        setPan(nextPan);
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (
        !resizeStartRef.current &&
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
      if (resizeStartRef.current) {
        resizeStartRef.current = null;
        setResizingNodeId(null);
        setTimeout(measureNodes, 20);
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
  }, [zoom, isPanning, measureNodes]);

  const startNodeResize = useCallback(
    (e: React.PointerEvent, nodeId: string, mode: "w" | "wh") => {
      e.preventDefault();
      e.stopPropagation();
      const el = nodeRefs.current[nodeId];
      const effectiveMode: "w" | "wh" = expandedNodes[nodeId] ? mode : "w";
      const origW =
        customDims[nodeId]?.w || el?.offsetWidth || DEFAULT_NODE_W;
      const origH =
        (expandedNodes[nodeId] ? customDims[nodeId]?.minH : undefined) ||
        el?.offsetHeight ||
        66;
      lastDragMovedRef.current = false;
      setResizingNodeId(nodeId);
      resizeStartRef.current = {
        nodeId,
        mode: effectiveMode,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origW,
        origH,
      };
    },
    [expandedNodes, customDims]
  );

  const resetNodeSize = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setCustomDims((prev) => {
        const next = { ...prev };
        delete next[nodeId];
        return next;
      });
      setTimeout(measureNodes, 25);
    },
    [measureNodes]
  );

  const startNodeDrag = useCallback(
    (e: React.PointerEvent, nodeId: string) => {
      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("a") ||
        target.closest("input") ||
        target.closest("[data-resize-handle='true']")
      ) {
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
    },
    [positions]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        e.stopPropagation();
        const factor = e.deltaY < 0 ? 1.1 : 0.91;
        applyZoomAtPoint(zoomRef.current * factor, e.clientX, e.clientY);
      }
    };
    el.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onNativeWheel);
    };
  }, [applyZoomAtPoint]);

  const getEdgeCoords = useCallback(
    (fromId: string, toId: string) => {
      const p1 = effectivePositions[fromId] || { x: 50, y: 120 };
      const p2 = effectivePositions[toId] || { x: 470, y: 120 };
      const headerH1 =
        fromId === "core:hub" ? 74 : fromId.startsWith("peer:") ? 74 : 62;
      const headerH2 =
        toId === "core:hub" ? 74 : toId.startsWith("peer:") ? 74 : 62;

      const w1 = customDims[fromId]?.w || sizes[fromId]?.w || DEFAULT_NODE_W;
      const w2 = customDims[toId]?.w || sizes[toId]?.w || DEFAULT_NODE_W;

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
    },
    [effectivePositions, customDims, sizes]
  );

  const startCanvasPan = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      setIsPanning(true);
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    },
    [pan.x, pan.y]
  );

  return {
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
  };
}
