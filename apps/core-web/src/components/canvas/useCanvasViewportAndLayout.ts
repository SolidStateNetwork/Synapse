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
import {
  DEFAULT_NODE_W,
  MAX_NODE_W,
  MIN_NODE_W,
  computeCanvasEdgeCoords,
  computeCanvasEdges,
  computeEffectiveCanvasPositions,
  computeFitViewViewport,
  computeHierarchicalCanvasLayout,
} from "./canvasLayoutEngine";

export { DEFAULT_NODE_W, MIN_NODE_W, MAX_NODE_W };

export interface UseCanvasViewportAndLayoutParams {
  gatewayNodes: GatewayNode[];
  allServices: RegisteredService[];
  serviceLinks: ServiceMeshLink[];
  measureDependencySnapshot: unknown[];
}

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

  const computeDefaultLayout = useCallback(
    (): Record<string, CanvasPos> =>
      computeHierarchicalCanvasLayout(peerIdsKey, allServicesRef.current),
    [peerIdsKey, serviceIdsKey]
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
    const timer = setTimeout(() => {
      measureNodes();
      if (
        Object.values(expandedNodes).some(Boolean) &&
        !hasUserViewportAdjustedRef.current
      ) {
        setTimeout(() => fitViewLatestRef.current(), 35);
      }
    }, 70);
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

  const effectivePositions = useMemo(
    () =>
      computeEffectiveCanvasPositions(
        positions,
        expandedNodes,
        sizes,
        customDims,
        hasUserDraggedRef.current
      ),
    [positions, expandedNodes, sizes, customDims]
  );

  const fitViewLatestRef = useRef<() => void>(() => {});

  const toggleExpandNode = useCallback(
    (nodeKey: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setExpandedNodes((prev) => ({
        ...prev,
        [nodeKey]: !prev[nodeKey],
      }));
      setTimeout(measureNodes, 25);
      setTimeout(() => {
        measureNodes();
        if (!hasUserViewportAdjustedRef.current) {
          setTimeout(() => fitViewLatestRef.current(), 35);
        }
      }, 110);
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
          : Object.keys(effectivePositions).length > 0
          ? effectivePositions
          : computeDefaultLayout();

      const { zoom: roundedZoom, pan: nextPan } = computeFitViewViewport(
        rect,
        activeLayout,
        sizes,
        serviceLinks.length > 0
      );
      zoomRef.current = roundedZoom;
      panRef.current = nextPan;
      setZoom(roundedZoom);
      setPan(nextPan);
    },
    [effectivePositions, sizes, computeDefaultLayout, serviceLinks.length]
  );

  fitViewLatestRef.current = () => handleFitView();

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
      if (!hasUserViewportAdjustedRef.current) {
        setTimeout(() => fitViewLatestRef.current(), 40);
      }
    }, 150);
  }, [allExpanded, gatewayNodes, allServices, measureNodes]);

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

  const edges = useMemo<CanvasEdge[]>(
    () => computeCanvasEdges(peerIdsKey, allServices),
    [peerIdsKey, allServices]
  );

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
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
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
        const nextPan = { x: p.panX + dx, y: p.panY + dy };
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
      if (rafId !== null) window.cancelAnimationFrame(rafId);
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
      const origW = customDims[nodeId]?.w || el?.offsetWidth || DEFAULT_NODE_W;
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
        target.closest(
          "button, a, input, select, textarea, label, [data-canvas-scroll-zone='true'], [data-canvas-modal='true'], .overflow-y-auto, [data-resize-handle='true']"
        )
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
      const target = e.target as HTMLElement | null;
      if (target && !e.ctrlKey && !e.metaKey) {
        if (
          target.closest(
            "[data-canvas-modal='true'], textarea, select, input"
          )
        ) {
          return;
        }
        const scrollZone = target.closest(
          "[data-canvas-scroll-zone='true']"
        ) as HTMLElement | null;
        if (scrollZone) {
          let isInsideScrollable = false;
          let walk: HTMLElement | null = target;
          while (walk && walk !== el) {
            const oy = window.getComputedStyle(walk).overflowY;
            if (oy === "auto" || oy === "scroll") {
              isInsideScrollable = true;
              break;
            }
            walk = walk.parentElement;
          }
          if (!isInsideScrollable) {
            const innerScroll = scrollZone.querySelector(
              ".overflow-y-auto, .overflow-auto"
            ) as HTMLElement | null;
            if (innerScroll) {
              innerScroll.scrollTop += e.deltaY;
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          }
          return;
        }
        let curr: HTMLElement | null = target;
        while (curr && curr !== el) {
          const oy = window.getComputedStyle(curr).overflowY;
          if (oy === "auto" || oy === "scroll") return;
          curr = curr.parentElement;
        }
      }
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        e.stopPropagation();
        const factor = e.deltaY < 0 ? 1.1 : 0.91;
        applyZoomAtPoint(zoomRef.current * factor, e.clientX, e.clientY);
      }
    };
    el.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => el.removeEventListener("wheel", onNativeWheel);
  }, [applyZoomAtPoint]);

  const getEdgeCoords = useCallback(
    (fromId: string, toId: string) =>
      computeCanvasEdgeCoords(fromId, toId, effectivePositions, customDims, sizes, expandedNodes),
    [effectivePositions, customDims, sizes, expandedNodes]
  );

  const startCanvasPan = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      setIsPanning(true);
      panStartRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    },
    [pan.x, pan.y]
  );

  return {
    containerRef, nodeRefs, pan, zoom, zoomRef, isPanning, sizes, draggingNodeId,
    lastDragMovedRef, hoveredNodeId, setHoveredNodeId, expandedNodes, customDims,
    resizingNodeId, effectivePositions, toggleExpandNode, allExpanded, handleFitView,
    applyZoomAtPoint, handleToggleExpandAll, handleResetLayout, edges, startNodeResize,
    resetNodeSize, startNodeDrag, getEdgeCoords, startCanvasPan,
  };
}
