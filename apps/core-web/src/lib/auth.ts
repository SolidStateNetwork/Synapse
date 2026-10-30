import crypto from "crypto";
import fs from "fs";
import path from "path";
import { atomicWriteJsonSync, safeReadJsonWithBackupSync } from "@/lib/vault";

export type UserRole = "admin" | "operator";

export interface AuthSession {
  token: string;
  role: UserRole;
  label: string;
  created_at: string;
  last_active_at: string;
}

export interface AuthConfig {
  enabled: boolean;
  admin_password_hash: string;
  operator_password_hash?: string;
  totp_pin?: string;
  updated_at: string;
  sessions: AuthSession[];
}

function getAuthFilePath(): string {
  const vaultRoot =
    process.env.SYNAPSE_VAULT_DIR ||
    path.join(process.cwd(), ".synapse-data", "projects");
  fs.mkdirSync(vaultRoot, { recursive: true });
  return path.join(vaultRoot, ".synapse-auth.json");
}

export function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(`synapse-zero-trust-salt:${password}`)
    .digest("hex");
}

export function loadAuthConfig(): AuthConfig {
  const filePath = getAuthFilePath();
  const parsed = safeReadJsonWithBackupSync<Partial<AuthConfig> | null>(
    filePath,
    null
  );
  if (parsed && typeof parsed === "object") {
    return {
      enabled: Boolean(parsed.enabled),
      admin_password_hash: parsed.admin_password_hash || "",
      operator_password_hash: parsed.operator_password_hash || "",
      totp_pin: parsed.totp_pin || "",
      updated_at: parsed.updated_at || new Date().toISOString(),
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  }
  return {
    enabled: false,
    admin_password_hash: "",
    operator_password_hash: "",
    totp_pin: "",
    updated_at: new Date().toISOString(),
    sessions: [],
  };
}

export function saveAuthConfig(cfg: AuthConfig): void {
  const filePath = getAuthFilePath();
  cfg.updated_at = new Date().toISOString();
  atomicWriteJsonSync(filePath, cfg);
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // ignore chmod on platforms without POSIX permissions
  }
}

export function verifyLogin(
  password: string,
  pin?: string
): { ok: boolean; role?: UserRole; session?: AuthSession; error?: string } {
  const cfg = loadAuthConfig();
  if (!cfg.enabled || !cfg.admin_password_hash) {
    const session: AuthSession = {
      token: `syn_sess_${crypto.randomBytes(18).toString("hex")}`,
      role: "admin",
      label: "Local Admin Session",
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    };
    return { ok: true, role: "admin", session };
  }

  if (cfg.totp_pin && cfg.totp_pin.trim() !== "") {
    if ((pin || "").trim() !== cfg.totp_pin.trim()) {
      return { ok: false, error: "Invalid 2FA / Security PIN" };
    }
  }

  const candidateHash = hashPassword(password);
  let matchedRole: UserRole | null = null;
  if (candidateHash === cfg.admin_password_hash) {
    matchedRole = "admin";
  } else if (
    cfg.operator_password_hash &&
    candidateHash === cfg.operator_password_hash
  ) {
    matchedRole = "operator";
  }

  if (!matchedRole) {
    return { ok: false, error: "Invalid password" };
  }

  const session: AuthSession = {
    token: `syn_sess_${crypto.randomBytes(18).toString("hex")}`,
    role: matchedRole,
    label:
      matchedRole === "admin"
        ? "Administrator (Full Control)"
        : "Operator (Read-Only)",
    created_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
  };

  cfg.sessions = [session, ...(cfg.sessions || []).slice(0, 19)];
  saveAuthConfig(cfg);
  return { ok: true, role: matchedRole, session };
}

export function verifySessionToken(token?: string | null): {
  valid: boolean;
  role?: UserRole;
  session?: AuthSession;
} {
  const cfg = loadAuthConfig();
  if (!cfg.enabled) {
    return { valid: true, role: "admin" };
  }
  const clean = (token || "").trim();
  if (!clean) {
    return { valid: false };
  }
  const found = (cfg.sessions || []).find((s) => s.token === clean);
  if (!found) {
    return { valid: false };
  }
  return { valid: true, role: found.role, session: found };
}
