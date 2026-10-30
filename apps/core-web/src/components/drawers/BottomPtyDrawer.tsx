"use client";

import React from "react";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronUp, Terminal as TerminalIcon } from "lucide-react";
import { NodeHeartbeat, ProjectState } from "@/types/synapse";

const XTermTerminal = dynamic(() => import("@/components/XTermTerminal"), {
  ssr: false,
});

export interface BottomPtyDrawerProps {
  terminalDrawerOpen: boolean;
  setTerminalDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  terminalHeight: number;
  setTerminalHeight: React.Dispatch<React.SetStateAction<number>>;
  primaryNode: string;
  activeHeartbeat?: NodeHeartbeat;
  gatewayUrl: string;
  activeProject: ProjectState | null;
}

export default function BottomPtyDrawer({
  terminalDrawerOpen,
  setTerminalDrawerOpen,
  terminalHeight,
  setTerminalHeight,
  primaryNode,
  activeHeartbeat,
  gatewayUrl,
  activeProject,
}: BottomPtyDrawerProps) {
  return (
    <div className="relative shrink-0 border-t border-nb-gray-900 bg-nb-gray-950">
      {terminalDrawerOpen && (
        <div
          title="Mit der Maus ziehen, um die Höhe des Terminals anzupassen"
          onMouseDown={(e) => {
            e.preventDefault();
            const startY = e.clientY;
            const startH = terminalHeight;
            const onMove = (ev: MouseEvent) => {
              const nextH = startH - (ev.clientY - startY);
              setTerminalHeight(Math.max(150, Math.min(540, nextH)));
            };
            const onUp = () => {
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
          className="absolute top-0 left-0 right-0 h-1.5 -mt-0.5 cursor-row-resize hover:bg-netbird/60 transition-colors z-30"
        />
      )}
      <div className="flex h-9 items-center justify-between px-4 text-xs">
        <button
          onClick={() => setTerminalDrawerOpen((v) => !v)}
          className="flex items-center gap-2 font-mono text-[11px] text-nb-gray-300 hover:text-white"
        >
          <TerminalIcon className="h-3.5 w-3.5 text-netbird" />
          <span>Live Peer PTY Shell ({primaryNode || "offline"})</span>
        </button>

        <div className="flex items-center gap-4 font-mono text-[11px] text-nb-gray-400">
          {activeHeartbeat && (
            <span>
              CPU {activeHeartbeat.cpu_percent.toFixed(1)}% · RAM{" "}
              {activeHeartbeat.ram_percent.toFixed(1)}%
            </span>
          )}
          <button
            onClick={() => setTerminalDrawerOpen((v) => !v)}
            className="flex items-center gap-1 text-nb-gray-300 hover:text-white"
          >
            <span>{terminalDrawerOpen ? "Einklappen" : "Ausklappen"}</span>
            {terminalDrawerOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {terminalDrawerOpen && (
        <div
          style={{ height: `${terminalHeight}px` }}
          className="border-t border-nb-gray-900 bg-nb-gray-960"
        >
          {primaryNode ? (
            <XTermTerminal
              gatewayUrl={gatewayUrl}
              projectId={activeProject?.project_id || "default-project"}
              nodeId={primaryNode}
              sessionId={`default-${
                activeProject?.project_id || "default-project"
              }`}
            />
          ) : (
            <div className="p-4 font-mono text-xs text-nb-gray-400">
              Kein Muscle-Server verbunden. Klicke auf „+ Server“, um einen
              Linux-Knoten anzubinden.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
