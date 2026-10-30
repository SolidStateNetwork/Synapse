"use client";

import React, { useEffect, useState } from "react";
import type {
  AlertConfigState,
  BlueprintItem,
  CheckpointItem,
  DomainBindingItem,
  IntrusionScanState,
  OffsiteBackupItem,
  RegisteredService,
  SelfHealingEventItem,
  ServiceMeshLink,
} from "@/components/canvas/canvasTypes";
import { useCanvasStudioAndDomainActions } from "./useCanvasStudioAndDomainActions";

export interface UseCanvasOpsControllerParams {
  primaryNode: string;
  allServices: RegisteredService[];
  t: (de: string, en: string) => string;
}

export function useCanvasOpsController({
  primaryNode,
  allServices,
  t,
}: UseCanvasOpsControllerParams) {
  const defaultNodeId = primaryNode || "local-node";

  const [authEnabled, setAuthEnabled] = useState(false);
  const [authLocked, setAuthLocked] = useState(false);
  const [authRole, setAuthRole] = useState<"admin" | "operator">("admin");
  const [showAuthConfig, setShowAuthConfig] = useState(false);
  const [adminPwdInput, setAdminPwdInput] = useState("");
  const [operatorPwdInput, setOperatorPwdInput] = useState("");
  const [totpPinInput, setTotpPinInput] = useState("");
  const [unlockPwdInput, setUnlockPwdInput] = useState("");
  const [unlockPinInput, setUnlockPinInput] = useState("");
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([]);
  const [checkpointBusyId, setCheckpointBusyId] = useState<string | null>(null);
  const [checkpointNotice, setCheckpointNotice] = useState<string | null>(null);

  const [alertConfig, setAlertConfig] = useState<AlertConfigState | null>(null);
  const [showAlertChannels, setShowAlertChannels] = useState(false);
  const [alertBusy, setAlertBusy] = useState(false);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  const [serviceLinks, setServiceLinks] = useState<ServiceMeshLink[]>([]);

  // Dynamically derive initial topology links from registered service categories if none are stored yet
  useEffect(() => {
    if (!allServices || allServices.length < 2) return;
    setServiceLinks((prev) => {
      if (prev.length > 0) return prev;
      const derived: ServiceMeshLink[] = [];
      const webuis = allServices.filter((s) => s.category === "webui");
      const backends = allServices.filter(
        (s) => !s.category || s.category === "backend"
      );
      const dbs = allServices.filter((s) => s.category === "database");

      const primaryBackend = backends[0];
      const primaryDb = dbs[0];

      if (webuis[0] && primaryBackend) {
        derived.push({
          id: `${webuis[0].service_id}->${primaryBackend.service_id}`,
          fromServiceId: webuis[0].service_id,
          toServiceId: primaryBackend.service_id,
          protocol: "HTTP REST",
        });
      }
      if (primaryBackend && primaryDb) {
        derived.push({
          id: `${primaryBackend.service_id}->${primaryDb.service_id}`,
          fromServiceId: primaryBackend.service_id,
          toServiceId: primaryDb.service_id,
          protocol: "SQLite WAL",
        });
      }
      return derived;
    });
  }, [allServices]);

  const [blueprints, setBlueprints] = useState<BlueprintItem[]>([]);
  const [blueprintBusyId, setBlueprintBusyId] = useState<string | null>(null);
  const [blueprintNotice, setBlueprintNotice] = useState<string | null>(null);

  const [intrusionMap, setIntrusionMap] = useState<
    Record<string, IntrusionScanState>
  >({});
  const [intrusionBusyNode, setIntrusionBusyNode] = useState<string | null>(
    null
  );
  const [intrusionNotice, setIntrusionNotice] = useState<string | null>(null);

  const [offsiteBackups, setOffsiteBackups] = useState<OffsiteBackupItem[]>([]);
  const [backupBusyId, setBackupBusyId] = useState<string | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  const [domainBindings, setDomainBindings] = useState<
    Record<string, DomainBindingItem>
  >({});

  const [selfHealingEvents, setSelfHealingEvents] = useState<
    SelfHealingEventItem[]
  >([]);
  const [serviceSparklineMap, setServiceSparklineMap] = useState<
    Record<string, number[]>
  >({});

  useEffect(() => {
    if (!allServices || allServices.length === 0) return;
    setServiceSparklineMap((prev) => {
      const next = { ...prev };
      for (const s of allServices) {
        if (!s.service_id || s.service_id === "empty") continue;
        const lat = Math.max(
          1,
          s.latency_ms ?? s.health_check?.latency_ms ?? 1
        );
        const cur = next[s.service_id] || [1, 1, 1, 1, 1, lat];
        next[s.service_id] = [...cur.slice(-11), lat];
      }
      return next;
    });
  }, [allServices]);

  useEffect(() => {
    fetch("/api/auth")
      .then((r) => r.json())
      .then((d) => {
        if (d && typeof d.enabled === "boolean") {
          setAuthEnabled(d.enabled);
        }
      })
      .catch(() => {});
    fetch("/api/checkpoints")
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.checkpoints)) {
          setCheckpoints(d.checkpoints);
        }
      })
      .catch(() => {});
    fetch("/api/alerts")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.config) {
          setAlertConfig(d.config);
        }
      })
      .catch(() => {});
    fetch("/api/blueprints")
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.blueprints)) {
          setBlueprints(d.blueprints);
        }
      })
      .catch(() => {});
    fetch("/api/backups")
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.backups)) {
          setOffsiteBackups(d.backups);
        }
      })
      .catch(() => {});
    fetch("/api/service-ops")
      .then((r) => r.json())
      .then((d) => {
        if (d && d.domains) {
          setDomainBindings(d.domains);
          if (d.self_healing && Array.isArray(d.self_healing.events)) {
            setSelfHealingEvents(d.self_healing.events);
          }
          if (Array.isArray(d.service_links) && d.service_links.length > 0) {
            setServiceLinks(d.service_links);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleDeployBlueprint = async (
    bp: BlueprintItem,
    action: "deploy" | "undeploy"
  ) => {
    setBlueprintBusyId(bp.id);
    setBlueprintNotice(null);
    try {
      const res = await fetch("/api/blueprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          blueprint_id: bp.id,
          node_id: defaultNodeId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBlueprintNotice(
          action === "deploy"
            ? t(`🚀 ${bp.name} bereitgestellt!`, `🚀 ${bp.name} deployed!`)
            : t(`⏹ ${bp.name} gestoppt`, `⏹ ${bp.name} stopped`)
        );
      } else {
        setBlueprintNotice(data.error || "Blueprint error");
      }
    } catch {
      setBlueprintNotice(t("Blueprint-Fehler", "Blueprint error"));
    } finally {
      setBlueprintBusyId(null);
      setTimeout(() => setBlueprintNotice(null), 4000);
    }
  };

  const handleCreateOffsiteBackup = async (nodeId: string) => {
    setBackupBusyId("create");
    setBackupNotice(null);
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          node_id: nodeId,
          title: `Core Vault Backup (${nodeId})`,
        }),
      });
      const data = await res.json();
      if (data.backups) setOffsiteBackups(data.backups);
      setBackupNotice(
        data.ok
          ? t(
              "🔐 AES-256-GCM Backup im Core-Vault gespeichert!",
              "🔐 AES-256-GCM Backup saved in Core Vault!"
            )
          : t("Backup fehlgeschlagen", "Backup failed")
      );
    } catch {
      setBackupNotice(t("Backup-Fehler", "Backup error"));
    } finally {
      setBackupBusyId(null);
      setTimeout(() => setBackupNotice(null), 4500);
    }
  };

  const handleRestoreOffsiteBackup = async (bkp: OffsiteBackupItem) => {
    setBackupBusyId(bkp.id);
    setBackupNotice(null);
    try {
      const res = await fetch("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          backup_id: bkp.id,
        }),
      });
      const data = await res.json();
      if (data.backups) setOffsiteBackups(data.backups);
      setBackupNotice(
        data.ok
          ? t(
              "✔ Offsite-Backup auf Muscle wiederhergestellt!",
              "✔ Offsite backup restored to Muscle!"
            )
          : t("Wiederherstellung geprüft", "Restore checked")
      );
    } catch {
      setBackupNotice(t("Wiederherstellung fehlgeschlagen", "Restore failed"));
    } finally {
      setBackupBusyId(null);
      setTimeout(() => setBackupNotice(null), 4500);
    }
  };

  const handleScanIntrusions = async (nodeId: string) => {
    setIntrusionBusyNode(nodeId);
    setIntrusionNotice(null);
    try {
      const res = await fetch("/api/service-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "intrusion_scan",
          node_id: nodeId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setIntrusionMap((prev) => ({
          ...prev,
          [nodeId]: {
            failed_count_24h: data.failed_count_24h || 0,
            accepted_count_24h: data.accepted_count_24h || 0,
            top_attackers: data.top_attackers || [],
            blocked_ips: data.blocked_ips || [],
          },
        }));
      }
    } catch {
      setIntrusionNotice(t("Scan-Fehler", "Scan error"));
    } finally {
      setIntrusionBusyNode(null);
    }
  };

  const handleBlockAttackerIp = async (nodeId: string, ip: string) => {
    setIntrusionBusyNode(`${nodeId}:${ip}`);
    setIntrusionNotice(null);
    try {
      const res = await fetch("/api/service-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "block_attacker",
          node_id: nodeId,
          ip,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setIntrusionMap((prev) => {
          const cur = prev[nodeId] || {
            failed_count_24h: 0,
            accepted_count_24h: 0,
            top_attackers: [],
            blocked_ips: [],
          };
          return {
            ...prev,
            [nodeId]: {
              ...cur,
              blocked_ips: data.blocked_ips || [...cur.blocked_ips, ip],
            },
          };
        });
        setIntrusionNotice(
          t(`🛡️ IP ${ip} gesperrt!`, `🛡️ IP ${ip} blocked!`)
        );
      }
    } finally {
      setIntrusionBusyNode(null);
      setTimeout(() => setIntrusionNotice(null), 4000);
    }
  };

  const handleCreateCheckpoint = async (nodeId: string) => {
    setCheckpointBusyId("create");
    setCheckpointNotice(null);
    try {
      const res = await fetch("/api/checkpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          node_id: nodeId,
          title: `Manual Snapshot (${nodeId})`,
          actor: "Admin",
        }),
      });
      const data = await res.json();
      if (data.checkpoints) setCheckpoints(data.checkpoints);
      setCheckpointNotice(
        t(
          "✔ Snapshot erfolgreich gespeichert!",
          "✔ Snapshot saved successfully!"
        )
      );
    } catch {
      setCheckpointNotice(t("Fehler beim Snapshot", "Snapshot failed"));
    } finally {
      setCheckpointBusyId(null);
      setTimeout(() => setCheckpointNotice(null), 4000);
    }
  };

  const handleRollbackCheckpoint = async (chk: CheckpointItem) => {
    setCheckpointBusyId(chk.id);
    setCheckpointNotice(null);
    try {
      const res = await fetch("/api/checkpoints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rollback",
          checkpoint_id: chk.id,
        }),
      });
      const data = await res.json();
      if (data.checkpoints) setCheckpoints(data.checkpoints);
      setCheckpointNotice(
        data.ok
          ? t(
              `⏪ Rollback auf "${chk.title}" ausgeführt!`,
              `⏪ Rolled back to "${chk.title}"!`
            )
          : t("Rollback-Warnung geprüft", "Rollback warning checked")
      );
    } catch {
      setCheckpointNotice(t("Rollback fehlgeschlagen", "Rollback failed"));
    } finally {
      setCheckpointBusyId(null);
      setTimeout(() => setCheckpointNotice(null), 4500);
    }
  };

  const handleSendTestAlert = async () => {
    setAlertBusy(true);
    setAlertNotice(null);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_alert",
          node_id: defaultNodeId,
        }),
      });
      const data = await res.json();
      if (data.config) setAlertConfig(data.config);
      setAlertNotice(
        t("🔔 Test-Alarm erfolgreich ausgelöst!", "🔔 Test alert dispatched!")
      );
    } catch {
      setAlertNotice(t("Fehler beim Test-Alarm", "Test alert error"));
    } finally {
      setAlertBusy(false);
      setTimeout(() => setAlertNotice(null), 4000);
    }
  };

  const handleSaveAlertConfig = async (patch: Partial<AlertConfigState>) => {
    if (!alertConfig) return;
    const next = { ...alertConfig, ...patch };
    setAlertConfig(next);
    setAlertBusy(true);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure",
          ...next,
        }),
      });
      const data = await res.json();
      if (data.config) setAlertConfig(data.config);
      setAlertNotice(t("✔ Alarm-Regeln gespeichert", "✔ Alert rules saved"));
    } finally {
      setAlertBusy(false);
      setTimeout(() => setAlertNotice(null), 3500);
    }
  };

  const handleConfigureAuth = async (enableProtection: boolean) => {
    setAuthNotice(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure",
          enabled: enableProtection,
          admin_password: adminPwdInput || "synapse-admin",
          operator_password: operatorPwdInput,
          totp_pin: totpPinInput,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAuthEnabled(Boolean(data.enabled));
        setAuthNotice(
          data.enabled
            ? t(
                "🔒 WebUI Passwort-Schutz aktiviert",
                "🔒 WebUI Password Protection enabled"
              )
            : t(
                "🔓 WebUI Passwort-Schutz deaktiviert",
                "🔓 WebUI Password Protection disabled"
              )
        );
      } else {
        setAuthNotice(data.error || "Auth error");
      }
    } catch {
      setAuthNotice("Auth config error");
    }
    setTimeout(() => setAuthNotice(null), 4000);
  };

  const handleUnlockDashboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthNotice(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          password: unlockPwdInput,
          pin: unlockPinInput,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAuthRole(data.role || "admin");
        setAuthLocked(false);
        setUnlockPwdInput("");
        setUnlockPinInput("");
      } else {
        setAuthNotice(
          t("Falsches Passwort oder 2FA-PIN", "Invalid password or 2FA PIN")
        );
      }
    } catch {
      setAuthNotice(t("Anmeldung fehlgeschlagen", "Login failed"));
    }
  };

  const studioAndDomain = useCanvasStudioAndDomainActions({
    primaryNode,
    allServices,
    t,
    serviceLinks,
    setServiceLinks,
    domainBindings,
    setDomainBindings,
    selfHealingEvents,
    setSelfHealingEvents,
    serviceSparklineMap,
    setServiceSparklineMap,
  });

  return {
    authEnabled,
    authLocked,
    setAuthLocked,
    authRole,
    showAuthConfig,
    setShowAuthConfig,
    adminPwdInput,
    setAdminPwdInput,
    operatorPwdInput,
    setOperatorPwdInput,
    totpPinInput,
    setTotpPinInput,
    unlockPwdInput,
    setUnlockPwdInput,
    unlockPinInput,
    setUnlockPinInput,
    authNotice,
    checkpoints,
    checkpointBusyId,
    checkpointNotice,
    alertConfig,
    showAlertChannels,
    setShowAlertChannels,
    alertBusy,
    alertNotice,
    serviceLinks,
    blueprints,
    blueprintBusyId,
    blueprintNotice,
    intrusionMap,
    intrusionBusyNode,
    intrusionNotice,
    offsiteBackups,
    backupBusyId,
    backupNotice,
    domainBindings,
    selfHealingEvents,
    serviceSparklineMap,
    handleDeployBlueprint,
    handleCreateOffsiteBackup,
    handleRestoreOffsiteBackup,
    handleScanIntrusions,
    handleBlockAttackerIp,
    handleCreateCheckpoint,
    handleRollbackCheckpoint,
    handleSendTestAlert,
    handleSaveAlertConfig,
    handleConfigureAuth,
    handleUnlockDashboard,
    ...studioAndDomain,
  };
}
