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

export type AutonomyTier =
  | "TIER_1_UNLEASHED"
  | "TIER_2_WORKSPACE_JAIL"
  | "TIER_3_SUPERVISED";

export type FlowView = "peers" | "ai-agent" | "groups" | "networks";

interface HeartbeatServiceStatus {
  service_id: string;
  name: string;
  port: number;
  protocol?: string;
  healthy: boolean;
  status_code?: number;
  latency_ms?: number;
  last_error?: string;
  auto_discovered?: boolean;
  process_name?: string;
  container_name?: string;
  category?: string;
}

interface TelemetrySample {
  ts: number;
  cpu: number;
  ram: number;
  disk: number;
  latency_ms: number;
}

interface NodeHeartbeat {
  node_id: string;
  hostname: string;
  os_arch: string;
  os_info?: string;
  public_ipv4?: string;
  private_ipv4?: string;
  tier: AutonomyTier;
  cpu_percent: number;
  ram_percent: number;
  disk_percent: number;
  load_avg_1?: number;
  uptime_sec?: number;
  services?: HeartbeatServiceStatus[];
  telemetry_history?: TelemetrySample[];
  active_pty_sessions: string[];
  timestamp_unix: number;
}

interface GatewayNode {
  node_id: string;
  tier: AutonomyTier;
  remote_addr: string;
  connected_at: string;
  online: boolean;
  last_heartbeat?: NodeHeartbeat;
}

interface CartridgeMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  content: string;
}

interface RegisteredService {
  service_id: string;
  node_id: string;
  name: string;
  category?: "webui" | "backend" | "database" | "worker";
  description?: string;
  db_path?: string;
  latency_ms?: number;
  auto_discovered?: boolean;
  process_name?: string;
  container_name?: string;
  endpoints?: Array<{
    id: string;
    label: string;
    method: "GET" | "POST" | "PUT" | "DELETE" | "SQL";
    path: string;
    description?: string;
    sample_payload?: string;
  }>;
  port: number;
  protocol: "http" | "tcp";
  path?: string;
  healthy?: boolean;
  health_check?: {
    type: "HTTP" | "TCP" | "SYSTEMD" | "EXEC";
    target: string;
    interval_sec: number;
    status: "HEALTHY" | "UNHEALTHY" | "UNKNOWN";
    last_checked?: string;
    latency_ms?: number;
    last_error?: string;
  };
}

interface CheckpointItem {
  id: string;
  node_id: string;
  timestamp: string;
  title: string;
  actor: string;
  summary: string;
  files_backed_up: string[];
  services_snapshot: Array<{
    service_id: string;
    name: string;
    port: number;
    healthy: boolean;
  }>;
  restored_at?: string;
  last_restore_output?: string;
}

interface AlertEventItem {
  id: string;
  timestamp: string;
  severity: "CRITICAL" | "WARNING" | "INFO" | "RESOLVED";
  title: string;
  message: string;
  node_id?: string;
  dispatched_to: string[];
}

interface AlertConfigState {
  enabled: boolean;
  telegram_enabled: boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;
  discord_enabled: boolean;
  discord_webhook_url: string;
  webhook_enabled: boolean;
  webhook_url: string;
  cpu_threshold: number;
  ram_threshold: number;
  disk_threshold: number;
  auto_heal_services: boolean;
  events: AlertEventItem[];
}

interface ServiceMeshLink {
  id: string;
  fromServiceId: string;
  toServiceId: string;
  protocol: string;
}

interface BlueprintItem {
  id: string;
  name: string;
  category: "webui" | "backend" | "database";
  port: number;
  container_name: string;
  description: string;
  secret_key_prefix: string;
}

interface OffsiteBackupItem {
  id: string;
  node_id: string;
  timestamp: string;
  title: string;
  size_bytes: number;
  sha256: string;
  encrypted_file: string;
  restored_at?: string;
}

interface DomainBindingItem {
  service_id: string;
  domain: string;
  auto_tls: boolean;
  target_port: number;
  node_id: string;
  updated_at: string;
}

interface IntrusionScanState {
  failed_count_24h: number;
  accepted_count_24h: number;
  top_attackers: Array<{ ip: string; attempts: number }>;
  blocked_ips: string[];
}

interface ChaosResultState {
  mttr_ms: number;
  recovered: boolean;
  steps: Array<{ step: string; detail: string; elapsed_ms: number }>;
}

interface Props {
  flowView: FlowView;
  gatewayNodes: GatewayNode[];
  primaryNode: string;
  activeCartridges: string[];
  cartridges: CartridgeMeta[];
  registeredServices: RegisteredService[];
  secretKeysCount: number;
  modelName: string;
  baseUrl: string;
  joinTier: AutonomyTier;
  onSelectNode: (nodeId: string) => void;
  onToggleCartridge: (cartridgeId: string) => void;
  onOpenAddPeer: () => void;
  onOpenPty: () => void;
  onOpenAiSettings: () => void;
  onOpenBrainDoc: (doc: "Architecture.md" | "Memory.md") => void;
  onOpenSecretsVault: () => void;
  onOpenReverseProxy: (port?: number) => void;
  onOpenAccessControl: () => void;
  onOpenRemoteFiles: () => void;
  onDeployDemoService: () => void;
  onHealService: (port: number) => void;
  firewallPolicies?: Record<
    string,
    {
      profile: "web_standard" | "synapse_stealth" | "custom";
      shielded_ports?: number[];
      detected_ports?: Array<{ port: number; shielded?: boolean }>;
      ip_rules?: unknown[];
    }
  >;
  onOpenFirewall?: (nodeId?: string) => void;
  onOpenSettings?: (tab?: string) => void;
}

interface CanvasPos {
  x: number;
  y: number;
}

interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  color: string;
  active: boolean;
}

type InspectedTarget =
  | { kind: "peer"; nodeId: string }
  | { kind: "core" }
  | { kind: "service"; serviceId: string }
  | null;

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
          const h = el.offsetHeight || 64;
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
    const coreW = expandedNodes["core:hub"]
      ? customDims["core:hub"]?.w || sizes["core:hub"]?.w || DEFAULT_NODE_W
      : DEFAULT_NODE_W;
    const coreExtraW = Math.max(0, coreW - DEFAULT_NODE_W);
    let maxPeerExtraW = 0;
    for (const k of Object.keys(out)) {
      if (k.startsWith("peer:") && expandedNodes[k]) {
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
          const actualH = sizes[k]?.h || fallbackExpandedH;
          const delta = Math.max(0, actualH - baseH);
          extraShiftY += delta + 10;
        }
      });
    };
    shiftColumn("peer:", 88, 250, coreExtraW);
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
        const dx = (e.clientX - r.startClientX) / zoom;
        const dy = (e.clientY - r.startClientY) / zoom;
        lastDragMovedRef.current = true;
        const nextW = Math.round(
          Math.min(MAX_NODE_W, Math.max(MIN_NODE_W, r.origW + dx))
        );
        const minBaseH =
          r.nodeId === "core:hub"
            ? 108
            : r.nodeId.startsWith("peer:")
            ? 88
            : 64;
        const nextMinH =
          r.mode === "wh"
            ? Math.round(Math.max(minBaseH, r.origH + dy))
            : undefined;
        setCustomDims((prev) => ({
          ...prev,
          [r.nodeId]: {
            w: nextW,
            minH: nextMinH !== undefined ? nextMinH : prev[r.nodeId]?.minH,
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
    if (!expandedNodes[nodeId]) return;
    e.preventDefault();
    e.stopPropagation();
    const el = nodeRefs.current[nodeId];
    const origW = customDims[nodeId]?.w || el?.offsetWidth || DEFAULT_NODE_W;
    const origH = el?.offsetHeight || 100;
    lastDragMovedRef.current = true;
    setResizingNodeId(nodeId);
    resizeStartRef.current = {
      nodeId,
      mode,
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

  function renderResizeHandles(nodeId: string) {
    if (!expandedNodes[nodeId]) return null;
    return (
      <>
        {/* Right-edge width resize strip */}
        <div
          data-resize-handle="true"
          onPointerDown={(e) => startNodeResize(e, nodeId, "w")}
          onDoubleClick={(e) => resetNodeSize(e, nodeId)}
          onClick={(e) => e.stopPropagation()}
          title={t(
            "Ziehen, um Breite zu ändern (Doppelklick = Standardgröße)",
            "Drag to resize width (Double-click = reset size)"
          )}
          className="absolute top-2 bottom-4 right-0 w-2 cursor-ew-resize rounded-r-xl hover:bg-netbird/40 transition-colors z-20"
        />
        {/* Bottom-right corner 2D resize grip */}
        <div
          data-resize-handle="true"
          onPointerDown={(e) => startNodeResize(e, nodeId, "wh")}
          onDoubleClick={(e) => resetNodeSize(e, nodeId)}
          onClick={(e) => e.stopPropagation()}
          title={t(
            "Ecke ziehen, um Größe frei zu ändern (Doppelklick = Zurücksetzen)",
            "Drag corner to resize box (Double-click = reset)"
          )}
          className="absolute bottom-1 right-1 flex h-4 w-4 cursor-nwse-resize items-end justify-end p-0.5 text-nb-gray-500 hover:text-netbird transition-colors z-30"
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

    const w1 = expandedNodes[fromId]
      ? customDims[fromId]?.w || sizes[fromId]?.w || DEFAULT_NODE_W
      : DEFAULT_NODE_W;
    const w2 = expandedNodes[toId]
      ? customDims[toId]?.w || sizes[toId]?.w || DEFAULT_NODE_W
      : DEFAULT_NODE_W;

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
      {/* TRANSFORMED GRAPH LAYER */}
      <div
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
        className="absolute left-0 top-0 h-[1000px] w-[1400px]"
      >
        {/* GPU-ACCELERATED MULTI-LAYER NEURAL / MESH FLOW EDGES (Zero SVG Filters, Zero Hover Jump) */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          style={{ zIndex: 1 }}
        >
          {(() => {
            const renderedPorts = new Set<string>();
            return edges.map((edge, idx) => {
              const { x1, y1, x2, y2, d } = getEdgeCoords(edge.from, edge.to);
              const isHovered = Boolean(
                hoveredNodeId &&
                  (edge.from === hoveredNodeId || edge.to === hoveredNodeId)
              );
              const isPeerEdge =
                edge.from === "core:hub" || edge.to === "core:hub";
              const secondaryColor = isPeerEdge ? "#fbbf24" : "#34d399";

              // IMPORTANT: Keep durations & delays 100% invariant across hover states so particles NEVER jump!
              const staggerSec = ((idx * 0.77) % 3.1).toFixed(2);
              const reverseStaggerSec = (((idx + 2) * 1.15) % 3.9).toFixed(2);
              const forwardDur = `${(3.2 + (idx % 3) * 0.42).toFixed(2)}s`;
              const reverseDur = `${(4.4 + (idx % 2) * 0.55).toFixed(2)}s`;

              const port1Key = `${Math.round(x1)},${Math.round(y1)}`;
              const port2Key = `${Math.round(x2)},${Math.round(y2)}`;
              const drawPort1 = !renderedPorts.has(port1Key);
              const drawPort2 = !renderedPorts.has(port2Key);
              renderedPorts.add(port1Key);
              renderedPorts.add(port2Key);

              return (
                <g
                  key={edge.id}
                  style={{
                    opacity: isHovered ? 1 : edge.active ? 0.92 : 0.3,
                    transition: "opacity 180ms ease",
                  }}
                >
                  {/* 1. Ambient Outer Glow Conduit (Pure Vector — Zero Filter Lag) */}
                  <path
                    d={d}
                    fill="none"
                    stroke={edge.color}
                    strokeOpacity={isHovered ? 0.28 : 0.09}
                    strokeWidth={isHovered ? 8 : 5}
                    strokeLinecap="round"
                    style={{
                      transition: "stroke-opacity 180ms ease, stroke-width 180ms ease",
                    }}
                  />

                  {/* 2. Solid Grounded Base Track */}
                  <path
                    d={d}
                    fill="none"
                    stroke={edge.color}
                    strokeOpacity={isHovered ? 0.55 : 0.24}
                    strokeWidth={isHovered ? 2.2 : 1.5}
                    strokeLinecap="round"
                    style={{
                      transition: "stroke-opacity 180ms ease, stroke-width 180ms ease",
                    }}
                  />

                  {/* 3. Continuous Flowing Stream Wave (GPU CSS Keyframes) */}
                  {edge.active && (
                    <path
                      d={d}
                      fill="none"
                      stroke={edge.color}
                      strokeOpacity={isHovered ? 0.95 : 0.62}
                      strokeWidth={isHovered ? 2.1 : 1.6}
                      strokeLinecap="round"
                      strokeDasharray="6 10"
                      className="cc-animated-edge"
                      style={{
                        transition: "stroke-opacity 180ms ease, stroke-width 180ms ease",
                      }}
                    />
                  )}

                  {/* 4. Traveling Energy Streak (Dual-Layer Vector Comet — Zero Filter Lag) */}
                  {edge.active && (
                    <g>
                      <path
                        d={d}
                        fill="none"
                        stroke={secondaryColor}
                        strokeOpacity={isHovered ? 0.35 : 0.2}
                        strokeWidth={isHovered ? 6.5 : 5}
                        strokeLinecap="round"
                        pathLength={100}
                        strokeDasharray="11 110"
                        className="synapse-comet-path"
                        style={{
                          animationDuration: forwardDur,
                          animationDelay: `-${staggerSec}s`,
                        }}
                      />
                      <path
                        d={d}
                        fill="none"
                        stroke={secondaryColor}
                        strokeOpacity={isHovered ? 0.98 : 0.82}
                        strokeWidth={isHovered ? 2.6 : 2}
                        strokeLinecap="round"
                        pathLength={100}
                        strokeDasharray="11 110"
                        className="synapse-comet-path"
                        style={{
                          animationDuration: forwardDur,
                          animationDelay: `-${staggerSec}s`,
                        }}
                      />
                    </g>
                  )}

                  {/* 5. Primary Forward Data Packet (GPU CSS Motion Path + Concentric Vector Glow) */}
                  {edge.active && (
                    <g
                      className="synapse-packet-fwd"
                      style={{
                        offsetPath: `path("${d}")`,
                        animationDuration: forwardDur,
                        animationDelay: `-${staggerSec}s`,
                      }}
                    >
                      <circle
                        r={isHovered ? 8.5 : 7}
                        fill={edge.color}
                        fillOpacity={isHovered ? 0.26 : 0.16}
                      />
                      <circle
                        r={isHovered ? 4.8 : 4}
                        fill={edge.color}
                        fillOpacity={isHovered ? 0.65 : 0.48}
                      />
                      <circle r={isHovered ? 2.4 : 2} fill="#ffffff" />
                    </g>
                  )}

                  {/* 6. Bi-Directional Return / Telemetry Heartbeat Pulse (Reverse GPU CSS Motion Path) */}
                  {edge.active && (
                    <g
                      className="synapse-packet-rev"
                      style={{
                        offsetPath: `path("${d}")`,
                        animationDuration: reverseDur,
                        animationDelay: `-${reverseStaggerSec}s`,
                      }}
                    >
                      <circle
                        r={isHovered ? 6 : 5}
                        fill={secondaryColor}
                        fillOpacity={isHovered ? 0.28 : 0.18}
                      />
                      <circle
                        r={isHovered ? 2.6 : 2.1}
                        fill={secondaryColor}
                        fillOpacity={0.95}
                      />
                    </g>
                  )}

                  {/* 7. Deduplicated Port Socket Rings (Drawn Once per Unique Port Coordinate) */}
                  {drawPort1 && (
                    <g>
                      {edge.active && (
                        <circle
                          cx={x1}
                          cy={y1}
                          r={3.8}
                          fill="none"
                          stroke={edge.color}
                          strokeWidth={1.2}
                          className="synapse-port-ring"
                          style={{ animationDelay: `-${staggerSec}s` }}
                        />
                      )}
                      <circle
                        cx={x1}
                        cy={y1}
                        r={3.6}
                        fill="#181a1d"
                        stroke={edge.color}
                        strokeWidth={2}
                      />
                      <circle cx={x1} cy={y1} r={1.5} fill={edge.color} />
                    </g>
                  )}

                  {drawPort2 && (
                    <g>
                      {edge.active && (
                        <circle
                          cx={x2}
                          cy={y2}
                          r={3.8}
                          fill="none"
                          stroke={edge.color}
                          strokeWidth={1.2}
                          className="synapse-port-ring"
                          style={{ animationDelay: `-${reverseStaggerSec}s` }}
                        />
                      )}
                      <circle
                        cx={x2}
                        cy={y2}
                        r={3.6}
                        fill="#181a1d"
                        stroke={edge.color}
                        strokeWidth={2}
                      />
                      <circle cx={x2} cy={y2} r={1.5} fill={edge.color} />
                    </g>
                  )}
                </g>
              );
            });
          })()}

          {/* FEATURE 6: SERVICE-TO-SERVICE MESH DATA-FLOW ARCS (2-Pass Rendering: Paths first, Labels on top with non-crossing inner/outer tracks) */}
          {(() => {
            const labelItems: Array<{
              id: string;
              midX: number;
              midY: number;
              badgeW: number;
              protocol: string;
              isHovered: boolean;
            }> = [];
            const usedYs: number[] = [];

            // Sort links by vertical span so shorter (adjacent) links use the inner track
            // and longer links arch cleanly around the outside without crossing
            const sortedLinks = [...serviceLinks].sort((a, b) => {
              const pa1 = effectivePositions[`svc:${a.fromServiceId}`];
              const pa2 = effectivePositions[`svc:${a.toServiceId}`];
              const pb1 = effectivePositions[`svc:${b.fromServiceId}`];
              const pb2 = effectivePositions[`svc:${b.toServiceId}`];
              const spanA = pa1 && pa2 ? Math.abs(pa2.y - pa1.y) : 0;
              const spanB = pb1 && pb2 ? Math.abs(pb2.y - pb1.y) : 0;
              return spanA - spanB;
            });

            const arcElements = sortedLinks.map((link, lIdx) => {
              const fromKey = `svc:${link.fromServiceId}`;
              const toKey = `svc:${link.toServiceId}`;
              const p1 = effectivePositions[fromKey];
              const p2 = effectivePositions[toKey];
              if (!p1 || !p2) return null;

              const w1 = expandedNodes[fromKey]
                ? customDims[fromKey]?.w || sizes[fromKey]?.w || DEFAULT_NODE_W
                : DEFAULT_NODE_W;
              const w2 = expandedNodes[toKey]
                ? customDims[toKey]?.w || sizes[toKey]?.w || DEFAULT_NODE_W
                : DEFAULT_NODE_W;
              const x1 = p1.x + w1;
              const y1 = p1.y + 31;
              const x2 = p2.x + w2;
              const y2 = p2.y + 31;

              const baseRightX = Math.max(x1, x2);
              const arcOffset = 78 + lIdx * 28;
              const ctrlX = baseRightX + arcOffset;
              const d = `M ${x1} ${y1} C ${ctrlX} ${y1}, ${ctrlX} ${y2}, ${x2} ${y2}`;

              const evalBezier = (tParam: number) => {
                const u = 1 - tParam;
                const bx =
                  u * u * u * x1 +
                  3 * u * u * tParam * ctrlX +
                  3 * u * tParam * tParam * ctrlX +
                  tParam * tParam * tParam * x2;
                const by =
                  u * u * u * y1 +
                  3 * u * u * tParam * y1 +
                  3 * u * tParam * tParam * y2 +
                  tParam * tParam * tParam * y2;
                return { bx: Math.round(bx), by: Math.round(by) };
              };

              let chosenT = 0.5;
              let pt = evalBezier(chosenT);
              if (usedYs.some((uy) => Math.abs(uy - pt.by) < 34)) {
                const cand1 = evalBezier(0.32);
                const cand2 = evalBezier(0.68);
                const dist1 = Math.min(
                  ...usedYs.map((uy) => Math.abs(uy - cand1.by))
                );
                const dist2 = Math.min(
                  ...usedYs.map((uy) => Math.abs(uy - cand2.by))
                );
                pt = dist1 >= dist2 ? cand1 : cand2;
              }
              usedYs.push(pt.by);

              const badgeW = Math.max(
                68,
                Math.round(link.protocol.length * 5.8 + 16)
              );
              const safeMidX = Math.max(
                pt.bx,
                baseRightX + Math.ceil(badgeW / 2) + 16
              );

              const isHovered =
                hoveredNodeId === fromKey || hoveredNodeId === toKey;

              labelItems.push({
                id: link.id,
                midX: safeMidX,
                midY: pt.by,
                badgeW,
                protocol: link.protocol,
                isHovered,
              });

              return (
                <g
                  key={`arc-${link.id}`}
                  style={{
                    opacity: isHovered ? 1 : 0.78,
                    transition: "opacity 180ms ease",
                  }}
                >
                  <path
                    d={d}
                    fill="none"
                    stroke="#a855f7"
                    strokeOpacity={isHovered ? 0.35 : 0.14}
                    strokeWidth={isHovered ? 6 : 3.5}
                    strokeLinecap="round"
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke="#a855f7"
                    strokeOpacity={isHovered ? 0.95 : 0.65}
                    strokeWidth={1.6}
                    strokeDasharray="4 6"
                    className="cc-animated-edge"
                  />
                  <g
                    className="synapse-packet-fwd"
                    style={{
                      offsetPath: `path("${d}")`,
                      animationDuration: `${(2.8 + lIdx * 0.4).toFixed(2)}s`,
                    }}
                  >
                    <circle r={4.5} fill="#a855f7" fillOpacity={0.45} />
                    <circle r={2} fill="#f3e8ff" />
                  </g>
                </g>
              );
            });

            return (
              <>
                {arcElements}
                {labelItems.map((lbl) => (
                  <g
                    key={`lbl-${lbl.id}`}
                    transform={`translate(${lbl.midX}, ${lbl.midY})`}
                    style={{
                      opacity: lbl.isHovered ? 1 : 0.96,
                      transition: "opacity 180ms ease",
                    }}
                  >
                    <rect
                      x={-Math.round(lbl.badgeW / 2)}
                      y={-9}
                      width={lbl.badgeW}
                      height={18}
                      rx={6}
                      fill="#0f1115"
                      stroke="#a855f7"
                      strokeOpacity={0.75}
                      strokeWidth={1.1}
                    />
                    <text
                      x={0}
                      y={3}
                      textAnchor="middle"
                      fill="#e9d5ff"
                      fontSize={8.5}
                      fontFamily="monospace"
                    >
                      {lbl.protocol}
                    </text>
                  </g>
                ))}
              </>
            );
          })()}
        </svg>

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

          const customW = isExpanded
            ? customDims[nodeKey]?.w || DEFAULT_NODE_W
            : DEFAULT_NODE_W;
          const customMinH = isExpanded ? customDims[nodeKey]?.minH : undefined;

          return (
            <div
              key={nodeKey}
              ref={(el) => {
                nodeRefs.current[nodeKey] = el;
              }}
              style={{
                left: 0,
                top: 0,
                width: `${customW}px`,
                minWidth: `${MIN_NODE_W}px`,
                minHeight: customMinH ? `${customMinH}px` : undefined,
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                willChange: "transform, width",
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
              className={`absolute rounded-xl border bg-nb-gray-940 px-4 py-3.5 shadow-lg transition-colors duration-150 ${
                draggingNodeId === nodeKey || resizingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-netbird shadow-2xl"
                  : "cursor-grab hover:border-nb-gray-700 hover:bg-nb-gray-930"
              } ${
                isExpanded
                  ? "border-netbird/80 ring-1 ring-netbird/30 shadow-2xl"
                  : "border-nb-gray-800"
              }`}
            >
              {renderResizeHandles(nodeKey)}
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
                              gn.online ? "bg-green-400" : "bg-nb-gray-500"
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
                      className="rounded-md p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white transition"
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
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 space-y-2.5 border-t border-nb-gray-800/90 pt-3 text-[11px]"
                    >
                      <div className="space-y-1.5 rounded-lg border border-nb-gray-800/80 bg-nb-gray-950/80 p-2.5 text-[11px]">
                        <div className="flex items-center justify-between text-nb-gray-400">
                          <span>{t("Betriebssystem", "Operating System")}</span>
                          <span className="font-mono text-[10px] text-nb-gray-200 truncate max-w-[165px]">
                            {hb?.os_info
                              ? hb.os_info.split("(")[0].trim()
                              : hb?.os_arch || "Linux x86_64"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-nb-gray-400">
                          <span>{t("IPv4-Adresse", "IPv4 Address")}</span>
                          <span className="font-mono text-white">
                            {hb?.private_ipv4 || "127.0.0.1"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-nb-gray-400">
                          <span>{t("Sicherheits-Stufe", "Autonomy Tier")}</span>
                          <span className="font-mono text-netbird">
                            {gn.tier === "TIER_1_UNLEASHED"
                              ? t("Stufe 1 · Vollzugriff", "Tier 1 · Unleashed")
                              : gn.tier === "TIER_2_WORKSPACE_JAIL"
                              ? t("Stufe 2 · Workspace", "Tier 2 · Workspace")
                              : t("Stufe 3 · Überwacht", "Tier 3 · Supervised")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-nb-gray-400">
                          <span>{t("Firewall-Status", "Firewall Status")}</span>
                          {(() => {
                            const fwPol = firewallPolicies?.[gn.node_id];
                            const prof = fwPol?.profile || "web_standard";
                            const detectedShielded =
                              fwPol?.detected_ports?.filter((p) => p.shielded)
                                .length || 0;
                            const shieldedCount =
                              detectedShielded ||
                              fwPol?.shielded_ports?.length ||
                              0;
                            const isStealth = prof === "synapse_stealth";
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectNode(gn.node_id);
                                  onOpenFirewall?.(gn.node_id);
                                }}
                                title={t(
                                  "Firewall & Port-Schutz für diesen Server öffnen",
                                  "Open Firewall & Port Shield for this server"
                                )}
                                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9.5px] font-semibold transition ${
                                  isStealth
                                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                                    : shieldedCount > 0
                                    ? "border-sky-500/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25"
                                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                                }`}
                              >
                                <Shield className="h-2.5 w-2.5 shrink-0" />
                                <span>
                                  {isStealth
                                    ? t("Stealth-Firewall", "Stealth Firewall")
                                    : shieldedCount > 0
                                    ? t(
                                        `${shieldedCount} gesperrt`,
                                        `${shieldedCount} shielded`
                                      )
                                    : t("Firewall aktiv", "Firewall active")}
                                </span>
                              </button>
                            );
                          })()}
                        </div>
                        {(hb?.load_avg_1 !== undefined || hb?.uptime_sec) && (
                          <div className="flex items-center justify-between text-nb-gray-400">
                            <span>{t("System-Last & Uptime", "Load & Uptime")}</span>
                            <span className="font-mono text-[10px] text-emerald-400">
                              Load {(hb?.load_avg_1 ?? 0.01).toFixed(2)} ·{" "}
                              {Math.max(1, Math.round((hb?.uptime_sec || 3600) / 3600))}h
                            </span>
                          </div>
                        )}
                      </div>

                      {/* FEATURE 2: LIVE TIME-SERIES TELEMETRY SPARKLINES */}
                      {hb && (
                        <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 font-mono text-[10px] space-y-1.5">
                          <div className="flex items-center justify-between text-[9px] text-nb-gray-400">
                            <span className="flex items-center gap-1">
                              <Activity className="h-3 w-3 text-netbird" />
                              {t(
                                "Live-Zeitreihen (Telemetrie)",
                                "Live Time-Series Telemetry"
                              )}
                            </span>
                            <span className="text-emerald-400">
                              {history.length || 1} {t("Messpunkte", "Samples")}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            <div className="min-w-0 overflow-hidden rounded border border-nb-gray-800/70 bg-nb-gray-940/60 p-1.5">
                              <div className="flex items-center justify-between gap-1 text-[9.5px]">
                                <span className="truncate text-nb-gray-400">CPU</span>
                                <span className="shrink-0 font-semibold text-white">
                                  {hb.cpu_percent.toFixed(1)}%
                                </span>
                              </div>
                              <svg className="mt-1 h-5 w-full overflow-visible" viewBox="0 0 72 22">
                                <polyline
                                  fill="none"
                                  stroke="#f68330"
                                  strokeWidth="1.6"
                                  points={buildSparklinePoints((s) => s.cpu)}
                                />
                              </svg>
                            </div>
                            <div className="min-w-0 overflow-hidden rounded border border-nb-gray-800/70 bg-nb-gray-940/60 p-1.5">
                              <div className="flex items-center justify-between gap-1 text-[9.5px]">
                                <span className="truncate text-nb-gray-400">RAM</span>
                                <span className="shrink-0 font-semibold text-white">
                                  {hb.ram_percent.toFixed(1)}%
                                </span>
                              </div>
                              <svg className="mt-1 h-5 w-full overflow-visible" viewBox="0 0 72 22">
                                <polyline
                                  fill="none"
                                  stroke="#38bdf8"
                                  strokeWidth="1.6"
                                  points={buildSparklinePoints((s) => s.ram)}
                                />
                              </svg>
                            </div>
                            <div className="min-w-0 overflow-hidden rounded border border-nb-gray-800/70 bg-nb-gray-940/60 p-1.5">
                              <div className="flex items-center justify-between gap-1 text-[9.5px]">
                                <span className="truncate text-nb-gray-400">
                                  {t("SPEICHER", "DISK")}
                                </span>
                                <span className="shrink-0 font-semibold text-white">
                                  {hb.disk_percent.toFixed(1)}%
                                </span>
                              </div>
                              <svg className="mt-1 h-5 w-full overflow-visible" viewBox="0 0 72 22">
                                <polyline
                                  fill="none"
                                  stroke="#34d399"
                                  strokeWidth="1.6"
                                  points={buildSparklinePoints((s) => s.disk)}
                                />
                              </svg>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* FEATURE 4: 1-CLICK SNAP & ROLLBACK TIME-MACHINE CHECKPOINTS */}
                      <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-wider text-nb-gray-300">
                            <History className="h-3 w-3 text-amber-400" />
                            {t("Time-Machine Checkpoints", "Time-Machine Checkpoints")}
                          </span>
                          <button
                            type="button"
                            disabled={checkpointBusyId === "create" || authRole === "operator"}
                            onClick={() => handleCreateCheckpoint(gn.node_id)}
                            className="rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50 transition"
                          >
                            {checkpointBusyId === "create"
                              ? t("Speichert...", "Saving...")
                              : t("+ Snapshot", "+ Snapshot")}
                          </button>
                        </div>
                        {checkpointNotice && (
                          <div className="rounded bg-emerald-950/70 border border-emerald-500/40 px-2 py-1 text-[9.5px] text-emerald-300">
                            {checkpointNotice}
                          </div>
                        )}
                        <div
                          className="space-y-1 max-h-28 overflow-y-auto pr-0.5 overscroll-contain"
                        >
                          {nodeCheckpoints.map((chk) => (
                            <div
                              key={chk.id}
                              className="flex items-center justify-between gap-1.5 rounded border border-nb-gray-800/80 bg-nb-gray-940/70 px-2 py-1 text-[10px]"
                            >
                              <div className="min-w-0">
                                <div className="truncate font-medium text-nb-gray-200">
                                  {translateText(chk.title)}
                                </div>
                                <div className="font-mono text-[8.5px] text-nb-gray-400">
                                  {new Date(chk.timestamp).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}{" "}
                                  · {chk.actor}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={
                                  checkpointBusyId === chk.id ||
                                  authRole === "operator"
                                }
                                onClick={() => handleRollbackCheckpoint(chk)}
                                className="shrink-0 rounded border border-sky-500/40 bg-sky-500/15 px-1.5 py-0.5 font-mono text-[8.5px] font-semibold text-sky-300 hover:bg-sky-500/25 disabled:opacity-50 transition"
                              >
                                {checkpointBusyId === chk.id
                                  ? "..."
                                  : t("Rollback", "Rollback")}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ROUND-2 FEATURE 3: LIVE SSH-INTRUSION-RADAR & AUTO-ATTACKER BLOCKER */}
                      <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-wider text-nb-gray-300">
                            <Shield className="h-3 w-3 text-rose-400" />
                            {t("SSH-Intrusion-Radar", "SSH Intrusion Radar")}
                          </span>
                          <button
                            type="button"
                            disabled={intrusionBusyNode === gn.node_id}
                            onClick={() => handleScanIntrusions(gn.node_id)}
                            className="rounded border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-rose-300 hover:bg-rose-500/25 disabled:opacity-50 transition"
                          >
                            {intrusionBusyNode === gn.node_id
                              ? t("Scannt...", "Scanning...")
                              : t("Scan", "Scan")}
                          </button>
                        </div>
                        {intrusionNotice && (
                          <div className="rounded bg-emerald-950/70 border border-emerald-500/40 px-2 py-1 text-[9.5px] text-emerald-300">
                            {intrusionNotice}
                          </div>
                        )}
                        {intrusionMap[gn.node_id] && (
                          <div className="space-y-1 text-[9.5px]">
                            <div className="flex items-center justify-between text-nb-gray-400">
                              <span>
                                {t("Abgewehrte SSH-Logins", "Failed SSH Logins")}:{" "}
                                <strong className="text-rose-400 font-mono">
                                  {intrusionMap[gn.node_id].failed_count_24h}
                                </strong>
                              </span>
                              <span>
                                {t("Gesperrt", "Blocked")}:{" "}
                                <strong className="text-emerald-400 font-mono">
                                  {intrusionMap[gn.node_id].blocked_ips.length}
                                </strong>
                              </span>
                            </div>
                            <div
                              className="space-y-1 max-h-24 overflow-y-auto pr-0.5 overscroll-contain"
                            >
                              {intrusionMap[gn.node_id].top_attackers.map((att) => {
                                const isBlocked =
                                  intrusionMap[gn.node_id].blocked_ips.includes(
                                    att.ip
                                  );
                                return (
                                  <div
                                    key={att.ip}
                                    className="flex items-center justify-between rounded border border-nb-gray-800/80 bg-nb-gray-940/70 px-2 py-1 font-mono text-[9px]"
                                  >
                                    <span className="text-nb-gray-200 truncate">
                                      {att.ip}{" "}
                                      <span className="text-rose-400">
                                        ({att.attempts}x)
                                      </span>
                                    </span>
                                    <button
                                      type="button"
                                      disabled={
                                        isBlocked ||
                                        intrusionBusyNode ===
                                          `${gn.node_id}:${att.ip}` ||
                                        authRole === "operator"
                                      }
                                      onClick={() =>
                                        handleBlockAttackerIp(
                                          gn.node_id,
                                          att.ip
                                        )
                                      }
                                      className={`rounded px-1.5 py-0.5 text-[8.5px] font-semibold transition ${
                                        isBlocked
                                          ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30"
                                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30"
                                      }`}
                                    >
                                      {isBlocked
                                        ? t("Gesperrt", "Blocked")
                                        : t("Sperren", "Block")}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ROUND-2 FEATURE 4: AUTOMATED ENCRYPTED OFFSITE BACKUPS (AES-256-GCM) */}
                      <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-wider text-nb-gray-300">
                            <KeyRound className="h-3 w-3 text-purple-400" />
                            {t(
                              "Offsite Core-Backups (AES-256)",
                              "Offsite Core Backups (AES-256)"
                            )}
                          </span>
                          <button
                            type="button"
                            disabled={
                              backupBusyId === "create" ||
                              authRole === "operator"
                            }
                            onClick={() => handleCreateOffsiteBackup(gn.node_id)}
                            className="rounded border border-purple-500/40 bg-purple-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-purple-300 hover:bg-purple-500/25 disabled:opacity-50 transition"
                          >
                            {backupBusyId === "create"
                              ? t("Verschlüsselt...", "Encrypting...")
                              : t("+ Core-Backup", "+ Core Backup")}
                          </button>
                        </div>
                        {backupNotice && (
                          <div className="rounded bg-emerald-950/70 border border-emerald-500/40 px-2 py-1 text-[9.5px] text-emerald-300">
                            {backupNotice}
                          </div>
                        )}
                        <div
                          className="space-y-1 max-h-28 overflow-y-auto pr-0.5 overscroll-contain"
                        >
                          {offsiteBackups
                            .filter((b) => b.node_id === gn.node_id)
                            .map((bkp) => (
                              <div
                                key={bkp.id}
                                className="flex items-center justify-between gap-1.5 rounded border border-nb-gray-800/80 bg-nb-gray-940/70 px-2 py-1 text-[9.5px]"
                              >
                                <div className="min-w-0">
                                  <div className="truncate font-medium text-nb-gray-200">
                                    {translateText(bkp.title)}
                                  </div>
                                  <div className="font-mono text-[8.5px] text-nb-gray-400">
                                    {new Date(bkp.timestamp).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}{" "}
                                    · {(bkp.size_bytes / 1024).toFixed(1)} KB ·{" "}
                                    SHA:{bkp.sha256.slice(0, 8)}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={
                                    backupBusyId === bkp.id ||
                                    authRole === "operator"
                                  }
                                  onClick={() => handleRestoreOffsiteBackup(bkp)}
                                  className="shrink-0 rounded border border-purple-500/40 bg-purple-500/15 px-1.5 py-0.5 font-mono text-[8.5px] font-semibold text-purple-300 hover:bg-purple-500/25 disabled:opacity-50"
                                >
                                  {backupBusyId === bkp.id
                                    ? "..."
                                    : t("Restore", "Restore")}
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectNode(gn.node_id);
                            onOpenPty();
                          }}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-netbird py-1.5 text-[11px] font-medium text-white hover:bg-netbird-500 transition"
                        >
                          <TerminalIcon className="h-3 w-3" />
                          <span>{t("Terminal", "Terminal")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectNode(gn.node_id);
                            onOpenRemoteFiles();
                          }}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-nb-gray-800 bg-nb-gray-950 py-1.5 text-[11px] text-nb-gray-200 hover:text-white transition"
                        >
                          <Code2 className="h-3 w-3 text-sky-400" />
                          <span>{t("Dateien", "Files")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectNode(gn.node_id);
                            onOpenFirewall?.(gn.node_id);
                          }}
                          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
                        >
                          <Shield className="h-3 w-3 text-emerald-400" />
                          <span>{t("Firewall", "Firewall")}</span>
                        </button>
                      </div>
                    </div>
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
          const customW = isExpanded
            ? customDims[nodeKey]?.w || DEFAULT_NODE_W
            : DEFAULT_NODE_W;
          const customMinH = isExpanded ? customDims[nodeKey]?.minH : undefined;

          return (
            <div
              ref={(el) => {
                nodeRefs.current[nodeKey] = el;
              }}
              style={{
                left: 0,
                top: 0,
                width: `${customW}px`,
                minWidth: `${MIN_NODE_W}px`,
                minHeight: customMinH ? `${customMinH}px` : undefined,
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                willChange: "transform, width",
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
              className={`absolute rounded-2xl border bg-nb-gray-940 p-4 shadow-xl transition-colors duration-150 ${
                draggingNodeId === nodeKey || resizingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-netbird shadow-2xl"
                  : "cursor-grab hover:border-netbird/70 hover:bg-nb-gray-930"
              } ${
                isExpanded
                  ? "border-netbird ring-2 ring-netbird/30 shadow-2xl"
                  : "border-nb-gray-800"
              }`}
            >
              {renderResizeHandles(nodeKey)}
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
                          className="rounded-md p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white transition"
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
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-3 space-y-2.5 border-t border-nb-gray-800/90 pt-2.5 text-[11px]"
                        >
                          {/* 1. CLEAN KEY-VALUE OVERVIEW BOX (MATCHING MUSCLE NODE STYLE) */}
                          <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between text-nb-gray-400">
                              <span>{t("Aktives KI-Modell", "Active AI Model")}</span>
                              <span className="font-mono text-[10.5px] font-semibold text-netbird">
                                {modelName}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-nb-gray-400 gap-2">
                              <span className="shrink-0">
                                {t("API-Endpunkt", "API Endpoint")}
                              </span>
                              <span className="truncate font-mono text-[10px] text-nb-gray-300">
                                {baseUrl.replace(/^https?:\/\//, "")}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-nb-gray-400">
                              <span>
                                {t("Wächter & Alarme", "Watchdog & Alerts")}
                              </span>
                              <button
                                type="button"
                                onClick={() => onOpenSettings?.("watchdog-rbac")}
                                className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                              >
                                <span>
                                  {authEnabled
                                    ? t("RBAC aktiv", "RBAC active")
                                    : t("Konfigurieren", "Configure")}
                                </span>
                              </button>
                            </div>
                            <div className="pt-1 border-t border-nb-gray-800/70 flex items-center justify-between gap-2">
                              <span className="text-nb-gray-400 shrink-0">
                                {t("Brain-Dokumente", "Brain Docs")}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onOpenBrainDoc("Architecture.md")}
                                  className="rounded border border-nb-gray-800 bg-nb-gray-900 px-2 py-0.5 font-mono text-[9.5px] text-nb-gray-200 hover:border-netbird hover:text-white transition"
                                >
                                  Arch.md
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onOpenBrainDoc("Memory.md")}
                                  className="rounded border border-nb-gray-800 bg-nb-gray-900 px-2 py-0.5 font-mono text-[9.5px] text-nb-gray-200 hover:border-netbird hover:text-white transition"
                                >
                                  Memory.md
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* 2. SECURITY CARTRIDGES TOGGLE LIST */}
                          <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-wider text-nb-gray-300">
                                <Shield className="h-3 w-3 text-emerald-400" />
                                {t("Sicherheits-Cartridges", "Security Cartridges")}
                              </span>
                              <span className="font-mono text-[9px] text-emerald-400">
                                {activeCartridges.length}/{cartridges.length}{" "}
                                {t("aktiv", "active")}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {cartridges.map((c) => {
                                const enabled = activeCartridges.includes(c.id);
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => onToggleCartridge(c.id)}
                                    className="flex w-full items-center justify-between rounded border border-nb-gray-800/80 bg-nb-gray-940/70 px-2 py-1 text-[10px] hover:border-nb-gray-700 transition"
                                  >
                                    <span className="truncate text-nb-gray-200 pr-2">
                                      {translateText(c.name)}
                                    </span>
                                    <span
                                      className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[8.5px] font-semibold ${
                                        enabled
                                          ? "border border-emerald-500/30 bg-emerald-950 text-emerald-400"
                                          : "bg-nb-gray-900 text-nb-gray-500"
                                      }`}
                                    >
                                      {enabled ? t("AKTIV", "ON") : t("AUS", "OFF")}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* 3. 1-CLICK BLUEPRINT CATALOG */}
                          {blueprints.length > 0 && (
                            <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-wider text-nb-gray-300">
                                  <Sparkles className="h-3 w-3 text-sky-400" />
                                  {t("1-Click Blueprints", "1-Click Blueprints")}
                                </span>
                                <span className="font-mono text-[9px] text-nb-gray-400">
                                  {blueprints.length} {t("Vorlagen", "Templates")}
                                </span>
                              </div>
                              {blueprintNotice && (
                                <div className="rounded bg-emerald-950/70 border border-emerald-500/40 px-2 py-1 text-[9.5px] text-emerald-300">
                                  {blueprintNotice}
                                </div>
                              )}
                              <div className="space-y-1">
                                {blueprints.map((bp) => {
                                  const isDeployed = allServices.some(
                                    (s) =>
                                      s.service_id === bp.id || s.port === bp.port
                                  );
                                  return (
                                    <div
                                      key={bp.id}
                                      className="flex items-center justify-between gap-1.5 rounded border border-nb-gray-800/80 bg-nb-gray-940/70 px-2 py-1 text-[9.5px]"
                                    >
                                      <div className="min-w-0 flex-1 pr-1">
                                        <div className="truncate font-medium text-nb-gray-200">
                                          {translateText(bp.name)}
                                        </div>
                                        <div className="truncate text-[8.5px] text-nb-gray-400">
                                          {translateText(bp.description)}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        disabled={
                                          blueprintBusyId === bp.id ||
                                          authRole === "operator"
                                        }
                                        onClick={() =>
                                          handleDeployBlueprint(
                                            bp,
                                            isDeployed ? "undeploy" : "deploy"
                                          )
                                        }
                                        className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[8.5px] font-semibold transition ${
                                          isDeployed
                                            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40"
                                            : "border-sky-500/40 bg-sky-500/15 text-sky-300 hover:bg-sky-500/25"
                                        } disabled:opacity-50`}
                                      >
                                        {blueprintBusyId === bp.id
                                          ? "..."
                                          : isDeployed
                                          ? t("Stoppen", "Stop")
                                          : t("Starten", "Deploy")}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 4. UNIFIED 3-BUTTON FOOTER BAR (MATCHING MUSCLE NODE FOOTER) */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={onOpenAiSettings}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-netbird py-1.5 text-[11px] font-medium text-white hover:bg-netbird-500 transition"
                            >
                              <Bot className="h-3 w-3" />
                              <span>{t("KI-Modell", "AI Model")}</span>
                            </button>
                            <button
                              type="button"
                              onClick={onOpenSecretsVault}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-nb-gray-800 bg-nb-gray-950 py-1.5 text-[11px] text-nb-gray-200 hover:text-white transition"
                            >
                              <KeyRound className="h-3 w-3 text-amber-400" />
                              <span>
                                {t(
                                  `Tresor (${secretKeysCount})`,
                                  `Vault (${secretKeysCount})`
                                )}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={onOpenAccessControl}
                              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
                            >
                              <Shield className="h-3 w-3 text-emerald-400" />
                              <span>{t("Regeln", "Rules")}</span>
                            </button>
                          </div>
                        </div>
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
          const customW = isExpanded
            ? customDims[nodeKey]?.w || DEFAULT_NODE_W
            : DEFAULT_NODE_W;
          const customMinH = isExpanded ? customDims[nodeKey]?.minH : undefined;

          return (
            <div
              key={nodeKey}
              ref={(el) => {
                nodeRefs.current[nodeKey] = el;
              }}
              style={{
                left: 0,
                top: 0,
                width: `${customW}px`,
                minWidth: `${MIN_NODE_W}px`,
                minHeight: customMinH ? `${customMinH}px` : undefined,
                transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                willChange: "transform, width",
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
              className={`absolute rounded-xl border bg-nb-gray-940 px-4 py-3 shadow-lg transition-colors duration-150 ${
                draggingNodeId === nodeKey || resizingNodeId === nodeKey
                  ? "cursor-grabbing ring-2 ring-sky-400 shadow-2xl"
                  : "cursor-grab hover:border-nb-gray-700 hover:bg-nb-gray-930"
              } ${
                isExpanded
                  ? "border-sky-400 ring-1 ring-sky-400/30 shadow-2xl"
                  : "border-nb-gray-800"
              }`}
            >
              {renderResizeHandles(nodeKey)}
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
                          <Database className="h-4 w-4 text-purple-400" />
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
                                ? "bg-green-400"
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
                      className="rounded-md p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white transition"
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
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 space-y-2.5 border-t border-nb-gray-800/90 pt-2.5 text-[11px]"
                    >
                      {/* FEATURE 1: AUTO-DISCOVERY RUNTIME & CONTAINER BADGES */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {svc.auto_discovered && (
                          <span className="rounded border border-sky-500/40 bg-sky-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-sky-300">
                            {t("AUTO-ERKANNT", "AUTO-DISCOVERED")}
                          </span>
                        )}
                        {svc.container_name && (
                          <span className="rounded border border-purple-500/40 bg-purple-500/15 px-1.5 py-0.5 font-mono text-[9px] text-purple-300 truncate max-w-[180px]">
                            🐳 {svc.container_name}
                          </span>
                        )}
                        {svc.process_name && (
                          <span className="rounded border border-nb-gray-700 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[9px] text-nb-gray-300">
                            ⚙ {svc.process_name}
                          </span>
                        )}
                        {domainBindings[svc.service_id]?.domain && (
                          <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300 truncate max-w-[200px]">
                            🔒 https://{domainBindings[svc.service_id].domain}
                          </span>
                        )}
                      </div>

                      {svc.description && (
                        <p className="text-[11px] text-nb-gray-300 leading-relaxed">
                          {translateText(svc.description)}
                        </p>
                      )}

                      {svc.endpoints && svc.endpoints.length > 0 && (
                        <div className="space-y-1">
                          <div className="font-mono text-[9.5px] uppercase tracking-wider text-nb-gray-400">
                            {t(
                              "Verfügbare Aktionen & Endpunkte",
                              "Available Actions & Endpoints"
                            )}
                          </div>
                          {svc.endpoints.map((ep) => (
                            <button
                              key={ep.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenReverseProxy(svc.port);
                              }}
                              className="flex w-full items-center justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1.5 text-[10.5px] text-nb-gray-200 hover:border-sky-400 transition"
                            >
                              <span className="truncate">
                                <strong className="font-mono text-netbird mr-1.5">
                                  {ep.method}
                                </strong>
                                {translateText(ep.label)
                                  .replace(new RegExp(`^${ep.method}\\s+`, "i"), "")
                                  .trim()}
                              </span>
                              <ChevronRight className="h-3 w-3 shrink-0 text-nb-gray-500" />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* FEATURE 6: SERVICE-TO-SERVICE MESH LINKS */}
                      {allServices.length > 1 && (
                        <div className="space-y-1 rounded-lg border border-nb-gray-800/80 bg-nb-gray-950 p-2">
                          <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-purple-300">
                            <Link2 className="h-3 w-3" />
                            {t(
                              "Service-Mesh Datenfluss-Verbindungen",
                              "Service-Mesh Data Flow Links"
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {allServices
                              .filter((other) => other.service_id !== svc.service_id)
                              .map((other) => {
                                const linked = serviceLinks.some(
                                  (l) =>
                                    l.fromServiceId === svc.service_id &&
                                    l.toServiceId === other.service_id
                                );
                                return (
                                  <button
                                    key={other.service_id}
                                    type="button"
                                    onClick={() =>
                                      handleToggleServiceLink(
                                        svc.service_id,
                                        other.service_id
                                      )
                                    }
                                    className={`rounded border px-1.5 py-0.5 font-mono text-[9px] transition ${
                                      linked
                                        ? "border-purple-500/60 bg-purple-500/20 text-purple-200"
                                        : "border-nb-gray-800 bg-nb-gray-900 text-nb-gray-400 hover:text-white"
                                    }`}
                                  >
                                    {linked ? "⇄ " : "+ "}
                                    {translateText(other.name)}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* ROUND-2 FEATURES 2, 5, 6: LIVE-LOGS TAIL, CUSTOM DOMAIN/TLS & CHAOS-TEST */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          disabled={logBusyId === svc.service_id}
                          onClick={() => handleTailServiceLogs(svc)}
                          className="flex items-center justify-center gap-1 rounded-lg border border-nb-gray-800 bg-nb-gray-950 py-1.5 font-mono text-[9.5px] text-nb-gray-200 hover:border-sky-400 hover:text-white transition"
                        >
                          <FileText className="h-3 w-3 text-sky-400" />
                          <span>
                            {logBusyId === svc.service_id
                              ? "..."
                              : t("Live-Logs", "Live Logs")}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDomainEditorOpen((prev) => ({
                              ...prev,
                              [svc.service_id]: !prev[svc.service_id],
                            }))
                          }
                          className="flex items-center justify-center gap-1 rounded-lg border border-nb-gray-800 bg-nb-gray-950 py-1.5 font-mono text-[9.5px] text-nb-gray-200 hover:border-emerald-400 hover:text-white transition"
                        >
                          <Lock className="h-3 w-3 text-emerald-400" />
                          <span>{t("Domain/TLS", "Domain/TLS")}</span>
                        </button>
                        <button
                          type="button"
                          disabled={
                            chaosBusyId === svc.service_id ||
                            authRole === "operator"
                          }
                          onClick={() => handleRunChaosTest(svc)}
                          className="flex items-center justify-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 py-1.5 font-mono text-[9.5px] font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50 transition"
                        >
                          <Zap className="h-3 w-3 text-amber-400" />
                          <span>
                            {chaosBusyId === svc.service_id
                              ? "..."
                              : t("Chaos-Test", "Chaos Test")}
                          </span>
                        </button>
                      </div>

                      {/* ROUND-2 FEATURE 2: INLINE LIVE LOGS TAIL CONSOLE */}
                      {serviceLogsMap[svc.service_id]?.open && (
                        <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 font-mono text-[9px] space-y-1">
                          <div className="flex items-center justify-between text-nb-gray-400">
                            <span>
                              {t("Letzte Log-Zeilen", "Recent Log Lines")}
                            </span>
                            <span
                              className={
                                serviceLogsMap[svc.service_id].errorCount > 0
                                  ? "text-rose-400 font-semibold"
                                  : "text-emerald-400"
                              }
                            >
                              {serviceLogsMap[svc.service_id].errorCount}{" "}
                              {t("Fehler", "Errors")}
                            </span>
                          </div>
                          <div
                            className="max-h-32 overflow-y-auto space-y-0.5 rounded bg-black/50 p-1.5 text-[8.5px] text-nb-gray-300 overscroll-contain"
                          >
                            {serviceLogsMap[svc.service_id].lines
                              .slice(-40)
                              .map((line, idx) => (
                                <div
                                  key={idx}
                                  className={`truncate ${
                                    /error|fail|exception|panic/i.test(line)
                                      ? "text-rose-400"
                                      : "text-nb-gray-300"
                                  }`}
                                >
                                  {line}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* ROUND-2 FEATURE 5: INLINE CUSTOM DOMAIN & AUTO-HTTPS EDITOR */}
                      {domainEditorOpen[svc.service_id] && (
                        <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-2 space-y-1.5 text-[10px]">
                          <div className="flex items-center justify-between font-mono text-[9px] text-nb-gray-400">
                            <span>
                              {t(
                                "Custom Domain & Auto-HTTPS",
                                "Custom Domain & Auto-HTTPS"
                              )}
                            </span>
                            <span className="text-emerald-400">TLS 1.3</span>
                          </div>
                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              value={
                                domainInputMap[svc.service_id] ??
                                domainBindings[svc.service_id]?.domain ??
                                `${svc.service_id}.synapse.local`
                              }
                              onChange={(e) =>
                                setDomainInputMap((prev) => ({
                                  ...prev,
                                  [svc.service_id]: e.target.value,
                                }))
                              }
                              placeholder="app.example.com"
                              className="flex-1 rounded border border-nb-gray-800 bg-nb-gray-940 px-2 py-1 font-mono text-[9.5px] text-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveServiceDomain(svc)}
                              className="rounded bg-emerald-600 px-2 py-1 font-mono text-[9px] font-semibold text-white hover:bg-emerald-500 transition"
                            >
                              {t("Speichern", "Save")}
                            </button>
                          </div>
                          {domainNoticeMap[svc.service_id] && (
                            <div className="text-[9px] text-emerald-400 font-mono">
                              {domainNoticeMap[svc.service_id]}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ROUND-2 FEATURE 6: INLINE CHAOS-ENGINEERING RESILIENCE STOPWATCH REPORT */}
                      {chaosResultMap[svc.service_id] && (
                        <div className="rounded-lg border border-amber-500/40 bg-nb-gray-950 p-2 space-y-1 font-mono text-[9px]">
                          <div className="flex items-center justify-between">
                            <span className="text-amber-300 font-semibold">
                              ⚡ {t("Resilienz-Test", "Resilience Test")}
                            </span>
                            <span className="rounded bg-emerald-950 border border-emerald-500/40 px-1.5 py-0.5 text-[8.5px] text-emerald-300">
                              MTTR: {chaosResultMap[svc.service_id].mttr_ms} ms
                            </span>
                          </div>
                          {chaosResultMap[svc.service_id].steps.map((st, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-[8.5px] text-nb-gray-300"
                            >
                              <span className="truncate pr-1">
                                ✔ {translateText(st.step)}
                              </span>
                              <span className="text-nb-gray-400 shrink-0">
                                {st.elapsed_ms} ms
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenReverseProxy(svc.port);
                          }}
                          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-netbird py-2 text-[11px] font-medium text-white hover:bg-netbird-500 transition"
                        >
                          <Globe className="h-3.5 w-3.5" />
                          <span>
                            {t(
                              "Vorschau & Tester öffnen",
                              "Open Preview & Tester"
                            )}
                          </span>
                        </button>
                        {svc.healthy === false && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onHealService(svc.port);
                            }}
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-600 py-1.5 text-[11px] font-medium text-white hover:bg-red-500 transition"
                          >
                            <Wrench className="h-3.5 w-3.5" />
                            <span>
                              {t("Auto-Heal starten", "Start Auto-Heal")}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
