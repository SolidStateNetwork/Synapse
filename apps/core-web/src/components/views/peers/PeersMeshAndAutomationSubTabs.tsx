"use client";

import React from "react";
import { Activity, Network, Sparkles, Trash2 } from "lucide-react";
import { GatewayNode, ProjectState, StackBlueprint } from "@/types/synapse";

export type ScheduledPlaybookItem = NonNullable<
  ProjectState["scheduled_playbooks"]
>[number];

export interface PeersMeshAndAutomationSubTabsProps {
  peersSubTab: "nodes" | "mesh" | "blueprints" | "playbooks";
  activeProject: ProjectState | null;
  gatewayNodes: GatewayNode[];
  blueprints: StackBlueprint[];
  meshSourceNode: string;
  setMeshSourceNode: (val: string) => void;
  meshTargetNode: string;
  setMeshTargetNode: (val: string) => void;
  meshTargetPort: number;
  setMeshTargetPort: (val: number) => void;
  meshAliasEnv: string;
  setMeshAliasEnv: (val: string) => void;
  onAddMeshLink: (e: React.FormEvent) => void;
  onRemoveMeshLink: (linkId: string) => void;
  onRunPromptInCopilot: (prompt: string) => void;
  playbookName: string;
  setPlaybookName: (val: string) => void;
  playbookCron: string;
  setPlaybookCron: (val: string) => void;
  playbookPrompt: string;
  setPlaybookPrompt: (val: string) => void;
  onAddPlaybook: (e: React.FormEvent) => void;
  onTogglePlaybook: (pb: ScheduledPlaybookItem) => void;
  onDeletePlaybook: (playbookId: string) => void;
}

export function PeersMeshAndAutomationSubTabs({
  peersSubTab,
  activeProject,
  gatewayNodes,
  blueprints,
  meshSourceNode,
  setMeshSourceNode,
  meshTargetNode,
  setMeshTargetNode,
  meshTargetPort,
  setMeshTargetPort,
  meshAliasEnv,
  setMeshAliasEnv,
  onAddMeshLink,
  onRemoveMeshLink,
  onRunPromptInCopilot,
  playbookName,
  setPlaybookName,
  playbookCron,
  setPlaybookCron,
  playbookPrompt,
  setPlaybookPrompt,
  onAddPlaybook,
  onTogglePlaybook,
  onDeletePlaybook,
}: PeersMeshAndAutomationSubTabsProps) {
  return (
    <>
      {peersSubTab === "nodes" && gatewayNodes.length > 0 && (
        <div className="rounded-xl border border-nb-gray-900 bg-nb-gray-940 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-white flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              60-Sample Live-Telemetrie-Zeitreihen (CPU, RAM &amp; Latenz-Sparklines)
            </h2>
            <span className="font-mono text-[10px] text-nb-gray-400">
              5s Heartbeat-Ringpuffer (max. 60 Samples)
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {gatewayNodes.map((node) => {
              const hb = node.last_heartbeat;
              const rawHist = (hb as { telemetry_history?: Array<{ cpu?: number; ram?: number; latency_ms?: number }> } | undefined)?.telemetry_history || [];
              const samples = rawHist.length > 0
                ? rawHist.slice(-60)
                : [{ cpu: hb?.cpu_percent || 0, ram: hb?.ram_percent || 0, latency_ms: 1 }];
              const latestCpu = Number(hb?.cpu_percent || 0).toFixed(1);
              const latestRam = Number(hb?.ram_percent || 0).toFixed(1);
              const avgLat = (
                samples.reduce((acc, s) => acc + Number(s.latency_ms || 0), 0) /
                Math.max(1, samples.length)
              ).toFixed(1);

              return (
                <div
                  key={node.node_id}
                  className="rounded-lg border border-nb-gray-800/80 bg-nb-gray-950/80 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-white">
                      {node.node_id}
                    </span>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className="text-emerald-300">CPU {latestCpu}%</span>
                      <span className="text-sky-300">RAM {latestRam}%</span>
                      <span className="text-amber-300">Ø {avgLat} ms ({samples.length}/60)</span>
                    </div>
                  </div>
                  <div className="flex h-7 items-end gap-0.5 rounded bg-nb-gray-900/80 px-1.5 py-1">
                    {samples.map((s, idx) => {
                      const cpuH = Math.max(12, Math.min(100, Math.round(Number(s.cpu || 0) * 1.5)));
                      const ramH = Math.max(12, Math.min(100, Math.round(Number(s.ram || 0))));
                      return (
                        <div key={idx} className="flex flex-1 items-end gap-px h-full">
                          <div
                            style={{ height: `${cpuH}%` }}
                            className="w-full rounded-t bg-emerald-400/80"
                            title={`CPU: ${Number(s.cpu || 0).toFixed(1)}%`}
                          />
                          <div
                            style={{ height: `${ramH}%` }}
                            className="w-full rounded-t bg-sky-400/60"
                            title={`RAM: ${Number(s.ram || 0).toFixed(1)}%`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {peersSubTab === "mesh" && (
        <div className="rounded-xl border border-nb-gray-900 bg-nb-gray-940 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Network className="h-4 w-4 text-sky-400" />
              Multi-Server Peer-to-Peer Mesh-Verbindungen (core_link_peers)
            </h2>
            <p className="text-xs text-nb-gray-400 mt-0.5">
              Verbinde Dienste zwischen verschiedenen Muscle-Servern über
              verschlüsselte mTLS-Loopback-Tunnels.
            </p>
          </div>
          <datalist id="synapse-peer-nodes">
            {Array.from(
              new Set([
                ...gatewayNodes.map((n) => n.node_id),
                ...(activeProject?.assigned_nodes || []).map((n) => n.node_id),
              ])
            ).map((nid) => (
              <option key={nid} value={nid} />
            ))}
          </datalist>
          <form
            onSubmit={onAddMeshLink}
            className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 text-xs"
          >
            <input
              type="text"
              list="synapse-peer-nodes"
              value={meshSourceNode}
              onChange={(e) => setMeshSourceNode(e.target.value)}
              placeholder="Quell-Server (z.B. edge-node-01)"
              className="sm:col-span-3 rounded border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-2 font-mono text-xs text-white"
            />
            <input
              type="text"
              list="synapse-peer-nodes"
              value={meshTargetNode}
              onChange={(e) => setMeshTargetNode(e.target.value)}
              placeholder="Ziel-Server (db-node)"
              className="sm:col-span-3 rounded border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-2 font-mono text-xs text-white"
            />
            <input
              type="number"
              value={meshTargetPort}
              onChange={(e) => setMeshTargetPort(Number(e.target.value) || 5432)}
              placeholder="Port"
              className="sm:col-span-2 rounded border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-2 font-mono text-xs text-netbird"
            />
            <input
              type="text"
              value={meshAliasEnv}
              onChange={(e) => setMeshAliasEnv(e.target.value)}
              placeholder="ENV-Alias (PEER_DB_URL)"
              className="sm:col-span-2 rounded border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-2 font-mono text-xs text-nb-gray-200"
            />
            <button
              type="submit"
              className="sm:col-span-2 whitespace-nowrap rounded bg-netbird px-2.5 py-2 text-xs font-medium text-white hover:bg-netbird-500"
            >
              + Mesh-Link
            </button>
          </form>
          <div className="space-y-2">
            {(activeProject?.peer_mesh_links || []).length === 0 ? (
              <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-950/70 px-4 py-3 text-xs text-nb-gray-400">
                Noch keine P2P-Mesh-Verknüpfungen aktiv. Wähle oben Quell- und
                Ziel-Server sowie den Ziel-Port aus, um einen verschlüsselten
                mTLS-Loopback-Tunnel bereitzustellen.
              </div>
            ) : (
              (activeProject?.peer_mesh_links || []).map((lnk) => (
                <div
                  key={lnk.link_id}
                  className="flex items-center justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-930 px-4 py-2.5 font-mono text-xs"
                >
                  <span className="text-nb-gray-200">
                    <strong className="text-white">{lnk.source_node_id}</strong>{" "}
                    ⇄{" "}
                    <strong className="text-sky-400">
                      {lnk.target_node_id}:
                      {lnk.target_port || lnk.remote_port || lnk.local_port || 5432}
                    </strong>{" "}
                    <span className="text-nb-gray-400">
                      ({lnk.alias_env || lnk.description || "mTLS-Tunnel"})
                    </span>
                  </span>
                  <button
                    onClick={() => onRemoveMeshLink(lnk.link_id)}
                    className="text-nb-gray-500 hover:text-red-400"
                    title="Mesh-Link trennen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {peersSubTab === "blueprints" && (
        <div className="rounded-xl border border-nb-gray-900 bg-nb-gray-940 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-netbird" />
              1-Click AI Stack Blueprints
            </h2>
            <p className="text-xs text-nb-gray-400 mt-0.5">
              Fertige Infrastruktur-Stacks mit einem Klick autonom über den
              KI-Orchestrator bereitstellen.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {blueprints.map((bp) => (
              <div
                key={bp.id}
                className="flex flex-col justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-930 p-4 space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      {bp.name}
                    </span>
                    <span className="rounded border border-netbird-500/40 bg-netbird-950 px-2 py-0.5 font-mono text-[9px] text-netbird">
                      {bp.category}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-nb-gray-400 leading-relaxed">
                    {bp.description}
                  </p>
                </div>
                <button
                  onClick={() =>
                    onRunPromptInCopilot(bp.prompt || bp.promptCommand || "")
                  }
                  className="w-full rounded-md bg-netbird/90 py-2 text-xs font-medium text-white hover:bg-netbird"
                >
                  Stack per KI bereitstellen →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {peersSubTab === "playbooks" && (
        <div className="rounded-xl border border-nb-gray-900 bg-nb-gray-940 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-400" />
              Scheduled AI Playbooks (Cron-Wartung)
            </h2>
            <p className="text-xs text-nb-gray-400 mt-0.5">
              Wiederkehrende autonome Health-Checks, Log-Bereinigungen und
              Sicherheits-Audits.
            </p>
          </div>
          <div className="space-y-2.5">
            {(activeProject?.scheduled_playbooks || []).map((pb) => {
              const cronLabel = pb.cron || pb.cron_expression || "0 3 * * *";
              return (
                <div
                  key={pb.playbook_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-nb-gray-800 bg-nb-gray-930 p-3.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white truncate">
                        {pb.name}
                      </span>
                      <span className="rounded border border-nb-gray-700 bg-nb-gray-950 px-2 py-0.5 font-mono text-[10px] text-netbird">
                        🕒 {cronLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-nb-gray-400 truncate mt-1">
                      {pb.prompt}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onRunPromptInCopilot(pb.prompt)}
                      className="rounded border border-netbird-500/40 bg-netbird-950 px-2.5 py-1 font-mono text-[10px] text-netbird hover:bg-netbird hover:text-white"
                    >
                      Jetzt ausführen
                    </button>
                    <button
                      onClick={() => onTogglePlaybook(pb)}
                      className={`rounded border px-2.5 py-1 font-mono text-[10px] ${
                        pb.enabled
                          ? "border-emerald-500/40 bg-emerald-950 text-emerald-400"
                          : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-400"
                      }`}
                    >
                      {pb.enabled ? "AKTIV" : "PAUSIERT"}
                    </button>
                    <button
                      onClick={() => onDeletePlaybook(pb.playbook_id)}
                      className="text-nb-gray-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <form
            onSubmit={onAddPlaybook}
            className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 pt-2 text-xs"
          >
            <input
              type="text"
              value={playbookName}
              onChange={(e) => setPlaybookName(e.target.value)}
              placeholder="Playbook-Name..."
              className="rounded border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-white"
            />
            <input
              type="text"
              value={playbookCron}
              onChange={(e) => setPlaybookCron(e.target.value)}
              placeholder="0 */6 * * *"
              className="rounded border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-netbird"
            />
            <input
              type="text"
              value={playbookPrompt}
              onChange={(e) => setPlaybookPrompt(e.target.value)}
              placeholder="KI-Anweisung..."
              className="rounded border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-white"
            />
            <button
              type="submit"
              className="rounded bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500"
            >
              + Cron hinzufügen
            </button>
          </form>
        </div>
      )}
    </>
  );
}
