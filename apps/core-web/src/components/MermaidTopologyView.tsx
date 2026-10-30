"use client";

import React, { useMemo } from "react";
import { ArrowRight, Cpu, Globe, Layers, Server } from "lucide-react";

interface MermaidTopologyViewProps {
  markdown: string;
}

interface ParsedEdge {
  fromId: string;
  fromLabel: string;
  toId: string;
  toLabel: string;
  edgeLabel: string;
}

export default function MermaidTopologyView({
  markdown,
}: MermaidTopologyViewProps) {
  const { edges } = useMemo(() => {
    const match = markdown.match(/```mermaid\s*([\s\S]*?)```/);
    const block = match ? match[1].trim() : markdown.trim();

    const parsedEdges: ParsedEdge[] = [];
    for (const rawLine of block.split("\n")) {
      const line = rawLine.trim();
      if (
        !line ||
        line.startsWith("flowchart") ||
        line.startsWith("graph") ||
        line.startsWith("subgraph") ||
        line === "end"
      ) {
        continue;
      }
      const edgeMatch = line.match(
        /^([A-Za-z0-9_-]+)(?:\["?([^"\]]+)"?\])?\s*(?:===|-->|-\.->|<-->)\s*(?:\|"([^"]+)"\|)?\s*([A-Za-z0-9_-]+)(?:\["?([^"\]]+)"?\])?/
      );
      if (edgeMatch) {
        parsedEdges.push({
          fromId: edgeMatch[1],
          fromLabel: (edgeMatch[2] || edgeMatch[1]).replace(/\\n/g, " · "),
          edgeLabel: edgeMatch[3] || "mTLS 1.3 + Yamux Stream",
          toId: edgeMatch[4],
          toLabel: (edgeMatch[5] || edgeMatch[4]).replace(/\\n/g, " · "),
        });
      }
    }

    return { edges: parsedEdges };
  }, [markdown]);

  if (edges.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-930/90 p-5 shadow-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-xs font-semibold text-white">
              Live System Topology Graph
            </h3>
            <p className="text-[11px] text-nb-gray-400">
              Architecture flow parsed from{" "}
              <code className="font-mono text-netbird">Architecture.md</code>
            </p>
          </div>
        </div>
        <span className="rounded-md border border-emerald-500/40 bg-emerald-950 px-2.5 py-0.5 font-mono text-[10px] text-emerald-400">
          {edges.length} Active Topology Link(s)
        </span>
      </div>

      <div className="space-y-3">
        {edges.map((edge, idx) => {
          const isCore =
            edge.fromId.toLowerCase().includes("core") ||
            edge.fromLabel.toLowerCase().includes("brain");
          const isApp =
            edge.toId.toLowerCase().includes("app") ||
            edge.toLabel.includes("127.0.0.1");

          return (
            <div
              key={idx}
              className="grid grid-cols-1 md:grid-cols-11 items-center gap-3 rounded-lg border border-nb-gray-800 bg-nb-gray-940 p-3.5"
            >
              {/* Source Node Card */}
              <div className="md:col-span-4 flex items-center gap-3 rounded-lg border border-nb-gray-800 bg-nb-gray-930 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
                  {isCore ? (
                    <Cpu className="h-4 w-4" />
                  ) : (
                    <Server className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-netbird">
                    {edge.fromId}
                  </div>
                  <div className="break-words leading-snug text-xs font-medium text-white">
                    {edge.fromLabel}
                  </div>
                </div>
              </div>

              {/* Connection Bridge */}
              <div className="md:col-span-3 flex flex-col items-center justify-center px-2 py-1">
                <span className="mb-1.5 rounded-full border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-0.5 font-mono text-[10px] text-nb-gray-200">
                  {edge.edgeLabel}
                </span>
                <div className="flex w-full items-center gap-1.5">
                  <div className="h-[1.5px] flex-1 border-t border-dashed border-netbird/70" />
                  <ArrowRight className="h-3.5 w-3.5 text-netbird shrink-0" />
                </div>
              </div>

              {/* Target Node Card */}
              <div className="md:col-span-4 flex items-center gap-3 rounded-lg border border-nb-gray-800 bg-nb-gray-930 p-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                    isApp
                      ? "border-sky-500/40 bg-sky-950/60 text-sky-400"
                      : "border-emerald-500/40 bg-emerald-950 text-emerald-400"
                  }`}
                >
                  {isApp ? (
                    <Globe className="h-4 w-4" />
                  ) : (
                    <Server className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div
                    className={`font-mono text-[10px] uppercase tracking-wider ${
                      isApp ? "text-sky-400" : "text-emerald-400"
                    }`}
                  >
                    {edge.toId}
                  </div>
                  <div className="break-words leading-snug text-xs font-medium text-white">
                    {edge.toLabel}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
