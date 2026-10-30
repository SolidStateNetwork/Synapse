"use client";

import React, { useState } from "react";
import { safeFetchJson } from "@/lib/safeFetch";
import type { ChatAttachment, ChatItem, ProjectState } from "@/types/synapse";
import {
  buildInterviewStepResponsePrompt,
  buildStartSkillInterviewPrompt,
  buildUpdateSkillDecisionPrompt,
} from "@/lib/copilot/skillPrompts";
import type { SystemUpdateStatusData } from "./useSystemAndInfraActions";

export function useCopilotEndpointsAndSkills({
  isDe,
  activeProject,
  primaryNode,
  remoteDir,
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
  chatBusy,
  setChatHistory,
  runStreamingPrompt,
}: {
  isDe: boolean;
  activeProject: ProjectState | null;
  primaryNode: string;
  remoteDir: string;
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
  chatBusy: boolean;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatItem[]>>;
  runStreamingPrompt: (
    promptText: string,
    overrideProvider?: string,
    attachmentsToSend?: ChatAttachment[],
    displayUserMessage?: string
  ) => Promise<void>;
}) {
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [syncingModels, setSyncingModels] = useState(false);
  const [modelSyncStatus, setModelSyncStatus] = useState("");

  async function handleSaveAiEndpoint(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProject) return;
    await safeFetchJson("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_ai_settings",
        project_id: activeProject.project_id,
        provider,
        base_url: baseUrl,
        model: modelName,
        api_key_secret_name: apiKeySecretName,
        enable_prompt_caching: enablePromptCaching,
        enable_auto_watchdog: enableAutoWatchdog,
        api_key: apiKeyInput,
      }),
    });
    setApiKeyInput("");
    setAiEndpointModalOpen(false);
    showToast(
      isDe
        ? `KI-Provider gespeichert: ${modelName}`
        : `Saved AI Provider: ${modelName}`
    );
    await loadWorkspace(activeProject.project_id, true);
  }

  async function handleSyncModels() {
    if (!activeProject) return;
    setSyncingModels(true);
    setModelSyncStatus(isDe ? "Frage /models ab..." : "Querying /models...");
    try {
      const res = await safeFetchJson("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list_models",
          project_id: activeProject.project_id,
          provider,
          base_url: baseUrl,
          api_key: apiKeyInput,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.models) && data.models.length > 0) {
        setDiscoveredModels(data.models);
        if (!modelName || !data.models.includes(modelName)) {
          setModelName(data.models[0]);
        }
        setModelSyncStatus(
          isDe
            ? `${data.models.length} Modelle geladen`
            : `Loaded ${data.models.length} models`
        );
      } else {
        setModelSyncStatus(
          data.error ||
            (isDe
              ? "Keine Modelle vom Endpunkt erhalten"
              : "No models returned by endpoint")
        );
      }
    } finally {
      setSyncingModels(false);
    }
  }

  async function handleRollbackSnapshot(snapshotId: string, filePath?: string) {
    if (!activeProject || !snapshotId) return;
    try {
      const res = await safeFetchJson("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rollback_snapshot",
          project_id: activeProject.project_id,
          snapshot_id: snapshotId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          isDe
            ? `Rollback durchgeführt: ${filePath || snapshotId}`
            : `Rolled back ${filePath || snapshotId}`
        );
        setChatHistory((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              data.reply ||
              `⏪ Rolled back ${filePath || "file"} to snapshot ${snapshotId}.`,
          },
        ]);
        await loadWorkspace(activeProject.project_id);
        if (primaryNode) {
          fetchRemoteDir(remoteDir);
          if (filePath) openRemoteFile(filePath);
        }
      } else {
        showToast(
          data.error || (isDe ? "Rollback fehlgeschlagen" : "Rollback failed")
        );
      }
    } catch {
      showToast(
        isDe ? "Rollback-Anfrage fehlgeschlagen" : "Rollback request failed"
      );
    }
  }

  async function handleStartSkillInterview(reportContent: string) {
    if (!activeProject || chatBusy) return;
    const node = primaryNode || "local-node";
    const { prompt, displayMsg } = buildStartSkillInterviewPrompt({
      node,
      reportContent,
    });
    await runStreamingPrompt(prompt, undefined, undefined, displayMsg);
  }

  async function handleInterviewStepResponse(
    decision: "fix" | "skip" | "fix_all" | "stop"
  ) {
    if (!activeProject || chatBusy) return;
    const node = primaryNode || "local-node";
    const { prompt, displayMsg } = buildInterviewStepResponsePrompt({
      node,
      decision,
    });
    await runStreamingPrompt(prompt, undefined, undefined, displayMsg);
  }

  async function handleUpdateSkillDecision(
    decision: "execute_and_test" | "test_only" | "skip",
    reportContent: string
  ) {
    if (!activeProject || chatBusy) return;
    const node = primaryNode || "local-node";

    if (decision === "skip" || decision === "test_only") {
      const { prompt, displayMsg } = buildUpdateSkillDecisionPrompt({
        node,
        decision,
        reportContent,
      });
      await runStreamingPrompt(prompt, undefined, undefined, displayMsg);
      return;
    }

    let otaSummary = "";
    try {
      showToast(
        isDe
          ? "Führe Core & Muscle OTA-Sync durch..."
          : "Running Core & Muscle OTA sync...",
        0
      );
      const upRes = await safeFetchJson("/api/system-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_all",
          project_id: activeProject.project_id,
        }),
      });
      if (upRes.ok) {
        const upData = await upRes.json();
        if (upData.status) setSystemUpdateStatus(upData.status);
        if (Array.isArray(upData.steps)) setSystemUpdateSteps(upData.steps);
        otaSummary = JSON.stringify(
          {
            success: upData.success,
            steps: upData.steps,
            git: upData.status?.git,
            nodes: upData.status?.nodes,
          },
          null,
          2
        );
      }
    } catch {
      // ignore
    } finally {
      showToast("", 0);
    }

    const { prompt, displayMsg } = buildUpdateSkillDecisionPrompt({
      node,
      decision,
      reportContent,
      otaSummary,
    });
    await runStreamingPrompt(prompt, undefined, undefined, displayMsg);
  }

  async function handleQuickAction(actionPrompt: string) {
    if (!activeProject || chatBusy) return;
    setCopilotDrawerOpen(true);
    await runStreamingPrompt(actionPrompt, "synapse-autonomous");
  }

  async function handleClearChat() {
    if (!activeProject) return;
    const res = await safeFetchJson("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "clear_chat",
        project_id: activeProject.project_id,
      }),
    });
    const data = await res.json();
    if (Array.isArray(data.chat_history)) {
      setChatHistory(
        data.chat_history.length > 0
          ? data.chat_history
          : [
              {
                role: "assistant",
                content: isDe
                  ? "Chat-Verlauf geleert."
                  : "Conversation history cleared.",
              },
            ]
      );
    }
  }

  return {
    discoveredModels,
    syncingModels,
    modelSyncStatus,
    handleSaveAiEndpoint,
    handleSyncModels,
    handleRollbackSnapshot,
    handleStartSkillInterview,
    handleInterviewStepResponse,
    handleUpdateSkillDecision,
    handleQuickAction,
    handleClearChat,
  };
}
