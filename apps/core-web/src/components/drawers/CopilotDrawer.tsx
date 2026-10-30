"use client";

import React from "react";
import { Image as ImageIcon, Sparkles, X, Zap } from "lucide-react";
import {
  ChatAttachment,
  ChatItem,
  NavSection,
  ProjectState,
  PromptCacheMetrics,
} from "@/types/synapse";
import { CopilotComposer } from "./copilot/CopilotComposer";
import { CopilotMessageItem } from "./copilot/CopilotMessageItem";
import { LiveStreamingProgressCard } from "./copilot/CopilotToolAndActionCards";

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
    setPreviewPort,
    setActiveNav,
    openRemoteFile,
    setBrainDocTab,
    setTerminalDrawerOpen,
    setStatusToast,
    chatBusy,
    chatElapsedSec,
    liveSteps,
    streamingThinkingText,
    streamingReplyText,
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
        {chatHistory.map((msg, idx) => (
          <CopilotMessageItem key={idx} msg={msg} idx={idx} {...props} />
        ))}

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
