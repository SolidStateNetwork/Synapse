"use client";

import React from "react";
import { Activity, ChevronDown, ChevronUp, Search } from "lucide-react";
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

export default function AuditLogView({
  filteredLogs,
  totalLogsCount,
  activitySearch,
  setActivitySearch,
  activityStatusFilter,
  setActivityStatusFilter,
  expandedAuditRows,
  setExpandedAuditRows,
}: AuditLogViewProps) {
  return (
    <div className="mx-auto max-w-6xl p-6 space-y-5">
      <SynapseViewHeader
        icon={<Activity className="h-5 w-5" />}
        accentColor="sky"
        title="Audit-Log & Sicherheits-Ereignisse"
        badgeText={`${filteredLogs.length} von ${totalLogsCount} Einträgen`}
        badgeTone="sky"
        description="Lückenlose Chronik aller KI-Aktionen, Benutzer-Befehle und blockierten Sicherheits-Richtlinien. Klicke auf eine Zeile, um die vollständigen Parameter und Ausgaben aufzuklappen."
      />

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
              <th className="py-3 px-3">Zeitstempel</th>
              <th className="py-3 px-3">Akteur</th>
              <th className="py-3 px-3">Tool / Ereignis</th>
              <th className="py-3 px-3">Zusammenfassung</th>
              <th className="py-3 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nb-gray-900 font-mono">
            {filteredLogs.map((log, i) => {
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
                    <td className="py-3 px-3 text-nb-gray-200 max-w-[420px] xl:max-w-[560px] truncate">
                      {log.summary}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span
                        className={`rounded border px-2 py-0.5 text-[10px] uppercase ${
                          log.status === "executed" || log.status === "approved"
                            ? "border-green-500/50 bg-green-950 text-green-400"
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
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
