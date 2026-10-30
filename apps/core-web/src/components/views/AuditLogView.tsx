"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Search,
  Zap,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { SelfHealingEventItem } from "@/components/canvas/canvasTypes";

import { AuditEntry } from "@/types/synapse";
import { SynapseViewHeader } from "@/components/ui/SynapseDesignSystem";

export interface AuditLogViewProps {
  filteredLogs: AuditEntry[];
  totalLogsCount: number;
  activitySearch: string;
  setActivitySearch: (val: string) => void;
  activityStatusFilter: string;
  setActivityStatusFilter: (val: string) => void;
  expandedAuditRows: Record<number, boolean>;
  setExpandedAuditRows: React.Dispatch<
    React.SetStateAction<Record<number, boolean>>
  >;
}

const AuditLogView = React.memo(function AuditLogView({
  filteredLogs,
  totalLogsCount,
  activitySearch,
  setActivitySearch,
  activityStatusFilter,
  setActivityStatusFilter,
  expandedAuditRows,
  setExpandedAuditRows,
}: AuditLogViewProps) {
  const { t } = useI18n();
  const [healingEvents, setHealingEvents] = useState<SelfHealingEventItem[]>(
    []
  );
  const [rerunBusyId, setRerunBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/service-ops")
      .then((r) => r.json())
      .then((d) => {
        if (d?.self_healing?.events) {
          setHealingEvents(d.self_healing.events);
        }
      })
      .catch(() => {});
  }, []);

  const avgMttr =
    healingEvents.length > 0
      ? Math.round(
          healingEvents.reduce((acc, ev) => acc + (ev.mttr_ms || 0), 0) /
            healingEvents.length
        )
      : 0;

  const handleRerunHeal = async (ev: SelfHealingEventItem) => {
    setRerunBusyId(ev.id);
    try {
      const res = await fetch("/api/service-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "self_heal",
          node_id: ev.node_id,
          service_id: ev.service_id,
          service_name: ev.service_name,
          port: ev.port,
        }),
      });
      const data = await res.json();
      if (data?.self_healing?.events) {
        setHealingEvents(data.self_healing.events);
      }
    } finally {
      setRerunBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-5">
      <SynapseViewHeader
        icon={<Activity className="h-5 w-5" />}
        accentColor="sky"
        title="Audit-Log & Sicherheits-Ereignisse"
        description="Lückenlose Chronik aller KI-Aktionen, Benutzer-Befehle und blockierten Sicherheits-Richtlinien. Klicke auf eine Zeile, um die vollständigen Parameter und Ausgaben aufzuklappen."
      />

      {/* v0.6.0: SELF-HEALING & INCIDENT CENTER */}
      <div className="rounded-xl border border-nb-gray-900 bg-nb-gray-940 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-950/70 text-emerald-400">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-white">
                {t(
                  "Self-Healing & Incident Center (v0.6.0)",
                  "Self-Healing & Incident Center (v0.6.0)"
                )}
              </h3>
              <p className="text-[11px] text-nb-gray-400">
                {t(
                  "Automatische Dienst-Wiederherstellungen mit MTTR-Statistik, Vorher/Nachher-Log-Snapshot und 1-Klick-Re-Run.",
                  "Automated service recoveries with MTTR metrics, pre/post log snapshots, and 1-click re-run."
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span className="rounded-md border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-1 text-emerald-300">
              {healingEvents.length} {t("Heilungen", "Recoveries")}
            </span>
            <span className="rounded-md border border-sky-500/40 bg-sky-950/60 px-2.5 py-1 text-sky-300">
              Ø MTTR: {avgMttr} ms
            </span>
          </div>
        </div>

        {healingEvents.length > 0 && (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {healingEvents.slice(0, 4).map((ev) => (
              <div
                key={ev.id}
                className="rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-3 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-white">
                      ⚡ {ev.service_name} (:{ev.port})
                    </div>
                    <div className="font-mono text-[10px] text-nb-gray-400">
                      {ev.node_id} · {ev.trigger} ·{" "}
                      {ev.timestamp.replace("T", " ").slice(0, 19)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="rounded border border-emerald-500/40 bg-emerald-950 px-1.5 py-0.5 font-mono text-[9.5px] text-emerald-300">
                      {ev.mttr_ms} ms · HTTP {ev.http_status}
                    </span>
                    <button
                      type="button"
                      disabled={rerunBusyId === ev.id}
                      onClick={() => void handleRerunHeal(ev)}
                      className="inline-flex items-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-900 px-2 py-0.5 font-mono text-[9.5px] text-nb-gray-200 hover:border-netbird hover:text-white transition"
                    >
                      <RotateCcw
                        className={`h-3 w-3 text-netbird ${
                          rerunBusyId === ev.id ? "animate-spin" : ""
                        }`}
                      />
                      <span>Re-Run</span>
                    </button>
                  </div>
                </div>
                {ev.log_snapshot && ev.log_snapshot.length > 0 && (
                  <div className="rounded bg-black/50 p-2 font-mono text-[9.5px] text-nb-gray-300 truncate">
                    {ev.log_snapshot[ev.log_snapshot.length - 1]}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-nb-gray-900 bg-nb-gray-940 p-3">
        <div className="flex flex-1 items-center gap-2">
          <Search className="h-4 w-4 text-nb-gray-400 ml-1" />
          <input
            type="text"
            value={activitySearch}
            onChange={(e) => setActivitySearch(e.target.value)}
            placeholder="Audit-Events nach Tool, Server oder Zusammenfassung durchsuchen (Klick auf Zeile erweitert Details)..."
            className="flex-1 bg-transparent text-xs text-white placeholder:text-nb-gray-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {[
            { id: "ALL", label: "Alle" },
            { id: "executed", label: "Ausgeführt" },
            { id: "blocked", label: "Blockiert" },
            { id: "requires_approval", label: "Freigabe nötig" },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setActivityStatusFilter(st.id)}
              className={`rounded-lg border px-2.5 py-1 font-mono text-[10px] font-medium transition ${
                activityStatusFilter === st.id
                  ? "border-netbird-500 bg-netbird-950 text-netbird"
                  : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-300 hover:text-white"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-nb-gray-900 bg-nb-gray-940">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-nb-gray-900 bg-nb-gray-930/70 text-[11px] font-medium uppercase text-nb-gray-400">
            <tr>
              <th className="py-3 px-3 whitespace-nowrap">Zeitstempel</th>
              <th className="py-3 px-3 whitespace-nowrap">Akteur</th>
              <th className="py-3 px-3 whitespace-nowrap">Tool / Ereignis</th>
              <th className="py-3 px-3 w-full">Zusammenfassung</th>
              <th className="py-3 px-3 text-right whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nb-gray-900 font-mono">
            {filteredLogs.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 px-4 text-center font-sans text-xs text-nb-gray-400"
                >
                  Keine passenden Audit-Einträge für diesen Filter gefunden.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log, i) => {
                const isExpanded = Boolean(expandedAuditRows[i]);
                return (
                  <React.Fragment key={i}>
                    <tr
                      onClick={() =>
                        setExpandedAuditRows((prev) => ({
                          ...prev,
                          [i]: !prev[i],
                        }))
                      }
                      className="cursor-pointer hover:bg-nb-gray-930/50 transition-colors"
                    >
                      <td className="py-3 px-3 text-nb-gray-400 whitespace-nowrap">
                        {log.timestamp.replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="py-3 px-3 text-nb-gray-200 whitespace-nowrap">
                        {log.actor}
                      </td>
                      <td className="py-3 px-3 text-netbird whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <span>{log.tool_name}</span>
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3 text-nb-gray-400" />
                          ) : (
                            <ChevronDown className="h-3 w-3 text-nb-gray-400" />
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-nb-gray-200 w-full max-w-0 truncate">
                        {log.summary}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span
                          className={`inline-block rounded border px-2 py-0.5 text-[10px] uppercase ${
                            log.status === "executed" ||
                            log.status === "approved"
                              ? "border-emerald-500/50 bg-emerald-950 text-emerald-400"
                              : log.status === "blocked" ||
                                  log.status === "rejected" ||
                                  log.status === "error"
                                ? "border-red-500/50 bg-red-950 text-red-400"
                                : "border-netbird-500/50 bg-netbird-950 text-netbird"
                          }`}
                        >
                          {log.status === "executed"
                            ? "Ausgeführt"
                            : log.status === "approved"
                              ? "Freigegeben"
                              : log.status === "blocked"
                                ? "Blockiert"
                                : log.status === "rejected"
                                  ? "Abgelehnt"
                                  : log.status === "error"
                                    ? "Blockiert"
                                    : log.status === "requires_approval"
                                      ? "Freigabe nötig"
                                      : log.status}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-nb-gray-950/80">
                        <td colSpan={5} className="p-4">
                          <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-940 p-3 space-y-2 text-[11px]">
                            <div className="flex items-center justify-between text-nb-gray-400">
                              <span>
                                Vollständiger Audit-Eintrag ({log.tool_name})
                              </span>
                              <span>{log.timestamp}</span>
                            </div>
                            <div className="text-white whitespace-pre-wrap">
                              {log.summary}
                            </div>
                            {log.args && (
                              <pre className="overflow-x-auto rounded bg-nb-gray-960 p-2.5 text-[10px] text-emerald-300">
                                {JSON.stringify(log.args, null, 2)}
                              </pre>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default AuditLogView;
