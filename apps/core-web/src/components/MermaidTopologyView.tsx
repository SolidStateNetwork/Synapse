"use client";

import React, { useMemo } from "react";
import { Network, Server } from "lucide-react";

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
  const { mermaidBlock, edges, remoteLayoutLines } = useMemo(() => {
    const match = markdown.match(/```mermaid\s*([\s\S]*?)```/);
    const block = match ? match[1].trim() : "";

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
      // Match patterns like: A["Label"] ===|"Edge"| B["Label"] or A --> B
      const edgeMatch = line.match(
        /^([A-Za-z0-9_-]+)(?:\["?([^"\]]+)"?\])?\s*(?:===|-->|-\.->|<-->)\s*(?:\|"([^"]+)"\|)?\s*([A-Za-z0-9_-]+)(?:\["?([^"\]]+)"?\])?/
      );
      if (edgeMatch) {
        parsedEdges.push({
          fromId: edgeMatch[1],
          fromLabel: (edgeMatch[2] || edgeMatch[1]).replace(/\\n/g, " — "),
          edgeLabel: edgeMatch[3] || "mTLS / RPC",
          toId: edgeMatch[4],
          toLabel: (edgeMatch[5] || edgeMatch[4]).replace(/\\n/g, " — "),
        });
      }
    }

    const layoutLines = markdown
      .split("\n")
      .filter((l) => l.trim().startsWith("- `"));

    return {
      mermaidBlock: block,
      edges: parsedEdges,
      remoteLayoutLines: layoutLines,
    };
  }, [markdown]);

  return (
    <div className="rounded-xl border border-slate-800 bg-[#07090e] p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <span className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
          <Network className="h-4 w-4" />
          Live Topology Graph (Parsed from Architecture.md)
        </span>
        <span className="text-[11px] font-mono text-slate-400">
          {edges.length} Link(s)
        </span>
      </div>

      {edges.length > 0 ? (
        <div className="space-y-2.5">
          {edges.map((edge, idx) => (
            <div
              key={idx}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800/90 bg-slate-900/50 p-3 text-xs"
            >
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-emerald-300">
                <Server className="h-3.5 w-3.5 shrink-0" />
                <span>{edge.fromLabel}</span>
              </div>

              <div className="flex flex-col items-center px-2 text-[10px] font-mono text-cyan-300">
                <span>{edge.edgeLabel}</span>
                <span className="text-slate-500">════════════▶</span>
              </div>

              <div className="flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 font-mono text-cyan-200">
                <Server className="h-3.5 w-3.5 shrink-0" />
                <span>{edge.toLabel}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <pre className="overflow-x-auto rounded bg-slate-900/60 p-3 font-mono text-xs text-slate-300">
          {mermaidBlock || "No ```mermaid block found in Architecture.md"}
        </pre>
      )}

      {remoteLayoutLines.length > 0 && (
        <div className="border-t border-slate-800/80 pt-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            Documented Remote File Layout
          </div>
          <div className="space-y-1 font-mono text-xs text-slate-300">
            {remoteLayoutLines.map((line, i) => (
              <div key={i} className="rounded bg-slate-900/40 px-2.5 py-1">
                {line.replace(/^- /, "")}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
