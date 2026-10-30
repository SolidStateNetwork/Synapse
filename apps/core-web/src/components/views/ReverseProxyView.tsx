"use client";

import React, { useEffect, useState } from "react";
import { Database, Globe, Plus, Trash2, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SynapseViewHeader } from "@/components/ui/SynapseDesignSystem";
import type { ProjectState } from "@/types/synapse";
import { ReverseProxyCodeAndSqliteStudios } from "./reverse-proxy/ReverseProxyCodeAndSqliteStudios";
import {
  ReverseProxyRequestHistoryItem,
  ReverseProxyWorkbenchPanel,
} from "./reverse-proxy/ReverseProxyWorkbenchPanel";

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
  onDiagnoseService?: (port: number) => void;
  onRemoveService?: (serviceId: string, nodeId?: string, port?: number) => void;
  onReloadWorkspace?: () => void;
}

const ReverseProxyView = React.memo(function ReverseProxyView({
  activeProject, primaryNode, gatewayUrl, selectedServiceId, setSelectedServiceId,
  previewPort, setPreviewPort, previewSubPath, setPreviewSubPath,
  previewReloadNonce, setPreviewReloadNonce, serviceWorkspaceTab, setServiceWorkspaceTab,
  selectedEndpointId, setSelectedEndpointId, serviceActionMethod, setServiceActionMethod,
  serviceActionPath, setServiceActionPath, serviceActionPayload, setServiceActionPayload,
  serviceActionBusy, serviceActionResult, handleInvokeServiceAction,
  onDiagnoseService, onRemoveService, onReloadWorkspace,
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

  const [v070Mode, setV070Mode] = useState<
    "workbench" | "hot-reload" | "sqlite-studio"
  >("workbench");
  const [codePath, setCodePath] = useState("");
  const [codeText, setCodeText] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeSaving, setCodeSaving] = useState(false);
  const [codeNotice, setCodeNotice] = useState<string | null>(null);

  const [dbPathInput, setDbPathInput] = useState("/var/lib/synapse/app.db");
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
    ReverseProxyRequestHistoryItem[]
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
  const projectId = activeProject?.project_id || "default-project";
  const resolvedNodeId = activeSvc?.node_id || primaryNode || "local-node";

  useEffect(() => {
    if (v070Mode !== "hot-reload" || !activeSvc) return;
    let cancelled = false;
    setCodeLoading(true);
    setCodeNotice(null);
    fetch("/api/service-ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "get_service_code",
        project_id: projectId,
        node_id: resolvedNodeId,
        service_id: activeSvc.service_id,
        port: activeSvc.port,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.ok) {
          setCodePath(d.file_path || "");
          setCodeText(d.code || "");
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCodeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [v070Mode, activeSvc?.service_id, activeSvc?.port]);

  useEffect(() => {
    if (!serviceActionResult || !activeSvc) return;
    const entryId = `${activeSvc.port}-${serviceActionResult.method}-${serviceActionPath}-${serviceActionResult.status_code}-${serviceActionResult.latency_ms}`;
    setRequestHistory((prev) => {
      if (prev[0]?.id === entryId) return prev;
      const nextItem: ReverseProxyRequestHistoryItem = {
        id: entryId,
        port: activeSvc.port,
        serviceName: activeSvc.name
          .replace(new RegExp(`\\s*:${activeSvc.port}\\b`), "")
          .trim(),
        method:
          (serviceActionResult.method as
            | "GET"
            | "POST"
            | "PUT"
            | "DELETE"
            | "SQL") || serviceActionMethod,
        path: serviceActionPath,
        payload: serviceActionPayload,
        statusCode: serviceActionResult.status_code,
        latencyMs: serviceActionResult.latency_ms,
        ok: serviceActionResult.ok,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      };
      return [nextItem, ...prev.filter((item) => item.id !== entryId)].slice(
        0,
        6
      );
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
          node_id: svcTarget.node_id || primaryNode || "local-node",
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
    (e) => e.method === serviceActionMethod && e.path === serviceActionPath
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
                  project_id: projectId,
                  node_id: primaryNode || "local-node",
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
                onReloadWorkspace?.();
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
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          healthy
                            ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                            : "bg-red-500 animate-pulse"
                        }`}
                      />
                      {onRemoveService && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveService(
                              svc.service_id,
                              svc.node_id,
                              svc.port
                            );
                          }}
                          title={t(
                            "Dienst aus Projekt entfernen",
                            "Remove service from project"
                          )}
                          className="rounded p-1 text-nb-gray-500 hover:bg-red-950/70 hover:text-red-300 transition"
                        >
                          <Trash2 className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-nb-gray-400 whitespace-nowrap">
                    <span
                      data-no-i18n="true"
                      className={`shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        cat === "webui" || cat === "database"
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
                      {svc.db_path
                        ? `${svc.db_path.split("/").pop()} (WAL)`
                        : `Port ${svc.port}`}
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
          <ReverseProxyCodeAndSqliteStudios
            v070Mode={v070Mode}
            setV070Mode={setV070Mode}
            activeSvc={activeSvc}
            activeExtUrl={activeExtUrl}
            serviceWorkspaceTab={serviceWorkspaceTab}
            setServiceWorkspaceTab={setServiceWorkspaceTab}
            activeProject={activeProject}
            primaryNode={primaryNode}
            codePath={codePath}
            setCodePath={setCodePath}
            codeText={codeText}
            setCodeText={setCodeText}
            codeLoading={codeLoading}
            setCodeLoading={setCodeLoading}
            codeSaving={codeSaving}
            setCodeSaving={setCodeSaving}
            codeNotice={codeNotice}
            setCodeNotice={setCodeNotice}
            dbPathInput={dbPathInput}
            setDbPathInput={setDbPathInput}
            dbTables={dbTables}
            setDbTables={setDbTables}
            activeDbTable={activeDbTable}
            setActiveDbTable={setActiveDbTable}
            dbColumns={dbColumns}
            setDbColumns={setDbColumns}
            dbRows={dbRows}
            setDbRows={setDbRows}
            dbRowCount={dbRowCount}
            setDbRowCount={setDbRowCount}
            dbCustomSql={dbCustomSql}
            setDbCustomSql={setDbCustomSql}
            dbNewEventVal={dbNewEventVal}
            setDbNewEventVal={setDbNewEventVal}
            dbNewSourceVal={dbNewSourceVal}
            setDbNewSourceVal={setDbNewSourceVal}
            dbBusy={dbBusy}
            setDbBusy={setDbBusy}
          />

          {v070Mode === "workbench" && (
            <ReverseProxyWorkbenchPanel
              activeSvc={activeSvc}
              activeProject={activeProject}
              primaryNode={primaryNode}
              gatewayUrl={gatewayUrl}
              serviceWorkspaceTab={serviceWorkspaceTab}
              activeEndpointIdx={activeEndpointIdx}
              setSelectedServiceId={setSelectedServiceId}
              setSelectedEndpointId={setSelectedEndpointId}
              previewPort={previewPort}
              setPreviewPort={setPreviewPort}
              previewSubPath={previewSubPath}
              setPreviewSubPath={setPreviewSubPath}
              previewReloadNonce={previewReloadNonce}
              setPreviewReloadNonce={setPreviewReloadNonce}
              serviceActionMethod={serviceActionMethod}
              setServiceActionMethod={setServiceActionMethod}
              serviceActionPath={serviceActionPath}
              setServiceActionPath={setServiceActionPath}
              serviceActionPayload={serviceActionPayload}
              setServiceActionPayload={setServiceActionPayload}
              serviceActionBusy={serviceActionBusy}
              serviceActionResult={serviceActionResult}
              handleInvokeServiceAction={handleInvokeServiceAction}
              copiedResponse={copiedResponse}
              setCopiedResponse={setCopiedResponse}
              requestHistory={requestHistory}
              wbLogsOpen={wbLogsOpen}
              wbLogsBusy={wbLogsBusy}
              wbLogsLines={wbLogsLines}
              wbLogsErrorCount={wbLogsErrorCount}
              wbLogsFilter={wbLogsFilter}
              setWbLogsFilter={setWbLogsFilter}
              wbLogsErrorsOnly={wbLogsErrorsOnly}
              setWbLogsErrorsOnly={setWbLogsErrorsOnly}
              wbLogsCopied={wbLogsCopied}
              setWbLogsCopied={setWbLogsCopied}
              handleFetchWorkbenchLogs={handleFetchWorkbenchLogs}
              onDiagnoseService={onDiagnoseService}
            />
          )}
        </div>
      )}
    </div>
  );
});

export default ReverseProxyView;
