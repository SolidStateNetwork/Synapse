"use client";

import React from "react";
import {
  Activity,
  Cpu,
  FileText,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
} from "lucide-react";
import RichMarkdownDocument from "@/components/RichMarkdownDocument";
import type { ChatItem, NavSection } from "@/types/synapse";

export interface CopilotUserMessageCardProps {
  msg: ChatItem;
  idx: number;
  primaryNode: string;
  expandedRawPrompts: Record<number, boolean>;
  setExpandedRawPrompts: React.Dispatch<
    React.SetStateAction<Record<number, boolean>>
  >;
  setPreviewPort: (port: number) => void;
  setActiveNav: (nav: NavSection) => void;
  openRemoteFile: (filePath: string) => void;
  setBrainDocTab: (doc: "Architecture.md" | "Memory.md") => void;
  setTerminalDrawerOpen: (val: boolean) => void;
  setStatusToast: (val: string) => void;
}

export function CopilotUserMessageCard({
  msg,
  idx,
  primaryNode,
  expandedRawPrompts,
  setExpandedRawPrompts,
  setPreviewPort,
  setActiveNav,
  openRemoteFile,
  setBrainDocTab,
  setTerminalDrawerOpen,
  setStatusToast,
}: CopilotUserMessageCardProps) {
  const rawContent = msg.content || "";
  const isSkillSystem =
    rawContent.includes("[Skill: CheckSystem]") ||
    rawContent.includes("[System-Check]");
  const isSkillOpsec =
    rawContent.includes("[Skill: CheckOpsec]") ||
    rawContent.includes("[OpSec-Check]");
  const isSkillUpdates =
    rawContent.includes("[Skill: CheckUpdates]") ||
    rawContent.includes("[Update & Funktionstest]") ||
    rawContent.includes("[Nur Funktionstest]") ||
    rawContent.includes("[Update-Entscheidung]");
  const isSkillForensics = rawContent.includes("[Skill: DeepForensics]");
  const isSkillSearch = rawContent.includes("[Skill: SkillSearch]");
  const isInterviewMsg =
    rawContent.includes("[Interview-Modus]") ||
    rawContent.includes("[Interview-Antwort]");

  const isStructuredAction =
    isSkillSystem ||
    isSkillOpsec ||
    isSkillUpdates ||
    isSkillForensics ||
    isSkillSearch ||
    isInterviewMsg;

  if (isStructuredAction) {
    const focusMatch = rawContent.match(
      /(?:Zusätzlicher Nutzer-Fokus|Nutzer-Suchanfrage \/ Fokus|Zusätzliche Anweisung des Nutzers):\s*"([^"]+)"/
    );
    const userFocusText = focusMatch ? focusMatch[1] : null;
    const isLongRawPrompt = rawContent.length > 260;
    const showRaw = Boolean(expandedRawPrompts[idx]);

    const actionMeta = isSkillSystem
      ? {
          badge: "SRE System-Tiefenscan",
          title: "CheckSystem (6-Phasen Infrastruktur-Audit)",
          summary:
            userFocusText ||
            "Prüft Host-Telemetrie, Ports, Quellcode, SQLite-Integrität, Logs & Brain-Sync.",
          border:
            "border-emerald-500/40 bg-gradient-to-br from-emerald-950/50 via-nb-gray-940 to-nb-gray-950",
          pill: "border-emerald-500/40 bg-emerald-950/70 text-emerald-300",
          icon: <Activity className="h-3.5 w-3.5 text-emerald-400" />,
        }
      : isSkillOpsec
      ? {
          badge: "DevSecOps Security-Audit",
          title: "CheckOpsec (Sicherheits- & Socket-Prüfung)",
          summary:
            userFocusText ||
            "Prüft Socket-Bindings, SSH-Härtung, Firewall, Dateirechte, Secrets & Header.",
          border:
            "border-sky-500/40 bg-gradient-to-br from-sky-950/50 via-nb-gray-940 to-nb-gray-950",
          pill: "border-sky-500/40 bg-sky-950/70 text-sky-300",
          icon: <Shield className="h-3.5 w-3.5 text-sky-400" />,
        }
      : isSkillUpdates
      ? {
          badge: "Muscle & Backend Updates",
          title: rawContent.includes("[Update & Funktionstest]")
            ? "Updates durchführen & End-to-End testen"
            : rawContent.includes("[Nur Funktionstest]")
            ? "End-to-End Funktionstest ausführen"
            : "CheckUpdates (Versions- & Paket-Inspektion)",
          summary:
            userFocusText ||
            (rawContent.length <= 240
              ? rawContent.replace(/\*\*/g, "")
              : "Prüft Axon-Binaries, Runtimes, Systempakete & Backends auf Updates."),
          border:
            "border-sky-500/40 bg-gradient-to-br from-sky-950/50 via-nb-gray-940 to-nb-gray-950",
          pill: "border-sky-500/40 bg-sky-950/70 text-sky-300",
          icon: <RefreshCw className="h-3.5 w-3.5 text-sky-400" />,
        }
      : isSkillForensics
      ? {
          badge: "Root-Cause Forensik",
          title: "DeepForensics (Log- & Prozess-Tiefenanalyse)",
          summary:
            userFocusText ||
            "Durchsucht Systemd-Journals, Logs, Datenbanken & Prozesse nach Fehlerursachen.",
          border:
            "border-sky-500/40 bg-gradient-to-br from-sky-950/50 via-nb-gray-940 to-nb-gray-950",
          pill: "border-sky-500/40 bg-sky-950/70 text-sky-300",
          icon: <Cpu className="h-3.5 w-3.5 text-sky-400" />,
        }
      : isSkillSearch
      ? {
          badge: "Deep-Search",
          title: "SkillSearch (Code-, System- & UI-Suche)",
          summary:
            userFocusText ||
            "Durchsucht Dateien, Ports, Datenbanken, Logs und UI-Funktionen.",
          border:
            "border-amber-500/40 bg-gradient-to-br from-amber-950/50 via-nb-gray-940 to-nb-gray-950",
          pill: "border-amber-500/40 bg-amber-950/70 text-amber-300",
          icon: <Search className="h-3.5 w-3.5 text-amber-400" />,
        }
      : {
          badge: "Interaktives Interview",
          title: rawContent.includes("[Interview-Modus]")
            ? "Interview-Modus gestartet"
            : "Interview-Entscheidung gesendet",
          summary:
            userFocusText ||
            (rawContent.includes("JA, JETZT BEHEBEN")
              ? "✅ Punkt jetzt live beheben & verifizieren"
              : rawContent.includes("ÜBERSPRINGEN")
              ? "⏭️ Punkt überspringen → weiter zum nächsten Befund"
              : rawContent.includes("ALLE RESTLICHEN")
              ? "⚡ Alle verbleibenden Punkte automatisch beheben"
              : "Schrittweise Durchsprache der Befunde & Empfehlungen."),
          border:
            "border-netbird-500/40 bg-gradient-to-br from-netbird-950/50 via-nb-gray-940 to-nb-gray-950",
          pill: "border-netbird-500/40 bg-netbird-950/70 text-netbird",
          icon: <Sparkles className="h-3.5 w-3.5 text-netbird" />,
        };

    return (
      <div
        className={`ml-4 overflow-hidden rounded-xl border p-3 text-xs shadow-sm ${actionMeta.border}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {actionMeta.icon}
            <span
              className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${actionMeta.pill}`}
            >
              {actionMeta.badge}
            </span>
          </div>
          {isLongRawPrompt && (
            <button
              type="button"
              onClick={() =>
                setExpandedRawPrompts((prev) => ({
                  ...prev,
                  [idx]: !prev[idx],
                }))
              }
              className="rounded border border-nb-gray-800 bg-nb-gray-950/80 px-1.5 py-0.5 font-mono text-[9px] text-nb-gray-400 hover:text-white transition"
            >
              {showRaw ? "Kompakt ▲" : "Prompt-Details ▼"}
            </button>
          )}
        </div>
        <div className="mt-1.5 font-semibold text-white">
          {actionMeta.title}
        </div>
        <div className="mt-0.5 text-[11px] text-nb-gray-300 leading-relaxed">
          {actionMeta.summary}
        </div>
        {showRaw && (
          <div className="mt-2 border-t border-nb-gray-800/80 pt-2">
            <RichMarkdownDocument markdown={rawContent} variant="chat" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ml-6 min-w-0 overflow-hidden break-words rounded-2xl rounded-tr-sm border border-netbird-500/40 bg-gradient-to-br from-netbird-950/70 via-netbird-950/40 to-nb-gray-940 p-3.5 text-xs text-white shadow-sm">
      <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-netbird/90">
        <span>Deine Anfrage</span>
        {primaryNode && <span>@{primaryNode}</span>}
      </div>
      {msg.attachments && msg.attachments.length > 0 && (
        <div className="mb-2.5 flex flex-wrap gap-2">
          {msg.attachments.map((att) => (
            <div
              key={att.id}
              className="group relative overflow-hidden rounded-md border border-nb-gray-700 bg-nb-gray-950"
            >
              {att.mime_type?.startsWith("image/") ? (
                <img
                  src={att.data_url}
                  alt={att.name}
                  className="h-20 w-28 object-cover"
                />
              ) : (
                <div className="flex h-14 w-28 items-center gap-1.5 px-2 font-mono text-[10px] text-nb-gray-200">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-netbird" />
                  <span className="truncate">{att.name}</span>
                </div>
              )}
              <div className="bg-black/75 px-1.5 py-0.5 font-mono text-[9px] text-nb-gray-300 truncate max-w-[112px]">
                {att.name}
              </div>
            </div>
          ))}
        </div>
      )}
      <RichMarkdownDocument
        markdown={rawContent}
        variant="chat"
        onOpenPort={(port) => {
          setPreviewPort(port);
          setActiveNav("reverse-proxy");
        }}
        onOpenFile={(filePath) => {
          setActiveNav("workspace");
          openRemoteFile(filePath);
        }}
        onOpenBrainDoc={(doc) => {
          setBrainDocTab(doc);
          setActiveNav("brain-vault");
        }}
        onRunCommand={(cmd) => {
          setTerminalDrawerOpen(true);
          navigator.clipboard.writeText(cmd);
          setStatusToast("Befehl kopiert & Live-Terminal geöffnet");
          setTimeout(() => setStatusToast(""), 3000);
        }}
      />
    </div>
  );
}
