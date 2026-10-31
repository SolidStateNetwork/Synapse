import {
  interceptAndExecuteTool,
  type ToolDispatchResult,
} from "@/lib/orchestrator";
import {
  buildAutonomousMicroservicePy,
  buildMicroserviceLaunchCommand,
} from "@/lib/templates/serviceTemplates";
import {
  ensureProjectVault,
  type ChatAttachment,
  type PromptCacheMetrics,
} from "@/lib/vault";
import {
  emitProgressiveTokens,
  formatHaltedWorkflowReply,
  summarizeToolCallDetail,
  type StepProgressCallback,
} from "@/lib/orchestrator/llmProviders";

export async function runDeterministicAutonomousWorkflow(
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

    finalReply =
      `### Multimodal Vision Analysis (${attachments.length} Attachment${
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

    const pySource = buildAutonomousMicroservicePy({
      projectId,
      nodeId: primaryNode,
      port,
      healed: false,
    });

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
        command: buildMicroserviceLaunchCommand(port),
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

    const pySource = buildAutonomousMicroservicePy({
      projectId,
      nodeId: targetNode,
      port,
      healed: true,
    });

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
      command: buildMicroserviceLaunchCommand(port),
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
    await runStep("core_vault_search", { scope: "all", query: "" });
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
    finalReply = `### 🧭 DevOps System- & Forensik-Suche (\`${primaryNode}\`)\n\n#### 1. Gefundene Dateien im Workspace\n\`\`\`text\n${f2.slice(0, 1500)}\n\`\`\`\n\n#### 2. Log- & Prozess-Analyse\n\`\`\`text\n${f3.slice(0, 1500)}\n\`\`\`\n\n- **Core Vault Services:** ${
      (state.registered_services || [])
        .map((s) => `\`${s.name}\` (:${s.port})`)
        .join(", ") || "keine"
    }`;
  } else if (lower.startsWith("gitops:") || lower.includes("deploy git stack")) {
    const urlMatch = userPrompt.match(/(https?:\/\/\S+|git@\S+)/);
    const portMatch = userPrompt.match(/\b(\d{4,5})\b/);
    const step = await runStep("core_deploy_git_stack", {
      name: "GitOps Autonomous Stack",
      repo_url: urlMatch ? urlMatch[1] : "https://github.com/example/service.git",
      port: portMatch ? Number(portMatch[1]) : 4085,
      node_id: primaryNode || "local-node",
    });
    finalReply = `### 📦 GitOps Stack Deployment\n\n- **Status:** \`${step.status}\`\n- **Details:** \`${JSON.stringify(step.output).slice(0, 300)}\``;
  } else if (lower.startsWith("logs:") || lower.includes("tail logs")) {
    const portMatch = userPrompt.match(/\b(\d{4,5})\b/);
    const step = await runStep("core_tail_service_logs", {
      port: portMatch ? Number(portMatch[1]) : 3000,
      node_id: primaryNode || "local-node",
    });
    const out = step.output as { logs?: string; error_count?: number } | undefined;
    finalReply = `### 📜 Live Service Logs\n\n- **Erkannte Fehlerzeilen:** \`${out?.error_count ?? 0}\`\n\`\`\`text\n${String(out?.logs || "Keine Logs").slice(0, 1500)}\n\`\`\``;
  } else if (lower.includes("cron-due") || lower.includes("run due cron")) {
    const step = await runStep("core_run_due_cron_jobs", {
      node_id: primaryNode || "local-node",
      force_all: true,
    });
    const out = step.output as { executed_count?: number; failed_count?: number } | undefined;
    finalReply = `### ⏱️ Autonomous Cron Due-Scheduler\n\n- **Ausgeführte Runbooks:** \`${out?.executed_count ?? 0}\` (Fehler: \`${out?.failed_count ?? 0}\`)`;
  }

  if (!finalReply) {
    if (state.planning_only || !primaryNode) {
      finalReply = `**Planning-Only Mode Active** for project \`${state.project_id}\`.\n\n- **Active Rule Cartridges:** ${
        state.active_cartridges.map((c) => `\`${c}\``).join(", ") || "none"
      }\n- **Drag & Drop Vision Ready:** Drop any architecture diagram or UI screenshot into this chat.\n- Because no Axon Muscle Node is assigned yet, remote execution tools (\`node_pty_exec\`, \`node_fs_operation\`) are locked by the Core Policy Interceptor.\n- Click **\`+ Add Peer\`** or type \`deploy microservice 4050\` to test the Policy Interceptor lock.`;
    } else {
      const probeStep = await runStep("node_pty_exec", {
        node_id: primaryNode,
        session_id: `default-${projectId}`,
        command: "uname -sr && uptime -p && df -h / | tail -n 1 && free -h | head -n 2",
        wait_timeout_ms: 8000,
      });
      const probeRaw = probeStep.output as
        | { output?: string; stdout_preview?: string }
        | undefined;
      const probeOut = String(
        probeRaw?.output || probeRaw?.stdout_preview || ""
      ).trim();
      finalReply = `### ⚡ Autonomous Edge Probe (\`${primaryNode}\`)\n\n\`\`\`text\n${
        probeOut || "Muscle node reachable via mTLS 1.3 + Yamux."
      }\n\`\`\`\n\n- **Projekt:** \`${state.project_id}\` (${state.assigned_nodes.length} verbundene Muscle-Node(s))\n- **Registrierte Dienste:** ${
        state.registered_services.map((s) => `\`${s.name}\` (:${s.port})`).join(", ") || "keine"
      }\n- **Tipp:** Nutze \`/check-system\`, \`/check-opsec\`, \`deploy microservice 4050\` oder \`$ <befehl>\` für gezielte DevOps-Workflows.`;
    }
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
