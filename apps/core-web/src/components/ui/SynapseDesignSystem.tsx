"use client";

import React from "react";

export interface SynapseSubTabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
  badgeTone?: "emerald" | "indigo" | "amber" | "rose" | "slate";
}

export interface SynapseViewHeaderProps {
  icon: React.ReactNode;
  accentColor?: "emerald" | "indigo" | "amber" | "sky" | "purple" | "rose";
  title: string;
  badgeText?: string;
  badgeTone?: "emerald" | "indigo" | "amber" | "sky" | "purple" | "rose" | "slate";
  description: string;
  actions?: React.ReactNode;
  subTabs?: React.ReactNode;
}

const ACCENT_BOX_CLASSES: Record<
  NonNullable<SynapseViewHeaderProps["accentColor"]>,
  string
> = {
  emerald: "border-emerald-500/35 bg-emerald-950/60 text-emerald-400",
  indigo: "border-netbird-500/40 bg-netbird-950 text-netbird",
  amber: "border-amber-500/35 bg-amber-950/60 text-amber-400",
  sky: "border-sky-500/35 bg-sky-950/60 text-sky-400",
  purple: "border-netbird-500/40 bg-netbird-950 text-netbird",
  rose: "border-red-500/35 bg-red-950/60 text-red-400",
};

const BADGE_TONE_CLASSES: Record<
  NonNullable<SynapseViewHeaderProps["badgeTone"]>,
  string
> = {
  emerald: "border-emerald-500/35 bg-emerald-950/60 text-emerald-300",
  indigo: "border-netbird-500/40 bg-netbird-950 text-netbird",
  amber: "border-amber-500/35 bg-amber-950/60 text-amber-300",
  sky: "border-sky-500/35 bg-sky-950/60 text-sky-300",
  purple: "border-netbird-500/40 bg-netbird-950 text-netbird",
  rose: "border-red-500/35 bg-red-950/60 text-red-300",
  slate: "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-300",
};

/**
 * Unified top header card used across all 8 secondary menus in the Synapse Control Center
 * so every screen looks visually cohesive ("aus einem Guß") and explains its purpose clearly.
 */
export function SynapseViewHeader({
  icon,
  accentColor = "indigo",
  title,
  description,
  actions,
  subTabs,
}: SynapseViewHeaderProps) {
  return (
    <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-5 shadow-lg">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${ACCENT_BOX_CLASSES[accentColor]}`}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold tracking-tight text-white">
              {title}
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-nb-gray-400">
              {description}
            </p>
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>

      {subTabs && (
        <div className="mt-4 pt-3.5 border-t border-nb-gray-850 flex flex-wrap items-center justify-between gap-3">
          {subTabs}
        </div>
      )}
    </div>
  );
}

export function SynapseSubTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: SynapseSubTabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              isActive
                ? "border border-netbird-500/40 bg-netbird-950 text-netbird shadow-sm"
                : "border border-transparent text-nb-gray-400 hover:bg-nb-gray-920 hover:text-nb-gray-200"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  isActive
                    ? "bg-netbird/20 text-netbird"
                    : "bg-nb-gray-900 text-nb-gray-400"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function SynapseStatCard({
  label,
  value,
  subtext,
  icon,
  tone = "slate",
}: {
  label: string;
  value: React.ReactNode;
  subtext?: string;
  icon?: React.ReactNode;
  tone?: "emerald" | "indigo" | "amber" | "rose" | "slate";
}) {
  const toneBorder =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-950/20"
      : tone === "indigo"
        ? "border-netbird-500/30 bg-netbird-950/20"
        : tone === "amber"
          ? "border-amber-500/30 bg-amber-950/20"
          : tone === "rose"
            ? "border-red-500/30 bg-red-950/20"
            : "border-nb-gray-800 bg-nb-gray-940";

  return (
    <div className={`rounded-xl border p-4 ${toneBorder}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-nb-gray-400">
          {label}
        </span>
        {icon && <span className="text-nb-gray-400">{icon}</span>}
      </div>
      <div className="mt-1.5 text-xl font-bold text-white">{value}</div>
      {subtext && <p className="mt-0.5 text-[11px] text-nb-gray-400">{subtext}</p>}
    </div>
  );
}
