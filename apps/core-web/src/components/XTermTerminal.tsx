"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
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
  const termRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const fitAddonRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);
  const [connected, setConnected] = useState(false);
  const [dimensions, setDimensions] = useState<{ cols: number; rows: number }>({
    cols: 110,
    rows: 11,
  });
  const [reconnectNonce, setReconnectNonce] = useState(0);

  const streamUrl = `${gatewayUrl}/api/v1/pty/stream?node_id=${encodeURIComponent(
    nodeId
  )}&projectId=${encodeURIComponent(
    projectId
  )}&project_id=${encodeURIComponent(
    projectId
  )}&session_id=${encodeURIComponent(sessionId)}`;

  const handleClearTerminal = useCallback(() => {
    termRef.current?.clear();
  }, []);

  const handleForceReconnect = useCallback(() => {
    setReconnectNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !nodeId) return;

    let disposed = false;
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let rafId: number | null = null;
    let inputFlushTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingInputBuffer = "";
    let lastSentCols = 0;
    let lastSentRows = 0;

    const sendResizeFrame = (cols: number, rows: number) => {
      if (cols <= 0 || rows <= 0) return;
      if (cols === lastSentCols && rows === lastSentRows) return;
      lastSentCols = cols;
      lastSentRows = rows;
      setDimensions({ cols, rows });
      fetch(streamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          type: "resize",
          cols,
          rows,
        }),
      }).catch(() => {});
    };

    const flushPendingInput = () => {
      if (!pendingInputBuffer) return;
      const chunk = pendingInputBuffer;
      pendingInputBuffer = "";
      fetch(streamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          type: "input",
          data: Array.from(new TextEncoder().encode(chunk)),
        }),
      }).catch(() => {});
    };

    const connectEventSource = (term: import("@xterm/xterm").Terminal) => {
      if (disposed) return;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }

      const es = new EventSource(streamUrl);
      eventSource = es;

      es.onopen = () => {
        if (disposed) return;
        setConnected(true);
        if (term.cols && term.rows) {
          lastSentCols = 0;
          lastSentRows = 0;
          sendResizeFrame(term.cols, term.rows);
        }
      };

      es.onmessage = (ev) => {
        if (disposed) return;
        try {
          const parsed = JSON.parse(ev.data);
          if (parsed.data) {
            term.write(parsed.data);
          }
        } catch {
          term.write(ev.data);
        }
      };

      es.onerror = () => {
        if (disposed) return;
        setConnected(false);
        es.close();
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          if (!disposed) {
            connectEventSource(term);
          }
        }, 2500);
      };
    };

    async function initTerminal() {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed || !containerRef.current) return;

      let term = termRef.current;
      let fitAddon = fitAddonRef.current;

      if (!term || !fitAddon) {
        term = new Terminal({
          cursorBlink: true,
          fontSize: 12,
          lineHeight: 1.25,
          scrollback: 5000,
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
        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(containerRef.current);
        termRef.current = term;
        fitAddonRef.current = fitAddon;

        term.writeln(
          `\x1b[1;32m●\x1b[0m \x1b[90mpty://${nodeId}/${sessionId} — creack/pty + Sentinel Framing (__SYNAPSE_EOF__)\x1b[0m`
        );
      }

      try {
        fitAddon.fit();
        sendResizeFrame(term.cols, term.rows);
      } catch {
        // ignore initial fit if container is hidden
      }

      const activeTerm = term;
      const activeFit = fitAddon;

      resizeObserver = new ResizeObserver(() => {
        if (disposed) return;
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          try {
            activeFit.fit();
            sendResizeFrame(activeTerm.cols, activeTerm.rows);
          } catch {
            // ignore resize during layout transition
          }
        });
      });
      resizeObserver.observe(containerRef.current);

      const dataDisposable = activeTerm.onData((data) => {
        pendingInputBuffer += data;
        if (inputFlushTimer) clearTimeout(inputFlushTimer);
        if (pendingInputBuffer.length >= 256 || data === "\r" || data === "\x03") {
          flushPendingInput();
        } else {
          inputFlushTimer = setTimeout(flushPendingInput, 16);
        }
      });

      connectEventSource(activeTerm);

      return () => {
        dataDisposable.dispose();
      };
    }

    let cleanupDataListener: (() => void) | undefined;
    initTerminal().then((fn) => {
      cleanupDataListener = fn;
    });

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (inputFlushTimer) {
        clearTimeout(inputFlushTimer);
        flushPendingInput();
      }
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      if (cleanupDataListener) cleanupDataListener();
      if (eventSource) eventSource.close();
    };
  }, [gatewayUrl, projectId, nodeId, sessionId, streamUrl, reconnectNonce]);

  useEffect(() => {
    return () => {
      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
        fitAddonRef.current = null;
      }
    };
  }, [nodeId, sessionId]);

  return (
    <div className="flex h-full flex-col bg-nb-gray-960 overflow-hidden">
      <div className="flex items-center justify-between border-b border-nb-gray-800 px-3 py-1 text-[11px] text-nb-gray-400">
        <div className="flex items-center gap-2 font-mono">
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              connected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"
            }`}
          />
          <span className="text-nb-gray-200">
            {nodeId} : {sessionId}
          </span>
          <span className="rounded border border-nb-gray-800 bg-nb-gray-900/70 px-1.5 py-0.5 text-[10px] text-nb-gray-400">
            {dimensions.cols}×{dimensions.rows}
          </span>
          {!connected && (
            <span className="text-[10px] text-amber-400">
              Verbinde mit PTY-Stream…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-nb-gray-400">
          <button
            type="button"
            onClick={handleForceReconnect}
            title="PTY-Stream neu verbinden"
            className="flex items-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-900/60 px-1.5 py-0.5 text-nb-gray-300 hover:border-nb-gray-700 hover:text-white transition-colors"
          >
            <RefreshCw className="h-2.5 w-2.5" />
            <span>Reconnect</span>
          </button>
          <button
            type="button"
            onClick={handleClearTerminal}
            title="Terminal-Ausgabe leeren"
            className="flex items-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-900/60 px-1.5 py-0.5 text-nb-gray-300 hover:border-nb-gray-700 hover:text-white transition-colors"
          >
            <Trash2 className="h-2.5 w-2.5" />
            <span>Clear</span>
          </button>
          <span className="hidden sm:inline text-nb-gray-500">
            STREAM_TYPE_PTY • /proc/pid/cwd
          </span>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 px-2 py-1 overflow-hidden" />
    </div>
  );
}
