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
  emerald:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.12)]",
  indigo:
    "border-indigo-500/30 bg-indigo-500/10 text-indigo-400 shadow-[0_0_24px_rgba(99,102,241,0.12)]",
  amber:
    "border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-[0_0_24px_rgba(245,158,11,0.12)]",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-400 shadow-[0_0_24px_rgba(14,165,233,0.12)]",
  purple:
    "border-purple-500/30 bg-purple-500/10 text-purple-400 shadow-[0_0_24px_rgba(168,85,247,0.12)]",
  rose:
    "border-rose-500/30 bg-rose-500/10 text-rose-400 shadow-[0_0_24px_rgba(244,63,94,0.12)]",
};

const BADGE_TONE_CLASSES: Record<
  NonNullable<SynapseViewHeaderProps["badgeTone"]>,
  string
> = {
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  indigo: "border-indigo-500/30 bg-indigo-500/10 text-indigo-300",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  purple: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-300",
  slate: "border-[#273142] bg-[#161c26] text-slate-300",
};

/**
 * Unified top header card used across all 8 secondary menus in the Synapse Control Center
 * so every screen looks visually cohesive ("aus einem Guß") and explains its purpose clearly.
 */
export function SynapseViewHeader({
  icon,
  accentColor = "indigo",
  title,
  badgeText,
  badgeTone = "indigo",
  description,
  actions,
  subTabs,
}: SynapseViewHeaderProps) {
  return (
    <div className="rounded-2xl border border-[#1f2633] bg-gradient-to-b from-[#131822] to-[#0f131b] p-5 shadow-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${ACCENT_BOX_CLASSES[accentColor]}`}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-bold tracking-tight text-white">
                {title}
              </h2>
              {badgeText && (
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${BADGE_TONE_CLASSES[badgeTone]}`}
                >
                  {badgeText}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {description}
            </p>
          </div>
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 sm:pt-0.5">
            {actions}
          </div>
        )}
      </div>

      {subTabs && (
        <div className="mt-4 pt-3.5 border-t border-[#1e2636] flex flex-wrap items-center justify-between gap-3">
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
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#1f2735] bg-[#0b0e14] p-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              isActive
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm"
                : "border border-transparent text-slate-400 hover:bg-[#151b26] hover:text-slate-200"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  isActive
                    ? "bg-indigo-500/30 text-indigo-200"
                    : "bg-[#1a2130] text-slate-400"
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
      ? "border-emerald-500/25 bg-emerald-950/10"
      : tone === "indigo"
        ? "border-indigo-500/25 bg-indigo-950/10"
        : tone === "amber"
          ? "border-amber-500/25 bg-amber-950/10"
          : tone === "rose"
            ? "border-rose-500/25 bg-rose-950/10"
            : "border-[#1f2633] bg-[#131822]";

  return (
    <div className={`rounded-xl border p-4 ${toneBorder}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        {icon && <span className="text-slate-400">{icon}</span>}
      </div>
      <div className="mt-1.5 text-xl font-bold text-white">{value}</div>
      {subtext && <p className="mt-0.5 text-[11px] text-slate-400">{subtext}</p>}
    </div>
  );
}
