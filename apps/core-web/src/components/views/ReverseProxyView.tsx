"use client";

import React from "react";
import {
  Code2,
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
}: ReverseProxyViewProps) {
  const allSvcs = activeProject?.registered_services || [];
  const activeSvc =
    allSvcs.find((s) => s.service_id === selectedServiceId) ||
    allSvcs.find((s) => s.port === previewPort) ||
    allSvcs[0];

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
                      Port {svc.port}
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
          <div className="flex items-center justify-between gap-3 border-b border-nb-gray-800/80 bg-nb-gray-930/70 px-5 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
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
                <span className="truncate max-w-[420px] xl:max-w-[540px]">
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

          {serviceWorkspaceTab !== "preview" && (
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
                      <div className="flex items-center gap-2 font-mono text-[11px]">
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
                      </div>
                    )}
                  </div>

                  <pre className="max-h-80 min-h-[180px] overflow-auto p-4 font-mono text-xs whitespace-pre-wrap text-nb-gray-100 leading-relaxed">
                    {serviceActionResult
                      ? serviceActionResult.response_text
                      : "Klicke links auf einen Endpunkt oder oben auf 'Ausführen'."}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {serviceWorkspaceTab === "preview" && (
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
