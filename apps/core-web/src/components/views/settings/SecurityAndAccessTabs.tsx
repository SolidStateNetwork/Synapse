"use client";

import React from "react";
import {
  Activity,
  AlertTriangle,
  KeyRound,
  Lock,
  Server,
  Trash2,
} from "lucide-react";
import { AutonomyTier } from "@/types/synapse";
import type { SettingsAlertConfigState } from "../SettingsView";

export interface SetupKeysTabProps {
  gatewayUrl: string;
  setGatewayUrl: (val: string) => void;
  joinNodeName: string;
  setJoinNodeName: (val: string) => void;
  joinTier: AutonomyTier;
  setJoinTier: (val: AutonomyTier) => void;
  handleGenerateJoinToken: () => void;
  issuedToken: string | null;
  oneLineInstallerCmd: string;
  copiedJoinCmd: boolean;
  setCopiedJoinCmd: (val: boolean) => void;
  rebindCliCmd: string;
  copiedRebindCmd: boolean;
  setCopiedRebindCmd: (val: boolean) => void;
}

export function SetupKeysTab({
  gatewayUrl,
  setGatewayUrl,
  joinNodeName,
  setJoinNodeName,
  joinTier,
  setJoinTier,
  handleGenerateJoinToken,
  issuedToken,
  oneLineInstallerCmd,
  copiedJoinCmd,
  setCopiedJoinCmd,
  rebindCliCmd,
  copiedRebindCmd,
  setCopiedRebindCmd,
}: SetupKeysTabProps) {
  return (
    <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-5">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
          <Server className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-white">
            Einmal-Setup-Schlüssel (Server-Anbindung)
          </h2>
          <p className="text-xs text-nb-gray-400">
            Erzeuge einen einmaligen Setup-Schlüssel für das automatische mTLS
            1.3 Onboarding neuer Linux-Server oder das Umbinden bestehender
            Muscle-Knoten.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          type="text"
          value={gatewayUrl}
          onChange={(e) => setGatewayUrl(e.target.value)}
          placeholder="http://<CORE_IP>:8081"
          className="w-60 rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-netbird"
        />
        <input
          type="text"
          value={joinNodeName}
          onChange={(e) => setJoinNodeName(e.target.value)}
          placeholder="Server-Name (optional, z.B. prod-01)"
          className="flex-1 min-w-[240px] rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
        />
        <select
          value={joinTier}
          onChange={(e) => setJoinTier(e.target.value as AutonomyTier)}
          className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-white"
        >
          <option value="TIER_1_UNLEASHED">TIER_1_UNLEASHED</option>
          <option value="TIER_2_WORKSPACE_JAIL">TIER_2_WORKSPACE_JAIL</option>
          <option value="TIER_3_SUPERVISED">TIER_3_SUPERVISED</option>
        </select>
        <button
          onClick={handleGenerateJoinToken}
          className="rounded-lg bg-netbird px-4 py-2 text-xs font-semibold text-white hover:bg-netbird-500 transition shadow-sm"
        >
          Setup-Schlüssel erzeugen
        </button>
      </div>

      {(gatewayUrl.includes("localhost") ||
        gatewayUrl.includes("127.0.0.1")) && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3.5 py-2 text-xs text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span>
            Hinweis: Für entfernte Linux-VPS bitte{" "}
            <code className="font-mono text-amber-300">{gatewayUrl}</code> durch
            die öffentlich oder per VPN erreichbare IP/Domain dieses
            Core-Servers ersetzen.
          </span>
        </div>
      )}

      {issuedToken ? (
        <div className="space-y-4 pt-1">
          <div className="rounded-xl border border-netbird-500/40 bg-nb-gray-950 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-netbird">
                1. Neuinstallation — Auf dem Ziel-Linux-Server ausführen, um
                axon zu installieren &amp; zu verbinden:
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(oneLineInstallerCmd);
                  setCopiedJoinCmd(true);
                  setTimeout(() => setCopiedJoinCmd(false), 2500);
                }}
                className="rounded-md bg-netbird px-3 py-1 text-[11px] font-medium text-white hover:bg-netbird-500 transition"
              >
                {copiedJoinCmd ? "✔ Kopiert!" : "Befehl kopieren"}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-nb-gray-960 p-3 font-mono text-xs text-emerald-400">
              {oneLineInstallerCmd}
            </pre>
          </div>

          <div className="rounded-xl border border-sky-500/40 bg-nb-gray-950 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-sky-400">
                  2. Bestehenden Muscle-Agenten per CLI umschalten (axon switch)
                </span>
                <p className="text-[11px] text-nb-gray-400">
                  Ist axon bereits installiert? Führe diesen Befehl aus, um ihn
                  mit neuem Token an diesen Core zu binden (oder nutze axon
                  profiles):
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(rebindCliCmd);
                  setCopiedRebindCmd(true);
                  setTimeout(() => setCopiedRebindCmd(false), 2500);
                }}
                className="rounded-md border border-sky-500/50 bg-sky-950 px-3 py-1 text-[11px] font-medium text-sky-300 hover:bg-sky-900 transition"
              >
                {copiedRebindCmd ? "✔ CLI kopiert!" : "CLI-Switch kopieren"}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-nb-gray-960 p-3 font-mono text-xs text-sky-300">
              {rebindCliCmd}
            </pre>
          </div>

          <div className="rounded-xl border border-violet-500/40 bg-nb-gray-950 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-violet-300">
                  3. Multi-Core Parallel-Verbindung (axon add-core)
                </span>
                <p className="text-[11px] text-nb-gray-400">
                  Verbinde einen Muscle gleichzeitig mit diesem und weiteren Cores parallel (ohne bestehende Tunnel zu trennen):
                </p>
              </div>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-nb-gray-960 p-3 font-mono text-xs text-violet-300">
              {rebindCliCmd.replace("axon switch", "axon add-core --name secondary-core")}
            </pre>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-950/70 px-4 py-3.5 text-xs text-nb-gray-400">
          Noch kein aktiver Setup-Schlüssel generiert. Klicke oben auf{" "}
          <strong className="text-white">Setup-Schlüssel erzeugen</strong>, um
          einen neuen Einmal-Token samt kopierfertigem Installations- und{" "}
          <code className="font-mono text-sky-300">axon switch</code>-Befehl zu
          erstellen.
        </div>
      )}
    </div>
  );
}

export interface SecretsVaultTabProps {
  secretKeys: string[];
  newSecretKey: string;
  setNewSecretKey: (val: string) => void;
  newSecretVal: string;
  setNewSecretVal: (val: string) => void;
  handleAddSecret: (e: React.FormEvent) => void;
  handleDeleteSecret: (keyName: string) => void;
}

export function SecretsVaultTab({
  secretKeys,
  newSecretKey,
  setNewSecretKey,
  newSecretVal,
  setNewSecretVal,
  handleAddSecret,
  handleDeleteSecret,
}: SecretsVaultTabProps) {
  return (
    <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-5">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
          <KeyRound className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-white">
            AES-256-GCM Verschlüsselter Secrets-Tresor (Secrets.enc)
          </h2>
          <p className="text-xs text-nb-gray-400">
            Geheimnisse werden lokal mit AES-256-GCM verschlüsselt gespeichert
            (Write-Only) und bei Bedarf sicher in Remote-Prozesse injiziert.
          </p>
        </div>
      </div>
      <form onSubmit={handleAddSecret} className="flex flex-wrap gap-2.5">
        <input
          type="text"
          value={newSecretKey}
          onChange={(e) => setNewSecretKey(e.target.value)}
          placeholder="SECRET_KEY_NAME"
          className="flex-1 min-w-[200px] rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-white"
        />
        <input
          type="password"
          value={newSecretVal}
          onChange={(e) => setNewSecretVal(e.target.value)}
          placeholder="Geheimer Klartext-Wert..."
          className="flex-1 min-w-[240px] rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-white"
        />
        <button
          type="submit"
          className="whitespace-nowrap shrink-0 rounded-lg bg-netbird px-4 py-2 text-xs font-semibold text-white hover:bg-netbird-500 transition shadow-sm"
        >
          Verschlüsseln &amp; Speichern
        </button>
      </form>

      {secretKeys.length === 0 ? (
        <div className="rounded-lg border border-nb-gray-850 bg-nb-gray-950/70 px-4 py-3 text-xs text-nb-gray-400">
          Noch keine Secrets im Tresor hinterlegt.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {secretKeys.map((k) => (
            <div
              key={k}
              className="flex items-center justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-930 px-3.5 py-2.5 font-mono text-xs"
            >
              <span className="text-netbird">{k}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-nb-gray-400">AES-256-GCM</span>
                <button
                  onClick={() => handleDeleteSecret(k)}
                  className="text-nb-gray-400 hover:text-red-400 transition"
                  title="Secret löschen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export interface WatchdogRbacTabProps {
  primaryNode: string;
  settingsAlertConfig: SettingsAlertConfigState | null;
  setSettingsAlertConfig: React.Dispatch<
    React.SetStateAction<SettingsAlertConfigState | null>
  >;
  settingsAlertNotice: string | null;
  setSettingsAlertNotice: (val: string | null) => void;
  settingsAuthEnabled: boolean;
  setSettingsAuthEnabled: (val: boolean) => void;
  settingsAdminPwd: string;
  setSettingsAdminPwd: (val: string) => void;
  settingsOperatorPwd: string;
  setSettingsOperatorPwd: (val: string) => void;
  settingsTotpPin: string;
  setSettingsTotpPin: (val: string) => void;
  settingsAuthNotice: string | null;
  setSettingsAuthNotice: (val: string | null) => void;
}

export function WatchdogRbacTab({
  primaryNode,
  settingsAlertConfig,
  setSettingsAlertConfig,
  settingsAlertNotice,
  setSettingsAlertNotice,
  settingsAuthEnabled,
  setSettingsAuthEnabled,
  settingsAdminPwd,
  setSettingsAdminPwd,
  settingsOperatorPwd,
  setSettingsOperatorPwd,
  settingsTotpPin,
  setSettingsTotpPin,
  settingsAuthNotice,
  setSettingsAuthNotice,
}: WatchdogRbacTabProps) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
              <Activity className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">
                24/7 Wächter &amp; Push-Alarme
              </h2>
              <p className="text-xs text-nb-gray-400">
                Automatische Benachrichtigungen bei Server-Ausfällen, hoher Last
                oder Selbstheilungs-Aktionen.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              setSettingsAlertNotice(null);
              const r = await fetch("/api/alerts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "test_alert",
                  node_id: primaryNode || "local-node",
                }),
              });
              const d = await r.json();
              if (d.config) setSettingsAlertConfig(d.config);
              setSettingsAlertNotice("🔔 Test-Alarm erfolgreich ausgelöst!");
              setTimeout(() => setSettingsAlertNotice(null), 4000);
            }}
            className="shrink-0 rounded-lg border border-netbird/50 bg-netbird/15 px-3 py-1.5 font-mono text-xs font-semibold text-netbird hover:bg-netbird/25 transition"
          >
            Test-Alarm senden
          </button>
        </div>

        {settingsAlertNotice && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-3 py-2 text-xs text-emerald-300">
            {settingsAlertNotice}
          </div>
        )}

        {settingsAlertConfig && (
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-nb-gray-300 mb-1">
                Telegram Bot-Token
              </label>
              <input
                type="text"
                value={settingsAlertConfig.telegram_bot_token}
                onChange={(e) =>
                  setSettingsAlertConfig({
                    ...settingsAlertConfig,
                    telegram_bot_token: e.target.value,
                    telegram_enabled: Boolean(e.target.value),
                  })
                }
                placeholder="123456:ABC-DEF..."
                className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-nb-gray-300 mb-1">
                Telegram Chat-ID
              </label>
              <input
                type="text"
                value={settingsAlertConfig.telegram_chat_id}
                onChange={(e) =>
                  setSettingsAlertConfig({
                    ...settingsAlertConfig,
                    telegram_chat_id: e.target.value,
                  })
                }
                placeholder="-1001234567890"
                className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-nb-gray-300 mb-1">
                Discord / Slack Webhook-URL
              </label>
              <input
                type="text"
                value={settingsAlertConfig.discord_webhook_url}
                onChange={(e) =>
                  setSettingsAlertConfig({
                    ...settingsAlertConfig,
                    discord_webhook_url: e.target.value,
                    discord_enabled: Boolean(e.target.value),
                  })
                }
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
              />
            </div>
            <button
              type="button"
              onClick={async () => {
                const r = await fetch("/api/alerts", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "configure",
                    ...settingsAlertConfig,
                  }),
                });
                const d = await r.json();
                if (d.config) setSettingsAlertConfig(d.config);
                setSettingsAlertNotice("✔ Alarm-Kanäle & Regeln gespeichert");
                setTimeout(() => setSettingsAlertNotice(null), 3500);
              }}
              className="rounded-lg bg-netbird px-4 py-2 text-xs font-semibold text-white hover:bg-netbird-500 transition"
            >
              Alarm-Kanäle speichern
            </button>

            {settingsAlertConfig.events &&
              settingsAlertConfig.events.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-nb-gray-850">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-nb-gray-400">
                    Letzte Wächter-Ereignisse
                  </div>
                  {settingsAlertConfig.events.slice(0, 4).map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3 py-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-white truncate">
                          {ev.title}
                        </div>
                        <div className="text-[11px] text-nb-gray-400 truncate">
                          {ev.message}
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-emerald-400 ml-2">
                        {ev.dispatched_to.join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-950/60 text-emerald-400">
              <Lock className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">
                WebUI Login &amp; Rollen (RBAC)
              </h2>
              <p className="text-xs text-nb-gray-400">
                Schütze das Control Center mit Admin-Passwort,
                Nur-Lesen-Operator-Passwort und optionaler 2FA-PIN.
              </p>
            </div>
          </div>
          <span
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
              settingsAuthEnabled
                ? "border-emerald-500/40 bg-emerald-950/60 text-emerald-300"
                : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-400"
            }`}
          >
            {settingsAuthEnabled ? "AKTIV" : "AUS"}
          </span>
        </div>

        {settingsAuthNotice && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/70 px-3 py-2 text-xs text-emerald-300">
            {settingsAuthNotice}
          </div>
        )}

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-nb-gray-300 mb-1">
              Neues Admin-Passwort (Vollzugriff)
            </label>
            <input
              type="password"
              value={settingsAdminPwd}
              onChange={(e) => setSettingsAdminPwd(e.target.value)}
              placeholder="Neues Admin-Passwort..."
              className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-nb-gray-300 mb-1">
              Operator-Passwort (Nur-Lesen / Read-Only)
            </label>
            <input
              type="password"
              value={settingsOperatorPwd}
              onChange={(e) => setSettingsOperatorPwd(e.target.value)}
              placeholder="Operator-Passwort (Nur-Lesen)..."
              className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-nb-gray-300 mb-1">
              Optionaler 2FA-PIN (z.B. 2408)
            </label>
            <input
              type="text"
              value={settingsTotpPin}
              onChange={(e) => setSettingsTotpPin(e.target.value)}
              placeholder="Optionaler 2FA-PIN..."
              className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={async () => {
                const r = await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "configure",
                    enabled: true,
                    admin_password: settingsAdminPwd || "synapse-admin",
                    operator_password: settingsOperatorPwd,
                    totp_pin: settingsTotpPin,
                  }),
                });
                const d = await r.json();
                if (d.ok) {
                  setSettingsAuthEnabled(Boolean(d.enabled));
                  setSettingsAuthNotice("🔒 WebUI Passwort-Schutz aktiviert");
                  setTimeout(() => setSettingsAuthNotice(null), 3500);
                }
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition"
            >
              Passwort-Schutz speichern &amp; aktivieren
            </button>
            {settingsAuthEnabled && (
              <button
                type="button"
                onClick={async () => {
                  const r = await fetch("/api/auth", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      action: "configure",
                      enabled: false,
                    }),
                  });
                  const d = await r.json();
                  if (d.ok) {
                    setSettingsAuthEnabled(false);
                    setSettingsAuthNotice(
                      "🔓 WebUI Passwort-Schutz deaktiviert"
                    );
                    setTimeout(() => setSettingsAuthNotice(null), 3500);
                  }
                }}
                className="rounded-lg border border-nb-gray-700 bg-nb-gray-900 px-3.5 py-2 text-xs text-nb-gray-300 hover:text-white transition"
              >
                Schutz deaktivieren
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
