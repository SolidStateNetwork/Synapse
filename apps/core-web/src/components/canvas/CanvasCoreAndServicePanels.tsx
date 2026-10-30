"use client";

import React from "react";
import { Bot, KeyRound, Shield, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type {
  BlueprintItem,
  CartridgeMeta,
  RegisteredService,
} from "@/components/canvas/canvasTypes";

export {
  ServiceNodeInspectorPanel,
  type ServiceNodeInspectorPanelProps,
} from "./CanvasServiceInspectorPanel";

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
