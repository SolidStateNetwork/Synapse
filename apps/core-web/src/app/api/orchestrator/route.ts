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

export async function POST(req: NextRequest) {
  const body = await req.json();
  const projectId = String(body.project_id || "synapse-cloud-demo");
  const provider = String(body.provider || "synapse-autonomous"); // openai, anthropic, ollama, or synapse-autonomous
  const model = String(body.model || "gpt-4o");
  const apiKey = String(body.api_key || process.env.OPENAI_API_KEY || "");
  const ollamaUrl = String(
    body.ollama_url || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
  );
  const directTool = body.direct_tool as
    | { name: string; arguments: Record<string, unknown> }
    | undefined;
  const messages = (body.messages || []) as ChatMessage[];

  // 1. Direct deterministic tool invocation from WebUI or Orchestrator
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

  // 2. OpenAI / Ollama Compatible Tool-Calling Provider
  if ((provider === "openai" && apiKey) || provider === "ollama") {
    try {
      const endpoint =
        provider === "ollama"
          ? `${ollamaUrl.replace(/\/$/, "")}/v1/chat/completions`
          : "https://api.openai.com/v1/chat/completions";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const llmRes = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: provider === "ollama" ? model || "llama3.1" : model,
          messages: [
            { role: "system", content: systemPrompt },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
          ],
          tools: SYNAPSE_TOOL_SCHEMAS,
          tool_choice: "auto",
        }),
      });

      if (llmRes.ok) {
        const completion = await llmRes.json();
        const choice = completion.choices?.[0]?.message;
        const toolResults: ToolDispatchResult[] = [];

        if (choice?.tool_calls && Array.isArray(choice.tool_calls)) {
          for (const tc of choice.tool_calls) {
            const fnName = tc.function?.name;
            let fnArgs: Record<string, unknown> = {};
            try {
              fnArgs = JSON.parse(tc.function?.arguments || "{}");
            } catch {
              fnArgs = {};
            }
            if (fnName) {
              const dispatched = await interceptAndExecuteTool(
                projectId,
                fnName,
                fnArgs
              );
              toolResults.push(dispatched);
            }
          }
        }

        return NextResponse.json({
          reply:
            choice?.content ||
            `Dispatched ${toolResults.length} Synapse tool call(s) via Policy Interceptor.`,
          tool_results: toolResults,
        });
      }
    } catch {
      // Fall back to deterministic built-in Synapse Autonomous Orchestrator if offline
    }
  }

  // 3. Anthropic Compatible Provider
  if (provider === "anthropic" && (apiKey || process.env.ANTHROPIC_API_KEY)) {
    try {
      const key = apiKey || process.env.ANTHROPIC_API_KEY || "";
      const anthRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: model.startsWith("claude")
            ? model
            : "claude-3-5-sonnet-latest",
          max_tokens: 2048,
          system: systemPrompt,
          messages: messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        }),
      });
      if (anthRes.ok) {
        const data = await anthRes.json();
        const textBlock = data.content?.find(
          (b: { type: string }) => b.type === "text"
        );
        return NextResponse.json({
          reply: textBlock?.text || "Anthropic response received.",
          tool_results: [],
        });
      }
    } catch {
      // Fall back to deterministic orchestrator
    }
  }

  // 4. Built-in Deterministic Synapse Autonomous Agent (handles natural commands & slash-like intents out-of-the-box)
  const state = ensureProjectVault(projectId);
  const primaryNode = state.assigned_nodes[0]?.node_id || "";
  const toolResults: ToolDispatchResult[] = [];
  const lower = lastUserMsg.trim().toLowerCase();

  if (
    lower.startsWith("exec:") ||
    lower.startsWith("run:") ||
    lower.startsWith("$ ")
  ) {
    const cmd = lastUserMsg.replace(/^(exec:|run:|\$ )/i, "").trim();
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
        content: `- **[${new Date().toISOString()}]** AI Orchestrator Note: ${lastUserMsg}`,
      }
    );
    toolResults.push(res);
  } else if (lower.includes("register service")) {
    const portMatch = lastUserMsg.match(/(\d{2,5})/);
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

  let reply = "";
  if (toolResults.length > 0) {
    const first = toolResults[0];
    if (first.status === "blocked_planning_mode") {
      reply =
        "**Planning-Only Mode Enforced:** This project currently has zero assigned Axon Muscle Nodes. I can update `Architecture.md`, `Memory.md`, and `Secrets.enc` on the Brain, but remote execution (`node_pty_exec`, `node_fs_operation`) is locked until you enroll or assign a node.";
    } else if (first.status === "paused_tier3") {
      reply = `**Policy Interceptor Pause (\`TIER_3_SUPERVISED\`):** Tool \`${first.tool_name}\` has been queued as Approval \`${first.approval_id}\`. Approve or reject it below to continue.`;
    } else {
      reply = `Executed \`${first.tool_name}\` through the Synapse Core Interceptor (\`${first.status}\`).`;
    }
  } else {
    reply = state.planning_only
      ? `**Planning-Only Mode Active** for project \`${state.project_id}\`.\n\n- Active Rule Cartridges: ${
          state.active_cartridges.map((c) => `\`${c}\``).join(", ") || "none"
        }\n- Because no Axon Muscle Node is assigned yet, remote execution tools (\`node_pty_exec\`, \`node_fs_operation\`) are locked by the Core Policy Interceptor.\n- Tip: Assign a node in the **Nodes & Enrollment** panel or prefix commands with \`$ <command>\` to test the Policy Interceptor lock.`
      : `**Active Execution Mode** on project \`${state.project_id}\` (${state.assigned_nodes.length} Axon Muscle Node(s) assigned).\n\n- Prefix any message with \`$ <command>\` (e.g. \`$ uname -a && pwd\`) to invoke \`node_pty_exec\` with Sentinel Framing.\n- Say \`list files\` to invoke \`node_fs_operation (list_dir)\`, or \`register service 8080\` to register a Live-Preview port.`;
  }

  return NextResponse.json({
    reply,
    tool_results: toolResults,
    system_prompt_preview: systemPrompt.slice(0, 600) + "...",
  });
}
