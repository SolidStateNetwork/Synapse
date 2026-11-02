import {
  deleteCustomCartridge,
  listCartridges,
  saveCustomCartridge,
} from "../cartridges";
import { recordCheckpoint } from "../checkpoints";
import { gatewayExecPty } from "../gatewayClient";
import { interceptAndExecuteTool, type ToolDispatchResult } from "../orchestrator";
import {
  appendAuditLog,
  withProjectStateTransaction,
  type ProjectState,
} from "../vault";
import {
  createSignedAuditSnapshot,
  evaluatePolicyAsCode,
  executeDagPlaybook,
  type DagStepSpec,
} from "../vault/v250Enterprise";

export async function dispatchPlaybookAndApprovalTool(
  projectId: string,
  state: ProjectState,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolDispatchResult | null> {
  if (toolName === "core_manage_playbooks") {
    const action = String(args.action || "list");
    if (action === "list") {
      return {
        tool_name: toolName,
        status: "executed",
        output: {
          project_id: projectId,
          playbooks: state.scheduled_playbooks || [],
          cartridges: listCartridges(),
          active_cartridges: state.active_cartridges || [],
        },
      };
    }

    if (action === "run_dag") {
      const stepsRaw = Array.isArray(args.steps) ? (args.steps as DagStepSpec[]) : [];
      if (stepsRaw.length === 0) {
        return {
          tool_name: toolName,
          status: "error",
          output: { ok: false, error: "steps array is required for run_dag" },
        };
      }
      const dagOut = await executeDagPlaybook(
        projectId,
        {
          id: typeof args.playbook_id === "string" ? args.playbook_id : undefined,
          name: String(args.name || "Multi-Stage DAG Playbook"),
          node_id: typeof args.target_node_id === "string" ? args.target_node_id : undefined,
          auto_checkpoint: args.auto_checkpoint !== false,
          steps: stepsRaw,
        },
        async (nodeId, command, stepId, timeoutMs) => {
          if (command.startsWith("mock_fail")) {
            return { exitCode: 1, output: `Simulated failure for step ${stepId}` };
          }
          if (command.startsWith("mock_ok")) {
            return { exitCode: 0, output: `Simulated success for step ${stepId}: ${command}` };
          }
          const pty = await gatewayExecPty({
            node_id: nodeId,
            cmd_id: `dag-${stepId}-${Date.now()}`,
            project_id: projectId,
            session_id: `cron-runner-${projectId}`,
            command,
            wait_timeout_ms: timeoutMs,
          });
          return { exitCode: pty.exit_code ?? 0, output: String(pty.output || "") };
        }
      );
      return {
        tool_name: toolName,
        status: dagOut.success ? "executed" : "error",
        output: { ok: dagOut.success, action: "run_dag", ...dagOut },
      };
    }

    if (action === "evaluate_policy") {
      const evalRes = evaluatePolicyAsCode(projectId, {
        toolName: String(args.target_tool || "node_pty_exec"),
        tier: typeof args.tier === "string" ? args.tier : undefined,
        command: typeof args.command === "string" ? args.command : undefined,
        path: typeof args.path === "string" ? args.path : undefined,
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: true, action: "evaluate_policy", ...evalRes },
      };
    }

    if (action === "audit_snapshot") {
      const snap = createSignedAuditSnapshot(
        projectId,
        typeof args.signing_secret === "string" ? args.signing_secret : undefined
      );
      return {
        tool_name: toolName,
        status: "executed",
        output: { ok: true, action: "audit_snapshot", snapshot: snap },
      };
    }

    if (action === "upsert") {
      const pbId = String(args.playbook_id || `pb-${Date.now()}`);
      const cronExpr = String(args.cron_expression || args.cron || "0 3 * * *");
      const preFlightCp = recordCheckpoint(projectId, {
        node_id: String(args.target_node_id || state.assigned_nodes[0]?.node_id || "local-node"),
        title: `Pre-Flight Playbook Upsert: ${pbId}`,
        actor: "Auto-Watchdog",
        summary: `Automatic pre-flight checkpoint before upserting scheduled playbook '${pbId}'.`,
        files_backed_up: [`/opt/axon/workspaces/${projectId}`],
        services_snapshot: [],
        rollback_cmd: "echo 'CHECKPOINT_RESTORED_OK'",
      });
      const pb = {
        playbook_id: pbId,
        name: String(args.name || "Scheduled AI Playbook"),
        cron_expression: cronExpr,
        cron: cronExpr,
        prompt: String(args.prompt || "Inspect server health and update Memory.md"),
        target_node_id: args.target_node_id ? String(args.target_node_id) : undefined,
        enabled: args.enabled !== undefined ? Boolean(args.enabled) : true,
        last_status: "Scheduled",
      };
      const updated = await withProjectStateTransaction(projectId, (draft) => {
        draft.scheduled_playbooks = [
          ...(draft.scheduled_playbooks || []).filter((x) => x.playbook_id !== pbId),
          pb,
        ];
      });
      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "ai_orchestrator",
        tool_name: toolName,
        status: "executed",
        summary: `Upserted scheduled AI Playbook '${pb.name}' (${pbId}, cron=${cronExpr}, checkpoint=${preFlightCp.id})`,
        args,
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: {
          action,
          playbook: pb,
          playbooks: updated.scheduled_playbooks || [],
          checkpoint_id: preFlightCp.id,
        },
      };
    }

    if (action === "delete") {
      const pbId = String(args.playbook_id || "").trim();
      const preFlightCp = recordCheckpoint(projectId, {
        node_id: String(state.assigned_nodes[0]?.node_id || "local-node"),
        title: `Pre-Flight Playbook Delete: ${pbId}`,
        actor: "Auto-Watchdog",
        summary: `Automatic pre-flight checkpoint before deleting scheduled playbook '${pbId}'.`,
        files_backed_up: [`/opt/axon/workspaces/${projectId}`],
        services_snapshot: [],
        rollback_cmd: "echo 'CHECKPOINT_RESTORED_OK'",
      });
      const updated = await withProjectStateTransaction(projectId, (draft) => {
        draft.scheduled_playbooks = (draft.scheduled_playbooks || []).filter(
          (x) => x.playbook_id !== pbId
        );
      });
      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "ai_orchestrator",
        tool_name: toolName,
        status: "executed",
        summary: `Deleted scheduled AI Playbook '${pbId}' (checkpoint=${preFlightCp.id})`,
        args,
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: {
          action,
          deleted_id: pbId,
          playbooks: updated.scheduled_playbooks || [],
          checkpoint_id: preFlightCp.id,
        },
      };
    }

    if (action === "create_custom_cartridge") {
      const created = saveCustomCartridge({
        name: String(args.name || "Custom DevOps Rule"),
        description: String(args.description || "User-defined Synapse Rule Cartridge"),
        category: String(args.category || "Custom"),
        content: String(args.content || "# Custom Policy\n"),
      });
      const updated = await withProjectStateTransaction(projectId, (draft) => {
        if (!draft.active_cartridges.includes(created.id)) {
          draft.active_cartridges.push(created.id);
        }
      });
      appendAuditLog(projectId, {
        timestamp: new Date().toISOString(),
        actor: "ai_orchestrator",
        tool_name: toolName,
        status: "executed",
        summary: `Created and activated custom Rule Cartridge '${created.name}' (${created.id})`,
        args,
      });
      return {
        tool_name: toolName,
        status: "executed",
        output: {
          action,
          cartridge: created,
          active_cartridges: updated.active_cartridges,
        },
      };
    }

    const cartridgeId = String(args.cartridge_id || "").trim();
    const deleted = deleteCustomCartridge(cartridgeId);
    const updated = await withProjectStateTransaction(projectId, (draft) => {
      draft.active_cartridges = draft.active_cartridges.filter((id) => id !== cartridgeId);
    });
    return {
      tool_name: toolName,
      status: "executed",
      output: {
        action: "delete_custom_cartridge",
        deleted,
        cartridge_id: cartridgeId,
        active_cartridges: updated.active_cartridges,
      },
    };
  }

  if (toolName === "core_manage_approvals") {
    const action = String(args.action || "list");
    if (action === "list") {
      return {
        tool_name: toolName,
        status: "executed",
        output: {
          project_id: projectId,
          pending_approvals: state.pending_approvals || [],
        },
      };
    }

    const approvalId = String(args.approval_id || "").trim();
    const decision = action === "approve" ? "approved" : "rejected";
    let matchedApproval:
      | {
          approval_id: string;
          tool_name: string;
          node_id: string;
          arguments: Record<string, unknown>;
          status: string;
        }
      | undefined;

    await withProjectStateTransaction(projectId, (draft) => {
      const target = (draft.pending_approvals || []).find(
        (a) => a.approval_id === approvalId
      );
      if (target) {
        target.status = decision;
        matchedApproval = { ...target };
      }
    });

    if (!matchedApproval) {
      return {
        tool_name: toolName,
        status: "error",
        output: { error: `Approval request '${approvalId}' not found` },
      };
    }

    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: matchedApproval.tool_name,
      node_id: matchedApproval.node_id,
      status: decision === "approved" ? "approved" : "rejected",
      summary: `AI/MCP ${decision} TIER_3_SUPERVISED tool call ${approvalId} (${matchedApproval.tool_name})`,
      args: matchedApproval.arguments,
    });

    const execution =
      decision === "approved"
        ? await interceptAndExecuteTool(
            projectId,
            matchedApproval.tool_name,
            matchedApproval.arguments,
            true
          )
        : undefined;

    return {
      tool_name: toolName,
      status: "executed",
      output: {
        decision,
        approval: matchedApproval,
        execution,
      },
    };
  }

  return null;
}
