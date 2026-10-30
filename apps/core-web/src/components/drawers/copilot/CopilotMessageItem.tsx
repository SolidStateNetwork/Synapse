"use client";

import React from "react";
import {
  Activity,
  Brain,
  Check,
  Copy,
  Cpu,
  RefreshCw,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import RichMarkdownDocument from "@/components/RichMarkdownDocument";
import { ChatItem, NavSection, ProjectState } from "@/types/synapse";
import type { SelectedChatSkillType } from "../CopilotDrawer";
import {
  PostSkillAndInterviewControls,
  TurnToolExecutionPipeline,
} from "./CopilotToolAndActionCards";
import { CopilotUserMessageCard } from "./CopilotUserMessageCard";

export interface CopilotMessageItemProps {
  msg: ChatItem;
  idx: number;
  locale: string;
  activeProject: ProjectState | null;
  primaryNode: string;
  chatHistory: ChatItem[];
  chatMessageFilter: "all" | "reports" | "user";
  chatInputRef: React.RefObject<HTMLTextAreaElement | null>;
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
  chatBusy: boolean;
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
}

export function CopilotMessageItem({
  msg,
  idx,
  locale,
  activeProject,
  primaryNode,
  chatHistory,
  chatMessageFilter,
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
  handleUpdateSkillDecision,
  handleStartSkillInterview,
  handleInterviewStepResponse,
  setSelectedServiceId,
  setServiceActionMethod,
  setServiceActionPath,
  setServiceActionPayload,
  handleInvokeServiceAction,
  handleRollbackSnapshot,
}: CopilotMessageItemProps) {
  if (chatMessageFilter === "reports" && msg.role !== "assistant") {
    return null;
  }
  if (chatMessageFilter === "user" && msg.role !== "user") {
    return null;
  }

  const thinkingOpen = expandedThinking[idx];
  const rawContent = msg.content || "";

  if (msg.role === "user") {
    return (
      <CopilotUserMessageCard
        msg={msg}
        idx={idx}
        primaryNode={primaryNode}
        expandedRawPrompts={expandedRawPrompts}
        setExpandedRawPrompts={setExpandedRawPrompts}
        setPreviewPort={setPreviewPort}
        setActiveNav={setActiveNav}
        openRemoteFile={openRemoteFile}
        setBrainDocTab={setBrainDocTab}
        setTerminalDrawerOpen={setTerminalDrawerOpen}
        setStatusToast={setStatusToast}
      />
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
      (prevMsg.content || "").includes("Proactive Auto-Watchdog Triggered")
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
      <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/30 via-nb-gray-940 to-nb-gray-940 px-3 py-2 text-xs text-nb-gray-200 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-950/70 px-2 py-0.5 font-mono text-[9px] font-semibold text-amber-300 shrink-0">
              🛡️ Auto-Watchdog ({bundleCount}x)
            </span>
            <span className="truncate text-[11px] font-medium text-white">
              Selbstheilung für Microservice ausgeführt
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
          badgeClass: "border-netbird-500/40 bg-netbird-950/60 text-netbird",
          cardBorder: "border-netbird-500/30",
          icon: <Sparkles className="h-3 w-3 text-netbird" />,
        }
      : {
          label: idx === 0 ? "Synapse Control Center" : "Synapse AI",
          badgeClass: "border-nb-gray-700 bg-nb-gray-900 text-nb-gray-200",
          cardBorder: "border-nb-gray-800/90",
          icon: <Sparkles className="h-3 w-3 text-netbird" />,
        };

  const isWelcomeCard =
    rawContent.startsWith("Welcome to **Synapse Control Center**") ||
    rawContent.startsWith("Willkommen im **Synapse Control Center**") ||
    rawContent.startsWith("Willkommen im Synapse AI Copilot") ||
    rawContent.startsWith("Welcome to the Synapse AI Copilot");
  const isResetCard =
    rawContent.startsWith("Conversation context compacted") ||
    rawContent.startsWith("Konversations-Kontext bereinigt") ||
    rawContent === "Conversation history cleared." ||
    rawContent === "Konversationsverlauf geleert.";

  const activeProjId = activeProject?.project_id || "default-project";
  const displayContent = isWelcomeCard
    ? locale === "de"
      ? "Willkommen im **Synapse Control Center**. Deine interaktive Overlay-Topologie, Muscle-Server, `Rule Cartridges` und der `Brain Vault` sind auf der Hauptfläche abgebildet.\n\nNutze das **Control Center**, um Knoten frei anzuordnen, Sicherheits-Richtlinien zu steuern oder über `+ Server` einen neuen Linux-Host mit einem Befehl anzubinden."
      : "Welcome to **Synapse Control Center**. Your interactive overlay topology, Muscle Peers, `Rule Cartridges`, and `Brain Vault` are mapped on the main canvas.\n\nUse the **Control Center** to drag nodes, toggle policies, or click `+ Server` to enroll a new Linux server with one command."
    : isResetCard
    ? locale === "de"
      ? "Konversations-Kontext bereinigt. Bereit für neue Anweisungen (Prompt-Cache & Vision aktiv)."
      : "Conversation context compacted and cleared. Ready for new instructions (Prompt Cache & Vision active)."
    : rawContent.includes("Active Execution Mode")
    ? locale === "de"
      ? `- **Aktiver Ausführungs-Modus** für Projekt \`${activeProjId}\`.\n- Tippe \`deploy microservice 4050\`, um eine **4-stufige autonome Ausführungsschleife** mit Pre-Write Rollback-Snapshots zu starten.\n- Ziehe **Screenshots/Diagramme** in den Chat oder tippe \`@\`, um Server, Dienste und Brain-Vault-Dokumente zu referenzieren.\n- Stelle jedem Befehl \`$ <command>\` voran (z.B. \`$ uname -a && pwd\`), um direkt \`node_pty_exec\` auszuführen.`
      : `- **Active Execution Mode** on project \`${activeProjId}\`.\n- Type \`deploy microservice 4050\` to trigger a **4-step autonomous execution loop** with Pre-Write Rollback Snapshots.\n- Drop **screenshots/diagrams** into the chat or type \`@\` to mention nodes, services, and Brain Vault docs.\n- Prefix any command with \`$ <command>\` (e.g. \`$ uname -a && pwd\`) to invoke \`node_pty_exec\`.`
    : rawContent.replace(
        /^Executed `?([a-z0-9_]+)`? through the Synapse Core Interceptor \(`?([^)`]+)`?\)\.$/i,
        locale === "de"
          ? "✔ Tool `$1` erfolgreich über den Synapse Core Interceptor ausgeführt (`$2`)."
          : "✔ Tool `$1` executed via Synapse Core Interceptor (`$2`)."
      );

  return (
    <div
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
}
