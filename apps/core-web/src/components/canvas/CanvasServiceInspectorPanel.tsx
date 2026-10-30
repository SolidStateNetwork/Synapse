"use client";

import React from "react";
import {
  ArrowLeftRight,
  Bot,
  Check,
  ChevronRight,
  Copy,
  Cpu,
  FileText,
  Globe,
  Link2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Server,
  Wrench,
  Zap,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type {
  ChaosResultState,
  DomainBindingItem,
  RegisteredService,
  ServiceMeshLink,
} from "@/components/canvas/canvasTypes";

export interface ServiceNodeInspectorPanelProps {
  svc: RegisteredService;
  allServices: RegisteredService[];
  serviceLinks: ServiceMeshLink[];
  domainBindings: Record<string, DomainBindingItem>;
  domainEditorOpen: Record<string, boolean>;
  domainInputMap: Record<string, string>;
  domainNoticeMap: Record<string, string>;
  serviceLogsMap: Record<
    string,
    { lines: string[]; errorCount: number; open: boolean }
  >;
  logBusyId: string | null;
  chaosBusyId: string | null;
  chaosResultMap: Record<string, ChaosResultState>;
  authRole: "admin" | "operator";
  onOpenReverseProxy: (port: number) => void;
  onHealService: (port: number) => void;
  onToggleServiceLink: (fromId: string, toId: string) => void;
  onTailServiceLogs: (svc: RegisteredService, forceRefresh?: boolean) => void;
  onToggleDomainEditor: (serviceId: string) => void;
  onChangeDomainInput: (serviceId: string, value: string) => void;
  onSaveServiceDomain: (svc: RegisteredService) => void;
  onRunChaosTest: (svc: RegisteredService) => void;
  linkProbeBusyId?: string | null;
  onUpdateServiceLinkProtocol?: (
    fromId: string,
    toId: string,
    protocol: string
  ) => void;
  onProbeServiceLink?: (
    fromSvc: RegisteredService,
    toSvc: RegisteredService
  ) => void;
}

export const ServiceNodeInspectorPanel = React.memo(
  function ServiceNodeInspectorPanel({
    svc,
    allServices,
    serviceLinks,
    domainBindings,
    domainEditorOpen,
    domainInputMap,
    domainNoticeMap,
    serviceLogsMap,
    logBusyId,
    chaosBusyId,
    chaosResultMap,
    authRole,
    onOpenReverseProxy,
    onHealService,
    onToggleServiceLink,
    onTailServiceLogs,
    onToggleDomainEditor,
    onChangeDomainInput,
    onSaveServiceDomain,
    onRunChaosTest,
    linkProbeBusyId,
    onUpdateServiceLinkProtocol,
    onProbeServiceLink,
  }: ServiceNodeInspectorPanelProps) {
    const { t, translateText } = useI18n();
    const [logFilter, setLogFilter] = React.useState("");
    const [logErrorsOnly, setLogErrorsOnly] = React.useState(false);
    const [logCopied, setLogCopied] = React.useState(false);

    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className="mt-3 space-y-2.5 border-t border-nb-gray-800/90 pt-2.5 text-[11px]"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {svc.auto_discovered && (
            <span className="inline-flex items-center justify-center rounded border border-sky-500/40 bg-sky-500/15 px-1.5 py-1 font-mono text-[9px] leading-none font-semibold text-sky-300">
              {t("AUTO-ERKANNT", "AUTO-DISCOVERED")}
            </span>
          )}
          {svc.container_name && (
            <span className="inline-flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/15 px-1.5 py-1 font-mono text-[9px] leading-none text-sky-300 truncate max-w-[180px]">
              <Server className="h-2.5 w-2.5 shrink-0 text-sky-400" />
              <span className="truncate">{svc.container_name}</span>
            </span>
          )}
          {svc.process_name && (
            <span className="inline-flex items-center gap-1 rounded border border-nb-gray-700 bg-nb-gray-950 px-1.5 py-1 font-mono text-[9px] leading-none text-nb-gray-300">
              <Cpu className="h-2.5 w-2.5 shrink-0 text-nb-gray-400" />
              <span>{svc.process_name}</span>
            </span>
          )}
          {domainBindings[svc.service_id]?.domain && (
            <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-1 font-mono text-[9px] leading-none text-emerald-300 truncate max-w-[200px]">
              <Lock className="h-2.5 w-2.5 shrink-0 text-emerald-400" />
              <span className="truncate">
                https://{domainBindings[svc.service_id].domain}
              </span>
            </span>
          )}
        </div>

        {svc.description && (
          <p className="text-[11px] text-nb-gray-300 leading-relaxed">
            {translateText(svc.description)}
          </p>
        )}

        {svc.endpoints && svc.endpoints.length > 0 && (
          <div className="space-y-1">
            <div className="font-mono text-[9.5px] uppercase tracking-wider text-nb-gray-400">
              {t(
                "Verfügbare Aktionen & Endpunkte",
                "Available Actions & Endpoints"
              )}
            </div>
            {svc.endpoints.map((ep) => (
              <button
                key={ep.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenReverseProxy(svc.port);
                }}
                className="flex w-full items-center justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1.5 text-[10.5px] text-nb-gray-200 hover:border-sky-400 transition"
              >
                <span className="truncate">
                  <strong className="font-mono text-netbird mr-1.5">
                    {ep.method}
                  </strong>
                  {translateText(ep.label)
                    .replace(new RegExp(`^${ep.method}\\s+`, "i"), "")
                    .trim()}
                </span>
                <ChevronRight className="h-3 w-3 shrink-0 text-nb-gray-500" />
              </button>
            ))}
          </div>
        )}

        {allServices.length > 1 && (
          <div className="space-y-2 rounded-lg border border-nb-gray-800/80 bg-nb-gray-950 p-2.5">
            <div className="flex items-center gap-1.5 font-mono text-[9.5px] leading-none uppercase tracking-wider text-sky-300">
              <Link2 className="h-3 w-3 shrink-0 text-sky-400" />
              <span>
                {t(
                  "Service-Mesh Datenfluss-Verbindungen",
                  "Service-Mesh Data Flow Links"
                )}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allServices
                .filter((other) => other.service_id !== svc.service_id)
                .map((other) => {
                  const linked = serviceLinks.some(
                    (l) =>
                      l.fromServiceId === svc.service_id &&
                      l.toServiceId === other.service_id
                  );
                  return (
                    <button
                      key={other.service_id}
                      type="button"
                      onClick={() =>
                        onToggleServiceLink(svc.service_id, other.service_id)
                      }
                      className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[9.5px] leading-none transition ${
                        linked
                          ? "border-sky-500/60 bg-sky-500/20 text-sky-200 font-medium"
                          : "border-nb-gray-800 bg-nb-gray-900 text-nb-gray-300 hover:border-nb-gray-700 hover:text-white"
                      }`}
                    >
                      {linked ? (
                        <ArrowLeftRight className="h-2.5 w-2.5 shrink-0 text-sky-300" />
                      ) : (
                        <Plus className="h-2.5 w-2.5 shrink-0 text-nb-gray-400" />
                      )}
                      <span className="leading-none">
                        {translateText(other.name)}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        {serviceLinks.some((l) => l.fromServiceId === svc.service_id) && (
          <div className="space-y-1.5 rounded-lg border border-sky-500/30 bg-sky-950/20 p-2">
            {serviceLinks
              .filter((l) => l.fromServiceId === svc.service_id)
              .map((link) => {
                const targetSvc = allServices.find(
                  (s) => s.service_id === link.toServiceId
                );
                if (!targetSvc) return null;
                const isProbingLink = linkProbeBusyId === link.id;
                return (
                  <div
                    key={link.id}
                    className="flex items-center justify-between gap-1.5 font-mono text-[9px]"
                  >
                    <span className="truncate text-sky-200">
                      → :{targetSvc.port}
                    </span>
                    <select
                      value={link.protocol}
                      onChange={(e) =>
                        onUpdateServiceLinkProtocol?.(
                          svc.service_id,
                          targetSvc.service_id,
                          e.target.value
                        )
                      }
                      className="rounded border border-nb-gray-800 bg-nb-gray-940 px-1.5 py-0.5 text-[8.5px] text-nb-gray-200 focus:border-sky-400 focus:outline-none"
                    >
                      {[
                        "HTTP REST",
                        "gRPC",
                        "SQLite WAL",
                        "Redis / TCP",
                        "JSON Telemetry",
                      ].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={isProbingLink}
                      onClick={() => onProbeServiceLink?.(svc, targetSvc)}
                      className="shrink-0 rounded border border-emerald-500/40 bg-emerald-950/70 px-1.5 py-0.5 text-[8.5px] text-emerald-300 hover:bg-emerald-900/60 transition"
                    >
                      {isProbingLink ? "..." : `⚡ ${link.latency_ms ?? 1}ms`}
                    </button>
                  </div>
                );
              })}
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            disabled={logBusyId === svc.service_id}
            onClick={() => onTailServiceLogs(svc)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-950 py-1.5 font-mono text-[9.5px] leading-none text-nb-gray-200 hover:border-sky-400 hover:text-white transition"
          >
            <FileText className="h-3 w-3 shrink-0 text-sky-400" />
            <span>
              {logBusyId === svc.service_id
                ? "..."
                : t("Live-Logs", "Live Logs")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onToggleDomainEditor(svc.service_id)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-950 py-1.5 font-mono text-[9.5px] leading-none text-nb-gray-200 hover:border-emerald-400 hover:text-white transition"
          >
            <Lock className="h-3 w-3 shrink-0 text-emerald-400" />
            <span>{t("Domain/TLS", "Domain/TLS")}</span>
          </button>
          <button
            type="button"
            disabled={
              chaosBusyId === svc.service_id || authRole === "operator"
            }
            onClick={() => onRunChaosTest(svc)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 py-1.5 font-mono text-[9.5px] leading-none font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50 transition"
          >
            <Zap className="h-3 w-3 shrink-0 text-amber-400" />
            <span>
              {chaosBusyId === svc.service_id
                ? "..."
                : t("Chaos-Test", "Chaos Test")}
            </span>
          </button>
        </div>

        {serviceLogsMap[svc.service_id]?.open &&
          (() => {
            const rawLines = serviceLogsMap[svc.service_id].lines.slice(-40);
            const filteredLines = rawLines.filter((line) => {
              if (
                logErrorsOnly &&
                !/error|fail|exception|panic|500|501|502|503|404/i.test(line)
              ) {
                return false;
              }
              if (
                logFilter.trim() &&
                !line
                  .toLowerCase()
                  .includes(logFilter.trim().toLowerCase())
              ) {
                return false;
              }
              return true;
            });
            return (
              <div
                data-canvas-scroll-zone="true"
                onWheel={(e) => e.stopPropagation()}
                className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 font-mono text-[9px] space-y-1.5"
              >
                <div className="flex items-center justify-between gap-1 text-nb-gray-400">
                  <span className="truncate font-semibold text-nb-gray-200">
                    {t("Letzte Log-Zeilen", "Recent Log Lines")}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={
                        serviceLogsMap[svc.service_id].errorCount > 0
                          ? "text-red-400 font-semibold"
                          : "text-emerald-400"
                      }
                    >
                      {serviceLogsMap[svc.service_id].errorCount}{" "}
                      {t("Fehler", "Errors")}
                    </span>
                    <button
                      type="button"
                      onClick={() => onTailServiceLogs(svc, true)}
                      disabled={logBusyId === svc.service_id}
                      title={t("Logs aktualisieren", "Refresh logs")}
                      className="inline-flex items-center justify-center rounded border border-nb-gray-800 bg-nb-gray-900 p-1 text-nb-gray-300 hover:border-sky-400 hover:text-white transition"
                    >
                      <RefreshCw
                        className={`h-2.5 w-2.5 ${
                          logBusyId === svc.service_id
                            ? "animate-spin text-sky-400"
                            : ""
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          filteredLines.join("\n")
                        );
                        setLogCopied(true);
                        setTimeout(() => setLogCopied(false), 1800);
                      }}
                      title={t("Logs kopieren", "Copy logs")}
                      className="inline-flex items-center justify-center rounded border border-nb-gray-800 bg-nb-gray-900 p-1 text-nb-gray-300 hover:border-emerald-400 hover:text-emerald-300 transition"
                    >
                      {logCopied ? (
                        <Check className="h-2.5 w-2.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-2.5 w-2.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onHealService(svc.port)}
                      title={t(
                        "KI-Diagnose & Auto-Heal für diesen Service starten",
                        "Start AI Diagnosis & Auto-Heal for this service"
                      )}
                      className="inline-flex items-center gap-0.5 rounded border border-violet-500/40 bg-violet-950/70 px-1.5 py-0.5 text-[8px] font-semibold text-violet-300 hover:bg-violet-900/70 transition"
                    >
                      <Bot className="h-2.5 w-2.5 shrink-0 text-violet-400" />
                      <span>{t("KI", "AI")}</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="relative flex-1 min-w-0">
                    <Search className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-nb-gray-500" />
                    <input
                      type="text"
                      value={logFilter}
                      onChange={(e) => setLogFilter(e.target.value)}
                      placeholder={t("Logs filtern...", "Filter logs...")}
                      className="w-full rounded border border-nb-gray-800 bg-nb-gray-940 pl-5 pr-1.5 py-0.5 font-mono text-[8.5px] text-white placeholder:text-nb-gray-500 focus:border-sky-400 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setLogErrorsOnly((v) => !v)}
                    className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[8px] font-semibold transition ${
                      logErrorsOnly
                        ? "border-red-500/50 bg-red-950/80 text-red-300"
                        : "border-nb-gray-800 bg-nb-gray-900 text-nb-gray-400 hover:text-white"
                    }`}
                  >
                    {t("Nur Fehler", "Errors Only")}
                  </button>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-0.5 rounded bg-black/50 p-1.5 text-[8.5px] text-nb-gray-300 overscroll-contain select-text">
                  {filteredLines.length === 0 ? (
                    <div className="py-1 text-center text-nb-gray-500">
                      {t("Keine passenden Log-Zeilen", "No matching log lines")}
                    </div>
                  ) : (
                    filteredLines.map((line, idx) => (
                      <div
                        key={idx}
                        className={`truncate ${
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

        {domainEditorOpen[svc.service_id] && (
          <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5 text-[10px]">
            <div className="flex items-center justify-between font-mono text-[9px] text-nb-gray-400">
              <span>
                {t(
                  "Custom Domain & Auto-HTTPS",
                  "Custom Domain & Auto-HTTPS"
                )}
              </span>
              <span className="text-emerald-400">TLS 1.3</span>
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={
                  domainInputMap[svc.service_id] ??
                  domainBindings[svc.service_id]?.domain ??
                  `${svc.service_id}.synapse.local`
                }
                onChange={(e) =>
                  onChangeDomainInput(svc.service_id, e.target.value)
                }
                placeholder="app.example.com"
                className="flex-1 rounded border border-nb-gray-800 bg-nb-gray-940 px-2 py-1 font-mono text-[9.5px] text-white"
              />
              <button
                type="button"
                onClick={() => onSaveServiceDomain(svc)}
                className="rounded bg-emerald-600 px-2 py-1 font-mono text-[9px] font-semibold text-white hover:bg-emerald-500 transition"
              >
                {t("Speichern", "Save")}
              </button>
            </div>
            {domainNoticeMap[svc.service_id] && (
              <div className="text-[9px] text-emerald-400 font-mono">
                {domainNoticeMap[svc.service_id]}
              </div>
            )}
          </div>
        )}

        {chaosResultMap[svc.service_id] && (
          <div className="rounded-lg border border-amber-500/40 bg-nb-gray-950 p-2 space-y-1 font-mono text-[9px]">
            <div className="flex items-center justify-between">
              <span className="text-amber-300 font-semibold">
                ⚡ {t("Resilienz-Test", "Resilience Test")}
              </span>
              <span className="rounded bg-emerald-950 border border-emerald-500/40 px-1.5 py-0.5 text-[8.5px] text-emerald-300">
                MTTR: {chaosResultMap[svc.service_id].mttr_ms} ms
              </span>
            </div>
            {chaosResultMap[svc.service_id].steps.map((st, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-[8.5px] text-nb-gray-300"
              >
                <span className="truncate pr-1">
                  ✔ {translateText(st.step)}
                </span>
                <span className="text-nb-gray-400 shrink-0">
                  {st.elapsed_ms} ms
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-1.5 pt-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenReverseProxy(svc.port);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-netbird py-2 text-[11px] font-medium text-white hover:bg-netbird-500 transition"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>
              {t("Vorschau & Tester öffnen", "Open Preview & Tester")}
            </span>
          </button>
          {svc.healthy === false && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onHealService(svc.port);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-600 py-1.5 text-[11px] font-medium text-white hover:bg-red-500 transition"
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>{t("Auto-Heal starten", "Start Auto-Heal")}</span>
            </button>
          )}
        </div>
      </div>
    );
  }
);
