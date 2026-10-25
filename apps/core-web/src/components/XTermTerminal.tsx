"use client";

import React, { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";

interface XTermTerminalProps {
  gatewayUrl: string;
  projectId: string;
  nodeId: string;
  sessionId: string;
}

export default function XTermTerminal({
  gatewayUrl,
  projectId,
  nodeId,
  sessionId,
}: XTermTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !nodeId) return;

    let disposed = false;
    let eventSource: EventSource | null = null;
    let termInstance: import("@xterm/xterm").Terminal | null = null;

    async function initTerminal() {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        theme: {
          background: "#07090e",
          foreground: "#e2e8f0",
          cursor: "#10b981",
          selectionBackground: "#1e293b",
        },
        rows: 22,
        cols: 100,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();
      termInstance = term;

      term.writeln(
        `\x1b[1;32m● Synapse Live PTY Stream\x1b[0m — Node: \x1b[36m${nodeId}\x1b[0m | Session: \x1b[33m${sessionId}\x1b[0m`
      );
      term.writeln(
        `\x1b[90m Persistent bash session via hashicorp/yamux STREAM_TYPE_PTY (Sentinel Framed)\x1b[0m\r\n`
      );

      const streamUrl = `${gatewayUrl}/api/v1/pty/stream?node_id=${encodeURIComponent(
        nodeId
      )}&project_id=${encodeURIComponent(
        projectId
      )}&session_id=${encodeURIComponent(sessionId)}`;

      eventSource = new EventSource(streamUrl);
      eventSource.onopen = () => {
        if (!disposed) setConnected(true);
      };
      eventSource.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data);
          if (parsed.data) {
            term.write(parsed.data);
          }
        } catch {
          term.write(ev.data);
        }
      };
      eventSource.onerror = () => {
        if (!disposed) setConnected(false);
      };

      term.onData((data) => {
        fetch(streamUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            type: "input",
            data: Array.from(new TextEncoder().encode(data)),
          }),
        }).catch(() => {});
      });
    }

    initTerminal();

    return () => {
      disposed = true;
      if (eventSource) eventSource.close();
      if (termInstance) termInstance.dispose();
    };
  }, [gatewayUrl, projectId, nodeId, sessionId]);

  return (
    <div className="flex flex-col rounded-xl border border-slate-800 bg-[#07090e] overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
            }`}
          />
          <span className="font-mono text-slate-300">
            pty://{nodeId}/{sessionId}
          </span>
        </div>
        <span className="text-slate-400">
          creack/pty + Sentinel Framing (__SYNAPSE_EOF__)
        </span>
      </div>
      <div ref={containerRef} className="p-3 min-h-[340px]" />
    </div>
  );
}
