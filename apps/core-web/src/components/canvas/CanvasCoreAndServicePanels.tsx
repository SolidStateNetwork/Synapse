"use client";

import React from "react";
import {
  ArrowLeftRight,
  Bot,
  ChevronRight,
  Cpu,
  FileText,
  Globe,
  KeyRound,
  Link2,
  Lock,
  Plus,
  Server,
  Shield,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type {
  BlueprintItem,
  CartridgeMeta,
  ChaosResultState,
  DomainBindingItem,
  RegisteredService,
  ServiceMeshLink,
} from "@/components/canvas/canvasTypes";

export interface CoreHubInspectorPanelProps {
  modelName: string;
  baseUrl: string;
  authEnabled: boolean;
  authRole: "admin" | "operator";
  activeCartridges: string[];
  cartridges: CartridgeMeta[];
  secretKeysCount: number;
  blueprints: BlueprintItem[];
  blueprintBusyId: string | null;
  blueprintNotice: string | null;
  allServices: RegisteredService[];
  onOpenSettings?: (focusSection?: string) => void;
  onOpenBrainDoc: (doc: "Architecture.md" | "Memory.md") => void;
  onToggleCartridge: (id: string) => void;
  onDeployBlueprint: (bp: BlueprintItem, action: "deploy" | "undeploy") => void;
  onOpenAiSettings: () => void;
  onOpenSecretsVault: () => void;
  onOpenAccessControl: () => void;
}

export const CoreHubInspectorPanel = React.memo(function CoreHubInspectorPanel({
  modelName,
  baseUrl,
  authEnabled,
  authRole,
  activeCartridges,
  cartridges,
  secretKeysCount,
  blueprints,
  blueprintBusyId,
  blueprintNotice,
  allServices,
  onOpenSettings,
  onOpenBrainDoc,
  onToggleCartridge,
  onDeployBlueprint,
  onOpenAiSettings,
  onOpenSecretsVault,
  onOpenAccessControl,
}: CoreHubInspectorPanelProps) {
  const { t, translateText } = useI18n();

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-3 space-y-2.5 border-t border-nb-gray-800/90 pt-2.5 text-[11px]"
    >
      {/* 1. CLEAN KEY-VALUE OVERVIEW BOX */}
      <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2.5 space-y-1.5">
        <div className="flex items-center justify-between text-nb-gray-400">
          <span>{t("Aktives KI-Modell", "Active AI Model")}</span>
          <span className="font-mono text-[10.5px] font-semibold text-netbird">
            {modelName}
          </span>
        </div>
        <div className="flex items-center justify-between text-nb-gray-400 gap-2">
          <span className="shrink-0">
            {t("API-Endpunkt", "API Endpoint")}
          </span>
          <span className="truncate font-mono text-[10px] text-nb-gray-300">
            {baseUrl.replace(/^https?:\/\//, "")}
          </span>
        </div>
        <div className="flex items-center justify-between text-nb-gray-400">
          <span>{t("Wächter & Alarme", "Watchdog & Alerts")}</span>
          <button
            type="button"
            onClick={() => onOpenSettings?.("watchdog-rbac")}
            className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
          >
            <span>
              {authEnabled
                ? t("RBAC aktiv", "RBAC active")
                : t("Konfigurieren", "Configure")}
            </span>
          </button>
        </div>
        <div className="pt-1 border-t border-nb-gray-800/70 flex items-center justify-between gap-2">
          <span className="text-nb-gray-400 shrink-0">
            {t("Brain-Dokumente", "Brain Docs")}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onOpenBrainDoc("Architecture.md")}
              className="rounded border border-nb-gray-800 bg-nb-gray-900 px-2 py-0.5 font-mono text-[9.5px] text-nb-gray-200 hover:border-netbird hover:text-white transition"
            >
              Arch.md
            </button>
            <button
              type="button"
              onClick={() => onOpenBrainDoc("Memory.md")}
              className="rounded border border-nb-gray-800 bg-nb-gray-900 px-2 py-0.5 font-mono text-[9.5px] text-nb-gray-200 hover:border-netbird hover:text-white transition"
            >
              Memory.md
            </button>
          </div>
        </div>
      </div>

      {/* 2. SECURITY CARTRIDGES TOGGLE LIST */}
      <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] leading-none uppercase tracking-wider text-nb-gray-300">
            <Shield className="h-3 w-3 shrink-0 text-emerald-400" />
            <span>{t("Sicherheits-Cartridges", "Security Cartridges")}</span>
          </span>
          <span className="font-mono text-[9px] leading-none text-emerald-400">
            {activeCartridges.length}/{cartridges.length} {t("aktiv", "active")}
          </span>
        </div>
        <div className="space-y-1">
          {cartridges.map((c) => {
            const enabled = activeCartridges.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onToggleCartridge(c.id)}
                className="flex w-full items-center justify-between rounded border border-nb-gray-800/80 bg-nb-gray-940/70 px-2 py-1 text-[10px] hover:border-nb-gray-700 transition"
              >
                <span className="truncate text-nb-gray-200 pr-2">
                  {translateText(c.name)}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[8.5px] font-semibold ${
                    enabled
                      ? "border border-emerald-500/30 bg-emerald-950 text-emerald-400"
                      : "bg-nb-gray-900 text-nb-gray-500"
                  }`}
                >
                  {enabled ? t("AKTIV", "ON") : t("AUS", "OFF")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. 1-CLICK BLUEPRINT CATALOG */}
      {blueprints.length > 0 && (
        <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] leading-none uppercase tracking-wider text-nb-gray-300">
              <Sparkles className="h-3 w-3 shrink-0 text-sky-400" />
              <span>{t("1-Click Blueprints", "1-Click Blueprints")}</span>
            </span>
            <span className="font-mono text-[9px] leading-none text-nb-gray-400">
              {blueprints.length} {t("Vorlagen", "Templates")}
            </span>
          </div>
          {blueprintNotice && (
            <div className="rounded bg-emerald-950/70 border border-emerald-500/40 px-2 py-1 text-[9.5px] text-emerald-300">
              {blueprintNotice}
            </div>
          )}
          <div className="space-y-1">
            {blueprints.map((bp) => {
              const isDeployed = allServices.some(
                (s) => s.service_id === bp.id || s.port === bp.port
              );
              return (
                <div
                  key={bp.id}
                  className="flex items-center justify-between gap-1.5 rounded border border-nb-gray-800/80 bg-nb-gray-940/70 px-2 py-1 text-[9.5px]"
                >
                  <div className="min-w-0 flex-1 pr-1">
                    <div className="truncate font-medium text-nb-gray-200">
                      {translateText(bp.name)}
                    </div>
                    <div className="truncate text-[8.5px] text-nb-gray-400">
                      {translateText(bp.description)}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={
                      blueprintBusyId === bp.id || authRole === "operator"
                    }
                    onClick={() =>
                      onDeployBlueprint(
                        bp,
                        isDeployed ? "undeploy" : "deploy"
                      )
                    }
                    className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[8.5px] font-semibold transition ${
                      isDeployed
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40"
                        : "border-sky-500/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25"
                    } disabled:opacity-50`}
                  >
                    {blueprintBusyId === bp.id
                      ? "..."
                      : isDeployed
                      ? t("Stoppen", "Stop")
                      : t("Starten", "Deploy")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. UNIFIED 3-BUTTON FOOTER BAR */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenAiSettings}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-netbird py-1.5 text-[11px] font-medium text-white hover:bg-netbird-500 transition"
        >
          <Bot className="h-3 w-3" />
          <span>{t("KI-Modell", "AI Model")}</span>
        </button>
        <button
          type="button"
          onClick={onOpenSecretsVault}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-nb-gray-800 bg-nb-gray-950 py-1.5 text-[11px] text-nb-gray-200 hover:text-white transition"
        >
          <KeyRound className="h-3 w-3 text-amber-400" />
          <span>
            {t(`Tresor (${secretKeysCount})`, `Vault (${secretKeysCount})`)}
          </span>
        </button>
        <button
          type="button"
          onClick={onOpenAccessControl}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
        >
          <Shield className="h-3 w-3 text-emerald-400" />
          <span>{t("Regeln", "Rules")}</span>
        </button>
      </div>
    </div>
  );
});

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
  onTailServiceLogs: (svc: RegisteredService) => void;
  onToggleDomainEditor: (serviceId: string) => void;
  onChangeDomainInput: (serviceId: string, value: string) => void;
  onSaveServiceDomain: (svc: RegisteredService) => void;
  onRunChaosTest: (svc: RegisteredService) => void;
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
  }: ServiceNodeInspectorPanelProps) {
    const { t, translateText } = useI18n();

    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className="mt-3 space-y-2.5 border-t border-nb-gray-800/90 pt-2.5 text-[11px]"
      >
        {/* FEATURE 1: AUTO-DISCOVERY RUNTIME & CONTAINER BADGES */}
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

        {/* FEATURE 6: SERVICE-TO-SERVICE MESH LINKS */}
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

        {/* ROUND-2 FEATURES 2, 5, 6: LIVE-LOGS TAIL, CUSTOM DOMAIN/TLS & CHAOS-TEST */}
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

        {/* ROUND-2 FEATURE 2: INLINE LIVE LOGS TAIL CONSOLE */}
        {serviceLogsMap[svc.service_id]?.open && (
          <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 font-mono text-[9px] space-y-1">
            <div className="flex items-center justify-between text-nb-gray-400">
              <span>{t("Letzte Log-Zeilen", "Recent Log Lines")}</span>
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
            </div>
            <div className="max-h-32 overflow-y-auto space-y-0.5 rounded bg-black/50 p-1.5 text-[8.5px] text-nb-gray-300 overscroll-contain">
              {serviceLogsMap[svc.service_id].lines
                .slice(-40)
                .map((line, idx) => (
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
                ))}
            </div>
          </div>
        )}

        {/* ROUND-2 FEATURE 5: INLINE CUSTOM DOMAIN & AUTO-HTTPS EDITOR */}
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

        {/* ROUND-2 FEATURE 6: INLINE CHAOS-ENGINEERING RESILIENCE STOPWATCH REPORT */}
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
                <span className="truncate pr-1">✔ {translateText(st.step)}</span>
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
