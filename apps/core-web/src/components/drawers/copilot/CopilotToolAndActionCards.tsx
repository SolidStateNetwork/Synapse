"use client";

import React from "react";
import { RotateCcw } from "lucide-react";
import { NavSection, ProjectState, ToolResultItem } from "@/types/synapse";

export {
  PostSkillAndInterviewControls,
  LiveStreamingProgressCard,
} from "./CopilotInterviewAndUpdateCards";
export type {
  PostSkillAndInterviewControlsProps,
  LiveStreamingProgressCardProps,
} from "./CopilotInterviewAndUpdateCards";

export interface TurnToolExecutionPipelineProps {
  idx: number;
  toolResults: ToolResultItem[];
  activeProject: ProjectState | null;
  expandedTurnTools: Record<number, boolean>;
  setExpandedTurnTools: React.Dispatch<
    React.SetStateAction<Record<number, boolean>>
  >;
  turnToolCategoryFilter: Record<number, string>;
  setTurnToolCategoryFilter: React.Dispatch<
    React.SetStateAction<Record<number, string>>
  >;
  expandedTools: Record<string, boolean>;
  setExpandedTools: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  setSelectedServiceId: (id: string) => void;
  setPreviewPort: (port: number) => void;
  setActiveNav: (nav: NavSection) => void;
  setServiceActionMethod: (
    m: "GET" | "POST" | "PUT" | "DELETE" | "SQL"
  ) => void;
  setServiceActionPath: (p: string) => void;
  setServiceActionPayload: (p: string) => void;
  handleInvokeServiceAction: (override?: {
    nodeId?: string;
    port?: number;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "SQL";
    path?: string;
    payload?: string;
  }) => void;
  handleRollbackSnapshot: (snapshotId: string, targetPath?: string) => void;
}

export function TurnToolExecutionPipeline({
  idx,
  toolResults,
  activeProject,
  expandedTurnTools,
  setExpandedTurnTools,
  turnToolCategoryFilter,
  setTurnToolCategoryFilter,
  expandedTools,
  setExpandedTools,
  setSelectedServiceId,
  setPreviewPort,
  setActiveNav,
  setServiceActionMethod,
  setServiceActionPath,
  setServiceActionPayload,
  handleInvokeServiceAction,
  handleRollbackSnapshot,
}: TurnToolExecutionPipelineProps) {
  const registeredTurnServices = toolResults
    .filter(
      (tr) =>
        tr.tool_name === "core_register_service" &&
        Boolean((tr.output as Record<string, unknown>)?.registered)
    )
    .map(
      (tr) =>
        (
          tr.output as {
            registered: {
              service_id: string;
              name: string;
              node_id: string;
              port: number;
              category?: string;
              description?: string;
              endpoints?: Array<{
                id: string;
                label: string;
                method: "GET" | "POST" | "PUT" | "DELETE" | "SQL";
                path: string;
                sample_payload?: string;
              }>;
            };
          }
        ).registered
    );

  const turnToolsExpanded = Boolean(expandedTurnTools[idx]);
  const activeCat = turnToolCategoryFilter[idx] || "all";

  const categorizeTool = (name: string) => {
    if (
      name.includes("pty") ||
      name.includes("exec") ||
      name.includes("command")
    ) {
      return "shell";
    }
    if (name.includes("fs") || name.includes("file")) {
      return "fs";
    }
    if (name.includes("search")) {
      return "search";
    }
    return "core";
  };

  const counts = {
    shell: toolResults.filter((t) => categorizeTool(t.tool_name) === "shell")
      .length,
    fs: toolResults.filter((t) => categorizeTool(t.tool_name) === "fs").length,
    search: toolResults.filter((t) => categorizeTool(t.tool_name) === "search")
      .length,
    core: toolResults.filter((t) => categorizeTool(t.tool_name) === "core")
      .length,
  };

  const filteredTools = toolResults
    .map((tr, origIdx) => ({ tr, origIdx }))
    .filter(
      ({ tr }) =>
        activeCat === "all" || categorizeTool(tr.tool_name) === activeCat
    );

  return (
    <div className="mt-3 space-y-2 border-t border-nb-gray-800/80 pt-2.5">
      {registeredTurnServices.length > 0 && (
        <div className="space-y-2">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-400">
            Von außen erreichbare Dienste ({registeredTurnServices.length}):
          </div>
          {registeredTurnServices.map((reg) => {
            const liveSvc =
              (activeProject?.registered_services || []).find(
                (s) => s.service_id === reg.service_id || s.port === reg.port
              ) || reg;
            const eps = liveSvc.endpoints || reg.endpoints || [];
            const cat = liveSvc.category || "backend";
            const catBadge =
              cat === "webui"
                ? "🌐 WebUI"
                : cat === "database"
                ? "🗄️ DB"
                : "⚡ API";

            return (
              <div
                key={reg.service_id}
                className="rounded-xl border border-netbird-500/40 bg-nb-gray-940 p-2.5 font-sans text-xs space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[10px] text-netbird shrink-0">
                      {catBadge}
                    </span>
                    <span className="truncate font-semibold text-white">
                      {liveSvc.name || reg.service_id}
                    </span>
                    <span className="font-mono text-[10px] text-nb-gray-400 shrink-0">
                      :{reg.port}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedServiceId(reg.service_id);
                      setPreviewPort(reg.port);
                      setActiveNav("reverse-proxy");
                    }}
                    className="shrink-0 rounded bg-netbird px-2 py-0.5 text-[10px] font-medium text-white hover:bg-netbird-500"
                  >
                    Öffnen →
                  </button>
                </div>

                {eps.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {eps.map((ep) => (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() => {
                          setSelectedServiceId(reg.service_id);
                          setPreviewPort(reg.port);
                          setServiceActionMethod(ep.method);
                          setServiceActionPath(ep.path);
                          setServiceActionPayload(ep.sample_payload || "");
                          setActiveNav("reverse-proxy");
                          handleInvokeServiceAction({
                            nodeId: reg.node_id,
                            port: reg.port,
                            method: ep.method,
                            path: ep.path,
                            payload: ep.sample_payload || "",
                          });
                        }}
                        className="rounded border border-nb-gray-800 bg-nb-gray-920 px-2 py-0.5 font-mono text-[10px] text-nb-gray-200 hover:border-netbird hover:text-white"
                      >
                        <strong className="text-netbird">{ep.method}</strong>{" "}
                        {ep.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-950/90 p-2 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setTurnToolCategoryFilter((prev) => ({
                  ...prev,
                  [idx]: "all",
                }));
                setExpandedTurnTools((prev) => ({
                  ...prev,
                  [idx]: !prev[idx],
                }));
              }}
              className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-medium transition ${
                turnToolsExpanded && activeCat === "all"
                  ? "bg-netbird text-white"
                  : "bg-nb-gray-900 text-nb-gray-300 hover:text-white"
              }`}
            >
              🛠️ Alle ({toolResults.length})
            </button>
            {counts.search > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTurnToolCategoryFilter((prev) => ({
                    ...prev,
                    [idx]: "search",
                  }));
                  setExpandedTurnTools((prev) => ({
                    ...prev,
                    [idx]: true,
                  }));
                }}
                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${
                  turnToolsExpanded && activeCat === "search"
                    ? "border-amber-500/50 bg-amber-950/70 text-amber-200"
                    : "border-nb-gray-800 bg-nb-gray-930 text-amber-300/90 hover:border-amber-500/40"
                }`}
              >
                🔍 Deep-Search ({counts.search})
              </button>
            )}
            {counts.shell > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTurnToolCategoryFilter((prev) => ({
                    ...prev,
                    [idx]: "shell",
                  }));
                  setExpandedTurnTools((prev) => ({
                    ...prev,
                    [idx]: true,
                  }));
                }}
                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${
                  turnToolsExpanded && activeCat === "shell"
                    ? "border-emerald-500/50 bg-emerald-950/70 text-emerald-200"
                    : "border-nb-gray-800 bg-nb-gray-930 text-emerald-300/90 hover:border-emerald-500/40"
                }`}
              >
                🐚 Terminal ({counts.shell})
              </button>
            )}
            {counts.fs > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTurnToolCategoryFilter((prev) => ({
                    ...prev,
                    [idx]: "fs",
                  }));
                  setExpandedTurnTools((prev) => ({
                    ...prev,
                    [idx]: true,
                  }));
                }}
                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${
                  turnToolsExpanded && activeCat === "fs"
                    ? "border-sky-500/50 bg-sky-950/70 text-sky-200"
                    : "border-nb-gray-800 bg-nb-gray-930 text-sky-300/90 hover:border-sky-500/40"
                }`}
              >
                📁 Dateien ({counts.fs})
              </button>
            )}
            {counts.core > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTurnToolCategoryFilter((prev) => ({
                    ...prev,
                    [idx]: "core",
                  }));
                  setExpandedTurnTools((prev) => ({
                    ...prev,
                    [idx]: true,
                  }));
                }}
                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${
                  turnToolsExpanded && activeCat === "core"
                    ? "border-netbird-500/50 bg-netbird-950/70 text-netbird"
                    : "border-nb-gray-800 bg-nb-gray-930 text-netbird/90 hover:border-netbird-500/40"
                }`}
              >
                🧠 Core ({counts.core})
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setExpandedTurnTools((prev) => ({
                ...prev,
                [idx]: !prev[idx],
              }))
            }
            className="font-mono text-[10px] text-netbird hover:underline"
          >
            {turnToolsExpanded ? "Einklappen ▲" : "Schritte öffnen ▼"}
          </button>
        </div>

        {turnToolsExpanded && (
          <div className="space-y-1.5 border-t border-nb-gray-800/70 pt-2">
            {filteredTools.map(({ tr, origIdx }) => {
              const key = `${idx}-${origIdx}`;
              const open = expandedTools[key];
              const cat = categorizeTool(tr.tool_name);
              const catColor =
                cat === "search"
                  ? "text-amber-300"
                  : cat === "shell"
                  ? "text-emerald-300"
                  : cat === "fs"
                  ? "text-sky-300"
                  : "text-netbird";

              return (
                <div
                  key={key}
                  className="rounded-lg border border-nb-gray-800/90 bg-nb-gray-940/90 px-2.5 py-1.5 font-mono text-[11px] transition hover:border-nb-gray-700"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTools((prev) => ({
                          ...prev,
                          [key]: !prev[key],
                        }))
                      }
                      className="flex flex-1 items-center justify-between text-left min-w-0"
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="rounded bg-nb-gray-900 px-1.5 py-0.2 text-[9px] text-nb-gray-400">
                          #{origIdx + 1}
                        </span>
                        <span className={`truncate font-semibold ${catColor}`}>
                          {tr.tool_name}
                        </span>
                        {tr.cached && (
                          <span className="rounded bg-emerald-950 px-1.5 py-0.2 text-[9px] text-emerald-300 border border-emerald-500/30">
                            CACHED
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] uppercase text-emerald-400 shrink-0 ml-2">
                        {tr.status} {open ? "▲" : "▼"}
                      </span>
                    </button>

                    {tr.rollback_snapshot_id && (
                      <button
                        type="button"
                        onClick={() =>
                          handleRollbackSnapshot(
                            tr.rollback_snapshot_id!,
                            tr.rollback_path
                          )
                        }
                        title={`Rollback ${
                          tr.rollback_path || "file"
                        } to pre-write snapshot`}
                        className="flex items-center gap-1 rounded border border-amber-500/40 bg-amber-950/50 px-1.5 py-0.5 text-[9px] text-amber-300 hover:bg-amber-900/60 hover:text-white"
                      >
                        <RotateCcw className="h-2.5 w-2.5" />
                        <span>Rollback</span>
                      </button>
                    )}
                  </div>
                  {open && (
                    <pre className="mt-1.5 max-h-44 overflow-auto rounded border border-nb-gray-800 bg-nb-gray-960 p-2 text-[10px] text-nb-gray-300">
                      {JSON.stringify(tr.output, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
