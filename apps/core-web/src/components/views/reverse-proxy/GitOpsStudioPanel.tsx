"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, Clock, Copy, GitBranch, HardDriveDownload, Play, RefreshCw, Rocket, ScrollText, ShieldAlert, Trash2 } from "lucide-react";
import { safeFetchJson } from "@/lib/safeFetch";
import { SYNAPSE_VERSION } from "@/lib/version";

export interface GitOpsStackViewItem {
  stack_id: string;
  name: string;
  repo_url: string;
  branch: string;
  node_id: string;
  port: number;
  compose_path: string;
  injected_secret_keys: string[];
  webhook_token_preview: string;
  last_commit?: string;
  last_deployed_at: string;
  status: "deployed" | "error";
}

export interface LiveLogSnapshot {
  service_id: string;
  port: number;
  source: "docker" | "systemd" | "sqlite" | "workspace";
  logs: string;
  error_count: number;
  timestamp: string;
}

export interface GitOpsStudioPanelProps {
  projectId: string;
  nodeId: string;
  onReloadWorkspace?: () => void;
}

export const GitOpsStudioPanel = React.memo(function GitOpsStudioPanel({
  projectId,
  nodeId,
  onReloadWorkspace,
}: GitOpsStudioPanelProps) {
  const [open, setOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [stacks, setStacks] = useState<GitOpsStackViewItem[]>([]);
  const [stackName, setStackName] = useState("Analytics Stack");
  const [repoUrl, setRepoUrl] = useState("https://github.com/SolidStateNetwork/Synapse.git");
  const [branch, setBranch] = useState("main");
  const [port, setPort] = useState("4085");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [latestToken, setLatestToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [cronBusy, setCronBusy] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [secopsBusy, setSecopsBusy] = useState(false);

  const [logPort, setLogPort] = useState("4085");
  const [logTarget, setLogTarget] = useState("");
  const [logLinesLimit, setLogLinesLimit] = useState(50);
  const [logBusy, setLogBusy] = useState(false);
  const [logSnapshot, setLogSnapshot] = useState<LiveLogSnapshot | null>(null);

  const loadStacks = useCallback(async () => {
    try {
      const res = await safeFetchJson("/api/service-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list_git_stacks", project_id: projectId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { git_stacks?: GitOpsStackViewItem[] };
        if (Array.isArray(data.git_stacks)) setStacks(data.git_stacks);
      }
    } catch { /* ignore */ }
  }, [projectId]);

  useEffect(() => { if (open) void loadStacks(); }, [open, loadStacks]);

  const handleTailLogs = useCallback(
    async (overridePort?: number, overrideServiceId?: string) => {
      setLogBusy(true);
      setLogsOpen(true);
      try {
        const targetPort = overridePort ?? Number(logPort || 4085);
        const trimmedTarget = (overrideServiceId ?? logTarget).trim();
        const isUnit = trimmedTarget.endsWith(".service");
        const res = await safeFetchJson("/api/service-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "tail_service_logs",
            project_id: projectId,
            node_id: nodeId,
            port: targetPort,
            service_id: trimmedTarget || `svc-${targetPort}`,
            unit_name: isUnit ? trimmedTarget : undefined,
            container_name: !isUnit && trimmedTarget && !trimmedTarget.startsWith("gitops-") ? trimmedTarget : undefined,
            lines: logLinesLimit,
          }),
        });
        const data = (await res.json()) as Partial<LiveLogSnapshot> & { ok?: boolean };
        if (data.ok) {
          setLogSnapshot({
            service_id: data.service_id || trimmedTarget || `:${targetPort}`,
            port: data.port ?? targetPort,
            source: data.source || "workspace",
            logs: data.logs || "No log output available.",
            error_count: data.error_count ?? 0,
            timestamp: data.timestamp || new Date().toISOString(),
          });
        }
      } finally {
        setLogBusy(false);
      }
    },
    [logLinesLimit, logPort, logTarget, nodeId, projectId]
  );

  const handleDeployStack = async () => {
    if (!repoUrl.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await safeFetchJson("/api/service-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deploy_git_stack",
          project_id: projectId,
          node_id: nodeId,
          name: stackName.trim() || "GitOps Stack",
          repo_url: repoUrl.trim(),
          branch: branch.trim() || "main",
          port: Number(port || 4085),
          inject_secrets: true,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        webhook_token?: string;
        checkpoint_id?: string;
        stacks?: GitOpsStackViewItem[];
        stack?: GitOpsStackViewItem;
      };
      if (data.ok) {
        if (Array.isArray(data.stacks)) setStacks(data.stacks);
        if (data.webhook_token) setLatestToken(data.webhook_token);
        const cpBadge = data.checkpoint_id ? ` · Checkpoint: ${data.checkpoint_id}` : "";
        setNotice(`GitOps Stack '${data.stack?.name || stackName}' deployed on :${data.stack?.port || port} (@ ${data.stack?.last_commit || "HEAD"})${cpBadge}`);
        onReloadWorkspace?.();
      } else {
        setNotice(`Error: ${data.error || "Deployment failed"}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleTriggerRedeploy = async (stackId: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await safeFetchJson("/api/service-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "gitops_webhook",
          project_id: projectId,
          stack_id: stackId,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; stack?: GitOpsStackViewItem };
      if (data.ok) {
        setNotice(`Redeployed '${data.stack?.name || stackId}' (@ ${data.stack?.last_commit || "HEAD"})`);
        await loadStacks();
        onReloadWorkspace?.();
      } else {
        setNotice(`Webhook error: ${data.error || "Failed"}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteStack = async (stackId: string) => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await safeFetchJson("/api/service-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_git_stack", project_id: projectId, stack_id: stackId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; checkpoint_id?: string; stacks?: GitOpsStackViewItem[] };
      if (data.ok) {
        if (Array.isArray(data.stacks)) setStacks(data.stacks);
        const cpBadge = data.checkpoint_id ? ` · Checkpoint: ${data.checkpoint_id}` : "";
        setNotice(`Removed GitOps stack '${stackId}'${cpBadge}`);
        onReloadWorkspace?.();
      } else {
        setNotice(`Delete error: ${data.error || "Failed"}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRunDueCronJobs = async () => {
    setCronBusy(true);
    setNotice(null);
    try {
      const res = await safeFetchJson("/api/service-ops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "run_due_cron_jobs",
          project_id: projectId,
          node_id: nodeId,
        }),
      });
      const data = (await res.json()) as {
        evaluated_count?: number;
        executed_count?: number;
        failed_count?: number;
      };
      setNotice(
        `Cron Due-Scheduler: ${data.executed_count ?? 0}/${data.evaluated_count ?? 0} due runbooks executed (${data.failed_count ?? 0} failed)`
      );
    } finally {
      setCronBusy(false);
    }
  };

  const handleCreateOffsiteBackup = async () => {
    setBackupBusy(true);
    setNotice(null);
    try {
      const res = await safeFetchJson("/api/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          project_id: projectId,
          node_id: nodeId,
          title: `Pre-Rollout Studio Backup (${nodeId})`,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        backup?: { id?: string; size_bytes?: number; sha256?: string };
      };
      if (data.ok && data.backup) {
        setNotice(
          `AES-256-GCM Offsite-Backup '${data.backup.id}' gespeichert (${data.backup.size_bytes ?? 0} Bytes · SHA256 ${String(data.backup.sha256 || "").slice(0, 12)})`
        );
      }
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRunSecopsQuickAudit = async () => {
    setSecopsBusy(true);
    setNotice(null);
    try {
      const [alertRes, intrRes] = await Promise.all([
        safeFetchJson("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "evaluate", project_id: projectId }),
        }),
        safeFetchJson("/api/service-ops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "intrusion_scan", project_id: projectId, node_id: nodeId }),
        }),
      ]);
      const alertData = (await alertRes.json()) as { triggered_count?: number };
      const intrData = (await intrRes.json()) as { failed_count_24h?: number; top_attackers?: Array<{ ip: string }> };
      setNotice(
        `SecOps & Watchdog Quick-Audit (${nodeId}): ${alertData.triggered_count ?? 0} Schwellenwert-Verletzungen · ${intrData.failed_count_24h ?? 0} SSH-Fehlversuche (${intrData.top_attackers?.length ?? 0} Angreifer-IPs)`
      );
    } finally {
      setSecopsBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940/90 p-3.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white">
            GitOps Stack-Deployer, Live-Log Inspector &amp; Cron-Due Runner ({SYNAPSE_VERSION})
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={secopsBusy}
            onClick={handleRunSecopsQuickAudit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/60 px-2.5 py-1 text-[11px] font-semibold text-rose-200 hover:bg-rose-900/60 disabled:opacity-50"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            {secopsBusy ? "Prüfe SecOps..." : "SecOps & Watchdog Check"}
          </button>
          <button
            type="button"
            disabled={backupBusy}
            onClick={handleCreateOffsiteBackup}
            className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-950/60 px-2.5 py-1 text-[11px] font-semibold text-purple-200 hover:bg-purple-900/60 disabled:opacity-50"
          >
            <HardDriveDownload className="h-3.5 w-3.5" />
            {backupBusy ? "Sichere Vault..." : "Offsite-Backup (AES-256-GCM)"}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !logsOpen;
              setLogsOpen(next);
              if (next && !logSnapshot) void handleTailLogs();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-950/60 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-900/60"
          >
            <ScrollText className="h-3.5 w-3.5" />
            {logsOpen ? "Live-Logs schließen" : "Live-Service-Logs"}
          </button>
          <button
            type="button"
            disabled={cronBusy}
            onClick={handleRunDueCronJobs}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-950/60 px-2.5 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-900/60 disabled:opacity-50"
          >
            <Clock className="h-3.5 w-3.5" />
            {cronBusy ? "Prüfe fällige Cron-Jobs..." : "Fällige Cron-Runbooks ausführen"}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-900/60"
          >
            <Rocket className="h-3.5 w-3.5" />
            {open ? "GitOps Studio schließen" : "GitOps Stack deployen"}
          </button>
        </div>
      </div>

      {notice && (
        <div className="mt-2 rounded-lg border border-nb-gray-800 bg-nb-gray-950/90 px-3 py-1.5 font-mono text-[11px] text-emerald-300">
          {notice}
        </div>
      )}

      {logsOpen && (
        <div className="mt-3 space-y-2 rounded-xl border border-nb-gray-800 bg-nb-gray-950/90 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-amber-300">Live-Service-Log Inspector</span>
              {logSnapshot && (
                <>
                  <span className="rounded border border-sky-500/40 bg-sky-950/70 px-1.5 py-0.5 font-mono text-[10px] uppercase text-sky-300">
                    Quelle: {logSnapshot.source}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                      logSnapshot.error_count > 0
                        ? "border border-red-500/40 bg-red-950/70 text-red-300"
                        : "border border-emerald-500/40 bg-emerald-950/70 text-emerald-300"
                    }`}
                  >
                    {logSnapshot.error_count} Errors
                  </span>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="number"
                value={logPort}
                onChange={(e) => setLogPort(e.target.value)}
                placeholder="Port"
                className="w-20 rounded border border-nb-gray-800 bg-nb-gray-900 px-2 py-1 font-mono text-[11px] text-white"
              />
              <input
                type="text"
                value={logTarget}
                onChange={(e) => setLogTarget(e.target.value)}
                placeholder="Container / systemd unit (optional)"
                className="w-48 rounded border border-nb-gray-800 bg-nb-gray-900 px-2 py-1 font-mono text-[11px] text-white"
              />
              <select
                value={logLinesLimit}
                onChange={(e) => setLogLinesLimit(Number(e.target.value))}
                className="rounded border border-nb-gray-800 bg-nb-gray-900 px-2 py-1 font-mono text-[11px] text-white"
              >
                <option value={25}>25 Zeilen</option>
                <option value={50}>50 Zeilen</option>
                <option value={100}>100 Zeilen</option>
              </select>
              <button
                type="button"
                disabled={logBusy}
                onClick={() => void handleTailLogs()}
                className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-950/70 px-2.5 py-1 text-[11px] font-semibold text-amber-200 hover:bg-amber-900/70 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${logBusy ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
          <pre className="max-h-48 overflow-auto rounded-lg border border-nb-gray-900 bg-black/70 p-2.5 font-mono text-[11px] leading-relaxed text-nb-gray-200">
            {logBusy ? "Lade Live-Logs über mTLS-PTY-Tunnel..." : logSnapshot?.logs || "Klicke auf Refresh, um Live-Logs abzurufen."}
          </pre>
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-3 border-t border-nb-gray-800/80 pt-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <input
              type="text"
              value={stackName}
              onChange={(e) => setStackName(e.target.value)}
              placeholder="Stack-Name"
              className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1.5 text-xs text-white"
            />
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/org/repo.git"
              className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1.5 font-mono text-xs text-white sm:col-span-2"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="w-20 rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2 py-1.5 font-mono text-xs text-white"
              />
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="4085"
                className="w-24 rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2 py-1.5 font-mono text-xs text-white"
              />
              <button
                type="button"
                disabled={busy}
                onClick={handleDeployStack}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                {busy ? "..." : "Deploy"}
              </button>
            </div>
          </div>

          {latestToken && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-1.5 text-[11px] text-amber-200">
              <span className="font-mono">Webhook-Token (einmalig sichtbar): {latestToken}</span>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(latestToken);
                  setCopiedToken(true);
                }}
                className="inline-flex items-center gap-1 rounded border border-amber-500/40 px-2 py-0.5 text-[10px]"
              >
                {copiedToken ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                Copy
              </button>
            </div>
          )}

          {stacks.length > 0 && (
            <div className="space-y-1.5">
              {stacks.map((st) => (
                <div
                  key={st.stack_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-nb-gray-800/80 bg-nb-gray-950/70 px-3 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{st.name}</span>
                    <span className="font-mono text-[11px] text-nb-gray-400">
                      {st.repo_url}#{st.branch} (@{st.last_commit || "HEAD"})
                    </span>
                    <span className="rounded bg-emerald-950/80 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                      :{st.port} ({st.injected_secret_keys.length} Secrets)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={logBusy}
                      onClick={() => {
                        setLogPort(String(st.port));
                        setLogTarget(st.stack_id);
                        void handleTailLogs(st.port, st.stack_id);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-950/60 px-2 py-0.5 text-[11px] text-amber-200 hover:bg-amber-900/60"
                    >
                      <ScrollText className="h-3 w-3" />
                      Logs
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleTriggerRedeploy(st.stack_id)}
                      className="inline-flex items-center gap-1 rounded border border-nb-gray-700 bg-nb-gray-900 px-2 py-0.5 text-[11px] text-nb-gray-200 hover:text-white"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Webhook Redeploy
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDeleteStack(st.stack_id)}
                      className="inline-flex items-center gap-1 rounded border border-red-500/40 bg-red-950/60 px-2 py-0.5 text-[11px] text-red-200 hover:bg-red-900/60"
                    >
                      <Trash2 className="h-3 w-3" />
                      Teardown
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
