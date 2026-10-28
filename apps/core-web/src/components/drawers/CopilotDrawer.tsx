"use client";

import React from "react";
import {
  Activity,
  AtSign,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Cpu,
  FileText,
  Image as ImageIcon,
  Paperclip,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
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

export default function CopilotDrawer({
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
  chatComposerRef,
  fileInputRef,
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
  selectedChatSkill,
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
  handleSendPrompt,
  skillMenuOpen,
  setSkillMenuOpen,
  mentionMenuOpen,
  setMentionMenuOpen,
  setMentionFilter,
  mentionCandidates,
  insertMentionToken,
  chatAttachments,
  setChatAttachments,
  chatInput,
  setChatInput,
  handleChatInputChange,
  handleChatPaste,
}: CopilotDrawerProps) {
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
      {/* Mouse-Drag Left Border Handle to Resize Copilot Panel */}
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

      {/* Drag & Drop Vision Overlay */}
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

      {/* Single Clean Header Bar + Optional Conversation Filter Strip */}
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
              title={
                enablePromptCaching
                  ? "Prompt- & Tool-Cache aktiv (Klicken zum Deaktivieren)"
                  : "Prompt- & Tool-Cache deaktiviert (Klicken zum Aktivieren)"
              }
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
              title={
                copilotWide
                  ? "Auf Standardbreite verkleinern"
                  : "Chat-Fenster verbreitern (oder linken Rand ziehen)"
              }
            >
              {copilotWide ? "Kompakt" : "Breiter"}
            </button>
            <button
              onClick={handleClearChat}
              className="inline-flex h-[22px] items-center justify-center rounded-md border border-nb-gray-800 bg-nb-gray-930 px-2 text-[10px] font-medium leading-none text-nb-gray-400 hover:border-nb-gray-700 hover:text-white transition"
              title="Konversation zurücksetzen"
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

        {/* Interactive Filter Bar when conversation has multiple turns */}
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

      {/* Chat Messages + Interactive Bento Cards + Grouped Topic Reports + Categorized Tool Pipeline */}
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

          // 1. STRUCTURED USER MESSAGE RENDERING
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
                        icon: (
                          <RefreshCw className="h-3.5 w-3.5 text-sky-400" />
                        ),
                      }
                    : isSkillForensics
                      ? {
                          badge: "Root-Cause Forensik",
                          title:
                            "DeepForensics (Log- & Prozess-Tiefenanalyse)",
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
                            icon: (
                              <Search className="h-3.5 w-3.5 text-amber-400" />
                            ),
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
                            icon: (
                              <Sparkles className="h-3.5 w-3.5 text-netbird" />
                            ),
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

            // Normal conversational User Bubble
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

          // 2. ASSISTANT MESSAGE CARD
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
                        badgeClass:
                          "border-sky-500/35 bg-sky-950/60 text-sky-300",
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
                          label:
                            idx === 0 ? "Synapse Control Center" : "Synapse AI",
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
              {/* Assistant Card Header Bar */}
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
                      title="KI-Gedankengang (Reasoning Trace) ein-/ausblenden"
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
                    title="Antwort als Markdown kopieren"
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

              {/* Collapsible AI Reasoning / Thinking Trace */}
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

              {/* Rich Grouped & Interactive Document Content */}
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

              {/* Interactive Quick-Launch Skill Bento Grid inside Welcome Card (`idx === 0`) */}
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

              {/* Post-Skill-Report "Interview" Button & Active Interview Step Controls */}
              {msg.role === "assistant" &&
                (() => {
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
                    /beheben oder überspringen|soll ich diesen punkt/i.test(
                      msg.content
                    );
                  const showInterviewControls =
                    isInterviewTurn || asksToFixOrSkip;

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
                              Muscle &amp; Backend Updates: Sollen die Updates
                              durchgeführt &amp; getestet werden?
                            </span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={chatBusy}
                            onClick={() =>
                              handleUpdateSkillDecision(
                                "execute_and_test",
                                msg.content
                              )
                            }
                            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-950/60 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-900/70 hover:text-white disabled:opacity-40 transition"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span>
                              Ja, Updates durchführen &amp; Funktionstest
                              starten
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={chatBusy}
                            onClick={() =>
                              handleUpdateSkillDecision(
                                "test_only",
                                msg.content
                              )
                            }
                            className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-950/50 px-2.5 py-1.5 text-[11px] font-medium text-sky-200 hover:bg-sky-900/60 hover:text-white disabled:opacity-40 transition"
                          >
                            <Activity className="h-3.5 w-3.5 text-sky-400" />
                            <span>Nur Funktionstest ausführen</span>
                          </button>
                          <button
                            type="button"
                            disabled={chatBusy}
                            onClick={() =>
                              handleStartSkillInterview(msg.content)
                            }
                            className="flex items-center gap-1.5 rounded-lg border border-netbird-500/40 bg-netbird/15 px-2.5 py-1.5 text-[11px] font-medium text-netbird hover:bg-netbird/25 hover:text-white disabled:opacity-40 transition"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Einzeln im Interview durchgehen</span>
                          </button>
                          <button
                            type="button"
                            disabled={chatBusy}
                            onClick={() =>
                              handleUpdateSkillDecision("skip", msg.content)
                            }
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
                            <span>
                              DevOps Interview-Modus: Deine Entscheidung
                            </span>
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
                            onClick={() =>
                              handleInterviewStepResponse("fix_all")
                            }
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
                          Tipp: Du kannst auch direkt ins Textfeld schreiben,
                          wenn die KI diesen Punkt auf eine bestimmte Weise
                          anpassen soll.
                        </p>
                      </div>
                    );
                  }

                  if (isSkillReport) {
                    return (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-netbird-500/40 bg-gradient-to-r from-netbird-950/45 via-nb-gray-940 to-nb-gray-940 px-3.5 py-2.5">
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-white">
                            Befunde &amp; Empfehlungen Schritt für Schritt
                            durchgehen?
                          </div>
                          <div className="text-[11px] text-nb-gray-400">
                            Im Interview-Modus stellt dir die KI jeden Punkt
                            einzeln vor und fragt dich, ob sie ihn direkt
                            beheben soll.
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={chatBusy}
                          onClick={() =>
                            handleStartSkillInterview(msg.content)
                          }
                          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-netbird px-3 py-1.5 text-xs font-semibold text-white hover:bg-netbird-500 disabled:opacity-40 transition shadow-sm"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Interview starten</span>
                        </button>
                      </div>
                    );
                  }

                  return null;
                })()}

              {/* Categorized & Interactive Tool Execution Pipeline + Dedicated Registered Service Cards */}
              {msg.toolResults &&
                msg.toolResults.length > 0 &&
                (() => {
                  const registeredTurnServices = msg.toolResults
                    .filter(
                      (tr) =>
                        tr.tool_name === "core_register_service" &&
                        Boolean(
                          (tr.output as Record<string, unknown>)?.registered
                        )
                    )
                    .map(
                      (tr) =>
                        (
                          tr.output as {
                            registered: {
                              service_id: string;
                              name: string;
                              node_id: string;
                              port: number;
                              category?: string;
                              description?: string;
                              endpoints?: Array<{
                                id: string;
                                label: string;
                                method:
                                  | "GET"
                                  | "POST"
                                  | "PUT"
                                  | "DELETE"
                                  | "SQL";
                                path: string;
                                sample_payload?: string;
                              }>;
                            };
                          }
                        ).registered
                    );

                  const turnToolsExpanded = Boolean(expandedTurnTools[idx]);
                  const activeCat = turnToolCategoryFilter[idx] || "all";

                  const categorizeTool = (name: string) => {
                    if (
                      name.includes("pty") ||
                      name.includes("exec") ||
                      name.includes("command")
                    ) {
                      return "shell";
                    }
                    if (name.includes("fs") || name.includes("file")) {
                      return "fs";
                    }
                    if (name.includes("search")) {
                      return "search";
                    }
                    return "core";
                  };

                  const counts = {
                    shell: msg.toolResults.filter(
                      (t) => categorizeTool(t.tool_name) === "shell"
                    ).length,
                    fs: msg.toolResults.filter(
                      (t) => categorizeTool(t.tool_name) === "fs"
                    ).length,
                    search: msg.toolResults.filter(
                      (t) => categorizeTool(t.tool_name) === "search"
                    ).length,
                    core: msg.toolResults.filter(
                      (t) => categorizeTool(t.tool_name) === "core"
                    ).length,
                  };

                  const filteredTools = msg.toolResults
                    .map((tr, origIdx) => ({ tr, origIdx }))
                    .filter(
                      ({ tr }) =>
                        activeCat === "all" ||
                        categorizeTool(tr.tool_name) === activeCat
                    );

                  return (
                    <div className="mt-3 space-y-2 border-t border-nb-gray-800/80 pt-2.5">
                      {/* 1. Dedicated Highlight Boxes for Newly Registered Services */}
                      {registeredTurnServices.length > 0 && (
                        <div className="space-y-2">
                          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-nb-gray-400">
                            Von außen erreichbare Dienste (
                            {registeredTurnServices.length}):
                          </div>
                          {registeredTurnServices.map((reg) => {
                            const liveSvc =
                              (
                                activeProject?.registered_services || []
                              ).find(
                                (s) =>
                                  s.service_id === reg.service_id ||
                                  s.port === reg.port
                              ) || reg;
                            const eps =
                              liveSvc.endpoints || reg.endpoints || [];
                            const cat = liveSvc.category || "backend";
                            const catBadge =
                              cat === "webui"
                                ? "🌐 WebUI"
                                : cat === "database"
                                  ? "🗄️ DB"
                                  : "⚡ API";

                            return (
                              <div
                                key={reg.service_id}
                                className="rounded-xl border border-netbird-500/40 bg-nb-gray-940 p-2.5 font-sans text-xs space-y-2"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[10px] text-netbird shrink-0">
                                      {catBadge}
                                    </span>
                                    <span className="truncate font-semibold text-white">
                                      {liveSvc.name || reg.service_id}
                                    </span>
                                    <span className="font-mono text-[10px] text-nb-gray-400 shrink-0">
                                      :{reg.port}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedServiceId(reg.service_id);
                                      setPreviewPort(reg.port);
                                      setActiveNav("reverse-proxy");
                                    }}
                                    className="shrink-0 rounded bg-netbird px-2 py-0.5 text-[10px] font-medium text-white hover:bg-netbird-500"
                                  >
                                    Öffnen →
                                  </button>
                                </div>

                                {eps.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {eps.map((ep) => (
                                      <button
                                        key={ep.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedServiceId(reg.service_id);
                                          setPreviewPort(reg.port);
                                          setServiceActionMethod(ep.method);
                                          setServiceActionPath(ep.path);
                                          setServiceActionPayload(
                                            ep.sample_payload || ""
                                          );
                                          setActiveNav("reverse-proxy");
                                          handleInvokeServiceAction({
                                            nodeId: reg.node_id,
                                            port: reg.port,
                                            method: ep.method,
                                            path: ep.path,
                                            payload: ep.sample_payload || "",
                                          });
                                        }}
                                        className="rounded border border-nb-gray-800 bg-nb-gray-920 px-2 py-0.5 font-mono text-[10px] text-nb-gray-200 hover:border-netbird hover:text-white"
                                      >
                                        <strong className="text-netbird">
                                          {ep.method}
                                        </strong>{" "}
                                        {ep.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 2. Interactive Categorized Tool Pipeline Bar */}
                      <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-950/90 p-2 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex flex-wrap items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setTurnToolCategoryFilter((prev) => ({
                                  ...prev,
                                  [idx]: "all",
                                }));
                                setExpandedTurnTools((prev) => ({
                                  ...prev,
                                  [idx]: !prev[idx],
                                }));
                              }}
                              className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-medium transition ${
                                turnToolsExpanded && activeCat === "all"
                                  ? "bg-netbird text-white"
                                  : "bg-nb-gray-900 text-nb-gray-300 hover:text-white"
                              }`}
                            >
                              🛠️ Alle ({msg.toolResults.length})
                            </button>
                            {counts.search > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTurnToolCategoryFilter((prev) => ({
                                    ...prev,
                                    [idx]: "search",
                                  }));
                                  setExpandedTurnTools((prev) => ({
                                    ...prev,
                                    [idx]: true,
                                  }));
                                }}
                                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${
                                  turnToolsExpanded && activeCat === "search"
                                    ? "border-amber-500/50 bg-amber-950/70 text-amber-200"
                                    : "border-nb-gray-800 bg-nb-gray-930 text-amber-300/90 hover:border-amber-500/40"
                                }`}
                              >
                                🔍 Deep-Search ({counts.search})
                              </button>
                            )}
                            {counts.shell > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTurnToolCategoryFilter((prev) => ({
                                    ...prev,
                                    [idx]: "shell",
                                  }));
                                  setExpandedTurnTools((prev) => ({
                                    ...prev,
                                    [idx]: true,
                                  }));
                                }}
                                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${
                                  turnToolsExpanded && activeCat === "shell"
                                    ? "border-emerald-500/50 bg-emerald-950/70 text-emerald-200"
                                    : "border-nb-gray-800 bg-nb-gray-930 text-emerald-300/90 hover:border-emerald-500/40"
                                }`}
                              >
                                🐚 Terminal ({counts.shell})
                              </button>
                            )}
                            {counts.fs > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTurnToolCategoryFilter((prev) => ({
                                    ...prev,
                                    [idx]: "fs",
                                  }));
                                  setExpandedTurnTools((prev) => ({
                                    ...prev,
                                    [idx]: true,
                                  }));
                                }}
                                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${
                                  turnToolsExpanded && activeCat === "fs"
                                    ? "border-sky-500/50 bg-sky-950/70 text-sky-200"
                                    : "border-nb-gray-800 bg-nb-gray-930 text-sky-300/90 hover:border-sky-500/40"
                                }`}
                              >
                                📁 Dateien ({counts.fs})
                              </button>
                            )}
                            {counts.core > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setTurnToolCategoryFilter((prev) => ({
                                    ...prev,
                                    [idx]: "core",
                                  }));
                                  setExpandedTurnTools((prev) => ({
                                    ...prev,
                                    [idx]: true,
                                  }));
                                }}
                                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${
                                  turnToolsExpanded && activeCat === "core"
                                    ? "border-netbird-500/50 bg-netbird-950/70 text-netbird"
                                    : "border-nb-gray-800 bg-nb-gray-930 text-netbird/90 hover:border-netbird-500/40"
                                }`}
                              >
                                🧠 Core ({counts.core})
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedTurnTools((prev) => ({
                                ...prev,
                                [idx]: !prev[idx],
                              }))
                            }
                            className="font-mono text-[10px] text-netbird hover:underline"
                          >
                            {turnToolsExpanded
                              ? "Einklappen ▲"
                              : "Schritte öffnen ▼"}
                          </button>
                        </div>

                        {turnToolsExpanded && (
                          <div className="space-y-1.5 border-t border-nb-gray-800/70 pt-2">
                            {filteredTools.map(({ tr, origIdx }) => {
                              const key = `${idx}-${origIdx}`;
                              const open = expandedTools[key];
                              const cat = categorizeTool(tr.tool_name);
                              const catColor =
                                cat === "search"
                                  ? "text-amber-300"
                                  : cat === "shell"
                                    ? "text-emerald-300"
                                    : cat === "fs"
                                      ? "text-sky-300"
                                      : "text-netbird";

                              return (
                                <div
                                  key={key}
                                  className="rounded-lg border border-nb-gray-800/90 bg-nb-gray-940/90 px-2.5 py-1.5 font-mono text-[11px] transition hover:border-nb-gray-700"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedTools((prev) => ({
                                          ...prev,
                                          [key]: !prev[key],
                                        }))
                                      }
                                      className="flex flex-1 items-center justify-between text-left min-w-0"
                                    >
                                      <span className="flex items-center gap-1.5 min-w-0">
                                        <span className="rounded bg-nb-gray-900 px-1.5 py-0.2 text-[9px] text-nb-gray-400">
                                          #{origIdx + 1}
                                        </span>
                                        <span
                                          className={`truncate font-semibold ${catColor}`}
                                        >
                                          {tr.tool_name}
                                        </span>
                                        {tr.cached && (
                                          <span className="rounded bg-emerald-950 px-1.5 py-0.2 text-[9px] text-emerald-300 border border-emerald-500/30">
                                            CACHED
                                          </span>
                                        )}
                                      </span>
                                      <span className="text-[10px] uppercase text-emerald-400 shrink-0 ml-2">
                                        {tr.status} {open ? "▲" : "▼"}
                                      </span>
                                    </button>

                                    {tr.rollback_snapshot_id && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRollbackSnapshot(
                                            tr.rollback_snapshot_id!,
                                            tr.rollback_path
                                          )
                                        }
                                        title={`Rollback ${
                                          tr.rollback_path || "file"
                                        } to pre-write snapshot`}
                                        className="flex items-center gap-1 rounded border border-amber-500/40 bg-amber-950/50 px-1.5 py-0.5 text-[9px] text-amber-300 hover:bg-amber-900/60 hover:text-white"
                                      >
                                        <RotateCcw className="h-2.5 w-2.5" />
                                        <span>Rollback</span>
                                      </button>
                                    )}
                                  </div>
                                  {open && (
                                    <pre className="mt-1.5 max-h-44 overflow-auto rounded border border-nb-gray-800 bg-nb-gray-960 p-2 text-[10px] text-nb-gray-300">
                                      {JSON.stringify(tr.output, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

              {/* Per-Turn Cache Savings Footer */}
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

        {/* Live SSE ReAct Steps + Progressive Thinking & Token Stream */}
        {chatBusy && (
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
        )}
      </div>

      {/* Multimodal Prompt Input Box with Selected Skill Card, Thumbnail Strip, @-Mentions & Drag-and-Drop */}
      <form
        ref={chatComposerRef}
        onSubmit={handleSendPrompt}
        className="relative border-t border-nb-gray-900 bg-nb-gray-950 p-3 space-y-2"
      >
        {/* Selected Skill Card */}
        {selectedChatSkill && (
          <div
            className={`flex items-start justify-between gap-2.5 rounded-lg border p-2.5 text-xs ${
              selectedChatSkill === "CheckSystem"
                ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-100"
                : selectedChatSkill === "CheckOpsec"
                  ? "border-sky-500/40 bg-sky-950/30 text-sky-100"
                  : selectedChatSkill === "CheckUpdates"
                    ? "border-sky-500/40 bg-sky-950/30 text-sky-100"
                    : "border-amber-500/40 bg-amber-950/30 text-amber-100"
            }`}
          >
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5 font-semibold text-white">
                {selectedChatSkill === "CheckSystem" ? (
                  <Activity className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : selectedChatSkill === "CheckOpsec" ? (
                  <Shield className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                ) : selectedChatSkill === "CheckUpdates" ? (
                  <RefreshCw className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                ) : selectedChatSkill === "DeepForensics" ? (
                  <Cpu className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                ) : (
                  <Search className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                )}
                <span>Skill ausgewählt: {selectedChatSkill}</span>
              </div>
              <p className="text-[11px] text-nb-gray-300 leading-snug">
                {selectedChatSkill === "CheckSystem"
                  ? "Mehrstufiger Senior-DevOps-Tiefenscan: Prüft Host, Ports, Quellcode, SQLite-Integrität, Logs & Brain-Sync mit erweiterten Suchfunktionen."
                  : selectedChatSkill === "CheckOpsec"
                    ? "Mehrstufiger DevSecOps-Tiefenaudit: Prüft offene Sockets, SSH, Firewall, Sysctl, Dateirechte, Code-Schwachstellen, Secrets & HTTP-Header."
                    : selectedChatSkill === "CheckUpdates"
                      ? "Muscle & Backend Update-Prüfung: Prüft Axon-Daemons, Workspace-Backends, Runtimes & OS-Pakete auf Updates und fragt danach nach Ausführung + Funktionstest."
                      : selectedChatSkill === "DeepForensics"
                        ? "Tiefgreifende DevOps-Forensik: Durchsucht alle Logs, Prozesse, Datenbanken und Quellcode-Dateien nach versteckten Fehlern & Root-Causes."
                        : "Erweiterte System-, Code-, Datenbank-, Log- & UI-Tiefensuche: Findet jede Funktion, Einstellung, Datei oder Zeile im gesamten System."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedChatSkill(null)}
              className="rounded p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white shrink-0"
              title="Skill abwählen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* AI Skills Selector Popover */}
        {skillMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-930 p-2 shadow-2xl z-30 space-y-1">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-nb-gray-400">
                Senior DevOps AI Skills &amp; Deep-Search
              </span>
              <button
                type="button"
                onClick={() => setSkillMenuOpen(false)}
                className="rounded p-0.5 text-nb-gray-400 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedChatSkill("CheckUpdates");
                setSkillMenuOpen(false);
                setTimeout(() => chatInputRef.current?.focus(), 50);
              }}
              className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-nb-gray-900 transition"
            >
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold text-xs text-sky-300">
                  <span>CheckUpdates</span>
                  <span className="rounded border border-sky-500/30 bg-sky-950/40 px-1.5 py-0.2 font-mono text-[9px] text-sky-300">
                    Muscle &amp; Backend Updates + Test
                  </span>
                </div>
                <p className="text-[11px] text-nb-gray-400 leading-snug">
                  Prüft alle Muscle-Server, Axon-Binaries, Runtimes, OS-Pakete
                  &amp; Backends auf Updates, fragt nach Freigabe und führt
                  danach einen Funktionstest durch.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedChatSkill("CheckSystem");
                setSkillMenuOpen(false);
                setTimeout(() => chatInputRef.current?.focus(), 50);
              }}
              className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-nb-gray-900 transition"
            >
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold text-xs text-emerald-300">
                  <span>CheckSystem</span>
                  <span className="rounded border border-emerald-500/30 bg-emerald-950/40 px-1.5 py-0.2 font-mono text-[9px] text-emerald-300">
                    6-Phasen SRE Audit
                  </span>
                </div>
                <p className="text-[11px] text-nb-gray-400 leading-snug">
                  Tiefenscan wie durch einen Senior DevOps Engineer: Host,
                  Ports, Quellcode-Grep, SQLite-Integrität, Logs &amp;
                  Brain-Drift.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedChatSkill("CheckOpsec");
                setSkillMenuOpen(false);
                setTimeout(() => chatInputRef.current?.focus(), 50);
              }}
              className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-nb-gray-900 transition"
            >
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold text-xs text-sky-300">
                  <span>CheckOpsec</span>
                  <span className="rounded border border-sky-500/30 bg-sky-950/40 px-1.5 py-0.2 font-mono text-[9px] text-sky-300">
                    DevSecOps Forensik
                  </span>
                </div>
                <p className="text-[11px] text-nb-gray-400 leading-snug">
                  Mehrstufiger Security-Audit: Socket-Bindings, SSH, Firewall,
                  Sysctl, Dateirechte, Secret-Leak-Scan &amp; HTTP-Header.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedChatSkill("DeepForensics");
                setSkillMenuOpen(false);
                setTimeout(() => chatInputRef.current?.focus(), 50);
              }}
              className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-nb-gray-900 transition"
            >
              <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold text-xs text-amber-300">
                  <span>DeepForensics</span>
                  <span className="rounded border border-amber-500/30 bg-amber-950/40 px-1.5 py-0.2 font-mono text-[9px] text-amber-300">
                    Root-Cause &amp; Logs
                  </span>
                </div>
                <p className="text-[11px] text-nb-gray-400 leading-snug">
                  Durchsucht sämtliche Logs, Journalctl, Prozesse, Datenbanken
                  &amp; Code-Dateien nach Fehlern, Engpässen &amp; Ursachen.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedChatSkill("SkillSearch");
                setSkillMenuOpen(false);
                setTimeout(() => chatInputRef.current?.focus(), 50);
              }}
              className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-nb-gray-900 transition"
            >
              <Search className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold text-xs text-amber-300">
                  <span>SkillSearch</span>
                  <span className="rounded border border-amber-500/30 bg-amber-950/40 px-1.5 py-0.2 font-mono text-[9px] text-amber-300">
                    Code-, System- &amp; UI-Suche
                  </span>
                </div>
                <p className="text-[11px] text-nb-gray-400 leading-snug">
                  Durchsucht UI-Sitemap, Server-Dateien, Code-Zeilen, Ports, DBs
                  &amp; Brain Vault nach jeder gesuchten Funktion.
                </p>
              </div>
            </button>
          </div>
        )}

        {/* @-Context Mention Autocomplete Popover */}
        {mentionMenuOpen && mentionCandidates.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1.5 max-h-52 overflow-y-auto rounded-lg border border-nb-gray-800 bg-nb-gray-930 p-1.5 shadow-2xl z-30">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-nb-gray-400">
                Insert @Context Mention
              </span>
              <button
                type="button"
                onClick={() => {
                  setMentionMenuOpen(false);
                  setMentionFilter("");
                  setChatInput((prev) => prev.replace(/(?:^|\s)@$/, ""));
                }}
                className="rounded p-0.5 text-nb-gray-400 hover:text-white"
                title="Schließen"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {mentionCandidates.map((cand) => (
              <button
                key={cand.token}
                type="button"
                onClick={() => insertMentionToken(cand.token)}
                className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white"
              >
                <div>
                  <span className="font-mono font-semibold text-netbird">
                    {cand.token}
                  </span>
                  <span className="ml-2 text-[11px] text-nb-gray-400">
                    {cand.label}
                  </span>
                </div>
                <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[9px] text-nb-gray-400">
                  {cand.category}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Pending Drag & Drop / Pasted Image Attachment Thumbnails */}
        {chatAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-1">
            {chatAttachments.map((att) => (
              <div
                key={att.id}
                className="relative flex items-center gap-2 rounded-md border border-netbird-500/40 bg-nb-gray-930 p-1.5 pr-6 text-[11px] text-nb-gray-200"
              >
                {att.mime_type?.startsWith("image/") ? (
                  <img
                    src={att.data_url}
                    alt={att.name}
                    className="h-9 w-9 rounded object-cover"
                  />
                ) : (
                  <FileText className="h-5 w-5 text-netbird" />
                )}
                <div className="max-w-[110px] truncate font-mono text-[10px]">
                  {att.name}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setChatAttachments((prev) =>
                      prev.filter((x) => x.id !== att.id)
                    )
                  }
                  className="absolute right-1 top-1 rounded bg-nb-gray-900 p-0.5 text-nb-gray-400 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.log,.txt,.json,.md,.yml,.yaml"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              processDroppedOrSelectedFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />

        <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-920 p-2 focus-within:border-netbird transition">
          <textarea
            ref={chatInputRef}
            rows={2}
            value={chatInput}
            onClick={() => {
              setSkillMenuOpen(false);
              if (!/(?:^|\s)@([a-zA-Z0-9._:-]*)$/.test(chatInput)) {
                setMentionMenuOpen(false);
              }
            }}
            onChange={(e) => handleChatInputChange(e.target.value)}
            onPaste={handleChatPaste}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendPrompt();
              }
            }}
            placeholder={
              selectedChatSkill === "SkillSearch"
                ? "Wonach suchst du? (z.B. Firewall, SQL, Ports)..."
                : selectedChatSkill
                  ? `Optionaler Fokus für ${selectedChatSkill}...`
                  : "Frage Synapse AI (@ Kontext, Bilder)..."
            }
            className="w-full resize-none bg-transparent px-1.5 py-1 text-xs leading-relaxed text-white placeholder:text-nb-gray-400 focus:outline-none"
          />

          <div className="mt-1.5 flex items-center justify-between border-t border-nb-gray-800/80 pt-1.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach image, screenshot, diagram, or log file (or Drag & Drop / Ctrl+V)"
                className="flex h-7 items-center gap-1 rounded-md border border-nb-gray-800 bg-nb-gray-940 px-2 text-[11px] text-nb-gray-300 hover:border-netbird hover:text-white transition"
              >
                <Paperclip className="h-3 w-3" />
                <span>Anhang</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (mentionMenuOpen) {
                    setMentionMenuOpen(false);
                    setMentionFilter("");
                    setChatInput((prev) => prev.replace(/(?:^|\s)@$/, ""));
                  } else {
                    setSkillMenuOpen(false);
                    setMentionFilter("");
                    setMentionMenuOpen(true);
                  }
                }}
                title="Mention a Peer, Service, or Brain Vault Doc (@)"
                className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] transition ${
                  mentionMenuOpen
                    ? "border-netbird bg-netbird/15 text-netbird"
                    : "border-nb-gray-800 bg-nb-gray-940 text-nb-gray-300 hover:border-netbird hover:text-white"
                }`}
              >
                <AtSign className="h-3 w-3" />
                <span>Kontext</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMentionMenuOpen(false);
                  setMentionFilter("");
                  setChatInput((prev) => prev.replace(/(?:^|\s)@$/, ""));
                  setSkillMenuOpen((v) => !v);
                }}
                title="AI Skills auswählen (CheckSystem, CheckOpsec, SkillSearch)"
                className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition ${
                  skillMenuOpen || selectedChatSkill
                    ? "border-netbird bg-netbird/15 text-netbird"
                    : "border-nb-gray-800 bg-nb-gray-940 text-nb-gray-300 hover:border-netbird hover:text-white"
                }`}
              >
                <Sparkles className="h-3 w-3 shrink-0" />
                <span>Skills</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={chatBusy}
              className="flex h-7 items-center gap-1.5 rounded-md bg-netbird px-3 text-[11px] font-semibold text-white hover:bg-netbird-500 disabled:opacity-40 transition shadow-sm"
            >
              <Send className="h-3 w-3" />
              <span>Senden</span>
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}
