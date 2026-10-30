"use client";

import React from "react";
import {
  Activity,
  Brain,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import RichMarkdownDocument from "@/components/RichMarkdownDocument";
import { ChatItem, NavSection } from "@/types/synapse";
import type { LiveStepItem } from "../CopilotDrawer";

export interface PostSkillAndInterviewControlsProps {
  idx: number;
  msg: ChatItem;
  chatHistory: ChatItem[];
  chatBusy: boolean;
  handleUpdateSkillDecision: (
    decision: "execute_and_test" | "test_only" | "skip",
    reportContent: string
  ) => void;
  handleStartSkillInterview: (reportContent: string) => void;
  handleInterviewStepResponse: (
    action: "fix" | "skip" | "fix_all" | "stop"
  ) => void;
}

export function PostSkillAndInterviewControls({
  idx,
  msg,
  chatHistory,
  chatBusy,
  handleUpdateSkillDecision,
  handleStartSkillInterview,
  handleInterviewStepResponse,
}: PostSkillAndInterviewControlsProps) {
  const prevUserContent =
    idx > 0 && chatHistory[idx - 1]?.role === "user"
      ? chatHistory[idx - 1].content || ""
      : "";
  const isInterviewTurn =
    (prevUserContent.includes("[Interview-Modus]") ||
      prevUserContent.includes("[Interview-Antwort]")) &&
    !prevUserContent.includes("Interview beenden") &&
    !prevUserContent.includes("Alle restlichen Punkte");
  const asksToFixOrSkip =
    /beheben oder überspringen|soll ich diesen punkt/i.test(msg.content);
  const showInterviewControls = isInterviewTurn || asksToFixOrSkip;

  const isUpdateCheckReport =
    !showInterviewControls &&
    !prevUserContent.includes("[Interview-") &&
    !prevUserContent.includes("[Update-") &&
    (prevUserContent.includes("[Skill: CheckUpdates]") ||
      /sollen diese updates.*durchgeführt|muscle.*backend.*update-bericht/i.test(
        msg.content
      ));

  const isSkillReport =
    !showInterviewControls &&
    !isUpdateCheckReport &&
    !prevUserContent.includes("[Interview-") &&
    msg.content.length > 260 &&
    (prevUserContent.includes("[Skill: CheckSystem]") ||
      prevUserContent.includes("[Skill: CheckOpsec]") ||
      prevUserContent.includes("[Skill: DeepForensics]") ||
      (msg.content.length > 400 &&
        (msg.toolResults?.length || 0) >= 2 &&
        /Empfehlung|Härtung|Befund|OpSec|Verbesserung|CheckSystem|CheckOpsec|Forensik/i.test(
          msg.content
        )));

  if (isUpdateCheckReport) {
    return (
      <div className="mt-3 rounded-xl border border-sky-500/40 bg-gradient-to-br from-sky-950/35 via-nb-gray-940 to-nb-gray-940 p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-sky-300">
            <RefreshCw className="h-3.5 w-3.5 text-sky-400" />
            <span>
              Muscle &amp; Backend Updates: Sollen die Updates durchgeführt
              &amp; getestet werden?
            </span>
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={chatBusy}
            onClick={() =>
              handleUpdateSkillDecision("execute_and_test", msg.content)
            }
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-950/60 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-900/70 hover:text-white disabled:opacity-40 transition"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Ja, Updates durchführen &amp; Funktionstest starten</span>
          </button>
          <button
            type="button"
            disabled={chatBusy}
            onClick={() => handleUpdateSkillDecision("test_only", msg.content)}
            className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-950/50 px-2.5 py-1.5 text-[11px] font-medium text-sky-200 hover:bg-sky-900/60 hover:text-white disabled:opacity-40 transition"
          >
            <Activity className="h-3.5 w-3.5 text-sky-400" />
            <span>Nur Funktionstest ausführen</span>
          </button>
          <button
            type="button"
            disabled={chatBusy}
            onClick={() => handleStartSkillInterview(msg.content)}
            className="flex items-center gap-1.5 rounded-lg border border-netbird-500/40 bg-netbird/15 px-2.5 py-1.5 text-[11px] font-medium text-netbird hover:bg-netbird/25 hover:text-white disabled:opacity-40 transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Einzeln im Interview durchgehen</span>
          </button>
          <button
            type="button"
            disabled={chatBusy}
            onClick={() => handleUpdateSkillDecision("skip", msg.content)}
            className="flex items-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1.5 text-[11px] text-nb-gray-400 hover:border-red-500/40 hover:text-red-300 disabled:opacity-40 transition"
          >
            <X className="h-3 w-3" />
            <span>Nein, keine Updates</span>
          </button>
        </div>
      </div>
    );
  }

  if (showInterviewControls) {
    return (
      <div className="mt-3 rounded-xl border border-netbird-500/40 bg-gradient-to-br from-netbird-950/40 via-nb-gray-940 to-nb-gray-940 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-netbird">
            <Sparkles className="h-3 w-3" />
            <span>DevOps Interview-Modus: Deine Entscheidung</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={chatBusy}
            onClick={() => handleInterviewStepResponse("fix")}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-950/50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-900/70 hover:text-white disabled:opacity-40 transition"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Ja, jetzt beheben</span>
          </button>
          <button
            type="button"
            disabled={chatBusy}
            onClick={() => handleInterviewStepResponse("skip")}
            className="flex items-center gap-1.5 rounded-lg border border-nb-gray-700 bg-nb-gray-900 px-2.5 py-1.5 text-[11px] font-medium text-nb-gray-200 hover:border-nb-gray-500 hover:text-white disabled:opacity-40 transition"
          >
            <ChevronRight className="h-3.5 w-3.5 text-nb-gray-400" />
            <span>Nicht beheben (Nächster Punkt)</span>
          </button>
          <button
            type="button"
            disabled={chatBusy}
            onClick={() => handleInterviewStepResponse("fix_all")}
            className="flex items-center gap-1.5 rounded-lg border border-netbird-500/40 bg-netbird/15 px-2.5 py-1.5 text-[11px] font-medium text-netbird hover:bg-netbird/25 hover:text-white disabled:opacity-40 transition"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Alle restlichen beheben</span>
          </button>
          <button
            type="button"
            disabled={chatBusy}
            onClick={() => handleInterviewStepResponse("stop")}
            className="flex items-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2 py-1.5 text-[11px] text-nb-gray-400 hover:border-red-500/40 hover:text-red-300 disabled:opacity-40 transition"
          >
            <X className="h-3 w-3" />
            <span>Interview beenden</span>
          </button>
        </div>
        <p className="text-[10px] text-nb-gray-400">
          Tipp: Du kannst auch direkt ins Textfeld schreiben, wenn die KI diesen
          Punkt auf eine bestimmte Weise anpassen soll.
        </p>
      </div>
    );
  }

  if (isSkillReport) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-netbird-500/40 bg-gradient-to-r from-netbird-950/45 via-nb-gray-940 to-nb-gray-940 px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="font-semibold text-xs text-white">
            Befunde &amp; Empfehlungen Schritt für Schritt durchgehen?
          </div>
          <div className="text-[11px] text-nb-gray-400">
            Im Interview-Modus stellt dir die KI jeden Punkt einzeln vor und
            fragt dich, ob sie ihn direkt beheben soll.
          </div>
        </div>
        <button
          type="button"
          disabled={chatBusy}
          onClick={() => handleStartSkillInterview(msg.content)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-netbird px-3 py-1.5 text-xs font-semibold text-white hover:bg-netbird-500 disabled:opacity-40 transition shadow-sm"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Interview starten</span>
        </button>
      </div>
    );
  }

  return null;
}

export interface LiveStreamingProgressCardProps {
  liveSteps: LiveStepItem[];
  chatElapsedSec: number;
  streamingThinkingText: string;
  streamingReplyText: string;
  setPreviewPort: (port: number) => void;
  setActiveNav: (nav: NavSection) => void;
  openRemoteFile: (filePath: string) => void;
  setBrainDocTab: (doc: "Architecture.md" | "Memory.md") => void;
  setTerminalDrawerOpen: (val: boolean) => void;
  setStatusToast: (val: string) => void;
}

export function LiveStreamingProgressCard({
  liveSteps,
  chatElapsedSec,
  streamingThinkingText,
  streamingReplyText,
  setPreviewPort,
  setActiveNav,
  openRemoteFile,
  setBrainDocTab,
  setTerminalDrawerOpen,
  setStatusToast,
}: LiveStreamingProgressCardProps) {
  return (
    <div className="rounded-2xl border border-netbird-500/40 bg-gradient-to-b from-nb-gray-930 to-nb-gray-940 p-3.5 text-xs space-y-2.5 shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-netbird font-semibold">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          <span>
            Senior DevOps KI-Analyse läuft ({liveSteps.length} Schritte ·{" "}
            {chatElapsedSec}s)...
          </span>
        </div>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2 py-0.5 font-mono text-[9px] text-emerald-300">
          ⚡ Live Stream
        </span>
      </div>

      {liveSteps.length > 0 && (
        <div className="grid grid-cols-1 gap-1.5">
          {liveSteps.map((s, i) => (
            <div
              key={i}
              className="rounded-lg border border-nb-gray-800/80 bg-nb-gray-950/75 px-2.5 py-1.5 font-mono text-[11px] text-nb-gray-300 space-y-0.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="rounded bg-nb-gray-900 px-1.5 py-0.2 text-[9px] text-netbird">
                    #{s.step}
                  </span>
                  <span className="text-white font-semibold">
                    {s.tool_name}
                  </span>
                  {s.cached && (
                    <span className="rounded bg-emerald-950 px-1 text-[9px] text-emerald-300">
                      CACHE HIT
                    </span>
                  )}
                </span>
                <span className="text-netbird uppercase text-[10px]">
                  {s.status}
                </span>
              </div>
              {s.detail && (
                <div className="truncate text-[10px] text-nb-gray-400">
                  {s.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {streamingThinkingText && (
        <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-2.5 font-mono text-[10px] text-nb-gray-400 whitespace-pre-wrap">
          <div className="mb-1 flex items-center gap-1 text-netbird">
            <Brain className="h-3 w-3" />
            <span>Thinking...</span>
          </div>
          {streamingThinkingText}
        </div>
      )}

      {streamingReplyText && (
        <div className="border-t border-nb-gray-800 pt-2.5 text-nb-gray-100 min-w-0 break-words">
          <RichMarkdownDocument
            markdown={streamingReplyText}
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
      )}
    </div>
  );
}
