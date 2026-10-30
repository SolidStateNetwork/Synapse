"use client";

import React from "react";
import {
  ChevronsUpDown,
  Lock,
  Maximize2,
  Plus,
  RotateCcw,
  Unlock,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type {
  Point,
  RegisteredService,
  SelfHealingEventItem,
} from "@/components/canvas/canvasTypes";
import { CanvasHotReloadAndHealDrawers } from "@/components/canvas/CanvasHotReloadAndHealDrawers";

export interface CanvasModalsAndToolbarProps {
  primaryNode: string;
  allServices: RegisteredService[];
  authLocked: boolean;
  setAuthLocked: React.Dispatch<React.SetStateAction<boolean>>;
  authRole: "admin" | "operator";
  authNotice: string | null;
  unlockPwdInput: string;
  setUnlockPwdInput: React.Dispatch<React.SetStateAction<string>>;
  unlockPinInput: string;
  setUnlockPinInput: React.Dispatch<React.SetStateAction<string>>;
  handleUnlockDashboard: (e: React.FormEvent) => Promise<void>;
  zoom: number;
  zoomRef: React.MutableRefObject<number>;
  applyZoomAtPoint: (nextZoom: number, focalX?: number, focalY?: number) => void;
  allExpanded: boolean;
  handleToggleExpandAll: () => void;
  effectivePositions: Record<string, Point>;
  handleFitView: (overridePositions?: Record<string, Point>) => void;
  handleResetLayout: () => void;
  showCustomServiceModal: boolean;
  setShowCustomServiceModal: React.Dispatch<React.SetStateAction<boolean>>;
  customSvcName: string;
  setCustomSvcName: React.Dispatch<React.SetStateAction<string>>;
  customSvcPort: string;
  setCustomSvcPort: React.Dispatch<React.SetStateAction<string>>;
  customSvcCategory: "backend" | "webui" | "database";
  setCustomSvcCategory: React.Dispatch<
    React.SetStateAction<"backend" | "webui" | "database">
  >;
  customSvcRuntime: "python_http" | "static_webui" | "sqlite_rest";
  setCustomSvcRuntime: React.Dispatch<
    React.SetStateAction<"python_http" | "static_webui" | "sqlite_rest">
  >;
  customSvcAutoHeal: boolean;
  setCustomSvcAutoHeal: React.Dispatch<React.SetStateAction<boolean>>;
  customSvcBusy: boolean;
  customSvcNotice: string | null;
  handleDeployCustomService: (e: React.FormEvent) => Promise<void>;
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

export function CanvasModalsAndToolbar({
  primaryNode,
  allServices,
  authLocked,
  setAuthLocked,
  authRole,
  authNotice,
  unlockPwdInput,
  setUnlockPwdInput,
  unlockPinInput,
  setUnlockPinInput,
  handleUnlockDashboard,
  zoom,
  zoomRef,
  applyZoomAtPoint,
  allExpanded,
  handleToggleExpandAll,
  effectivePositions,
  handleFitView,
  handleResetLayout,
  showCustomServiceModal,
  setShowCustomServiceModal,
  customSvcName,
  setCustomSvcName,
  customSvcPort,
  setCustomSvcPort,
  customSvcCategory,
  setCustomSvcCategory,
  customSvcRuntime,
  setCustomSvcRuntime,
  customSvcAutoHeal,
  setCustomSvcAutoHeal,
  customSvcBusy,
  customSvcNotice,
  handleDeployCustomService,
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
}: CanvasModalsAndToolbarProps) {
  const { t } = useI18n();
  const targetNodeLabel = primaryNode || t("Ziel-Node", "target node");

  return (
    <>
      {authLocked && (
        <div
          data-canvas-modal="true"
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          className="absolute inset-0 z-50 flex items-center justify-center bg-nb-gray-950/90 backdrop-blur-md p-4"
        >
          <form
            onSubmit={handleUnlockDashboard}
            className="w-full max-w-sm rounded-2xl border border-nb-gray-800 bg-nb-gray-940 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-netbird/40 bg-netbird-950 text-netbird">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {t(
                    "Synapse Control Center gesperrt",
                    "Synapse Control Center Locked"
                  )}
                </h3>
                <p className="text-xs text-nb-gray-400">
                  {t(
                    "Bitte mit Admin- oder Operator-Passwort entsperren",
                    "Unlock with Admin or Operator password"
                  )}
                </p>
              </div>
            </div>
            {authNotice && (
              <div className="rounded-lg border border-red-500/40 bg-red-950/60 px-3 py-2 text-xs text-red-300">
                {authNotice}
              </div>
            )}
            <div className="space-y-2.5">
              <input
                type="password"
                value={unlockPwdInput}
                onChange={(e) => setUnlockPwdInput(e.target.value)}
                placeholder={t("Passwort eingeben...", "Enter password...")}
                className="w-full rounded-xl border border-nb-gray-800 bg-nb-gray-950 px-3.5 py-2.5 text-xs text-white focus:border-netbird focus:outline-none"
                autoFocus
              />
              <input
                type="text"
                value={unlockPinInput}
                onChange={(e) => setUnlockPinInput(e.target.value)}
                placeholder={t(
                  "2FA-PIN (falls aktiviert)...",
                  "2FA PIN (if enabled)..."
                )}
                className="w-full rounded-xl border border-nb-gray-800 bg-nb-gray-950 px-3.5 py-2 text-xs text-white focus:border-netbird focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-netbird py-2.5 text-xs font-semibold text-white hover:bg-netbird-500 transition"
            >
              <Unlock className="h-4 w-4" />
              <span>
                {t("Control Center entsperren", "Unlock Control Center")}
              </span>
            </button>
          </form>
        </div>
      )}

      {/* Bottom-Left Zoom, Expand & Lock Controls */}
      <div
        data-canvas-modal="true"
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        className="pointer-events-auto absolute bottom-4 left-5 z-20 flex items-center gap-1 rounded-xl border border-nb-gray-800 bg-nb-gray-940/90 p-1 shadow-lg backdrop-blur"
      >
        <button
          onClick={() => applyZoomAtPoint(zoomRef.current * 1.15)}
          className="rounded-lg p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title="Zoom In"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <span className="px-1.5 font-mono text-[10px] text-nb-gray-300">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => applyZoomAtPoint(zoomRef.current / 1.15)}
          className="rounded-lg p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title="Zoom Out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <div className="h-3.5 w-[1px] bg-nb-gray-800 mx-0.5" />
        <button
          onClick={handleToggleExpandAll}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title={t(
            "Alle Knoten auf dem Canvas auf- oder zuklappen",
            "Expand or collapse all canvas nodes"
          )}
        >
          <ChevronsUpDown className="h-3.5 w-3.5 text-netbird" />
          <span>
            {allExpanded
              ? t("Alle einklappen", "Collapse all")
              : t("Alle erweitern", "Expand all")}
          </span>
        </button>
        <div className="h-3.5 w-[1px] bg-nb-gray-800 mx-0.5" />
        <button
          onClick={() => setAuthLocked(true)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-nb-gray-900"
          title={t("Dashboard sperren (RBAC)", "Lock Dashboard (RBAC)")}
        >
          <Lock className="h-3.5 w-3.5" />
          <span>
            {authRole === "operator"
              ? t("Operator (Nur-Lesen)", "Operator (Read-Only)")
              : t("Sperren", "Lock")}
          </span>
        </button>
        <div className="h-3.5 w-[1px] bg-nb-gray-800 mx-0.5" />
        <button
          onClick={() => handleFitView(effectivePositions)}
          className="rounded-lg p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title={t("Ansicht zentrieren", "Center view")}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleResetLayout}
          className="rounded-lg p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title={t("Layout zurücksetzen", "Reset layout")}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <div className="h-3.5 w-[1px] bg-nb-gray-800 mx-0.5" />
        <button
          type="button"
          onClick={() => setShowCustomServiceModal(true)}
          className="flex items-center gap-1 rounded-lg bg-netbird px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-netbird-500 transition shadow-sm"
          title={t(
            `Eigenen Dienst in 10 Sekunden live auf ${targetNodeLabel} bereitstellen`,
            `Deploy custom service live on ${targetNodeLabel} in 10 seconds`
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{t("Neuer Service", "New Service")}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowSelfHealingDrawer((v) => !v)}
          className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-900/60 transition"
          title={t(
            "Self-Healing & Incident Center öffnen",
            "Open Self-Healing & Incident Center"
          )}
        >
          <Zap className="h-3.5 w-3.5 text-emerald-400" />
          <span>
            {t(
              `Self-Healing (${selfHealingEvents.length})`,
              `Self-Healing (${selfHealingEvents.length})`
            )}
          </span>
        </button>
      </div>

      {/* v0.6.0: 1-CLICK CUSTOM SERVICE BUILDER MODAL ON CANVAS */}
      {showCustomServiceModal && (
        <div
          data-canvas-modal="true"
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-nb-gray-950/85 backdrop-blur-sm p-4"
        >
          <form
            onSubmit={handleDeployCustomService}
            className="w-full max-w-md rounded-2xl border border-nb-gray-800 bg-nb-gray-940 p-5 shadow-2xl space-y-4 text-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-netbird/40 bg-netbird-950 text-netbird">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {t(
                      "1-Click Custom Service Builder (v0.6.0)",
                      "1-Click Custom Service Builder (v0.6.0)"
                    )}
                  </h3>
                  <p className="text-[11px] text-nb-gray-400">
                    {t(
                      `Rollt deinen Dienst direkt live auf ${targetNodeLabel} aus`,
                      `Rolls out your service live on ${targetNodeLabel}`
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomServiceModal(false)}
                className="rounded-lg p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {customSvcNotice && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-3 py-2 font-mono text-[11px] text-emerald-300">
                {customSvcNotice}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-nb-gray-300 mb-1">
                  {t("Service-Name", "Service Name")}
                </label>
                <input
                  type="text"
                  required
                  value={customSvcName}
                  onChange={(e) => setCustomSvcName(e.target.value)}
                  placeholder={t(
                    "z.B. Edge Metrics API",
                    "e.g. Edge Metrics API"
                  )}
                  className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 text-xs text-white focus:border-netbird focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-nb-gray-300 mb-1">
                  {t("Port", "Port")}
                </label>
                <input
                  type="number"
                  required
                  min={1024}
                  max={65535}
                  value={customSvcPort}
                  onChange={(e) => setCustomSvcPort(e.target.value)}
                  className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 font-mono text-xs text-netbird focus:border-netbird focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-medium text-nb-gray-300 mb-1">
                  {t("Kategorie", "Category")}
                </label>
                <select
                  value={customSvcCategory}
                  onChange={(e) => {
                    const cat = e.target.value as
                      | "backend"
                      | "webui"
                      | "database";
                    setCustomSvcCategory(cat);
                    setCustomSvcRuntime(
                      cat === "webui"
                        ? "static_webui"
                        : cat === "database"
                        ? "sqlite_rest"
                        : "python_http"
                    );
                  }}
                  className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 text-xs text-white"
                >
                  <option value="backend">
                    {t("Backend / REST API", "Backend / REST API")}
                  </option>
                  <option value="webui">
                    {t("Interaktive WebUI", "Interactive WebUI")}
                  </option>
                  <option value="database">
                    {t("SQLite Datenbank-API", "SQLite Database API")}
                  </option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-nb-gray-300 mb-1">
                  {t("Runtime-Template", "Runtime Template")}
                </label>
                <select
                  value={customSvcRuntime}
                  onChange={(e) =>
                    setCustomSvcRuntime(
                      e.target.value as
                        | "python_http"
                        | "static_webui"
                        | "sqlite_rest"
                    )
                  }
                  className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 font-mono text-xs text-sky-300"
                >
                  <option value="python_http">Python JSON Microservice</option>
                  <option value="static_webui">Dark HTML5 Live WebUI</option>
                  <option value="sqlite_rest">SQLite3 WAL Storage Engine</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2.5 rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={customSvcAutoHeal}
                onChange={(e) => setCustomSvcAutoHeal(e.target.checked)}
                className="rounded border-nb-gray-700 accent-netbird"
              />
              <div>
                <div className="font-semibold text-white">
                  {t(
                    "⚡ Autonomous Self-Healing aktivieren",
                    "⚡ Enable Autonomous Self-Healing"
                  )}
                </div>
                <div className="text-[10.5px] text-nb-gray-400">
                  {t(
                    "Überwacht den Port 24/7 und startet den Dienst bei Absturz automatisch neu",
                    "Monitors the port 24/7 and automatically restarts the service on crash"
                  )}
                </div>
              </div>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomServiceModal(false)}
                className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-4 py-2 text-xs text-nb-gray-300 hover:text-white"
              >
                {t("Abbrechen", "Cancel")}
              </button>
              <button
                type="submit"
                disabled={customSvcBusy}
                className="flex items-center gap-1.5 rounded-lg bg-netbird px-5 py-2 text-xs font-semibold text-white hover:bg-netbird-500 disabled:opacity-50 transition"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>
                  {customSvcBusy
                    ? t("Wird ausgerollt...", "Deploying...")
                    : t("Jetzt live bereitstellen", "Deploy Live Now")}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      <CanvasHotReloadAndHealDrawers
        allServices={allServices}
        hotReloadModalSvc={hotReloadModalSvc}
        setHotReloadModalSvc={setHotReloadModalSvc}
        hotReloadFilePath={hotReloadFilePath}
        setHotReloadFilePath={setHotReloadFilePath}
        hotReloadCode={hotReloadCode}
        setHotReloadCode={setHotReloadCode}
        hotReloadLoading={hotReloadLoading}
        hotReloadSaving={hotReloadSaving}
        hotReloadNotice={hotReloadNotice}
        handleSaveAndHotReloadCode={handleSaveAndHotReloadCode}
        showSelfHealingDrawer={showSelfHealingDrawer}
        setShowSelfHealingDrawer={setShowSelfHealingDrawer}
        selfHealingEvents={selfHealingEvents}
        selfHealBusyId={selfHealBusyId}
        handleQuickRestartService={handleQuickRestartService}
      />
    </>
  );
}
