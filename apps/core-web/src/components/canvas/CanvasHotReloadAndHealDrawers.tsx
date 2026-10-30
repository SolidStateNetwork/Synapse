"use client";

import React from "react";
import { Code2, RotateCcw, X, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type {
  RegisteredService,
  SelfHealingEventItem,
} from "@/components/canvas/canvasTypes";

export interface CanvasHotReloadAndHealDrawersProps {
  allServices: RegisteredService[];
  hotReloadModalSvc: RegisteredService | null;
  setHotReloadModalSvc: React.Dispatch<
    React.SetStateAction<RegisteredService | null>
  >;
  hotReloadFilePath: string;
  setHotReloadFilePath: React.Dispatch<React.SetStateAction<string>>;
  hotReloadCode: string;
  setHotReloadCode: React.Dispatch<React.SetStateAction<string>>;
  hotReloadLoading: boolean;
  hotReloadSaving: boolean;
  hotReloadNotice: string | null;
  handleSaveAndHotReloadCode: (e: React.FormEvent) => Promise<void>;
  showSelfHealingDrawer: boolean;
  setShowSelfHealingDrawer: React.Dispatch<React.SetStateAction<boolean>>;
  selfHealingEvents: SelfHealingEventItem[];
  selfHealBusyId: string | null;
  handleQuickRestartService: (
    svc: RegisteredService,
    simulateCrash: boolean
  ) => Promise<void>;
}

export function CanvasHotReloadAndHealDrawers({
  allServices,
  hotReloadModalSvc,
  setHotReloadModalSvc,
  hotReloadFilePath,
  setHotReloadFilePath,
  hotReloadCode,
  setHotReloadCode,
  hotReloadLoading,
  hotReloadSaving,
  hotReloadNotice,
  handleSaveAndHotReloadCode,
  showSelfHealingDrawer,
  setShowSelfHealingDrawer,
  selfHealingEvents,
  selfHealBusyId,
  handleQuickRestartService,
}: CanvasHotReloadAndHealDrawersProps) {
  const { t, translateText } = useI18n();

  return (
    <>
      {hotReloadModalSvc && (
        <div
          data-canvas-modal="true"
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-nb-gray-950/85 backdrop-blur-sm p-4"
        >
          <form
            onSubmit={handleSaveAndHotReloadCode}
            className="w-full max-w-2xl rounded-2xl border border-nb-gray-800 bg-nb-gray-940 p-5 shadow-2xl space-y-3.5 text-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-950/80 text-amber-300">
                  <Code2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {t(
                      `Live Code-Editor & Hot-Reload — ${hotReloadModalSvc.name}`,
                      `Live Code Editor & Hot-Reload — ${hotReloadModalSvc.name}`
                    )}
                  </h3>
                  <p className="font-mono text-[10.5px] text-nb-gray-400">
                    {hotReloadModalSvc.node_id}:{hotReloadModalSvc.port} ·{" "}
                    {hotReloadFilePath ||
                      `/var/lib/synapse/services/${hotReloadModalSvc.service_id}/server_${hotReloadModalSvc.port}.py`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHotReloadModalSvc(null)}
                className="rounded-lg p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {hotReloadNotice && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-3 py-2 font-mono text-[11px] text-emerald-300">
                {hotReloadNotice}
              </div>
            )}

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-nb-gray-400">
                <span>
                  {t(
                    "Datei-Pfad auf dem Muscle-Server (mit automatischem Pre-Write Rollback-Snapshot):",
                    "File path on Muscle server (with automatic Pre-Write Rollback Snapshot):"
                  )}
                </span>
              </div>
              <input
                type="text"
                value={hotReloadFilePath}
                onChange={(e) => setHotReloadFilePath(e.target.value)}
                className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-1.5 font-mono text-[11px] text-sky-300 focus:border-netbird focus:outline-none"
              />
            </div>

            <div>
              <textarea
                rows={14}
                value={
                  hotReloadLoading
                    ? t(
                        "Lade Quellcode vom Muscle...",
                        "Loading source code from Muscle..."
                      )
                    : hotReloadCode
                }
                onChange={(e) => setHotReloadCode(e.target.value)}
                disabled={hotReloadLoading}
                className="w-full rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-3.5 font-mono text-[11.5px] leading-relaxed text-nb-gray-100 focus:border-netbird focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="font-mono text-[10px] text-nb-gray-400">
                {t(
                  "✔ Pre-Write Snapshot aktiv · Automatischer Prozess-Neustart & HTTP-Health-Check",
                  "✔ Pre-Write Snapshot active · Automatic process restart & HTTP health check"
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHotReloadModalSvc(null)}
                  className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-4 py-2 text-xs text-nb-gray-300 hover:text-white"
                >
                  {t("Schließen", "Close")}
                </button>
                <button
                  type="submit"
                  disabled={hotReloadLoading || hotReloadSaving}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-netbird px-4 py-2 text-xs font-semibold text-white hover:bg-netbird-500 disabled:opacity-50 transition"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>
                    {hotReloadSaving
                      ? t("Hot-Reload läuft...", "Hot-Reloading...")
                      : t("Save & Hot-Reload", "Save & Hot-Reload")}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {showSelfHealingDrawer && (
        <div
          data-canvas-modal="true"
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute bottom-16 left-5 z-30 w-[500px] max-w-[94vw] rounded-2xl border border-nb-gray-800 bg-nb-gray-940/95 p-4 shadow-2xl backdrop-blur-md space-y-3 text-xs overscroll-contain"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-white">
                {t(
                  "Self-Healing & Incident Center",
                  "Self-Healing & Incident Center"
                )}
              </span>
              <span className="rounded border border-emerald-500/40 bg-emerald-950/70 px-1.5 py-0.5 font-mono text-[9.5px] text-emerald-300">
                {selfHealingEvents.length} {t("Ereignisse", "Events")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSelfHealingDrawer(false)}
              className="rounded p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
            {selfHealingEvents.length === 0 ? (
              <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-4 text-center text-nb-gray-400">
                {t(
                  "Noch keine Self-Healing-Ereignisse aufgezeichnet.",
                  "No self-healing events recorded yet."
                )}
              </div>
            ) : (
              selfHealingEvents.slice(0, 8).map((ev) => {
                const matchedSvc = allServices.find(
                  (s) => s.service_id === ev.service_id || s.port === ev.port
                );
                return (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-3 space-y-1.5 font-mono text-[10px]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white truncate">
                        ⚡{" "}
                        {translateText(
                          ev.service_name.replace(
                            new RegExp(`\\s*:${ev.port}\\b`),
                            ""
                          )
                        )}{" "}
                        (:{ev.port})
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="rounded border border-emerald-500/40 bg-emerald-950 px-1.5 py-0.5 text-[9px] text-emerald-300">
                          MTTR {ev.mttr_ms} ms · HTTP {ev.http_status}
                        </span>
                        {matchedSvc && (
                          <button
                            type="button"
                            disabled={selfHealBusyId === matchedSvc.service_id}
                            onClick={() =>
                              void handleQuickRestartService(matchedSvc, false)
                            }
                            className="inline-flex items-center gap-1 rounded border border-nb-gray-700 bg-nb-gray-900 px-1.5 py-0.5 text-[8.5px] text-nb-gray-200 hover:border-emerald-500/50 hover:text-emerald-300 disabled:opacity-40 transition"
                          >
                            <RotateCcw className="h-2.5 w-2.5 text-emerald-400" />
                            <span>Re-Run</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-nb-gray-400">
                      <span>
                        {ev.node_id} · {ev.trigger}
                      </span>
                      <span>
                        {ev.timestamp.replace("T", " ").slice(0, 19)}
                      </span>
                    </div>
                    {ev.log_snapshot && ev.log_snapshot.length > 0 && (
                      <div className="rounded bg-black/50 p-2 text-[8.5px] text-nb-gray-300 break-words leading-relaxed space-y-0.5">
                        {ev.log_snapshot.slice(-2).map((line, lIdx) => (
                          <div key={lIdx}>{translateText(line)}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </>
  );
}
