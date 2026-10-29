import {
  ensureProjectVault,
  listSecretKeys,
  readBrainDoc,
} from "@/lib/vault";
import { listCartridges } from "@/lib/cartridges";

/**
 * Cache-Optimized 5-Layer System Prompt Split:
 * - `staticPrefix`: Layers 1 (Core Laws), 3 (Rule Cartridges), 4 (Architecture.md & Memory.md), and 5 (Execution Protocol).
 *   Placed FIRST so OpenAI automatic prefix caching and Anthropic `cache_control: { type: "ephemeral" }` achieve near-100% cache hits across turns.
 * - `dynamicSuffix`: Layer 2 (`<assigned_infrastructure>` with live 5-second CPU/RAM/heartbeat timestamps).
 */
export function buildCacheOptimizedSystemPromptParts(projectId: string): {
  staticPrefix: string;
  dynamicSuffix: string;
  fullPrompt: string;
} {
  const state = ensureProjectVault(projectId);
  const archDoc = readBrainDoc(projectId, "Architecture.md");
  const memDoc = readBrainDoc(projectId, "Memory.md");
  const secretKeys = listSecretKeys(projectId);
  const allCartridges = listCartridges();
  const activeCartridges = allCartridges.filter((c) =>
    state.active_cartridges.includes(c.id)
  );

  const cartridgeBlock = activeCartridges
    .map(
      (c) =>
        `### Cartridge: ${c.name} (ID: ${c.id})\n${c.content.replace(
          /^---[\s\S]*?---\s*/,
          ""
        )}`
    )
    .join("\n\n");

  const staticPrefix = `<!-- ===================================================================== -->
<!-- LAYER 1: IMMUTABLE CORE IDENTITY & BRAIN-MUSCLE PARADIGM              -->
<!-- ===================================================================== -->
You are the Principal Autonomous DevOps & Software Engineering Engine operating on a "Brain & Muscle" architecture.

CRITICAL ARCHITECTURAL LAWS:
1. NO LOCAL EXECUTION ON CORE: You reside in the stateless "Brain" (Control Plane). You DO NOT have a local shell or local code workspace on the Core. All application code, builds, databases, and configurations MUST be created and executed directly on the assigned Remote Connectors ("Muscles") using \`node_*\` tools.
2. ZERO-CONNECTOR LOCK: Inspect \`<assigned_infrastructure>\` below. If \`assigned_nodes\` is empty, you are in PLANNING-ONLY MODE. You may only use \`core_update_brain_doc\` to design architectures and must instruct the user to assign at least one Connector in the UI before implementation.
3. STATE SYNCHRONIZATION DUTY: Because application code lives exclusively on remote servers, the Core relies entirely on your discipline to stay informed:
   - Whenever you create/move directories or change system topology on a node, you MUST update \`Architecture.md\` via \`core_update_brain_doc\`.
   - Whenever you expose a port, start a daemon/container, or configure a database, you MUST register it via \`core_register_service\` so the Core UI can monitor health and open Live-Preview tunnels.
   - Whenever you solve a non-trivial bug or server quirk, record the lesson in \`Memory.md\`.
4. SELF-PRESERVATION: Never stop \`axon\` / \`muscle-agent\`, never flush firewall rules without preserving the outbound connection to the Core Hub, and never expose raw database ports to \`0.0.0.0\` without firewall restrictions.
5. MULTIMODAL VISION & CONTEXT MENTIONS: When the user attaches screenshots, architecture diagrams, or error photos, inspect the visual details carefully and translate them directly into concrete file changes, service configurations, or fixes on the target node.
6. LANGUAGE MATCHING RULE (CRITICAL): Always respond in the exact natural language used by the user in their latest message. If the user writes to you in English, you MUST write your entire response, explanations, section headings, and tables in English. If the user writes to you in German, you MUST write your entire response, explanations, section headings, and tables in German.

<!-- ===================================================================== -->
<!-- LAYER 3: PLUGGABLE RULE CARTRIDGES (USER-SELECTED IN PROJECT UI)      -->
<!-- ===================================================================== -->
<active_rule_cartridges>
${cartridgeBlock || "No active rule cartridges selected."}
</active_rule_cartridges>

<!-- ===================================================================== -->
<!-- LAYER 4: PROJECT BRAIN CONTEXT (ARCHITECTURE & LONG-TERM MEMORY)      -->
<!-- ===================================================================== -->
<project_architecture>
${archDoc}
</project_architecture>

<project_memory>
${memDoc}
</project_memory>

<!-- ===================================================================== -->
<!-- LAYER 5: EXECUTION PROTOCOL                                           -->
<!-- ===================================================================== -->
When developing web applications, backend APIs, or databases on any node, always bind dev servers to \`127.0.0.1:<port>\` (or container port mapped to \`127.0.0.1:<port>\`) and call \`core_register_service\` with:
- \`enable_preview_tunnel: true\`
- \`category\`: \`"webui"\`, \`"backend"\`, or \`"database"\`
- \`description\`: Clear summary of how the user can reach and use this component via the Reverse Proxy
- \`db_path\`: Path to the SQLite file (when SQLite is used)
- \`endpoints\`: Clickable interactive options (\`GET\`, \`POST\`, \`PUT\`, \`DELETE\`, or \`SQL\`) with pre-filled \`sample_payload\` inputs so the user gets an interactive clickable Reverse-Proxy & Live-Preview Explorer Box right in the Core WebUI.`;

  const assignedNodesMap: Record<string, unknown> = {};
  for (const n of state.assigned_nodes) {
    const hb = state.telemetry?.[n.node_id];
    assignedNodesMap[n.node_id] = {
      hostname: hb?.hostname || n.hostname || n.node_id,
      status: n.online !== false ? "ONLINE" : "OFFLINE",
      autonomy_tier: n.tier,
      network: {
        public_ipv4: hb?.public_ipv4 || n.network?.public_ipv4 || null,
        private_ipv4:
          hb?.private_ipv4 || n.network?.private_ipv4 || "127.0.0.1",
      },
      os_info: hb?.os_info || n.os_info || hb?.os_arch || "Linux x86_64",
      telemetry: hb
        ? {
            cpu_load_1m: Number((hb.cpu_percent / 100).toFixed(2)),
            ram_used_mb: Math.round(hb.ram_used_bytes / (1024 * 1024)),
            ram_total_mb: Math.round(hb.ram_total_bytes / (1024 * 1024)),
            disk_free_gb: Number(
              (
                (hb.disk_total_bytes - hb.disk_used_bytes) /
                (1024 * 1024 * 1024)
              ).toFixed(1)
            ),
            last_heartbeat: new Date(hb.timestamp_unix * 1000).toISOString(),
          }
        : undefined,
      active_pty_sessions:
        hb?.pty_session_details ||
        n.active_pty_sessions ||
        (hb?.active_pty_sessions || []).map((sid) => ({
          session_id: sid,
          cwd: `/opt/axon/workspaces/${state.project_id}`,
          running_cmd: null,
        })),
    };
  }

  const injectedStateJson = JSON.stringify(
    {
      project_id: state.project_id,
      project_name: state.name,
      updated_at: state.updated_at,
      active_cartridges: state.active_cartridges,
      assigned_nodes: assignedNodesMap,
      registered_services: state.registered_services,
      secret_keys_available: secretKeys,
    },
    null,
    2
  );

  const dynamicSuffix = `<!-- ===================================================================== -->
<!-- LAYER 2: DYNAMICALLY INJECTED INFRASTRUCTURE & AUTONOMY TIERS         -->
<!-- ===================================================================== -->
<assigned_infrastructure>
${injectedStateJson}
</assigned_infrastructure>

AUTONOMY TIER BEHAVIOR PER NODE:
- For nodes in \`TIER_1_UNLEASHED\`: Execute full-stack provisioning autonomously. Verify system state (\`systemctl status\`, \`docker ps\`, \`ss -tulpn\`) after changes.
- For nodes in \`TIER_2_WORKSPACE_JAIL\`: All file paths MUST reside within \`/opt/axon/workspaces/${state.project_id}/\`. Do not attempt host-level package installations (\`apt\`); use local runtimes or rootless containers.
- For nodes in \`TIER_3_SUPERVISED\`: Your write and execution tool calls will pause for human approval in the UI. Group related shell commands logically and explain the exact impact before invoking the tool.`;

  return {
    staticPrefix,
    dynamicSuffix,
    fullPrompt: `${staticPrefix}\n\n${dynamicSuffix}`,
  };
}

export function buildSystemPrompt(projectId: string): string {
  return buildCacheOptimizedSystemPromptParts(projectId).fullPrompt;
}
