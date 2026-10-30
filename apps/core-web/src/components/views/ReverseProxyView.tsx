"use client";

import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  Bot,
  Check,
  Code2,
  Copy,
  FileText,
  History,
  Search,
  Database,
  ExternalLink,
  Globe,
  Play,
  RefreshCw,
  Zap,
} from "lucide-react";
import { SynapseViewHeader } from "@/components/ui/SynapseDesignSystem";
import type { ProjectState } from "@/types/synapse";

export interface ReverseProxyViewProps {
  activeProject: ProjectState | null;
  primaryNode: string;
  gatewayUrl: string;
  selectedServiceId: string;
  setSelectedServiceId: (id: string) => void;
  previewPort: number;
  setPreviewPort: (port: number) => void;
  previewSubPath: string;
  setPreviewSubPath: (path: string) => void;
  previewReloadNonce: number;
  setPreviewReloadNonce: React.Dispatch<React.SetStateAction<number>>;
  serviceWorkspaceTab: "split" | "preview" | "tester";
  setServiceWorkspaceTab: (tab: "split" | "preview" | "tester") => void;
  selectedEndpointId: string;
  setSelectedEndpointId: (id: string) => void;
  serviceActionMethod: "GET" | "POST" | "PUT" | "DELETE" | "SQL";
  setServiceActionMethod: (
    m: "GET" | "POST" | "PUT" | "DELETE" | "SQL"
  ) => void;
  serviceActionPath: string;
  setServiceActionPath: (p: string) => void;
  serviceActionPayload: string;
  setServiceActionPayload: (p: string) => void;
  serviceActionBusy: boolean;
  serviceActionResult: {
    ok: boolean;
    status_code: number;
    latency_ms: number;
    method: string;
    proxy_url: string;
    response_text: string;
  } | null;
  handleInvokeServiceAction: (override?: {
    nodeId?: string;
    port?: number;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "SQL";
    path?: string;
    payload?: string;
  }) => void;
  onDiagnoseService?: (port: number) => void;
}

const ReverseProxyView = React.memo(function ReverseProxyView({
  activeProject,
  primaryNode,
  gatewayUrl,
  selectedServiceId,
  setSelectedServiceId,
  previewPort,
  setPreviewPort,
  previewSubPath,
  setPreviewSubPath,
  previewReloadNonce,
  setPreviewReloadNonce,
  serviceWorkspaceTab,
  setServiceWorkspaceTab,
  selectedEndpointId,
  setSelectedEndpointId,
  serviceActionMethod,
  setServiceActionMethod,
  serviceActionPath,
  setServiceActionPath,
  serviceActionPayload,
  setServiceActionPayload,
  serviceActionBusy,
  serviceActionResult,
  handleInvokeServiceAction,
  onDiagnoseService,
}: ReverseProxyViewProps) {
  const { t } = useI18n();
  const [showBuilder, setShowBuilder] = useState(false);
  const [newSvcName, setNewSvcName] = useState("");
  const [newSvcPort, setNewSvcPort] = useState("4095");
  const [newSvcCat, setNewSvcCat] = useState<"backend" | "webui" | "database">(
    "backend"
  );
  const [newSvcBusy, setNewSvcBusy] = useState(false);
  const [newSvcNotice, setNewSvcNotice] = useState<string | null>(null);

  // v0.7.0 Sub-View Mode: "workbench" | "hot-reload" | "sqlite-studio"
  const [v070Mode, setV070Mode] = useState<
    "workbench" | "hot-reload" | "sqlite-studio"
  >("workbench");
  const [codePath, setCodePath] = useState("");
  const [codeText, setCodeText] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeSaving, setCodeSaving] = useState(false);
  const [codeNotice, setCodeNotice] = useState<string | null>(null);

  // v0.7.0 SQLite Data Studio State
  const [dbPathInput, setDbPathInput] = useState(
    "/opt/axon/workspaces/pulse-analytics/pulse.db"
  );
  const [dbTables, setDbTables] = useState<string[]>(["events", "metrics"]);
  const [activeDbTable, setActiveDbTable] = useState("events");
  const [dbColumns, setDbColumns] = useState<string[]>([
    "id",
    "event",
    "source",
    "created_at",
  ]);
  const [dbRows, setDbRows] = useState<Array<Record<string, unknown>>>([]);
  const [dbRowCount, setDbRowCount] = useState(0);
  const [dbCustomSql, setDbCustomSql] = useState("");
  const [dbNewEventVal, setDbNewEventVal] = useState("");
  const [dbNewSourceVal, setDbNewSourceVal] = useState("synapse_studio");
  const [dbBusy, setDbBusy] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [requestHistory, setRequestHistory] = useState<
    Array<{
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
    }>
  >([]);
  const [wbLogsOpen, setWbLogsOpen] = useState(false);
  const [wbLogsBusy, setWbLogsBusy] = useState(false);
  const [wbLogsLines, setWbLogsLines] = useState<string[]>([]);
  const [wbLogsErrorCount, setWbLogsErrorCount] = useState(0);
  const [wbLogsFilter, setWbLogsFilter] = useState("");
  const [wbLogsErrorsOnly, setWbLogsErrorsOnly] = useState(false);
  const [wbLogsCopied, setWbLogsCopied] = useState(false);
  const allSvcs = activeProject?.registered_services || [];
  const activeSvc =
    allSvcs.find((s) => s.service_id === selectedServiceId) ||
    allSvcs.find((s) => s.port === previewPort) ||
    allSvcs[0];

  useEffect(() => {
    if (!serviceActionResult || !activeSvc) return;
    const entryId = `${activeSvc.port}-${serviceActionResult.method}-${serviceActionPath}-${serviceActionResult.status_code}-${serviceActionResult.latency_ms}`;
    setRequestHistory((prev) => {
      if (prev[0]?.id === entryId) return prev;
      const nextItem = {
        id: entryId,
        port: activeSvc.port,
        serviceName: activeSvc.name.replace(new RegExp(`\\s*:${activeSvc.port}\\b`), "").trim(),
        method: (serviceActionResult.method as "GET" | "POST" | "PUT" | "DELETE" | "SQL") || serviceActionMethod,
        path: serviceActionPath,
        payload: serviceActionPayload,
        statusCode: serviceActionResult.status_code,
        latencyMs: serviceActionResult.latency_ms,
        ok: serviceActionResult.ok,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      };
      return [nextItem, ...prev.filter((item) => item.id !== entryId)].slice(0, 6);
    });
  }, [serviceActionResult]);

  const handleFetchWorkbenchLogs = async (svcTarget = activeSvc) => {
    if (!svcTarget) return;
    setWbLogsOpen(true);
    setWbLogsBusy(true);
    try {
      const r = await fetch("/api/service-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "tail_logs",
          node_id: svcTarget.node_id || primaryNode || "vps2-muscle",
          service_id: svcTarget.service_id,
          port: svcTarget.port,
          container_name: svcTarget.container_name,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setWbLogsLines(d.lines || []);
        setWbLogsErrorCount(d.error_count || 0);
      }
    } finally {
      setWbLogsBusy(false);
    }
  };

  const activeExtUrl = activeSvc
    ? `${gatewayUrl}/preview/${activeProject?.project_id}/${
        activeSvc.node_id || primaryNode
      }/${activeSvc.port}/`
    : `${gatewayUrl}/preview/${activeProject?.project_id}/${
        primaryNode || "node"
      }/${previewPort}/`;

  const activeEndpoints = activeSvc?.endpoints || [];
  const bySelectedIdIdx = selectedEndpointId
    ? activeEndpoints.findIndex(
        (e, i) => `${e.id || i}::${e.label}` === selectedEndpointId
      )
    : -1;
  const byExactMatchIdx = activeEndpoints.findIndex(
    (e) =>
      e.method === serviceActionMethod &&
      e.path === serviceActionPath &&
      (e.sample_payload || "") === serviceActionPayload
  );
  const byMethodPathIdx = activeEndpoints.findIndex(
    (e) =>
      e.method === serviceActionMethod && e.path === serviceActionPath
  );
  const activeEndpointIdx =
    bySelectedIdIdx !== -1
      ? bySelectedIdIdx
      : byExactMatchIdx !== -1
      ? byExactMatchIdx
      : byMethodPathIdx;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-6">
      <SynapseViewHeader
        icon={<Globe className="h-5 w-5" />}
        accentColor="sky"
        title="Services & Reverse-Proxy Workbench"
        description="Teste Web-Oberflächen, HTTP-Endpunkte und SQLite-Datenbanken deiner Server direkt im Browser über den verschlüsselten Synapse-Tunnel – auch wenn deren Ports in der Firewall nach außen gesperrt sind."
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-nb-gray-900 bg-nb-gray-940 p-3.5 text-xs">
        <div className="flex items-center gap-2 text-nb-gray-300">
          <Zap className="h-4 w-4 text-netbird" />
          <span>
            {t(
              "1-Click Custom Service Builder: Eigenen Microservice, WebUI oder SQLite-API live auf dem Muscle starten",
              "1-Click Custom Service Builder: Launch your own microservice, WebUI, or SQLite API live on the Muscle"
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowBuilder((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-netbird px-3 py-1.5 text-xs font-semibold text-white hover:bg-netbird-500 transition"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{t("Neuer Service", "New Service")}</span>
        </button>
      </div>

      {showBuilder && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const pNum = Number(newSvcPort || 4095);
            if (!newSvcName.trim() || !Number.isInteger(pNum)) return;
            setNewSvcBusy(true);
            setNewSvcNotice(null);
            try {
              const res = await fetch("/api/service-ops", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "deploy_custom_service",
                  project_id: activeProject?.project_id || "synapse-cloud-demo",
                  node_id: primaryNode || "vps2-muscle",
                  name: newSvcName.trim(),
                  port: pNum,
                  category: newSvcCat,
                  auto_heal: true,
                }),
              });
              const data = await res.json();
              if (data.ok) {
                setNewSvcNotice(
                  t(
                    `🚀 ${data.service.name} auf :${data.service.port} gestartet!`,
                    `🚀 ${data.service.name} deployed on :${data.service.port}!`
                  )
                );
                setNewSvcName("");
                setNewSvcPort(String(pNum + 1));
              }
            } finally {
              setNewSvcBusy(false);
            }
          }}
          className="grid grid-cols-1 gap-3 rounded-xl border border-netbird/40 bg-nb-gray-940 p-4 sm:grid-cols-4 text-xs"
        >
          <input
            type="text"
            required
            value={newSvcName}
            onChange={(e) => setNewSvcName(e.target.value)}
            placeholder={t("Service-Name (z.B. Metrics API)", "Service Name")}
            className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 text-white"
          />
          <input
            type="number"
            required
            min={1024}
            max={65535}
            value={newSvcPort}
            onChange={(e) => setNewSvcPort(e.target.value)}
            className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 font-mono text-netbird"
          />
          <select
            value={newSvcCat}
            onChange={(e) =>
              setNewSvcCat(e.target.value as "backend" | "webui" | "database")
            }
            className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 text-white"
          >
            <option value="backend">Python JSON API</option>
            <option value="webui">Dark HTML5 WebUI</option>
            <option value="database">SQLite REST DB</option>
          </select>
          <button
            type="submit"
            disabled={newSvcBusy}
            className="rounded-lg bg-netbird px-4 py-2 font-semibold text-white hover:bg-netbird-500 disabled:opacity-50"
          >
            {newSvcBusy
              ? t("Startet...", "Deploying...")
              : t("Jetzt ausrollen", "Deploy Now")}
          </button>
          {newSvcNotice && (
            <div className="sm:col-span-4 font-mono text-[11px] text-emerald-400">
              {newSvcNotice}
            </div>
          )}
        </form>
      )}

      {allSvcs.length === 0 ? (
        <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-6 text-center text-xs text-nb-gray-400">
          Noch keine Dienste im Projekt registriert.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {allSvcs.map((svc) => {
            const healthy =
              svc.healthy !== false &&
              svc.health_check?.status !== "UNHEALTHY";
            const isSelected = activeSvc?.service_id === svc.service_id;
            const cat = svc.category || "backend";
            const cleanName = svc.name
              .replace(new RegExp(`\\s*:${svc.port}\\b`), "")
              .trim();
            const CatIcon =
              cat === "webui"
                ? Globe
                : cat === "database"
                ? Database
                : Zap;

            return (
              <button
                key={svc.service_id}
                type="button"
                onClick={() => {
                  setSelectedServiceId(svc.service_id);
                  setPreviewPort(svc.port);
                  setPreviewSubPath("/");
                  setServiceWorkspaceTab(
                    svc.category === "webui" ? "preview" : "tester"
                  );
                  if (svc.endpoints && svc.endpoints.length > 0) {
                    const firstEp = svc.endpoints[0];
                    setSelectedEndpointId(
                      `${firstEp.id || 0}::${firstEp.label}`
                    );
                    setServiceActionMethod(firstEp.method);
                    setServiceActionPath(firstEp.path);
                    setServiceActionPayload(firstEp.sample_payload || "");
                    handleInvokeServiceAction({
                      nodeId: svc.node_id,
                      port: svc.port,
                      method: firstEp.method,
                      path: firstEp.path,
                      payload: firstEp.sample_payload || "",
                    });
                  } else {
                    setSelectedEndpointId("");
                  }
                }}
                className={`group relative flex items-center gap-3.5 rounded-xl border p-3.5 text-left transition-all duration-150 ${
                  isSelected
                    ? "border-netbird/80 bg-nb-gray-930 shadow-md ring-1 ring-netbird/25"
                    : "border-nb-gray-800/80 bg-nb-gray-940/80 hover:border-nb-gray-700 hover:bg-nb-gray-930/60"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                    isSelected
                      ? "border-netbird/40 bg-netbird/15 text-netbird"
                      : "border-nb-gray-800 bg-nb-gray-950 text-nb-gray-400 group-hover:text-nb-gray-200"
                  }`}
                >
                  <CatIcon className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-white">
                      {cleanName}
                    </span>
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        healthy
                          ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                          : "bg-red-500 animate-pulse"
                      }`}
                    />
                  </div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-nb-gray-400 whitespace-nowrap">
                    <span
                      data-no-i18n="true"
                      className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        cat === "webui"
                          ? "bg-sky-950/80 text-sky-300 border border-sky-500/30"
                          : cat === "database"
                          ? "bg-sky-950/80 text-sky-300 border border-sky-500/30"
                          : "bg-amber-950/70 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      {cat === "webui"
                        ? "WebUI"
                        : cat === "database"
                        ? "DB"
                        : "API"}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-nb-gray-300">
                      {svc.service_id === "pulse-sqlite-db" ? "pulse.db (WAL)" : `Port ${svc.port}`}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {activeSvc && (
        <div className="flex flex-col overflow-hidden rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 shadow-lg">
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
                {
                  id: "tester",
                  label: "API- & DB-Tester",
                  icon: Code2,
                },
                {
                  id: "preview",
                  label: "Web-Vorschau",
                  icon: Globe,
                },
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
                "v0.7.0 Developer Workbench · API-Tester, Live Code Hot-Reload & Interactive SQLite Data Studio",
                "v0.7.0 Developer Workbench · API Tester, Live Code Hot-Reload & Interactive SQLite Data Studio"
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
                  if (activeSvc) {
                    setCodeLoading(true);
                    setCodeNotice(null);
                    try {
                      const r = await fetch("/api/service-ops", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "get_service_code",
                          project_id:
                            activeProject?.project_id || "synapse-cloud-demo",
                          node_id:
                            activeSvc.node_id || primaryNode || "vps2-muscle",
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
                    const targetDb = activeSvc?.db_path || dbPathInput;
                    setDbPathInput(targetDb);
                    const r = await fetch("/api/service-ops", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "sqlite_studio",
                        project_id:
                          activeProject?.project_id || "synapse-cloud-demo",
                        node_id:
                          activeSvc?.node_id || primaryNode || "vps2-muscle",
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
                      const r = await fetch("/api/service-ops", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "hot_reload_service_code",
                          project_id:
                            activeProject?.project_id || "synapse-cloud-demo",
                          node_id:
                            activeSvc.node_id || primaryNode || "vps2-muscle",
                          service_id: activeSvc.service_id,
                          port: activeSvc.port,
                          file_path: codePath,
                          code: codeText,
                        }),
                      });
                      const d = await r.json();
                      if (d.ok) {
                        setCodeNotice(
                          t(
                            `🔥 Hot-Reload auf :${d.port} in ${d.elapsed_ms} ms aktiv (Snapshot ${d.snapshot_id}, HTTP ${d.http_status})!`,
                            `🔥 Hot-Reload active on :${d.port} in ${d.elapsed_ms} ms (Snapshot ${d.snapshot_id}, HTTP ${d.http_status})!`
                          )
                        );
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
                          const r = await fetch("/api/service-ops", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "sqlite_studio",
                              project_id:
                                activeProject?.project_id ||
                                "synapse-cloud-demo",
                              node_id:
                                activeSvc?.node_id ||
                                primaryNode ||
                                "vps2-muscle",
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
                      const r = await fetch("/api/service-ops", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "sqlite_studio",
                          project_id:
                            activeProject?.project_id || "synapse-cloud-demo",
                          node_id:
                            activeSvc?.node_id || primaryNode || "vps2-muscle",
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

          {v070Mode === "workbench" && serviceWorkspaceTab !== "preview" && (
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
                    <code className="font-mono text-white">
                      :{activeSvc.port}
                    </code>
                    .
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
                            setSelectedEndpointId(
                              `${ep.id || idx}::${ep.label}`
                            );
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
                        e.target.value as
                          | "GET"
                          | "POST"
                          | "PUT"
                          | "DELETE"
                          | "SQL"
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
                        ? "/opt/axon/workspaces/.../pulse.db"
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
                    <span>
                      {serviceActionBusy ? "Läuft..." : "Ausführen"}
                    </span>
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
                      <span className="font-medium text-nb-gray-200">
                        Antwort
                      </span>
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

                {/* v0.7.0 COMFORT UPGRADE: REQUEST HISTORY & 1-CLICK REPLAY */}
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

                {/* v0.7.0 COMFORT UPGRADE: WORKBENCH LIVE-LOG CONSOLE WITH FILTER, COPY & AI DIAGNOSIS */}
                {wbLogsOpen && (() => {
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
                              placeholder={t("Logs durchsuchen...", "Search logs...")}
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
                            <RefreshCw className={`h-3 w-3 ${wbLogsBusy ? "animate-spin text-sky-400" : ""}`} />
                            <span>{t("Aktualisieren", "Refresh")}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(filteredWbLines.join("\n"));
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
                            {t("Keine passenden Log-Einträge gefunden.", "No matching log entries found.")}
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
          )}

          {v070Mode === "workbench" && serviceWorkspaceTab === "preview" && (
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
          )}
        </div>
      )}
    </div>
  );
});

export default ReverseProxyView;
