"use client";

import React from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Network,
  Plus,
  Search,
  Server,
  Sparkles,
} from "lucide-react";
import {
  SynapseSubTabs,
  SynapseViewHeader,
} from "@/components/ui/SynapseDesignSystem";
import {
  AutonomyTier,
  GatewayNode,
  NavSection,
  ProjectState,
  StackBlueprint,
} from "@/types/synapse";
import {
  PeersMeshAndAutomationSubTabs,
  ScheduledPlaybookItem,
} from "./peers/PeersMeshAndAutomationSubTabs";

export type { ScheduledPlaybookItem };

export interface PeersViewProps {
  activeProject: ProjectState | null;
  gatewayNodes: GatewayNode[];
  filteredPeers: GatewayNode[];
  blueprints: StackBlueprint[];
  peersSubTab: "nodes" | "mesh" | "blueprints" | "playbooks";
  setPeersSubTab: React.Dispatch<
    React.SetStateAction<"nodes" | "mesh" | "blueprints" | "playbooks">
  >;
  peerSearch: string;
  setPeerSearch: (val: string) => void;
  peerTierFilter: string;
  setPeerTierFilter: (val: string) => void;
  expandedPeerRows: Record<string, boolean>;
  setExpandedPeerRows: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  systemUpdateBusy: boolean;
  onRunSystemUpdate: (
    action: "check" | "update_all" | "update_core" | "update_muscle",
    targetNodeId?: string
  ) => void;
  onOpenAddPeerModal: () => void;
  onSelectNodeAndNavigate: (nodeId: string, nav: NavSection) => void;
  onOpenTerminalForNode: (nodeId: string) => void;
  onAssignNode: (nodeId: string, tier: AutonomyTier) => void;
  onUnassignNode: (nodeId: string) => void;
  onOpenServiceInProxy: (serviceId: string, port: number) => void;
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

const PeersView = React.memo(function PeersView({
  activeProject,
  gatewayNodes,
  filteredPeers,
  blueprints,
  peersSubTab,
  setPeersSubTab,
  peerSearch,
  setPeerSearch,
  peerTierFilter,
  setPeerTierFilter,
  expandedPeerRows,
  setExpandedPeerRows,
  systemUpdateBusy,
  onRunSystemUpdate,
  onOpenAddPeerModal,
  onSelectNodeAndNavigate,
  onOpenTerminalForNode,
  onAssignNode,
  onUnassignNode,
  onOpenServiceInProxy,
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
}: PeersViewProps) {
  return (
    <div className="mx-auto max-w-6xl p-6 space-y-5">
      <SynapseViewHeader
        icon={<Server className="h-5 w-5" />}
        accentColor="indigo"
        title="Server & Mesh-Netzwerk"
        description="Verwalte alle angeschlossenen Muscle-Server, verknüpfe Dienste über verschlüsselte P2P-Mesh-Tunnel oder stelle komplette Infrastruktur-Stacks und Cron-Playbooks per 1-Klick bereit."
        actions={
          <button
            onClick={onOpenAddPeerModal}
            className="flex items-center gap-1.5 rounded-xl bg-netbird px-3.5 py-2 text-xs font-medium text-white hover:bg-netbird-500 transition shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Server hinzufügen</span>
          </button>
        }
        subTabs={
          <SynapseSubTabs
            activeTab={peersSubTab}
            onChange={(id) =>
              setPeersSubTab(id as "nodes" | "mesh" | "blueprints" | "playbooks")
            }
            tabs={[
              {
                id: "nodes",
                label: "Server",
                icon: <Server className="h-3.5 w-3.5" />,
                badge: gatewayNodes.length,
              },
              {
                id: "mesh",
                label: "P2P Mesh-Links",
                icon: <Network className="h-3.5 w-3.5" />,
                badge: (activeProject?.peer_mesh_links || []).length,
              },
              {
                id: "blueprints",
                label: "Stack-Blueprints",
                icon: <Sparkles className="h-3.5 w-3.5" />,
                badge: blueprints.length,
              },
              {
                id: "playbooks",
                label: "Cron-Playbooks",
                icon: <Activity className="h-3.5 w-3.5" />,
                badge: (activeProject?.scheduled_playbooks || []).length,
              },
            ]}
          />
        }
      />

      {peersSubTab === "nodes" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-nb-gray-900 bg-nb-gray-940 p-3">
            <div className="flex flex-1 items-center gap-2 min-w-[240px]">
              <Search className="h-4 w-4 text-nb-gray-400 ml-1" />
              <input
                type="text"
                value={peerSearch}
                onChange={(e) => setPeerSearch(e.target.value)}
                placeholder="Server nach Name, Hostname oder IP filtern..."
                className="flex-1 bg-transparent text-xs text-white placeholder:text-nb-gray-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {[
                { id: "ALL", label: "Alle Stufen" },
                { id: "TIER_1_UNLEASHED", label: "Stufe 1 · Vollzugriff" },
                { id: "TIER_2_WORKSPACE_JAIL", label: "Stufe 2 · Workspace" },
                { id: "TIER_3_SUPERVISED", label: "Stufe 3 · Überwacht" },
              ].map((tierOpt) => (
                <button
                  key={tierOpt.id}
                  onClick={() => setPeerTierFilter(tierOpt.id)}
                  className={`rounded-md border px-2.5 py-1 font-mono text-[10px] transition ${
                    peerTierFilter === tierOpt.id
                      ? "border-netbird-500 bg-netbird-950 text-netbird"
                      : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-300 hover:bg-nb-gray-900"
                  }`}
                >
                  {tierOpt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-nb-gray-900 bg-nb-gray-940">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-nb-gray-900 bg-nb-gray-930/70 text-[11px] font-medium uppercase text-nb-gray-400">
                <tr>
                  <th className="py-3 px-3">Server / Status</th>
                  <th className="py-3 px-3">Autonomie-Stufe</th>
                  <th className="py-3 px-3">Host &amp; System</th>
                  <th className="py-3 px-3">Auslastung</th>
                  <th className="py-3 px-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nb-gray-900">
                {filteredPeers.map((gn) => {
                  const hb = gn.last_heartbeat;
                  const isAssigned = activeProject?.assigned_nodes.some(
                    (a) => a.node_id === gn.node_id
                  );
                  const rowExpanded = Boolean(expandedPeerRows[gn.node_id]);
                  const nodeSvcs = (activeProject?.registered_services || []).filter(
                    (s) => s.node_id === gn.node_id
                  );

                  const tierHumanLabel =
                    gn.tier === "TIER_1_UNLEASHED"
                      ? "Stufe 1 · Vollzugriff"
                      : gn.tier === "TIER_2_WORKSPACE_JAIL"
                        ? "Stufe 2 · Workspace"
                        : "Stufe 3 · Überwacht";

                  return (
                    <React.Fragment key={gn.node_id}>
                      <tr
                        onClick={() =>
                          setExpandedPeerRows((prev) => ({
                            ...prev,
                            [gn.node_id]: !prev[gn.node_id],
                          }))
                        }
                        className="cursor-pointer hover:bg-nb-gray-930/50 transition-colors"
                      >
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                gn.online ? "bg-emerald-400" : "bg-nb-gray-500"
                              }`}
                            />
                            <div>
                              <div className="flex items-center gap-1.5 font-mono font-semibold text-white">
                                <span>{gn.node_id}</span>
                                {rowExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5 text-nb-gray-400" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 text-nb-gray-400" />
                                )}
                              </div>
                              <div className="text-[11px] text-nb-gray-400">
                                {hb?.hostname || gn.remote_addr}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <span className="rounded-md border border-netbird-500/50 bg-netbird-950 px-2 py-0.5 font-mono text-[10px] text-netbird">
                              {tierHumanLabel}
                            </span>
                            <span
                              title={(hb?.connected_cores || []).join("\n")}
                              className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                                (hb?.active_cores ?? 1) > 1
                                  ? "border-violet-500/50 bg-violet-950/80 text-violet-300"
                                  : "border-emerald-500/40 bg-emerald-950/60 text-emerald-300"
                              }`}
                            >
                              {(hb?.active_cores ?? 1) > 1
                                ? `Multi-Core · ${hb?.active_cores} Cores`
                                : "1 Core"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-mono text-nb-gray-200">
                            {hb?.private_ipv4 || "127.0.0.1"}
                          </div>
                          <div
                            className="font-mono text-[10.5px] text-nb-gray-400 max-w-[140px] truncate"
                            title={hb?.os_info || hb?.os_arch || "linux/amd64"}
                          >
                            {hb?.os_info
                              ? hb.os_info.split("(")[0].trim()
                              : hb?.os_arch || "linux/amd64"}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {hb ? (
                            <div className="flex items-center gap-2 font-mono text-[11px] text-nb-gray-300 whitespace-nowrap">
                              <span>CPU {hb.cpu_percent.toFixed(1)}%</span>
                              <span>RAM {hb.ram_percent.toFixed(1)}%</span>
                            </div>
                          ) : (
                            <span className="text-nb-gray-500">—</span>
                          )}
                        </td>
                        <td
                          className="py-3 px-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              disabled={systemUpdateBusy || !gn.online}
                              onClick={() =>
                                onRunSystemUpdate("update_muscle", gn.node_id)
                              }
                              title="Diesen Muscle-Server Over-the-Air (OTA) aktualisieren & neu starten"
                              className="rounded-md border border-emerald-500/40 bg-emerald-950/40 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-900/50 disabled:opacity-40"
                            >
                              {systemUpdateBusy ? "Update..." : "⬆️ OTA"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onSelectNodeAndNavigate(gn.node_id, "firewall")
                              }
                              title="Firewall & Port-Schutz für diesen Server öffnen"
                              className="rounded-md border border-sky-500/40 bg-sky-950/40 px-2 py-1 text-[11px] font-medium text-sky-300 hover:bg-sky-900/50"
                            >
                              🛡️ Firewall
                            </button>
                            <button
                              onClick={() => onOpenTerminalForNode(gn.node_id)}
                              className="rounded-md border border-nb-gray-800 bg-nb-gray-920 px-2 py-1 text-[11px] text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white"
                            >
                              Terminal
                            </button>
                            <button
                              onClick={() =>
                                isAssigned
                                  ? onUnassignNode(gn.node_id)
                                  : onAssignNode(gn.node_id, gn.tier)
                              }
                              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                                isAssigned
                                  ? "border border-red-500/40 bg-red-950/40 text-red-400 hover:bg-red-950"
                                  : "bg-netbird text-white hover:bg-netbird-500"
                              }`}
                            >
                              {isAssigned ? "Trennen" : "Zuweisen"}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {rowExpanded && (
                        <tr className="bg-nb-gray-950/80">
                          <td colSpan={5} className="p-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-xs">
                              <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-940 p-3 space-y-2">
                                <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-400">
                                  Live Ressourcen-Metriken
                                </div>
                                {[
                                  {
                                    label: "CPU",
                                    val: hb?.cpu_percent ?? 0,
                                    color: "bg-netbird",
                                  },
                                  {
                                    label: "RAM",
                                    val: hb?.ram_percent ?? 0,
                                    color: "bg-sky-400",
                                  },
                                  {
                                    label: "DISK",
                                    val: hb?.disk_percent ?? 0,
                                    color: "bg-emerald-400",
                                  },
                                ].map((m) => (
                                  <div
                                    key={m.label}
                                    className="space-y-1 font-mono text-[11px]"
                                  >
                                    <div className="flex justify-between text-nb-gray-300">
                                      <span>{m.label}</span>
                                      <span className="text-white">
                                        {m.val.toFixed(1)}%
                                      </span>
                                    </div>
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-nb-gray-900">
                                      <div
                                        className={`h-full rounded-full ${m.color}`}
                                        style={{
                                          width: `${Math.min(100, Math.max(3, m.val))}%`,
                                        }}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-940 p-3 space-y-2">
                                <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-400">
                                  Registrierte Dienste ({nodeSvcs.length})
                                </div>
                                {nodeSvcs.length === 0 ? (
                                  <div className="text-nb-gray-500 text-[11px]">
                                    Keine Dienste auf diesem Knoten.
                                  </div>
                                ) : (
                                  <div className="space-y-1.5">
                                    {nodeSvcs.map((s) => (
                                      <button
                                        key={s.service_id}
                                        type="button"
                                        onClick={() =>
                                          onOpenServiceInProxy(s.service_id, s.port)
                                        }
                                        className="flex w-full items-center justify-between gap-2 rounded border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1.5 text-left font-mono text-[11px] text-nb-gray-200 hover:border-netbird hover:text-white"
                                      >
                                        <span className="truncate min-w-0">
                                          {s.name
                                            .replace(new RegExp(`\\s*:${s.port}\\b`), "")
                                            .trim()}
                                        </span>
                                        <span className="text-netbird shrink-0 whitespace-nowrap">
                                          :{s.port} →
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-940 p-3 flex flex-col justify-between space-y-2">
                                <div className="space-y-1 font-mono text-[11px] text-nb-gray-300">
                                  <div className="text-[10px] font-semibold uppercase tracking-wider text-nb-gray-400 mb-1">
                                    Verbindungs-Details
                                  </div>
                                  <div>
                                    Remote:{" "}
                                    <span className="text-white">{gn.remote_addr}</span>
                                  </div>
                                  <div>
                                    Aktive PTYs:{" "}
                                    <span className="text-white">
                                      {hb?.active_pty_sessions?.length ?? 0}
                                    </span>
                                  </div>
                                  <div>
                                    Multi-Core ({hb?.active_cores ?? 1} Cores):{" "}
                                    <span className="text-violet-300">
                                      {(hb?.connected_cores &&
                                      hb.connected_cores.length > 0
                                        ? hb.connected_cores
                                        : [`primary (${gn.remote_addr} - LIVE)`]
                                      ).join(" · ")}
                                    </span>
                                  </div>
                                  <div>
                                    Verbunden seit:{" "}
                                    <span className="text-nb-gray-400">
                                      {gn.connected_at?.replace("T", " ").slice(0, 19)}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onSelectNodeAndNavigate(gn.node_id, "workspace")
                                    }
                                    className="flex-1 rounded border border-nb-gray-800 bg-nb-gray-950 py-1.5 text-[11px] font-medium text-nb-gray-200 hover:border-netbird hover:text-white"
                                  >
                                    Dateien öffnen
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenTerminalForNode(gn.node_id)}
                                    className="flex-1 rounded bg-netbird py-1.5 text-[11px] font-medium text-white hover:bg-netbird-500"
                                  >
                                    Live Shell
                                  </button>
                                </div>
                              </div>
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
      )}

      <PeersMeshAndAutomationSubTabs
        peersSubTab={peersSubTab}
        activeProject={activeProject}
        gatewayNodes={gatewayNodes}
        blueprints={blueprints}
        meshSourceNode={meshSourceNode}
        setMeshSourceNode={setMeshSourceNode}
        meshTargetNode={meshTargetNode}
        setMeshTargetNode={setMeshTargetNode}
        meshTargetPort={meshTargetPort}
        setMeshTargetPort={setMeshTargetPort}
        meshAliasEnv={meshAliasEnv}
        setMeshAliasEnv={setMeshAliasEnv}
        onAddMeshLink={onAddMeshLink}
        onRemoveMeshLink={onRemoveMeshLink}
        onRunPromptInCopilot={onRunPromptInCopilot}
        playbookName={playbookName}
        setPlaybookName={setPlaybookName}
        playbookCron={playbookCron}
        setPlaybookCron={setPlaybookCron}
        playbookPrompt={playbookPrompt}
        setPlaybookPrompt={setPlaybookPrompt}
        onAddPlaybook={onAddPlaybook}
        onTogglePlaybook={onTogglePlaybook}
        onDeletePlaybook={onDeletePlaybook}
      />
    </div>
  );
});

export default PeersView;
