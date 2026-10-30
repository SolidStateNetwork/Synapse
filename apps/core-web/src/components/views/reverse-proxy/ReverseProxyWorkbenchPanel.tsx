"use client";

import React from "react";
import { Bot, Check, Copy, FileText, History, Play, RefreshCw, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { ProjectState, RegisteredServiceItem } from "@/types/synapse";

export interface ReverseProxyRequestHistoryItem {
  id: string;
  port: number;
  serviceName: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "SQL";
  path: string;
  payload: string;
  statusCode: number;
  latencyMs: number;
  ok: boolean;
  timestamp: string;
}

export interface ReverseProxyWorkbenchPanelProps {
  activeSvc: RegisteredServiceItem;
  activeProject: ProjectState | null;
  primaryNode: string;
  gatewayUrl: string;
  serviceWorkspaceTab: "split" | "preview" | "tester";
  activeEndpointIdx: number;
  setSelectedServiceId: (id: string) => void;
  setSelectedEndpointId: (id: string) => void;
  previewPort: number;
  setPreviewPort: (port: number) => void;
  previewSubPath: string;
  setPreviewSubPath: (path: string) => void;
  previewReloadNonce: number;
  setPreviewReloadNonce: React.Dispatch<React.SetStateAction<number>>;
  serviceActionMethod: "GET" | "POST" | "PUT" | "DELETE" | "SQL";
  setServiceActionMethod: (m: "GET" | "POST" | "PUT" | "DELETE" | "SQL") => void;
  serviceActionPath: string;
  setServiceActionPath: (p: string) => void;
  serviceActionPayload: string;
  setServiceActionPayload: (p: string) => void;
  serviceActionBusy: boolean;
  serviceActionResult: {
    ok: boolean; status_code: number; latency_ms: number; method: string; proxy_url: string; response_text: string;
  } | null;
  handleInvokeServiceAction: (override?: {
    nodeId?: string; port?: number; method?: "GET" | "POST" | "PUT" | "DELETE" | "SQL"; path?: string; payload?: string;
  }) => void;
  copiedResponse: boolean;
  setCopiedResponse: (val: boolean) => void;
  requestHistory: ReverseProxyRequestHistoryItem[];
  wbLogsOpen: boolean;
  wbLogsBusy: boolean;
  wbLogsLines: string[];
  wbLogsErrorCount: number;
  wbLogsFilter: string;
  setWbLogsFilter: (val: string) => void;
  wbLogsErrorsOnly: boolean;
  setWbLogsErrorsOnly: React.Dispatch<React.SetStateAction<boolean>>;
  wbLogsCopied: boolean;
  setWbLogsCopied: (val: boolean) => void;
  handleFetchWorkbenchLogs: (svcTarget?: RegisteredServiceItem) => Promise<void>;
  onDiagnoseService?: (port: number) => void;
}

export function ReverseProxyWorkbenchPanel({
  activeSvc, activeProject, primaryNode, gatewayUrl, serviceWorkspaceTab, activeEndpointIdx,
  setSelectedServiceId, setSelectedEndpointId, previewPort, setPreviewPort, previewSubPath, setPreviewSubPath,
  previewReloadNonce, setPreviewReloadNonce, serviceActionMethod, setServiceActionMethod,
  serviceActionPath, setServiceActionPath, serviceActionPayload, setServiceActionPayload,
  serviceActionBusy, serviceActionResult, handleInvokeServiceAction, copiedResponse, setCopiedResponse,
  requestHistory, wbLogsOpen, wbLogsBusy, wbLogsLines, wbLogsErrorCount, wbLogsFilter, setWbLogsFilter,
  wbLogsErrorsOnly, setWbLogsErrorsOnly, wbLogsCopied, setWbLogsCopied, handleFetchWorkbenchLogs, onDiagnoseService,
}: ReverseProxyWorkbenchPanelProps) {
  const { t } = useI18n();
  const activeEndpoints = activeSvc?.endpoints || [];

  if (serviceWorkspaceTab === "preview") {
    return (
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-2 border-b border-nb-gray-800 bg-nb-gray-950 px-5 py-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-nb-gray-400">
              Pfad auf :{previewPort}
            </span>
            <input
              type="text"
              value={previewSubPath}
              onChange={(e) => setPreviewSubPath(e.target.value || "/")}
              className="w-56 rounded-lg border border-nb-gray-800 bg-nb-gray-930 px-3 py-1 font-mono text-xs text-white focus:border-netbird focus:outline-none"
              placeholder="/"
            />
          </div>
          <button
            type="button"
            onClick={() => setPreviewReloadNonce((n) => n + 1)}
            className="flex items-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-930 px-3 py-1.5 text-xs text-nb-gray-300 hover:text-white transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Neu laden</span>
          </button>
        </div>
        <iframe
          key={`${previewPort}-${previewSubPath}-${previewReloadNonce}`}
          title="Synapse Reverse Proxy Preview"
          src={`${gatewayUrl}/preview/${activeProject?.project_id}/${
            activeSvc?.node_id || primaryNode || "unassigned"
          }/${previewPort}${
            previewSubPath.startsWith("/")
              ? previewSubPath
              : `/${previewSubPath}`
          }`}
          className="w-full bg-white h-[500px]"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 divide-y divide-nb-gray-800/80 lg:grid-cols-12 lg:divide-y-0 lg:divide-x">
      <div className="lg:col-span-4 bg-nb-gray-950/35 p-4 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-400">
            Verfügbare Endpunkte
          </span>
          <span className="rounded-full border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 font-mono text-[10px] text-nb-gray-400">
            {activeEndpoints.length}
          </span>
        </div>

        {activeEndpoints.length === 0 ? (
          <div className="rounded-lg border border-nb-gray-800/60 bg-nb-gray-950/60 p-3.5 text-xs text-nb-gray-400">
            Sende rechts eine Anfrage an{" "}
            <code className="font-mono text-white">:{activeSvc.port}</code>.
          </div>
        ) : (
          <div className="space-y-2">
            {activeEndpoints.map((ep, idx) => {
              const isCurrentEp = idx === activeEndpointIdx;
              const cleanLabel = ep.label
                .replace(new RegExp(`^${ep.method}\\s+`, "i"), "")
                .trim();

              return (
                <button
                  key={`${ep.id || idx}::${ep.label}`}
                  type="button"
                  onClick={() => {
                    setSelectedServiceId(activeSvc.service_id);
                    setSelectedEndpointId(`${ep.id || idx}::${ep.label}`);
                    setPreviewPort(activeSvc.port);
                    setServiceActionMethod(ep.method);
                    setServiceActionPath(ep.path);
                    setServiceActionPayload(ep.sample_payload || "");
                    handleInvokeServiceAction({
                      nodeId: activeSvc.node_id,
                      port: activeSvc.port,
                      method: ep.method,
                      path: ep.path,
                      payload: ep.sample_payload || "",
                    });
                  }}
                  className={`group flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-xs transition-all ${
                    isCurrentEp
                      ? "border-netbird/60 bg-netbird/10 text-white shadow-sm"
                      : "border-nb-gray-800/70 bg-nb-gray-950/60 text-nb-gray-300 hover:border-nb-gray-700 hover:bg-nb-gray-900/70 hover:text-white"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          ep.method === "POST"
                            ? "bg-amber-950/90 text-amber-300 border border-amber-500/30"
                            : ep.method === "SQL"
                            ? "bg-sky-950/90 text-sky-300 border border-sky-500/30"
                            : "bg-emerald-950/90 text-emerald-300 border border-emerald-500/30"
                        }`}
                      >
                        {ep.method}
                      </span>
                      <span className="truncate font-mono text-xs font-medium text-white">
                        {cleanLabel}
                      </span>
                    </div>
                    {ep.description && (
                      <div className="mt-1.5 line-clamp-2 leading-snug text-[11px] text-nb-gray-400">
                        {ep.description}
                      </div>
                    )}
                  </div>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      isCurrentEp
                        ? "border-netbird/50 bg-netbird text-white"
                        : "border-nb-gray-800 bg-nb-gray-900 text-nb-gray-400 group-hover:border-netbird/40 group-hover:text-netbird"
                    }`}
                  >
                    <Play className="h-3 w-3" />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="lg:col-span-8 p-5 space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-1.5 focus-within:border-netbird/60 transition-colors">
          <select
            value={serviceActionMethod}
            onChange={(e) => {
              setSelectedEndpointId("");
              setServiceActionMethod(
                e.target.value as "GET" | "POST" | "PUT" | "DELETE" | "SQL"
              );
            }}
            className="rounded-lg border border-nb-gray-800/80 bg-nb-gray-900 px-3 py-1.5 font-mono text-xs font-bold text-netbird focus:outline-none cursor-pointer"
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="SQL">SQL</option>
          </select>

          <div className="h-5 w-px bg-nb-gray-800 shrink-0" />

          <input
            type="text"
            value={serviceActionPath}
            onChange={(e) => {
              setSelectedEndpointId("");
              setServiceActionPath(e.target.value);
            }}
            placeholder={
              serviceActionMethod === "SQL"
                ? "/var/lib/synapse/app.db"
                : "/"
            }
            className="flex-1 bg-transparent px-2.5 py-1.5 font-mono text-xs text-white placeholder:text-nb-gray-500 focus:outline-none"
          />

          <button
            type="button"
            disabled={serviceActionBusy}
            onClick={() => handleInvokeServiceAction()}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-netbird px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-netbird-500 disabled:opacity-50 transition-colors"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{serviceActionBusy ? "Läuft..." : "Ausführen"}</span>
          </button>
        </div>

        {(serviceActionMethod !== "GET" ||
          serviceActionPayload.trim().length > 0) && (
          <div className="space-y-1.5">
            <div className="px-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-400">
              {serviceActionMethod === "SQL"
                ? "SQL-Abfrage"
                : "Request-Body (JSON)"}
            </div>
            <textarea
              rows={3}
              value={serviceActionPayload}
              onChange={(e) => {
                setSelectedEndpointId("");
                setServiceActionPayload(e.target.value);
              }}
              placeholder={
                serviceActionMethod === "SQL"
                  ? "SELECT * FROM events ORDER BY id DESC LIMIT 10;"
                  : '{"action": "ping"}'
              }
              className="w-full rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-3.5 font-mono text-xs text-nb-gray-100 focus:border-netbird focus:outline-none"
            />
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-nb-gray-800/90 bg-nb-gray-950">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-nb-gray-800/80 bg-nb-gray-930/60 px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="font-medium text-nb-gray-200">Antwort</span>
              <span className="font-mono text-[11px] text-nb-gray-400">
                ({activeSvc.name})
              </span>
            </div>

            {serviceActionResult && (
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 text-nb-gray-300">
                  {serviceActionResult.method}
                </span>
                <span
                  className={`rounded border px-2 py-0.5 font-semibold ${
                    serviceActionResult.ok
                      ? "border-emerald-500/40 bg-emerald-950/80 text-emerald-300"
                      : "border-red-500/40 bg-red-950/80 text-red-300"
                  }`}
                >
                  HTTP {serviceActionResult.status_code}
                </span>
                <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 text-nb-gray-400">
                  {serviceActionResult.latency_ms} ms
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      serviceActionResult.response_text || ""
                    );
                    setCopiedResponse(true);
                    setTimeout(() => setCopiedResponse(false), 1800);
                  }}
                  className="inline-flex items-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 text-[10.5px] text-nb-gray-300 hover:border-emerald-400 hover:text-emerald-300 transition"
                >
                  {copiedResponse ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{t("Kopieren", "Copy")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleFetchWorkbenchLogs(activeSvc)}
                  className="inline-flex items-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 text-[10.5px] text-sky-300 hover:border-sky-400 hover:text-white transition"
                >
                  <FileText className="h-3 w-3 text-sky-400" />
                  <span>{t("Live-Logs", "Live Logs")}</span>
                </button>
                {onDiagnoseService && (
                  <button
                    type="button"
                    onClick={() => onDiagnoseService(activeSvc.port)}
                    className="inline-flex items-center gap-1 rounded border border-violet-500/40 bg-violet-950/70 px-2 py-0.5 text-[10.5px] font-semibold text-violet-300 hover:bg-violet-900/70 transition"
                  >
                    <Bot className="h-3 w-3 text-violet-400" />
                    <span>{t("KI-Diagnose", "AI Diagnosis")}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <pre className="max-h-80 min-h-[180px] overflow-auto p-4 font-mono text-xs whitespace-pre-wrap text-nb-gray-100 leading-relaxed select-text">
            {serviceActionResult
              ? serviceActionResult.response_text
              : t(
                  "Klicke links auf einen Endpunkt oder oben auf 'Ausführen'.",
                  "Click an endpoint on the left or 'Execute' above."
                )}
          </pre>
        </div>

        {requestHistory.length > 0 && (
          <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-950/80 p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-nb-gray-400">
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-300">
                <History className="h-3.5 w-3.5 text-netbird" />
                <span>
                  {t(
                    "Letzte API-Aufrufe (1-Klick Replay)",
                    "Recent API Calls (1-Click Replay)"
                  )}
                </span>
              </span>
              <span className="font-mono text-[10px] text-nb-gray-400">
                {requestHistory.length} {t("Aufrufe", "Calls")}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {requestHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setPreviewPort(item.port);
                    setServiceActionMethod(item.method);
                    setServiceActionPath(item.path);
                    setServiceActionPayload(item.payload);
                    handleInvokeServiceAction({
                      nodeId: activeSvc.node_id,
                      port: item.port,
                      method: item.method,
                      path: item.path,
                      payload: item.payload,
                    });
                  }}
                  title={t(
                    "Klicken für sofortiges 1-Klick Replay",
                    "Click for instant 1-Click Replay"
                  )}
                  className="group inline-flex items-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-940 px-2.5 py-1 font-mono text-[10.5px] text-nb-gray-200 hover:border-netbird/60 hover:text-white transition"
                >
                  <span
                    className={`rounded px-1 py-0.5 text-[9px] font-bold ${
                      item.method === "POST"
                        ? "bg-amber-950 text-amber-300"
                        : item.method === "SQL"
                        ? "bg-sky-950 text-sky-300"
                        : "bg-emerald-950 text-emerald-300"
                    }`}
                  >
                    {item.method}
                  </span>
                  <span className="text-nb-gray-300">:{item.port}</span>
                  <span className="max-w-[140px] truncate text-white">
                    {item.path}
                  </span>
                  <span
                    className={`text-[9.5px] ${
                      item.ok ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {item.statusCode} · {item.latencyMs}ms
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {wbLogsOpen &&
          (() => {
            const filteredWbLines = wbLogsLines.slice(-50).filter((line) => {
              if (
                wbLogsErrorsOnly &&
                !/error|fail|exception|panic|500|501|502|503|404/i.test(line)
              ) {
                return false;
              }
              if (
                wbLogsFilter.trim() &&
                !line.toLowerCase().includes(wbLogsFilter.trim().toLowerCase())
              ) {
                return false;
              }
              return true;
            });
            return (
              <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-3.5 font-mono text-xs space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-sky-400" />
                    <span className="font-semibold text-white">
                      {t("Live-Log-Konsole", "Live Log Console")} (:{activeSvc.port})
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${
                        wbLogsErrorCount > 0
                          ? "border-red-500/40 bg-red-950/70 text-red-300"
                          : "border-emerald-500/40 bg-emerald-950/70 text-emerald-300"
                      }`}
                    >
                      {wbLogsErrorCount} {t("Fehler", "Errors")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-nb-gray-500" />
                      <input
                        type="text"
                        value={wbLogsFilter}
                        onChange={(e) => setWbLogsFilter(e.target.value)}
                        placeholder={t(
                          "Logs durchsuchen...",
                          "Search logs..."
                        )}
                        className="w-40 rounded-lg border border-nb-gray-800 bg-nb-gray-940 pl-6 pr-2 py-1 text-[10.5px] text-white placeholder:text-nb-gray-500 focus:border-sky-400 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setWbLogsErrorsOnly((v) => !v)}
                      className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition ${
                        wbLogsErrorsOnly
                          ? "border-red-500/50 bg-red-950/80 text-red-300"
                          : "border-nb-gray-800 bg-nb-gray-900 text-nb-gray-400 hover:text-white"
                      }`}
                    >
                      {t("Nur Fehler", "Errors Only")}
                    </button>
                    <button
                      type="button"
                      disabled={wbLogsBusy}
                      onClick={() => void handleFetchWorkbenchLogs(activeSvc)}
                      className="inline-flex items-center gap-1 rounded-lg border border-nb-gray-800 bg-nb-gray-900 px-2 py-1 text-[10px] text-nb-gray-300 hover:border-sky-400 hover:text-white transition"
                    >
                      <RefreshCw
                        className={`h-3 w-3 ${
                          wbLogsBusy ? "animate-spin text-sky-400" : ""
                        }`}
                      />
                      <span>{t("Aktualisieren", "Refresh")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          filteredWbLines.join("\n")
                        );
                        setWbLogsCopied(true);
                        setTimeout(() => setWbLogsCopied(false), 1800);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-nb-gray-800 bg-nb-gray-900 px-2 py-1 text-[10px] text-nb-gray-300 hover:border-emerald-400 hover:text-emerald-300 transition"
                    >
                      {wbLogsCopied ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>{t("Kopieren", "Copy")}</span>
                    </button>
                    {onDiagnoseService && (
                      <button
                        type="button"
                        onClick={() => onDiagnoseService(activeSvc.port)}
                        className="inline-flex items-center gap-1 rounded-lg border border-violet-500/40 bg-violet-950/70 px-2 py-1 text-[10px] font-semibold text-violet-300 hover:bg-violet-900/70 transition"
                      >
                        <Bot className="h-3 w-3 text-violet-400" />
                        <span>{t("KI-Diagnose", "AI Diagnosis")}</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="max-h-44 overflow-y-auto space-y-0.5 rounded-lg bg-black/60 p-2.5 text-[11px] text-nb-gray-300 select-text">
                  {filteredWbLines.length === 0 ? (
                    <div className="py-2 text-center text-nb-gray-500">
                      {t(
                        "Keine passenden Log-Einträge gefunden.",
                        "No matching log entries found."
                      )}
                    </div>
                  ) : (
                    filteredWbLines.map((line, lIdx) => (
                      <div
                        key={lIdx}
                        className={`break-all ${
                          /error|fail|exception|panic/i.test(line)
                            ? "text-red-400"
                            : "text-nb-gray-300"
                        }`}
                      >
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })()}
      </div>
    </div>
  );
}
