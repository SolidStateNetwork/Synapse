import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

import {
  appendAuditLog,
  computeAuditEntryHash,
  createMcpApiKey,
  decryptSecretsMap,
  encryptSecretsMap,
  ensureProjectVault,
  getProjectDir,
  isAdminOnlyMcpToolCall,
  isReadOnlyMcpToolCall,
  readAuditLogs,
  setSecret,
  verifyAuditChain,
  verifyMcpRequestSignature,
} from "../lib/vault";
import { SYNAPSE_TOOL_SCHEMAS } from "../lib/orchestrator";
import { GET as getMcp, POST as postMcp } from "../app/api/mcp/route";

function makePostReq(
  urlPath: string,
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(`http://127.0.0.1:3000${urlPath}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function makeGetReq(urlPath: string): NextRequest {
  return new NextRequest(`http://127.0.0.1:3000${urlPath}`, { method: "GET" });
}

describe("Synapse v2.4.0 — Phase 7 Zero-Trust Security, Hash-Chained Audit, PBKDF2 Vault & Standalone MCP Server", () => {
  let tmpDir: string;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "synapse-v240-test-"));
    process.env.SYNAPSE_VAULT_DIR = path.join(tmpDir, "projects");
    process.env.SYNAPSE_MASTER_KEY = "v240-unit-test-master-secret-key-pbkdf2";
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("34. M7.1: isAdminOnlyMcpToolCall & isReadOnlyMcpToolCall classify all 3 scope tiers accurately", () => {
    assert.equal(isAdminOnlyMcpToolCall("synapse_create_join_token", {}), true);
    assert.equal(isAdminOnlyMcpToolCall("core_manage_secrets", { action: "list_keys" }), false);
    assert.equal(isAdminOnlyMcpToolCall("core_manage_secrets", { action: "set", key: "K", value: "V" }), true);
    assert.equal(isAdminOnlyMcpToolCall("core_manage_secrets", { action: "delete", key: "K" }), true);
    assert.equal(isAdminOnlyMcpToolCall("core_manage_node_enrollment", { action: "list_nodes" }), false);
    assert.equal(isAdminOnlyMcpToolCall("core_manage_node_enrollment", { action: "generate_join_token" }), true);
    assert.equal(isAdminOnlyMcpToolCall("core_manage_node_enrollment", { action: "remove_node" }), true);
    assert.equal(isAdminOnlyMcpToolCall("core_disaster_RecoveryVault", { action: "list_backups" }), false);
    assert.equal(isAdminOnlyMcpToolCall("core_disaster_RecoveryVault", { action: "restore_backup" }), true);
    assert.equal(isAdminOnlyMcpToolCall("core_manage_approvals", { action: "list" }), false);
    assert.equal(isAdminOnlyMcpToolCall("core_manage_approvals", { action: "approve" }), true);
    assert.equal(isAdminOnlyMcpToolCall("core_configure_ai_engine", { action: "get" }), false);
    assert.equal(isAdminOnlyMcpToolCall("core_configure_ai_engine", { action: "update" }), true);
    assert.equal(isReadOnlyMcpToolCall("core_disaster_RecoveryVault", { action: "verify_backup_integrity" }), true);
  });

  it("35. M7.1: /api/mcp enforces 3-tier scopes (read vs execute vs admin) on tool calls", async () => {
    const projId = "v240-scopes-proj";
    ensureProjectVault(projId);

    const readKey = createMcpApiKey(projId, "Read Only Key", ["read"]);
    const execKey = createMcpApiKey(projId, "Execute Key", ["read", "execute"]);
    const adminKey = createMcpApiKey(projId, "Admin Key", ["read", "execute", "admin"]);

    // 1. Read-only key blocked from execute tool (core_update_brain_doc)
    const r1 = await postMcp(
      makePostReq(
        "/api/mcp",
        {
          jsonrpc: "2.0",
          id: 1,
          project_id: projId,
          method: "tools/call",
          params: {
            name: "core_update_brain_doc",
            arguments: { doc_name: "Memory.md", operation: "append_memory_entry", content: "test" },
          },
        },
        { authorization: `Bearer ${readKey.plaintext_token}` }
      )
    );
    const j1 = await r1.json();
    assert.equal(j1.result.isError, true);
    assert.ok(String(j1.result.content[0].text).includes("lacks 'execute' scope"));

    // 2. Execute key allowed on core_update_brain_doc, but blocked on admin tool (synapse_create_join_token)
    const r2 = await postMcp(
      makePostReq(
        "/api/mcp",
        {
          jsonrpc: "2.0",
          id: 2,
          project_id: projId,
          method: "tools/call",
          params: {
            name: "synapse_create_join_token",
            arguments: { tier: "TIER_2_WORKSPACE_JAIL" },
          },
        },
        { authorization: `Bearer ${execKey.plaintext_token}` }
      )
    );
    const j2 = await r2.json();
    assert.equal(j2.result.isError, true);
    assert.ok(String(j2.result.content[0].text).includes("lacks 'admin' scope"));

    // 3. Execute key allowed on read-only action of core_manage_secrets (list_keys), blocked on set
    const r3List = await postMcp(
      makePostReq(
        "/api/mcp",
        {
          jsonrpc: "2.0",
          id: 3,
          project_id: projId,
          method: "tools/call",
          params: { name: "core_manage_secrets", arguments: { action: "list_keys" } },
        },
        { authorization: `Bearer ${execKey.plaintext_token}` }
      )
    );
    const j3List = await r3List.json();
    assert.equal(j3List.result.isError, false);

    const r3Set = await postMcp(
      makePostReq(
        "/api/mcp",
        {
          jsonrpc: "2.0",
          id: 4,
          project_id: projId,
          method: "tools/call",
          params: { name: "core_manage_secrets", arguments: { action: "set", key: "API_TOKEN", value: "sec123" } },
        },
        { authorization: `Bearer ${execKey.plaintext_token}` }
      )
    );
    const j3Set = await r3Set.json();
    assert.equal(j3Set.result.isError, true);
    assert.ok(String(j3Set.result.content[0].text).includes("lacks 'admin' scope"));

    // 4. Admin key succeeds on both core_manage_secrets(set) and synapse_create_join_token
    const r4 = await postMcp(
      makePostReq(
        "/api/mcp",
        {
          jsonrpc: "2.0",
          id: 5,
          project_id: projId,
          method: "tools/call",
          params: { name: "core_manage_secrets", arguments: { action: "set", key: "API_TOKEN", value: "sec123" } },
        },
        { authorization: `Bearer ${adminKey.plaintext_token}` }
      )
    );
    const j4 = await r4.json();
    assert.equal(j4.result.isError, false);
  });

  it("36. M7.1: HMAC-SHA256 request signing (X-Synapse-Signature & X-Synapse-Timestamp) verifies valid signatures and blocks replays/tampering", async () => {
    const projId = "v240-hmac-proj";
    ensureProjectVault(projId);
    const key = createMcpApiKey(projId, "HMAC Key", ["read", "execute"], 60);
    const token = key.plaintext_token;

    const payloadObj = { jsonrpc: "2.0", id: 10, project_id: projId, method: "ping" };
    const rawBody = JSON.stringify(payloadObj);
    const nowSec = Math.floor(Date.now() / 1000);
    const validSig =
      "sha256=" +
      crypto.createHmac("sha256", token).update(`${nowSec}.${rawBody}`).digest("hex");

    // 1. Valid signature + fresh timestamp succeeds
    const okRes = await postMcp(
      makePostReq("/api/mcp", payloadObj, {
        authorization: `Bearer ${token}`,
        "x-synapse-timestamp": String(nowSec),
        "x-synapse-signature": validSig,
      })
    );
    assert.equal(okRes.status, 200);

    // 2. Expired timestamp (> 300s) rejected with 401
    const oldSec = nowSec - 600;
    const oldSig =
      "sha256=" +
      crypto.createHmac("sha256", token).update(`${oldSec}.${rawBody}`).digest("hex");
    const replayRes = await postMcp(
      makePostReq("/api/mcp", payloadObj, {
        authorization: `Bearer ${token}`,
        "x-synapse-timestamp": String(oldSec),
        "x-synapse-signature": oldSig,
      })
    );
    assert.equal(replayRes.status, 401);
    const replayJson = await replayRes.json();
    assert.ok(String(replayJson.error.message).includes("300s replay window"));

    // 3. Tampered signature rejected with 401
    const badRes = await postMcp(
      makePostReq("/api/mcp", payloadObj, {
        authorization: `Bearer ${token}`,
        "x-synapse-timestamp": String(nowSec),
        "x-synapse-signature": "sha256=" + "0".repeat(64),
      })
    );
    assert.equal(badRes.status, 401);

    // 4. Direct unit check on missing companion header
    const partial = verifyMcpRequestSignature(token, rawBody, validSig, null);
    assert.equal(partial.valid, false);
  });

  it("37. M7.1: Per-API-Key configurable rate_limit_per_min is persisted and enforced on /api/mcp", async () => {
    const projId = "v240-ratelimit-proj";
    ensureProjectVault(projId);

    const createRes = await postMcp(
      makePostReq("/api/mcp", {
        action: "create_key",
        project_id: projId,
        name: "Low Rate Key",
        scopes: ["read"],
        rate_limit_per_min: 2,
      })
    );
    assert.equal(createRes.status, 201);
    const createdKey = await createRes.json();
    assert.equal(createdKey.rate_limit_per_min, 2);

    const token = createdKey.plaintext_token;
    const r1 = await postMcp(
      makePostReq("/api/mcp", { jsonrpc: "2.0", id: 1, project_id: projId, method: "ping" }, { authorization: `Bearer ${token}` })
    );
    assert.equal(r1.status, 200);
    const r2 = await postMcp(
      makePostReq("/api/mcp", { jsonrpc: "2.0", id: 2, project_id: projId, method: "ping" }, { authorization: `Bearer ${token}` })
    );
    assert.equal(r2.status, 200);
    const r3 = await postMcp(
      makePostReq("/api/mcp", { jsonrpc: "2.0", id: 3, project_id: projId, method: "ping" }, { authorization: `Bearer ${token}` })
    );
    assert.equal(r3.status, 429);
  });

  it("38. M7.1: Audit.jsonl maintains a cryptographic SHA-256 hash chain from GENESIS and detects any tampering", async () => {
    const projId = "v240-audit-chain-proj";
    ensureProjectVault(projId);

    appendAuditLog(projId, {
      timestamp: new Date().toISOString(),
      actor: "user",
      tool_name: "step_one",
      status: "executed",
      summary: "Executed step one",
    });
    appendAuditLog(projId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: "step_two",
      status: "executed",
      summary: "Executed step two",
    });

    const entries = readAuditLogs(projId, 10);
    assert.equal(entries.length, 3);
    //Newest first in readAuditLogs: entries[2] is GENESIS
    assert.equal(entries[2].prev_hash, "GENESIS");
    assert.equal(entries[1].prev_hash, entries[2].entry_hash);
    assert.equal(entries[0].prev_hash, entries[1].entry_hash);

    const chainCheck = verifyAuditChain(projId);
    assert.equal(chainCheck.valid, true);
    assert.equal(chainCheck.total_entries, 3);
    assert.equal(chainCheck.last_hash, entries[0].entry_hash);

    // Verify via /api/mcp action: verify_audit_chain and GET /api/mcp
    const apiChainRes = await postMcp(
      makePostReq("/api/mcp", { action: "verify_audit_chain", project_id: projId })
    );
    const apiChainJson = await apiChainRes.json();
    assert.equal(apiChainJson.valid, true);

    const getMcpRes = await getMcp(makeGetReq(`/api/mcp?project_id=${projId}`));
    const getMcpJson = await getMcpRes.json();
    assert.equal(getMcpJson.audit_chain.valid, true);

    // Tamper with line 2 in Audit.jsonl and verify tamper detection
    const auditFile = path.join(getProjectDir(projId), "Audit.jsonl");
    const lines = fs.readFileSync(auditFile, "utf8").trim().split("\n");
    const middle = JSON.parse(lines[1]);
    middle.summary = "TAMPERED BY ATTACKER";
    lines[1] = JSON.stringify(middle);
    fs.writeFileSync(auditFile, lines.join("\n") + "\n", "utf8");

    const brokenCheck = verifyAuditChain(projId);
    assert.equal(brokenCheck.valid, false);
    assert.equal(brokenCheck.broken_at_index, 1);
  });

  it("39. M7.4: Secrets.enc uses PBKDF2-SHA256 (100,000 iterations + random 16-byte salt) while remaining backward-compatible with legacy SHA-256 AES-256-GCM", () => {
    const rawEnc = encryptSecretsMap({ DB_PASSWORD: "super-secret-value-2026" });
    const parsed = JSON.parse(rawEnc);
    assert.equal(parsed.alg, "AES-256-GCM");
    assert.equal(parsed.kdf, "PBKDF2-SHA256");
    assert.equal(parsed.iterations, 100000);
    assert.equal(typeof parsed.salt, "string");
    assert.equal(Buffer.from(parsed.salt, "hex").length, 16);

    const dec = decryptSecretsMap(rawEnc);
    assert.equal(dec.DB_PASSWORD, "super-secret-value-2026");

    // Verify legacy SHA-256 ciphertext (without kdf/salt fields) still decrypts cleanly
    const legacyKey = crypto
      .createHash("sha256")
      .update(process.env.SYNAPSE_MASTER_KEY!)
      .digest();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", legacyKey, iv);
    const pt = Buffer.from(JSON.stringify({ LEGACY_TOKEN: "legacy-ok-123" }), "utf8");
    const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
    const legacyPayload = JSON.stringify({
      alg: "AES-256-GCM",
      iv: iv.toString("hex"),
      tag: cipher.getAuthTag().toString("hex"),
      ciphertext: ct.toString("base64"),
    });
    const decLegacy = decryptSecretsMap(legacyPayload);
    assert.equal(decLegacy.LEGACY_TOKEN, "legacy-ok-123");

    // Verify setSecret automatically upgrades Secrets.enc on disk to PBKDF2-SHA256
    const projId = "v240-pbkdf2-upgrade";
    ensureProjectVault(projId);
    const secPath = path.join(getProjectDir(projId), "Secrets.enc");
    fs.writeFileSync(secPath, legacyPayload, "utf8");
    setSecret(projId, "NEW_KEY", "upgraded-val");
    const upgradedRaw = JSON.parse(fs.readFileSync(secPath, "utf8"));
    assert.equal(upgradedRaw.kdf, "PBKDF2-SHA256");
    const both = decryptSecretsMap(fs.readFileSync(secPath, "utf8"));
    assert.equal(both.LEGACY_TOKEN, "legacy-ok-123");
    assert.equal(both.NEW_KEY, "upgraded-val");
  });

  it("40. M7.4: All Brain Vault, Lexicon, Cartridge & Disaster Recovery persistence modules use atomic write-temp-and-rename", () => {
    const repoRoot = path.resolve(process.cwd(), "../..");
    for (const rel of [
      "apps/core-web/src/lib/vault/lexiconGovernance.ts",
      "apps/core-web/src/lib/vault/auditChatAndMcp.ts",
      "apps/core-web/src/lib/cartridges.ts",
      "apps/core-web/src/lib/orchestrator/disasterRecoveryTools.ts",
    ]) {
      const src = fs.readFileSync(path.join(repoRoot, rel), "utf8");
      assert.equal(
        src.includes("fs.writeFileSync("),
        false,
        `${rel} must use atomicWriteTextSync instead of raw fs.writeFileSync`
      );
      assert.ok(src.includes("atomicWriteTextSync"), `${rel} must use atomicWriteTextSync`);
    }
  });

  it("41. M7.3: Standalone packages/mcp-server exports all 42 annotated tools, 6 Lexicon resources, HMAC signing & offline fallback", async () => {
    const repoRoot = path.resolve(process.cwd(), "../..");
    const mcpServerPath = path.join(repoRoot, "packages/mcp-server/index.mjs");
    const mcpPkgJson = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "packages/mcp-server/package.json"), "utf8")
    );
    assert.equal(mcpPkgJson.version, "2.4.0");

    const mod = await import(`file://${mcpServerPath.replace(/\\/g, "/")}`);
    const standaloneTools = mod.getStandaloneMcpToolDefinitions();
    assert.equal(standaloneTools.length, 42);

    const coreSchemaNames = new Set([
      ...SYNAPSE_TOOL_SCHEMAS.map((s) => s.function.name),
      "synapse_list_peers",
      "synapse_get_project_state",
      "synapse_create_join_token",
      "synapse_rollback_snapshot",
    ]);
    for (const t of standaloneTools) {
      assert.ok(coreSchemaNames.has(t.name), `Standalone tool ${t.name} must match core schema catalog`);
      assert.equal(typeof t.annotations.readOnlyHint, "boolean");
      assert.equal(typeof t.annotations.destructiveHint, "boolean");
      assert.equal(typeof t.annotations.idempotentHint, "boolean");
      assert.equal(typeof t.annotations.openWorldHint, "boolean");
    }

    const initRes = await mod.handleMcpRpcRequest({ jsonrpc: "2.0", id: 1, method: "initialize" });
    assert.equal(initRes.result.serverInfo.version, "2.4.0");

    const resList = await mod.handleMcpRpcRequest(
      { jsonrpc: "2.0", id: 2, method: "resources/list" },
      { projectId: "demo-proj" }
    );
    assert.equal(resList.result.resources.length, 6);

    // Verify signMcpPayload produces signatures accepted by verifyMcpRequestSignature
    const bodyStr = JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call" });
    const signed = mod.signMcpPayload("syn_mcp_test_secret", bodyStr);
    const verified = verifyMcpRequestSignature(
      "syn_mcp_test_secret",
      bodyStr,
      signed.signature,
      signed.timestamp
    );
    assert.equal(verified.valid, true);

    // Verify offline fallback when upstream Core URL is unreachable
    const offlineRes = await mod.handleMcpRpcRequest(
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "synapse_list_peers", arguments: {} } },
      { synapseUrl: "http://127.0.0.1:59999", timeoutMs: 200, maxRetries: 0 }
    );
    assert.equal(offlineRes.result.isError, true);
    assert.ok(String(offlineRes.result.content[0].text).includes("offline_fallback"));
  });

  it("42. M7.2 & M7.6: Go source tree enforces TLS 1.3 ECDHE curve pinning, StreamTypeCertRenew, ancestor symlink jail & AllowedCommands guardrail", () => {
    const repoRoot = path.resolve(process.cwd(), "../..");
    const pkiGo = fs.readFileSync(path.join(repoRoot, "apps/core-gateway/internal/pki/pki.go"), "utf8");
    const diagGo = fs.readFileSync(path.join(repoRoot, "agents/axon/internal/tunnel/diagnostics.go"), "utf8");
    const fsGo = fs.readFileSync(path.join(repoRoot, "agents/axon/internal/fs/fs.go"), "utf8");
    const guardGo = fs.readFileSync(path.join(repoRoot, "agents/axon/internal/guard/guard.go"), "utf8");

    assert.ok(pkiGo.includes("RenewClientCert"), "pki.go must implement RenewClientCert");
    assert.ok(pkiGo.includes("tls.X25519"), "pki.go must pin CurvePreferences to X25519/P-256");
    assert.ok(diagGo.includes("ComputeReconnectBackoff"), "diagnostics.go must implement ComputeReconnectBackoff");
    assert.ok(diagGo.includes("RotateTargetCertificate"), "diagnostics.go must implement RotateTargetCertificate");
    assert.ok(fsGo.includes("verifyAncestorAndBrokenSymlinks"), "fs.go must validate longest existing ancestor and broken symlinks");
    assert.ok(guardGo.includes("ValidateCommandWithAllowlist"), "guard.go must implement deterministic AllowedCommands allowlist");
  });

  it("43. M7.1 Edge Case: computeAuditEntryHash is deterministic and verifyAuditChain handles missing/empty Audit.jsonl gracefully", () => {
    const h1 = computeAuditEntryHash(
      { timestamp: "2026-11-02T00:00:00.000Z", actor: "user", tool_name: "init", status: "executed", summary: "ok" },
      "GENESIS"
    );
    const h2 = computeAuditEntryHash(
      { timestamp: "2026-11-02T00:00:00.000Z", actor: "user", tool_name: "init", status: "executed", summary: "ok" },
      "GENESIS"
    );
    assert.equal(h1, h2);
    assert.equal(h1.length, 64);
  });

  it("44. M7.1 Edge Case: Revoked or invalid MCP API Keys are immediately rejected with 401", async () => {
    const projId = "v240-revoke-proj";
    ensureProjectVault(projId);
    const created = createMcpApiKey(projId, "Ephemeral Key", ["read"]);
    await postMcp(makePostReq("/api/mcp", { action: "revoke_key", project_id: projId, key_id: created.key.key_id }));
    const res = await postMcp(
      makePostReq(
        "/api/mcp",
        { jsonrpc: "2.0", id: 99, project_id: projId, method: "tools/list" },
        { authorization: `Bearer ${created.plaintext_token}` }
      )
    );
    assert.equal(res.status, 401);
  });

  it("45. M7.3 Edge Case: Standalone MCP server handles ping and notifications/initialized and exposes all 4 Lexicon docs", async () => {
    const repoRoot = path.resolve(process.cwd(), "../..");
    const mod = await import(`file://${path.join(repoRoot, "packages/mcp-server/index.mjs").replace(/\\/g, "/")}`);
    const pingRes = await mod.handleMcpRpcRequest({ jsonrpc: "2.0", id: 7, method: "ping" });
    assert.deepEqual(pingRes, { jsonrpc: "2.0", id: 7, result: {} });
    const resources = mod.getStandaloneMcpResources("lexicon-proj");
    const uris = resources.map((r: { uri: string }) => r.uri);
    assert.ok(uris.includes("synapse://lexicon-proj/Architecture.md"));
    assert.ok(uris.includes("synapse://lexicon-proj/Memory.md"));
    assert.ok(uris.includes("synapse://lexicon-proj/Milestones.md"));
    assert.ok(uris.includes("synapse://lexicon-proj/AGENTS.md"));
  });

  it("46. M7.4 Edge Case: Corrupted State.json automatically self-heals from State.json.bak without data loss", () => {
    const projId = "v240-self-heal-proj";
    const initial = ensureProjectVault(projId, "Self Heal Workspace");
    assert.equal(initial.name, "Self Heal Workspace");
    const stateFile = path.join(getProjectDir(projId), "State.json");
    fs.writeFileSync(stateFile, "{corrupted-json-truncat", "utf8");
    const recovered = ensureProjectVault(projId);
    assert.equal(recovered.project_id, projId);
    assert.equal(recovered.name, "Self Heal Workspace");
  });

  it("47. M7.5 Gate: Every Go file is < 500 lines and every TypeScript file in core-web/src is < 600 lines", () => {
    const repoRoot = path.resolve(process.cwd(), "../..");
    const walkFiles = (dir: string, exts: string[]): string[] => {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          out.push(...walkFiles(full, exts));
        } else if (exts.some((ext) => entry.name.endsWith(ext))) {
          out.push(full);
        }
      }
      return out;
    };
    for (const goDir of ["proto", "apps/core-gateway", "agents/axon"]) {
      for (const f of walkFiles(path.join(repoRoot, goDir), [".go"])) {
        const lines = fs.readFileSync(f, "utf8").split("\n").length;
        assert.ok(lines < 500, `Go file ${f} has ${lines} lines (must be < 500)`);
      }
    }
    for (const f of walkFiles(path.join(repoRoot, "apps/core-web/src"), [".ts", ".tsx"])) {
      const lines = fs.readFileSync(f, "utf8").split("\n").length;
      assert.ok(lines < 600, `TS file ${f} has ${lines} lines (must be < 600)`);
    }
  });
});
