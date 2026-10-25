import { NextRequest, NextResponse } from "next/server";
import {
  buildSystemPrompt,
  interceptAndExecuteTool,
  SYNAPSE_TOOL_SCHEMAS,
  type ToolDispatchResult,
} from "@/lib/orchestrator";
import { ensureProjectVault } from "@/lib/vault";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const MAX_AGENT_ITERATIONS = 5;

/**
 * Multi-Turn ReAct Tool Loop for OpenAI & Ollama compatible endpoints.
 * Feeds tool execution outputs back into the LLM until a final synthesis message is produced
 * or a Policy Interceptor gate (Planning-Only lock / TIER_3_SUPERVISED pause) halts execution.
 */
async function runOpenAICompatibleAgentLoop(
  projectId: string,
  endpoint: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[]
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
      // Model finished its reasoning loop
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

      const dispatched = await interceptAndExecuteTool(
        projectId,
        fnName,
        fnArgs
      );
      allToolResults.push(dispatched);

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

/**
 * Multi-Turn ReAct Tool Loop for Anthropic Messages API (`tool_use` + `tool_result`).
 */
async function runAnthropicAgentLoop(
  projectId: string,
  model: string,
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[]
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

  for (let step = 0; step < MAX_AGENT_ITERATIONS; step++) {
    const anthRes = await fetch("https://api.anthropic.com/v1/messages", {
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
      const dispatched = await interceptAndExecuteTool(
        projectId,
        String(tu.name || ""),
        (tu.input as Record<string, unknown>) || {}
      );
      allToolResults.push(dispatched);
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

/**
 * Built-in Deterministic Multi-Step Autonomous Workflow Engine:
 * Executes end-to-end multi-tool sequences (FS write -> Sentinel PTY -> Service Registration -> Brain Vault update)
 * without requiring external cloud API keys.
 */
async function runDeterministicAutonomousWorkflow(
  projectId: string,
  userPrompt: string
): Promise<{ reply: string; toolResults: ToolDispatchResult[] }> {
  const state = ensureProjectVault(projectId);
  const primaryNode = state.assigned_nodes[0]?.node_id || "";
  const toolResults: ToolDispatchResult[] = [];
  const lower = userPrompt.trim().toLowerCase();

  // Multi-Step Autonomous Playbook: "deploy microservice" / "bootstrap app" / "autodeploy"
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

    // Step 1: Atomic FS Write (`node_fs_operation`)
    const step1 = await interceptAndExecuteTool(
      projectId,
      "node_fs_operation",
      {
        node_id: primaryNode,
        operation: "write_file",
        path: "service/server.js",
        content: appSource,
      }
    );
    toolResults.push(step1);
    if (step1.status !== "executed") {
      return {
        reply: formatHaltedWorkflowReply(step1, 1),
        toolResults,
      };
    }

    // Step 2: Persistent Stateful PTY Verification (`node_pty_exec`)
    const step2 = await interceptAndExecuteTool(projectId, "node_pty_exec", {
      node_id: primaryNode,
      command: `ls -lh service/server.js && node -c service/server.js && echo "Syntax verified on $(hostname) in $(pwd)"`,
      wait_timeout_ms: 10000,
    });
    toolResults.push(step2);
    if (step2.status !== "executed") {
      return {
        reply: formatHaltedWorkflowReply(step2, 2),
        toolResults,
      };
    }

    // Step 3: Register Service Port for 5s Health Checks & Live-Preview Proxy (`core_register_service`)
    const step3 = await interceptAndExecuteTool(
      projectId,
      "core_register_service",
      {
        service_id: `auto-svc-${port}`,
        name: `Autonomous Microservice :${port}`,
        node_id: primaryNode,
        protocol: "http",
        port,
        path: "/",
      }
    );
    toolResults.push(step3);

    // Step 4: Update Architecture.md & Memory.md in Brain Vault (`core_update_brain_doc`)
    const step4 = await interceptAndExecuteTool(
      projectId,
      "core_update_brain_doc",
      {
        document: "Memory.md",
        mode: "append",
        content: `- **[${new Date().toISOString()}]** Multi-Step Autonomous Deployment completed on node \`${primaryNode}\`: wrote \`service/server.js\`, verified syntax via Sentinel PTY, and registered Live-Preview service on \`127.0.0.1:${port}\`.`,
      }
    );
    toolResults.push(step4);

    return {
      reply: `### Multi-Step Autonomous Workflow Completed (4/4 Steps)\n1. **\`node_fs_operation\`**: Atomically wrote \`service/server.js\` inside workspace jail.\n2. **\`node_pty_exec\`**: Verified syntax & workspace state via persistent Sentinel PTY.\n3. **\`core_register_service\`**: Registered \`127.0.0.1:${port}\` for 5s health checks & Live-Preview (\`/preview/${projectId}/${primaryNode}/${port}\`).\n4. **\`core_update_brain_doc\`**: Recorded deployment in \`Memory.md\`.`,
      toolResults,
    };
  }

  // Single-step deterministic commands
  if (
    lower.startsWith("exec:") ||
    lower.startsWith("run:") ||
    lower.startsWith("$ ")
  ) {
    const cmd = userPrompt.replace(/^(exec:|run:|\$ )/i, "").trim();
    const res = await interceptAndExecuteTool(projectId, "node_pty_exec", {
      node_id: primaryNode,
      command: cmd,
      wait_timeout_ms: 15000,
    });
    toolResults.push(res);
  } else if (lower.startsWith("ls") || lower.includes("list files")) {
    const res = await interceptAndExecuteTool(projectId, "node_fs_operation", {
      node_id: primaryNode,
      operation: "list_dir",
      path: ".",
    });
    toolResults.push(res);
  } else if (lower.includes("update memory") || lower.includes("journal")) {
    const res = await interceptAndExecuteTool(
      projectId,
      "core_update_brain_doc",
      {
        document: "Memory.md",
        mode: "append",
        content: `- **[${new Date().toISOString()}]** AI Orchestrator Note: ${userPrompt}`,
      }
    );
    toolResults.push(res);
  } else if (lower.includes("register service")) {
    const portMatch = userPrompt.match(/(\d{2,5})/);
    const port = portMatch ? Number(portMatch[1]) : 3000;
    const res = await interceptAndExecuteTool(
      projectId,
      "core_register_service",
      {
        service_id: `svc-${port}`,
        name: `Web Service :${port}`,
        node_id: primaryNode || "local-node",
        protocol: "http",
        port,
        path: "/",
      }
    );
    toolResults.push(res);
  }

  if (toolResults.length > 0) {
    const first = toolResults[0];
    return {
      reply: formatHaltedWorkflowReply(first, 1),
      toolResults,
    };
  }

  const reply = state.planning_only
    ? `**Planning-Only Mode Active** for project \`${state.project_id}\`.\n\n- Active Rule Cartridges: ${
        state.active_cartridges.map((c) => `\`${c}\``).join(", ") || "none"
      }\n- Because no Axon Muscle Node is assigned yet, remote execution tools (\`node_pty_exec\`, \`node_fs_operation\`) are locked by the Core Policy Interceptor.\n- Assign a node in **Axon Nodes & PKI** or type \`deploy microservice 4050\` / \`$ uname -a\` to test the Policy Interceptor lock.`
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
  const provider = String(body.provider || "synapse-autonomous");
  const model = String(body.model || "gpt-4o");
  const apiKey = String(body.api_key || process.env.OPENAI_API_KEY || "");
  const ollamaUrl = String(
    body.ollama_url || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
  );
  const directTool = body.direct_tool as
    | { name: string; arguments: Record<string, unknown> }
    | undefined;
  const messages = (body.messages || []) as ChatMessage[];

  // 1. Direct deterministic tool invocation from WebUI quick-dispatch
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

  // 2. Multi-Turn OpenAI / Ollama Tool-Calling Loop
  if ((provider === "openai" && apiKey) || provider === "ollama") {
    try {
      const endpoint =
        provider === "ollama"
          ? `${ollamaUrl.replace(/\/$/, "")}/v1/chat/completions`
          : "https://api.openai.com/v1/chat/completions";
      const loopResult = await runOpenAICompatibleAgentLoop(
        projectId,
        endpoint,
        provider === "ollama" ? model || "llama3.1" : model,
        apiKey,
        systemPrompt,
        messages
      );
      if (loopResult) {
        return NextResponse.json({
          reply: loopResult.reply,
          tool_results: loopResult.toolResults,
        });
      }
    } catch {
      // Fall back to deterministic autonomous workflow engine
    }
  }

  // 3. Multi-Turn Anthropic Claude Tool-Calling Loop
  if (provider === "anthropic" && (apiKey || process.env.ANTHROPIC_API_KEY)) {
    try {
      const key = apiKey || process.env.ANTHROPIC_API_KEY || "";
      const loopResult = await runAnthropicAgentLoop(
        projectId,
        model,
        key,
        systemPrompt,
        messages
      );
      if (loopResult) {
        return NextResponse.json({
          reply: loopResult.reply,
          tool_results: loopResult.toolResults,
        });
      }
    } catch {
      // Fall back to deterministic autonomous workflow engine
    }
  }

  // 4. Built-in Deterministic Multi-Step Autonomous Workflow Engine
  const autoResult = await runDeterministicAutonomousWorkflow(
    projectId,
    lastUserMsg
  );
  return NextResponse.json({
    reply: autoResult.reply,
    tool_results: autoResult.toolResults,
    system_prompt_preview: systemPrompt.slice(0, 600) + "...",
  });
}
