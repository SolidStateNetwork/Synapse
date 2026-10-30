"use client";

import React, { useState } from "react";
import { safeFetchJson } from "@/lib/safeFetch";
import type {
  ChaosResultState,
  DomainBindingItem,
  RegisteredService,
  SelfHealingEventItem,
  ServiceMeshLink,
} from "@/components/canvas/canvasTypes";

export interface UseCanvasStudioAndDomainActionsParams {
  primaryNode: string;
  allServices: RegisteredService[];
  t: (de: string, en: string) => string;
  serviceLinks: ServiceMeshLink[];
  setServiceLinks: React.Dispatch<React.SetStateAction<ServiceMeshLink[]>>;
  domainBindings: Record<string, DomainBindingItem>;
  setDomainBindings: React.Dispatch<
    React.SetStateAction<Record<string, DomainBindingItem>>
  >;
  selfHealingEvents: SelfHealingEventItem[];
  setSelfHealingEvents: React.Dispatch<
    React.SetStateAction<SelfHealingEventItem[]>
  >;
  serviceSparklineMap: Record<string, number[]>;
  setServiceSparklineMap: React.Dispatch<
    React.SetStateAction<Record<string, number[]>>
  >;
}

export function useCanvasStudioAndDomainActions({
  primaryNode,
  allServices,
  t,
  serviceLinks,
  setServiceLinks,
  domainBindings,
  setDomainBindings,
  selfHealingEvents,
  setSelfHealingEvents,
  setServiceSparklineMap,
}: UseCanvasStudioAndDomainActionsParams) {
  const defaultNodeId = primaryNode || "local-node";

  const [serviceLogsMap, setServiceLogsMap] = useState<
    Record<string, { lines: string[]; errorCount: number; open: boolean }>
  >({});
  const [logBusyId, setLogBusyId] = useState<string | null>(null);

  const [domainEditorOpen, setDomainEditorOpen] = useState<
    Record<string, boolean>
  >({});
  const [domainInputMap, setDomainInputMap] = useState<Record<string, string>>(
    {}
  );
  const [domainNoticeMap, setDomainNoticeMap] = useState<
    Record<string, string>
  >({});

  const [chaosResultMap, setChaosResultMap] = useState<
    Record<string, ChaosResultState>
  >({});
  const [chaosBusyId, setChaosBusyId] = useState<string | null>(null);

  const [selfHealBusyId, setSelfHealBusyId] = useState<string | null>(null);
  const [probeBusyId, setProbeBusyId] = useState<string | null>(null);
  const [linkProbeBusyId, setLinkProbeBusyId] = useState<string | null>(null);
  const [showCustomServiceModal, setShowCustomServiceModal] = useState(false);
  const [customSvcName, setCustomSvcName] = useState("");
  const [customSvcPort, setCustomSvcPort] = useState("4095");
  const [customSvcCategory, setCustomSvcCategory] = useState<
    "backend" | "webui" | "database"
  >("backend");
  const [customSvcRuntime, setCustomSvcRuntime] = useState<
    "python_http" | "static_webui" | "sqlite_rest"
  >("python_http");
  const [customSvcAutoHeal, setCustomSvcAutoHeal] = useState(true);
  const [customSvcBusy, setCustomSvcBusy] = useState(false);
  const [customSvcNotice, setCustomSvcNotice] = useState<string | null>(null);
  const [showSelfHealingDrawer, setShowSelfHealingDrawer] = useState(false);

  const [hotReloadModalSvc, setHotReloadModalSvc] =
    useState<RegisteredService | null>(null);
  const [hotReloadFilePath, setHotReloadFilePath] = useState("");
  const [hotReloadCode, setHotReloadCode] = useState("");
  const [hotReloadLoading, setHotReloadLoading] = useState(false);
  const [hotReloadSaving, setHotReloadSaving] = useState(false);
  const [hotReloadNotice, setHotReloadNotice] = useState<string | null>(null);

  const handleTailServiceLogs = async (
    svc: RegisteredService,
    forceRefresh = false
  ) => {
    const current = serviceLogsMap[svc.service_id];
    if (current?.open && !forceRefresh) {
      setServiceLogsMap((prev) => ({
        ...prev,
        [svc.service_id]: { ...current, open: false },
      }));
      return;
    }
    setLogBusyId(svc.service_id);
    try {
      const res = await safeFetchJson("/api/service-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "tail_logs",
          node_id: svc.node_id || defaultNodeId,
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
      const res = await safeFetchJson("/api/service-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure_domain",
          service_id: svc.service_id,
          domain: rawDomain,
          auto_tls: true,
          target_port: svc.port,
          node_id: svc.node_id || defaultNodeId,
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
      const res = await safeFetchJson("/api/service-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chaos_test",
          node_id: svc.node_id || defaultNodeId,
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

  const handleToggleServiceLink = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const linkId = `${fromId}->${toId}`;
    setServiceLinks((prev) => {
      const exists = prev.some((l) => l.id === linkId);
      let updated: ServiceMeshLink[];
      if (exists) {
        updated = prev.filter((l) => l.id !== linkId);
      } else {
        const targetSvc = allServices.find((s) => s.service_id === toId);
        const proto =
          targetSvc?.category === "database" ? "SQLite WAL" : "HTTP REST";
        updated = [
          ...prev,
          {
            id: linkId,
            fromServiceId: fromId,
            toServiceId: toId,
            protocol: proto,
          },
        ];
      }
      void safeFetchJson("/api/service-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_service_links",
          service_links: updated,
        }),
      }).catch(() => {});
      return updated;
    });
  };

  return {
    serviceLogsMap,
    logBusyId,
    domainEditorOpen,
    setDomainEditorOpen,
    domainInputMap,
    setDomainInputMap,
    domainNoticeMap,
    chaosResultMap,
    chaosBusyId,
    handleTailServiceLogs,
    handleSaveServiceDomain,
    handleRunChaosTest,
    handleToggleServiceLink,
    selfHealBusyId,
    probeBusyId,
    linkProbeBusyId,
    showCustomServiceModal,
    setShowCustomServiceModal,
    customSvcName,
    setCustomSvcName,
    customSvcPort,
    setCustomSvcPort,
    customSvcCategory,
    setCustomSvcCategory,
    customSvcRuntime,
    setCustomSvcRuntime,
    customSvcAutoHeal,
    setCustomSvcAutoHeal,
    customSvcBusy,
    customSvcNotice,
    showSelfHealingDrawer,
    setShowSelfHealingDrawer,
    hotReloadModalSvc,
    setHotReloadModalSvc,
    hotReloadFilePath,
    setHotReloadFilePath,
    hotReloadCode,
    setHotReloadCode,
    hotReloadLoading,
    hotReloadSaving,
    hotReloadNotice,
    handleQuickRestartService: async (
      svc: RegisteredService,
      simulateCrash = false
    ) => {
      setSelfHealBusyId(svc.service_id);
      try {
        const res = await safeFetchJson("/api/service-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: simulateCrash ? "simulate_crash_and_heal" : "self_heal",
            node_id: svc.node_id || defaultNodeId,
            service_id: svc.service_id,
            service_name: svc.name,
            port: svc.port,
            container_name: svc.container_name,
            simulate_crash: simulateCrash,
          }),
        });
        const data = await res.json();
        if (data.ok && data.event) {
          setSelfHealingEvents(
            data.self_healing?.events || [data.event, ...selfHealingEvents]
          );
          setServiceSparklineMap((prev) => {
            const cur = prev[svc.service_id] || [1, 1, 1, 1, 1];
            return {
              ...prev,
              [svc.service_id]: [
                ...cur.slice(-11),
                simulateCrash
                  ? Math.max(8, data.event.latency_ms)
                  : data.event.latency_ms || 1,
                data.event.latency_ms || 1,
              ],
            };
          });
        }
      } finally {
        setSelfHealBusyId(null);
      }
    },
    handleQuickProbeService: async (svc: RegisteredService) => {
      setProbeBusyId(svc.service_id);
      try {
        const res = await safeFetchJson("/api/service-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "probe_service",
            node_id: svc.node_id || defaultNodeId,
            service_id: svc.service_id,
            port: svc.port,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          setServiceSparklineMap((prev) => {
            const cur = prev[svc.service_id] || [1, 1, 1, 1, 1, 1];
            return {
              ...prev,
              [svc.service_id]: [...cur.slice(-11), data.latency_ms || 1],
            };
          });
        }
      } finally {
        setProbeBusyId(null);
      }
    },
    handleUpdateServiceLinkProtocol: async (
      fromId: string,
      toId: string,
      protocol: string
    ) => {
      const linkId = `${fromId}->${toId}`;
      const updated = serviceLinks.map((l) =>
        l.id === linkId ? { ...l, protocol } : l
      );
      setServiceLinks(updated);
      try {
        await safeFetchJson("/api/service-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_service_links",
            service_links: updated,
          }),
        });
      } catch {
        // ignore
      }
    },
    handleProbeServiceLink: async (
      fromSvc: RegisteredService,
      toSvc: RegisteredService
    ) => {
      const linkId = `${fromSvc.service_id}->${toSvc.service_id}`;
      setLinkProbeBusyId(linkId);
      try {
        const currentLink = serviceLinks.find((l) => l.id === linkId);
        const res = await safeFetchJson("/api/service-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "probe_service_link",
            node_id: fromSvc.node_id || defaultNodeId,
            from_service_id: fromSvc.service_id,
            to_service_id: toSvc.service_id,
            from_port: fromSvc.port,
            to_port: toSvc.port,
            protocol: currentLink?.protocol || "HTTP REST",
          }),
        });
        const data = await res.json();
        if (data.ok && Array.isArray(data.links)) {
          setServiceLinks(data.links);
        }
      } finally {
        setLinkProbeBusyId(null);
      }
    },
    handleOpenHotReloadModal: async (svc: RegisteredService) => {
      setHotReloadModalSvc(svc);
      setHotReloadLoading(true);
      setHotReloadNotice(null);
      try {
        const res = await safeFetchJson("/api/service-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "get_service_code",
            node_id: svc.node_id || defaultNodeId,
            service_id: svc.service_id,
            port: svc.port,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          setHotReloadFilePath(data.file_path || "");
          setHotReloadCode(data.code || "");
        }
      } finally {
        setHotReloadLoading(false);
      }
    },
    handleSaveAndHotReloadCode: async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!hotReloadModalSvc || !hotReloadCode.trim()) return;
      setHotReloadSaving(true);
      setHotReloadNotice(null);
      try {
        const res = await safeFetchJson("/api/service-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "hot_reload_service_code",
            node_id: hotReloadModalSvc.node_id || defaultNodeId,
            service_id: hotReloadModalSvc.service_id,
            port: hotReloadModalSvc.port,
            file_path: hotReloadFilePath,
            code: hotReloadCode,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          if (data.healthy === false || data.http_status >= 500) {
            setHotReloadNotice(
              t(
                `⚠️ Syntax-/Start-Fehler erkannt — Automatischer Rollback auf letzte stabile Version aktiv (Snapshot ${data.snapshot_id})!`,
                `⚠️ Syntax/startup error detected — automatic rollback to last stable version active (Snapshot ${data.snapshot_id})!`
              )
            );
          } else {
            setHotReloadNotice(
              t(
                `🔥 Live Hot-Reload auf :${data.port} in ${data.elapsed_ms} ms aktiv (Snapshot ${data.snapshot_id}, HTTP ${data.http_status})!`,
                `🔥 Live Hot-Reload active on :${data.port} in ${data.elapsed_ms} ms (Snapshot ${data.snapshot_id}, HTTP ${data.http_status})!`
              )
            );
          }
        } else {
          setHotReloadNotice(data.error || "Hot-Reload error");
        }
      } finally {
        setHotReloadSaving(false);
      }
    },
    handleDeployCustomService: async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const portNum = Number(customSvcPort || 4095);
      if (!customSvcName.trim() || !Number.isInteger(portNum)) return;
      setCustomSvcBusy(true);
      setCustomSvcNotice(null);
      try {
        const res = await safeFetchJson("/api/service-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "deploy_custom_service",
            node_id: defaultNodeId,
            name: customSvcName.trim(),
            port: portNum,
            category: customSvcCategory,
            runtime: customSvcRuntime,
            auto_heal: customSvcAutoHeal,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          setCustomSvcNotice(
            t(
              `🚀 ${data.service.name} auf :${data.service.port} live gestartet (${data.service.latency_ms} ms)!`,
              `🚀 ${data.service.name} deployed live on :${data.service.port} (${data.service.latency_ms} ms)!`
            )
          );
          setCustomSvcName("");
          setCustomSvcPort(String(portNum + 1));
          setTimeout(() => {
            setShowCustomServiceModal(false);
            setCustomSvcNotice(null);
          }, 1200);
        } else {
          setCustomSvcNotice(data.error || "Deploy error");
        }
      } finally {
        setCustomSvcBusy(false);
      }
    },
  };
}
