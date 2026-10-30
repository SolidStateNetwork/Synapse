import crypto from "crypto";
import type { AutonomyTier, PtyExecResponse } from "@proto/tunnel";
import {
  appendAuditLog,
  listSecretKeys,
  readAuditLogs,
  readBrainDoc,
  type ProjectState,
} from "@/lib/vault";
import { listCartridges } from "@/lib/cartridges";
import { safeFetchJson } from "../safeFetch";
import type { ToolDispatchResult } from "@/lib/orchestrator";

export function executeCoreVaultSearch(
  projectId: string,
  state: ProjectState,
  toolName: string,
  args: Record<string, unknown>
): ToolDispatchResult {
  const rawQuery = String(args.query || "").trim();
  const scope = String(args.scope || "all").toLowerCase();
  const archDoc = readBrainDoc(projectId, "Architecture.md");
  const memDoc = readBrainDoc(projectId, "Memory.md");
  const auditLogs = readAuditLogs(projectId, 80);
  const cartridges = listCartridges();
  const secretKeys = listSecretKeys(projectId);

  const filterLines = (text: string, q: string): string[] => {
    if (!q) return text.split("\n").slice(0, 60);
    try {
      const rx = new RegExp(q, "i");
      const lines = text.split("\n");
      const matched: string[] = [];
      lines.forEach((line, idx) => {
        if (rx.test(line)) {
          const start = Math.max(0, idx - 1);
          const end = Math.min(lines.length - 1, idx + 1);
          matched.push(
            lines
              .slice(start, end + 1)
              .map((l, i) => `L${start + i + 1}: ${l}`)
              .join("\n")
          );
        }
      });
      return matched.slice(0, 30);
    } catch {
      return text
        .split("\n")
        .filter((l) => l.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 30);
    }
  };

  const resultPayload: Record<string, unknown> = {
    project_id: projectId,
    query: rawQuery || "*",
    scope,
  };

  if (scope === "all" || scope === "services") {
    resultPayload.registered_services = state.registered_services.filter(
      (s) =>
        !rawQuery ||
        JSON.stringify(s).toLowerCase().includes(rawQuery.toLowerCase())
    );
    resultPayload.assigned_nodes = state.assigned_nodes;
    resultPayload.peer_mesh_links = state.peer_mesh_links || [];
    resultPayload.scheduled_playbooks = state.scheduled_playbooks || [];
    resultPayload.secret_keys_available = secretKeys;
  }

  if (scope === "all" || scope === "architecture") {
    resultPayload.architecture_matches = filterLines(archDoc, rawQuery);
  }

  if (scope === "all" || scope === "memory") {
    resultPayload.memory_matches = filterLines(memDoc, rawQuery);
  }

  if (scope === "all" || scope === "audit") {
    resultPayload.recent_audit_matches = auditLogs
      .filter(
        (a) =>
          !rawQuery ||
          JSON.stringify(a).toLowerCase().includes(rawQuery.toLowerCase())
      )
      .slice(0, 15)
      .map((a) => ({
        timestamp: a.timestamp,
        actor: a.actor,
        tool_name: a.tool_name,
        node_id: a.node_id,
        status: a.status,
        summary: a.summary,
      }));
  }

  if (scope === "all" || scope === "cartridges") {
    resultPayload.active_cartridges = state.active_cartridges;
    resultPayload.available_cartridges = cartridges.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      active: state.active_cartridges.includes(c.id),
      description: c.description,
    }));
  }

  appendAuditLog(projectId, {
    timestamp: new Date().toISOString(),
    actor: "ai_orchestrator",
    tool_name: toolName,
    status: "executed",
    summary: `Vault search (scope=${scope}, query='${rawQuery || "*"}')`,
    args,
  });

  return {
    tool_name: toolName,
    status: "executed",
    output: resultPayload,
  };
}

export async function executeNodeDeepSearch(
  coreGatewayUrl: string,
  projectId: string,
  state: ProjectState,
  targetNodeId: string,
  tier: AutonomyTier,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolDispatchResult> {
  const searchMode = String(args.search_mode || "process_and_port_map");
  const rawQuery = String(args.query || "").trim();
  const targetDir = String(args.target_dir || `/opt/axon/workspaces`).trim();
  const fileGlob = String(args.file_glob || "").trim();
  const contextLines = Math.max(
    0,
    Math.min(10, Number(args.context_lines ?? 2))
  );
  const registeredPorts = state.registered_services
    .filter((s) => s.node_id === targetNodeId)
    .map((s) => s.port);

  const pyScript = `
import os, sys, glob, re, json, sqlite3, subprocess, time, urllib.request

MODE = ${JSON.stringify(searchMode)}
QUERY = ${JSON.stringify(rawQuery)}
TARGET_DIR = ${JSON.stringify(targetDir)}
FILE_GLOB = ${JSON.stringify(fileGlob)}
CTX = ${JSON.stringify(contextLines)}
REG_PORTS = ${JSON.stringify(registeredPorts)}

def sh(cmd, timeout=12):
    try:
        out = subprocess.check_output(cmd, shell=True, stderr=subprocess.STDOUT, timeout=timeout, text=True)
        return out.strip()
    except subprocess.CalledProcessError as e:
        return (e.output or "").strip()
    except Exception as e:
        return f"[error: {e}]"

if MODE == "content_grep":
    print(f"=== [DEEP CONTENT GREP] dir={TARGET_DIR} query={QUERY!r} glob={FILE_GLOB!r} ===")
    pattern = QUERY or "def |class |PORT|http|sqlite|error|listen"
    try:
        rx = re.compile(pattern, re.IGNORECASE)
    except Exception:
        rx = re.compile(re.escape(pattern), re.IGNORECASE)
    matches = 0
    for root, dirs, files in os.walk(TARGET_DIR):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "__pycache__", ".next", "venv")]
        for f in sorted(files):
            if f == ".synapse_deep_search.py":
                continue
            if FILE_GLOB and not glob.fnmatch.fnmatch(f, FILE_GLOB):
                continue
            fp = os.path.join(root, f)
            try:
                if os.path.getsize(fp) > 2_000_000:
                    continue
                with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                    lines = fh.readlines()
                for idx, line in enumerate(lines):
                    if rx.search(line):
                        matches += 1
                        start = max(0, idx - CTX)
                        end = min(len(lines), idx + CTX + 1)
                        snippet = "".join(f"  L{i+1}: {lines[i]}" for i in range(start, end))
                        print(f"\\n[MATCH #{matches}] {fp}:{idx+1}\\n{snippet.rstrip()}")
                        if matches >= 80:
                            break
            except Exception:
                pass
        if matches >= 80:
            break
    if matches == 0:
        print("No matching lines found.")

elif MODE == "file_find":
    print(f"=== [DEEP FILE & DIRECTORY INVENTORY] dir={TARGET_DIR} filter={QUERY or FILE_GLOB or '*'} ===")
    count = 0
    for root, dirs, files in os.walk(TARGET_DIR):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "__pycache__", ".next")]
        for f in sorted(files):
            if f == ".synapse_deep_search.py":
                continue
            fp = os.path.join(root, f)
            if FILE_GLOB and not glob.fnmatch.fnmatch(f, FILE_GLOB):
                continue
            if QUERY and QUERY.lower() not in fp.lower():
                continue
            try:
                st = os.stat(fp)
                mode_oct = oct(st.st_mode & 0o777)
                mtime = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(st.st_mtime))
                line_info = ""
                if st.st_size < 500_000 and not fp.endswith((".db", ".sqlite", ".png", ".jpg", ".gz")):
                    with open(fp, "rb") as bf:
                        line_info = f" ({bf.read().count(b'\\n') + 1} lines)"
                print(f"{mode_oct} | {st.st_size:>8} bytes | {mtime} | {fp}{line_info}")
                count += 1
            except Exception:
                pass
    print(f"Total files matched: {count}")

elif MODE == "log_scan":
    print(f"=== [DEEP LOG & JOURNAL FORENSICS] query={QUERY or 'ERROR|WARN|Traceback|Exception|CRITICAL|Fail'} ===")
    pat = QUERY or r"error|warn|traceback|exception|critical|fail|panic|killed|refused"
    rx = re.compile(pat, re.IGNORECASE)
    log_dirs = [TARGET_DIR, "/tmp", "/var/log"]
    seen = set()
    for d in log_dirs:
        if not os.path.exists(d):
            continue
        for root, dirs, files in os.walk(d):
            if root.count(os.sep) - d.count(os.sep) > 3:
                continue
            for f in sorted(files):
                if not (f.endswith(".log") or "synapse" in f or "axon" in f or f in ("syslog", "auth.log", "dmesg")):
                    continue
                fp = os.path.join(root, f)
                if fp in seen:
                    continue
                seen.add(fp)
                try:
                    with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                        lines = fh.readlines()
                    hits = [f"L{i+1}: {l.strip()}" for i, l in enumerate(lines) if rx.search(l)]
                    tail = [l.strip() for l in lines[-8:] if l.strip()]
                    print(f"\\n--- LOG FILE: {fp} ({len(lines)} total lines, {len(hits)} pattern hits) ---")
                    if hits:
                        print("  [Pattern Hits (latest 12)]:")
                        for h in hits[-12:]:
                            print("   ", h[:200])
                    if tail:
                        print("  [Latest Tail]:")
                        for t in tail[-5:]:
                            print("   ", t[:200])
                except Exception as e:
                    print(f"--- LOG FILE: {fp} [unreadable: {e}] ---")
    print("\\n--- SYSTEMD JOURNAL (latest 25 entries) ---")
    print(sh("journalctl -n 25 --no-pager 2>/dev/null || dmesg | tail -n 20"))
    print("\\n--- DOCKER CONTAINER LOGS ---")
    print(sh("for c in $(docker ps -q 2>/dev/null); do name=$(docker inspect --format '{{.Name}}' $c); echo 'Container:' $name; docker logs --tail 15 $c 2>&1; done"))

elif MODE == "process_and_port_map":
    print("=== [1. HOST SYSTEM & RESOURCES] ===")
    print(sh("uname -a && uptime && free -h && df -h / /opt/axon/workspaces 2>/dev/null"))
    print("\\n=== [2. LISTENING NETWORK SOCKETS (ss -tulpn)] ===")
    print(sh("ss -tulpn"))
    print("\\n=== [3. TOP RUNNING PROCESSES & WORKSPACE DAEMONS] ===")
    print(sh("ps -eo pid,ppid,user,%cpu,%mem,etime,args --sort=-%mem | head -n 30"))
    print("\\n=== [4. DOCKER CONTAINERS & SYSTEMD SERVICES] ===")
    print(sh("docker ps -a --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}' 2>/dev/null || echo 'Docker not active'"))
    print(sh("systemctl list-units --type=service --state=running --no-pager 2>/dev/null | head -n 25"))
    print("\\n=== [5. LIVE HTTP/TCP PROBES ON REGISTERED SERVICE PORTS] ===")
    ports_to_check = sorted(list(set(REG_PORTS + [4050, 4070, 4085, 4090])))
    for p in ports_to_check:
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{p}/", headers={"User-Agent": "Synapse-DevOps-Scanner"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                body = resp.read(400).decode("utf-8", errors="ignore")
                hdrs = dict(resp.getheaders())
                print(f"Port :{p} -> HTTP {resp.status} | Headers: {json.dumps(hdrs)} | Body: {body[:180]}")
        except Exception as e:
            print(f"Port :{p} -> UNREACHABLE or NON-HTTP ({e})")

elif MODE == "sqlite_inspect":
    print(f"=== [DEEP SQLITE DATABASE DISCOVERY & INTEGRITY AUDIT] dir={TARGET_DIR} ===")
    db_files = []
    for root, dirs, files in os.walk(TARGET_DIR):
        for f in sorted(files):
            if f.endswith((".db", ".sqlite", ".sqlite3")):
                db_files.append(os.path.join(root, f))
    if not db_files:
        print("No SQLite database files found.")
    for dbf in db_files:
        try:
            st = os.stat(dbf)
            print(f"\\n>>> DATABASE: {dbf} (size={st.st_size} bytes, mode={oct(st.st_mode & 0o777)})")
            conn = sqlite3.connect(dbf)
            cur = conn.cursor()
            integrity = cur.execute("PRAGMA integrity_check;").fetchall()
            print(f"  PRAGMA integrity_check: {integrity}")
            tables = cur.execute("SELECT name, sql FROM sqlite_master WHERE type='table';").fetchall()
            print(f"  Tables ({len(tables)}):")
            for tname, tsql in tables:
                cnt = cur.execute(f"SELECT COUNT(*) FROM \\"{tname}\\";").fetchone()[0]
                sample = cur.execute(f"SELECT * FROM \\"{tname}\\" ORDER BY rowid DESC LIMIT 3;").fetchall()
                print(f"    - Table '{tname}': {cnt} row(s) | Schema: {tsql}")
                print(f"      Latest rows: {sample}")
            conn.close()
        except Exception as e:
            print(f"  [SQLite Error on {dbf}]: {e}")

elif MODE == "security_forensics":
    print("=== [1. PUBLIC VS LOOPBACK NETWORK BINDINGS (ss -tulpn)] ===")
    print(sh("ss -tulpn"))
    print("\\n=== [2. SSH DAEMON CONFIGURATION & HARDENING] ===")
    print(sh("grep -E -v '^[[:space:]]*(#|$)' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf 2>/dev/null || true"))
    print("\\n=== [3. RECENT SSH / AUTHENTICATION SECURITY EVENTS] ===")
    print(sh("journalctl -u ssh -u sshd -n 25 --no-pager 2>/dev/null || tail -n 25 /var/log/auth.log 2>/dev/null || echo 'No auth log entries'"))
    print("\\n=== [4. FIREWALL & PACKET FILTER STATUS (UFW / IPTABLES / NFTABLES)] ===")
    print(sh("ufw status verbose 2>/dev/null; iptables -L -n -v 2>/dev/null | head -n 35; nft list ruleset 2>/dev/null | head -n 35"))
    print("\\n=== [5. KERNEL NETWORK SECURITY SYSCTL FLAGS] ===")
    print(sh("sysctl net.ipv4.ip_forward net.ipv4.conf.all.rp_filter net.ipv4.tcp_syncookies net.ipv4.conf.all.accept_redirects 2>/dev/null"))
    print("\\n=== [6. WORKSPACE FILE PERMISSIONS & SENSITIVE FILES] ===")
    print(sh(f"find {TARGET_DIR} -maxdepth 4 -not -name '.synapse_deep_search.py' -printf '%M %u:%g %s %p\\n' 2>/dev/null"))
    print("\\n=== [7. PLAINTEXT SECRET / KEY SCAN IN WORKSPACE] ===")
    print(sh(f"grep -rnI --exclude='.synapse_deep_search.py' -E '(API_KEY|SECRET|PASSWORD|PRIVATE KEY|BEGIN OPENSSH|Bearer )' {TARGET_DIR} 2>/dev/null | head -n 30 || echo 'No plaintext secret patterns found'"))
    print("\\n=== [8. HTTP SECURITY HEADERS ON ACTIVE LOCAL SERVICES] ===")
    for p in sorted(list(set(REG_PORTS + [4050, 4070, 4085, 4090]))):
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{p}/")
            with urllib.request.urlopen(req, timeout=3) as resp:
                hdrs = {k.lower(): v for k, v in resp.getheaders()}
                sec = {h: hdrs.get(h, "MISSING") for h in ["x-powered-by", "x-content-type-options", "x-frame-options", "content-security-policy", "strict-transport-security", "access-control-allow-origin"]}
                print(f"Port :{p} (HTTP {resp.status}) Security Headers -> {json.dumps(sec)}")
        except Exception as e:
            print(f"Port :{p} -> Not HTTP / Offline ({e})")
`;

  const cmdId = `search-${crypto.randomBytes(4).toString("hex")}`;
  try {
    await safeFetchJson(`${coreGatewayUrl}/api/v1/rpc/fs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        node_id: targetNodeId,
        request_id: `fs-${cmdId}`,
        project_id: projectId,
        tier,
        operation: "write_file",
        path: ".synapse_deep_search.py",
        content: pyScript,
        file_mode: "0755",
      }),
      timeoutMs: 8000,
    });

    const payload = {
      node_id: targetNodeId,
      cmd_id: cmdId,
      session_id: `deep-search-v3-${projectId}`,
      project_id: projectId,
      tier,
      command: `python3 .synapse_deep_search.py`,
      wait_timeout_ms: 30000,
      secrets: {},
      send_signal: "NONE",
    };

    const res = await safeFetchJson(`${coreGatewayUrl}/api/v1/rpc/pty`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      timeoutMs: 35000,
    });
    if (!res.ok) {
      return {
        tool_name: toolName,
        status: "error",
        output: { error: `Deep Search PTY RPC failed: ${res.error || `HTTP ${res.status}`}` },
      };
    }
    const data = (await res.json()) as PtyExecResponse;
    appendAuditLog(projectId, {
      timestamp: new Date().toISOString(),
      actor: "ai_orchestrator",
      tool_name: toolName,
      node_id: targetNodeId,
      status: "executed",
      summary: `Deep Search [${targetNodeId}] mode=${searchMode} query='${
        rawQuery || "*"
      }'`,
      args: {
        search_mode: searchMode,
        query: rawQuery,
        target_dir: targetDir,
        file_glob: fileGlob,
      },
    });
    return {
      tool_name: toolName,
      status: "executed",
      output: {
        search_mode: searchMode,
        node_id: targetNodeId,
        query: rawQuery || "*",
        findings: data.output,
        exit_code: data.exit_code,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      tool_name: toolName,
      status: "error",
      output: { error: `Failed to execute node_deep_search: ${msg}` },
    };
  }
}
