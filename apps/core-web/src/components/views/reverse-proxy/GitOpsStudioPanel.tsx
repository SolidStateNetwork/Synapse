"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, Clock, Copy, GitBranch, Play, RefreshCw, Rocket } from "lucide-react";
import { safeFetchJson } from "@/lib/safeFetch";

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
      const data = (await res.json()) as { ok?: boolean; error?: string; webhook_token?: string; stacks?: GitOpsStackViewItem[]; stack?: GitOpsStackViewItem };
      if (data.ok) {
        if (Array.isArray(data.stacks)) setStacks(data.stacks);
        if (data.webhook_token) setLatestToken(data.webhook_token);
        setNotice(`GitOps Stack '${data.stack?.name || stackName}' deployed on :${data.stack?.port || port} (@ ${data.stack?.last_commit || "HEAD"})`);
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

  return (
    <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940/90 p-3.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold text-white">
            GitOps Stack-Deployer (`Secrets.enc` -&gt; `0600 .env`) &amp; Autonomous Cron-Due Runner
          </span>
        </div>
        <div className="flex items-center gap-2">
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
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleTriggerRedeploy(st.stack_id)}
                    className="inline-flex items-center gap-1 rounded border border-nb-gray-700 bg-nb-gray-900 px-2 py-0.5 text-[11px] text-nb-gray-200 hover:text-white"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Webhook Redeploy
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
