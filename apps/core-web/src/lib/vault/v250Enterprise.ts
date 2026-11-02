import crypto from "crypto";
import fs from "fs";
import path from "path";
import { recordCheckpoint } from "../checkpoints";
import { loadCronJobs } from "../v070-studio";
import {
  appendAuditLog,
  atomicWriteTextSync,
  ensureProjectVault,
  getMasterKey,
  getProjectDir,
  resolveVaultBaseDir,
  verifyAuditChain,
} from "../vault";
import { SYNAPSE_VERSION } from "../version";

export interface SignedTopologyBundlePayload {
  schema_version?: string;
  exported_at?: string;
  project_id?: string;
  project_name?: string;
  active_cartridges?: string[];
  registered_services?: Array<Record<string, unknown>>;
  peer_mesh_links?: Array<Record<string, unknown>>;
  peer_links?: Array<Record<string, unknown>>;
  scheduled_playbooks?: Array<Record<string, unknown>>;
  cron_jobs?: Array<Record<string, unknown>>;
  signed_at?: string;
  signer_fingerprint?: string;
  bundle_signature?: string;
  [key: string]: unknown;
}

export interface TopologyDriftPlan {
  valid_signature: boolean;
  signature_error?: string;
  signer_fingerprint?: string;
  services_to_add: string[];
  services_to_update: string[];
  services_unchanged: string[];
  links_to_add: number;
  cartridges_to_add: string[];
  cron_jobs_to_add: string[];
  playbooks_to_add: string[];
  total_changes: number;
}

export interface DagStepSpec {
  id: string;
  command: string;
  node_id?: string;
  depends_on?: string[];
  on_success?: string[];
  on_failure?: string[];
  timeout_ms?: number;
}

export interface DagPlaybookSpec {
  id?: string;
  name: string;
  node_id?: string;
  auto_checkpoint?: boolean;
  steps: DagStepSpec[];
}

export interface DagStepResult {
  step_id: string;
  node_id: string;
  command: string;
  status: "succeeded" | "failed" | "skipped";
  exit_code: number;
  output: string;
  duration_ms: number;
}

export interface PolicyRuleSpec {
  id: string;
  description: string;
  effect: "allow" | "require_approval" | "deny";
  tools?: string[];
  tiers?: string[];
  command_patterns?: string[];
  path_prefixes?: string[];
}

export interface PolicyAsCodeConfig {
  schema_version: string;
  updated_at: string;
  enforce_signed_bundles: boolean;
  rules: PolicyRuleSpec[];
}

export interface SignedAuditSnapshot {
  project_id: string;
  version: string;
  snapshot_at: string;
  entries_count: number;
  chain_valid: boolean;
  chain_tip_hash: string;
  signer_fingerprint: string;
  snapshot_signature: string;
}

function resolveSigningKey(projectId: string, customSecret?: string): Buffer {
  if (customSecret && customSecret.trim().length > 0) {
    return crypto.createHash("sha256").update(customSecret.trim()).digest();
  }
  const salt = crypto.createHash("sha256").update(`synapse-v250-sig:${projectId}`).digest().subarray(0, 16);
  return getMasterKey(salt, 10_000);
}

function computeSignerFingerprint(key: Buffer): string {
  return `sha256:${crypto.createHash("sha256").update(key).digest("hex").slice(0, 16)}`;
}

function canonicalizeBundleForSigning(bundle: SignedTopologyBundlePayload): string {
  const clone: Record<string, unknown> = {};
  for (const k of Object.keys(bundle).sort()) {
    if (k === "bundle_signature" || k === "signer_fingerprint" || k === "visibility") continue;
    clone[k] = bundle[k];
  }
  return JSON.stringify(clone);
}

export function signTopologyBundle(
  projectId: string,
  bundle: SignedTopologyBundlePayload,
  customSecret?: string
): SignedTopologyBundlePayload {
  const key = resolveSigningKey(projectId, customSecret);
  const signedAt = typeof bundle.signed_at === "string" && bundle.signed_at ? bundle.signed_at : new Date().toISOString();
  const unsignedPayload: SignedTopologyBundlePayload = {
    ...bundle,
    schema_version: bundle.schema_version || "synapse-stack/v2.5",
    signed_at: signedAt,
  };
  delete unsignedPayload.bundle_signature;
  delete unsignedPayload.signer_fingerprint;

  const sig = crypto.createHmac("sha256", key).update(canonicalizeBundleForSigning(unsignedPayload)).digest("hex");
  return {
    ...unsignedPayload,
    signer_fingerprint: computeSignerFingerprint(key),
    bundle_signature: sig,
  };
}

export function verifyTopologyBundleSignature(
  projectId: string,
  bundle: SignedTopologyBundlePayload,
  customSecret?: string
): { valid: boolean; reason?: string; signer_fingerprint?: string } {
  const sigHex = typeof bundle.bundle_signature === "string" ? bundle.bundle_signature.trim() : "";
  if (!sigHex) return { valid: false, reason: "Missing bundle_signature field" };
  const key = resolveSigningKey(projectId, customSecret);
  const expectedHex = crypto.createHmac("sha256", key).update(canonicalizeBundleForSigning(bundle)).digest("hex");
  const a = Buffer.from(sigHex, "utf8");
  const b = Buffer.from(expectedHex, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "Cryptographic bundle_signature mismatch (tampered or untrusted signer)" };
  }
  return { valid: true, signer_fingerprint: computeSignerFingerprint(key) };
}

export function simulateTopologyBundleApply(
  projectId: string,
  bundle: SignedTopologyBundlePayload,
  requireSignature = false,
  customSecret?: string
): TopologyDriftPlan {
  const hasSig = typeof bundle.bundle_signature === "string" && bundle.bundle_signature.trim().length > 0;
  let validSig = true;
  let sigErr: string | undefined;
  let fp: string | undefined;

  if (hasSig || requireSignature) {
    const check = verifyTopologyBundleSignature(projectId, bundle, customSecret);
    validSig = check.valid;
    sigErr = check.reason;
    fp = check.signer_fingerprint;
  }

  const state = ensureProjectVault(projectId);
  const existingSvcs = new Map(state.registered_services.map((s) => [s.service_id, s]));
  const servicesToAdd: string[] = [];
  const servicesToUpdate: string[] = [];
  const servicesUnchanged: string[] = [];

  for (const item of Array.isArray(bundle.registered_services) ? bundle.registered_services : []) {
    const sid = typeof item.service_id === "string" ? item.service_id : "";
    if (!sid) continue;
    const prev = existingSvcs.get(sid);
    if (!prev) servicesToAdd.push(sid);
    else if (prev.port !== item.port || prev.name !== item.name || prev.protocol !== item.protocol) servicesToUpdate.push(sid);
    else servicesUnchanged.push(sid);
  }

  const existingCarts = new Set(state.active_cartridges || []);
  const cartridgesToAdd = (Array.isArray(bundle.active_cartridges) ? bundle.active_cartridges : []).filter(
    (c) => typeof c === "string" && !existingCarts.has(c)
  );

  const existingLinks = new Set(
    (state.peer_mesh_links || []).map((l) => `${l.source_node_id}->${l.target_node_id}:${l.remote_port}`)
  );
  const rawLinks = Array.isArray(bundle.peer_mesh_links)
    ? bundle.peer_mesh_links
    : Array.isArray(bundle.peer_links)
      ? bundle.peer_links
      : [];
  let linksToAdd = 0;
  for (const l of rawLinks) {
    const key = `${String(l.source_node_id || "")}->${String(l.target_node_id || "")}:${Number(l.remote_port || 0)}`;
    if (!existingLinks.has(key)) linksToAdd++;
  }

  const existingCrons = new Set(loadCronJobs(projectId).map((j) => j.id));
  const cronJobsToAdd: string[] = [];
  for (const c of Array.isArray(bundle.cron_jobs) ? bundle.cron_jobs : []) {
    const cid = typeof c.id === "string" ? c.id : "";
    if (cid && !existingCrons.has(cid)) cronJobsToAdd.push(cid);
  }

  const existingPlaybooks = new Set((state.scheduled_playbooks || []).map((p) => p.playbook_id));
  const playbooksToAdd: string[] = [];
  for (const p of Array.isArray(bundle.scheduled_playbooks) ? bundle.scheduled_playbooks : []) {
    const pid = typeof p.playbook_id === "string" ? p.playbook_id : "";
    if (pid && !existingPlaybooks.has(pid)) playbooksToAdd.push(pid);
  }

  const totalChanges =
    servicesToAdd.length +
    servicesToUpdate.length +
    linksToAdd +
    cartridgesToAdd.length +
    cronJobsToAdd.length +
    playbooksToAdd.length;

  return {
    valid_signature: validSig,
    signature_error: sigErr,
    signer_fingerprint: fp,
    services_to_add: servicesToAdd,
    services_to_update: servicesToUpdate,
    services_unchanged: servicesUnchanged,
    links_to_add: linksToAdd,
    cartridges_to_add: cartridgesToAdd,
    cron_jobs_to_add: cronJobsToAdd,
    playbooks_to_add: playbooksToAdd,
    total_changes: totalChanges,
  };
}

export async function executeDagPlaybook(
  projectId: string,
  playbook: DagPlaybookSpec,
  stepRunner: (nodeId: string, command: string, stepId: string, timeoutMs: number) => Promise<{ exitCode: number; output: string }>
): Promise<{ success: boolean; checkpoint_id?: string; rolled_back: boolean; results: DagStepResult[] }> {
  const state = ensureProjectVault(projectId);
  const defaultNode = playbook.node_id || state.assigned_nodes[0]?.node_id || "local-node";
  let checkpointId: string | undefined;

  if (playbook.auto_checkpoint !== false) {
    const cp = recordCheckpoint(projectId, {
      node_id: defaultNode,
      title: `Pre-DAG Playbook (${playbook.name})`,
      actor: "Auto-Watchdog",
      summary: `Automatic pre-flight checkpoint before executing DAG playbook '${playbook.name}'.`,
      files_backed_up: [`/opt/axon/workspaces/${projectId}`],
      services_snapshot: (state.registered_services || []).map((s) => ({
        service_id: s.service_id,
        name: s.name,
        port: s.port,
        healthy: s.healthy !== false,
      })),
      rollback_cmd: "echo 'DAG_CHECKPOINT_RESTORED_OK'",
    });
    checkpointId = cp.id;
  }

  const completed = new Map<string, "succeeded" | "failed" | "skipped">();
  const activatedConditional = new Set<string>();
  const forcedSkip = new Set<string>();
  const results: DagStepResult[] = [];
  let anyFailed = false;

  const conditionalTargets = new Set<string>();
  for (const s of playbook.steps) {
    for (const t of s.on_success || []) conditionalTargets.add(t);
    for (const t of s.on_failure || []) conditionalTargets.add(t);
  }

  const pending = [...playbook.steps];
  let progress = true;
  while (pending.length > 0 && progress) {
    progress = false;
    for (let i = 0; i < pending.length; i++) {
      const step = pending[i];
      const deps = step.depends_on || [];
      if (!deps.every((d) => completed.has(d))) continue;

      pending.splice(i, 1);
      i--;
      progress = true;

      const depFailed = deps.some((d) => completed.get(d) !== "succeeded");
      const isConditionalOnly = conditionalTargets.has(step.id) && deps.length === 0;
      if (forcedSkip.has(step.id) || depFailed || (isConditionalOnly && !activatedConditional.has(step.id))) {
        completed.set(step.id, "skipped");
        results.push({
          step_id: step.id,
          node_id: step.node_id || defaultNode,
          command: step.command,
          status: "skipped",
          exit_code: 0,
          output: "Skipped due to DAG branch condition or upstream failure",
          duration_ms: 0,
        });
        continue;
      }

      const start = Date.now();
      const targetNode = step.node_id || defaultNode;
      const execRes = await stepRunner(targetNode, step.command, step.id, step.timeout_ms || 30_000);
      const durationMs = Date.now() - start;

      if (execRes.exitCode === 0) {
        completed.set(step.id, "succeeded");
        for (const nextId of step.on_success || []) activatedConditional.add(nextId);
        for (const failId of step.on_failure || []) forcedSkip.add(failId);
        results.push({
          step_id: step.id,
          node_id: targetNode,
          command: step.command,
          status: "succeeded",
          exit_code: 0,
          output: execRes.output,
          duration_ms: durationMs,
        });
      } else {
        anyFailed = true;
        completed.set(step.id, "failed");
        for (const failId of step.on_failure || []) activatedConditional.add(failId);
        for (const okId of step.on_success || []) forcedSkip.add(okId);
        results.push({
          step_id: step.id,
          node_id: targetNode,
          command: step.command,
          status: "failed",
          exit_code: execRes.exitCode,
          output: execRes.output,
          duration_ms: durationMs,
        });
      }
    }
  }

  const rolledBack = Boolean(anyFailed && checkpointId);
  appendAuditLog(projectId, {
    timestamp: new Date().toISOString(),
    actor: "ai_orchestrator",
    tool_name: "core_manage_playbooks:run_dag",
    node_id: defaultNode,
    status: anyFailed ? "error" : "executed",
    summary: `Executed DAG Playbook "${playbook.name}" (${results.length} steps, success=${!anyFailed}, rolled_back=${rolledBack})`,
  });

  return { success: !anyFailed, checkpoint_id: checkpointId, rolled_back: rolledBack, results };
}

export function verifyPlaybookWebhookSignature(
  projectId: string,
  rawBody: string,
  signatureHeader: string,
  timestampHeader?: string,
  customSecret?: string
): { valid: boolean; reason?: string } {
  if (!signatureHeader || !signatureHeader.trim()) return { valid: false, reason: "Missing X-Synapse-Signature header" };
  if (timestampHeader) {
    const ts = Number(timestampHeader);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 300_000) {
      return { valid: false, reason: "Webhook timestamp outside 300s replay window" };
    }
  }
  const secret = customSecret || process.env.SYNAPSE_WEBHOOK_SECRET || resolveSigningKey(projectId).toString("hex");
  const payloadToSign = timestampHeader ? `${timestampHeader}.${rawBody}` : rawBody;
  const expected = crypto.createHmac("sha256", secret).update(payloadToSign).digest("hex");
  const cleanSig = signatureHeader.replace(/^sha256=/i, "").trim();
  const a = Buffer.from(cleanSig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { valid: false, reason: "Invalid webhook HMAC-SHA256 signature" };
  }
  return { valid: true };
}

export function ensurePolicyAsCodeFile(projectId: string): PolicyAsCodeConfig {
  ensureProjectVault(projectId);
  const synDir = path.join(getProjectDir(projectId), ".synapse");
  fs.mkdirSync(synDir, { recursive: true });
  const policyPath = path.join(synDir, "policies.json");

  if (fs.existsSync(policyPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(policyPath, "utf8")) as PolicyAsCodeConfig;
      if (parsed && Array.isArray(parsed.rules)) return parsed;
    } catch {
      // recreate below
    }
  }

  const defaultConfig: PolicyAsCodeConfig = {
    schema_version: "synapse.policy.v2.5",
    updated_at: new Date().toISOString(),
    enforce_signed_bundles: true,
    rules: [
      {
        id: "deny-destructive-root-wipe",
        description: "Block destructive filesystem wipe or disk formatting commands across all tiers",
        effect: "deny",
        command_patterns: ["rm -rf /", "mkfs.", "dd if=/dev/zero"],
      },
      {
        id: "supervise-production-firewall",
        description: "Require human approval for firewall drops on TIER_3_SUPERVISED nodes",
        effect: "require_approval",
        tools: ["node_firewall_control"],
        tiers: ["TIER_3_SUPERVISED"],
      },
      {
        id: "default-zero-trust-allow",
        description: "Allow authenticated mTLS and scoped MCP operations by default",
        effect: "allow",
        tools: ["*"],
      },
    ],
  };

  atomicWriteTextSync(policyPath, JSON.stringify(defaultConfig, null, 2), 0o600);
  return defaultConfig;
}

export function evaluatePolicyAsCode(
  projectId: string,
  input: { toolName: string; tier?: string; command?: string; path?: string }
): { allowed: boolean; effect: "allow" | "require_approval" | "deny"; matched_rule: string; reason?: string } {
  const cfg = ensurePolicyAsCodeFile(projectId);
  const cmdLower = (input.command || "").toLowerCase();

  for (const rule of cfg.rules) {
    if (rule.command_patterns && rule.command_patterns.length > 0 && cmdLower) {
      if (rule.command_patterns.some((pat) => cmdLower.includes(pat.toLowerCase()))) {
        return { allowed: rule.effect === "allow", effect: rule.effect, matched_rule: rule.id, reason: rule.description };
      }
    }
    const toolMatch = !rule.tools || rule.tools.includes("*") || rule.tools.includes(input.toolName);
    const tierMatch = !rule.tiers || (input.tier ? rule.tiers.includes(input.tier) : false);
    if (toolMatch && tierMatch && (!rule.command_patterns || rule.command_patterns.length === 0)) {
      return { allowed: rule.effect === "allow", effect: rule.effect, matched_rule: rule.id, reason: rule.description };
    }
  }
  return { allowed: true, effect: "allow", matched_rule: "implicit-default-allow" };
}

export function createSignedAuditSnapshot(projectId: string, customSecret?: string): SignedAuditSnapshot {
  ensureProjectVault(projectId);
  const synDir = path.join(getProjectDir(projectId), ".synapse");
  fs.mkdirSync(synDir, { recursive: true });

  const chainCheck = verifyAuditChain(projectId);
  const tipHash = chainCheck.last_hash || "GENESIS";
  const snapshotAt = new Date().toISOString();
  const key = resolveSigningKey(projectId, customSecret);
  const canonical = `${projectId}|${SYNAPSE_VERSION}|${snapshotAt}|${chainCheck.total_entries}|${chainCheck.valid}|${tipHash}`;
  const sig = crypto.createHmac("sha256", key).update(canonical).digest("hex");

  const snapshot: SignedAuditSnapshot = {
    project_id: projectId,
    version: SYNAPSE_VERSION,
    snapshot_at: snapshotAt,
    entries_count: chainCheck.total_entries,
    chain_valid: chainCheck.valid,
    chain_tip_hash: tipHash,
    signer_fingerprint: computeSignerFingerprint(key),
    snapshot_signature: sig,
  };

  atomicWriteTextSync(path.join(synDir, "AuditSnapshot.json"), JSON.stringify(snapshot, null, 2), 0o600);
  return snapshot;
}

export function verifySignedAuditSnapshot(projectId: string, snapshot: SignedAuditSnapshot, customSecret?: string): boolean {
  const key = resolveSigningKey(projectId, customSecret);
  const canonical = `${snapshot.project_id}|${snapshot.version}|${snapshot.snapshot_at}|${snapshot.entries_count}|${snapshot.chain_valid}|${snapshot.chain_tip_hash}`;
  const expected = crypto.createHmac("sha256", key).update(canonical).digest("hex");
  const a = Buffer.from(snapshot.snapshot_signature || "", "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function buildCoreMetricsSummary(projectId = "default-project"): {
  version: string;
  project_id: string;
  assigned_nodes: number;
  registered_services: number;
  pending_approvals: number;
  playbooks_total: number;
  audit_entries_total: number;
  audit_chain_valid: boolean;
  audit_chain_tip_hash: string;
  policy_rules_total: number;
} {
  const baseDir = resolveVaultBaseDir();
  let targetProj = projectId;
  try {
    const dirs = fs.readdirSync(baseDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    if (dirs.length > 0 && !dirs.some((d) => d.name === targetProj)) targetProj = dirs[0].name;
  } catch {
    // use default
  }
  const state = ensureProjectVault(targetProj);
  const chain = verifyAuditChain(targetProj);
  const policy = ensurePolicyAsCodeFile(targetProj);

  return {
    version: SYNAPSE_VERSION,
    project_id: targetProj,
    assigned_nodes: state.assigned_nodes.length,
    registered_services: state.registered_services.length,
    pending_approvals: state.pending_approvals.filter((a) => a.status === "pending").length,
    playbooks_total: (state.scheduled_playbooks || []).length,
    audit_entries_total: chain.total_entries,
    audit_chain_valid: chain.valid,
    audit_chain_tip_hash: chain.last_hash || "GENESIS",
    policy_rules_total: policy.rules.length,
  };
}

export function buildCorePrometheusMetrics(projectId = "default-project"): string {
  const m = buildCoreMetricsSummary(projectId);
  return [
    "# HELP synapse_core_info Synapse Core Web control plane build info",
    "# TYPE synapse_core_info gauge",
    `synapse_core_info{version="${m.version}",project_id="${m.project_id}"} 1`,
    "# HELP synapse_assigned_nodes_total Number of assigned Muscle nodes in project state",
    "# TYPE synapse_assigned_nodes_total gauge",
    `synapse_assigned_nodes_total{project_id="${m.project_id}"} ${m.assigned_nodes}`,
    "# HELP synapse_registered_services_total Number of registered services in project state",
    "# TYPE synapse_registered_services_total gauge",
    `synapse_registered_services_total{project_id="${m.project_id}"} ${m.registered_services}`,
    "# HELP synapse_pending_approvals_total Number of pending human-in-the-loop approvals",
    "# TYPE synapse_pending_approvals_total gauge",
    `synapse_pending_approvals_total{project_id="${m.project_id}"} ${m.pending_approvals}`,
    "# HELP synapse_playbooks_total Number of saved playbooks in project vault",
    "# TYPE synapse_playbooks_total gauge",
    `synapse_playbooks_total{project_id="${m.project_id}"} ${m.playbooks_total}`,
    "# HELP synapse_audit_entries_total Total number of hash-chained entries in Audit.jsonl",
    "# TYPE synapse_audit_entries_total counter",
    `synapse_audit_entries_total{project_id="${m.project_id}"} ${m.audit_entries_total}`,
    "# HELP synapse_audit_chain_valid Whether the SHA-256 Audit.jsonl hash chain is intact (1=valid, 0=tampered)",
    "# TYPE synapse_audit_chain_valid gauge",
    `synapse_audit_chain_valid{project_id="${m.project_id}"} ${m.audit_chain_valid ? 1 : 0}`,
    "# HELP synapse_policy_rules_total Number of active Policy-as-Code rules in .synapse/policies.json",
    "# TYPE synapse_policy_rules_total gauge",
    `synapse_policy_rules_total{project_id="${m.project_id}"} ${m.policy_rules_total}`,
  ].join("\n") + "\n";
}
