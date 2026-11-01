import { loadAuthConfig, saveAuthConfig } from "../auth";
import type { ToolDispatchResult } from "../orchestrator";
import { executeServiceAction } from "../projects/serviceActionRunner";
import { resolveTargetNodeId } from "../runtimeResolver";
import {
  appendAuditLog,
  createMcpApiKey,
  ensureProjectVault,
  listSecretKeys,
  revokeMcpApiKey,
  setSecret,
  withProjectStateTransaction,
  type ProjectState,
} from "../vault";

export async function dispatchWorkbenchAndAuthTool(
  projectId: string,
  state: ProjectState,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolDispatchResult | null> {
  if (toolName === "core_invoke_service_action") {
    const nodeId =
      resolveTargetNodeId(
        state,
        args.node_id ? String(args.node_id) : undefined
      ) || "local-node";
    const port = Number(args.port || 3000);
    const method = String(args.method || "GET").toUpperCase();
    const rawPath = String(args.path || "/");
    const payload =
      args.payload !== undefined && args.payload !== null
        ? String(args.payload)
        : "";

    const out = await executeServiceAction({
      projectId,
      nodeId,
      port,
      method,
      rawPath,
      payload,
    });

    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      node_id: nodeId,
      status: out.ok ? "executed" : "error",
      summary: `Invoked service workbench action ${method} ${rawPath} on ${nodeId}:${port} -> HTTP ${out.status_code} (${out.latency_ms} ms)`,
      args,
    });

    return {
      tool_name: toolName,
      status: out.ok ? "executed" : "error",
      output: out,
    };
  }

  if (toolName === "core_manage_auth_and_ai") {
    const action = String(args.action || "inspect_auth");
    if (action === "inspect_auth") {
      const cfg = loadAuthConfig();
      return {
        tool_name: toolName,
        status: "executed",
        output: {
          action,
          enabled: cfg.enabled,
          has_admin_password: Boolean(cfg.admin_password_hash),
          has_operator_password: Boolean(cfg.operator_password_hash),
          has_totp_pin: Boolean(cfg.totp_pin),
          active_sessions_count: cfg.sessions.length,
          updated_at: cfg.updated_at,
          ai_settings: state.ai_settings,
        },
      };
    }

    if (action === "revoke_sessions") {
      const cfg = loadAuthConfig();
      const revokedCount = cfg.sessions.length;
      cfg.sessions = [];
      saveAuthConfig(cfg);
      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "ai_orchestrator",
        tool_name: toolName,
        status: "executed",
        summary: `Revoked ${revokedCount} active WebUI RBAC session(s)`,
        args,
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: {
          action,
          revoked_count: revokedCount,
          active_sessions_count: 0,
        },
      };
    }

    const provider = String(
      args.provider || state.ai_settings?.provider || "openai-compatible"
    );
    const baseUrl = String(
      args.base_url ||
        state.ai_settings?.base_url ||
        "https://api.openai.com/v1"
    ).trim();
    const model = String(
      args.model || state.ai_settings?.model || "gpt-4o"
    ).trim();
    const secretName = String(
      args.api_key_secret_name ||
        state.ai_settings?.api_key_secret_name ||
        "LLM_API_KEY"
    )
      .trim()
      .toUpperCase();

    if (args.api_key && String(args.api_key).trim() !== "") {
      setSecret(projectId, secretName, String(args.api_key).trim());
    }

    const saved = await withProjectStateTransaction(projectId, (draft) => {
      draft.ai_settings = {
        provider,
        base_url: baseUrl,
        model,
        api_key_secret_name: secretName,
        enable_prompt_caching:
          args.enable_prompt_caching !== undefined
            ? Boolean(args.enable_prompt_caching)
            : draft.ai_settings?.enable_prompt_caching ?? true,
        enable_auto_watchdog:
          args.enable_auto_watchdog !== undefined
            ? Boolean(args.enable_auto_watchdog)
            : draft.ai_settings?.enable_auto_watchdog ?? true,
      };
    });

    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      status: "executed",
      summary: `Configured AI Endpoint: provider=${provider}, base_url=${baseUrl}, model=${model}`,
      args: { action, provider, base_url: baseUrl, model, secretName },
    });

    return {
      tool_name: toolName,
      status: "executed",
      output: {
        action: "configure_ai_endpoint",
        ai_settings: saved.ai_settings,
        secret_keys: listSecretKeys(projectId),
      },
    };
  }

  if (toolName === "core_manage_mcp_keys") {
    const action = String(args.action || "list");
    if (action === "list") {
      const keys = ensureProjectVault(projectId).mcp_api_keys || [];
      return { tool_name: toolName, status: "executed", output: { ok: true, action: "list", count: keys.length, keys } };
    }
    if (action === "create") {
      const name = String(args.name || "External AI / MCP Client").trim();
      const rawScopes = Array.isArray(args.scopes) ? args.scopes.map((s) => String(s)) : ["read", "execute"];
      const validScopes = rawScopes.filter((s): s is "read" | "execute" | "admin" => s === "read" || s === "execute" || s === "admin");
      const created = createMcpApiKey(projectId, name, validScopes.length > 0 ? validScopes : ["read", "execute"]);
      return { tool_name: toolName, status: "executed", output: { ok: true, action: "create", key: created.key, plaintext_token: created.plaintext_token } };
    }
    if (action === "revoke") {
      const keyId = String(args.key_id || "").trim();
      if (!keyId) {
        return { tool_name: toolName, status: "error", output: { ok: false, error: "key_id is required for revoke" } };
      }
      const remaining = revokeMcpApiKey(projectId, keyId);
      return { tool_name: toolName, status: "executed", output: { ok: true, action: "revoke", revoked_key_id: keyId, keys: remaining } };
    }
  }

  return null;
}
