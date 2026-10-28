import { NextRequest, NextResponse } from "next/server";
import {
  hashPassword,
  loadAuthConfig,
  saveAuthConfig,
  verifyLogin,
} from "@/lib/auth";

export async function GET(req: NextRequest) {
  const cfg = loadAuthConfig();
  const token =
    req.headers.get("x-synapse-session") ||
    req.nextUrl.searchParams.get("token") ||
    "";
  const matchedSession = cfg.sessions.find((s) => s.token === token);

  return NextResponse.json({
    enabled: cfg.enabled,
    has_admin_password: Boolean(cfg.admin_password_hash),
    has_operator_password: Boolean(cfg.operator_password_hash),
    has_totp_pin: Boolean(cfg.totp_pin),
    authenticated: !cfg.enabled || Boolean(matchedSession),
    role: matchedSession?.role || (!cfg.enabled ? "admin" : null),
    active_sessions_count: cfg.sessions.length,
    updated_at: cfg.updated_at,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || "");
    const cfg = loadAuthConfig();

    if (action === "login") {
      const res = verifyLogin(
        String(body.password || ""),
        body.pin ? String(body.pin) : undefined
      );
      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: res.error || "Authentication failed" },
          { status: 401 }
        );
      }
      return NextResponse.json({
        ok: true,
        role: res.role,
        session: res.session,
      });
    }

    if (action === "configure") {
      const adminPassword = String(body.admin_password || "").trim();
      const operatorPassword = String(body.operator_password || "").trim();
      const totpPin = String(body.totp_pin || "").trim();
      const enabled = Boolean(body.enabled);

      if (enabled && !adminPassword && !cfg.admin_password_hash) {
        return NextResponse.json(
          {
            ok: false,
            error: "Please set an Admin password to enable WebUI protection.",
          },
          { status: 400 }
        );
      }

      if (adminPassword) {
        cfg.admin_password_hash = hashPassword(adminPassword);
      }
      if (operatorPassword) {
        cfg.operator_password_hash = hashPassword(operatorPassword);
      } else if (body.clear_operator_password) {
        cfg.operator_password_hash = "";
      }
      if (body.totp_pin !== undefined) {
        cfg.totp_pin = totpPin;
      }
      cfg.enabled = enabled;
      saveAuthConfig(cfg);

      // Automatically issue an admin session so the user configuring it stays logged in
      const loginRes =
        enabled && adminPassword
          ? verifyLogin(adminPassword, cfg.totp_pin)
          : { ok: true, role: "admin" as const, session: cfg.sessions[0] };

      return NextResponse.json({
        ok: true,
        enabled: cfg.enabled,
        has_admin_password: Boolean(cfg.admin_password_hash),
        has_operator_password: Boolean(cfg.operator_password_hash),
        has_totp_pin: Boolean(cfg.totp_pin),
        session: loginRes.session,
      });
    }

    if (action === "logout") {
      const token = String(body.token || "");
      cfg.sessions = cfg.sessions.filter((s) => s.token !== token);
      saveAuthConfig(cfg);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: `Unknown auth action: ${action}` },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Auth API error",
      },
      { status: 500 }
    );
  }
}
