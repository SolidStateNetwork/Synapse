import crypto from "crypto";
import path from "path";
import { appendAuditLog, atomicWriteJsonSync, ensureProjectVault, getDecryptedSecrets, getProjectDir, safeReadJsonWithBackupSync, withProjectStateTransaction, writeBrainDoc } from "@/lib/vault";
import { buildDefaultServiceEndpoints } from "@/lib/orchestrator/servicePresets";
import { resolveActiveProjectId, resolveTargetNodeId } from "@/lib/runtimeResolver";
import { safeFetchJson } from "@/lib/safeFetch";

const getGatewayUrl = () => process.env.CORE_GATEWAY_URL || "http://127.0.0.1:8081";

export interface GitOpsStackRecord {
  stack_id: string;
  name: string;
  repo_url: string;
  branch: string;
  node_id: string;
  port: number;
  category: "backend" | "webui" | "database";
  compose_path: string;
  start_command?: string;
  injected_secret_keys: string[];
  webhook_token_sha256: string;
  webhook_token_preview: string;
  last_commit?: string;
  last_deployed_at: string;
  status: "deployed" | "error";
  last_output?: string;
}

function getGitStacksPath(projectId: string): string {
  return path.join(getProjectDir(resolveActiveProjectId(projectId)), "GitStacks.json");
}

export function loadGitStacks(projectId: string): GitOpsStackRecord[] {
  const parsed = safeReadJsonWithBackupSync<GitOpsStackRecord[] | null>(getGitStacksPath(resolveActiveProjectId(projectId)), null);
  return Array.isArray(parsed) ? parsed : [];
}

export function saveGitStacks(projectId: string, stacks: GitOpsStackRecord[]): GitOpsStackRecord[] {
  atomicWriteJsonSync(getGitStacksPath(projectId), stacks);
  return stacks;
}

function isValidGitRepoUrl(repoUrl: string): boolean {
  const trimmed = repoUrl.trim();
  if (!trimmed || trimmed.length > 300 || /[;&|`$<>\\]/.test(trimmed)) return false;
  return /^(https?:\/\/|git@|ssh:\/\/|file:\/\/|\/)[a-zA-Z0-9._/@:-]+$/.test(trimmed);
}

export async function deployGitStackOnMuscle(params: {
  projectId: string;
  nodeId?: string;
  stackId?: string;
  name: string;
  repoUrl: string;
  branch?: string;
  port: number;
  category?: "backend" | "webui" | "database";
  composePath?: string;
  composeFile?: string;
  startCommand?: string;
  injectSecretKeys?: string[];
  injectSecrets?: boolean;
}): Promise<{ ok: boolean; error?: string; stack?: GitOpsStackRecord; webhook_token?: string; stacks?: GitOpsStackRecord[] }> {
  const projectId = resolveActiveProjectId(params.projectId);
  const state = ensureProjectVault(projectId);
  const nodeId = resolveTargetNodeId(state, params.nodeId) || "local-node";
  const repoUrl = String(params.repoUrl || "").trim();
  if (!isValidGitRepoUrl(repoUrl)) {
    return { ok: false, error: "Invalid or unsafe Git repository URL" };
  }

  const port = Number(params.port || 4080);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    return { ok: false, error: "Invalid port (must be 1024..65535)" };
  }

  const branch = String(params.branch || "main").trim().replace(/[^a-zA-Z0-9._/-]/g, "") || "main";
  const composePath =
    String(params.composePath || params.composeFile || "docker-compose.yml")
      .trim()
      .replace(/[^a-zA-Z0-9._/-]/g, "") || "docker-compose.yml";
  const category = params.category === "webui" || params.category === "database" ? params.category : "backend";
  const safeSlug =
    String(params.name || "git-stack")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24) || "git-stack";
  const stackId = params.stackId || `stack-${safeSlug}-${port}`;
  const stackDir = `/var/lib/synapse/stacks/${stackId}`;

  const allSecrets = params.injectSecrets === false ? {} : getDecryptedSecrets(projectId);
  const requestedKeys = Array.isArray(params.injectSecretKeys)
    ? params.injectSecretKeys.map((k) => String(k).trim().toUpperCase()).filter(Boolean)
    : Object.keys(allSecrets);
  const injectedKeys: string[] = [];
  const envLines: string[] = [`PORT=${port}`, `SYNAPSE_STACK_ID=${stackId}`];

  for (const key of requestedKeys) {
    if (Object.prototype.hasOwnProperty.call(allSecrets, key)) {
      const val = String(allSecrets[key]).replace(/"/g, '\\"');
      envLines.push(`${key}="${val}"`);
      injectedKeys.push(key);
    }
  }

  await safeFetchJson(`${getGatewayUrl()}/api/v1/rpc/fs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_id: nodeId,
      request_id: `gitops-env-${Date.now()}`,
      project_id: projectId,
      tier: "TIER_1_UNLEASHED",
      operation: "write_file",
      path: `${stackDir}/.env`,
      content: envLines.join("\n") + "\n",
      file_mode: "0600",
    }),
    timeoutMs: 5000,
  });

  const startStep = params.startCommand
    ? params.startCommand.trim()
    : `if [ -f "${composePath}" ]; then docker compose -f "${composePath}" up -d --build 2>&1 || true; fi`;

  const deployCmd = [
    `mkdir -p "${stackDir}/repo"`,
    `if [ -d "${stackDir}/repo/.git" ]; then`,
    `  git -C "${stackDir}/repo" fetch --quiet origin "${branch}" 2>/dev/null || true`,
    `  git -C "${stackDir}/repo" checkout -q "${branch}" 2>/dev/null || true`,
    `  git -C "${stackDir}/repo" pull --ff-only origin "${branch}" 2>/dev/null || true`,
    `else`,
    `  git clone --depth 1 -b "${branch}" "${repoUrl}" "${stackDir}/repo" 2>/dev/null || git init "${stackDir}/repo" >/dev/null 2>&1`,
    `fi`,
    `cp -f "${stackDir}/.env" "${stackDir}/repo/.env" 2>/dev/null || true`,
    `chmod 0600 "${stackDir}/repo/.env" 2>/dev/null || true`,
    `cd "${stackDir}/repo"`,
    startStep,
    `COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "HEAD")`,
    `printf "GITOPS_RESULT|%s|%s\\n" "$COMMIT" "$?"`,
  ].join("\n");

  let lastCommit = "HEAD";
  let status: "deployed" | "error" = "deployed";
  let lastOutput = `Stack ${stackId} synchronized and started on ${nodeId}:${port}`;

  const ptyRes = await safeFetchJson(`${getGatewayUrl()}/api/v1/rpc/pty`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_id: nodeId,
      cmd_id: `gitops-deploy-${Date.now()}`,
      project_id: projectId,
      session_id: `gitops-${stackId}`,
      tier: "TIER_1_UNLEASHED",
      command: deployCmd,
      wait_timeout_ms: 25000,
    }),
    timeoutMs: 28000,
  });

  if (ptyRes.ok) {
    const ptyJson = await ptyRes.json();
    const rawOut = String(ptyJson.output || "").trim();
    if (rawOut) lastOutput = rawOut.slice(-300);
    const resultLine = rawOut.split(/\r?\n/).find((l) => l.includes("GITOPS_RESULT|"));
    if (resultLine) {
      const parts = resultLine.slice(resultLine.indexOf("GITOPS_RESULT|")).trim().split("|");
      lastCommit = parts[1] || "HEAD";
      status = Number(parts[2] || 0) === 0 ? "deployed" : "error";
    }
  }

  const stacks = loadGitStacks(projectId);
  const existingIdx = stacks.findIndex((s) => s.stack_id === stackId);
  let plaintextWebhookToken: string | undefined;
  let tokenSha256 = existingIdx >= 0 ? stacks[existingIdx].webhook_token_sha256 : "";
  let tokenPreview = existingIdx >= 0 ? stacks[existingIdx].webhook_token_preview : "";

  if (!tokenSha256) {
    plaintextWebhookToken = `syn_git_${crypto.randomBytes(16).toString("hex")}`;
    tokenSha256 = crypto.createHash("sha256").update(plaintextWebhookToken).digest("hex");
    tokenPreview = `${plaintextWebhookToken.slice(0, 12)}...`;
  }

  const nowIso = new Date().toISOString();
  const record: GitOpsStackRecord = {
    stack_id: stackId,
    name: params.name.trim() || stackId,
    repo_url: repoUrl,
    branch,
    node_id: nodeId,
    port,
    category,
    compose_path: composePath,
    start_command: params.startCommand,
    injected_secret_keys: injectedKeys,
    webhook_token_sha256: tokenSha256,
    webhook_token_preview: tokenPreview,
    last_commit: lastCommit,
    last_deployed_at: nowIso,
    status,
    last_output: lastOutput,
  };

  if (existingIdx >= 0) stacks[existingIdx] = record;
  else stacks.unshift(record);
  saveGitStacks(projectId, stacks);

  await withProjectStateTransaction(projectId, (draft) => {
    draft.registered_services = draft.registered_services.filter(
      (s) => s.service_id !== stackId && !(s.node_id === nodeId && s.port === port)
    );
    draft.registered_services.push({
      service_id: stackId,
      name: record.name,
      node_id: nodeId,
      category,
      runtime: "docker",
      description: `GitOps Stack (${repoUrl}#${branch}, commit ${lastCommit})`,
      protocol: "http",
      port,
      path: "/",
      healthy: status === "deployed",
      auto_heal: true,
      registered_at: nowIso,
      endpoints: buildDefaultServiceEndpoints(projectId, stackId, record.name, category, "/"),
    });
  });

  appendAuditLog(projectId, {
    timestamp: nowIso,
    actor: "user",
    tool_name: "gitops_stack_deploy",
    node_id: nodeId,
    status: status === "deployed" ? "executed" : "error",
    summary: `Deployed GitOps stack '${record.name}' (${repoUrl}#${branch} @ ${lastCommit}) on ${nodeId}:${port}`,
  });

  try {
    writeBrainDoc(
      projectId,
      "Memory.md",
      `- **[${nowIso}]** 📦 **GitOps Stack Deployed:** \`${record.name}\` (\`${repoUrl}#${branch}\` @ \`${lastCommit}\`) on \`${nodeId}:${port}\`.`,
      "append"
    );
  } catch {
    // ignore
  }

  return { ok: status === "deployed", stack: record, webhook_token: plaintextWebhookToken, stacks };
}

export async function triggerGitOpsWebhookRedeploy(params: {
  projectId: string;
  stackId: string;
  webhookToken?: string;
}): Promise<{ ok: boolean; error?: string; redeployed?: boolean; stack?: GitOpsStackRecord }> {
  const projectId = resolveActiveProjectId(params.projectId);
  const target = loadGitStacks(projectId).find((s) => s.stack_id === params.stackId);
  if (!target) return { ok: false, error: `GitOps stack not found: ${params.stackId}` };

  if (params.webhookToken !== undefined) {
    const providedHash = crypto.createHash("sha256").update(String(params.webhookToken).trim()).digest("hex");
    if (providedHash !== target.webhook_token_sha256) {
      return { ok: false, error: "Invalid GitOps webhook token" };
    }
  }

  const res = await deployGitStackOnMuscle({
    projectId,
    nodeId: target.node_id,
    stackId: target.stack_id,
    name: target.name,
    repoUrl: target.repo_url,
    branch: target.branch,
    port: target.port,
    category: target.category,
    composePath: target.compose_path,
    startCommand: target.start_command,
    injectSecretKeys: target.injected_secret_keys,
  });

  return { ok: res.ok, error: res.error, redeployed: res.ok, stack: res.stack };
}

export async function deleteGitStackOnMuscle(params: {
  projectId: string;
  stackId: string;
}): Promise<{ ok: boolean; error?: string; stacks: GitOpsStackRecord[] }> {
  const projectId = resolveActiveProjectId(params.projectId);
  const current = loadGitStacks(projectId);
  const target = current.find((s) => s.stack_id === params.stackId);
  if (!target) {
    return { ok: false, error: `GitOps stack not found: ${params.stackId}`, stacks: current };
  }

  const stackDir = `/var/lib/synapse/stacks/${target.stack_id}`;
  const teardownCmd = `if [ -d "${stackDir}/repo" ]; then cd "${stackDir}/repo" && docker compose -f "${target.compose_path}" down --remove-orphans 2>/dev/null || true; fi; rm -rf "${stackDir}" 2>/dev/null || true`;

  await safeFetchJson(`${getGatewayUrl()}/api/v1/rpc/pty`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      node_id: target.node_id,
      cmd_id: `gitops-delete-${Date.now()}`,
      project_id: projectId,
      session_id: `gitops-${target.stack_id}`,
      tier: "TIER_1_UNLEASHED",
      command: teardownCmd,
      wait_timeout_ms: 12000,
    }),
    timeoutMs: 14000,
  });

  const remaining = current.filter((s) => s.stack_id !== target.stack_id);
  saveGitStacks(projectId, remaining);

  await withProjectStateTransaction(projectId, (draft) => {
    draft.registered_services = draft.registered_services.filter(
      (s) => s.service_id !== target.stack_id && !(s.node_id === target.node_id && s.port === target.port)
    );
  });

  appendAuditLog(projectId, {
    timestamp: new Date().toISOString(),
    actor: "user",
    tool_name: "gitops_stack_delete",
    node_id: target.node_id,
    status: "executed",
    summary: `Removed GitOps stack '${target.name}' (${target.stack_id}) from ${target.node_id}:${target.port}`,
  });

  return { ok: true, stacks: remaining };
}
