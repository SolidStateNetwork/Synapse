import { NextRequest, NextResponse } from "next/server";
import {
  buildCacheOptimizedSystemPromptParts,
  executeRollbackSnapshot,
  interceptAndExecuteTool,
} from "@/lib/orchestrator";
import {
  runAnthropicAgentLoop,
  runOpenAICompatibleAgentLoop,
  type ChatMessage,
  type OrchestratorStreamEvent,
  type StepProgressCallback,
} from "@/lib/orchestrator/llmProviders";
import { runDeterministicAutonomousWorkflow } from "@/lib/orchestrator/autonomousFallback";
import {
  appendChatMessage,
  ensureProjectVault,
  getDecryptedSecrets,
} from "@/lib/vault";
import {
  resolveActiveProjectId,
  safeParseRequestJson,
} from "@/lib/runtimeResolver";

export type { OrchestratorStreamEvent };

export async function POST(req: NextRequest) {
  const body = await safeParseRequestJson(req);
  const projectId = resolveActiveProjectId(
    String(body.project_id || body.projectId || "")
  );
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
      const res = await fetch(modelsUrl, {
        headers,
        signal: req.signal,
      });
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

  const directTool = (body.direct_tool || body.tool_call) as
    | { name: string; arguments: Record<string, unknown> }
    | undefined;
  const rawMessages = Array.isArray(body.messages)
    ? (body.messages as ChatMessage[])
    : [];
  const fallbackSinglePrompt = String(
    body.prompt || body.message || ""
  ).trim();
  const messages: ChatMessage[] =
    rawMessages.length > 0
      ? rawMessages
      : fallbackSinglePrompt
      ? [{ role: "user", content: fallbackSinglePrompt }]
      : [];

  if (directTool && directTool.name) {
    const res = await interceptAndExecuteTool(
      projectId,
      directTool.name,
      directTool.arguments || {}
    );
    return NextResponse.json({
      reply: `Executed tool \`${directTool.name}\` -> status: **${res.status}**`,
      tool_results: [res],
      execution: res,
      result: res,
    });
  }

  const promptParts = buildCacheOptimizedSystemPromptParts(projectId);
  const lastUserMsgObj = messages.filter((m) => m.role === "user").pop();
  const lastUserMsg = lastUserMsgObj?.content || "";
  const lastAttachments = lastUserMsgObj?.attachments;

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
          onProgress,
          req.signal
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
          onProgress,
          req.signal
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

  if (streamMode) {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let closed = false;
        const sendEvent = (payload: Record<string, unknown>) => {
          if (closed || req.signal?.aborted) return;
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
            );
          } catch {
            closed = true;
          }
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
          if (!closed) {
            closed = true;
            try {
              controller.close();
            } catch {
              // ignore if already closed
            }
          }
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
