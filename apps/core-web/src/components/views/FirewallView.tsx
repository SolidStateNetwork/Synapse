"use client";

import React from "react";
import {
  Activity,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  FirewallDetectedPort,
  GatewayNode,
  ProjectState,
} from "@/types/synapse";
import { SynapseViewHeader } from "@/components/ui/SynapseDesignSystem";

export interface FirewallViewProps {
  activeProject: ProjectState | null;
  gatewayNodes: GatewayNode[];
  selectedNodeId: string;
  setSelectedNodeId: (id: string) => void;
  liveFirewallPorts: FirewallDetectedPort[];
  firewallBusy: boolean;
  firewallError: string;
  setFirewallError: (err: string) => void;
  fetchFirewallStatus: (nodeId?: string) => void;
  handleFirewallAction: (payload: {
    action:
      | "inspect"
      | "set_profile"
      | "shield_port"
      | "unshield_port"
      | "add_ip_rule"
      | "remove_ip_rule";
    node_id?: string;
    profile?: "web_standard" | "synapse_stealth" | "custom";
    port?: number;
    ip_or_cidr?: string;
    rule_action?: "allow" | "block";
    note?: string;
    rule_id?: string;
  }) => void;
  fwRuleAction: "block" | "allow";
  setFwRuleAction: (val: "block" | "allow") => void;
  fwIpInput: string;
  setFwIpInput: (val: string) => void;
  fwRulePort: string;
  setFwRulePort: (val: string) => void;
  fwRuleNote: string;
  setFwRuleNote: (val: string) => void;
  handleAddFirewallIpRule: (e: React.FormEvent) => void;
  onAskCopilot: (prompt: string) => void;
}

export default function FirewallView({
  activeProject,
  gatewayNodes,
  selectedNodeId,
  setSelectedNodeId,
  liveFirewallPorts,
  firewallBusy,
  firewallError,
  setFirewallError,
  fetchFirewallStatus,
  handleFirewallAction,
  fwRuleAction,
  setFwRuleAction,
  fwIpInput,
  setFwIpInput,
  fwRulePort,
  setFwRulePort,
  fwRuleNote,
  setFwRuleNote,
  handleAddFirewallIpRule,
  onAskCopilot,
}: FirewallViewProps) {
  const targetNode =
    selectedNodeId ||
    activeProject?.assigned_nodes?.[0]?.node_id ||
    gatewayNodes[0]?.node_id ||
    "vps2-muscle";

  const nodePolicy = activeProject?.firewall_policies?.[targetNode] || {
    node_id: targetNode,
    profile: "web_standard" as const,
    backend: "iptables + SYNAPSE_FW Shield",
    anti_lockout_active: true,
    rollback_guard_seconds: 15,
    ssh_port: 22,
    shielded_ports: [] as number[],
    ip_rules: [],
    detected_ports: [],
    last_synced_at: new Date().toISOString(),
  };

  const portsList: FirewallDetectedPort[] =
    liveFirewallPorts.length > 0
      ? liveFirewallPorts
      : nodePolicy.detected_ports && nodePolicy.detected_ports.length > 0
        ? nodePolicy.detected_ports
        : [
            {
              port: nodePolicy.ssh_port || 22,
              protocol: "tcp",
              bind_address: "0.0.0.0",
              exposure: "public",
              process: "sshd",
              pid: undefined,
              service_name: "SSH Server-Zugang (Anti-Lockout)",
              shielded: false,
              system_protected: true,
            },
            ...(activeProject?.registered_services || [])
              .filter((s) => s.node_id === targetNode)
              .map((s) => ({
                port: s.port,
                protocol: "tcp" as const,
                bind_address: "0.0.0.0",
                exposure: "public" as const,
                process: "python3",
                pid: undefined,
                service_name: s.name,
                shielded: nodePolicy.shielded_ports.includes(s.port),
                system_protected: false,
              })),
          ];

  const publicOpenCount = portsList.filter(
    (p) => p.exposure === "public" && !p.shielded && !p.system_protected
  ).length;
  const shieldedCount = portsList.filter((p) => p.shielded).length;
  const localOnlyCount = portsList.filter((p) => p.exposure === "local").length;

  const availableNodes = Array.from(
    new Set([
      ...gatewayNodes.map((n) => n.node_id),
      ...(activeProject?.assigned_nodes || []).map((n) => n.node_id),
      targetNode,
    ])
  ).filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-5">
      <SynapseViewHeader
        icon={<ShieldCheck className="h-5 w-5" />}
        accentColor="emerald"
        title="Firewall & Port-Schutz"
        badgeText="Anti-Lockout & 15s Rollback aktiv"
        badgeTone="emerald"
        description="Sperre offene Ports mit 1 Klick nach außen für das öffentliche Internet, während deine Dienste über den verschlüsselten Synapse-Tunnel (127.0.0.1) weiterhin unter Services erreichbar bleiben."
        actions={
          <>
            <div className="flex items-center gap-1 rounded-xl border border-[#1f2735] bg-[#0b0e14] p-1">
              {availableNodes.map((nid) => {
                const active = nid === targetNode;
                return (
                  <button
                    key={nid}
                    type="button"
                    onClick={() => {
                      setSelectedNodeId(nid);
                      fetchFirewallStatus(nid);
                    }}
                    className={`rounded-lg px-2.5 py-1 font-mono text-xs transition ${
                      active
                        ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 font-semibold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {nid}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={firewallBusy}
              onClick={() => fetchFirewallStatus(targetNode)}
              className="flex items-center gap-1.5 rounded-xl border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs font-medium text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  firewallBusy ? "animate-spin text-netbird" : ""
                }`}
              />
              <span>
                {firewallBusy ? "Synchronisiere..." : "Port-Radar scannen"}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                onAskCopilot(
                  `Prüfe mit \`node_firewall_control\` (\`action: "inspect"\`) alle offenen Ports und Firewall-Regeln auf \`@${targetNode}\` und gib mir eine kurze, leicht verständliche Sicherheitsempfehlung auf Deutsch.`
                )
              }
              className="flex items-center gap-1.5 rounded-xl border border-netbird-500/50 bg-netbird-950 px-3 py-2 text-xs font-medium text-netbird hover:bg-netbird hover:text-white transition"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>KI-Beratung</span>
            </button>
          </>
        }
      />

      {firewallError && (
        <div className="rounded-xl border border-red-500/50 bg-red-950/40 px-4 py-3 text-xs text-red-300 flex items-center justify-between">
          <span>⚠️ {firewallError}</span>
          <button
            type="button"
            onClick={() => setFirewallError("")}
            className="text-red-300 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 1. 1-CLICK SECURITY PROFILES */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-nb-gray-400">
            1. 1-Klick Sicherheits-Profile
          </span>
          <span className="font-mono text-[11px] text-nb-gray-400">
            Aktives Backend:{" "}
            <span className="text-nb-gray-200">
              {nodePolicy.backend || "iptables + SYNAPSE_FW"}
            </span>{" "}
            · SSH-Schutz:{" "}
            <span className="text-emerald-400">
              Port :{nodePolicy.ssh_port || 22}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* Profile 1: Web-Server Standard */}
          <div
            onClick={() =>
              handleFirewallAction({
                action: "set_profile",
                node_id: targetNode,
                profile: "web_standard",
              })
            }
            className={`cursor-pointer rounded-xl border p-4 transition ${
              nodePolicy.profile === "web_standard"
                ? "border-emerald-500 bg-emerald-950/20 ring-1 ring-emerald-500/30"
                : "border-nb-gray-850 bg-nb-gray-940 hover:border-nb-gray-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950 px-2.5 py-0.5 text-[10.5px] font-semibold text-emerald-300">
                🟢 Web-Server Modus (Standard)
              </span>
              {nodePolicy.profile === "web_standard" && (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                  AKTIV
                </span>
              )}
            </div>
            <h3 className="mt-2.5 text-sm font-semibold text-white">
              Webseiten offen, interne Dienste geschützt
            </h3>
            <p className="mt-1 text-xs text-nb-gray-400 leading-relaxed">
              Erlaubt öffentlich nur SSH (:{nodePolicy.ssh_port || 22}) sowie
              HTTP/HTTPS (:80/:443). Interne Backend- &amp; Datenbank-Ports
              werden nach außen abgeschirmt.
            </p>
          </div>

          {/* Profile 2: Synapse Stealth / Zero-Port */}
          <div
            onClick={() =>
              handleFirewallAction({
                action: "set_profile",
                node_id: targetNode,
                profile: "synapse_stealth",
              })
            }
            className={`cursor-pointer rounded-xl border p-4 transition ${
              nodePolicy.profile === "synapse_stealth"
                ? "border-sky-500 bg-sky-950/25 ring-1 ring-sky-500/30"
                : "border-nb-gray-850 bg-nb-gray-940 hover:border-nb-gray-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-950 px-2.5 py-0.5 text-[10.5px] font-semibold text-sky-300">
                🛡️ Synapse Stealth-Modus (Zero-Port)
              </span>
              {nodePolicy.profile === "synapse_stealth" && (
                <span className="rounded bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300">
                  AKTIV
                </span>
              )}
            </div>
            <h3 className="mt-2.5 text-sm font-semibold text-white">
              Alle App-Ports nach außen unsichtbar
            </h3>
            <p className="mt-1 text-xs text-nb-gray-400 leading-relaxed">
              Blockiert alle Anwendungs-Ports für das Internet (nur SSH bleibt
              als Notfallzugang offen). Alle Apps laufen sicher über den
              Synapse-Tunnel!
            </p>
          </div>

          {/* Profile 3: Custom */}
          <div
            onClick={() =>
              handleFirewallAction({
                action: "set_profile",
                node_id: targetNode,
                profile: "custom",
              })
            }
            className={`cursor-pointer rounded-xl border p-4 transition ${
              nodePolicy.profile === "custom"
                ? "border-netbird bg-netbird-950/25 ring-1 ring-netbird/30"
                : "border-nb-gray-850 bg-nb-gray-940 hover:border-nb-gray-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-netbird-500/40 bg-netbird-950 px-2.5 py-0.5 text-[10.5px] font-semibold text-netbird">
                ⚙️ Benutzerdefiniert
              </span>
              {nodePolicy.profile === "custom" && (
                <span className="rounded bg-netbird/20 px-2 py-0.5 font-mono text-[10px] font-bold text-netbird">
                  AKTIV
                </span>
              )}
            </div>
            <h3 className="mt-2.5 text-sm font-semibold text-white">
              Einzelne Ports &amp; IPs selbst steuern
            </h3>
            <p className="mt-1 text-xs text-nb-gray-400 leading-relaxed">
              Entscheide unten im Live Port-Radar für jeden Port einzeln per
              Klick, ob er öffentlich oder nur über Synapse erreichbar sein
              soll.
            </p>
          </div>
        </div>
      </div>

      {/* 2. LIVE PORT-RADAR */}
      <div className="rounded-xl border border-nb-gray-900 bg-nb-gray-940 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="h-4 w-4 text-netbird" />
              <span>
                2. Live Port-Radar ({portsList.length} aktive Ports auf{" "}
                {targetNode})
              </span>
            </h3>
            <p className="text-xs text-nb-gray-400 mt-0.5">
              Wenn du einen Port „Nach außen sperrst“, wird er für Fremde im
              Internet blockiert, funktioniert aber unter{" "}
              <strong className="text-nb-gray-200">Services</strong> im
              Synapse-Browser weiterhin!
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-lg border border-red-500/30 bg-red-950/40 px-2.5 py-1 text-red-300 font-medium">
              🔴 {publicOpenCount} Öffentlich offen
            </span>
            <span className="rounded-lg border border-sky-500/30 bg-sky-950/40 px-2.5 py-1 text-sky-300 font-medium">
              🛡️ {shieldedCount} Durch Firewall geschützt
            </span>
            <span className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-emerald-300 font-medium">
              🟢 {localOnlyCount} Nur lokal (127.0.0.1)
            </span>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-nb-gray-850 bg-nb-gray-950">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-nb-gray-850 bg-nb-gray-930/70 text-[11px] font-medium uppercase text-nb-gray-400">
              <tr>
                <th className="py-2.5 px-3">Port</th>
                <th className="py-2.5 px-3">Dienst / Programm</th>
                <th className="py-2.5 px-3">Bind-Adresse</th>
                <th className="py-2.5 px-3">Sichtbarkeit im Internet</th>
                <th className="py-2.5 px-3 text-right">1-Klick Schutz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nb-gray-900">
              {portsList.map((item) => {
                const isSsh =
                  item.system_protected ||
                  item.port === (nodePolicy.ssh_port || 22);
                return (
                  <tr
                    key={`${item.protocol}:${item.port}`}
                    className="hover:bg-nb-gray-930/40 transition-colors"
                  >
                    <td className="py-3 px-3 font-mono font-bold text-white whitespace-nowrap">
                      :{item.port}{" "}
                      <span className="text-[10px] font-normal uppercase text-nb-gray-400">
                        {item.protocol}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-white">
                        {item.service_name || item.process}
                      </div>
                      <div className="font-mono text-[10.5px] text-nb-gray-400">
                        Prozess: {item.process}
                        {item.pid ? ` (PID ${item.pid})` : ""}
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-nb-gray-300 whitespace-nowrap">
                      {item.bind_address}:{item.port}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {isSsh ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                          🛡️ Geschützter System-Port (SSH)
                        </span>
                      ) : item.exposure === "local" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                          🟢 Sicher · Nur lokal (127.0.0.1)
                        </span>
                      ) : item.shielded ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-950/60 px-2.5 py-0.5 text-[11px] font-medium text-sky-300">
                          🛡️ Durch Firewall geschützt (Nur Synapse-Tunnel)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-950/50 px-2.5 py-0.5 text-[11px] font-medium text-red-300">
                          🔴 Öffentlich im Internet offen
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {isSsh ? (
                        <span className="font-mono text-[11px] text-nb-gray-500">
                          Anti-Lockout aktiv
                        </span>
                      ) : item.exposure === "local" ? (
                        <span className="font-mono text-[11px] text-emerald-400">
                          Bereits lokal isoliert
                        </span>
                      ) : item.shielded ? (
                        <button
                          type="button"
                          disabled={firewallBusy}
                          onClick={() =>
                            handleFirewallAction({
                              action: "unshield_port",
                              node_id: targetNode,
                              port: item.port,
                            })
                          }
                          className="rounded-lg border border-nb-gray-700 bg-nb-gray-900 px-3 py-1.5 text-[11px] font-medium text-nb-gray-200 hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-50 transition"
                        >
                          🔓 Öffentlich freigeben
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={firewallBusy}
                          onClick={() =>
                            handleFirewallAction({
                              action: "shield_port",
                              node_id: targetNode,
                              port: item.port,
                            })
                          }
                          className="rounded-lg border border-sky-500/50 bg-sky-950/70 px-3 py-1.5 text-[11px] font-semibold text-sky-200 hover:bg-sky-600 hover:text-white disabled:opacity-50 transition"
                        >
                          🔒 Nach außen sperren
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. IP-BLOCKER & WHITELIST */}
      <div className="rounded-xl border border-nb-gray-900 bg-nb-gray-940 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span>
                3. IP-Blocker &amp; Whitelist (
                {nodePolicy.ip_rules?.length || 0} Regeln)
              </span>
            </h3>
            <p className="text-xs text-nb-gray-400 mt-0.5">
              Sperre verdächtige IP-Adressen sofort oder gib bestimmte Ports
              exklusiv für deine eigene IP-Adresse frei.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setFwRuleAction("block");
                setFwIpInput("198.51.100.99");
                setFwRulePort("");
                setFwRuleNote("Verdächtiger Scanner / Bot");
              }}
              className="rounded-md border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1 text-nb-gray-300 hover:text-white"
            >
              Vorlage: Angreifer-IP blockieren
            </button>
            <button
              type="button"
              onClick={() => {
                setFwRuleAction("allow");
                setFwIpInput("203.0.113.10");
                setFwRulePort("4070");
                setFwRuleNote("Admin Office IP");
              }}
              className="rounded-md border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1 text-nb-gray-300 hover:text-white"
            >
              Vorlage: Eigene IP freigeben
            </button>
          </div>
        </div>

        <form
          onSubmit={handleAddFirewallIpRule}
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-5 text-xs"
        >
          <select
            value={fwRuleAction}
            onChange={(e) =>
              setFwRuleAction(e.target.value as "block" | "allow")
            }
            className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-white"
          >
            <option value="block">🚫 IP blockieren (Sperre)</option>
            <option value="allow">✅ IP erlauben (Whitelist)</option>
          </select>

          <input
            type="text"
            value={fwIpInput}
            onChange={(e) => setFwIpInput(e.target.value)}
            placeholder="IP oder CIDR (z.B. 203.0.113.50)"
            className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-white placeholder:text-nb-gray-500"
          />

          <input
            type="number"
            value={fwRulePort}
            onChange={(e) => setFwRulePort(e.target.value)}
            placeholder="Port (leer = Alle Ports)"
            className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-white placeholder:text-nb-gray-500"
          />

          <input
            type="text"
            value={fwRuleNote}
            onChange={(e) => setFwRuleNote(e.target.value)}
            placeholder="Notiz (z.B. Büro-VPN)"
            className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-white placeholder:text-nb-gray-500"
          />

          <button
            type="submit"
            disabled={firewallBusy || !fwIpInput.trim()}
            className="rounded-lg bg-netbird px-3.5 py-2 font-medium text-white hover:bg-netbird-500 disabled:opacity-50 transition"
          >
            + IP-Regel speichern
          </button>
        </form>

        {(nodePolicy.ip_rules?.length || 0) === 0 ? (
          <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-950 p-4 text-center text-xs text-nb-gray-500">
            Noch keine benutzerdefinierten IP-Sperren oder Whitelists
            eingetragen.
          </div>
        ) : (
          <div className="space-y-2">
            {nodePolicy.ip_rules.map((r) => (
              <div
                key={r.rule_id}
                className="flex items-center justify-between gap-3 rounded-lg border border-nb-gray-850 bg-nb-gray-950 px-3.5 py-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`rounded-md border px-2 py-0.5 font-mono text-[10.5px] font-bold ${
                      r.action === "block"
                        ? "border-red-500/40 bg-red-950/60 text-red-300"
                        : "border-emerald-500/40 bg-emerald-950/60 text-emerald-300"
                    }`}
                  >
                    {r.action === "block" ? "🚫 BLOCKIERT" : "✅ ERLAUBT"}
                  </span>
                  <span className="font-mono font-semibold text-white">
                    {r.ip_or_cidr}
                  </span>
                  <span className="font-mono text-nb-gray-400">
                    →{" "}
                    {r.port
                      ? `Port :${r.port} (${(
                          r.protocol || "tcp"
                        ).toUpperCase()})`
                      : "Alle Ports"}
                  </span>
                  {r.note && (
                    <span className="rounded bg-nb-gray-900 px-2 py-0.5 text-[11px] text-nb-gray-300">
                      {r.note}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={firewallBusy}
                  onClick={() =>
                    handleFirewallAction({
                      action: "remove_ip_rule",
                      node_id: targetNode,
                      rule_id: r.rule_id,
                    })
                  }
                  className="rounded p-1 text-nb-gray-400 hover:bg-red-950/50 hover:text-red-400"
                  title="IP-Regel entfernen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
