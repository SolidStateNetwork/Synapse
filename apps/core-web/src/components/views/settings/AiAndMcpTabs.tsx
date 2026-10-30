"use client";

import React from "react";
import { Bot, Globe, RefreshCw, Sparkles } from "lucide-react";
import { LanguageSwitcher } from "@/lib/i18n";
import { PROVIDER_PRESETS, ProjectState } from "@/types/synapse";

export interface AiProvidersTabProps {
  provider: string;
  setProvider: (val: string) => void;
  baseUrl: string;
  setBaseUrl: (val: string) => void;
  modelName: string;
  setModelName: (val: string) => void;
  handleSyncModels: () => void;
  syncingModels: boolean;
  modelSyncStatus: string;
  discoveredModels: string[];
  apiKeySecretName: string;
  apiKeyInput: string;
  setApiKeyInput: (val: string) => void;
  secretKeys: string[];
  enablePromptCaching: boolean;
  setEnablePromptCaching: (val: boolean) => void;
  enableAutoWatchdog: boolean;
  setEnableAutoWatchdog: (val: boolean) => void;
  handleSaveAiEndpoint: (e: React.FormEvent) => void;
}

export function AiProvidersTab({
  provider,
  setProvider,
  baseUrl,
  setBaseUrl,
  modelName,
  setModelName,
  handleSyncModels,
  syncingModels,
  modelSyncStatus,
  discoveredModels,
  apiKeySecretName,
  apiKeyInput,
  setApiKeyInput,
  secretKeys,
  enablePromptCaching,
  setEnablePromptCaching,
  enableAutoWatchdog,
  setEnableAutoWatchdog,
  handleSaveAiEndpoint,
}: AiProvidersTabProps) {
  return (
    <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-5">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
          <Bot className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-white">
            KI-Anbieter &amp; Eigene API-Basis-URL
          </h2>
          <p className="text-xs text-nb-gray-400">
            Verbinde OpenRouter, vLLM, LiteLLM, Ollama oder OpenAI.
          </p>
        </div>
      </div>
      <form
        onSubmit={handleSaveAiEndpoint}
        className="space-y-4 text-xs max-w-xl"
      >
        <div>
          <label className="block text-nb-gray-200 font-medium mb-1.5">
            KI-Anbieter Vorlage
          </label>
          <select
            value={provider}
            onChange={(e) => {
              const nextProv = e.target.value;
              setProvider(nextProv);
              const preset = PROVIDER_PRESETS[nextProv];
              if (preset) {
                setBaseUrl(preset.defaultUrl);
                setModelName(preset.defaultModel);
              }
            }}
            className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 text-xs text-white"
          >
            {Object.entries(PROVIDER_PRESETS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-nb-gray-200 font-medium mb-1.5">
            API Basis-URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="flex-1 rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-netbird"
            />
            <button
              type="button"
              onClick={handleSyncModels}
              disabled={syncingModels}
              className="flex items-center gap-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-nb-gray-200 hover:text-white transition"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncingModels ? "animate-spin" : ""}`}
              />
              <span>Modelle laden</span>
            </button>
          </div>
          {modelSyncStatus && (
            <p className="mt-1 font-mono text-[11px] text-netbird">
              {modelSyncStatus}
            </p>
          )}
        </div>

        <div>
          <label className="block text-nb-gray-200 font-medium mb-1.5">
            Modell-Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="flex-1 rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-white"
            />
            {discoveredModels.length > 0 && (
              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="max-w-[200px] rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-2 font-mono text-xs text-netbird"
              >
                {discoveredModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div>
          <label className="block text-nb-gray-200 font-medium mb-1.5">
            <span>API-Schlüssel (Verschlüsselt in Secrets.enc als </span>
            <code>{apiKeySecretName}</code>
            <span>)</span>
          </label>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder={
              secretKeys.includes(apiKeySecretName)
                ? "•••••••• (Gespeichert in Secrets.enc)"
                : "sk-..."
            }
            className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 font-mono text-xs text-white"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-1">
          <label className="flex items-center gap-2.5 rounded-lg border border-nb-gray-800 bg-nb-gray-920 p-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={enablePromptCaching}
              onChange={(e) => setEnablePromptCaching(e.target.checked)}
              className="rounded border-nb-gray-700 accent-netbird"
            />
            <div>
              <div className="font-medium text-white">
                Prompt- &amp; Dateisystem-Caching
              </div>
              <div className="text-[10px] text-nb-gray-400">
                Statische System-Layer &amp; Datei-Lesezugriffe zwischenspeichern
              </div>
            </div>
          </label>

          <label className="flex items-center gap-2.5 rounded-lg border border-nb-gray-800 bg-nb-gray-920 p-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={enableAutoWatchdog}
              onChange={(e) => setEnableAutoWatchdog(e.target.checked)}
              className="rounded border-nb-gray-700 accent-netbird"
            />
            <div>
              <div className="font-medium text-white">
                Proaktiver Auto-Watchdog
              </div>
              <div className="text-[10px] text-nb-gray-400">
                Abgestürzte Dienste im Hintergrund automatisch reparieren
              </div>
            </div>
          </label>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-netbird px-5 py-2 text-xs font-semibold text-white hover:bg-netbird-500 transition shadow-sm"
        >
          KI-Anbieter speichern
        </button>
      </form>
    </div>
  );
}

export interface McpServerTabProps {
  activeProject: ProjectState | null;
  primaryNode: string;
  mcpKeyName: string;
  setMcpKeyName: (val: string) => void;
  mcpKeyScopeMode: "read-exec" | "read-only";
  setMcpKeyScopeMode: (val: "read-exec" | "read-only") => void;
  handleCreateMcpKey: (e: React.FormEvent) => void;
  issuedMcpToken: string | null;
  copiedMcpToken: boolean;
  setCopiedMcpToken: (val: boolean) => void;
  showMcpConfigExamples: boolean;
  setShowMcpConfigExamples: React.Dispatch<React.SetStateAction<boolean>>;
  copiedMcpConfig: "json" | "curl" | null;
  setCopiedMcpConfig: (val: "json" | "curl" | null) => void;
  handleRevokeMcpKey: (keyId: string) => void;
  handleTestMcpEndpoint: (
    mode: "tools/list" | "resources/list" | "call_state"
  ) => void;
  mcpTestOutput: string;
}

export function McpServerTab({
  activeProject,
  primaryNode,
  mcpKeyName,
  setMcpKeyName,
  mcpKeyScopeMode,
  setMcpKeyScopeMode,
  handleCreateMcpKey,
  issuedMcpToken,
  copiedMcpToken,
  setCopiedMcpToken,
  showMcpConfigExamples,
  setShowMcpConfigExamples,
  copiedMcpConfig,
  setCopiedMcpConfig,
  handleRevokeMcpKey,
  handleTestMcpEndpoint,
  mcpTestOutput,
}: McpServerTabProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-5">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-white">
              Externer KI-Zugriff &amp; Model Context Protocol (MCP) Server
              (/api/mcp)
            </h2>
            <p className="text-xs text-nb-gray-400">
              Erlaube externen KI-Agenten (Claude Desktop, Cursor, Windsurf,
              Antigravity, OpenCode oder eigenen REST/JSON-RPC-Bots), deinen
              Synapse Core &amp; Muscle sicher per MCP-Token zu steuern.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleCreateMcpKey}
          className="flex flex-wrap items-center gap-2.5 text-xs"
        >
          <input
            type="text"
            value={mcpKeyName}
            onChange={(e) => setMcpKeyName(e.target.value)}
            placeholder="Client-Name (z.B. Claude Desktop / Cursor)"
            className="flex-1 min-w-[220px] rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-white"
          />
          <select
            value={mcpKeyScopeMode}
            onChange={(e) =>
              setMcpKeyScopeMode(e.target.value as "read-exec" | "read-only")
            }
            className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-white"
          >
            <option value="read-exec">
              Vollzugriff (Lesen + PTY/Dateisystem + Admin)
            </option>
            <option value="read-only">
              Nur Lesen (Server, Dateien &amp; Brain-Docs prüfen)
            </option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-netbird px-4 py-2 text-xs font-semibold text-white hover:bg-netbird-500 transition shadow-sm"
          >
            + MCP-API-Schlüssel erzeugen
          </button>
        </form>

        {issuedMcpToken && (
          <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/20 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-400">
                ✔ Neuer MCP-API-Schlüssel erzeugt (jetzt kopieren — wird als
                SHA-256-Hash gespeichert):
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(issuedMcpToken);
                  setCopiedMcpToken(true);
                  setTimeout(() => setCopiedMcpToken(false), 2500);
                }}
                className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-emerald-500 transition"
              >
                {copiedMcpToken ? "✔ Token kopiert!" : "Token kopieren"}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-nb-gray-960 p-3 font-mono text-xs text-emerald-300">
              {issuedMcpToken}
            </pre>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-nb-gray-300">
              Aktive Externe KI- / MCP-Tokens
            </div>
            {!issuedMcpToken && (
              <button
                type="button"
                onClick={() => setShowMcpConfigExamples((v) => !v)}
                className="text-[11px] text-sky-400 hover:text-sky-300 hover:underline"
              >
                {showMcpConfigExamples
                  ? "Integrations-Vorlagen ausblenden"
                  : "Integrations-Vorlagen anzeigen (Claude / Cursor / cURL)"}
              </button>
            )}
          </div>
          {(activeProject?.mcp_api_keys || []).length === 0 ? (
            <div className="rounded-lg border border-nb-gray-800 bg-nb-gray-950 p-3 text-xs text-nb-gray-400">
              Noch keine MCP-API-Tokens erstellt. Klicke oben auf „+
              MCP-API-Schlüssel erzeugen“.
            </div>
          ) : (
            <div className="space-y-1.5">
              {(activeProject?.mcp_api_keys || []).map((k) => (
                <div
                  key={k.key_id}
                  className="flex items-center justify-between rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-3.5 py-2 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-white">{k.name}</span>
                    <span className="font-mono text-[11px] text-netbird">
                      {k.token_prefix}
                    </span>
                    <span className="rounded border border-nb-gray-700 bg-nb-gray-900 px-2 py-0.5 font-mono text-[10px] text-nb-gray-300">
                      {k.scopes.join(", ")}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRevokeMcpKey(k.key_id)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Widerrufen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {(issuedMcpToken || showMcpConfigExamples) &&
          (() => {
            const originUrl =
              typeof window !== "undefined"
                ? window.location.origin
                : "http://localhost:3000";
            const pid = activeProject?.project_id || "default-project";
            const tokenVal = issuedMcpToken || "syn_mcp_<DEIN_API_KEY>";
            const mcpJsonSnippet = `{
  "mcpServers": {
    "synapse-core": {
      "url": "${originUrl}/api/mcp?project_id=${pid}",
      "headers": {
        "Authorization": "Bearer ${tokenVal}"
      }
    }
  }
}`;
            const mcpCurlSnippet = `# Execute any tool directly via REST or JSON-RPC 2.0:
curl -X POST ${originUrl}/api/mcp \\
  -H "Authorization: Bearer ${tokenVal}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tool": "node_pty_exec",
    "arguments": {
      "node_id": "${primaryNode || "node-01"}",
      "session_id": "mcp-shell",
      "command": "uname -a && uptime"
    }
  }'`;
            return (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 pt-2">
                <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-sky-400">
                      1. MCP-Client-Konfiguration (mcp_config.json — Claude /
                      Cursor / Antigravity)
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(mcpJsonSnippet);
                        setCopiedMcpConfig("json");
                        setTimeout(() => setCopiedMcpConfig(null), 2000);
                      }}
                      className="rounded border border-sky-500/40 bg-sky-950/60 px-2.5 py-0.5 text-[10px] font-medium text-sky-300 hover:bg-sky-900"
                    >
                      {copiedMcpConfig === "json" ? "✔ Kopiert" : "Kopieren"}
                    </button>
                  </div>
                  <pre className="overflow-x-auto rounded-lg bg-nb-gray-960 p-3 font-mono text-[11px] text-nb-gray-200 leading-relaxed">
                    {mcpJsonSnippet}
                  </pre>
                </div>

                <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-950 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-emerald-400">
                      2. Direkter REST / JSON-RPC Tool-Aufruf (curl / Eigener
                      KI-Agent)
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(mcpCurlSnippet);
                        setCopiedMcpConfig("curl");
                        setTimeout(() => setCopiedMcpConfig(null), 2000);
                      }}
                      className="rounded border border-emerald-500/40 bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-900"
                    >
                      {copiedMcpConfig === "curl" ? "✔ Kopiert" : "Kopieren"}
                    </button>
                  </div>
                  <pre className="overflow-x-auto rounded-lg bg-nb-gray-960 p-3 font-mono text-[11px] text-nb-gray-200 leading-relaxed">
                    {mcpCurlSnippet}
                  </pre>
                </div>
              </div>
            );
          })()}

        <div className="space-y-2 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-nb-gray-300">
              Live MCP-Protokoll-Tester (JSON-RPC 2.0)
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleTestMcpEndpoint("tools/list")}
                className="rounded-lg border border-netbird-500/40 bg-netbird-950 px-3 py-1 font-mono text-[11px] text-netbird hover:bg-netbird hover:text-white transition"
              >
                Teste tools/list (13 Tools)
              </button>
              <button
                type="button"
                onClick={() => handleTestMcpEndpoint("resources/list")}
                className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-1 font-mono text-[11px] text-nb-gray-200 hover:text-white transition"
              >
                Teste resources/list
              </button>
              <button
                type="button"
                onClick={() => handleTestMcpEndpoint("call_state")}
                className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-1 font-mono text-[11px] text-nb-gray-200 hover:text-white transition"
              >
                Rufe synapse_get_project_state auf
              </button>
            </div>
          </div>
          {mcpTestOutput && (
            <pre className="max-h-72 overflow-auto rounded-lg border border-nb-gray-800 bg-nb-gray-960 p-3.5 font-mono text-[11px] text-emerald-400">
              {mcpTestOutput}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

export function LanguageTab() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-nb-gray-800/90 bg-nb-gray-940 p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
              <Globe className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">
                Sprache &amp; Lokalisierung
              </h2>
              <p className="text-xs text-nb-gray-400">
                Wähle die Anzeigesprache der Benutzeroberfläche. Weitere
                Sprachen können jederzeit über das Sprach-Register ergänzt
                werden.
              </p>
            </div>
          </div>
          <LanguageSwitcher variant="settings" />
        </div>
      </div>
    </div>
  );
}
