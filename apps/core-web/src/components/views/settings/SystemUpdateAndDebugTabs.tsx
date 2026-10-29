"use client";

import React from "react";
import {
  Activity,
  Brain,
  ChevronDown,
  ChevronUp,
  Cpu,
  RefreshCw,
  Server,
  Zap,
} from "lucide-react";
import type {
  SelfTestCheckItem,
  SystemUpdateStatusSnapshot,
  SystemUpdateStepEntry,
} from "../SettingsView";

export interface SystemUpdateTabProps {
  systemUpdateBusy: boolean;
  systemUpdateActionLabel: string;
  systemUpdateStatus: SystemUpdateStatusSnapshot | null;
  systemUpdateSteps: SystemUpdateStepEntry[];
  setSystemUpdateSteps: React.Dispatch<
    React.SetStateAction<SystemUpdateStepEntry[]>
  >;
  showReleaseNotes: boolean;
  setShowReleaseNotes: React.Dispatch<React.SetStateAction<boolean>>;
  handleRunSystemUpdate: (
    action: "check" | "update_all" | "update_core" | "update_muscle",
    targetNodeId?: string
  ) => void;
}

export function SystemUpdateTab({
  systemUpdateBusy,
  systemUpdateActionLabel,
  systemUpdateStatus,
  systemUpdateSteps,
  setSystemUpdateSteps,
  showReleaseNotes,
  setShowReleaseNotes,
  handleRunSystemUpdate,
}: SystemUpdateTabProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-950/60 text-emerald-400">
                <RefreshCw
                  className={`h-4 w-4 ${
                    systemUpdateBusy ? "animate-spin" : ""
                  }`}
                />
              </span>
              <div>
                <h2 className="text-base font-semibold text-white">
                  System-Update &amp; Over-the-Air (OTA) Rollout
                </h2>
                <p className="text-xs text-nb-gray-400">
                  1-Klick Synchronisation für{" "}
                  <strong className="text-nb-gray-200">Core Plane</strong> (Git,
                  WebUI &amp; Gateway) und alle{" "}
                  <strong className="text-nb-gray-200">Muscle-Server</strong> (
                  <code className="text-emerald-300">/usr/local/bin/axon</code>{" "}
                  &amp; Systemd-Daemon).
                </p>
              </div>
            </div>
          </div>

          {systemUpdateStatus &&
            (() => {
              const outdatedCount = systemUpdateStatus.nodes.filter(
                (n) => !n.up_to_date
              ).length;
              const anyUpdate =
                systemUpdateStatus.git.update_available || outdatedCount > 0;
              return (
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 font-mono text-[11px] font-semibold ${
                      anyUpdate
                        ? "border-amber-500/50 bg-amber-950/60 text-amber-300"
                        : "border-emerald-500/50 bg-emerald-950/60 text-emerald-300"
                    }`}
                  >
                    {systemUpdateStatus.git.update_available
                      ? `Update verfügbar (+${systemUpdateStatus.git.commits_behind} Commits)`
                      : outdatedCount > 0
                      ? `${outdatedCount} Muscle-Node OTA verfügbar`
                      : `Aktuell (${systemUpdateStatus.git.local_short})`}
                  </span>
                </div>
              );
            })()}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            disabled={systemUpdateBusy}
            onClick={() => handleRunSystemUpdate("update_all")}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 transition"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Komplett-Update (Core + alle Muscles)</span>
          </button>

          <button
            type="button"
            disabled={systemUpdateBusy}
            onClick={() => handleRunSystemUpdate("update_core")}
            className="flex items-center gap-2 rounded-lg border border-netbird-500/50 bg-netbird-950/70 px-3.5 py-2.5 text-xs font-medium text-netbird hover:bg-netbird-900/60 disabled:opacity-50 transition"
          >
            <Brain className="h-3.5 w-3.5" />
            <span>Nur Core updaten</span>
          </button>

          <button
            type="button"
            disabled={systemUpdateBusy}
            onClick={() => handleRunSystemUpdate("update_muscle")}
            className="flex items-center gap-2 rounded-lg border border-sky-500/50 bg-sky-950/60 px-3.5 py-2.5 text-xs font-medium text-sky-300 hover:bg-sky-900/50 disabled:opacity-50 transition"
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>Alle Muscles (OTA) updaten</span>
          </button>

          <button
            type="button"
            disabled={systemUpdateBusy}
            onClick={() => handleRunSystemUpdate("check")}
            className="flex items-center gap-2 rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2.5 text-xs font-medium text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white disabled:opacity-50 transition"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                systemUpdateBusy ? "animate-spin" : ""
              }`}
            />
            <span>Auf Updates prüfen</span>
          </button>
        </div>

        {systemUpdateBusy && (
          <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-xs text-emerald-200">
            <RefreshCw className="h-4 w-4 animate-spin text-emerald-400 shrink-0" />
            <span>
              <strong>{systemUpdateActionLabel}</strong> — Bitte einen Moment
              warten, während Git-Commits, Binaries und Systemd-Daemons
              synchronisiert werden...
            </span>
          </div>
        )}

        {systemUpdateStatus && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 pt-2">
            <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-950/90 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-nb-gray-900 pb-2.5">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-netbird" />
                  <span className="text-xs font-semibold text-white">
                    Core Plane (WebUI, Orchestrator &amp; Gateway)
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowReleaseNotes((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-930 px-2 py-0.5 font-mono text-[10px] text-nb-gray-300 hover:border-nb-gray-700 hover:text-white transition"
                  >
                    <span>
                      {showReleaseNotes
                        ? "Release einklappen"
                        : "Release ausklappen"}
                    </span>
                    {showReleaseNotes ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>
                  <span className="rounded border border-netbird-500/40 bg-netbird-950/60 px-2 py-0.5 font-mono text-[10px] text-netbird">
                    Branch: {systemUpdateStatus.git.branch}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-nb-gray-400">
                    Installierter Commit:
                  </span>
                  <span className="font-mono font-semibold text-emerald-300">
                    {systemUpdateStatus.git.local_short}{" "}
                    <span className="text-[10px] font-normal text-nb-gray-400">
                      ({systemUpdateStatus.git.local_date.slice(0, 16)})
                    </span>
                  </span>
                </div>
                {showReleaseNotes && (
                  <div className="text-[11px] text-nb-gray-300 font-mono bg-nb-gray-930/80 rounded px-2.5 py-1.5 border border-nb-gray-900 leading-relaxed">
                    {systemUpdateStatus.git.local_subject}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-nb-gray-400">
                    Remote (origin/main):
                  </span>
                  <span className="font-mono text-nb-gray-200">
                    {systemUpdateStatus.git.remote_short}
                    {systemUpdateStatus.git.commits_behind > 0
                      ? ` (${systemUpdateStatus.git.commits_behind} Commits voraus)`
                      : " (Synchron)"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-nb-gray-400">
                    Core Gateway Binary:
                  </span>
                  <span className="font-mono text-[11px] text-nb-gray-200">
                    {systemUpdateStatus.binaries.core_gateway.exists
                      ? `SHA-256 ${systemUpdateStatus.binaries.core_gateway.sha256} (${(
                          systemUpdateStatus.binaries.core_gateway.size_bytes /
                          (1024 * 1024)
                        ).toFixed(1)} MB)`
                      : "Aktiv"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-950/90 p-4 space-y-3">
              {systemUpdateStatus.nodes.length === 0 ? (
                <>
                  <div className="flex items-center justify-between border-b border-nb-gray-900 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-sky-400" />
                      <span className="text-xs font-semibold text-white">
                        Verbundene Muscle-Knoten (0)
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-nb-gray-400">
                      /usr/local/bin/axon
                    </span>
                  </div>
                  <div className="py-4 text-center text-xs text-nb-gray-400">
                    Kein Muscle-Knoten verbunden.
                  </div>
                </>
              ) : (
                systemUpdateStatus.nodes.map((node) => (
                  <div key={node.node_id} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-nb-gray-900 pb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Server className="h-4 w-4 text-sky-400 shrink-0" />
                        <span className="text-xs font-semibold text-white truncate">
                          Muscle Plane ({node.node_id})
                        </span>
                        <span className="rounded border border-nb-gray-800 bg-nb-gray-930 px-1.5 py-0.2 font-mono text-[9px] text-nb-gray-300">
                          {node.systemd_status || "active"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setShowReleaseNotes((prev) => !prev)}
                          className="inline-flex items-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-930 px-2 py-0.5 font-mono text-[10px] text-nb-gray-300 hover:border-nb-gray-700 hover:text-white transition"
                        >
                          <span>
                            {showReleaseNotes
                              ? "Release einklappen"
                              : "Release ausklappen"}
                          </span>
                          {showReleaseNotes ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={systemUpdateBusy || !node.online}
                          onClick={() =>
                            handleRunSystemUpdate("update_muscle", node.node_id)
                          }
                          className="rounded border border-sky-500/40 bg-sky-950/60 px-2 py-0.5 font-mono text-[10px] text-sky-200 hover:bg-sky-900/60 disabled:opacity-40 transition"
                        >
                          OTA Update
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-nb-gray-400">
                          Installierter Commit:
                        </span>
                        <span className="font-mono font-semibold text-emerald-300">
                          {node.source_commit ||
                            systemUpdateStatus.git.local_short}{" "}
                          <span className="text-[10px] font-normal text-nb-gray-400">
                            (
                            {(
                              node.installed_mtime ||
                              systemUpdateStatus.git.local_date
                            ).slice(0, 16)}
                            )
                          </span>
                        </span>
                      </div>
                      {showReleaseNotes && (
                        <div className="text-[11px] text-nb-gray-300 font-mono bg-nb-gray-930/80 rounded px-2.5 py-1.5 border border-nb-gray-900 leading-relaxed">
                          {systemUpdateStatus.git.local_subject}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-nb-gray-400">
                          Remote (origin/main):
                        </span>
                        <span className="font-mono text-nb-gray-200">
                          {systemUpdateStatus.git.remote_short}
                          {node.up_to_date
                            ? " (Synchron)"
                            : " (OTA verfügbar)"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-nb-gray-400">
                          Axon Muscle Binary:
                        </span>
                        <span className="font-mono text-[11px] text-nb-gray-200">
                          SHA-256{" "}
                          {(
                            node.installed_sha256 ||
                            systemUpdateStatus.binaries.axon_linux_amd64
                              .sha256 ||
                            "aktiv"
                          ).slice(0, 16)}
                          {systemUpdateStatus.binaries.axon_linux_amd64.exists
                            ? ` (${(
                                systemUpdateStatus.binaries.axon_linux_amd64
                                  .size_bytes /
                                (1024 * 1024)
                              ).toFixed(1)} MB)`
                            : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {systemUpdateSteps.length > 0 && (
          <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-950 p-4 space-y-2.5">
            <div className="flex items-center justify-between border-b border-nb-gray-900 pb-2">
              <span className="text-xs font-semibold text-white">
                Update-Protokoll (Letzter Lauf)
              </span>
              <button
                type="button"
                onClick={() => setSystemUpdateSteps([])}
                className="text-[11px] text-nb-gray-400 hover:text-white"
              >
                Ausblenden
              </button>
            </div>
            <div className="space-y-2">
              {systemUpdateSteps.map((st, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-3 rounded-md border border-nb-gray-900 bg-nb-gray-930/60 p-2.5 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 font-medium text-white">
                      <span
                        className={`rounded px-1.5 py-0.2 font-mono text-[10px] uppercase ${
                          st.status === "ok"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-500/40"
                            : st.status === "warn"
                            ? "bg-amber-950 text-amber-300 border border-amber-500/40"
                            : "bg-red-950 text-red-400 border border-red-500/40"
                        }`}
                      >
                        {st.status}
                      </span>
                      <span>{st.step}</span>
                    </div>
                    <p className="font-mono text-[11px] text-nb-gray-300 whitespace-pre-wrap">
                      {st.detail}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-nb-gray-400">
                    {st.duration_ms} ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export interface DebugConsoleTabProps {
  debugModeEnabled: boolean;
  handleToggleDebugMode: () => void;
  handleRunSelfTest: () => void;
  runningSelfTest: boolean;
  fetchDebugSnapshot: () => void;
  selfTestChecks: SelfTestCheckItem[];
  debugSnapshot: Record<string, unknown> | null;
}

export function DebugConsoleTab({
  debugModeEnabled,
  handleToggleDebugMode,
  handleRunSelfTest,
  runningSelfTest,
  fetchDebugSnapshot,
  selfTestChecks,
  debugSnapshot,
}: DebugConsoleTabProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-950/60 text-amber-400">
              <Activity className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">
                Core &amp; Muscle Debug-Modus + End-to-End-Selbsttest
              </h2>
              <p className="text-xs text-nb-gray-400">
                Prüfe Live-mTLS-1.3- &amp; Yamux-Streams, verifiziere die
                AES-256-GCM-Tresor-Integrität und führe Diagnose-Checks auf Core
                und Muscle aus.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleDebugMode}
              className={`rounded-lg border px-3.5 py-2 font-mono text-xs font-medium transition ${
                debugModeEnabled
                  ? "border-amber-500 bg-amber-950 text-amber-300"
                  : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-300 hover:text-white"
              }`}
            >
              {debugModeEnabled
                ? "● Debug-Modus: AKTIV"
                : "○ Debug-Modus aktivieren"}
            </button>
            <button
              onClick={handleRunSelfTest}
              disabled={runningSelfTest}
              className="rounded-lg bg-netbird px-4 py-2 text-xs font-semibold text-white hover:bg-netbird-500 disabled:opacity-50 transition shadow-sm"
            >
              {runningSelfTest
                ? "Selbsttest läuft..."
                : "▶ 5-Stufen-Selbsttest starten"}
            </button>
            <button
              onClick={fetchDebugSnapshot}
              className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-nb-gray-300 hover:text-white transition"
            >
              Aktualisieren
            </button>
          </div>
        </div>

        {selfTestChecks.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-nb-gray-300">
              End-to-End Diagnose-Prüfungen
            </div>
            <div className="grid grid-cols-1 gap-2">
              {selfTestChecks.map((chk) => (
                <div
                  key={chk.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-3 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                          chk.status === "PASS"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-500/40"
                            : chk.status === "WARN"
                            ? "bg-amber-950 text-amber-300 border border-amber-500/40"
                            : "bg-red-950 text-red-400 border border-red-500/40"
                        }`}
                      >
                        {chk.status}
                      </span>
                      <span className="font-semibold text-white">
                        {chk.name}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-nb-gray-300 break-all">
                      {chk.detail}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-nb-gray-400">
                    {chk.latency_ms} ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-4 space-y-2">
          <div className="text-xs font-semibold text-sky-400">
            CLI-Debug-Befehle für Core &amp; Muscle (axon debug / --debug)
          </div>
          <pre className="overflow-x-auto rounded-lg bg-nb-gray-960 p-3 font-mono text-[11px] text-nb-gray-200 leading-relaxed">
            {`# 1. Run 5-step Muscle diagnostic doctor (checks X.509 cert, Core HTTP latency, mTLS 1.3 handshake & FS permissions)
sudo axon debug

# 2. Persist Debug Mode on the Muscle agent and inspect live systemd journal logs
sudo axon debug --enable && sudo systemctl restart axon
sudo journalctl -u axon -f

# 3. Start Core Gateway with verbose mTLS / Yamux / RPC debug trace logging
SYNAPSE_DEBUG=1 ./bin/core-gateway --debug`}
          </pre>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-semibold text-nb-gray-300">
            Live Core-Web- &amp; Gateway-Diagnose-Snapshot (/api/debug)
          </div>
          {debugSnapshot ? (
            <pre className="max-h-80 overflow-auto rounded-lg border border-nb-gray-800 bg-nb-gray-960 p-3.5 font-mono text-[11px] text-emerald-400">
              {JSON.stringify(debugSnapshot, null, 2)}
            </pre>
          ) : (
            <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-950/70 px-4 py-3 text-xs text-nb-gray-400">
              Lade Live-Diagnose-Snapshot...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
