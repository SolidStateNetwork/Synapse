"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowLeftRight,
  Bell,
  Bot,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Code2,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  FolderGit2,
  Globe,
  History,
  KeyRound,
  Link2,
  Lock,
  Maximize2,
  MonitorSmartphone,
  Move,
  Plus,
  RotateCcw,
  Server,
  Shield,
  Sparkles,
  Terminal as TerminalIcon,
  Unlock,
  Wrench,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type {
  AlertConfigState,
  AlertEventItem,
  AutonomyTier,
  BlueprintItem,
  CanvasEdge,
  CanvasPos,
  CartridgeMeta,
  ChaosResultState,
  CheckpointItem,
  DomainBindingItem,
  FlowView,
  GatewayNode,
  HeartbeatServiceStatus,
  InspectedTarget,
  InteractiveControlCenterCanvasProps as Props,
  IntrusionScanState,
  NodeHeartbeat,
  OffsiteBackupItem,
  RegisteredService,
  ServiceMeshLink,
  TelemetrySample,
} from "@/components/canvas/canvasTypes";
import {
  CanvasEdgesLayer,
  CoreHubInspectorPanel,
  MuscleNodeInspectorPanel,
  ServiceNodeInspectorPanel,
} from "@/components/canvas/CanvasInspectorDrawer";

export type { AutonomyTier, FlowView };

export default function InteractiveControlCenterCanvas({
  gatewayNodes,
  primaryNode,
  activeCartridges,
  cartridges,
  registeredServices,
  secretKeysCount,
  modelName,
  baseUrl,
  joinTier,
  onSelectNode,
  onToggleCartridge,
  onOpenAddPeer,
  onOpenPty,
  onOpenAiSettings,
  onOpenBrainDoc,
  onOpenSecretsVault,
  onOpenReverseProxy,
  onOpenAccessControl,
  onOpenRemoteFiles,
  onHealService,
  firewallPolicies,
  onOpenFirewall,
  onOpenSettings,
}: Props) {
  const { t, translateText } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [pan, setPan] = useState<CanvasPos>({ x: 60, y: 60 });
  const [zoom, setZoom] = useState<number>(1);
  const panRef = useRef<CanvasPos>({ x: 60, y: 60 });
  const zoomRef = useRef<number>(1);
  panRef.current = pan;
  zoomRef.current = zoom;

  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const [positions, setPositions] = useState<Record<string, CanvasPos>>({});
  const [sizes, setSizes] = useState<
    Record<string, { w: number; h: number }>
  >({});

  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const lastDragMovedRef = useRef<boolean>(false);
  const hasUserDraggedRef = useRef<boolean>(false);
  const hasUserViewportAdjustedRef = useRef<boolean>(false);
  const lastTopologyKeyRef = useRef<string>("");
  const dragNodeStartRef = useRef<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const DEFAULT_NODE_W = 340;
  const MIN_NODE_W = 340;
  const MAX_NODE_W = 680;
  const [customDims, setCustomDims] = useState<
    Record<string, { w: number; minH?: number }>
  >({});
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const resizeStartRef = useRef<{
    nodeId: string;
    mode: "w" | "wh";
    startClientX: number;
    startClientY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // Feature 1: Merge registeredServices with real-time Auto-Discovered services from Muscle heartbeats
  const allServices = useMemo<RegisteredService[]>(() => {
    const map = new Map<string, RegisteredService>();
    for (const s of registeredServices) {
      map.set(s.service_id, { ...s });
    }
    for (const gn of gatewayNodes) {
      const hbServices = gn.last_heartbeat?.services || [];
      for (const live of hbServices) {
        if (!live.service_id || !live.port) continue;
        const existing =
          map.get(live.service_id) ||
          Array.from(map.values()).find(
            (item) => item.node_id === gn.node_id && item.port === live.port
          );
        if (existing) {
          existing.healthy = live.healthy;
          existing.latency_ms = live.latency_ms;
          if (live.process_name) existing.process_name = live.process_name;
          if (live.container_name) existing.container_name = live.container_name;
          if (
            live.auto_discovered ||
            live.service_id.startsWith("auto-")
          ) {
            existing.auto_discovered = true;
          }
        } else {
          const lower = `${live.service_id} ${live.name}`.toLowerCase();
          const cat: "webui" | "backend" | "database" =
            live.category === "webui" ||
            live.category === "database" ||
            live.category === "backend"
              ? live.category
              : lower.includes("db") ||
                lower.includes("sqlite") ||
                lower.includes("postgres") ||
                lower.includes("redis")
              ? "database"
              : lower.includes("web") || lower.includes("ui")
              ? "webui"
              : "backend";
          map.set(live.service_id, {
            service_id: live.service_id,
            node_id: gn.node_id,
            name: live.name,
            category: cat,
            port: live.port,
            protocol: "http",
            path: "/",
            healthy: live.healthy,
            latency_ms: live.latency_ms,
            auto_discovered: true,
            process_name: live.process_name,
            container_name: live.container_name,
          });
        }
      }
    }
    return Array.from(map.values());
  }, [registeredServices, gatewayNodes]);

  // Feature 3: WebUI Auth & RBAC State
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

  // Feature 4: 1-Click Snap & Rollback Checkpoints State
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([]);
  const [checkpointBusyId, setCheckpointBusyId] = useState<string | null>(null);
  const [checkpointNotice, setCheckpointNotice] = useState<string | null>(null);

  // Feature 5: 24/7 Proactive Watchdog & Multi-Channel Alerting State
  const [alertConfig, setAlertConfig] = useState<AlertConfigState | null>(null);
  const [showAlertChannels, setShowAlertChannels] = useState(false);
  const [alertBusy, setAlertBusy] = useState(false);
  const [alertNotice, setAlertNotice] = useState<string | null>(null);

  // Feature 6: Service-to-Service Mesh Data-Flow Links
  const [serviceLinks, setServiceLinks] = useState<ServiceMeshLink[]>([
    {
      id: "pulse-webui->pulse-analytics-api",
      fromServiceId: "pulse-webui",
      toServiceId: "pulse-analytics-api",
      protocol: "HTTP REST",
    },
    {
      id: "pulse-analytics-api->pulse-sqlite-db",
      fromServiceId: "pulse-analytics-api",
      toServiceId: "pulse-sqlite-db",
      protocol: "SQLite WAL",
    },
    {
      id: "auto-svc-4050->pulse-analytics-api",
      fromServiceId: "auto-svc-4050",
      toServiceId: "pulse-analytics-api",
      protocol: "JSON Telemetry",
    },
  ]);

  // Round-2 Feature 1: 1-Click Blueprint / App-Store State
  const [blueprints, setBlueprints] = useState<BlueprintItem[]>([]);
  const [blueprintBusyId, setBlueprintBusyId] = useState<string | null>(null);
  const [blueprintNotice, setBlueprintNotice] = useState<string | null>(null);

  // Round-2 Feature 2: Live Log Streaming (Tail) State per Service
  const [serviceLogsMap, setServiceLogsMap] = useState<
    Record<string, { lines: string[]; errorCount: number; open: boolean }>
  >({});
  const [logBusyId, setLogBusyId] = useState<string | null>(null);

  // Round-2 Feature 3: Live SSH-Intrusion-Radar & Auto-Blocker State per Muscle Node
  const [intrusionMap, setIntrusionMap] = useState<
    Record<string, IntrusionScanState>
  >({});
  const [intrusionBusyNode, setIntrusionBusyNode] = useState<string | null>(
    null
  );
  const [intrusionNotice, setIntrusionNotice] = useState<string | null>(null);

  // Round-2 Feature 4: Automated Encrypted Offsite Backups State
  const [offsiteBackups, setOffsiteBackups] = useState<OffsiteBackupItem[]>([]);
  const [backupBusyId, setBackupBusyId] = useState<string | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  // Round-2 Feature 5: Custom Domain & Auto-HTTPS Bindings per Service
  const [domainBindings, setDomainBindings] = useState<
    Record<string, DomainBindingItem>
  >({});
  const [domainEditorOpen, setDomainEditorOpen] = useState<
    Record<string, boolean>
  >({});
  const [domainInputMap, setDomainInputMap] = useState<Record<string, string>>(
    {}
  );
  const [domainNoticeMap, setDomainNoticeMap] = useState<
    Record<string, string>
  >({});

  // Round-2 Feature 6: Chaos-Engineering & Resilience Simulator State per Service
  const [chaosResultMap, setChaosResultMap] = useState<
    Record<string, ChaosResultState>
  >({});
  const [chaosBusyId, setChaosBusyId] = useState<string | null>(null);

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
          node_id: primaryNode || "vps2-muscle",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setBlueprintNotice(
          action === "deploy"
            ? t(
                `🚀 ${bp.name} bereitgestellt!`,
                `🚀 ${bp.name} deployed!`
              )
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

  const handleTailServiceLogs = async (svc: RegisteredService) => {
    const current = serviceLogsMap[svc.service_id];
    if (current?.open) {
      setServiceLogsMap((prev) => ({
        ...prev,
        [svc.service_id]: { ...current, open: false },
      }));
      return;
    }
    setLogBusyId(svc.service_id);
    try {
      const res = await fetch("/api/service-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "tail_logs",
          node_id: svc.node_id || primaryNode || "vps2-muscle",
          service_id: svc.service_id,
          port: svc.port,
          container_name: svc.container_name,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setServiceLogsMap((prev) => ({
          ...prev,
          [svc.service_id]: {
            lines: data.lines || [],
            errorCount: data.error_count || 0,
            open: true,
          },
        }));
      }
    } finally {
      setLogBusyId(null);
    }
  };

  const handleSaveServiceDomain = async (svc: RegisteredService) => {
    const rawDomain = (
      domainInputMap[svc.service_id] ??
      domainBindings[svc.service_id]?.domain ??
      `${svc.service_id}.synapse.local`
    ).trim();
    try {
      const res = await fetch("/api/service-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure_domain",
          service_id: svc.service_id,
          domain: rawDomain,
          auto_tls: true,
          target_port: svc.port,
          node_id: svc.node_id || primaryNode || "vps2-muscle",
        }),
      });
      const data = await res.json();
      if (data.domains) {
        setDomainBindings(data.domains);
      }
      setDomainNoticeMap((prev) => ({
        ...prev,
        [svc.service_id]: t(
          `🔒 HTTPS aktiv: https://${rawDomain}`,
          `🔒 HTTPS active: https://${rawDomain}`
        ),
      }));
      setTimeout(() => {
        setDomainNoticeMap((prev) => {
          const copy = { ...prev };
          delete copy[svc.service_id];
          return copy;
        });
      }, 4000);
    } catch {
      // ignore
    }
  };

  const handleRunChaosTest = async (svc: RegisteredService) => {
    setChaosBusyId(svc.service_id);
    try {
      const res = await fetch("/api/service-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chaos_test",
          node_id: svc.node_id || primaryNode || "vps2-muscle",
          service_id: svc.service_id,
          port: svc.port,
          container_name: svc.container_name,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setChaosResultMap((prev) => ({
          ...prev,
          [svc.service_id]: {
            mttr_ms: data.mttr_ms || 120,
            recovered: Boolean(data.recovered),
            steps: data.steps || [],
          },
        }));
      }
    } finally {
      setChaosBusyId(null);
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
        t("✔ Snapshot erfolgreich gespeichert!", "✔ Snapshot saved successfully!")
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
          node_id: primaryNode || "vps2-muscle",
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
            ? t("🔒 WebUI Passwort-Schutz aktiviert", "🔒 WebUI Password Protection enabled")
            : t("🔓 WebUI Passwort-Schutz deaktiviert", "🔓 WebUI Password Protection disabled")
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
          t(
            "Falsches Passwort oder 2FA-PIN",
            "Invalid password or 2FA PIN"
          )
        );
      }
    } catch {
      setAuthNotice(t("Anmeldung fehlgeschlagen", "Login failed"));
    }
  };

  const handleToggleServiceLink = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const linkId = `${fromId}->${toId}`;
    setServiceLinks((prev) => {
      const exists = prev.some((l) => l.id === linkId);
      if (exists) {
        return prev.filter((l) => l.id !== linkId);
      }
      const targetSvc = allServices.find((s) => s.service_id === toId);
      const proto =
        targetSvc?.category === "database" ? "SQLite / TCP" : "HTTP REST";
      return [
        ...prev,
        {
          id: linkId,
          fromServiceId: fromId,
          toServiceId: toId,
          protocol: proto,
        },
      ];
    });
  };

  const peerIdsKey = useMemo(
    () =>
      gatewayNodes.length > 0
        ? gatewayNodes.map((n) => n.node_id).join(",")
        : "empty",
    [gatewayNodes]
  );

  const serviceIdsKey = useMemo(
    () =>
      allServices.length > 0
        ? allServices
            .map((s) => `${s.service_id}@${s.node_id || ""}`)
            .join(",")
        : "empty",
    [allServices]
  );

  const allServicesRef = useRef(allServices);
  allServicesRef.current = allServices;

  // Clean 3-column Hierarchical Layout with Pixel-Perfect Vertical Center Alignment:
  // Left (x=60): Synapse Core Hub -> Center (x=460): Muscle Peers -> Right (x=860): Services behind their owning Muscle
  const buildHierarchicalLayout = useCallback((): Record<string, CanvasPos> => {
    const next: Record<string, CanvasPos> = {};
    const rawPeerIds =
      peerIdsKey !== "empty" ? peerIdsKey.split(",") : ["empty"];
    const peerStep = 118;
    const svcStep = 94;

    const CORE_BASE_H = 74;
    const PEER_BASE_H = 74;
    const SVC_BASE_H = 62;

    const currentServices = allServicesRef.current;
    const servicesByPeer = new Map<string, RegisteredService[]>();
    for (const pid of rawPeerIds) {
      servicesByPeer.set(pid, []);
    }
    for (const svc of currentServices) {
      const targetPeer =
        svc.node_id && servicesByPeer.has(svc.node_id)
          ? svc.node_id
          : rawPeerIds[0];
      servicesByPeer.get(targetPeer)?.push(svc);
    }

    let cursorY = 48;
    const peerCenterYs: number[] = [];

    rawPeerIds.forEach((rawId) => {
      const peerKey = `peer:${rawId}`;
      const owned = servicesByPeer.get(rawId) || [];
      if (owned.length > 0) {
        let firstSvcY = cursorY;
        let lastSvcY = firstSvcY + (owned.length - 1) * svcStep;
        let groupCenterY =
          (firstSvcY + SVC_BASE_H / 2 + (lastSvcY + SVC_BASE_H / 2)) / 2;
        let peerY = Math.round(groupCenterY - PEER_BASE_H / 2);

        if (peerY < 28) {
          const shift = 28 - peerY;
          firstSvcY += shift;
          lastSvcY += shift;
          groupCenterY += shift;
          peerY = 28;
        }

        owned.forEach((svc, idx) => {
          next[`svc:${svc.service_id}`] = {
            x: 824,
            y: Math.round(firstSvcY + idx * svcStep),
          };
        });

        next[peerKey] = { x: 430, y: peerY };
        peerCenterYs.push(peerY + PEER_BASE_H / 2);
        cursorY = Math.max(
          lastSvcY + SVC_BASE_H + 36,
          peerY + PEER_BASE_H + 36
        );
      } else {
        const peerY = cursorY;
        next[peerKey] = { x: 430, y: peerY };
        peerCenterYs.push(peerY + PEER_BASE_H / 2);
        cursorY += Math.max(PEER_BASE_H + 36, peerStep);
      }
    });

    const minCenterY =
      peerCenterYs.length > 0 ? Math.min(...peerCenterYs) : 200;
    const maxCenterY =
      peerCenterYs.length > 0 ? Math.max(...peerCenterYs) : 200;
    const midCenterY = (minCenterY + maxCenterY) / 2;

    next["core:hub"] = {
      x: 36,
      y: Math.max(28, Math.round(midCenterY - CORE_BASE_H / 2)),
    };

    if (currentServices.length === 0) {
      next["svc:empty"] = {
        x: 824,
        y: Math.max(28, Math.round(midCenterY - SVC_BASE_H / 2)),
      };
    }

    return next;
  }, [peerIdsKey, serviceIdsKey]);

  const computeDefaultLayout = useCallback(
    (): Record<string, CanvasPos> => buildHierarchicalLayout(),
    [buildHierarchicalLayout]
  );

  const measureNodes = useCallback(() => {
    setSizes((prev) => {
      let changed = false;
      const nextSizes: Record<string, { w: number; h: number }> = { ...prev };
      for (const [id, el] of Object.entries(nodeRefs.current)) {
        if (el) {
          const w = el.offsetWidth || DEFAULT_NODE_W;
          const h = el.offsetHeight || 66;
          if (!prev[id] || prev[id].w !== w || prev[id].h !== h) {
            nextSizes[id] = { w, h };
            changed = true;
          }
        }
      }
      return changed ? nextSizes : prev;
    });
  }, [DEFAULT_NODE_W]);

  useEffect(() => {
    measureNodes();
    const timer = setTimeout(measureNodes, 60);
    window.addEventListener("resize", measureNodes);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measureNodes);
    };
  }, [
    measureNodes,
    gatewayNodes.length,
    allServices.length,
    expandedNodes,
    customDims,
    serviceLogsMap,
    intrusionMap,
    offsiteBackups.length,
    domainEditorOpen,
    chaosResultMap,
    showAlertChannels,
    showAuthConfig,
  ]);

  // Compute effective positions: when any card is expanded downward or resized wider,
  // automatically push sibling cards below it (and columns to the right) so nothing overlaps!
  const effectivePositions = useMemo(() => {
    const out: Record<string, CanvasPos> = { ...positions };
    if (expandedNodes["core:hub"] && out["core:hub"] && !hasUserDraggedRef.current) {
      out["core:hub"] = {
        x: out["core:hub"].x,
        y: Math.min(out["core:hub"].y, 48),
      };
    }
    const coreW =
      customDims["core:hub"]?.w || sizes["core:hub"]?.w || DEFAULT_NODE_W;
    const coreExtraW = Math.max(0, coreW - DEFAULT_NODE_W);
    let maxPeerExtraW = 0;
    for (const k of Object.keys(out)) {
      if (k.startsWith("peer:")) {
        const pw = customDims[k]?.w || sizes[k]?.w || DEFAULT_NODE_W;
        maxPeerExtraW = Math.max(maxPeerExtraW, Math.max(0, pw - DEFAULT_NODE_W));
      }
    }

    const shiftColumn = (
      prefix: "peer:" | "svc:",
      baseH: number,
      fallbackExpandedH: number,
      extraShiftX: number
    ) => {
      const keys = Object.keys(out)
        .filter((k) => k.startsWith(prefix))
        .sort((a, b) => (out[a]?.y ?? 0) - (out[b]?.y ?? 0));
      let extraShiftY = 0;
      keys.forEach((k, idx) => {
        const basePos = out[k];
        if (!basePos) return;
        const startY =
          prefix === "peer:" &&
          idx === 0 &&
          expandedNodes[k] &&
          !hasUserDraggedRef.current
            ? Math.min(basePos.y, 48)
            : basePos.y;
        out[k] = {
          x: Math.round(basePos.x + extraShiftX),
          y: Math.round(startY + extraShiftY),
        };
        if (expandedNodes[k]) {
          const actualH =
            sizes[k]?.h ||
            customDims[k]?.minH ||
            fallbackExpandedH;
          const delta = Math.max(0, actualH - baseH);
          extraShiftY += delta + 10;
        }
      });
    };
    shiftColumn("peer:", 74, 250, coreExtraW);
    shiftColumn("svc:", 62, 235, coreExtraW + maxPeerExtraW);
    return out;
  }, [positions, expandedNodes, sizes, customDims, DEFAULT_NODE_W]);

  const effectivePositionsRef = useRef(effectivePositions);
  effectivePositionsRef.current = effectivePositions;

  const toggleExpandNode = useCallback(
    (nodeKey: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setExpandedNodes((prev) => ({
        ...prev,
        [nodeKey]: !prev[nodeKey],
      }));
      setTimeout(measureNodes, 25);
      setTimeout(measureNodes, 110);
    },
    [measureNodes]
  );

  const allExpanded = useMemo(() => {
    const keys = [
      "core:hub",
      ...gatewayNodes.map((n) => `peer:${n.node_id}`),
      ...allServices.map((s) => `svc:${s.service_id}`),
    ];
    return keys.length > 0 && keys.every((k) => expandedNodes[k]);
  }, [gatewayNodes, allServices, expandedNodes]);

  const handleFitView = useCallback(
    (layoutOverride?: Record<string, CanvasPos>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const activeLayout =
        layoutOverride && Object.keys(layoutOverride).length > 0
          ? layoutOverride
          : Object.keys(positions).length > 0
          ? positions
          : computeDefaultLayout();

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (const [key, pos] of Object.entries(activeLayout)) {
        if (!pos) continue;
        const w = sizes[key]?.w || DEFAULT_NODE_W;
        const h =
          sizes[key]?.h ||
          (key === "core:hub" ? 108 : key.startsWith("peer:") ? 88 : 62);
        const extraRight =
          key.startsWith("svc:") && serviceLinks.length > 0 ? 155 : 0;
        if (pos.x < minX) minX = pos.x;
        if (pos.y < minY) minY = pos.y;
        if (pos.x + w + extraRight > maxX) maxX = pos.x + w + extraRight;
        if (pos.y + h > maxY) maxY = pos.y + h;
      }

      if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
        minX = 36;
        minY = 48;
        maxX = 1164;
        maxY = 502;
      }

      const contentW = Math.max(400, maxX - minX);
      const contentH = Math.max(240, maxY - minY);
      const scaleX = (rect.width - 48) / contentW;
      const scaleY = (rect.height - 64) / contentH;
      const minScale = layoutOverride ? 0.56 : 0.78;
      const nextZoom = Math.min(Math.max(Math.min(scaleX, scaleY), minScale), 1.05);
      const roundedZoom = Number(nextZoom.toFixed(2));

      const panX = Math.round(
        (rect.width - contentW * roundedZoom) / 2 - minX * roundedZoom
      );
      const panY = Math.round(
        (rect.height - contentH * roundedZoom) / 2 - minY * roundedZoom
      );

      const nextPan = { x: panX, y: Math.max(16, panY) };
      zoomRef.current = roundedZoom;
      panRef.current = nextPan;
      setZoom(roundedZoom);
      setPan(nextPan);
    },
    [positions, sizes, computeDefaultLayout, DEFAULT_NODE_W, serviceLinks.length]
  );

  const applyZoomAtPoint = useCallback(
    (targetZoomRaw: number, clientX?: number, clientY?: number) => {
      const prevZoom = zoomRef.current;
      const prevPan = panRef.current;
      const nextZoom = Number(
        Math.min(Math.max(targetZoomRaw, 0.25), 3.0).toFixed(3)
      );
      if (nextZoom === prevZoom) return;

      const rect = containerRef.current?.getBoundingClientRect();
      const anchorX =
        clientX !== undefined && rect
          ? clientX - rect.left
          : rect
          ? rect.width / 2
          : window.innerWidth / 2;
      const anchorY =
        clientY !== undefined && rect
          ? clientY - rect.top
          : rect
          ? rect.height / 2
          : window.innerHeight / 2;

      const worldX = (anchorX - prevPan.x) / prevZoom;
      const worldY = (anchorY - prevPan.y) / prevZoom;

      const nextPan = {
        x: Math.round(anchorX - worldX * nextZoom),
        y: Math.round(anchorY - worldY * nextZoom),
      };

      hasUserViewportAdjustedRef.current = true;
      zoomRef.current = nextZoom;
      panRef.current = nextPan;
      setZoom(nextZoom);
      setPan(nextPan);
    },
    []
  );

  const handleToggleExpandAll = () => {
    const target = !allExpanded;
    const next: Record<string, boolean> = { "core:hub": target };
    gatewayNodes.forEach((n) => {
      next[`peer:${n.node_id}`] = target;
    });
    allServices.forEach((s) => {
      next[`svc:${s.service_id}`] = target;
    });
    setExpandedNodes(next);
    setTimeout(measureNodes, 35);
    setTimeout(() => {
      measureNodes();
      if (!target && !hasUserViewportAdjustedRef.current) {
        handleFitView();
      }
    }, 150);
  };

  useEffect(() => {
    const topoKey = `${peerIdsKey}|${serviceIdsKey}`;
    if (lastTopologyKeyRef.current !== topoKey) {
      lastTopologyKeyRef.current = topoKey;
      if (!hasUserDraggedRef.current) {
        const fresh = computeDefaultLayout();
        setPositions(fresh);
        if (!hasUserViewportAdjustedRef.current) {
          handleFitView(fresh);
        }
      }
    }
  }, [peerIdsKey, serviceIdsKey, computeDefaultLayout, handleFitView]);

  const handleResetLayout = () => {
    hasUserDraggedRef.current = false;
    hasUserViewportAdjustedRef.current = false;
    setExpandedNodes({});
    setCustomDims({});
    const fresh = computeDefaultLayout();
    setPositions(fresh);
    handleFitView(fresh);
  };

  // Clean 3-tier hierarchical edges:
  // Core Hub (Left) -> Muscle Peer (Middle) -> Owned Services (Right)
  const edges = useMemo<CanvasEdge[]>(() => {
    const list: CanvasEdge[] = [];
    const rawPeerIds =
      peerIdsKey !== "empty" ? peerIdsKey.split(",") : ["empty"];
    const peerIds = rawPeerIds.map((id) => `peer:${id}`);

    for (const pid of peerIds) {
      list.push({
        id: `core:hub->${pid}`,
        from: "core:hub",
        to: pid,
        color: "#f68330",
        active: pid !== "peer:empty",
      });
    }

    if (allServices.length === 0) {
      const firstPeer = peerIds[0] || "core:hub";
      list.push({
        id: `${firstPeer}->svc:empty`,
        from: firstPeer,
        to: "svc:empty",
        color: "#38bdf8",
        active: false,
      });
    } else {
      for (const svc of allServices) {
        const ownerPeerKey =
          svc.node_id && rawPeerIds.includes(svc.node_id)
            ? `peer:${svc.node_id}`
            : peerIds[0] || "core:hub";
        list.push({
          id: `${ownerPeerKey}->svc:${svc.service_id}`,
          from: ownerPeerKey,
          to: `svc:${svc.service_id}`,
          color: "#38bdf8",
          active: true,
        });
      }
    }

    return list;
  }, [peerIdsKey, serviceIdsKey, allServices]);

  useEffect(() => {
    let rafId: number | null = null;
    let latestEvent: PointerEvent | null = null;

    function flushPointerMove() {
      rafId = null;
      const e = latestEvent;
      if (!e) return;

      if (resizeStartRef.current) {
        const r = resizeStartRef.current;
        const currentZoom = zoomRef.current || 1;
        const dx = (e.clientX - r.startClientX) / currentZoom;
        const dy = (e.clientY - r.startClientY) / currentZoom;
        // Ignore micro-taps (< 3px movement) so a quick click on the resize grip never jumps the box size
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
          return;
        }
        lastDragMovedRef.current = true;
        const nextW = Math.round(
          Math.min(MAX_NODE_W, Math.max(MIN_NODE_W, r.origW + dx))
        );
        const naturalMinH = r.nodeId.startsWith("svc:") ? 58 : 66;
        const minBaseH = Math.min(r.origH, naturalMinH);
        const rawNextH = Math.round(Math.max(minBaseH, r.origH + dy));
        const nextMinH =
          r.mode === "wh"
            ? rawNextH <= naturalMinH
              ? undefined
              : rawNextH
            : undefined;
        setCustomDims((prev) => ({
          ...prev,
          [r.nodeId]: {
            w: nextW,
            minH: r.mode === "wh" ? nextMinH : prev[r.nodeId]?.minH,
          },
        }));
        measureNodes();
        return;
      }

      if (dragNodeStartRef.current) {
        const d = dragNodeStartRef.current;
        const dx = (e.clientX - d.startClientX) / zoom;
        const dy = (e.clientY - d.startClientY) / zoom;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          d.moved = true;
          lastDragMovedRef.current = true;
          hasUserDraggedRef.current = true;
        }
        setPositions((prev) => ({
          ...prev,
          [d.nodeId]: {
            x: Math.round(d.origX + dx),
            y: Math.round(d.origY + dy),
          },
        }));
        return;
      }

      if (isPanning && panStartRef.current) {
        const p = panStartRef.current;
        const dx = e.clientX - p.startX;
        const dy = e.clientY - p.startY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          hasUserViewportAdjustedRef.current = true;
        }
        const nextPan = {
          x: p.panX + dx,
          y: p.panY + dy,
        };
        panRef.current = nextPan;
        setPan(nextPan);
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (
        !resizeStartRef.current &&
        !dragNodeStartRef.current &&
        !(isPanning && panStartRef.current)
      ) {
        return;
      }
      latestEvent = e;
      if (rafId === null) {
        rafId = window.requestAnimationFrame(flushPointerMove);
      }
    }

    function onPointerUp() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      latestEvent = null;
      if (resizeStartRef.current) {
        resizeStartRef.current = null;
        setResizingNodeId(null);
        setTimeout(measureNodes, 20);
      }
      if (dragNodeStartRef.current) {
        dragNodeStartRef.current = null;
        setDraggingNodeId(null);
      }
      if (isPanning) {
        setIsPanning(false);
        panStartRef.current = null;
      }
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [zoom, isPanning, MIN_NODE_W, MAX_NODE_W, measureNodes]);

  function startNodeResize(
    e: React.PointerEvent,
    nodeId: string,
    mode: "w" | "wh"
  ) {
    e.preventDefault();
    e.stopPropagation();
    const el = nodeRefs.current[nodeId];
    const effectiveMode: "w" | "wh" = expandedNodes[nodeId] ? mode : "w";
    const origW =
      customDims[nodeId]?.w || el?.offsetWidth || DEFAULT_NODE_W;
    const origH =
      (expandedNodes[nodeId] ? customDims[nodeId]?.minH : undefined) ||
      el?.offsetHeight ||
      66;
    lastDragMovedRef.current = false;
    setResizingNodeId(nodeId);
    resizeStartRef.current = {
      nodeId,
      mode: effectiveMode,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origW,
      origH,
    };
  }

  function resetNodeSize(e: React.MouseEvent, nodeId: string) {
    e.preventDefault();
    e.stopPropagation();
    setCustomDims((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    setTimeout(measureNodes, 25);
  }

  function renderResizeHandles(nodeId: string, isExpanded: boolean) {
    return (
      <>
        {/* Right-edge width resize strip (flush with parent rounded-xl card) */}
        <div
          data-resize-handle="true"
          onPointerDown={(e) => startNodeResize(e, nodeId, "w")}
          onDoubleClick={(e) => resetNodeSize(e, nodeId)}
          onClick={(e) => e.stopPropagation()}
          title={t(
            "Ziehen, um Breite zu ändern (Doppelklick = Standardgröße)",
            "Drag to resize width (Double-click = reset size)"
          )}
          className="absolute inset-y-0 right-0 w-2 cursor-ew-resize rounded-r-xl hover:bg-netbird/35 transition-colors z-20"
        />
        {/* Bottom-right corner resize grip (width-only when collapsed, 2D width+height when expanded) */}
        <div
          data-resize-handle="true"
          onPointerDown={(e) =>
            startNodeResize(e, nodeId, isExpanded ? "wh" : "w")
          }
          onDoubleClick={(e) => resetNodeSize(e, nodeId)}
          onClick={(e) => e.stopPropagation()}
          title={
            isExpanded
              ? t(
                  "Ecke ziehen, um Breite & Höhe frei zu ändern (Doppelklick = Zurücksetzen)",
                  "Drag corner to resize width & height (Double-click = reset)"
                )
              : t(
                  "Ziehen, um Breite zu ändern (Doppelklick = Zurücksetzen)",
                  "Drag to resize width (Double-click = reset)"
                )
          }
          className={`absolute bottom-1 right-1 flex h-4 w-4 ${
            isExpanded ? "cursor-nwse-resize" : "cursor-ew-resize"
          } items-end justify-end p-0.5 text-nb-gray-500 hover:text-netbird transition-colors z-30`}
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
            <path
              d="M8 1L1 8M8 4.5L4.5 8M8 8L8 8"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </>
    );
  }

  function startNodeDrag(e: React.PointerEvent, nodeId: string) {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input") ||
      target.closest("[data-resize-handle='true']")
    ) {
      return;
    }
    e.stopPropagation();
    const pos = positions[nodeId] || { x: 0, y: 0 };
    lastDragMovedRef.current = false;
    setDraggingNodeId(nodeId);
    dragNodeStartRef.current = {
      nodeId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
    };
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        e.stopPropagation();
        const factor = e.deltaY < 0 ? 1.1 : 0.91;
        applyZoomAtPoint(zoomRef.current * factor, e.clientX, e.clientY);
      }
    };
    el.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onNativeWheel);
    };
  }, [applyZoomAtPoint]);

  function getEdgeCoords(fromId: string, toId: string) {
    const p1 = effectivePositions[fromId] || { x: 50, y: 120 };
    const p2 = effectivePositions[toId] || { x: 470, y: 120 };
    const headerH1 =
      fromId === "core:hub" ? 74 : fromId.startsWith("peer:") ? 74 : 62;
    const headerH2 =
      toId === "core:hub" ? 74 : toId.startsWith("peer:") ? 74 : 62;

    const w1 = customDims[fromId]?.w || sizes[fromId]?.w || DEFAULT_NODE_W;
    const w2 = customDims[toId]?.w || sizes[toId]?.w || DEFAULT_NODE_W;

    const c1CenterX = p1.x + w1 / 2;
    const c2CenterX = p2.x + w2 / 2;
    const leftToRight = c1CenterX <= c2CenterX;

    const x1 = leftToRight ? p1.x + w1 : p1.x;
    const y1 = p1.y + headerH1 / 2;
    const x2 = leftToRight ? p2.x : p2.x + w2;
    const y2 = p2.y + headerH2 / 2;

    const dx = Math.max(Math.abs(x2 - x1) * 0.45, 48);
    const c1x = leftToRight ? x1 + dx : x1 - dx;
    const c2x = leftToRight ? x2 - dx : x2 + dx;
    const d = `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;

    return { x1, y1, x2, y2, d };
  }

  const peerNodesToRender =
    gatewayNodes.length > 0
      ? gatewayNodes
      : [
          {
            node_id: "empty",
            tier: joinTier,
            remote_addr: "",
            connected_at: "",
            online: false,
          } as GatewayNode,
        ];

  return (
    <div
      ref={containerRef}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        setIsPanning(true);
        panStartRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          panX: pan.x,
          panY: pan.y,
        };
      }}
      className={`nb-canvas-grid relative h-full w-full overflow-hidden select-none ${
        isPanning ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      {/* 1. ANIMATED SVG EDGES LAYER (Isolated so 60fps edge animations never lock HTML card raster scale) */}
      <CanvasEdgesLayer
        pan={pan}
        zoom={zoom}
        edges={edges}
        hoveredNodeId={hoveredNodeId}
        getEdgeCoords={getEdgeCoords}
        serviceLinks={serviceLinks}
        effectivePositions={effectivePositions}
        customDims={customDims}
        sizes={sizes}
        defaultNodeW={DEFAULT_NODE_W}
      />

      {/* 2. CRISP VECTOR HTML CARDS LAYER (Native CSS layout zoom so fonts/icons/borders are 100% vector-sharp at any zoom level) */}
      <div
        style={{
          left: `${Math.round(pan.x)}px`,
          top: `${Math.round(pan.y)}px`,
          zIndex: 2,
        }}
        className="pointer-events-none absolute left-0 top-0"
      >
        <div
          style={{
            zoom: zoom,
          }}
          className="pointer-events-none relative h-[1000px] w-[1400px]"
        >
        {/* 1. MIDDLE: INTERACTIVE MUSCLE SERVER CARDS (Single Unified Expandable Box) */}
        {peerNodesToRender.map((gn) => {
          const nodeKey =
            gn.node_id === "empty" ? "peer:empty" : `peer:${gn.node_id}`;
          const pos = effectivePositions[nodeKey] || { x: 460, y: 120 };
          const hb = gn.last_heartbeat;
          const isExpanded = Boolean(expandedNodes[nodeKey]);
          const tierNum =
            gn.tier === "TIER_1_UNLEASHED"
              ? "1"
              : gn.tier === "TIER_2_WORKSPACE_JAIL"
              ? "2"
              : "3";
          const history = hb?.telemetry_history || [];

          const buildSparklinePoints = (
            selector: (s: TelemetrySample) => number
          ) => {
            const pts =
              history.length >= 2
                ? history.map(selector)
                : [
                    selector({
                      ts: 0,
                      cpu: hb?.cpu_percent || 1,
                      ram: hb?.ram_percent || 2,
                      disk: hb?.disk_percent || 1,
                      latency_ms: 1,
                    }),
                    selector({
                      ts: 1,
                      cpu: hb?.cpu_percent || 1,
                      ram: hb?.ram_percent || 2,
                      disk: hb?.disk_percent || 1,
                      latency_ms: 1,
                    }),
                  ];
            const maxVal = Math.max(20, ...pts);
            return pts
              .map((v, idx) => {
                const x = (idx / Math.max(1, pts.length - 1)) * 72;
                const y = 20 - Math.min(18, Math.max(2, (v / maxVal) * 18));
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(" ");
          };

          const nodeCheckpoints = checkpoints.filter(
            (c) => !c.node_id || c.node_id === gn.node_id
          );

          const customW = customDims[nodeKey]?.w || DEFAULT_NODE_W;
          const customMinH = customDims[nodeKey]?.minH;

          return (
            <div
              key={nodeKey}
              ref={(el) => {
                nodeRefs.current[nodeKey] = el;
              }}
              style={{
                left: `${Math.round(pos.x)}px`,
                top: `${Math.round(pos.y)}px`,
                width: `${customW}px`,
                minWidth: `${MIN_NODE_W}px`,
                minHeight: isExpanded && customMinH ? `${customMinH}px` : undefined,
                zIndex:
                  draggingNodeId === nodeKey || resizingNodeId === nodeKey
                    ? 30
                    : isExpanded
                    ? 25
                    : 10,
              }}
              onPointerDown={(e) => startNodeDrag(e, nodeKey)}
              onMouseEnter={() => setHoveredNodeId(nodeKey)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (lastDragMovedRef.current) {
                  lastDragMovedRef.current = false;
                  return;
                }
                if (gn.node_id === "empty") {
                  onOpenAddPeer();
                } else {
                  onSelectNode(gn.node_id);
                  toggleExpandNode(nodeKey, e);
                }
              }}
              className={`pointer-events-auto absolute rounded-xl border bg-nb-gray-940 px-4 py-3.5 shadow-lg transition-colors duration-150 ${
                draggingNodeId === nodeKey || resizingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-netbird shadow-2xl"
                  : "cursor-grab hover:border-nb-gray-700 hover:bg-nb-gray-930"
              } ${
                isExpanded
                  ? "border-netbird/80 ring-1 ring-netbird/30 shadow-2xl"
                  : "border-nb-gray-800"
              }`}
            >
              {renderResizeHandles(nodeKey, isExpanded)}
              {gn.node_id === "empty" ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-nb-gray-300">
                    {t("Kein Server verbunden", "No server connected")}
                  </span>
                  <span className="text-netbird font-medium">
                    {t("+ Verbinden", "+ Connect")}
                  </span>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-nb-gray-800 bg-nb-gray-950 text-netbird">
                        <Server className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              gn.online ? "bg-emerald-400" : "bg-nb-gray-500"
                            }`}
                          />
                          <span className="truncate font-mono text-xs font-semibold text-white">
                            {gn.node_id}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="truncate text-[11px] text-nb-gray-400">
                            {hb?.private_ipv4 || "Online"} ·{" "}
                            {t(`Stufe ${tierNum}`, `Tier ${tierNum}`)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => toggleExpandNode(nodeKey, e)}
                      title={
                        isExpanded
                          ? t("Details einklappen", "Collapse details")
                          : t(
                              "Details direkt im Knoten aufklappen",
                              "Expand details inside node"
                            )
                      }
                      className="rounded-md p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white focus:outline-none focus-visible:outline-none transition"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* ATTACHED UNIFIED BOTTOM DETAILS FOR MUSCLE SERVER */}
                  {isExpanded && (
                    <MuscleNodeInspectorPanel
                      gn={gn}
                      hb={hb}
                      history={history}
                      buildSparklinePoints={buildSparklinePoints}
                      firewallPolicies={firewallPolicies}
                      onSelectNode={onSelectNode}
                      onOpenFirewall={onOpenFirewall}
                      onOpenPty={onOpenPty}
                      onOpenRemoteFiles={onOpenRemoteFiles}
                      authRole={authRole}
                      checkpointBusyId={checkpointBusyId}
                      checkpointNotice={checkpointNotice}
                      nodeCheckpoints={nodeCheckpoints}
                      onCreateCheckpoint={handleCreateCheckpoint}
                      onRollbackCheckpoint={handleRollbackCheckpoint}
                      intrusionBusyNode={intrusionBusyNode}
                      intrusionNotice={intrusionNotice}
                      intrusionMap={intrusionMap}
                      onScanIntrusions={handleScanIntrusions}
                      onBlockAttackerIp={handleBlockAttackerIp}
                      backupBusyId={backupBusyId}
                      backupNotice={backupNotice}
                      offsiteBackups={offsiteBackups}
                      onCreateOffsiteBackup={handleCreateOffsiteBackup}
                      onRestoreOffsiteBackup={handleRestoreOffsiteBackup}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* 2. LEFT: UNIFIED SYNAPSE CORE HUB NODE (Single Unified Expandable Box) */}
        {(() => {
          const nodeKey = "core:hub";
          const pos = effectivePositions[nodeKey] || { x: 60, y: 120 };
          const isExpanded = Boolean(expandedNodes[nodeKey]);
          const customW = customDims[nodeKey]?.w || DEFAULT_NODE_W;
          const customMinH = customDims[nodeKey]?.minH;

          return (
            <div
              ref={(el) => {
                nodeRefs.current[nodeKey] = el;
              }}
              style={{
                left: `${Math.round(pos.x)}px`,
                top: `${Math.round(pos.y)}px`,
                width: `${customW}px`,
                minWidth: `${MIN_NODE_W}px`,
                minHeight: isExpanded && customMinH ? `${customMinH}px` : undefined,
                zIndex:
                  draggingNodeId === nodeKey || resizingNodeId === nodeKey
                    ? 30
                    : isExpanded
                    ? 25
                    : 10,
              }}
              onPointerDown={(e) => startNodeDrag(e, nodeKey)}
              onMouseEnter={() => setHoveredNodeId(nodeKey)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (lastDragMovedRef.current) {
                  lastDragMovedRef.current = false;
                  return;
                }
                toggleExpandNode(nodeKey, e);
              }}
              className={`pointer-events-auto absolute rounded-2xl border bg-nb-gray-940 p-4 shadow-xl transition-colors duration-150 ${
                draggingNodeId === nodeKey || resizingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-netbird shadow-2xl"
                  : "cursor-grab hover:border-netbird/70 hover:bg-nb-gray-930"
              } ${
                isExpanded
                  ? "border-netbird ring-2 ring-netbird/30 shadow-2xl"
                  : "border-nb-gray-800"
              }`}
            >
              {renderResizeHandles(nodeKey, isExpanded)}
                      <div className="flex items-center justify-between gap-2">
                        <div className=" flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-netbird-500/40 bg-netbird-950 text-netbird">
                            <Bot className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white">
                              Synapse Core Hub
                            </div>
                            <div className="truncate font-mono text-[10.5px] text-nb-gray-400 mt-0.5">
                              <span className="text-netbird font-semibold">
                                {modelName}
                              </span>
                              {" · "}
                              <span>
                                {t(
                                  `${activeCartridges.length}/${cartridges.length} Regeln`,
                                  `${activeCartridges.length}/${cartridges.length} Rules`
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => toggleExpandNode(nodeKey, e)}
                          title={
                            isExpanded
                              ? t("Core Hub einklappen", "Collapse Core Hub")
                              : t(
                                  "Core Hub Details aufklappen",
                                  "Expand Core Hub details"
                                )
                          }
                          className="rounded-md p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white focus:outline-none focus-visible:outline-none transition"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </div>

                      {/* ATTACHED UNIFIED BOTTOM DETAILS FOR SYNAPSE CORE HUB */}
                      {isExpanded && (
                        <CoreHubInspectorPanel
                          modelName={modelName}
                          baseUrl={baseUrl}
                          authEnabled={authEnabled}
                          authRole={authRole}
                          activeCartridges={activeCartridges}
                          cartridges={cartridges}
                          secretKeysCount={secretKeysCount}
                          blueprints={blueprints}
                          blueprintBusyId={blueprintBusyId}
                          blueprintNotice={blueprintNotice}
                          allServices={allServices}
                          onOpenSettings={onOpenSettings}
                          onOpenBrainDoc={onOpenBrainDoc}
                          onToggleCartridge={onToggleCartridge}
                          onDeployBlueprint={handleDeployBlueprint}
                          onOpenAiSettings={onOpenAiSettings}
                          onOpenSecretsVault={onOpenSecretsVault}
                          onOpenAccessControl={onOpenAccessControl}
                        />
                      )}
            </div>
          );
        })()}

        {/* 3. RIGHT: INTERACTIVE SERVICE CARDS (Single Unified Expandable Box) */}
        {(allServices.length > 0
          ? allServices
          : [
              {
                service_id: "empty",
                node_id: "",
                name: "Keine Services",
                port: 0,
                protocol: "http" as const,
              },
            ]
        ).map((svc) => {
          const nodeKey =
            svc.service_id === "empty" ? "svc:empty" : `svc:${svc.service_id}`;
          const pos = effectivePositions[nodeKey] || { x: 860, y: 120 };
          const healthy =
            svc.healthy !== false && svc.health_check?.status !== "UNHEALTHY";
          const isExpanded = Boolean(expandedNodes[nodeKey]);
          const cat = svc.category || "backend";
          const catLabel =
            cat === "webui"
              ? "WebUI"
              : cat === "database"
              ? "SQLite"
              : "API";
          const latencyMs =
            svc.latency_ms ?? svc.health_check?.latency_ms ?? 1;
          const customW = customDims[nodeKey]?.w || DEFAULT_NODE_W;
          const customMinH = customDims[nodeKey]?.minH;

          return (
            <div
              key={nodeKey}
              ref={(el) => {
                nodeRefs.current[nodeKey] = el;
              }}
              style={{
                left: `${Math.round(pos.x)}px`,
                top: `${Math.round(pos.y)}px`,
                width: `${customW}px`,
                minWidth: `${MIN_NODE_W}px`,
                minHeight: isExpanded && customMinH ? `${customMinH}px` : undefined,
                zIndex:
                  draggingNodeId === nodeKey || resizingNodeId === nodeKey
                    ? 30
                    : isExpanded
                    ? 25
                    : 10,
              }}
              onPointerDown={(e) => startNodeDrag(e, nodeKey)}
              onMouseEnter={() => setHoveredNodeId(nodeKey)}
              onMouseLeave={() => setHoveredNodeId(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (lastDragMovedRef.current) {
                  lastDragMovedRef.current = false;
                  return;
                }
                if (svc.service_id !== "empty") {
                  toggleExpandNode(nodeKey, e);
                }
              }}
              className={`pointer-events-auto absolute rounded-xl border bg-nb-gray-940 px-4 py-3 shadow-lg transition-colors duration-150 ${
                draggingNodeId === nodeKey || resizingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-sky-400 shadow-2xl"
                  : "cursor-grab hover:border-nb-gray-700 hover:bg-nb-gray-930"
              } ${
                isExpanded
                  ? "border-sky-400 ring-1 ring-sky-400/30 shadow-2xl"
                  : "border-nb-gray-800"
              }`}
            >
              {renderResizeHandles(nodeKey, isExpanded)}
              {svc.service_id === "empty" ? (
                <div className="text-xs text-nb-gray-400 py-1">
                  {t(
                    "Noch keine Dienste bereitgestellt",
                    "No services deployed yet"
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-nb-gray-800 bg-nb-gray-950 text-sky-400">
                        {cat === "database" ? (
                          <Database className="h-4 w-4 text-sky-400" />
                        ) : cat === "webui" ? (
                          <Globe className="h-4 w-4 text-sky-400" />
                        ) : (
                          <Zap className="h-4 w-4 text-netbird" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              healthy
                                ? "bg-emerald-400"
                                : "bg-red-500 animate-pulse"
                            }`}
                          />
                          <span className="truncate text-xs font-semibold text-white">
                            {translateText(svc.name)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[10px] text-nb-gray-400 mt-0.5 min-w-0">
                          <span data-no-i18n="true" className="truncate">
                            {catLabel} · {svc.node_id}
                          </span>
                          <span className="shrink-0 font-semibold text-nb-gray-200">
                            · :{svc.port}
                          </span>
                          <span className="shrink-0 rounded bg-emerald-950/90 border border-emerald-500/30 px-1 py-0.2 text-[8.5px] text-emerald-300">
                            {latencyMs <= 0 ? "<1 ms" : `${latencyMs} ms`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => toggleExpandNode(nodeKey, e)}
                      title={
                        isExpanded
                          ? t("Service einklappen", "Collapse service")
                          : t(
                              "Endpunkte & Aktionen direkt aufklappen",
                              "Expand endpoints & actions"
                            )
                      }
                      className="rounded-md p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white focus:outline-none focus-visible:outline-none transition"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {/* ATTACHED UNIFIED BOTTOM DETAILS FOR SERVICE */}
                  {isExpanded && (
                    <ServiceNodeInspectorPanel
                      svc={svc}
                      allServices={allServices}
                      serviceLinks={serviceLinks}
                      domainBindings={domainBindings}
                      domainEditorOpen={domainEditorOpen}
                      domainInputMap={domainInputMap}
                      domainNoticeMap={domainNoticeMap}
                      serviceLogsMap={serviceLogsMap}
                      logBusyId={logBusyId}
                      chaosBusyId={chaosBusyId}
                      chaosResultMap={chaosResultMap}
                      authRole={authRole}
                      onOpenReverseProxy={onOpenReverseProxy}
                      onHealService={onHealService}
                      onToggleServiceLink={handleToggleServiceLink}
                      onTailServiceLogs={handleTailServiceLogs}
                      onToggleDomainEditor={(serviceId) =>
                        setDomainEditorOpen((prev) => ({
                          ...prev,
                          [serviceId]: !prev[serviceId],
                        }))
                      }
                      onChangeDomainInput={(serviceId, value) =>
                        setDomainInputMap((prev) => ({
                          ...prev,
                          [serviceId]: value,
                        }))
                      }
                      onSaveServiceDomain={handleSaveServiceDomain}
                      onRunChaosTest={handleRunChaosTest}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>
      </div>

      {/* FEATURE 3: ZERO-TRUST WEBUI LOCK OVERLAY */}
      {authLocked && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute inset-0 z-50 flex items-center justify-center bg-nb-gray-950/90 backdrop-blur-md p-4"
        >
          <form
            onSubmit={handleUnlockDashboard}
            className="w-full max-w-sm rounded-2xl border border-nb-gray-800 bg-nb-gray-940 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-netbird/40 bg-netbird-950 text-netbird">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {t(
                    "Synapse Control Center gesperrt",
                    "Synapse Control Center Locked"
                  )}
                </h3>
                <p className="text-xs text-nb-gray-400">
                  {t(
                    "Bitte mit Admin- oder Operator-Passwort entsperren",
                    "Unlock with Admin or Operator password"
                  )}
                </p>
              </div>
            </div>
            {authNotice && (
              <div className="rounded-lg border border-red-500/40 bg-red-950/60 px-3 py-2 text-xs text-red-300">
                {authNotice}
              </div>
            )}
            <div className="space-y-2.5">
              <input
                type="password"
                value={unlockPwdInput}
                onChange={(e) => setUnlockPwdInput(e.target.value)}
                placeholder={t(
                  "Passwort eingeben...",
                  "Enter password..."
                )}
                className="w-full rounded-xl border border-nb-gray-800 bg-nb-gray-950 px-3.5 py-2.5 text-xs text-white focus:border-netbird focus:outline-none"
                autoFocus
              />
              <input
                type="text"
                value={unlockPinInput}
                onChange={(e) => setUnlockPinInput(e.target.value)}
                placeholder={t(
                  "2FA-PIN (falls aktiviert)...",
                  "2FA PIN (if enabled)..."
                )}
                className="w-full rounded-xl border border-nb-gray-800 bg-nb-gray-950 px-3.5 py-2 text-xs text-white focus:border-netbird focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-netbird py-2.5 text-xs font-semibold text-white hover:bg-netbird-500 transition"
            >
              <Unlock className="h-4 w-4" />
              <span>{t("Control Center entsperren", "Unlock Control Center")}</span>
            </button>
          </form>
        </div>
      )}

      {/* Bottom-Left Zoom, Expand & Lock Controls */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-auto absolute bottom-4 left-5 z-20 flex items-center gap-1 rounded-xl border border-nb-gray-800 bg-nb-gray-940/90 p-1 shadow-lg backdrop-blur"
      >
        <button
          onClick={() => applyZoomAtPoint(zoomRef.current * 1.15)}
          className="rounded-lg p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title="Zoom In"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <span className="px-1.5 font-mono text-[10px] text-nb-gray-300">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => applyZoomAtPoint(zoomRef.current / 1.15)}
          className="rounded-lg p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title="Zoom Out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <div className="h-3.5 w-[1px] bg-nb-gray-800 mx-0.5" />
        <button
          onClick={handleToggleExpandAll}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title={t(
            "Alle Knoten auf dem Canvas auf- oder zuklappen",
            "Expand or collapse all canvas nodes"
          )}
        >
          <ChevronsUpDown className="h-3.5 w-3.5 text-netbird" />
          <span>
            {allExpanded
              ? t("Alle einklappen", "Collapse all")
              : t("Alle erweitern", "Expand all")}
          </span>
        </button>
        <div className="h-3.5 w-[1px] bg-nb-gray-800 mx-0.5" />
        <button
          onClick={() => setAuthLocked(true)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-nb-gray-900"
          title={t("Dashboard sperren (RBAC)", "Lock Dashboard (RBAC)")}
        >
          <Lock className="h-3.5 w-3.5" />
          <span>
            {authRole === "operator"
              ? t("Operator (Nur-Lesen)", "Operator (Read-Only)")
              : t("Sperren", "Lock")}
          </span>
        </button>
        <div className="h-3.5 w-[1px] bg-nb-gray-800 mx-0.5" />
        <button
          onClick={() => handleFitView(effectivePositions)}
          className="rounded-lg p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title={t("Ansicht zentrieren", "Center view")}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleResetLayout}
          className="rounded-lg p-1.5 text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
          title={t("Layout zurücksetzen", "Reset layout")}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
