"use client";

import React from "react";
import { Code2, Database, ExternalLink, Globe, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { safeFetchJson } from "@/lib/safeFetch";
import type { ProjectState, RegisteredServiceItem } from "@/types/synapse";

export interface ReverseProxyCodeAndSqliteStudiosProps {
  v070Mode: "workbench" | "hot-reload" | "sqlite-studio";
  setV070Mode: React.Dispatch<
    React.SetStateAction<"workbench" | "hot-reload" | "sqlite-studio">
  >;
  activeSvc: RegisteredServiceItem;
  activeExtUrl: string;
  serviceWorkspaceTab: "split" | "preview" | "tester";
  setServiceWorkspaceTab: (tab: "split" | "preview" | "tester") => void;
  activeProject: ProjectState | null;
  primaryNode: string;
  codePath: string;
  setCodePath: (val: string) => void;
  codeText: string;
  setCodeText: (val: string) => void;
  codeLoading: boolean;
  setCodeLoading: (val: boolean) => void;
  codeSaving: boolean;
  setCodeSaving: (val: boolean) => void;
  codeNotice: string | null;
  setCodeNotice: (val: string | null) => void;
  dbPathInput: string;
  setDbPathInput: (val: string) => void;
  dbTables: string[];
  setDbTables: (val: string[]) => void;
  activeDbTable: string;
  setActiveDbTable: (val: string) => void;
  dbColumns: string[];
  setDbColumns: (val: string[]) => void;
  dbRows: Array<Record<string, unknown>>;
  setDbRows: (val: Array<Record<string, unknown>>) => void;
  dbRowCount: number;
  setDbRowCount: (val: number) => void;
  dbCustomSql: string;
  setDbCustomSql: (val: string) => void;
  dbNewEventVal: string;
  setDbNewEventVal: (val: string) => void;
  dbNewSourceVal: string;
  setDbNewSourceVal: (val: string) => void;
  dbBusy: boolean;
  setDbBusy: (val: boolean) => void;
}

export function ReverseProxyCodeAndSqliteStudios({
  v070Mode,
  setV070Mode,
  activeSvc,
  activeExtUrl,
  serviceWorkspaceTab,
  setServiceWorkspaceTab,
  activeProject,
  primaryNode,
  codePath,
  setCodePath,
  codeText,
  setCodeText,
  codeLoading,
  setCodeLoading,
  codeSaving,
  setCodeSaving,
  codeNotice,
  setCodeNotice,
  dbPathInput,
  setDbPathInput,
  dbTables,
  setDbTables,
  activeDbTable,
  setActiveDbTable,
  dbColumns,
  setDbColumns,
  dbRows,
  setDbRows,
  dbRowCount,
  setDbRowCount,
  dbCustomSql,
  setDbCustomSql,
  dbNewEventVal,
  setDbNewEventVal,
  dbNewSourceVal,
  setDbNewSourceVal,
  dbBusy,
  setDbBusy,
}: ReverseProxyCodeAndSqliteStudiosProps) {
  const { t } = useI18n();
  const projectId = activeProject?.project_id || "default-project";
  const resolvedNodeId = activeSvc.node_id || primaryNode || "local-node";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-nb-gray-800/80 bg-nb-gray-930/70 px-5 py-3">
        <div className="flex flex-wrap min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-sm font-semibold text-white">
            {activeSvc.name
              .replace(new RegExp(`\\s*:${activeSvc.port}\\b`), "")
              .trim()}
          </span>
          <span className="shrink-0 rounded-md border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 font-mono text-[11px] text-nb-gray-300">
            {activeSvc.node_id}:{activeSvc.port}
          </span>

          <a
            href={activeExtUrl}
            target="_blank"
            rel="noreferrer"
            title={activeExtUrl}
            className="group flex min-w-0 items-center gap-2 rounded-lg border border-nb-gray-800/90 bg-nb-gray-950/90 px-2.5 py-1 font-mono text-[11px] text-nb-gray-300 transition hover:border-netbird/50 hover:text-white"
          >
            <Globe className="h-3.5 w-3.5 shrink-0 text-netbird" />
            <span className="truncate max-w-[460px] xl:max-w-[580px]">
              {activeExtUrl}
            </span>
            <span className="flex shrink-0 items-center gap-1 rounded bg-netbird/15 px-1.5 py-0.5 font-sans text-[10px] font-medium text-netbird group-hover:bg-netbird group-hover:text-white transition-colors">
              <span>Extern</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </span>
          </a>
        </div>

        <div className="flex shrink-0 items-center rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-1">
          {[
            { id: "tester", label: "API- & DB-Tester", icon: Code2 },
            { id: "preview", label: "Web-Vorschau", icon: Globe },
          ].map((mode) => {
            const ModeIcon = mode.icon;
            const active = serviceWorkspaceTab === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() =>
                  setServiceWorkspaceTab(
                    mode.id as "split" | "preview" | "tester"
                  )
                }
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? "bg-netbird text-white shadow-sm"
                    : "text-nb-gray-400 hover:text-white"
                }`}
              >
                <ModeIcon className="h-3.5 w-3.5" />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-nb-gray-800/80 bg-nb-gray-950/60 px-5 py-2 text-xs">
        <span className="font-mono text-[10.5px] text-nb-gray-400">
          {t(
            "v0.5.0 Developer Workbench · API-Tester, Live Code Hot-Reload & Interactive SQLite Data Studio",
            "v0.5.0 Developer Workbench · API Tester, Live Code Hot-Reload & Interactive SQLite Data Studio"
          )}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setV070Mode("workbench")}
            className={`rounded-md border px-2.5 py-1 font-mono text-[10.5px] font-medium transition ${
              v070Mode === "workbench"
                ? "border-netbird bg-netbird/20 text-white"
                : "border-nb-gray-800 bg-nb-gray-940 text-nb-gray-400 hover:text-white"
            }`}
          >
            {t("⚡ API- & Web-Tester", "⚡ API & Web Tester")}
          </button>
          <button
            type="button"
            onClick={async () => {
              setV070Mode("hot-reload");
              setCodeLoading(true);
              setCodeNotice(null);
              try {
                const r = await safeFetchJson("/api/service-ops", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "get_service_code",
                    project_id: projectId,
                    node_id: resolvedNodeId,
                    service_id: activeSvc.service_id,
                    port: activeSvc.port,
                  }),
                });
                const d = await r.json();
                if (d.ok) {
                  setCodePath(d.file_path || "");
                  setCodeText(d.code || "");
                }
              } finally {
                setCodeLoading(false);
              }
            }}
            className={`rounded-md border px-2.5 py-1 font-mono text-[10.5px] font-medium transition ${
              v070Mode === "hot-reload"
                ? "border-amber-500/60 bg-amber-950/70 text-amber-300"
                : "border-nb-gray-800 bg-nb-gray-940 text-nb-gray-400 hover:text-white"
            }`}
          >
            {t("🔥 Code & Hot-Reload", "🔥 Code & Hot-Reload")}
          </button>
          <button
            type="button"
            onClick={async () => {
              setV070Mode("sqlite-studio");
              setDbBusy(true);
              try {
                const targetDb = activeSvc.db_path || dbPathInput;
                setDbPathInput(targetDb);
                const r = await safeFetchJson("/api/service-ops", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "sqlite_studio",
                    project_id: projectId,
                    node_id: resolvedNodeId,
                    db_path: targetDb,
                    table: activeDbTable,
                  }),
                });
                const d = await r.json();
                if (d.ok) {
                  setDbTables(d.tables || ["events"]);
                  setActiveDbTable(d.active_table || "events");
                  setDbColumns(d.columns || []);
                  setDbRows(d.rows || []);
                  setDbRowCount(d.row_count || 0);
                }
              } finally {
                setDbBusy(false);
              }
            }}
            className={`rounded-md border px-2.5 py-1 font-mono text-[10.5px] font-medium transition ${
              v070Mode === "sqlite-studio"
                ? "border-sky-500/60 bg-sky-950/70 text-sky-300"
                : "border-nb-gray-800 bg-nb-gray-940 text-nb-gray-400 hover:text-white"
            }`}
          >
            {t("🗄️ SQLite Data Studio", "🗄️ SQLite Data Studio")}
          </button>
        </div>
      </div>

      {v070Mode === "hot-reload" && (
        <div className="p-5 space-y-3.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-white">
                {t(
                  `Live Service Code-Editor & Hot-Reload — ${activeSvc.name}`,
                  `Live Service Code Editor & Hot-Reload — ${activeSvc.name}`
                )}
              </div>
              <div className="font-mono text-[11px] text-nb-gray-400">
                {activeSvc.node_id}:{activeSvc.port} ·{" "}
                {codePath ||
                  `/var/lib/synapse/services/${activeSvc.service_id}/server_${activeSvc.port}.py`}
              </div>
            </div>
            <button
              type="button"
              disabled={codeLoading || codeSaving}
              onClick={async () => {
                if (!codeText.trim()) return;
                setCodeSaving(true);
                setCodeNotice(null);
                try {
                  const r = await safeFetchJson("/api/service-ops", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "hot_reload_service_code",
                      project_id: projectId,
                      node_id: resolvedNodeId,
                      service_id: activeSvc.service_id,
                      port: activeSvc.port,
                      file_path: codePath,
                      code: codeText,
                    }),
                  });
                  const d = await r.json();
                  if (d.ok) {
                    if (d.healthy === false || d.http_status >= 500) {
                      setCodeNotice(
                        t(
                          `⚠️ Syntax-/Start-Fehler erkannt — Automatischer Rollback auf letzte stabile Version aktiv (Snapshot ${d.snapshot_id})!`,
                          `⚠️ Syntax/startup error detected — automatic rollback to last stable version active (Snapshot ${d.snapshot_id})!`
                        )
                      );
                    } else {
                      setCodeNotice(
                        t(
                          `🔥 Hot-Reload auf :${d.port} in ${d.elapsed_ms} ms aktiv (Snapshot ${d.snapshot_id}, HTTP ${d.http_status})!`,
                          `🔥 Hot-Reload active on :${d.port} in ${d.elapsed_ms} ms (Snapshot ${d.snapshot_id}, HTTP ${d.http_status})!`
                        )
                      );
                    }
                  }
                } finally {
                  setCodeSaving(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-netbird px-4 py-2 text-xs font-semibold text-white hover:bg-netbird-500 disabled:opacity-50 transition"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>
                {codeSaving
                  ? t("Hot-Reload läuft...", "Hot-Reloading...")
                  : t("Save & Hot-Reload", "Save & Hot-Reload")}
              </span>
            </button>
          </div>
          {codeNotice && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-3 py-2 font-mono text-[11px] text-emerald-300">
              {codeNotice}
            </div>
          )}
          <textarea
            rows={14}
            value={
              codeLoading
                ? t(
                    "Lade Quellcode vom Muscle-Server...",
                    "Loading source code from Muscle server..."
                  )
                : codeText
            }
            onChange={(e) => setCodeText(e.target.value)}
            disabled={codeLoading}
            className="w-full rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-3.5 font-mono text-xs leading-relaxed text-nb-gray-100 focus:border-netbird focus:outline-none"
          />
        </div>
      )}

      {v070Mode === "sqlite-studio" && (
        <div className="p-5 space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-sky-400" />
              <span className="font-semibold text-white">
                {t(
                  "Interactive SQLite Data Studio (v0.7.0)",
                  "Interactive SQLite Data Studio (v0.7.0)"
                )}
              </span>
              <span className="rounded border border-sky-500/40 bg-sky-950/70 px-2 py-0.5 font-mono text-[10px] text-sky-300">
                {dbRowCount} {t("Zeilen", "Rows")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {dbTables.map((tbl) => (
                <button
                  key={tbl}
                  type="button"
                  onClick={async () => {
                    setActiveDbTable(tbl);
                    setDbBusy(true);
                    try {
                      const r = await safeFetchJson("/api/service-ops", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "sqlite_studio",
                          project_id: projectId,
                          node_id: resolvedNodeId,
                          db_path: dbPathInput,
                          table: tbl,
                        }),
                      });
                      const d = await r.json();
                      if (d.ok) {
                        setDbColumns(d.columns || []);
                        setDbRows(d.rows || []);
                        setDbRowCount(d.row_count || 0);
                      }
                    } finally {
                      setDbBusy(false);
                    }
                  }}
                  className={`rounded-md border px-2.5 py-1 font-mono text-[10.5px] transition ${
                    activeDbTable === tbl
                      ? "border-sky-500 bg-sky-950 text-sky-300 font-semibold"
                      : "border-nb-gray-800 bg-nb-gray-950 text-nb-gray-400 hover:text-white"
                  }`}
                >
                  📋 {tbl}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(dbRows, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${activeDbTable}-export.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="rounded-md border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1 font-mono text-[10.5px] text-nb-gray-300 hover:text-white"
              >
                ⬇ JSON Export
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
            <input
              type="text"
              value={dbNewEventVal}
              onChange={(e) => setDbNewEventVal(e.target.value)}
              placeholder={t(
                "Event-Name (z.B. deploy_ok)",
                "Event name (e.g. deploy_ok)"
              )}
              className="sm:col-span-4 rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-1.5 font-mono text-xs text-white"
            />
            <input
              type="text"
              value={dbNewSourceVal}
              onChange={(e) => setDbNewSourceVal(e.target.value)}
              placeholder="Source"
              className="sm:col-span-2 rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-1.5 font-mono text-xs text-nb-gray-300"
            />
            <input
              type="text"
              value={dbCustomSql}
              onChange={(e) => setDbCustomSql(e.target.value)}
              placeholder="SQL-Abfrage (optional)"
              className="sm:col-span-3 rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-1.5 font-mono text-xs text-sky-300"
            />
            <button
              type="button"
              disabled={dbBusy}
              onClick={async () => {
                setDbBusy(true);
                try {
                  const r = await safeFetchJson("/api/service-ops", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "sqlite_studio",
                      project_id: projectId,
                      node_id: resolvedNodeId,
                      db_path: dbPathInput,
                      table: activeDbTable,
                      custom_sql: dbCustomSql.trim() || undefined,
                      insert_row: dbNewEventVal.trim()
                        ? activeDbTable === "metrics"
                          ? {
                              metric_key: dbNewEventVal.trim(),
                              metric_val: "1.0",
                            }
                          : {
                              event: dbNewEventVal.trim(),
                              source: dbNewSourceVal.trim() || "studio",
                            }
                        : undefined,
                    }),
                  });
                  const d = await r.json();
                  if (d.ok) {
                    setDbColumns(d.columns || []);
                    setDbRows(d.rows || []);
                    setDbRowCount(d.row_count || 0);
                    setDbNewEventVal("");
                  }
                } finally {
                  setDbBusy(false);
                }
              }}
              className="sm:col-span-3 whitespace-nowrap rounded-lg bg-netbird px-3 py-1.5 font-semibold text-white hover:bg-netbird-500 disabled:opacity-50"
            >
              {dbBusy
                ? t("Lädt...", "Loading...")
                : dbNewEventVal.trim()
                ? t("+ Zeile einfügen & Abfragen", "+ Insert Row & Query")
                : t("SQL ausführen", "Run SQL")}
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-nb-gray-800 bg-nb-gray-950">
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="border-b border-nb-gray-800 bg-nb-gray-930/70 text-[10px] uppercase text-nb-gray-400">
                <tr>
                  {dbColumns.map((col) => (
                    <th key={col} className="px-3 py-2">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-nb-gray-900">
                {dbRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-nb-gray-930/50">
                    {dbColumns.map((col) => (
                      <td
                        key={col}
                        className="px-3 py-2 text-nb-gray-200 whitespace-nowrap"
                      >
                        {String(row[col] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
