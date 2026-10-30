"use client";

import React, { useEffect, useState } from "react";
import { Clock, Play, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Shield,
  ShieldAlert,
  X,
} from "lucide-react";
import RichMarkdownDocument from "@/components/RichMarkdownDocument";
import {
  CartridgeMeta,
  PendingApproval,
  ProjectState,
} from "@/types/synapse";
import { SynapseViewHeader } from "@/components/ui/SynapseDesignSystem";

export interface AccessRulesViewProps {
  activeProject: ProjectState | null;
  cartridges: CartridgeMeta[];
  pendingApprovals: PendingApproval[];
  selectedCartridgeId: string;
  setSelectedCartridgeId: (id: string) => void;
  showCustomCartModal: boolean;
  setShowCustomCartModal: React.Dispatch<React.SetStateAction<boolean>>;
  customCartName: string;
  setCustomCartName: (val: string) => void;
  customCartCategory: string;
  setCustomCartCategory: (val: string) => void;
  customCartDesc: string;
  setCustomCartDesc: (val: string) => void;
  customCartContent: string;
  setCustomCartContent: (val: string) => void;
  handleCreateCustomCartridge: (e: React.FormEvent) => void;
  handleToggleCartridge: (id: string) => void;
  handleResolveApproval: (
    approvalId: string,
    decision: "approve" | "reject"
  ) => void;
}

const AccessRulesView = React.memo(function AccessRulesView({
  activeProject,
  cartridges,
  pendingApprovals,
  selectedCartridgeId,
  setSelectedCartridgeId,
  showCustomCartModal,
  setShowCustomCartModal,
  customCartName,
  setCustomCartName,
  customCartCategory,
  setCustomCartCategory,
  customCartDesc,
  setCustomCartDesc,
  customCartContent,
  setCustomCartContent,
  handleCreateCustomCartridge,
  handleToggleCartridge,
  handleResolveApproval,
}: AccessRulesViewProps) {
  const { t } = useI18n();
  const activeCount = (activeProject?.active_cartridges || []).length;

  // v0.7.0 Feature 3: Scheduled Cron & Automation Runbook Manager
  const [cronJobs, setCronJobs] = useState<
    Array<{
      id: string;
      name: string;
      cron_expression: string;
      node_id: string;
      command: string;
      enabled: boolean;
      last_run_at?: string;
      last_exit_code?: number;
      last_duration_ms?: number;
      last_output?: string;
    }>
  >([]);
  const [cronBusyId, setCronBusyId] = useState<string | null>(null);
  const [newCronName, setNewCronName] = useState("");
  const [newCronExpr, setNewCronExpr] = useState("*/15 * * * *");
  const [newCronCmd, setNewCronCmd] = useState("");

  useEffect(() => {
    const pid = activeProject?.project_id || "synapse-cloud-demo";
    fetch(`/api/service-ops?project_id=${encodeURIComponent(pid)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d && Array.isArray(d.cron_jobs)) {
          setCronJobs(d.cron_jobs);
        }
      })
      .catch(() => {});
  }, [activeProject?.project_id]);

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-5">
      <SynapseViewHeader
        icon={<Shield className="h-5 w-5" />}
        accentColor="amber"
        title="Sicherheits-Regeln & KI-Richtlinien (Rule Cartridges)"
        description="Steuere in verständlicher Sprache, welche Sicherheits- und Architektur-Leitplanken der KI-Agent auf deinen Servern strikt einhalten muss. Klicke auf eine Karte, um das Regelwerk aufzuklappen."
        actions={
          <button
            type="button"
            onClick={() => setShowCustomCartModal((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl bg-netbird px-3.5 py-2 text-xs font-medium text-white hover:bg-netbird-500 transition shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Neue Regel-Cartridge erstellen</span>
          </button>
        }
      />

      {showCustomCartModal && (
        <form
          onSubmit={handleCreateCustomCartridge}
          className="rounded-xl border border-netbird-500/50 bg-nb-gray-940 p-5 space-y-3 text-xs shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">
              Eigene Regel-Cartridge erstellen (.md)
            </span>
            <button
              type="button"
              onClick={() => setShowCustomCartModal(false)}
              className="text-nb-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="text"
              value={customCartName}
              onChange={(e) => setCustomCartName(e.target.value)}
              placeholder="Cartridge-Name (z.B. DSGVO / HIPAA)"
              className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-white"
            />
            <input
              type="text"
              value={customCartCategory}
              onChange={(e) => setCustomCartCategory(e.target.value)}
              placeholder="Kategorie (z.B. Sicherheit)"
              className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-white"
            />
            <input
              type="text"
              value={customCartDesc}
              onChange={(e) => setCustomCartDesc(e.target.value)}
              placeholder="Kurzbeschreibung..."
              className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-white"
            />
          </div>
          <textarea
            value={customCartContent}
            onChange={(e) => setCustomCartContent(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-960 p-3 font-mono text-xs text-nb-gray-100"
          />
          <div className="flex justify-end gap-2">
            <button
              type="submit"
              className="rounded-lg bg-netbird px-4 py-1.5 text-xs font-medium text-white hover:bg-netbird-500 transition"
            >
              Cartridge speichern &amp; aktivieren
            </button>
          </div>
        </form>
      )}

      {/* Pending Tier-3 Approvals Gate with Visual Unified Diff Highlighting */}
      {pendingApprovals.length > 0 && (
        <div className="rounded-xl border border-netbird-500/60 bg-netbird-950/30 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-netbird flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Ausstehende Tier-3-Freigaben ({pendingApprovals.length})
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {pendingApprovals.map((req) => {
              const rawPreview = String(
                req.arguments?.command ||
                  req.arguments?.content_or_patch ||
                  req.arguments?.content ||
                  JSON.stringify(req.arguments, null, 2)
              );
              return (
                <div
                  key={req.approval_id}
                  className="rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-semibold text-white">
                      {req.tool_name}
                    </span>
                    <span className="text-nb-gray-400">{req.node_id}</span>
                  </div>
                  <div className="max-h-40 overflow-auto rounded-lg bg-nb-gray-960 p-2.5 font-mono text-[11px] space-y-0.5">
                    {rawPreview.split("\n").map((line, idx) => {
                      const isAdd =
                        line.startsWith("+") && !line.startsWith("+++");
                      const isDel =
                        line.startsWith("-") && !line.startsWith("---");
                      const isHunk = line.startsWith("@@");
                      return (
                        <div
                          key={idx}
                          className={`px-1 rounded-sm whitespace-pre-wrap break-all ${
                            isAdd
                              ? "bg-emerald-950/70 text-emerald-300"
                              : isDel
                                ? "bg-red-950/70 text-red-300"
                                : isHunk
                                  ? "bg-sky-950/60 text-sky-300"
                                  : "text-nb-gray-200"
                          }`}
                        >
                          {line}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleResolveApproval(req.approval_id, "approve")
                      }
                      className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition"
                    >
                      Freigeben &amp; Ausführen
                    </button>
                    <button
                      onClick={() =>
                        handleResolveApproval(req.approval_id, "reject")
                      }
                      className="flex-1 rounded-lg border border-red-500/50 bg-red-950/50 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950 transition"
                    >
                      Ablehnen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pluggable Rule Cartridges Grid with Inline Expandable Markdown Policy */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-start">
        {cartridges.map((c) => {
          const enabled = activeProject?.active_cartridges?.includes(c.id);
          const selected = selectedCartridgeId === c.id;
          return (
            <div
              key={c.id}
              onClick={() => setSelectedCartridgeId(selected ? "" : c.id)}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                selected
                  ? "border-netbird bg-nb-gray-930 ring-1 ring-netbird/30 sm:col-span-2"
                  : "border-nb-gray-900 bg-nb-gray-940 hover:border-nb-gray-800"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        enabled ? "bg-emerald-400" : "bg-nb-gray-500"
                      }`}
                    />
                    <span className="text-sm font-semibold text-white leading-snug">
                      {c.name}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 font-mono text-[9.5px] text-nb-gray-400">
                    {c.category}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-nb-gray-400 hover:text-white">
                    <span>{selected ? "Einklappen" : "Erweitern"}</span>
                    {selected ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleCartridge(c.id);
                    }}
                    className={`rounded-md border px-2.5 py-1 font-mono text-[10px] font-medium transition ${
                      enabled
                        ? "border-emerald-500/50 bg-emerald-950/70 text-emerald-400"
                        : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-400 hover:text-white"
                    }`}
                  >
                    {enabled ? "AKTIV" : "AUS"}
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-nb-gray-400">{c.description}</p>

              {selected && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3.5 border-t border-nb-gray-800 pt-3.5"
                >
                  <RichMarkdownDocument markdown={c.content} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* v0.7.0 FEATURE 3: SCHEDULED CRON & AUTOMATION RUNBOOK MANAGER */}
      <div className="rounded-xl border border-nb-gray-900 bg-nb-gray-940 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-400" />
              <span>
                {t(
                  "Geplante Cron-Jobs & Runbook-Manager (v0.7.0)",
                  "Scheduled Cron & Automation Runbook Manager (v0.7.0)"
                )}
              </span>
            </h2>
            <p className="text-xs text-nb-gray-400 mt-0.5">
              {t(
                "Zeitgesteuerte Shell-Runbooks auf vps2-muscle mit 1-Klick Sofort-Test (Jetzt ausführen), Exit-Code & Laufzeit-Überwachung.",
                "Scheduled shell runbooks on vps2-muscle with 1-Click Run Now, exit code & duration monitoring."
              )}
            </p>
          </div>
          <span className="rounded-md border border-emerald-500/40 bg-emerald-950/70 px-2.5 py-1 font-mono text-[10px] text-emerald-300">
            {cronJobs.length}{" "}
            {t("aktive Cron-Runbooks", "active Cron Runbooks")}
          </span>
        </div>

        <div className="space-y-2.5">
          {cronJobs.map((job) => (
            <div
              key={job.id}
              className="flex flex-col gap-2 rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-3.5 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      job.enabled ? "bg-emerald-400" : "bg-nb-gray-500"
                    }`}
                  />
                  <span className="font-semibold text-white truncate">
                    {job.name}
                  </span>
                  <span className="rounded border border-nb-gray-800 bg-nb-gray-930 px-2 py-0.5 font-mono text-[10px] text-netbird">
                    🕒 {job.cron_expression}
                  </span>
                  <span className="rounded border border-nb-gray-800 bg-nb-gray-930 px-2 py-0.5 font-mono text-[10px] text-nb-gray-300">
                    {job.node_id}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {typeof job.last_exit_code === "number" && (
                    <span
                      className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                        job.last_exit_code === 0
                          ? "border-emerald-500/40 bg-emerald-950/80 text-emerald-300"
                          : "border-red-500/40 bg-red-950/80 text-red-300"
                      }`}
                    >
                      Exit {job.last_exit_code} · {job.last_duration_ms ?? 25} ms
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={cronBusyId === job.id}
                    onClick={async () => {
                      setCronBusyId(job.id);
                      try {
                        const r = await fetch("/api/service-ops", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "run_cron_job",
                            project_id:
                              activeProject?.project_id || "synapse-cloud-demo",
                            id: job.id,
                            node_id: job.node_id || "vps2-muscle",
                          }),
                        });
                        const d = await r.json();
                        const nextJobs = d.jobs || d.cron_jobs;
                        if (d.ok && Array.isArray(nextJobs)) {
                          setCronJobs(nextJobs);
                        }
                      } finally {
                        setCronBusyId(null);
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-netbird px-2.5 py-1 font-mono text-[10.5px] font-semibold text-white hover:bg-netbird-500 disabled:opacity-50 transition"
                  >
                    <Play className="h-3 w-3" />
                    <span>
                      {cronBusyId === job.id
                        ? t("Läuft...", "Running...")
                        : t("Jetzt ausführen", "Run Now")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const r = await fetch("/api/service-ops", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "delete_cron_job",
                          project_id:
                            activeProject?.project_id || "synapse-cloud-demo",
                          id: job.id,
                        }),
                      });
                      const d = await r.json();
                      if (d.ok && Array.isArray(d.cron_jobs)) {
                        setCronJobs(d.cron_jobs);
                      }
                    }}
                    className="rounded p-1 text-nb-gray-500 hover:text-red-400"
                    title={t("Cron-Runbook löschen", "Delete Cron Runbook")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10.5px] text-nb-gray-400">
                <code className="truncate text-sky-300">$ {job.command}</code>
                {job.last_run_at && (
                  <span>
                    {t("Letzter Lauf:", "Last run:")}{" "}
                    {job.last_run_at.replace("T", " ").slice(0, 19)}
                  </span>
                )}
              </div>

              {job.last_output && (
                <div className="rounded-lg border border-nb-gray-800/80 bg-black/50 px-3 py-1.5 font-mono text-[10px] text-nb-gray-300 truncate">
                  ➜ {job.last_output}
                </div>
              )}
            </div>
          ))}
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newCronName.trim() || !newCronCmd.trim()) return;
            const r = await fetch("/api/service-ops", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "save_cron_job",
                project_id: activeProject?.project_id || "synapse-cloud-demo",
                name: newCronName.trim(),
                cron_expression: newCronExpr.trim() || "*/15 * * * *",
                node_id: "vps2-muscle",
                command: newCronCmd.trim(),
                enabled: true,
              }),
            });
            const d = await r.json();
            if (d.ok && Array.isArray(d.cron_jobs)) {
              setCronJobs(d.cron_jobs);
              setNewCronName("");
              setNewCronCmd("");
            }
          }}
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 pt-1 text-xs"
        >
          <input
            type="text"
            required
            value={newCronName}
            onChange={(e) => setNewCronName(e.target.value)}
            placeholder={t(
              "Job-Name (z.B. SSL-Check)",
              "Job Name (e.g. SSL Check)"
            )}
            className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 text-white"
          />
          <input
            type="text"
            required
            value={newCronExpr}
            onChange={(e) => setNewCronExpr(e.target.value)}
            placeholder="*/15 * * * *"
            className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 font-mono text-netbird"
          />
          <input
            type="text"
            required
            value={newCronCmd}
            onChange={(e) => setNewCronCmd(e.target.value)}
            placeholder={t(
              "Befehl (z.B. df -h /)",
              "Command (e.g. df -h /)"
            )}
            className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 font-mono text-sky-300"
          />
          <button
            type="submit"
            className="whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-2 font-semibold text-white hover:bg-emerald-500 transition"
          >
            {t("+ Cron-Runbook speichern", "+ Save Cron Runbook")}
          </button>
        </form>
      </div>
    </div>
  );
});

export default AccessRulesView;
