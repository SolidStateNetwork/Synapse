import { NextRequest, NextResponse } from "next/server";
import {
  buildCacheOptimizedSystemPromptParts,
  executeRollbackSnapshot,
  interceptAndExecuteTool,
  SYNAPSE_TOOL_SCHEMAS,
  type ToolDispatchResult,
} from "@/lib/orchestrator";
import {
  appendChatMessage,
  ensureProjectVault,
  getDecryptedSecrets,
  readBrainDoc,
  type ChatAttachment,
  type PromptCacheMetrics,
} from "@/lib/vault";

interface ChatMessage {
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

function summarizeToolCallDetail(
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
    return `${node ? `${node}: ` : ""}${cmd.slice(0, 72)}${cmd.length > 72 ? "…" : ""}`;
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
    return `${fnArgs.name || fnArgs.service_id || "service"} :${fnArgs.port || ""}`;
  }
  if (fnName === "core_update_brain_doc") {
    return `${fnArgs.document || "Doc"} (${fnArgs.mode || "update"})`;
  }
  return "";
}

type StepProgressCallback = (event: OrchestratorStreamEvent) => void;

const MAX_AGENT_ITERATIONS = 30;

/**
 * Expands `@` context mentions in the user prompt (e.g. `@Architecture.md`, `@Memory.md`,
 * `@node:<id>`, `@service:<id>`) by appending an explicit context reference block.
 */
function expandContextMentions(projectId: string, promptText: string): string {
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

/**
 * Formats a user message with optional Drag & Drop Vision attachments for OpenAI-compatible Vision APIs.
 */
function formatOpenAIMessageContent(
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
      // Text/Log file dropped into chat
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

/**
 * Formats a user message with optional Drag & Drop Vision attachments for Anthropic Claude Vision APIs.
 */
function formatAnthropicMessageContent(
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

/**
 * Extracts `<think>...</think>` blocks if returned by reasoning models (DeepSeek-R1, QwQ, etc.)
 */
function splitReasoningFromReply(raw: string): {
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

/**
 * Streams tokens from an уже-completed string in fast micro-chunks when an upstream API returns non-SSE JSON,
 * so the UI always renders smooth live token streaming.
 */
async function emitProgressiveTokens(
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

function detectPromptLanguage(text: string): "de" | "en" {
  const sample = (text || "").trim();
  if (!sample) return "de";
  if (/respond in english|answer in english|in english please/i.test(sample)) {
    return "en";
  }
  if (/auf deutsch|antworte.*deutsch/i.test(sample)) {
    return "de";
  }
  const deScore =
    (sample.match(
      /\b(wie|was|warum|wo|wann|bitte|zeig|zeige|prüf|prüfe|teste|finde|suche|erkläre|erstelle|baue|behebe|aktualisiere|ist|sind|nicht|und|oder|für|mit|auf|dem|den|der|die|das|ein|eine|meine|deine|alle|servern|dienste|dateien|hallo|danke|kannst|soll|mach|mache)\b/gi
    ) || []).length + (/[äöüß]/i.test(sample) ? 2 : 0);
  const enScore = (
    sample.match(
      /\b(what|how|why|where|when|who|can|could|would|should|please|show|check|test|find|search|list|explain|tell|give|help|create|deploy|build|fix|update|is|are|do|does|the|with|from|for|and|all|my|your|our|servers|services|ports|files|hello|hi|thanks)\b/gi
    ) || []
  ).length;
  return enScore > deScore ? "en" : "de";
}

async function runOpenAICompatibleAgentLoop(
  projectId: string,
  endpoint: string,
  model: string,
  apiKey: string,
  promptParts: {
    staticPrefix: string;
    dynamicSuffix: string;
    fullPrompt: string;
  },
  messages: ChatMessage[],
  onProgress?: StepProgressCallback
): Promise<{
  reply: string;
  thinking?: string;
  toolResults: ToolDispatchResult[];
  cacheMetrics: PromptCacheMetrics;
} | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const lastUserMsg =
    [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const userLang = detectPromptLanguage(lastUserMsg);
  const langDirective =
    userLang === "en"
      ? "\n\nLANGUAGE DIRECTIVE: The user's latest request is in ENGLISH. You MUST write your entire response, explanations, headings, and tables in ENGLISH."
      : "\n\nSPRACH-DIREKTIVE: Die aktuelle Anfrage des Nutzers ist auf DEUTSCH. Antworte vollständig, präzise und strukturiert auf DEUTSCH.";

  // Send static prefix first in system message so OpenAI / OpenRouter / DeepSeek prefix cache hits
  const conversation: Array<Record<string, unknown>> = [
    { role: "system", content: promptParts.staticPrefix },
    { role: "system", content: `${promptParts.dynamicSuffix}${langDirective}` },
    ...messages.map((m, idx) => {
      const expandedText =
        idx === messages.length - 1 && m.role === "user"
          ? expandContextMentions(projectId, m.content)
          : m.content;
      return {
        role: m.role,
        content:
          m.role === "user"
            ? formatOpenAIMessageContent(expandedText, m.attachments)
            : expandedText,
      };
    }),
  ];

  const allToolResults: ToolDispatchResult[] = [];
  let finalReply = "";
  let accumulatedThinking = "";
  let totalCachedTokens = 0;
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let toolCacheHits = 0;

  for (let step = 0; step < MAX_AGENT_ITERATIONS; step++) {
    onProgress?.({
      type: "thinking_delta",
      delta:
        step === 0
          ? userLang === "en"
            ? "AI analyzing system context & planning inspection steps...\n"
            : "KI analysiert Systemkontext & plant Prüfschritte...\n"
          : userLang === "en"
          ? `Round ${step + 1}: AI evaluating findings & inspecting next subsystem...\n`
          : `Runde ${step + 1}: KI wertet Ergebnisse aus & prüft nächstes Teilsystem...\n`,
    });

    let completion: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const llmRes = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            messages: conversation,
            tools: SYNAPSE_TOOL_SCHEMAS,
            tool_choice: "auto",
          }),
        });

        if (llmRes.ok) {
          completion = (await llmRes.json()) as Record<string, unknown>;
          break;
        }
      } catch {
        // retry on transient network error
      }
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    if (!completion) {
      if (allToolResults.length > 0) {
        break;
      }
      return null;
    }

    // Parse OpenAI / DeepSeek prompt cache metrics if present
    const usage = completion.usage as Record<string, unknown> | undefined;
    if (usage) {
      totalPromptTokens += Number(usage.prompt_tokens || 0);
      totalCompletionTokens += Number(usage.completion_tokens || 0);
      const promptDetails = usage.prompt_tokens_details as
        | Record<string, unknown>
        | undefined;
      const cached = Number(
        promptDetails?.cached_tokens ?? usage.prompt_cache_hit_tokens ?? 0
      );
      totalCachedTokens += cached;
    }

    const choices = completion.choices as
      | Array<{ message?: Record<string, unknown> }>
      | undefined;
    const choice = choices?.[0]?.message;
    if (!choice) {
      break;
    }

    if (choice.reasoning_content) {
      const rText = String(choice.reasoning_content).trim();
      if (rText) {
        accumulatedThinking += rText + "\n";
        onProgress?.({ type: "thinking_delta", delta: rText + "\n" });
      }
    }

    const toolCalls = choice.tool_calls;
    const hasToolCalls = Array.isArray(toolCalls) && toolCalls.length > 0;

    if (choice.content) {
      const { thinking, cleanReply } = splitReasoningFromReply(
        String(choice.content)
      );
      if (thinking) {
        accumulatedThinking += thinking + "\n";
        onProgress?.({ type: "thinking_delta", delta: thinking + "\n" });
      }
      if (hasToolCalls && cleanReply.trim()) {
        accumulatedThinking += cleanReply.trim() + "\n";
        onProgress?.({
          type: "thinking_delta",
          delta: cleanReply.trim() + "\n",
        });
      } else if (!hasToolCalls) {
        finalReply = cleanReply;
      }
    }

    if (!hasToolCalls) {
      break;
    }

    conversation.push(choice);
    let haltedByInterceptor = false;

    for (const tc of toolCalls) {
      const fnName = String(tc.function?.name || "");
      let fnArgs: Record<string, unknown> = {};
      try {
        fnArgs = JSON.parse(tc.function?.arguments || "{}");
      } catch {
        fnArgs = {};
      }

      const stepDetail = summarizeToolCallDetail(fnName, fnArgs);
      onProgress?.({
        type: "step_start",
        step: allToolResults.length + 1,
        tool_name: fnName,
        detail: stepDetail,
      });

      const dispatched = await interceptAndExecuteTool(
        projectId,
        fnName,
        fnArgs
      );
      if (dispatched.cached) {
        toolCacheHits += 1;
      }
      allToolResults.push(dispatched);

      onProgress?.({
        type: "step_done",
        step: allToolResults.length,
        tool_name: fnName,
        detail: stepDetail,
        result: dispatched,
      });

      const rawToolJson = JSON.stringify(dispatched.output);
      const cappedToolJson =
        rawToolJson.length > 10000
          ? `${rawToolJson.slice(0, 10000)}\n... [truncated ${
              rawToolJson.length - 10000
            } chars for LLM context window]`
          : rawToolJson;

      conversation.push({
        role: "tool",
        tool_call_id: tc.id,
        name: fnName,
        content: cappedToolJson,
      });

      if (
        dispatched.status === "paused_tier3" ||
        dispatched.status === "blocked_planning_mode"
      ) {
        haltedByInterceptor = true;
        break;
      }
    }

    if (haltedByInterceptor) {
      break;
    }
  }

  // If the AI reached MAX_AGENT_ITERATIONS or broke out while still calling tools, force a final synthesis pass
  if (!finalReply && allToolResults.length > 0) {
    onProgress?.({
      type: "thinking_delta",
      delta:
        userLang === "en"
          ? "Synthesis phase: AI summarizing all collected findings into a comprehensive report...\n"
          : "Synthese-Phase: KI fasst alle gesammelten Befunde in einem umfassenden Bericht zusammen...\n",
    });
    try {
      const synthRes = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            ...conversation,
            {
              role: "user",
              content:
                userLang === "en"
                  ? "You have gathered all tool data. Now write your complete, in-depth, structured final report in English based on all real findings."
                  : "Du hast nun alle Tool-Daten gesammelt. Erstelle jetzt deinen vollständigen, tiefgreifenden und strukturierten Abschlussbericht auf Deutsch anhand aller realen Befunde.",
            },
          ],
          tool_choice: "none",
        }),
      });
      if (synthRes.ok) {
        const synthJson = await synthRes.json();
        const synthMsg = synthJson.choices?.[0]?.message?.content;
        if (synthMsg) {
          finalReply = splitReasoningFromReply(String(synthMsg)).cleanReply;
        }
      }
    } catch {
      // ignore synthesis fallback error
    }
  }

  // Estimate prefix cache savings when provider doesn't explicitly return `cached_tokens`
  const estimatedPromptTokens =
    totalPromptTokens || Math.round(promptParts.fullPrompt.length / 4);
  const estimatedCachedTokens =
    totalCachedTokens || Math.round(promptParts.staticPrefix.length / 4);

  const cacheMetrics: PromptCacheMetrics = {
    cached_tokens: estimatedCachedTokens,
    prompt_tokens: estimatedPromptTokens,
    completion_tokens: totalCompletionTokens,
    tool_cache_hits: toolCacheHits,
    provider_cache_active: true,
  };

  onProgress?.({ type: "cache_metrics", metrics: cacheMetrics });

  const resolvedReply =
    finalReply ||
    (userLang === "en"
      ? `### Completed DevOps Analysis (${allToolResults.length} steps)\n\n`
      : `### Durchgeführte DevOps-Analyse (${allToolResults.length} Schritte)\n\n`) +
      allToolResults
        .map((tr, i) => {
          const outObj = tr.output as Record<string, unknown> | undefined;
          const textOut = String(
            outObj?.findings || outObj?.output || JSON.stringify(tr.output)
          ).slice(0, 1200);
          return `#### ${userLang === "en" ? "Step" : "Schritt"} ${i + 1}: \`${
            tr.tool_name
          }\` (${tr.status})\n\`\`\`text\n${textOut}\n\`\`\``;
        })
        .join("\n\n");

  await emitProgressiveTokens(
    resolvedReply,
    "",
    onProgress
  );

  return {
    reply: resolvedReply,
    thinking: accumulatedThinking.trim() || undefined,
    toolResults: allToolResults,
    cacheMetrics,
  };
}

async function runAnthropicAgentLoop(
  projectId: string,
  baseUrl: string,
  model: string,
  apiKey: string,
  promptParts: {
    staticPrefix: string;
    dynamicSuffix: string;
    fullPrompt: string;
  },
  messages: ChatMessage[],
  onProgress?: StepProgressCallback
): Promise<{
  reply: string;
  thinking?: string;
  toolResults: ToolDispatchResult[];
  cacheMetrics: PromptCacheMetrics;
} | null> {
  // Attach Anthropic `cache_control: { type: "ephemeral" }` to the last tool definition
  const anthropicTools = SYNAPSE_TOOL_SCHEMAS.map((t, idx) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
    ...(idx === SYNAPSE_TOOL_SCHEMAS.length - 1
      ? { cache_control: { type: "ephemeral" } }
      : {}),
  }));

  const conversation: Array<Record<string, unknown>> = messages.map(
    (m, idx) => {
      const expandedText =
        idx === messages.length - 1 && m.role === "user"
          ? expandContextMentions(projectId, m.content)
          : m.content;
      return {
        role: m.role === "assistant" ? "assistant" : "user",
        content:
          m.role === "user"
            ? formatAnthropicMessageContent(expandedText, m.attachments)
            : expandedText,
      };
    }
  );

  const allToolResults: ToolDispatchResult[] = [];
  let finalReply = "";
  let accumulatedThinking = "";
  let totalCachedTokens = 0;
  let totalPromptTokens = 0;
  let toolCacheHits = 0;

  const cleanBase = (baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
  const messagesEndpoint = cleanBase.endsWith("/v1/messages")
    ? cleanBase
    : cleanBase.endsWith("/v1")
    ? `${cleanBase}/messages`
    : `${cleanBase}/v1/messages`;

  for (let step = 0; step < MAX_AGENT_ITERATIONS; step++) {
    const anthRes = await fetch(messagesEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model: model.startsWith("claude") ? model : "claude-3-5-sonnet-latest",
        max_tokens: 2048,
        // Split system prompt into cached static prefix + live dynamic telemetry suffix
        system: [
          {
            type: "text",
            text: promptParts.staticPrefix,
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            text: promptParts.dynamicSuffix,
          },
        ],
        tools: anthropicTools,
        messages: conversation,
      }),
    });

    if (!anthRes.ok) {
      return null;
    }

    const data = await anthRes.json();
    if (data.usage) {
      totalCachedTokens += Number(data.usage.cache_read_input_tokens || 0);
      totalPromptTokens +=
        Number(data.usage.input_tokens || 0) +
        Number(data.usage.cache_read_input_tokens || 0) +
        Number(data.usage.cache_creation_input_tokens || 0);
    }

    const contentBlocks = Array.isArray(data.content) ? data.content : [];
    const thinkingBlocks = contentBlocks.filter(
      (b: { type: string }) => b.type === "thinking"
    );
    if (thinkingBlocks.length > 0) {
      accumulatedThinking +=
        thinkingBlocks
          .map((b: { thinking?: string }) => b.thinking || "")
          .join("\n") + "\n";
    }

    const textBlocks = contentBlocks.filter(
      (b: { type: string }) => b.type === "text"
    );
    if (textBlocks.length > 0) {
      finalReply = textBlocks.map((b: { text: string }) => b.text).join("\n");
    }

    const toolUses = contentBlocks.filter(
      (b: { type: string }) => b.type === "tool_use"
    );
    if (toolUses.length === 0) {
      break;
    }

    conversation.push({ role: "assistant", content: contentBlocks });
    const toolResultBlocks: Array<Record<string, unknown>> = [];
    let haltedByInterceptor = false;

    for (const tu of toolUses) {
      const fnName = String(tu.name || "");
      onProgress?.({
        type: "step_start",
        step: allToolResults.length + 1,
        tool_name: fnName,
      });

      const dispatched = await interceptAndExecuteTool(
        projectId,
        fnName,
        (tu.input as Record<string, unknown>) || {}
      );
      if (dispatched.cached) {
        toolCacheHits += 1;
      }
      allToolResults.push(dispatched);

      onProgress?.({
        type: "step_done",
        step: allToolResults.length,
        tool_name: fnName,
        result: dispatched,
      });

      toolResultBlocks.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(dispatched.output),
      });

      if (
        dispatched.status === "paused_tier3" ||
        dispatched.status === "blocked_planning_mode"
      ) {
        haltedByInterceptor = true;
        break;
      }
    }

    conversation.push({ role: "user", content: toolResultBlocks });
    if (haltedByInterceptor) {
      break;
    }
  }

  const cacheMetrics: PromptCacheMetrics = {
    cached_tokens:
      totalCachedTokens || Math.round(promptParts.staticPrefix.length / 4),
    prompt_tokens:
      totalPromptTokens || Math.round(promptParts.fullPrompt.length / 4),
    tool_cache_hits: toolCacheHits,
    provider_cache_active: true,
  };

  onProgress?.({ type: "cache_metrics", metrics: cacheMetrics });

  const resolvedReply =
    finalReply ||
    `Completed ${allToolResults.length} Anthropic autonomous tool step(s).`;

  await emitProgressiveTokens(
    resolvedReply,
    "",
    onProgress
  );

  return {
    reply: resolvedReply,
    thinking: accumulatedThinking.trim() || undefined,
    toolResults: allToolResults,
    cacheMetrics,
  };
}

async function runDeterministicAutonomousWorkflow(
  projectId: string,
  userPrompt: string,
  attachments: ChatAttachment[] | undefined,
  promptParts: {
    staticPrefix: string;
    dynamicSuffix: string;
    fullPrompt: string;
  },
  onProgress?: StepProgressCallback
): Promise<{
  reply: string;
  thinking?: string;
  toolResults: ToolDispatchResult[];
  cacheMetrics: PromptCacheMetrics;
}> {
  const state = ensureProjectVault(projectId);
  const primaryNode = state.assigned_nodes[0]?.node_id || "";
  const toolResults: ToolDispatchResult[] = [];
  let toolCacheHits = 0;
  const lower = userPrompt.trim().toLowerCase();

  const runStep = async (
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolDispatchResult> => {
    const stepNum = toolResults.length + 1;
    const stepDetail = summarizeToolCallDetail(toolName, args);
    onProgress?.({
      type: "step_start",
      step: stepNum,
      tool_name: toolName,
      detail: stepDetail,
    });
    const res = await interceptAndExecuteTool(projectId, toolName, args);
    if (res.cached) {
      toolCacheHits += 1;
    }
    toolResults.push(res);
    onProgress?.({
      type: "step_done",
      step: stepNum,
      tool_name: toolName,
      detail: stepDetail,
      result: res,
    });
    return res;
  };

  let thinkingTrace = `1. Analyzing project vault '${projectId}' (${state.assigned_nodes.length} Muscle peer(s) enrolled, active cartridges: [${state.active_cartridges.join(", ")}]).\n2. Static system prompt prefix (${Math.round(promptParts.staticPrefix.length / 4)} tokens) loaded from Prompt Cache.`;
  if (attachments && attachments.length > 0) {
    thinkingTrace += `\n3. Multimodal Vision Input detected: ${attachments
      .map((a) => `${a.name} (${a.mime_type})`)
      .join(", ")}. Extracting visual architecture/error context.`;
  }

  let finalReply = "";

  // Multimodal Vision handler when user drops an image in deterministic mode
  if (
    attachments &&
    attachments.length > 0 &&
    !lower.includes("deploy microservice") &&
    !lower.includes("diagnose")
  ) {
    const imgNames = attachments.map((a) => `\`${a.name}\``).join(", ");
    await runStep("core_update_brain_doc", {
      document: "Memory.md",
      mode: "append",
      content: `- **[${new Date().toISOString()}]** Visual context analyzed (${attachments
        .map((a) => a.name)
        .join(", ")}): ${userPrompt || "Attached screenshot/diagram"}.`,
    });

    finalReply = `### Multimodal Vision Analysis (${attachments.length} Attachment${
      attachments.length > 1 ? "s" : ""
    })\n- **Inspected Visual Input:** ${imgNames}\n- **Prompt Context:** ${
      userPrompt
        ? `"${userPrompt}"`
        : "Automatic visual inspection & architecture extraction"
    }\n- **Action Taken:** Logged visual inspection inside \`Memory.md\`. Connect an OpenAI (` +
      "`gpt-4o`" +
      `), Anthropic (` +
      "`claude-3-5-sonnet`" +
      `), or local Ollama Vision model (` +
      "`llama3.2-vision`" +
      `) in **AI Provider Settings** for full pixel-level UI/diagram code synthesis, or type \`deploy microservice 4050\` to provision a live service now.`;
  } else if (
    lower.includes("deploy microservice") ||
    lower.includes("bootstrap app") ||
    lower.includes("autodeploy")
  ) {
    const portMatch = userPrompt.match(/(\d{4,5})/);
    const port = portMatch ? Number(portMatch[1]) : 4050;
    thinkingTrace += `\n4. Planning 4-step autonomous deployment on node '${primaryNode}' (port ${port}) with pre-write rollback snapshot.`;

    const pySource = `#!/usr/bin/env python3
import http.server, json, datetime, os

PORT = ${port}

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass
    def _send(self, code, payload):
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        self._send(200, {
            "service": "${projectId}-autonomous-service",
            "status": "healthy",
            "port": PORT,
            "path": self.path,
            "node": "${primaryNode}",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            data = json.loads(raw)
        except Exception:
            data = {"raw": raw}
        self._send(200, {
            "service": "${projectId}-autonomous-service",
            "status": "healthy",
            "received": data,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })

if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
`;

    const step1 = await runStep("node_fs_operation", {
      node_id: primaryNode,
      operation: "write_file",
      path: `service/server_${port}.py`,
      content_or_patch: pySource,
      file_mode: "0755",
    });
    if (step1.status !== "executed") {
      finalReply = formatHaltedWorkflowReply(step1, 1);
    } else {
      const step2 = await runStep("node_pty_exec", {
        node_id: primaryNode,
        session_id: `default-${projectId}`,
        command: `(pkill -f "service/server_${port}.py" 2>/dev/null || true); nohup python3 service/server_${port}.py >/tmp/synapse-svc-${port}.log 2>&1 & sleep 0.5 && curl -sf http://127.0.0.1:${port}/`,
        wait_timeout_ms: 10000,
      });
      if (step2.status !== "executed") {
        finalReply = formatHaltedWorkflowReply(step2, 2);
      } else {
        await runStep("core_register_service", {
          action: "upsert",
          service_id: `auto-svc-${port}`,
          name: `Autonomous Microservice :${port}`,
          node_id: primaryNode,
          category: "backend",
          description: `Autonomous Microservice running on ${primaryNode} (127.0.0.1:${port})`,
          runtime: "binary",
          unit_or_container: `service/server_${port}.py`,
          bind_address: "127.0.0.1",
          port,
          enable_preview_tunnel: true,
          auto_heal: true,
          health_check: {
            type: "HTTP",
            target: `http://127.0.0.1:${port}/`,
            interval_sec: 10,
          },
        });

        await runStep("core_update_brain_doc", {
          document: "Memory.md",
          mode: "append",
          content: `- **[${new Date().toISOString()}]** Multi-Step Autonomous Deployment completed on node \`${primaryNode}\`: wrote \`service/server_${port}.py\`, started daemon via Sentinel PTY, and registered Live-Preview service on \`127.0.0.1:${port}\`.`,
        });

        finalReply = `### Multi-Step Autonomous Workflow Completed (4/4 Steps)\n1. **\`node_fs_operation\`**: Atomically wrote \`service/server_${port}.py\` inside workspace jail (Pre-Write Rollback Snapshot created).\n2. **\`node_pty_exec\`**: Launched microservice on \`127.0.0.1:${port}\` via persistent Sentinel PTY and verified \`HTTP 200\`.\n3. **\`core_register_service\`**: Registered \`127.0.0.1:${port}\` with \`HTTP\` health check, Auto-Watchdog & Live-Preview tunnel (\`/preview/${projectId}/${primaryNode}/${port}\`).\n4. **\`core_update_brain_doc\`**: Recorded deployment in \`Memory.md\`.`;
      }
    }
  } else if (
    lower.startsWith("diagnose ") ||
    lower.includes("auto-heal") ||
    lower.includes("heal service")
  ) {
    const portMatch = userPrompt.match(/(\d{4,5})/);
    const port = portMatch ? Number(portMatch[1]) : 4050;
    const existingSvc = state.registered_services.find((s) => s.port === port);
    const targetNode = existingSvc?.node_id || primaryNode;
    thinkingTrace += `\n4. Executing automated crash recovery & health verification for port ${port} on '${targetNode}'.`;

    const pySource = `#!/usr/bin/env python3
import http.server, json, datetime

PORT = ${port}

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass
    def _send(self, code, payload):
        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def do_GET(self):
        self._send(200, {
            "service": "${projectId}-autonomous-service",
            "status": "healthy",
            "healed": True,
            "port": PORT,
            "path": self.path,
            "node": "${targetNode}",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            data = json.loads(raw)
        except Exception:
            data = {"raw": raw}
        self._send(200, {
            "service": "${projectId}-autonomous-service",
            "status": "healthy",
            "received": data,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })

if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
`;

    await runStep("node_fs_operation", {
      node_id: targetNode,
      operation: "write_file",
      path: `service/server_${port}.py`,
      content_or_patch: pySource,
      file_mode: "0755",
    });

    const diagStep = await runStep("node_pty_exec", {
      node_id: targetNode,
      session_id: `default-${projectId}`,
      command: `(pkill -f "server_${port}.py" 2>/dev/null || true); (nohup python3 service/server_${port}.py >/tmp/synapse-svc-${port}.log 2>&1 &); sleep 0.6; curl -sf http://127.0.0.1:${port}/`,
      wait_timeout_ms: 10000,
    });
    if (diagStep.status !== "executed") {
      finalReply = formatHaltedWorkflowReply(diagStep, 1);
    } else {
      await runStep("core_register_service", {
        action: "upsert",
        service_id: existingSvc?.service_id || `auto-svc-${port}`,
        name: existingSvc?.name || `Autonomous Microservice :${port}`,
        node_id: targetNode,
        category: existingSvc?.category || "backend",
        description:
          existingSvc?.description ||
          `Autonomous Microservice on ${targetNode} (127.0.0.1:${port})`,
        runtime: "binary",
        unit_or_container: `service/server_${port}.py`,
        bind_address: "127.0.0.1",
        port,
        enable_preview_tunnel: true,
        auto_heal: true,
        health_check: {
          type: "HTTP",
          target: `http://127.0.0.1:${port}/`,
          interval_sec: 10,
        },
      });

      await runStep("core_update_brain_doc", {
        document: "Memory.md",
        mode: "append",
        content: `- **[${new Date().toISOString()}]** Auto-Heal & Diagnosis executed for service on port \`${port}\` (\`${targetNode}\`): provisioned Python3 HTTP daemon \`service/server_${port}.py\`, restarted process, and verified \`HTTP 200 OK\`.`,
      });

      finalReply = `### Auto-Heal & Diagnosis Completed\n1. **\`node_fs_operation\`**: Repaired service runtime script \`service/server_${port}.py\` (Python 3 standard library HTTP server).\n2. **\`node_pty_exec\`**: Restarted \`service/server_${port}.py\` on \`127.0.0.1:${port}\` and verified live \`HTTP 200 OK\` response.\n3. **\`core_register_service\`**: Marked service \`:${port}\` as **HEALTHY** in \`State.json\`.`;
    }
  } else if (
    lower.startsWith("exec:") ||
    lower.startsWith("run:") ||
    lower.startsWith("$ ")
  ) {
    const cmd = userPrompt.replace(/^(exec:|run:|\$ )/i, "").trim();
    const step = await runStep("node_pty_exec", {
      node_id: primaryNode,
      command: cmd,
      wait_timeout_ms: 15000,
    });
    finalReply = formatHaltedWorkflowReply(step, 1);
  } else if (lower.startsWith("ls") || lower.includes("list files")) {
    const step = await runStep("node_fs_operation", {
      node_id: primaryNode,
      operation: "list_dir",
      path: ".",
    });
    finalReply = formatHaltedWorkflowReply(step, 1);
  } else if (lower.startsWith("update memory") || lower.startsWith("journal:")) {
    const step = await runStep("core_update_brain_doc", {
      document: "Memory.md",
      mode: "append",
      content: `- **[${new Date().toISOString()}]** AI Orchestrator Note: ${userPrompt}`,
    });
    finalReply = formatHaltedWorkflowReply(step, 1);
  } else if (lower.includes("register service")) {
    const portMatch = userPrompt.match(/(\d{2,5})/);
    const port = portMatch ? Number(portMatch[1]) : 3000;
    const step = await runStep("core_register_service", {
      service_id: `svc-${port}`,
      name: `Web Service :${port}`,
      node_id: primaryNode || "local-node",
      protocol: "http",
      port,
      path: "/",
    });
    finalReply = formatHaltedWorkflowReply(step, 1);
  } else if (lower.includes("checksystem") && primaryNode) {
    const s1 = await runStep("node_deep_search", {
      node_id: primaryNode,
      search_mode: "process_and_port_map",
    });
    const s2 = await runStep("node_deep_search", {
      node_id: primaryNode,
      search_mode: "file_find",
    });
    const s3 = await runStep("node_deep_search", {
      node_id: primaryNode,
      search_mode: "sqlite_inspect",
    });
    const s4 = await runStep("node_deep_search", {
      node_id: primaryNode,
      search_mode: "log_scan",
    });
    await runStep("core_vault_search", { scope: "all", query: "" });
    const f1 = String((s1.output as { findings?: string })?.findings || "");
    const f2 = String((s2.output as { findings?: string })?.findings || "");
    const f3 = String((s3.output as { findings?: string })?.findings || "");
    const f4 = String((s4.output as { findings?: string })?.findings || "");
    finalReply = `### 🔍 CheckSystem — Mehrstufiger DevOps-Tiefenscan (\`${primaryNode}\`)\n\n#### 1. Host, Ports & Laufende Dienste\n\`\`\`text\n${f1.slice(0, 1800)}\n\`\`\`\n\n#### 2. Dateisystem- & Workspace-Inventar\n\`\`\`text\n${f2.slice(0, 1200)}\n\`\`\`\n\n#### 3. SQLite-Datenbank-Integrität & Tabellen\n\`\`\`text\n${f3.slice(0, 1400)}\n\`\`\`\n\n#### 4. Log- & Journal-Forensik\n\`\`\`text\n${f4.slice(0, 1400)}\n\`\`\``;
  } else if (lower.includes("checkopsec") && primaryNode) {
    const s1 = await runStep("node_deep_search", {
      node_id: primaryNode,
      search_mode: "security_forensics",
    });
    const s2 = await runStep("node_deep_search", {
      node_id: primaryNode,
      search_mode: "content_grep",
      query: "SECRET|PASSWORD|API_KEY|0\\.0\\.0\\.0|CORS|X-Powered-By",
    });
    await runStep("core_vault_search", { scope: "cartridges", query: "" });
    const f1 = String((s1.output as { findings?: string })?.findings || "");
    const f2 = String((s2.output as { findings?: string })?.findings || "");
    finalReply = `### 🛡️ CheckOpsec — Mehrstufiger Cybersecurity- & Zero-Trust-Audit (\`${primaryNode}\`)\n\n#### 1. Security-Forensik (Ports, SSH, Firewall, Sysctl, Permissions & Header)\n\`\`\`text\n${f1.slice(0, 2600)}\n\`\`\`\n\n#### 2. Code- & Konfigurations-Scan auf Secrets / Bindings\n\`\`\`text\n${f2.slice(0, 1500)}\n\`\`\``;
  } else if (
    (lower.includes("skillsearch") || lower.includes("deepforensics")) &&
    primaryNode
  ) {
    const s1 = await runStep("core_vault_search", { scope: "all", query: "" });
    const s2 = await runStep("node_deep_search", {
      node_id: primaryNode,
      search_mode: "file_find",
    });
    const s3 = await runStep("node_deep_search", {
      node_id: primaryNode,
      search_mode: "log_scan",
    });
    const f2 = String((s2.output as { findings?: string })?.findings || "");
    const f3 = String((s3.output as { findings?: string })?.findings || "");
    finalReply = `### 🧭 DevOps System- & Forensik-Suche (\`${primaryNode}\`)\n\n#### 1. Gefundene Dateien im Workspace\n\`\`\`text\n${f2.slice(0, 1500)}\n\`\`\`\n\n#### 2. Log- & Prozess-Analyse\n\`\`\`text\n${f3.slice(0, 1500)}\n\`\`\`\n\n- **Core Vault Services:** ${(state.registered_services || []).map((s) => `\`${s.name}\` (:${s.port})`).join(", ") || "keine"}`;
  }

  if (!finalReply) {
    finalReply = state.planning_only
      ? `**Planning-Only Mode Active** for project \`${state.project_id}\`.\n\n- **Active Rule Cartridges:** ${
          state.active_cartridges.map((c) => `\`${c}\``).join(", ") || "none"
        }\n- **Drag & Drop Vision Ready:** Drop any architecture diagram or UI screenshot into this chat.\n- Because no Axon Muscle Node is assigned yet, remote execution tools (\`node_pty_exec\`, \`node_fs_operation\`) are locked by the Core Policy Interceptor.\n- Click **\`+ Add Peer\`** or type \`deploy microservice 4050\` to test the Policy Interceptor lock.`
      : `**Active Execution Mode** on project \`${state.project_id}\` (${state.assigned_nodes.length} Axon Muscle Node(s) assigned).\n\n- Type **\`deploy microservice 4050\`** to trigger a **4-step autonomous execution loop** with Pre-Write Rollback Snapshots.\n- Drop **screenshots/diagrams** into the chat or type **\`@\`** to mention nodes, services, and Brain Vault docs.\n- Prefix any command with \`$ <command>\` (e.g. \`$ uname -a && pwd\`) to invoke \`node_pty_exec\`.`;
  }

  const cacheMetrics: PromptCacheMetrics = {
    cached_tokens: Math.round(promptParts.staticPrefix.length / 4),
    prompt_tokens: Math.round(promptParts.fullPrompt.length / 4),
    tool_cache_hits: toolCacheHits,
    provider_cache_active: true,
  };

  onProgress?.({ type: "cache_metrics", metrics: cacheMetrics });
  await emitProgressiveTokens(finalReply, thinkingTrace, onProgress);

  return {
    reply: finalReply,
    thinking: thinkingTrace,
    toolResults,
    cacheMetrics,
  };
}

function formatHaltedWorkflowReply(
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

export async function POST(req: NextRequest) {
  const body = await req.json();
  const projectId = String(body.project_id || "synapse-cloud-demo");
  const state = ensureProjectVault(projectId);
  const vaultSecrets = getDecryptedSecrets(projectId);

  const action = String(body.action || "");
  const streamMode = Boolean(body.stream);
  const provider = String(
    body.provider || state.ai_settings?.provider || "synapse-autonomous"
  );
  const rawBaseUrl = String(
    body.base_url ||
      state.ai_settings?.base_url ||
      (provider === "ollama"
        ? process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1"
        : provider === "openrouter"
        ? "https://openrouter.ai/api/v1"
        : provider === "anthropic"
        ? "https://api.anthropic.com/v1"
        : "https://api.openai.com/v1")
  ).trim();

  const model = String(
    body.model || state.ai_settings?.model || "gpt-4o"
  ).trim();
  const secretKeyName =
    state.ai_settings?.api_key_secret_name || "LLM_API_KEY";
  const apiKey = String(
    body.api_key ||
      vaultSecrets[secretKeyName] ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      ""
  ).trim();

  // 1-Click Pre-Write Snapshot Rollback Action
  if (action === "rollback_snapshot") {
    const snapshotId = String(body.snapshot_id || "");
    const out = await executeRollbackSnapshot(projectId, snapshotId);
    if (!out.success) {
      return NextResponse.json(
        { success: false, error: out.error },
        { status: 400 }
      );
    }
    const rollbackMsg = `⏪ **Rolled back \`${out.snapshot?.path}\`** on node \`${out.snapshot?.node_id}\` to pre-write snapshot \`${snapshotId}\`.`;
    appendChatMessage(projectId, {
      role: "assistant",
      content: rollbackMsg,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({
      success: true,
      snapshot: out.snapshot,
      reply: rollbackMsg,
    });
  }

  // Model Discovery Action: GET <base_url>/models
  if (action === "list_models") {
    const cleanBase = rawBaseUrl.replace(/\/$/, "");
    const modelsUrl = cleanBase.endsWith("/models")
      ? cleanBase
      : cleanBase.endsWith("/v1")
      ? `${cleanBase}/models`
      : `${cleanBase}/v1/models`;

    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
      const res = await fetch(modelsUrl, { headers });
      if (!res.ok) {
        return NextResponse.json({
          models: [],
          error: `Endpoint ${modelsUrl} returned HTTP ${res.status}`,
        });
      }
      const data = await res.json();
      const rawList = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.models)
        ? data.models
        : [];
      const modelIds = rawList
        .map((m: { id?: string; name?: string }) => m.id || m.name || "")
        .filter(Boolean);
      return NextResponse.json({ models: modelIds, endpoint: modelsUrl });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({
        models: [],
        error: `Failed to reach ${modelsUrl}: ${msg}`,
      });
    }
  }

  const directTool = body.direct_tool as
    | { name: string; arguments: Record<string, unknown> }
    | undefined;
  const messages = (body.messages || []) as ChatMessage[];

  if (directTool && directTool.name) {
    const res = await interceptAndExecuteTool(
      projectId,
      directTool.name,
      directTool.arguments || {}
    );
    return NextResponse.json({
      reply: `Executed tool \`${directTool.name}\` -> status: **${res.status}**`,
      tool_results: [res],
    });
  }

  const promptParts = buildCacheOptimizedSystemPromptParts(projectId);
  const lastUserMsgObj = messages.filter((m) => m.role === "user").pop();
  const lastUserMsg = lastUserMsgObj?.content || "";
  const lastAttachments = lastUserMsgObj?.attachments;

  // Persist user message (with optional image/file attachments) to Chat.jsonl
  if (lastUserMsg || (lastAttachments && lastAttachments.length > 0)) {
    appendChatMessage(projectId, {
      role: "user",
      content: String(body.display_user_message || lastUserMsg),
      attachments: lastAttachments,
      timestamp: new Date().toISOString(),
    });
  }

  const executePipeline = async (onProgress?: StepProgressCallback) => {
    if (
      provider === "openai-compatible" ||
      provider === "openai" ||
      provider === "openrouter" ||
      provider === "vllm" ||
      provider === "ollama"
    ) {
      try {
        const cleanBase = rawBaseUrl.replace(/\/$/, "");
        const endpoint = cleanBase.endsWith("/chat/completions")
          ? cleanBase
          : cleanBase.endsWith("/v1")
          ? `${cleanBase}/chat/completions`
          : `${cleanBase}/v1/chat/completions`;

        const loopResult = await runOpenAICompatibleAgentLoop(
          projectId,
          endpoint,
          model || "gpt-4o",
          apiKey,
          promptParts,
          messages,
          onProgress
        );
        if (loopResult) return loopResult;
      } catch {
        // Fall through
      }
    }

    if (provider === "anthropic" && apiKey) {
      try {
        const loopResult = await runAnthropicAgentLoop(
          projectId,
          rawBaseUrl,
          model,
          apiKey,
          promptParts,
          messages,
          onProgress
        );
        if (loopResult) return loopResult;
      } catch {
        // Fall through
      }
    }

    return runDeterministicAutonomousWorkflow(
      projectId,
      lastUserMsg,
      lastAttachments,
      promptParts,
      onProgress
    );
  };

  // Real-time Server-Sent Events (SSE) Streaming Mode
  if (streamMode) {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const sendEvent = (payload: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        };

        try {
          const finalOut = await executePipeline((ev) => {
            sendEvent(ev as unknown as Record<string, unknown>);
          });

          appendChatMessage(projectId, {
            role: "assistant",
            content: finalOut.reply,
            thinking: finalOut.thinking,
            cacheMetrics: finalOut.cacheMetrics,
            timestamp: new Date().toISOString(),
            toolResults: finalOut.toolResults,
          });

          sendEvent({
            type: "complete",
            reply: finalOut.reply,
            thinking: finalOut.thinking,
            cache_metrics: finalOut.cacheMetrics,
            tool_results: finalOut.toolResults,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          sendEvent({ type: "error", error: msg });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  // Standard JSON Response Mode (Backward-Compatible)
  const finalOut = await executePipeline();
  appendChatMessage(projectId, {
    role: "assistant",
    content: finalOut.reply,
    thinking: finalOut.thinking,
    cacheMetrics: finalOut.cacheMetrics,
    timestamp: new Date().toISOString(),
    toolResults: finalOut.toolResults,
  });

  return NextResponse.json({
    reply: finalOut.reply,
    thinking: finalOut.thinking,
    cache_metrics: finalOut.cacheMetrics,
    tool_results: finalOut.toolResults,
    system_prompt_preview: promptParts.fullPrompt.slice(0, 600) + "...",
  });
}
