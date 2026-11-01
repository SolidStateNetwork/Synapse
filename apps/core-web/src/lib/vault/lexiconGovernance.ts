import fs from "fs";
import path from "path";
import {
  atomicWriteTextSync,
  ensureProjectVault,
  getProjectDir,
} from "../vault";
import type { BrainDocName, ProjectVisibility } from "./vaultTypes";

export function normalizeBrainDocName(raw: unknown): BrainDocName {
  const val = String(raw || "").trim();
  if (val === "Memory.md" || val.toLowerCase() === "memory") return "Memory.md";
  if (val === "Milestones.md" || val.toLowerCase() === "milestones") return "Milestones.md";
  if (val === "AGENTS.md" || val.toLowerCase() === "agents") return "AGENTS.md";
  return "Architecture.md";
}

export function buildDefaultMilestonesDoc(projectName: string): string {
  return `# 🎯 MILESTONES & ROADMAP — ${projectName}

## Phase 1: Brain Vault & SolidState Lexicon
- [x] **M1.1:** Initialize 4-Document Brain Vault (\`Architecture.md\`, \`Memory.md\`, \`Milestones.md\`, \`AGENTS.md\`).
- [x] **M1.2:** Configure Public/Private Clean-Room & Zero-Secret Governance.

## Phase 2: Infrastructure & Service Provisioning
- [ ] **M2.1:** Enroll Axon Muscle Node(s) and verify mTLS 1.3 telemetry.
- [ ] **M2.2:** Deploy and register application/database services on \`127.0.0.1:<port>\`.

## Phase 3: Resilience, Checkpoints & Autonomous Watchdog
- [ ] **M3.1:** Verify Pre-Flight Time-Machine Checkpoints (\`chk-...\`) and AES-256-GCM Offsite Backups.
`;
}

export function buildDefaultAgentsDoc(
  projectName: string,
  visibility: ProjectVisibility = "private"
): string {
  const isPublic = visibility === "public";
  return `# 🤖 AGENTS.md — SolidState AI Engineering Directive (${projectName})

> **VISIBILITY GOVERNANCE MODE:** **\`${isPublic ? "PUBLIC (CLEAN-ROOM)" : "PRIVATE (INTERNAL INFRASTRUCTURE)"}\`**

## 1. Mandatory 5-Step AI Execution Protocol (SolidState Standard)

1. **Step 1 — Read First (Context Load):**
   Always inspect \`AGENTS.md\`, \`Architecture.md\`, \`Memory.md\` (\`[BB-XXX]\`), and \`Milestones.md\` before modifying files or services.
2. **Step 2 — Check Standards & Visibility Guardrails:**
   - **Zero-Secret Policy (ALWAYS):** Never write plaintext API keys, private keys, passwords, or \`.env\` secrets into docs or code. Always store secrets in \`Secrets.enc\` via \`core_manage_secret\` and use \`<REDACTED_SECRET>\` in docs.
   - **${
     isPublic
       ? "Public Clean-Room Policy (ACTIVE): Never expose local user paths, real server public IPs, or private internal domains in docs, comments, or code. Keep public code/docs in English and internal lexicon/chat in German."
       : "Private Infrastructure Policy (ACTIVE): Internal node hostnames, WireGuard/NetBird subnets, and system topology may be documented in Architecture.md and Memory.md while keeping all credentials in Secrets.enc."
   }**
3. **Step 3 — Modularization & Safety Gates:**
   Keep Go files \`< 500\` lines, TypeScript/React files \`< 600\` lines, \`0\` \`any\` types, and bind services to \`127.0.0.1:<port>\`.
4. **Step 4 — Pre-Flight Time-Machine Checkpoints:**
   Ensure every destructive or topology-changing action creates a Pre-Flight Time-Machine Checkpoint (\`chk-...\`).
5. **Step 5 — Mandatory Lexicon Write-Back (\`[BB-XXX]\`):**
   After every completed change, immediately update \`Architecture.md\`, check off completed items in \`Milestones.md\`, and append a numbered \`[BB-XXX]\` entry to \`Memory.md\` via \`core_update_brain_doc\`.
`;
}

export function ensureLexiconDocsExist(
  dir: string,
  cleanId: string,
  name?: string,
  visibility: ProjectVisibility = "private"
): void {
  const milestonesPath = path.join(dir, "Milestones.md");
  if (!fs.existsSync(milestonesPath)) {
    fs.writeFileSync(
      milestonesPath,
      buildDefaultMilestonesDoc(name || cleanId),
      "utf8"
    );
  }
  const agentsPath = path.join(dir, "AGENTS.md");
  if (!fs.existsSync(agentsPath)) {
    fs.writeFileSync(
      agentsPath,
      buildDefaultAgentsDoc(name || cleanId, visibility),
      "utf8"
    );
  }
}

export function sanitizeBrainContentForVisibility(
  content: string,
  visibility: ProjectVisibility = "private",
  knownPublicIps: string[] = []
): string {
  let out = String(content || "");
  out = out.replace(
    /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
    "<REDACTED_SECRET>"
  );
  out = out.replace(
    /\b(sk-[A-Za-z0-9_-]{12,}|MTI-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{12,}|syn_mcp_[A-Za-z0-9_-]{8,})\b/g,
    "<REDACTED_SECRET>"
  );
  if (visibility === "public") {
    out = out.replace(/\/(?:home|Users)\/[A-Za-z0-9._-]+\//g, "/workspace/");
    for (const rawIp of knownPublicIps) {
      const ip = String(rawIp || "").trim();
      if (
        !ip ||
        ip === "127.0.0.1" ||
        ip === "0.0.0.0" ||
        ip === "localhost" ||
        ip.startsWith("192.0.2.") ||
        ip.startsWith("198.51.100.") ||
        ip.startsWith("203.0.113.")
      ) {
        continue;
      }
      out = out.split(ip).join("<REDACTED_PUBLIC_IP>");
    }
  }
  return out;
}

export function formatBlackboxAppend(
  existingMemory: string,
  rawEntry: string
): { formattedEntry: string; bbTag: string } {
  const matches = Array.from(existingMemory.matchAll(/\[BB-(\d+)\]/g));
  let maxNum = 0;
  for (const m of matches) {
    const num = Number(m[1] || 0);
    if (num > maxNum) maxNum = num;
  }
  const nextTag = `[BB-${String(maxNum + 1).padStart(3, "0")}]`;
  const trimmed = String(rawEntry || "").trim();
  if (/\[BB-\d+\]/.test(trimmed)) {
    return { formattedEntry: trimmed, bbTag: nextTag };
  }
  const cleanBody = trimmed.replace(/^-\s*/, "");
  return {
    formattedEntry: `- **${nextTag} [${new Date().toISOString()}]** ${cleanBody}`,
    bbTag: nextTag,
  };
}

export function readBrainDoc(projectId: string, doc: BrainDocName): string {
  const state = ensureProjectVault(projectId);
  const safeDoc = normalizeBrainDocName(doc);
  const dir = getProjectDir(projectId);
  ensureLexiconDocsExist(dir, state.project_id, state.name, state.visibility || "private");
  const filePath = path.join(dir, safeDoc);
  return fs.readFileSync(filePath, "utf8");
}

export function writeBrainDoc(
  projectId: string,
  doc: BrainDocName,
  content: string,
  mode: "overwrite" | "overwrite_full" | "append" | "replace_section" = "overwrite",
  sectionHeader?: string
): string {
  const state = ensureProjectVault(projectId);
  const safeDoc = normalizeBrainDocName(doc);
  const dir = getProjectDir(projectId);
  const visibility: ProjectVisibility = state.visibility === "public" ? "public" : "private";
  ensureLexiconDocsExist(dir, state.project_id, state.name, visibility);

  const knownPublicIps: string[] = [];
  for (const n of state.assigned_nodes || []) {
    if (n.network?.public_ipv4) knownPublicIps.push(n.network.public_ipv4);
    const hb = state.telemetry?.[n.node_id];
    if (hb?.public_ipv4) knownPublicIps.push(hb.public_ipv4);
  }

  const sanitized = sanitizeBrainContentForVisibility(content, visibility, knownPublicIps);
  const filePath = path.join(dir, safeDoc);
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";

  if (mode === "append") {
    const toAppend =
      safeDoc === "Memory.md"
        ? formatBlackboxAppend(existing, sanitized).formattedEntry
        : sanitized;
    const next = existing.endsWith("\n")
      ? `${existing}${toAppend}\n`
      : `${existing}\n${toAppend}\n`;
    atomicWriteTextSync(filePath, next);
    return next;
  }

  if (mode === "replace_section" && sectionHeader && sectionHeader.trim()) {
    const lines = existing.split("\n");
    const targetHeader = sectionHeader.trim().replace(/^#+\s*/, "").toLowerCase();
    let startIdx = -1;
    let startLevel = 2;

    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(#{1,6})\s+(.*)$/);
      if (m) {
        const headingText = m[2].trim().toLowerCase();
        if (
          headingText === targetHeader ||
          lines[i].trim().toLowerCase() === sectionHeader.trim().toLowerCase()
        ) {
          startIdx = i;
          startLevel = m[1].length;
          break;
        }
      }
    }

    if (startIdx !== -1) {
      let endIdx = lines.length;
      for (let j = startIdx + 1; j < lines.length; j++) {
        const m = lines[j].match(/^(#{1,6})\s+/);
        if (m && m[1].length <= startLevel) {
          endIdx = j;
          break;
        }
      }
      const headerLine = sanitized.trim().startsWith("#")
        ? sanitized.trim()
        : `${lines[startIdx]}\n\n${sanitized.trim()}`;
      const next = [...lines.slice(0, startIdx), headerLine, "", ...lines.slice(endIdx)].join("\n");
      atomicWriteTextSync(filePath, next);
      return next;
    }
    const prefixHeader = sectionHeader.trim().startsWith("#")
      ? sectionHeader.trim()
      : `## ${sectionHeader.trim()}`;
    const next = `${existing.trimEnd()}\n\n${prefixHeader}\n\n${sanitized.trim()}\n`;
    atomicWriteTextSync(filePath, next);
    return next;
  }

  atomicWriteTextSync(filePath, sanitized);
  return sanitized;
}
