"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChatAttachment,
  ChatItem,
  GatewayNode,
  ProjectState,
  PromptCacheMetrics,
} from "@/types/synapse";
import {
  buildCheckOpsecPrompt,
  buildCheckSystemPrompt,
  buildCheckUpdatesPrompt,
  buildDeepForensicsPrompt,
  buildSkillSearchPrompt,
  detectInputLang,
} from "@/lib/copilot/skillPrompts";
import { SystemUpdateStatusData } from "./useSystemAndInfraActions";
import { useCopilotEndpointsAndSkills } from "./useCopilotEndpointsAndSkills";
import { safeFetchJson } from "@/lib/safeFetch";

export function useCopilotChatController({
  locale,
  isDe,
  activeProject,
  gatewayNodes,
  primaryNode,
  remoteDir,
  activeFilePath,
  fetchRemoteDir,
  openRemoteFile,
  loadWorkspace,
  showToast,
  setCopilotDrawerOpen,
  setAiEndpointModalOpen,
  setSystemUpdateStatus,
  setSystemUpdateSteps,
  provider,
  baseUrl,
  modelName,
  setModelName,
  apiKeyInput,
  setApiKeyInput,
  apiKeySecretName,
  enablePromptCaching,
  enableAutoWatchdog,
  chatHistory,
  setChatHistory,
}: {
  locale: string;
  isDe: boolean;
  activeProject: ProjectState | null;
  gatewayNodes: GatewayNode[];
  primaryNode: string;
  remoteDir: string;
  activeFilePath: string;
  fetchRemoteDir: (
    dirPath: string,
    autoSelectFirstFile?: boolean
  ) => Promise<void>;
  openRemoteFile: (filePath: string) => Promise<void>;
  loadWorkspace: (
    projectId?: string,
    syncAiSettings?: boolean
  ) => Promise<void>;
  showToast: (msg: string, durationMs?: number) => void;
  setCopilotDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAiEndpointModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSystemUpdateStatus: React.Dispatch<
    React.SetStateAction<SystemUpdateStatusData | null>
  >;
  setSystemUpdateSteps: React.Dispatch<
    React.SetStateAction<
      Array<{
        step: string;
        status: "ok" | "warn" | "error";
        detail: string;
        duration_ms: number;
      }>
    >
  >;
  provider: string;
  baseUrl: string;
  modelName: string;
  setModelName: React.Dispatch<React.SetStateAction<string>>;
  apiKeyInput: string;
  setApiKeyInput: React.Dispatch<React.SetStateAction<string>>;
  apiKeySecretName: string;
  enablePromptCaching: boolean;
  enableAutoWatchdog: boolean;
  chatHistory: ChatItem[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatItem[]>>;
}) {
  const [chatInput, setChatInput] = useState("");
  const [chatAttachments, setChatAttachments] = useState<ChatAttachment[]>([]);
  const [isDraggingOverChat, setIsDraggingOverChat] = useState(false);
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [streamingReplyText, setStreamingReplyText] = useState("");
  const [streamingThinkingText, setStreamingThinkingText] = useState("");
  const [latestCacheMetrics, setLatestCacheMetrics] =
    useState<PromptCacheMetrics | null>(null);
  const [expandedThinking, setExpandedThinking] = useState<
    Record<number, boolean>
  >({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatComposerRef = useRef<HTMLFormElement | null>(null);
  const [selectedChatSkill, setSelectedChatSkill] = useState<
    | "CheckSystem"
    | "CheckOpsec"
    | "SkillSearch"
    | "DeepForensics"
    | "CheckUpdates"
    | null
  >(null);
  const [skillMenuOpen, setSkillMenuOpen] = useState<boolean>(false);
  const [chatMessageFilter, setChatMessageFilter] = useState<
    "all" | "reports" | "user"
  >("all");
  const [expandedRawPrompts, setExpandedRawPrompts] = useState<
    Record<number, boolean>
  >({});
  const [copiedChatMsgIdx, setCopiedChatMsgIdx] = useState<number | null>(null);
  const [turnToolCategoryFilter, setTurnToolCategoryFilter] = useState<
    Record<number, string>
  >({});
  const [chatBusy, setChatBusy] = useState(false);
  const [chatElapsedSec, setChatElapsedSec] = useState(0);
  const [systemScanBusy, setSystemScanBusy] = useState<boolean>(false);
  const [opsecScanBusy, setOpsecScanBusy] = useState<boolean>(false);
  const [expandedTurnTools, setExpandedTurnTools] = useState<
    Record<number, boolean>
  >({});
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>(
    {}
  );
  const [liveSteps, setLiveSteps] = useState<
    Array<{
      step: number;
      tool_name: string;
      detail?: string;
      cached?: boolean;
      status:
        | "running"
        | "executed"
        | "blocked"
        | "requires_approval"
        | "error";
    }>
  >([]);

  useEffect(() => {
    if (!chatBusy) {
      setChatElapsedSec(0);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      setChatElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [chatBusy]);

  async function processDroppedOrSelectedFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const added: ChatAttachment[] = [];
    for (const file of list.slice(0, 6)) {
      if (file.size > 8 * 1024 * 1024) {
        showToast(
          isDe
            ? `Übersprungen: ${file.name} (>8MB Limit)`
            : `Skipped ${file.name} (>8MB limit)`
        );
        continue;
      }
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => resolve("");
        reader.readAsDataURL(file);
      });
      if (dataUrl) {
        added.push({
          id: `att-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
          name: file.name || "screenshot.png",
          mime_type: file.type || "image/png",
          data_url: dataUrl,
          size_bytes: file.size,
        });
      }
    }
    if (added.length > 0) {
      setChatAttachments((prev) => [...prev, ...added].slice(0, 6));
    }
  }

  function handleChatPaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      processDroppedOrSelectedFiles(files);
    }
  }

  const mentionCandidates = useMemo(() => {
    const items: Array<{ token: string; label: string; category: string }> = [
      {
        token: "@Architecture.md",
        label: "Project Architecture & Mermaid Specs",
        category: "Vault",
      },
      {
        token: "@Memory.md",
        label: "Engineering Journal & Past Fixes",
        category: "Vault",
      },
    ];
    for (const n of gatewayNodes) {
      items.push({
        token: `@${n.node_id}`,
        label: `Muscle Peer (${n.tier})`,
        category: "Peer",
      });
    }
    for (const svc of activeProject?.registered_services || []) {
      items.push({
        token: `@service:${svc.port}`,
        label: `${svc.name} (127.0.0.1:${svc.port})`,
        category: "Service",
      });
    }
    return items.filter(
      (i) =>
        !mentionFilter ||
        i.token.toLowerCase().includes(mentionFilter.toLowerCase()) ||
        i.label.toLowerCase().includes(mentionFilter.toLowerCase())
    );
  }, [gatewayNodes, activeProject?.registered_services, mentionFilter]);

  function handleChatInputChange(val: string) {
    setChatInput(val);
    const atMatch = val.match(/(?:^|\s)@([a-zA-Z0-9._:-]*)$/);
    if (atMatch) {
      setMentionFilter(atMatch[1] || "");
      setSkillMenuOpen(false);
      setMentionMenuOpen(true);
    } else {
      setMentionMenuOpen(false);
    }
  }

  function insertMentionToken(token: string) {
    if (/(?:^|\s)@([a-zA-Z0-9._:-]*)$/.test(chatInput)) {
      const replaced = chatInput.replace(
        /(?:^|\s)@([a-zA-Z0-9._:-]*)$/,
        (m) => (m.startsWith(" ") ? ` ${token} ` : `${token} `)
      );
      setChatInput(replaced);
    } else {
      const prefix =
        chatInput && !chatInput.endsWith(" ") ? `${chatInput} ` : chatInput;
      setChatInput(`${prefix}${token} `);
    }
    setMentionMenuOpen(false);
    setMentionFilter("");
    setTimeout(() => chatInputRef.current?.focus(), 30);
  }

  async function runStreamingPrompt(
    promptText: string,
    overrideProvider?: string,
    attachmentsToSend?: ChatAttachment[],
    displayUserMessage?: string
  ) {
    if (
      !activeProject ||
      (!promptText.trim() &&
        (!attachmentsToSend || attachmentsToSend.length === 0))
    )
      return;
    const userMsg: ChatItem = {
      role: "user",
      content:
        displayUserMessage ||
        promptText.trim() ||
        `Attached ${attachmentsToSend?.length || 1} visual file(s)`,
      attachments:
        attachmentsToSend && attachmentsToSend.length > 0
          ? attachmentsToSend
          : undefined,
    };
    const nextHistory = [...chatHistory, userMsg];
    setChatHistory(nextHistory);
    setChatBusy(true);
    setLiveSteps([]);
    setStreamingReplyText("");
    setStreamingThinkingText("");

    const messagesForAi = [
      ...chatHistory.map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
      })),
      {
        role: "user" as const,
        content:
          promptText.trim() ||
          `Attached ${attachmentsToSend?.length || 1} visual file(s)`,
        attachments: userMsg.attachments,
      },
    ];

    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: activeProject.project_id,
          provider: overrideProvider || provider,
          base_url: baseUrl,
          model: modelName,
          api_key: apiKeyInput,
          stream: true,
          display_user_message: displayUserMessage,
          messages: messagesForAi,
        }),
      });

      if (!res.body) {
        throw new Error("ReadableStream not available");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() || "";

        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          try {
            const evt = JSON.parse(line.replace(/^data:\s*/, ""));
            if (evt.type === "step_start") {
              setLiveSteps((prev) => [
                ...prev,
                {
                  step: evt.step,
                  tool_name: evt.tool_name,
                  detail: evt.detail ? String(evt.detail) : undefined,
                  status: "running",
                },
              ]);
            } else if (evt.type === "step_done" && evt.result) {
              setLiveSteps((prev) =>
                prev.map((s) =>
                  s.step === evt.step && s.tool_name === evt.result.tool_name
                    ? {
                        ...s,
                        detail: evt.detail ? String(evt.detail) : s.detail,
                        status: evt.result.status,
                        cached: Boolean(evt.result.cached),
                      }
                    : s
                )
              );
            } else if (evt.type === "thinking_delta" && evt.delta) {
              setStreamingThinkingText((prev) => prev + String(evt.delta));
            } else if (evt.type === "token_delta" && evt.delta) {
              setStreamingReplyText((prev) => prev + String(evt.delta));
            } else if (evt.type === "cache_metrics" && evt.metrics) {
              setLatestCacheMetrics(evt.metrics);
            } else if (evt.type === "complete") {
              if (evt.cache_metrics) {
                setLatestCacheMetrics(evt.cache_metrics);
              }
              setChatHistory((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: evt.reply || "Completed.",
                  thinking: evt.thinking,
                  cacheMetrics: evt.cache_metrics,
                  toolResults: evt.tool_results,
                },
              ]);
              setStreamingReplyText("");
              setStreamingThinkingText("");
            } else if (evt.type === "error") {
              setChatHistory((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `Error: ${evt.error}`,
                },
              ]);
            }
          } catch {
            // ignore malformed frame
          }
        }
      }
      await loadWorkspace(activeProject.project_id);
      if (primaryNode) {
        fetchRemoteDir(remoteDir);
        if (activeFilePath) openRemoteFile(activeFilePath);
      }
    } catch (err) {
      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Orchestrator error: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
      ]);
    } finally {
      setChatBusy(false);
      setLiveSteps([]);
      setStreamingReplyText("");
      setStreamingThinkingText("");
    }
  }

  async function handleSendPrompt(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (
      (!chatInput.trim() &&
        chatAttachments.length === 0 &&
        !selectedChatSkill) ||
      chatBusy ||
      !activeProject
    )
      return;

    const text = chatInput.trim();
    const atts = [...chatAttachments];
    const activeSkill = selectedChatSkill;
    setChatInput("");
    setChatAttachments([]);
    setSelectedChatSkill(null);
    setSkillMenuOpen(false);
    setMentionMenuOpen(false);

    const promptLang = detectInputLang(text, locale);
    const node = primaryNode || "local-node";

    if (activeSkill === "SkillSearch") {
      const { prompt, displayMsg } = buildSkillSearchPrompt({
        projectId: activeProject.project_id,
        node,
        text,
        promptLang,
      });
      await runStreamingPrompt(prompt, undefined, atts, displayMsg);
      return;
    }

    if (activeSkill === "CheckSystem") {
      const { prompt, displayMsg } = buildCheckSystemPrompt({
        activeProject,
        node,
        text,
        promptLang,
      });
      setSystemScanBusy(true);
      try {
        await runStreamingPrompt(prompt, undefined, atts, displayMsg);
      } finally {
        setSystemScanBusy(false);
      }
      return;
    }

    if (activeSkill === "CheckOpsec") {
      const { prompt, displayMsg } = buildCheckOpsecPrompt({
        activeProject,
        node,
        text,
        promptLang,
      });
      setOpsecScanBusy(true);
      try {
        await runStreamingPrompt(prompt, undefined, atts, displayMsg);
      } finally {
        setOpsecScanBusy(false);
      }
      return;
    }

    if (activeSkill === "DeepForensics") {
      const { prompt, displayMsg } = buildDeepForensicsPrompt({
        projectId: activeProject.project_id,
        node,
        text,
        promptLang,
      });
      await runStreamingPrompt(prompt, undefined, atts, displayMsg);
      return;
    }

    if (activeSkill === "CheckUpdates") {
      let sysStatusSummary = "";
      try {
        const upRes = await safeFetchJson(
          "/api/system-update?check_remote=1&inspect_nodes=1",
          { cache: "no-store", timeoutMs: 12000 }
        );
        if (upRes.ok) {
          const upData = await upRes.json();
          setSystemUpdateStatus(upData);
          sysStatusSummary = JSON.stringify(
            {
              git: upData.git,
              nodes: upData.nodes,
            },
            null,
            2
          );
        }
      } catch {
        // ignore
      }

      const { prompt, displayMsg } = buildCheckUpdatesPrompt({
        projectId: activeProject.project_id,
        node,
        text,
        sysStatusSummary,
      });
      await runStreamingPrompt(prompt, undefined, atts, displayMsg);
      return;
    }

    await runStreamingPrompt(text, undefined, atts);
  }

  const endpointsAndSkills = useCopilotEndpointsAndSkills({
    isDe, activeProject, primaryNode, remoteDir, fetchRemoteDir, openRemoteFile, loadWorkspace,
    showToast, setCopilotDrawerOpen, setAiEndpointModalOpen, setSystemUpdateStatus, setSystemUpdateSteps,
    provider, baseUrl, modelName, setModelName, apiKeyInput, setApiKeyInput, apiKeySecretName,
    enablePromptCaching, enableAutoWatchdog, chatBusy, setChatHistory, runStreamingPrompt,
  });

  return {
    chatInput, setChatInput, chatAttachments, setChatAttachments, isDraggingOverChat, setIsDraggingOverChat,
    mentionMenuOpen, setMentionMenuOpen, mentionFilter, setMentionFilter, streamingReplyText, streamingThinkingText,
    latestCacheMetrics, expandedThinking, setExpandedThinking, fileInputRef, chatScrollRef, chatInputRef, chatComposerRef,
    selectedChatSkill, setSelectedChatSkill, skillMenuOpen, setSkillMenuOpen, chatMessageFilter, setChatMessageFilter,
    expandedRawPrompts, setExpandedRawPrompts, copiedChatMsgIdx, setCopiedChatMsgIdx,
    turnToolCategoryFilter, setTurnToolCategoryFilter, chatBusy, chatElapsedSec, systemScanBusy, opsecScanBusy,
    expandedTurnTools, setExpandedTurnTools, expandedTools, setExpandedTools, liveSteps,
    processDroppedOrSelectedFiles, handleChatPaste, mentionCandidates, handleChatInputChange,
    insertMentionToken, runStreamingPrompt, handleSendPrompt, ...endpointsAndSkills,
  };
}
