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
        fontSize: 12,
        lineHeight: 1.25,
        fontFamily:
          '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        theme: {
          background: "#121417",
          foreground: "#e2e4e8",
          cursor: "#f68330",
          selectionBackground: "#2c3037",
        },
        rows: 11,
        cols: 110,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);
      fitAddon.fit();
      termInstance = term;

      term.writeln(
        `\x1b[1;32m●\x1b[0m \x1b[90mpty://${nodeId}/${sessionId} — creack/pty + Sentinel Framing (__SYNAPSE_EOF__)\x1b[0m`
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
    <div className="flex h-full flex-col bg-nb-gray-960 overflow-hidden">
      <div className="flex items-center justify-between border-b border-nb-gray-800 px-3 py-1 text-[11px] text-nb-gray-400">
        <div className="flex items-center gap-2 font-mono">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connected ? "bg-emerald-400" : "bg-amber-400"
            }`}
          />
          <span className="text-nb-gray-200">
            {nodeId} : {sessionId}
          </span>
        </div>
        <span className="font-mono text-[10px] text-nb-gray-400">
          STREAM_TYPE_PTY • /proc/pid/cwd
        </span>
      </div>
      <div ref={containerRef} className="flex-1 px-2 py-1 overflow-hidden" />
    </div>
  );
}
