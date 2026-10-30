import type { ToolDispatchResult } from "@/lib/orchestrator";
import {
  ensureProjectVault,
  readBrainDoc,
  type ChatAttachment,
  type PromptCacheMetrics,
} from "@/lib/vault";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: ChatAttachment[];
}

export type OrchestratorStreamEvent =
  | {
      type: "step_start";
      step: number;
      tool_name: string;
      detail?: string;
    }
  | {
      type: "step_done";
      step: number;
      tool_name: string;
      detail?: string;
      result: ToolDispatchResult;
    }
  | {
      type: "thinking_delta";
      delta: string;
    }
  | {
      type: "token_delta";
      delta: string;
    }
  | {
      type: "cache_metrics";
      metrics: PromptCacheMetrics;
    };

export type StepProgressCallback = (event: OrchestratorStreamEvent) => void;

export function summarizeToolCallDetail(
  fnName: string,
  fnArgs: Record<string, unknown>
): string {
  if (fnName === "node_deep_search") {
    const mode = String(fnArgs.search_mode || "scan");
    const q = String(fnArgs.query || fnArgs.file_glob || "*").trim();
    const node = String(fnArgs.node_id || "");
    return `${node ? `${node}: ` : ""}[${mode}] ${q.slice(0, 56)}`;
  }
  if (fnName === "core_vault_search") {
    const scope = String(fnArgs.scope || "all");
    const q = String(fnArgs.query || "*").trim();
    return `Vault Search [${scope}]: ${q.slice(0, 56)}`;
  }
  if (fnName === "node_pty_exec") {
    const cmd = String(fnArgs.command || "").trim().replace(/\s+/g, " ");
    const node = String(fnArgs.node_id || "");
    return `${node ? `${node}: ` : ""}${cmd.slice(0, 72)}${
      cmd.length > 72 ? "…" : ""
    }`;
  }
  if (
    fnName === "node_fs_operation" ||
    fnName === "node_fs_read" ||
    fnName === "node_fs_write"
  ) {
    const op = String(fnArgs.operation || "read_file");
    const p = String(fnArgs.path || "");
    return `${op} ${p}`;
  }
  if (fnName === "core_register_service") {
    return `${fnArgs.name || fnArgs.service_id || "service"} :${
      fnArgs.port || ""
    }`;
  }
  if (fnName === "core_update_brain_doc") {
    return `${fnArgs.document || "Doc"} (${fnArgs.mode || "update"})`;
  }
  return "";
}

/**
 * Expands `@` context mentions in the user prompt (e.g. `@Architecture.md`, `@Memory.md`,
 * `@node:<id>`, `@service:<id>`) by appending an explicit context reference block.
 */
export function expandContextMentions(
  projectId: string,
  promptText: string
): string {
  if (!promptText || !promptText.includes("@")) return promptText;
  const state = ensureProjectVault(projectId);
  const supplements: string[] = [];

  if (/@architecture(\.md)?\b/i.test(promptText)) {
    const arch = readBrainDoc(projectId, "Architecture.md");
    supplements.push(
      `<mentioned_context target="@Architecture.md">\n${arch.slice(
        0,
        4000
      )}\n</mentioned_context>`
    );
  }
  if (/@memory(\.md)?\b/i.test(promptText)) {
    const mem = readBrainDoc(projectId, "Memory.md");
    supplements.push(
      `<mentioned_context target="@Memory.md">\n${mem.slice(
        0,
        4000
      )}\n</mentioned_context>`
    );
  }

  for (const node of state.assigned_nodes) {
    if (
      promptText.includes(`@${node.node_id}`) ||
      promptText.includes(`@peer:${node.node_id}`)
    ) {
      const hb = state.telemetry?.[node.node_id];
      supplements.push(
        `<mentioned_peer node_id="${node.node_id}" tier="${
          node.tier
        }" status="${node.online ? "ONLINE" : "OFFLINE"}">\n${JSON.stringify(
          hb || node,
          null,
          2
        )}\n</mentioned_peer>`
      );
    }
  }

  for (const svc of state.registered_services) {
    if (
      promptText.includes(`@${svc.service_id}`) ||
      promptText.includes(`@service:${svc.port}`) ||
      promptText.includes(`:${svc.port}`)
    ) {
      supplements.push(
        `<mentioned_service service_id="${svc.service_id}" port="${
          svc.port
        }">\n${JSON.stringify(svc, null, 2)}\n</mentioned_service>`
      );
    }
  }

  if (supplements.length === 0) return promptText;
  return `${promptText}\n\n${supplements.join("\n\n")}`;
}

export function formatOpenAIMessageContent(
  textContent: string,
  attachments?: ChatAttachment[]
): unknown {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return textContent;
  }

  const parts: Array<Record<string, unknown>> = [];
  if (textContent.trim()) {
    parts.push({ type: "text", text: textContent });
  } else {
    parts.push({
      type: "text",
      text: "Analyze the attached image(s)/screenshot(s) in the context of our Synapse DevOps project and execute any required actions.",
    });
  }

  for (const att of attachments) {
    if (att.data_url && att.mime_type?.startsWith("image/")) {
      parts.push({
        type: "image_url",
        image_url: {
          url: att.data_url,
          detail: "auto",
        },
      });
    } else if (att.data_url) {
      try {
        const base64Part = att.data_url.split(",")[1] || "";
        const decoded = Buffer.from(base64Part, "base64")
          .toString("utf8")
          .slice(0, 8192);
        parts.push({
          type: "text",
          text: `\n<attached_file name="${att.name}">\n${decoded}\n</attached_file>`,
        });
      } catch {
        // ignore
      }
    }
  }

  return parts;
}

export function formatAnthropicMessageContent(
  textContent: string,
  attachments?: ChatAttachment[]
): unknown {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return textContent;
  }

  const blocks: Array<Record<string, unknown>> = [];
  for (const att of attachments) {
    if (att.data_url && att.mime_type?.startsWith("image/")) {
      const base64Data = att.data_url.includes(",")
        ? att.data_url.split(",")[1]
        : att.data_url;
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: att.mime_type || "image/png",
          data: base64Data,
        },
      });
    } else if (att.data_url) {
      try {
        const base64Part = att.data_url.split(",")[1] || "";
        const decoded = Buffer.from(base64Part, "base64")
          .toString("utf8")
          .slice(0, 8192);
        blocks.push({
          type: "text",
          text: `<attached_file name="${att.name}">\n${decoded}\n</attached_file>`,
        });
      } catch {
        // ignore
      }
    }
  }

  blocks.push({
    type: "text",
    text:
      textContent.trim() ||
      "Analyze the attached image(s)/screenshot(s) and perform the appropriate DevOps actions.",
  });

  return blocks;
}

export function splitReasoningFromReply(raw: string): {
  thinking: string;
  cleanReply: string;
} {
  const thinkMatch = raw.match(/<think>([\s\S]*?)<\/think>/i);
  if (!thinkMatch) {
    return { thinking: "", cleanReply: raw };
  }
  const thinking = thinkMatch[1].trim();
  const cleanReply = raw.replace(/<think>[\s\S]*?<\/think>/i, "").trim();
  return { thinking, cleanReply: cleanReply || raw };
}

export async function emitProgressiveTokens(
  text: string,
  thinkingText: string,
  onProgress?: StepProgressCallback
): Promise<void> {
  if (!onProgress) return;
  if (thinkingText) {
    const tChunks = thinkingText.match(/[\s\S]{1,180}/g) || [thinkingText];
    for (const c of tChunks) {
      onProgress({ type: "thinking_delta", delta: c });
      await new Promise((r) => setTimeout(r, 4));
    }
  }
  if (text) {
    const chunks = text.match(/[\s\S]{1,180}/g) || [text];
    for (const c of chunks) {
      onProgress({ type: "token_delta", delta: c });
      await new Promise((r) => setTimeout(r, 4));
    }
  }
}

export function detectPromptLanguage(text: string): "de" | "en" {
  const sample = (text || "").trim();
  if (!sample) return "de";
  if (/respond in english|answer in english|in english please/i.test(sample)) {
    return "en";
  }
  if (/auf deutsch|antworte.*deutsch/i.test(sample)) {
    return "de";
  }
  const deScore =
    (
      sample.match(
        /\b(wie|was|warum|wo|wann|bitte|zeig|zeige|prüf|prüfe|teste|finde|suche|erkläre|erstelle|baue|behebe|aktualisiere|ist|sind|nicht|und|oder|für|mit|auf|dem|den|der|die|das|ein|eine|meine|deine|alle|servern|dienste|dateien|hallo|danke|kannst|soll|mach|mache)\b/gi
      ) || []
    ).length + (/[äöüß]/i.test(sample) ? 2 : 0);
  const enScore = (
    sample.match(
      /\b(what|how|why|where|when|who|can|could|would|should|please|show|check|test|find|search|list|explain|tell|give|help|create|deploy|build|fix|update|is|are|do|does|the|with|from|for|and|all|my|your|our|servers|services|ports|files|hello|hi|thanks)\b/gi
    ) || []
  ).length;
  return enScore > deScore ? "en" : "de";
}

export function formatHaltedWorkflowReply(
  stepResult: ToolDispatchResult,
  stepNum: number
): string {
  if (stepResult.status === "blocked_planning_mode") {
    return `**Planning-Only Mode Enforced (Step ${stepNum}):** Project has zero assigned Axon Muscle Nodes. Remote execution (\`${stepResult.tool_name}\`) was blocked by the Core Policy Interceptor.`;
  }
  if (stepResult.status === "paused_tier3") {
    return `**Policy Interceptor Pause (\`TIER_3_SUPERVISED\` at Step ${stepNum}):** Tool \`${stepResult.tool_name}\` is queued as Approval \`${stepResult.approval_id}\`. Approve or reject it in the banner above to continue.`;
  }
  return `Executed \`${stepResult.tool_name}\` through the Synapse Core Interceptor (\`${
    stepResult.status
  }\`${stepResult.cached ? " · ⚡ Served from Tool Cache" : ""}).`;
}
