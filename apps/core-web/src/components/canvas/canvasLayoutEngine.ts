import type {
  CanvasEdge,
  CanvasPos,
  RegisteredService,
} from "@/components/canvas/canvasTypes";

export const DEFAULT_NODE_W = 340;
export const MIN_NODE_W = 340;
export const MAX_NODE_W = 680;

export function computeHierarchicalCanvasLayout(
  peerIdsKey: string,
  currentServices: RegisteredService[]
): Record<string, CanvasPos> {
  const next: Record<string, CanvasPos> = {};
  const rawPeerIds =
    peerIdsKey !== "empty" ? peerIdsKey.split(",") : ["empty"];
  const peerStep = 122;
  const svcStep = 158;

  const CORE_BASE_H = 74;
  const PEER_BASE_H = peerIdsKey === "empty" ? 46 : 104;
  const SVC_BASE_H = currentServices.length === 0 ? 50 : 136;

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
}

export function computeEffectiveCanvasPositions(
  positions: Record<string, CanvasPos>,
  expandedNodes: Record<string, boolean>,
  sizes: Record<string, { w: number; h: number }>,
  customDims: Record<string, { w: number; minH?: number }>,
  hasUserDragged: boolean
): Record<string, CanvasPos> {
  const out: Record<string, CanvasPos> = { ...positions };
  if (expandedNodes["core:hub"] && out["core:hub"] && !hasUserDragged) {
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
        prefix === "peer:" && idx === 0 && expandedNodes[k] && !hasUserDragged
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
  shiftColumn("peer:", 104, 250, coreExtraW);
  shiftColumn("svc:", 136, 320, coreExtraW + maxPeerExtraW);
  return out;
}

export function computeCanvasEdges(
  peerIdsKey: string,
  allServices: RegisteredService[]
): CanvasEdge[] {
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
}

export function getCanvasNodeAnchorHeight(
  nodeId: string,
  expandedNodes: Record<string, boolean>,
  sizes: Record<string, { w: number; h: number }>
): number {
  if (!expandedNodes[nodeId]) {
    if (sizes[nodeId]?.h) return sizes[nodeId].h;
    if (nodeId === "core:hub") return 74;
    if (nodeId === "peer:empty") return 46;
    if (nodeId.startsWith("peer:")) return 104;
    if (nodeId === "svc:empty") return 50;
    return 136;
  }
  if (nodeId === "core:hub") return 74;
  if (nodeId === "peer:empty") return 46;
  if (nodeId.startsWith("peer:")) return 66;
  if (nodeId === "svc:empty") return 50;
  return 58;
}

export function computeCanvasEdgeCoords(
  fromId: string,
  toId: string,
  effectivePositions: Record<string, CanvasPos>,
  customDims: Record<string, { w: number; minH?: number }>,
  sizes: Record<string, { w: number; h: number }>,
  expandedNodes: Record<string, boolean>
) {
  const p1 = effectivePositions[fromId] || { x: 50, y: 120 };
  const p2 = effectivePositions[toId] || { x: 470, y: 120 };
  const headerH1 = getCanvasNodeAnchorHeight(fromId, expandedNodes, sizes);
  const headerH2 = getCanvasNodeAnchorHeight(toId, expandedNodes, sizes);

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
}

export function computeFitViewViewport(
  rect: DOMRect,
  activeLayout: Record<string, CanvasPos>,
  sizes: Record<string, { w: number; h: number }>,
  hasServiceLinks: boolean
): { zoom: number; pan: CanvasPos } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [key, pos] of Object.entries(activeLayout)) {
    if (!pos) continue;
    const w = sizes[key]?.w || DEFAULT_NODE_W;
    const h =
      sizes[key]?.h ||
      (key === "core:hub" ? 74 : key.startsWith("peer:") ? 104 : 136);
    const extraRight = key.startsWith("svc:") && hasServiceLinks ? 185 : 0;
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
  const availW = Math.max(320, rect.width - 48);
  const availH = Math.max(220, rect.height - 96);
  const scaleX = availW / contentW;
  const scaleY = availH / contentH;
  const nextZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.48), 1.05);
  const roundedZoom = Number(nextZoom.toFixed(2));

  const rawPanX = Math.round(
    (rect.width - contentW * roundedZoom) / 2 - minX * roundedZoom
  );
  const rawPanY = Math.round(
    (availH - contentH * roundedZoom) / 2 + 18 - minY * roundedZoom
  );
  const minAllowedPanX = Math.round(20 - minX * roundedZoom);
  const minAllowedPanY = Math.round(18 - minY * roundedZoom);

  return {
    zoom: roundedZoom,
    pan: {
      x: Math.max(minAllowedPanX, rawPanX),
      y: Math.max(minAllowedPanY, rawPanY),
    },
  };
}
