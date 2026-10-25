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
          edgeLabel: edgeMatch[3] || "mTLS + Yamux Stream",
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
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.03] to-transparent p-6 shadow-lg">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Live System Topology Graph
            </h3>
            <p className="text-xs text-zinc-400">
              Interactive architecture visualization rendered from{" "}
              <code className="text-emerald-300">Architecture.md</code>
            </p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] text-emerald-300">
          {edges.length} Active Topology Link(s)
        </span>
      </div>

      <div className="space-y-4">
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
              className="grid grid-cols-1 md:grid-cols-11 items-center gap-3 rounded-xl border border-white/[0.07] bg-[#08080d]/90 p-4"
            >
              {/* Source Node Card */}
              <div className="md:col-span-4 flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                  {isCore ? (
                    <Cpu className="h-4 w-4" />
                  ) : (
                    <Server className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                    {edge.fromId}
                  </div>
                  <div className="truncate text-xs font-medium text-white">
                    {edge.fromLabel}
                  </div>
                </div>
              </div>

              {/* Animated Connection Bridge */}
              <div className="md:col-span-3 flex flex-col items-center justify-center px-2 py-1">
                <span className="mb-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 font-mono text-[10px] text-cyan-300">
                  {edge.edgeLabel}
                </span>
                <div className="flex w-full items-center gap-1 text-zinc-600">
                  <div className="h-[1px] flex-1 bg-gradient-to-r from-emerald-500/40 via-cyan-500/50 to-cyan-400/40" />
                  <ArrowRight className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                </div>
              </div>

              {/* Target Node Card */}
              <div className="md:col-span-4 flex items-center gap-3 rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300">
                  {isApp ? (
                    <Globe className="h-4 w-4" />
                  ) : (
                    <Server className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-cyan-300">
                    {edge.toId}
                  </div>
                  <div className="truncate text-xs font-medium text-white">
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
