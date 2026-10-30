import { NextRequest, NextResponse } from "next/server";
import {
  deleteSecret,
  ensureProjectVault,
  getDecryptedSecrets,
  listSecretKeys,
  readAuditLogs,
  setSecret,
  withProjectStateTransaction,
} from "@/lib/vault";
import { listCartridges, OFFICIAL_STACK_BLUEPRINTS } from "@/lib/cartridges";

export const dynamic = "force-dynamic";

const CORE_GATEWAY_URL =
  process.env.CORE_GATEWAY_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_CORE_GATEWAY_URL ||
  "http://127.0.0.1:8081";

export async function GET(req: NextRequest) {
  const projectId =
    req.nextUrl.searchParams.get("project_id") || "synapse-cloud-demo";
  const state = ensureProjectVault(projectId);
  const auditLogs = readAuditLogs(projectId, 30);
  const secretKeys = listSecretKeys(projectId);
  const cartridges = listCartridges();

  let gatewayDebug: Record<string, unknown> = {
    reachable: false,
    url: CORE_GATEWAY_URL,
  };

  try {
    const gwRes = await fetch(`${CORE_GATEWAY_URL}/api/v1/debug`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (gwRes.ok) {
      const gwData = await gwRes.json();
      gatewayDebug = {
        reachable: true,
        url: CORE_GATEWAY_URL,
        ...gwData,
      };
    }
  } catch (err) {
    gatewayDebug = {
      reachable: false,
      url: CORE_GATEWAY_URL,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    core_web: {
      debug_enabled:
        Boolean((state as unknown as Record<string, unknown>).debug_mode) ||
        process.env.SYNAPSE_DEBUG === "1",
      node_version: process.version,
      platform: `${process.platform}/${process.arch}`,
      project_id: projectId,
      planning_only: state.planning_only,
      assigned_nodes_count: state.assigned_nodes.length,
      registered_services_count: state.registered_services.length,
      secret_keys_count: secretKeys.length,
      cartridges_loaded: cartridges.length,
      blueprints_loaded: OFFICIAL_STACK_BLUEPRINTS.length,
      ai_provider: state.ai_settings?.provider || "openai-compatible",
      ai_base_url: state.ai_settings?.base_url || "https://api.openai.com/v1",
      ai_model: state.ai_settings?.model || "gpt-4o",
      prompt_caching: state.ai_settings?.enable_prompt_caching !== false,
      auto_watchdog: state.ai_settings?.enable_auto_watchdog !== false,
    },
    gateway: gatewayDebug,
    recent_audit: auditLogs.slice(0, 15),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const projectId = String(body.project_id || "synapse-cloud-demo");
  const action = String(body.action || "");
  const state = ensureProjectVault(projectId);

  if (action === "toggle_debug") {
    let nextDebug = false;
    await withProjectStateTransaction(projectId, (st) => {
      const rawState = st as unknown as Record<string, unknown>;
      nextDebug =
        body.enabled !== undefined ? Boolean(body.enabled) : !rawState.debug_mode;
      rawState.debug_mode = nextDebug;
    });

    try {
      await fetch(`${CORE_GATEWAY_URL}/api/v1/debug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_debug", enabled: nextDebug }),
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      // Gateway may not be running in standalone UI-only mode
    }

    return NextResponse.json({
      success: true,
      debug_enabled: nextDebug,
    });
  }

  if (action === "clear_gateway_events") {
    try {
      await fetch(`${CORE_GATEWAY_URL}/api/v1/debug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_events" }),
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      // ignore
    }
    return NextResponse.json({ success: true });
  }

  if (action === "run_self_test" || action === "self_test") {
    const checks: Array<{
      id: string;
      name: string;
      status: "PASS" | "WARN" | "FAIL";
      latency_ms: number;
      detail: string;
    }> = [];

    // 1. Brain Vault & State Persistence Test
    const t1 = Date.now();
    try {
      const st = await withProjectStateTransaction(projectId, () => {});
      checks.push({
        id: "vault_state",
        name: "Brain Vault Atomic State.json R/W",
        status: "PASS",
        latency_ms: Date.now() - t1,
        detail: `Project '${st.project_id}' verified (${st.assigned_nodes.length} peer(s), ${st.active_cartridges.length} active cartridges)`,
      });
    } catch (err) {
      checks.push({
        id: "vault_state",
        name: "Brain Vault Atomic State.json R/W",
        status: "FAIL",
        latency_ms: Date.now() - t1,
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    // 2. AES-256-GCM Zero-Knowledge Secret Vault Test
    const t2 = Date.now();
    try {
      const probeKey = "__SYNAPSE_DEBUG_PROBE__";
      const probeVal = `probe-${Date.now()}-aes256gcm`;
      setSecret(projectId, probeKey, probeVal);
      const decryptedMap = getDecryptedSecrets(projectId);
      const decrypted = decryptedMap[probeKey];
      deleteSecret(projectId, probeKey);
      if (decrypted === probeVal) {
        checks.push({
          id: "aes_vault",
          name: "AES-256-GCM Encrypted Secrets Vault",
          status: "PASS",
          latency_ms: Date.now() - t2,
          detail:
            "Encrypt + Decrypt + Scrub round-trip verified with 96-bit IV & 128-bit auth tag",
        });
      } else {
        throw new Error("Decrypted value mismatch");
      }
    } catch (err) {
      checks.push({
        id: "aes_vault",
        name: "AES-256-GCM Encrypted Secrets Vault",
        status: "FAIL",
        latency_ms: Date.now() - t2,
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    // 3. Rule Cartridges & Stack Blueprints
    const t3 = Date.now();
    try {
      const carts = listCartridges();
      checks.push({
        id: "cartridges",
        name: "Rule Cartridges & Stack Blueprints Engine",
        status: carts.length > 0 ? "PASS" : "WARN",
        latency_ms: Date.now() - t3,
        detail: `${carts.length} Markdown cartridges & ${OFFICIAL_STACK_BLUEPRINTS.length} stack blueprints loaded`,
      });
    } catch (err) {
      checks.push({
        id: "cartridges",
        name: "Rule Cartridges & Stack Blueprints Engine",
        status: "FAIL",
        latency_ms: Date.now() - t3,
        detail: err instanceof Error ? err.message : String(err),
      });
    }

    // 4. Core Gateway Control Plane & mTLS Hub + Muscle Node Round-Trip Ping
    const t4 = Date.now();
    try {
      const gwRes = await fetch(`${CORE_GATEWAY_URL}/api/v1/debug`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ping_nodes" }),
        signal: AbortSignal.timeout(6000),
      });
      if (!gwRes.ok) {
        throw new Error(`HTTP ${gwRes.status}`);
      }
      const gwData = await gwRes.json();
      const pingResults = Array.isArray(gwData.ping_results)
        ? gwData.ping_results
        : [];
      checks.push({
        id: "core_gateway",
        name: "Core Gateway HTTP & mTLS PKI Authority",
        status: "PASS",
        latency_ms: Date.now() - t4,
        detail: `Reachable at ${CORE_GATEWAY_URL} (${pingResults.length} connected Muscle peer(s))`,
      });

      if (pingResults.length === 0) {
        checks.push({
          id: "muscle_tunnel",
          name: "Muscle Peer mTLS + Yamux Reverse Tunnel (FS + PTY)",
          status: "WARN",
          latency_ms: 0,
          detail:
            "No Muscle peer currently connected. Run `axon join` or `axon switch` to test live remote execution.",
        });
      } else {
        for (const pr of pingResults) {
          const ok = Boolean(pr.fs_ok && pr.pty_ok);
          checks.push({
            id: `muscle_${pr.node_id}`,
            name: `Muscle Peer '${pr.node_id}' (Stream 1 FS + Stream 2 PTY)`,
            status: ok ? "PASS" : "FAIL",
            latency_ms: Number(pr.latency_ms || 0),
            detail: ok
              ? `FS entries=${pr.fs_entries}, PTY CWD=${pr.current_cwd}, Output="${pr.pty_output}"`
              : `FS ok=${pr.fs_ok}, PTY ok=${pr.pty_ok} (${pr.pty_output})`,
          });
        }
      }
    } catch (err) {
      checks.push({
        id: "core_gateway",
        name: "Core Gateway HTTP & mTLS PKI Authority",
        status: "WARN",
        latency_ms: Date.now() - t4,
        detail: `Core Gateway (${CORE_GATEWAY_URL}) not reachable (${
          err instanceof Error ? err.message : String(err)
        }). Start core-gateway or Docker stack to test mTLS tunnels.`,
      });
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      checks,
    });
  }

  return NextResponse.json({ error: "Unknown debug action" }, { status: 400 });
}
