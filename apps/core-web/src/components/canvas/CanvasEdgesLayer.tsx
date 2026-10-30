"use client";

import React from "react";
import type {
  CanvasEdge,
  CanvasPos,
  ServiceMeshLink,
} from "@/components/canvas/canvasTypes";

export interface CanvasEdgesLayerProps {
  pan: CanvasPos;
  zoom: number;
  edges: CanvasEdge[];
  hoveredNodeId: string | null;
  getEdgeCoords: (
    fromId: string,
    toId: string
  ) => { x1: number; y1: number; x2: number; y2: number; d: string };
  serviceLinks: ServiceMeshLink[];
  effectivePositions: Record<string, CanvasPos>;
  customDims: Record<string, { w: number; minH?: number }>;
  sizes: Record<string, { w: number; h: number }>;
  defaultNodeW: number;
}

export const CanvasEdgesLayer = React.memo(function CanvasEdgesLayer({
  pan,
  zoom,
  edges,
  hoveredNodeId,
  getEdgeCoords,
  serviceLinks,
  effectivePositions,
  customDims,
  sizes,
  defaultNodeW,
}: CanvasEdgesLayerProps) {
  return (
    <svg
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
      style={{
        transform: `translate(${Math.round(pan.x)}px, ${Math.round(pan.y)}px) scale(${zoom})`,
        transformOrigin: "0 0",
        zIndex: 1,
      }}
      className="pointer-events-none absolute left-0 top-0 h-[1000px] w-[1400px] overflow-visible"
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
          const secondaryColor = isPeerEdge ? "#f68330" : "#38bdf8";

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
              <path
                d={d}
                fill="none"
                stroke={edge.color}
                strokeOpacity={isHovered ? 0.28 : 0.09}
                strokeWidth={isHovered ? 8 : 5}
                strokeLinecap="round"
                style={{
                  transition:
                    "stroke-opacity 180ms ease, stroke-width 180ms ease",
                }}
              />

              <path
                d={d}
                fill="none"
                stroke={edge.color}
                strokeOpacity={isHovered ? 0.55 : 0.24}
                strokeWidth={isHovered ? 2.2 : 1.5}
                strokeLinecap="round"
                style={{
                  transition:
                    "stroke-opacity 180ms ease, stroke-width 180ms ease",
                }}
              />

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
                    transition:
                      "stroke-opacity 180ms ease, stroke-width 180ms ease",
                  }}
                />
              )}

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

      {(() => {
        const labelItems: Array<{
          id: string;
          midX: number;
          midY: number;
          badgeW: number;
          protocol: string;
          isHovered: boolean;
        }> = [];
        const usedYs: number[] = [];
        const renderedMeshPorts = new Set<string>();
        const placedSpans: Array<{
          minY: number;
          maxY: number;
          lane: number;
        }> = [];

        const getAnchorY = (svcKey: string) => {
          const p = effectivePositions[svcKey];
          if (!p) return null;
          const h =
            sizes[svcKey]?.h && sizes[svcKey].h <= 165
              ? sizes[svcKey].h
              : sizes[svcKey]?.h && sizes[svcKey].h > 165
              ? 58
              : 136;
          return p.y + h / 2;
        };

        const allAnchorYs = Object.keys(effectivePositions)
          .filter((k) => k.startsWith("svc:"))
          .map((k) => getAnchorY(k))
          .filter((v): v is number => v !== null);

        const sortedLinks = [...serviceLinks].sort((a, b) => {
          const ya1 = getAnchorY(`svc:${a.fromServiceId}`);
          const ya2 = getAnchorY(`svc:${a.toServiceId}`);
          const yb1 = getAnchorY(`svc:${b.fromServiceId}`);
          const yb2 = getAnchorY(`svc:${b.toServiceId}`);
          const spanA =
            ya1 !== null && ya2 !== null ? Math.abs(ya2 - ya1) : 0;
          const spanB =
            yb1 !== null && yb2 !== null ? Math.abs(yb2 - yb1) : 0;
          return spanA - spanB;
        });

        const arcElements = sortedLinks.map((link, lIdx) => {
          const fromKey = `svc:${link.fromServiceId}`;
          const toKey = `svc:${link.toServiceId}`;
          const p1 = effectivePositions[fromKey];
          const p2 = effectivePositions[toKey];
          if (!p1 || !p2) return null;

          const w1 =
            customDims[fromKey]?.w || sizes[fromKey]?.w || defaultNodeW;
          const w2 =
            customDims[toKey]?.w || sizes[toKey]?.w || defaultNodeW;
          const h1 =
            sizes[fromKey]?.h && sizes[fromKey].h <= 165
              ? sizes[fromKey].h
              : sizes[fromKey]?.h && sizes[fromKey].h > 165
              ? 58
              : 136;
          const h2 =
            sizes[toKey]?.h && sizes[toKey].h <= 165
              ? sizes[toKey].h
              : sizes[toKey]?.h && sizes[toKey].h > 165
              ? 58
              : 136;
          const x1 = p1.x + w1;
          const y1 = p1.y + h1 / 2;
          const x2 = p2.x + w2;
          const y2 = p2.y + h2 / 2;

          const minY = Math.min(y1, y2);
          const maxY = Math.max(y1, y2);
          let lane = 0;
          while (
            placedSpans.some(
              (s) =>
                s.lane === lane &&
                Math.max(s.minY + 6, minY + 6) <
                  Math.min(s.maxY - 6, maxY - 6)
            )
          ) {
            lane += 1;
          }
          placedSpans.push({ minY, maxY, lane });

          const baseRightX = Math.max(x1, x2);
          const arcOffset = 88 + lane * 64;
          const ctrlX = baseRightX + arcOffset;
          const d = `M ${x1} ${y1} C ${ctrlX} ${y1}, ${ctrlX} ${y2}, ${x2} ${y2}`;

          const evalBezier = (tParam: number) => {
            const u = 1 - tParam;
            const bx =
              u * u * u * x1 +
              3 * u * u * tParam * ctrlX +
              3 * u * tParam * tParam * ctrlX +
              tParam * tParam * tParam * x2;
            const by =
              u * u * u * y1 +
              3 * u * u * tParam * y1 +
              3 * u * tParam * tParam * y2 +
              tParam * tParam * tParam * y2;
            return { bx: Math.round(bx), by: Math.round(by) };
          };

          const intermediateAnchors = allAnchorYs.filter(
            (ay) => ay > minY + 12 && ay < maxY - 12
          );
          const candidateTs = [0.5, 0.34, 0.66, 0.26, 0.74];
          let pt = evalBezier(0.5);
          const hasCollision = (candY: number) =>
            usedYs.some((uy) => Math.abs(uy - candY) < 32) ||
            intermediateAnchors.some((ay) => Math.abs(ay - candY) < 22);

          if (hasCollision(pt.by)) {
            let bestPt = pt;
            let bestScore = -Infinity;
            for (const ct of candidateTs) {
              const cand = evalBezier(ct);
              const minUsedDist =
                usedYs.length > 0
                  ? Math.min(...usedYs.map((uy) => Math.abs(uy - cand.by)))
                  : 999;
              const minAnchorDist =
                intermediateAnchors.length > 0
                  ? Math.min(
                      ...intermediateAnchors.map((ay) =>
                        Math.abs(ay - cand.by)
                      )
                    )
                  : 999;
              const score = Math.min(minUsedDist, minAnchorDist * 1.2);
              if (score > bestScore) {
                bestScore = score;
                bestPt = cand;
              }
            }
            pt = bestPt;
          }
          usedYs.push(pt.by);

          const labelText = `${link.protocol} · ${link.latency_ms ?? 1}ms`;
          const badgeW = Math.max(
            68,
            Math.round(labelText.length * 5.6 + 16)
          );
          const safeMidX = Math.max(
            pt.bx,
            baseRightX + Math.ceil(badgeW / 2) + 14 + lane * 48
          );

          const isHovered =
            hoveredNodeId === fromKey || hoveredNodeId === toKey;

          labelItems.push({
            id: link.id,
            midX: safeMidX,
            midY: pt.by,
            badgeW,
            protocol: labelText,
            isHovered,
          });

          const port1Key = `${Math.round(x1)},${Math.round(y1)}`;
          const port2Key = `${Math.round(x2)},${Math.round(y2)}`;
          const drawP1 = !renderedMeshPorts.has(port1Key);
          const drawP2 = !renderedMeshPorts.has(port2Key);
          renderedMeshPorts.add(port1Key);
          renderedMeshPorts.add(port2Key);

          return (
            <g
              key={`arc-${link.id}`}
              style={{
                opacity: isHovered ? 1 : 0.84,
                transition: "opacity 180ms ease",
              }}
            >
              <path
                d={d}
                fill="none"
                stroke="#38bdf8"
                strokeOpacity={isHovered ? 0.35 : 0.14}
                strokeWidth={isHovered ? 6 : 3.5}
                strokeLinecap="round"
              />
              <path
                d={d}
                fill="none"
                stroke="#38bdf8"
                strokeOpacity={isHovered ? 0.95 : 0.65}
                strokeWidth={1.6}
                strokeDasharray="4 6"
                className="cc-animated-edge"
              />
              <g
                className="synapse-packet-fwd"
                style={{
                  offsetPath: `path("${d}")`,
                  animationDuration: `${(2.8 + lIdx * 0.4).toFixed(2)}s`,
                }}
              >
                <circle r={4.5} fill="#38bdf8" fillOpacity={0.45} />
                <circle r={2} fill="#e0f2fe" />
              </g>
              {drawP1 && (
                <g>
                  <circle
                    cx={x1}
                    cy={y1}
                    r={3.4}
                    fill="#181a1d"
                    stroke="#38bdf8"
                    strokeWidth={1.8}
                  />
                  <circle cx={x1} cy={y1} r={1.4} fill="#38bdf8" />
                </g>
              )}
              {drawP2 && (
                <g>
                  <circle
                    cx={x2}
                    cy={y2}
                    r={3.4}
                    fill="#181a1d"
                    stroke="#38bdf8"
                    strokeWidth={1.8}
                  />
                  <circle cx={x2} cy={y2} r={1.4} fill="#38bdf8" />
                </g>
              )}
            </g>
          );
        });

        return (
          <>
            {arcElements}
            {labelItems.map((lbl) => (
              <g
                key={`lbl-${lbl.id}`}
                transform={`translate(${lbl.midX}, ${lbl.midY})`}
                style={{
                  opacity: lbl.isHovered ? 1 : 0.96,
                  transition: "opacity 180ms ease",
                }}
              >
                <rect
                  x={-Math.round(lbl.badgeW / 2)}
                  y={-9}
                  width={lbl.badgeW}
                  height={18}
                  rx={6}
                  fill="#16181b"
                  stroke="#38bdf8"
                  strokeOpacity={0.65}
                  strokeWidth={1.1}
                />
                <text
                  x={0}
                  y={3}
                  textAnchor="middle"
                  fill="#bae6fd"
                  fontSize={8.5}
                  fontFamily="monospace"
                >
                  {lbl.protocol}
                </text>
              </g>
            ))}
          </>
        );
      })()}
    </svg>
  );
});
