import React from "react";
import {
  Activity,
  BookOpen,
  Code2,
  Globe,
  MonitorSmartphone,
  Network,
  Settings,
  Shield,
  ShieldCheck,
} from "lucide-react";
import type {
  AuditEntry,
  GatewayNode,
  NavSection,
  ProjectState,
} from "@/types/synapse";

export function stripVolatileTimestamps(val: unknown): unknown {
  if (Array.isArray(val)) return val.map(stripVolatileTimestamps);
  if (val && typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (
        k === "updated_at" ||
        k === "last_checked" ||
        k === "timestamp_unix" ||
        k === "uptime_sec" ||
        k === "telemetry_history"
      ) {
        continue;
      }
      out[k] = stripVolatileTimestamps(v);
    }
    return out;
  }
  return val;
}

export function setIfChanged<T>(
  setter: React.Dispatch<React.SetStateAction<T>>,
  nextVal: T,
  ignoreVolatileTimestamps = false
) {
  setter((prev) => {
    try {
      const a = ignoreVolatileTimestamps
        ? JSON.stringify(stripVolatileTimestamps(prev))
        : JSON.stringify(prev);
      const b = ignoreVolatileTimestamps
        ? JSON.stringify(stripVolatileTimestamps(nextVal))
        : JSON.stringify(nextVal);
      return a === b ? prev : nextVal;
    } catch {
      return nextVal;
    }
  });
}

export function filterGatewayPeers(
  gatewayNodes: GatewayNode[],
  peerSearch: string,
  peerTierFilter: string
): GatewayNode[] {
  return gatewayNodes.filter((n) => {
    const matchesQuery =
      !peerSearch.trim() ||
      n.node_id.toLowerCase().includes(peerSearch.toLowerCase()) ||
      (n.last_heartbeat?.hostname || "")
        .toLowerCase()
        .includes(peerSearch.toLowerCase()) ||
      (n.last_heartbeat?.private_ipv4 || "").includes(peerSearch);
    const matchesTier = peerTierFilter === "ALL" || n.tier === peerTierFilter;
    return matchesQuery && matchesTier;
  });
}

export function filterAuditLogs(
  auditLogs: AuditEntry[],
  activitySearch: string,
  activityStatusFilter: string
): AuditEntry[] {
  return auditLogs.filter((l) => {
    const matchesQuery =
      !activitySearch.trim() ||
      l.tool_name.toLowerCase().includes(activitySearch.toLowerCase()) ||
      l.summary.toLowerCase().includes(activitySearch.toLowerCase()) ||
      (l.node_id || "").toLowerCase().includes(activitySearch.toLowerCase());
    const matchesStatus =
      activityStatusFilter === "ALL" ||
      (activityStatusFilter === "executed"
        ? l.status === "executed" || l.status === "approved"
        : activityStatusFilter === "blocked"
        ? l.status === "blocked" ||
          l.status === "rejected" ||
          l.status === "error"
        : l.status === activityStatusFilter);
    return matchesQuery && matchesStatus;
  });
}

export function buildControlCenterSidebarItems({
  isDe,
  unhealthyServicesCount,
  pendingApprovalsCount,
  activeProject,
  primaryNode,
}: {
  isDe: boolean;
  unhealthyServicesCount: number;
  pendingApprovalsCount: number;
  activeProject: ProjectState | null;
  primaryNode: string;
}): Array<{
  id: NavSection;
  section: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  badge?: string | number;
  badgeColor?: "orange" | "green" | "red";
}> {
  return [
    {
      id: "control-center",
      section: isDe ? "Übersicht & Dienste" : "Overview & Services",
      label: isDe ? "Übersicht" : "Overview",
      icon: Network,
    },
    {
      id: "reverse-proxy",
      section: isDe ? "Übersicht & Dienste" : "Overview & Services",
      label: "Services",
      icon: Globe,
      badge:
        unhealthyServicesCount > 0 ? `${unhealthyServicesCount} !` : undefined,
      badgeColor: unhealthyServicesCount > 0 ? "red" : undefined,
    },
    {
      id: "peers",
      section: isDe ? "Übersicht & Dienste" : "Overview & Services",
      label: "Server & Mesh",
      icon: MonitorSmartphone,
    },
    {
      id: "brain-vault",
      section: isDe ? "Projekt & Dateien" : "Project & Files",
      label: "Brain Vault",
      icon: BookOpen,
    },
    {
      id: "workspace",
      section: isDe ? "Projekt & Dateien" : "Project & Files",
      label: isDe ? "Dateien" : "Files",
      icon: Code2,
    },
    {
      id: "firewall",
      section: isDe ? "Sicherheit & System" : "Security & System",
      label: "Firewall",
      icon: ShieldCheck,
      badge:
        activeProject?.firewall_policies?.[primaryNode || "local-node"]
          ?.profile === "synapse_stealth"
          ? "Stealth"
          : undefined,
      badgeColor: "green",
    },
    {
      id: "access-control",
      section: isDe ? "Sicherheit & System" : "Security & System",
      label: isDe ? "Regeln" : "Rules",
      icon: Shield,
      badge: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
      badgeColor: pendingApprovalsCount > 0 ? "orange" : undefined,
    },
    {
      id: "activity",
      section: isDe ? "Sicherheit & System" : "Security & System",
      label: "Audit-Log",
      icon: Activity,
    },
    {
      id: "settings",
      section: isDe ? "Sicherheit & System" : "Security & System",
      label: isDe ? "Einstellungen" : "Settings",
      icon: Settings,
    },
  ];
}
