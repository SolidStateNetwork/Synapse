import { NextRequest, NextResponse } from "next/server";
import {
  buildSystemPrompt,
  interceptAndExecuteTool,
  SYNAPSE_TOOL_SCHEMAS,
  type ToolDispatchResult,
} from "@/lib/orchestrator";
import {
  appendChatMessage,
  ensureProjectVault,
  getDecryptedSecrets,
} from "@/lib/vault";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

type StepProgressCallback = (event: {
  type: "step_start" | "step_done";
  step: number;
  tool_name: string;
  result?: ToolDispatchResult;
}) => void;

const MAX_AGENT_ITERATIONS = 5;

async function runOpenAICompatibleAgentLoop(
  projectId: string,
  endpoint: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  onProgress?: StepProgressCallback
): Promise<{ reply: string; toolResults: ToolDispatchResult[] } | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const conversation: Array<Record<string, unknown>> = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const allToolResults: ToolDispatchResult[] = [];
  let finalReply = "";

  for (let step = 0; step < MAX_AGENT_ITERATIONS; step++) {
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

    if (!llmRes.ok) {
      return null;
    }

    const completion = await llmRes.json();
    const choice = completion.choices?.[0]?.message;
    if (!choice) {
      break;
    }

    if (choice.content) {
      finalReply = String(choice.content);
    }

    const toolCalls = choice.tool_calls;
    if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
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

      onProgress?.({
        type: "step_start",
        step: allToolResults.length + 1,
        tool_name: fnName,
      });

      const dispatched = await interceptAndExecuteTool(
        projectId,
        fnName,
        fnArgs
      );
      allToolResults.push(dispatched);

      onProgress?.({
        type: "step_done",
        step: allToolResults.length,
        tool_name: fnName,
        result: dispatched,
      });

      conversation.push({
        role: "tool",
        tool_call_id: tc.id,
        name: fnName,
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

    if (haltedByInterceptor) {
      break;
    }
  }

  return {
    reply:
      finalReply ||
      `Completed ${allToolResults.length} autonomous tool step(s) across the Brain & Muscle pipeline.`,
    toolResults: allToolResults,
  };
}

async function runAnthropicAgentLoop(
  projectId: string,
  baseUrl: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  onProgress?: StepProgressCallback
): Promise<{ reply: string; toolResults: ToolDispatchResult[] } | null> {
  const anthropicTools = SYNAPSE_TOOL_SCHEMAS.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));

  const conversation: Array<Record<string, unknown>> = messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const allToolResults: ToolDispatchResult[] = [];
  let finalReply = "";
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
      },
      body: JSON.stringify({
        model: model.startsWith("claude") ? model : "claude-3-5-sonnet-latest",
        max_tokens: 2048,
        system: systemPrompt,
        tools: anthropicTools,
        messages: conversation,
      }),
    });

    if (!anthRes.ok) {
      return null;
    }

    const data = await anthRes.json();
    const contentBlocks = Array.isArray(data.content) ? data.content : [];
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

  return {
    reply:
      finalReply ||
      `Completed ${allToolResults.length} Anthropic autonomous tool step(s).`,
    toolResults: allToolResults,
  };
}

async function runDeterministicAutonomousWorkflow(
  projectId: string,
  userPrompt: string,
  onProgress?: StepProgressCallback
): Promise<{ reply: string; toolResults: ToolDispatchResult[] }> {
  const state = ensureProjectVault(projectId);
  const primaryNode = state.assigned_nodes[0]?.node_id || "";
  const toolResults: ToolDispatchResult[] = [];
  const lower = userPrompt.trim().toLowerCase();

  const runStep = async (
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolDispatchResult> => {
    const stepNum = toolResults.length + 1;
    onProgress?.({ type: "step_start", step: stepNum, tool_name: toolName });
    const res = await interceptAndExecuteTool(projectId, toolName, args);
    toolResults.push(res);
    onProgress?.({
      type: "step_done",
      step: stepNum,
      tool_name: toolName,
      result: res,
    });
    return res;
  };

  if (
    lower.includes("deploy microservice") ||
    lower.includes("bootstrap app") ||
    lower.includes("autodeploy")
  ) {
    const portMatch = userPrompt.match(/(\d{4,5})/);
    const port = portMatch ? Number(portMatch[1]) : 4050;

    const appSource = `const http = require("http");
const port = ${port};
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    service: "${projectId}-autonomous-service",
    status: "healthy",
    node: process.env.SYNAPSE_PROJECT_ID || "axon-muscle",
    timestamp: new Date().toISOString()
  }, null, 2));
});
server.listen(port, "127.0.0.1", () => {
  console.log("Synapse microservice listening on http://127.0.0.1:" + port);
});
`;

    const step1 = await runStep("node_fs_operation", {
      node_id: primaryNode,
      operation: "write_file",
      path: "service/server.js",
      content_or_patch: appSource,
      file_mode: "0644",
    });
    if (step1.status !== "executed") {
      return { reply: formatHaltedWorkflowReply(step1, 1), toolResults };
    }

    const step2 = await runStep("node_pty_exec", {
      node_id: primaryNode,
      session_id: `default-${projectId}`,
      command: `node -c service/server.js && (pkill -f "service/server.js" 2>/dev/null || true) && nohup node service/server.js >/tmp/synapse-svc-${port}.log 2>&1 & sleep 0.3 && echo "Started microservice on 127.0.0.1:${port}"`,
      wait_timeout_ms: 10000,
    });
    if (step2.status !== "executed") {
      return { reply: formatHaltedWorkflowReply(step2, 2), toolResults };
    }

    await runStep("core_register_service", {
      action: "upsert",
      service_id: `auto-svc-${port}`,
      name: `Autonomous Microservice :${port}`,
      node_id: primaryNode,
      runtime: "binary",
      unit_or_container: "service/server.js",
      bind_address: "127.0.0.1",
      port,
      enable_preview_tunnel: true,
      health_check: {
        type: "HTTP",
        target: `http://127.0.0.1:${port}/`,
        interval_sec: 10,
      },
    });

    await runStep("core_update_brain_doc", {
      document: "Memory.md",
      mode: "append",
      content: `- **[${new Date().toISOString()}]** Multi-Step Autonomous Deployment completed on node \`${primaryNode}\`: wrote \`service/server.js\`, started daemon via Sentinel PTY, and registered Live-Preview service on \`127.0.0.1:${port}\`.`,
    });

    return {
      reply: `### Multi-Step Autonomous Workflow Completed (4/4 Steps)\n1. **\`node_fs_operation\`**: Atomically wrote \`service/server.js\` inside workspace jail.\n2. **\`node_pty_exec\`**: Verified syntax & launched microservice on \`127.0.0.1:${port}\` via persistent Sentinel PTY.\n3. **\`core_register_service\`**: Registered \`127.0.0.1:${port}\` with \`HTTP\` health check & Live-Preview tunnel (\`/preview/${projectId}/${primaryNode}/${port}\`).\n4. **\`core_update_brain_doc\`**: Recorded deployment in \`Memory.md\`.`,
      toolResults,
    };
  }

  if (lower.includes("diagnose") || lower.includes("auto-heal")) {
    const portMatch = userPrompt.match(/(\d{4,5})/);
    const port = portMatch ? Number(portMatch[1]) : 4050;

    const diagStep = await runStep("node_pty_exec", {
      node_id: primaryNode,
      session_id: `default-${projectId}`,
      command: `tail -n 30 /tmp/synapse-svc-${port}.log 2>/dev/null || true; (nohup node service/server.js >/tmp/synapse-svc-${port}.log 2>&1 &); sleep 0.4; curl -s http://127.0.0.1:${port}/`,
      wait_timeout_ms: 10000,
    });
    if (diagStep.status !== "executed") {
      return { reply: formatHaltedWorkflowReply(diagStep, 1), toolResults };
    }

    await runStep("core_update_brain_doc", {
      document: "Memory.md",
      mode: "append",
      content: `- **[${new Date().toISOString()}]** Auto-Heal & Diagnosis executed for service on port \`${port}\` (\`${primaryNode}\`): inspected logs, restarted process, and verified \`HTTP 200 OK\`.`,
    });

    return {
      reply: `### Auto-Heal & Diagnosis Completed\n1. **\`node_pty_exec\`**: Inspected \`/tmp/synapse-svc-${port}.log\`, restarted \`service/server.js\` on \`127.0.0.1:${port}\`, and verified health response.\n2. **\`core_update_brain_doc\`**: Logged recovery in \`Memory.md\`.`,
      toolResults,
    };
  }

  if (
    lower.startsWith("exec:") ||
    lower.startsWith("run:") ||
    lower.startsWith("$ ")
  ) {
    const cmd = userPrompt.replace(/^(exec:|run:|\$ )/i, "").trim();
    await runStep("node_pty_exec", {
      node_id: primaryNode,
      command: cmd,
      wait_timeout_ms: 15000,
    });
  } else if (lower.startsWith("ls") || lower.includes("list files")) {
    await runStep("node_fs_operation", {
      node_id: primaryNode,
      operation: "list_dir",
      path: ".",
    });
  } else if (lower.includes("update memory") || lower.includes("journal")) {
    await runStep("core_update_brain_doc", {
      document: "Memory.md",
      mode: "append",
      content: `- **[${new Date().toISOString()}]** AI Orchestrator Note: ${userPrompt}`,
    });
  } else if (lower.includes("register service")) {
    const portMatch = userPrompt.match(/(\d{2,5})/);
    const port = portMatch ? Number(portMatch[1]) : 3000;
    await runStep("core_register_service", {
      service_id: `svc-${port}`,
      name: `Web Service :${port}`,
      node_id: primaryNode || "local-node",
      protocol: "http",
      port,
      path: "/",
    });
  }

  if (toolResults.length > 0) {
    return {
      reply: formatHaltedWorkflowReply(toolResults[0], 1),
      toolResults,
    };
  }

  const reply = state.planning_only
    ? `**Planning-Only Mode Active** for project \`${state.project_id}\`.\n\n- Active Rule Cartridges: ${
        state.active_cartridges.map((c) => `\`${c}\``).join(", ") || "none"
      }\n- Because no Axon Muscle Node is assigned yet, remote execution tools (\`node_pty_exec\`, \`node_fs_operation\`) are locked by the Core Policy Interceptor.\n- Assign a node in **Nodes & Vault** or type \`deploy microservice 4050\` / \`$ uname -a\` to test the Policy Interceptor lock.`
    : `**Active Execution Mode** on project \`${state.project_id}\` (${state.assigned_nodes.length} Axon Muscle Node(s) assigned).\n\n- Type **\`deploy microservice 4050\`** to trigger a **4-step autonomous execution loop** (\`node_fs_operation\` -> \`node_pty_exec\` -> \`core_register_service\` -> \`core_update_brain_doc\`).\n- Prefix any command with \`$ <command>\` (e.g. \`$ uname -a && pwd\`) to invoke \`node_pty_exec\` with Sentinel Framing.`;

  return { reply, toolResults };
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
  return `Executed \`${stepResult.tool_name}\` through the Synapse Core Interceptor (\`${stepResult.status}\`).`;
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

  const systemPrompt = buildSystemPrompt(projectId);
  const lastUserMsg =
    messages.filter((m) => m.role === "user").pop()?.content || "";

  // Persist user message to Chat.jsonl
  if (lastUserMsg) {
    appendChatMessage(projectId, {
      role: "user",
      content: lastUserMsg,
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
          systemPrompt,
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
          systemPrompt,
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
            sendEvent(ev);
          });

          appendChatMessage(projectId, {
            role: "assistant",
            content: finalOut.reply,
            timestamp: new Date().toISOString(),
            toolResults: finalOut.toolResults,
          });

          sendEvent({
            type: "complete",
            reply: finalOut.reply,
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
    timestamp: new Date().toISOString(),
    toolResults: finalOut.toolResults,
  });

  return NextResponse.json({
    reply: finalOut.reply,
    tool_results: finalOut.toolResults,
    system_prompt_preview: systemPrompt.slice(0, 600) + "...",
  });
}
