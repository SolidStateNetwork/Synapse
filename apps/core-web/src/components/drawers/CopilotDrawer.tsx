"use client";

import React from "react";
import {
  Activity,
  Brain,
  Check,
  Copy,
  Cpu,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import RichMarkdownDocument from "@/components/RichMarkdownDocument";
import {
  ChatAttachment,
  ChatItem,
  NavSection,
  ProjectState,
  PromptCacheMetrics,
} from "@/types/synapse";
import { CopilotComposer } from "./copilot/CopilotComposer";
import {
  LiveStreamingProgressCard,
  PostSkillAndInterviewControls,
  TurnToolExecutionPipeline,
} from "./copilot/CopilotToolAndActionCards";

export type SelectedChatSkillType =
  | "CheckSystem"
  | "CheckOpsec"
  | "SkillSearch"
  | "DeepForensics"
  | "CheckUpdates"
  | null;

export interface LiveStepItem {
  step: number;
  tool_name: string;
  detail?: string;
  cached?: boolean;
  status: "running" | "executed" | "blocked" | "requires_approval" | "error";
}

export interface MentionCandidateItem {
  token: string;
  label: string;
  category: string;
}

export interface CopilotDrawerProps {
  locale: string;
  activeProject: ProjectState | null;
  primaryNode: string;
  copilotWide: boolean;
  setCopilotWide: React.Dispatch<React.SetStateAction<boolean>>;
  copilotWidth: number;
  setCopilotWidth: React.Dispatch<React.SetStateAction<number>>;
  setCopilotDrawerOpen: (val: boolean) => void;
  isDraggingOverChat: boolean;
  setIsDraggingOverChat: (val: boolean) => void;
  processDroppedOrSelectedFiles: (files: FileList | File[]) => void;
  enablePromptCaching: boolean;
  setEnablePromptCaching: React.Dispatch<React.SetStateAction<boolean>>;
  latestCacheMetrics: PromptCacheMetrics | null;
  handleClearChat: () => void;
  chatHistory: ChatItem[];
  chatMessageFilter: "all" | "reports" | "user";
  setChatMessageFilter: (val: "all" | "reports" | "user") => void;
  chatScrollRef: React.RefObject<HTMLDivElement | null>;
  chatInputRef: React.RefObject<HTMLTextAreaElement | null>;
  chatComposerRef: React.RefObject<HTMLFormElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  expandedThinking: Record<number, boolean>;
  setExpandedThinking: React.Dispatch<
    React.SetStateAction<Record<number, boolean>>
  >;
  expandedRawPrompts: Record<number, boolean>;
  setExpandedRawPrompts: React.Dispatch<
    React.SetStateAction<Record<number, boolean>>
  >;
  copiedChatMsgIdx: number | null;
  setCopiedChatMsgIdx: (val: number | null) => void;
  expandedTurnTools: Record<number, boolean>;
  setExpandedTurnTools: React.Dispatch<
    React.SetStateAction<Record<number, boolean>>
  >;
  turnToolCategoryFilter: Record<number, string>;
  setTurnToolCategoryFilter: React.Dispatch<
    React.SetStateAction<Record<number, string>>
  >;
  expandedTools: Record<string, boolean>;
  setExpandedTools: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  setPreviewPort: (port: number) => void;
  setActiveNav: (nav: NavSection) => void;
  openRemoteFile: (filePath: string) => void;
  setBrainDocTab: (doc: "Architecture.md" | "Memory.md") => void;
  setTerminalDrawerOpen: (val: boolean) => void;
  setStatusToast: (val: string) => void;
  setSelectedChatSkill: (skill: SelectedChatSkillType) => void;
  selectedChatSkill: SelectedChatSkillType;
  chatBusy: boolean;
  chatElapsedSec: number;
  liveSteps: LiveStepItem[];
  streamingThinkingText: string;
  streamingReplyText: string;
  handleUpdateSkillDecision: (
    decision: "execute_and_test" | "test_only" | "skip",
    reportContent: string
  ) => void;
  handleStartSkillInterview: (reportContent: string) => void;
  handleInterviewStepResponse: (
    action: "fix" | "skip" | "fix_all" | "stop"
  ) => void;
  setSelectedServiceId: (id: string) => void;
  setServiceActionMethod: (
    m: "GET" | "POST" | "PUT" | "DELETE" | "SQL"
  ) => void;
  setServiceActionPath: (p: string) => void;
  setServiceActionPayload: (p: string) => void;
  handleInvokeServiceAction: (override?: {
    nodeId?: string;
    port?: number;
    method?: "GET" | "POST" | "PUT" | "DELETE" | "SQL";
    path?: string;
    payload?: string;
    dbPath?: string;
  }) => void;
  handleRollbackSnapshot: (snapshotId: string, targetPath?: string) => void;
  handleSendPrompt: (e?: React.FormEvent) => void;
  skillMenuOpen: boolean;
  setSkillMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mentionMenuOpen: boolean;
  setMentionMenuOpen: (val: boolean) => void;
  setMentionFilter: (val: string) => void;
  mentionCandidates: MentionCandidateItem[];
  insertMentionToken: (token: string) => void;
  chatAttachments: ChatAttachment[];
  setChatAttachments: React.Dispatch<React.SetStateAction<ChatAttachment[]>>;
  chatInput: string;
  setChatInput: React.Dispatch<React.SetStateAction<string>>;
  handleChatInputChange: (val: string) => void;
  handleChatPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
}

const CopilotDrawer = React.memo(function CopilotDrawer(
  props: CopilotDrawerProps
) {
  const {
    locale,
    activeProject,
    primaryNode,
    copilotWide,
    setCopilotWide,
    copilotWidth,
    setCopilotWidth,
    setCopilotDrawerOpen,
    isDraggingOverChat,
    setIsDraggingOverChat,
    processDroppedOrSelectedFiles,
    enablePromptCaching,
    setEnablePromptCaching,
    latestCacheMetrics,
    handleClearChat,
    chatHistory,
    chatMessageFilter,
    setChatMessageFilter,
    chatScrollRef,
    chatInputRef,
    expandedThinking,
    setExpandedThinking,
    expandedRawPrompts,
    setExpandedRawPrompts,
    copiedChatMsgIdx,
    setCopiedChatMsgIdx,
    expandedTurnTools,
    setExpandedTurnTools,
    turnToolCategoryFilter,
    setTurnToolCategoryFilter,
    expandedTools,
    setExpandedTools,
    setPreviewPort,
    setActiveNav,
    openRemoteFile,
    setBrainDocTab,
    setTerminalDrawerOpen,
    setStatusToast,
    setSelectedChatSkill,
    chatBusy,
    chatElapsedSec,
    liveSteps,
    streamingThinkingText,
    streamingReplyText,
    handleUpdateSkillDecision,
    handleStartSkillInterview,
    handleInterviewStepResponse,
    setSelectedServiceId,
    setServiceActionMethod,
    setServiceActionPath,
    setServiceActionPayload,
    handleInvokeServiceAction,
    handleRollbackSnapshot,
  } = props;

  return (
    <aside
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOverChat(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget === e.target) {
          setIsDraggingOverChat(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOverChat(false);
        if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
          processDroppedOrSelectedFiles(e.dataTransfer.files);
        }
      }}
      style={{
        width: `${copilotWide ? 600 : copilotWidth}px`,
      }}
      className="relative flex shrink-0 flex-col border-l border-nb-gray-900 bg-nb-gray-940"
    >
      <div
        title="Mit der Maus ziehen, um die Breite des KI-Chats frei anzupassen"
        onMouseDown={(e) => {
          e.preventDefault();
          const startX = e.clientX;
          const startW = copilotWide ? 600 : copilotWidth;
          setCopilotWide(false);
          const onMove = (ev: MouseEvent) => {
            const nextW = startW - (ev.clientX - startX);
            setCopilotWidth(Math.max(320, Math.min(820, nextW)));
          };
          const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        }}
        className="absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 cursor-col-resize hover:bg-netbird/60 transition-colors z-30"
      />

      {isDraggingOverChat && (
        <div
          onDragLeave={() => setIsDraggingOverChat(false)}
          className="pointer-events-none absolute inset-2 z-40 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-netbird bg-nb-gray-950/90 p-6 text-center backdrop-blur-sm"
        >
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-netbird-500/40 bg-netbird-950 text-netbird">
            <ImageIcon className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-white">
            Drop Screenshots, Diagrams, or Logs Here
          </p>
          <p className="mt-1 text-xs text-nb-gray-300">
            Synapse Vision will inspect your images and translate them into
            server configs or bug fixes.
          </p>
        </div>
      )}

      <div className="border-b border-nb-gray-900 bg-nb-gray-950/60 px-3.5 py-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird/15 text-netbird">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="truncate text-xs font-semibold text-white">
              Synapse AI
            </span>
            <button
              type="button"
              onClick={() => setEnablePromptCaching((prev) => !prev)}
              className={`inline-flex h-[22px] items-center justify-center gap-1 rounded-md border px-2 text-[10px] font-medium leading-none transition ${
                enablePromptCaching
                  ? "border-emerald-500/35 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-950/90"
                  : "border-nb-gray-800 bg-nb-gray-930 text-nb-gray-400 hover:border-nb-gray-700 hover:text-nb-gray-200"
              }`}
            >
              <Zap
                className={`h-2.5 w-2.5 shrink-0 ${
                  enablePromptCaching ? "text-emerald-400" : "text-nb-gray-500"
                }`}
              />
              <span>
                {enablePromptCaching
                  ? latestCacheMetrics
                    ? `Cache (${latestCacheMetrics.cached_tokens} tok)`
                    : "Cache aktiv"
                  : "Cache aus"}
              </span>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (copilotWide) {
                  setCopilotWide(false);
                  setCopilotWidth(420);
                } else {
                  setCopilotWide(true);
                  setCopilotWidth(600);
                }
              }}
              className="inline-flex h-[22px] items-center justify-center rounded-md border border-nb-gray-800 bg-nb-gray-930 px-2 text-[10px] font-medium leading-none text-nb-gray-300 hover:border-nb-gray-700 hover:text-white transition"
            >
              {copilotWide ? "Kompakt" : "Breiter"}
            </button>
            <button
              onClick={handleClearChat}
              className="inline-flex h-[22px] items-center justify-center rounded-md border border-nb-gray-800 bg-nb-gray-930 px-2 text-[10px] font-medium leading-none text-nb-gray-400 hover:border-nb-gray-700 hover:text-white transition"
            >
              Reset
            </button>
            <button
              onClick={() => setCopilotDrawerOpen(false)}
              className="text-nb-gray-400 hover:text-white p-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {chatHistory.length > 2 && (
          <div className="flex items-center justify-between gap-1 rounded-lg border border-nb-gray-800/80 bg-nb-gray-940/80 p-1">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: "all", label: `Alle (${chatHistory.length})` },
                  {
                    id: "reports",
                    label: `KI-Antworten (${
                      chatHistory.filter((m) => m.role === "assistant").length
                    })`,
                  },
                  {
                    id: "user",
                    label: `Aktionen (${
                      chatHistory.filter((m) => m.role === "user").length
                    })`,
                  },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setChatMessageFilter(tab.id)}
                  className={`rounded-md px-2 py-0.5 font-mono text-[10px] transition ${
                    chatMessageFilter === tab.id
                      ? "bg-netbird text-white font-semibold"
                      : "text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="hidden sm:inline px-1.5 font-mono text-[9px] text-nb-gray-400">
              Interaktive Ansicht
            </span>
          </div>
        )}
      </div>

      <div
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto p-3.5 space-y-3.5"
      >
        {chatHistory.map((msg, idx) => {
          if (chatMessageFilter === "reports" && msg.role !== "assistant") {
            return null;
          }
          if (chatMessageFilter === "user" && msg.role !== "user") {
            return null;
          }

          const thinkingOpen = expandedThinking[idx];
          const rawContent = msg.content || "";

          if (msg.role === "user") {
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
            const isSkillForensics = rawContent.includes(
              "[Skill: DeepForensics]"
            );
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
                    icon: (
                      <Activity className="h-3.5 w-3.5 text-emerald-400" />
                    ),
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
                  key={idx}
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
                      <RichMarkdownDocument
                        markdown={rawContent}
                        variant="chat"
                      />
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={idx}
                className="ml-6 min-w-0 overflow-hidden break-words rounded-2xl rounded-tr-sm border border-netbird-500/40 bg-gradient-to-br from-netbird-950/70 via-netbird-950/40 to-nb-gray-940 p-3.5 text-xs text-white shadow-sm"
              >
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

          const isWatchdogMsg = rawContent.includes(
            "Proactive Auto-Watchdog Triggered"
          );
          if (isWatchdogMsg) {
            const prevMsg = idx > 0 ? chatHistory[idx - 1] : null;
            if (
              prevMsg &&
              prevMsg.role === "assistant" &&
              (prevMsg.content || "").includes(
                "Proactive Auto-Watchdog Triggered"
              )
            ) {
              return null;
            }
            let bundleCount = 1;
            for (let k = idx + 1; k < chatHistory.length; k++) {
              if (
                chatHistory[k].role === "assistant" &&
                (chatHistory[k].content || "").includes(
                  "Proactive Auto-Watchdog Triggered"
                )
              ) {
                bundleCount++;
              } else {
                break;
              }
            }

            const watchdogExpanded = Boolean(expandedTurnTools[idx]);

            return (
              <div
                key={idx}
                className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-nb-gray-940 to-nb-gray-940 px-3 py-2 text-xs text-nb-gray-200 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-950/70 px-2 py-0.5 font-mono text-[9px] font-semibold text-amber-300 shrink-0">
                      🛡️ Auto-Watchdog ({bundleCount}x)
                    </span>
                    <span className="truncate text-[11px] font-medium text-white">
                      Selbstheilung für Microservice :4050 ausgeführt
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedTurnTools((prev) => ({
                        ...prev,
                        [idx]: !prev[idx],
                      }))
                    }
                    className="shrink-0 font-mono text-[10px] text-amber-300 hover:text-white"
                  >
                    {watchdogExpanded ? "Kompakt ▲" : "Details ▼"}
                  </button>
                </div>
                {watchdogExpanded && (
                  <div className="mt-2 border-t border-nb-gray-800/70 pt-2">
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
                    />
                  </div>
                )}
              </div>
            );
          }

          const prevUserText =
            idx > 0 && chatHistory[idx - 1]?.role === "user"
              ? chatHistory[idx - 1].content || ""
              : "";

          const assistantTheme =
            prevUserText.includes("CheckOpsec") ||
            prevUserText.includes("[OpSec-Check]")
              ? {
                  label: "DevSecOps Security-Bericht",
                  badgeClass: "border-sky-500/35 bg-sky-950/60 text-sky-300",
                  cardBorder: "border-sky-500/25",
                  icon: <Shield className="h-3 w-3 text-sky-400" />,
                }
              : prevUserText.includes("CheckUpdates") ||
                prevUserText.includes("[Update")
              ? {
                  label: "Update- & Test-Inspektor",
                  badgeClass: "border-sky-500/35 bg-sky-950/60 text-sky-300",
                  cardBorder: "border-sky-500/25",
                  icon: <RefreshCw className="h-3 w-3 text-sky-400" />,
                }
              : prevUserText.includes("CheckSystem") ||
                prevUserText.includes("[System-Check]")
              ? {
                  label: "SRE System-Tiefenbericht",
                  badgeClass:
                    "border-emerald-500/35 bg-emerald-950/60 text-emerald-300",
                  cardBorder: "border-emerald-500/25",
                  icon: <Activity className="h-3 w-3 text-emerald-400" />,
                }
              : prevUserText.includes("DeepForensics")
              ? {
                  label: "Root-Cause Forensik",
                  badgeClass: "border-sky-500/35 bg-sky-950/60 text-sky-300",
                  cardBorder: "border-sky-500/25",
                  icon: <Cpu className="h-3 w-3 text-sky-400" />,
                }
              : prevUserText.includes("[Interview-")
              ? {
                  label: "DevOps Interview-Begleiter",
                  badgeClass:
                    "border-netbird-500/40 bg-netbird-950/60 text-netbird",
                  cardBorder: "border-netbird-500/30",
                  icon: <Sparkles className="h-3 w-3 text-netbird" />,
                }
              : {
                  label: idx === 0 ? "Synapse Control Center" : "Synapse AI",
                  badgeClass:
                    "border-nb-gray-700 bg-nb-gray-900 text-nb-gray-200",
                  cardBorder: "border-nb-gray-800/90",
                  icon: <Sparkles className="h-3 w-3 text-netbird" />,
                };

          const isWelcomeCard =
            rawContent.startsWith("Welcome to **Synapse Control Center**") ||
            rawContent.startsWith(
              "Willkommen im **Synapse Control Center**"
            ) ||
            rawContent.startsWith("Willkommen im Synapse AI Copilot") ||
            rawContent.startsWith("Welcome to the Synapse AI Copilot");
          const isResetCard =
            rawContent.startsWith("Conversation context compacted") ||
            rawContent.startsWith("Konversations-Kontext bereinigt") ||
            rawContent === "Conversation history cleared." ||
            rawContent === "Konversationsverlauf geleert.";

          const displayContent = isWelcomeCard
            ? locale === "de"
              ? "Willkommen im **Synapse Control Center**. Deine interaktive Overlay-Topologie, Muscle-Server, `Rule Cartridges` und der `Brain Vault` sind auf der Hauptfläche abgebildet.\n\nNutze das **Control Center**, um Knoten frei anzuordnen, Sicherheits-Richtlinien zu steuern oder über `+ Server` einen neuen Linux-Host mit einem Befehl anzubinden."
              : "Welcome to **Synapse Control Center**. Your interactive overlay topology, Muscle Peers, `Rule Cartridges`, and `Brain Vault` are mapped on the main canvas.\n\nUse the **Control Center** to drag nodes, toggle policies, or click `+ Server` to enroll a new Linux server with one command."
            : isResetCard
            ? locale === "de"
              ? "Konversations-Kontext bereinigt. Bereit für neue Anweisungen (Prompt-Cache & Vision aktiv)."
              : "Conversation context compacted and cleared. Ready for new instructions (Prompt Cache & Vision active)."
            : rawContent.replace(
                /^Executed `?([a-z0-9_]+)`? through the Synapse Core Interceptor \(`?([^)`]+)`?\)\.$/i,
                locale === "de"
                  ? "✔ Tool `$1` erfolgreich über den Synapse Core Interceptor ausgeführt (`$2`)."
                  : "✔ Tool `$1` executed via Synapse Core Interceptor (`$2`)."
              );

          return (
            <div
              key={idx}
              className={`min-w-0 overflow-hidden break-words rounded-2xl rounded-tl-sm border bg-nb-gray-930/95 p-3.5 text-xs text-nb-gray-100 shadow-sm ${assistantTheme.cardBorder}`}
            >
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-1.5 border-b border-nb-gray-800/70 pb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium whitespace-nowrap ${assistantTheme.badgeClass}`}
                  >
                    {assistantTheme.icon}
                    <span>{assistantTheme.label}</span>
                  </span>
                  {msg.toolResults && msg.toolResults.length > 0 && (
                    <span className="shrink-0 whitespace-nowrap rounded-full border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 font-mono text-[9px] text-nb-gray-300">
                      🛠️ {msg.toolResults.length}{" "}
                      {msg.toolResults.length === 1 ? "Schritt" : "Schritte"}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {msg.thinking && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedThinking((prev) => ({
                          ...prev,
                          [idx]: !prev[idx],
                        }))
                      }
                      className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[9px] transition ${
                        thinkingOpen
                          ? "border-netbird bg-netbird/20 text-white"
                          : "border-nb-gray-800 bg-nb-gray-950 text-nb-gray-400 hover:text-white"
                      }`}
                    >
                      <Brain className="h-2.5 w-2.5 text-netbird" />
                      <span>Reasoning</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(rawContent);
                      setCopiedChatMsgIdx(idx);
                      setTimeout(() => setCopiedChatMsgIdx(null), 1800);
                    }}
                    className="flex items-center gap-1 rounded-md border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[9px] text-nb-gray-400 hover:border-nb-gray-700 hover:text-white transition"
                  >
                    {copiedChatMsgIdx === idx ? (
                      <>
                        <Check className="h-2.5 w-2.5 text-emerald-400" />
                        <span className="text-emerald-400">Kopiert</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-2.5 w-2.5" />
                        <span>Kopieren</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {msg.thinking && thinkingOpen && (
                <div className="mb-3 rounded-xl border border-nb-gray-800 bg-nb-gray-950/90 p-2.5">
                  <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-netbird">
                    <span className="flex items-center gap-1.5">
                      <Brain className="h-3 w-3" />
                      <span>AI Reasoning &amp; Context Trace</span>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedThinking((prev) => ({
                          ...prev,
                          [idx]: false,
                        }))
                      }
                      className="text-nb-gray-400 hover:text-white"
                    >
                      Schließen
                    </button>
                  </div>
                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap border-t border-nb-gray-800 pt-1.5 font-mono text-[10px] text-nb-gray-400">
                    {msg.thinking}
                  </pre>
                </div>
              )}

              <RichMarkdownDocument
                markdown={displayContent}
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

              {idx === 0 && (
                <div className="mt-3 space-y-2 border-t border-nb-gray-800/80 pt-3">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-nb-gray-400">
                    <span>Direktstart: Interaktive DevOps-Skills</span>
                    <span className="text-netbird">1-Klick Auswahl</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChatSkill("CheckSystem");
                        setTimeout(() => chatInputRef.current?.focus(), 50);
                      }}
                      className="group flex flex-col items-start rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5 text-left transition hover:border-emerald-500/60 hover:bg-emerald-950/40"
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-300">
                        <Activity className="h-3.5 w-3.5 text-emerald-400" />
                        <span>System-Check</span>
                      </div>
                      <span className="mt-0.5 text-[10px] text-nb-gray-400 group-hover:text-nb-gray-200">
                        6-Phasen SRE &amp; DB Audit
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChatSkill("CheckOpsec");
                        setTimeout(() => chatInputRef.current?.focus(), 50);
                      }}
                      className="group flex flex-col items-start rounded-xl border border-sky-500/30 bg-sky-950/20 p-2.5 text-left transition hover:border-sky-500/60 hover:bg-sky-950/40"
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-sky-300">
                        <Shield className="h-3.5 w-3.5 text-sky-400" />
                        <span>OpSec-Audit</span>
                      </div>
                      <span className="mt-0.5 text-[10px] text-nb-gray-400 group-hover:text-nb-gray-200">
                        Ports, SSH, Firewall &amp; Keys
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChatSkill("CheckUpdates");
                        setTimeout(() => chatInputRef.current?.focus(), 50);
                      }}
                      className="group flex flex-col items-start rounded-xl border border-sky-500/30 bg-sky-950/20 p-2.5 text-left transition hover:border-sky-500/60 hover:bg-sky-950/40"
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-sky-300">
                        <RefreshCw className="h-3.5 w-3.5 text-sky-400" />
                        <span>Updates prüfen</span>
                      </div>
                      <span className="mt-0.5 text-[10px] text-nb-gray-400 group-hover:text-nb-gray-200">
                        Muscle, Backends &amp; Test
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChatSkill("DeepForensics");
                        setTimeout(() => chatInputRef.current?.focus(), 50);
                      }}
                      className="group flex flex-col items-start rounded-xl border border-amber-500/30 bg-amber-950/20 p-2.5 text-left transition hover:border-amber-500/60 hover:bg-amber-950/40"
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                        <Cpu className="h-3.5 w-3.5 text-amber-400" />
                        <span>Deep-Forensik</span>
                      </div>
                      <span className="mt-0.5 text-[10px] text-nb-gray-400 group-hover:text-nb-gray-200">
                        Logs, Prozesse &amp; Ursachen
                      </span>
                    </button>
                  </div>
                </div>
              )}

              <PostSkillAndInterviewControls
                idx={idx}
                msg={msg}
                chatHistory={chatHistory}
                chatBusy={chatBusy}
                handleUpdateSkillDecision={handleUpdateSkillDecision}
                handleStartSkillInterview={handleStartSkillInterview}
                handleInterviewStepResponse={handleInterviewStepResponse}
              />

              {msg.toolResults && msg.toolResults.length > 0 && (
                <TurnToolExecutionPipeline
                  idx={idx}
                  toolResults={msg.toolResults}
                  activeProject={activeProject}
                  expandedTurnTools={expandedTurnTools}
                  setExpandedTurnTools={setExpandedTurnTools}
                  turnToolCategoryFilter={turnToolCategoryFilter}
                  setTurnToolCategoryFilter={setTurnToolCategoryFilter}
                  expandedTools={expandedTools}
                  setExpandedTools={setExpandedTools}
                  setSelectedServiceId={setSelectedServiceId}
                  setPreviewPort={setPreviewPort}
                  setActiveNav={setActiveNav}
                  setServiceActionMethod={setServiceActionMethod}
                  setServiceActionPath={setServiceActionPath}
                  setServiceActionPayload={setServiceActionPayload}
                  handleInvokeServiceAction={handleInvokeServiceAction}
                  handleRollbackSnapshot={handleRollbackSnapshot}
                />
              )}

              {msg.cacheMetrics && (
                <div className="mt-2 flex items-center justify-between border-t border-nb-gray-800/60 pt-1.5 font-mono text-[10px] text-nb-gray-400">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Zap className="h-2.5 w-2.5" />
                    <span>
                      {msg.cacheMetrics.cached_tokens} cached /{" "}
                      {msg.cacheMetrics.prompt_tokens} prompt tok
                    </span>
                  </span>
                  {msg.cacheMetrics.tool_cache_hits > 0 && (
                    <span className="text-sky-400">
                      {msg.cacheMetrics.tool_cache_hits} FS cache hit(s)
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {chatBusy && (
          <LiveStreamingProgressCard
            liveSteps={liveSteps}
            chatElapsedSec={chatElapsedSec}
            streamingThinkingText={streamingThinkingText}
            streamingReplyText={streamingReplyText}
            setPreviewPort={setPreviewPort}
            setActiveNav={setActiveNav}
            openRemoteFile={openRemoteFile}
            setBrainDocTab={setBrainDocTab}
            setTerminalDrawerOpen={setTerminalDrawerOpen}
            setStatusToast={setStatusToast}
          />
        )}
      </div>

      <CopilotComposer {...props} />
    </aside>
  );
});

export default CopilotDrawer;
