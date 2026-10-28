import {
  interceptAndExecuteTool,
  SYNAPSE_TOOL_SCHEMAS,
  type ToolDispatchResult,
} from "@/lib/orchestrator";
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

const MAX_AGENT_ITERATIONS = 30;

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

/**
 * Formats a user message with optional Drag & Drop Vision attachments for OpenAI-compatible Vision APIs.
 */
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

/**
 * Formats a user message with optional Drag & Drop Vision attachments for Anthropic Claude Vision APIs.
 */
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

/**
 * Extracts `<think>...</think>` blocks if returned by reasoning models (DeepSeek-R1, QwQ, etc.)
 */
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

/**
 * Streams tokens from an already-completed string in fast micro-chunks when an upstream API returns non-SSE JSON,
 * so the UI always renders smooth live token streaming.
 */
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

export async function runOpenAICompatibleAgentLoop(
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
  onProgress?: StepProgressCallback,
  abortSignal?: AbortSignal
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
    if (abortSignal?.aborted) break;

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
      if (abortSignal?.aborted) break;
      try {
        const llmRes = await fetch(endpoint, {
          method: "POST",
          headers,
          signal: abortSignal,
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
      if (attempt === 0 && !abortSignal?.aborted) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    if (!completion) {
      if (allToolResults.length > 0) {
        break;
      }
      return null;
    }

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

    const toolCalls = choice.tool_calls as
      | Array<{
          id?: string;
          function?: { name?: string; arguments?: string };
        }>
      | undefined;
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

    if (!hasToolCalls || !toolCalls) {
      break;
    }

    conversation.push(choice);
    let haltedByInterceptor = false;

    for (const tc of toolCalls) {
      if (abortSignal?.aborted) {
        haltedByInterceptor = true;
        break;
      }
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

  if (!finalReply && allToolResults.length > 0 && !abortSignal?.aborted) {
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
        signal: abortSignal,
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
          return `#### ${userLang === "en" ? "Step" : "Schritt"} ${
            i + 1
          }: \`${tr.tool_name}\` (${tr.status})\n\`\`\`text\n${textOut}\n\`\`\``;
        })
        .join("\n\n");

  await emitProgressiveTokens(resolvedReply, "", onProgress);

  return {
    reply: resolvedReply,
    thinking: accumulatedThinking.trim() || undefined,
    toolResults: allToolResults,
    cacheMetrics,
  };
}

export async function runAnthropicAgentLoop(
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
  onProgress?: StepProgressCallback,
  abortSignal?: AbortSignal
): Promise<{
  reply: string;
  thinking?: string;
  toolResults: ToolDispatchResult[];
  cacheMetrics: PromptCacheMetrics;
} | null> {
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
    if (abortSignal?.aborted) break;

    const anthRes = await fetch(messagesEndpoint, {
      method: "POST",
      signal: abortSignal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify({
        model: model.startsWith("claude") ? model : "claude-3-5-sonnet-latest",
        max_tokens: 2048,
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
      if (abortSignal?.aborted) {
        haltedByInterceptor = true;
        break;
      }
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

  await emitProgressiveTokens(resolvedReply, "", onProgress);

  return {
    reply: resolvedReply,
    thinking: accumulatedThinking.trim() || undefined,
    toolResults: allToolResults,
    cacheMetrics,
  };
}
