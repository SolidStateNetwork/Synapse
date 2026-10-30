"use client";

import React from "react";
import {
  AlertTriangle,
  Copy,
  MonitorSmartphone,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  PROVIDER_PRESETS,
  type AutonomyTier,
  type NavSection,
} from "@/types/synapse";

export interface ControlCenterModalsProps {
  addPeerModalOpen: boolean;
  setAddPeerModalOpen: (v: boolean) => void;
  gatewayUrl: string;
  setGatewayUrl: (v: string) => void;
  joinTier: AutonomyTier;
  setJoinTier: (v: AutonomyTier) => void;
  joinNodeName: string;
  setJoinNodeName: (v: string) => void;
  handleGenerateJoinToken: () => void;
  oneLineInstallerCmd: string;
  copiedJoinCmd: boolean;
  setCopiedJoinCmd: (v: boolean) => void;
  rebindCliCmd: string;
  copiedRebindCmd: boolean;
  setCopiedRebindCmd: (v: boolean) => void;

  aiEndpointModalOpen: boolean;
  setAiEndpointModalOpen: (v: boolean) => void;
  handleSaveAiEndpoint: (e: React.FormEvent) => void;
  provider: string;
  setProvider: (v: string) => void;
  baseUrl: string;
  setBaseUrl: (v: string) => void;
  modelName: string;
  setModelName: (v: string) => void;
  handleSyncModels: () => void;
  syncingModels: boolean;
  modelSyncStatus: string;
  discoveredModels: string[];
  apiKeySecretName: string;
  apiKeyInput: string;
  setApiKeyInput: (v: string) => void;
  secretKeys: string[];
  enablePromptCaching: boolean;
  setEnablePromptCaching: (v: boolean) => void;
  enableAutoWatchdog: boolean;
  setEnableAutoWatchdog: (v: boolean) => void;

  newProjectModal: boolean;
  setNewProjectModal: (v: boolean) => void;
  newProjName: string;
  setNewProjName: (v: string) => void;
  loadWorkspace: (projectId: string, switchActive?: boolean) => Promise<void>;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;
  commandQuery: string;
  setCommandQuery: (v: string) => void;
  sidebarItems: Array<{ id: NavSection; label: string }>;
  setActiveNav: (nav: NavSection) => void;
}

export default function ControlCenterModals({
  addPeerModalOpen,
  setAddPeerModalOpen,
  gatewayUrl,
  setGatewayUrl,
  joinTier,
  setJoinTier,
  joinNodeName,
  setJoinNodeName,
  handleGenerateJoinToken,
  oneLineInstallerCmd,
  copiedJoinCmd,
  setCopiedJoinCmd,
  rebindCliCmd,
  copiedRebindCmd,
  setCopiedRebindCmd,
  aiEndpointModalOpen,
  setAiEndpointModalOpen,
  handleSaveAiEndpoint,
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
  newProjectModal,
  setNewProjectModal,
  newProjName,
  setNewProjName,
  loadWorkspace,
  commandPaletteOpen,
  setCommandPaletteOpen,
  commandQuery,
  setCommandQuery,
  sidebarItems,
  setActiveNav,
}: ControlCenterModalsProps) {
  return (
    <>
      {/* MODAL 1: NETBIRD "ADD PEER" ONE-COMMAND SETUP MODAL */}
      {addPeerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-nb-gray-900 pb-3.5">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird-950 text-netbird">
                  <MonitorSmartphone className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Neuen Muscle-Server verbinden (Linux / Docker)
                  </h3>
                  <p className="text-xs text-nb-gray-400">
                    Ein-Befehl-Installation mit automatischem Token-Login &amp;
                    mTLS-1.3-Anbindung.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAddPeerModalOpen(false)}
                className="text-nb-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 text-xs">
              <div className="sm:col-span-4">
                <label className="block text-nb-gray-300 mb-1">
                  Core-Gateway-URL
                </label>
                <input
                  type="text"
                  value={gatewayUrl}
                  onChange={(e) => setGatewayUrl(e.target.value)}
                  className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-netbird"
                />
              </div>
              <div className="sm:col-span-5">
                <label className="block text-nb-gray-300 mb-1">
                  Autonomie-Stufe
                </label>
                <select
                  value={joinTier}
                  onChange={(e) => setJoinTier(e.target.value as AutonomyTier)}
                  className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-xs text-white"
                >
                  <option value="TIER_1_UNLEASHED">TIER_1_UNLEASHED</option>
                  <option value="TIER_2_WORKSPACE_JAIL">
                    TIER_2_WORKSPACE_JAIL
                  </option>
                  <option value="TIER_3_SUPERVISED">TIER_3_SUPERVISED</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-nb-gray-300 mb-1">
                  Server-ID (Optional)
                </label>
                <input
                  type="text"
                  value={joinNodeName}
                  onChange={(e) => setJoinNodeName(e.target.value)}
                  placeholder="z.B. prod-01"
                  className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
            </div>

            {(gatewayUrl.includes("localhost") ||
              gatewayUrl.includes("127.0.0.1")) && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-[11px] text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span>
                  <span>Für externe Server bitte</span>{" "}
                  <code className="font-mono text-amber-300">{gatewayUrl}</code>{" "}
                  <span>oben durch die erreichbare IP/Domain deines Core-Hosts ersetzen.</span>
                </span>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-medium text-nb-gray-200">
                  Führe diesen einzelnen Befehl auf deinem Linux-Server aus:
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleGenerateJoinToken}
                    className="whitespace-nowrap shrink-0 rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-1 text-[11px] text-nb-gray-300 hover:text-white transition"
                  >
                    Neues Token
                  </button>
                  {oneLineInstallerCmd && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(oneLineInstallerCmd);
                        setCopiedJoinCmd(true);
                        setTimeout(() => setCopiedJoinCmd(false), 2500);
                      }}
                      className="flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg bg-netbird px-3 py-1 text-[11px] font-medium text-white hover:bg-netbird-500 transition"
                    >
                      <Copy className="h-3 w-3 shrink-0" />
                      <span>{copiedJoinCmd ? "✔ Kopiert!" : "Befehl kopieren"}</span>
                    </button>
                  )}
                </div>
              </div>
              <pre className="overflow-x-auto rounded-lg border border-nb-gray-800 bg-nb-gray-960 p-3.5 font-mono text-xs text-emerald-400">
                {oneLineInstallerCmd || "Erzeuge Setup-Token..."}
              </pre>
            </div>

            {rebindCliCmd && (
              <div className="space-y-2 border-t border-nb-gray-900 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-sky-400">
                      Oder bestehenden Muscle per CLI umschalten (`axon switch`):
                    </span>
                    <p className="text-[11px] text-nb-gray-400">
                      Verbinde einen installierten Muscle-Agenten mit neuem Token an diesen Core (altes Profil bleibt unter `axon profiles` erhalten):
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(rebindCliCmd);
                      setCopiedRebindCmd(true);
                      setTimeout(() => setCopiedRebindCmd(false), 2500);
                    }}
                    className="flex items-center gap-1 whitespace-nowrap shrink-0 rounded-lg border border-sky-500/50 bg-sky-950 px-3 py-1 text-[11px] font-medium text-sky-300 hover:bg-sky-900 transition"
                  >
                    <Copy className="h-3 w-3 shrink-0" />
                    <span>
                      {copiedRebindCmd ? "✔ CLI kopiert!" : "CLI-Switch kopieren"}
                    </span>
                  </button>
                </div>
                <pre className="overflow-x-auto rounded-lg border border-nb-gray-800 bg-nb-gray-960 p-3 font-mono text-xs text-sky-300">
                  {rebindCliCmd}
                </pre>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-nb-gray-900 pt-3 text-xs text-nb-gray-400">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Warte auf eingehenden mTLS 1.3 + Yamux Server-Handshake...
              </span>
              <button
                onClick={() => setAddPeerModalOpen(false)}
                className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-4 py-1.5 text-xs text-white hover:bg-nb-gray-900 transition"
              >
                Fertig
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CUSTOM API BASE URL & MODEL CONFIGURATION */}
      {aiEndpointModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-nb-gray-900 pb-3.5">
              <div>
                <h3 className="text-base font-semibold text-white">
                  KI-Anbieter &amp; Eigene API-Basis-URL
                </h3>
                <p className="text-xs text-nb-gray-400 mt-0.5">
                  Verbinde OpenRouter, vLLM, LiteLLM, Ollama oder OpenAI.
                </p>
              </div>
              <button
                onClick={() => setAiEndpointModalOpen(false)}
                className="text-nb-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAiEndpoint} className="space-y-4 text-xs">
              <div>
                <label className="block text-nb-gray-300 font-medium mb-1.5">
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
                  className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2.5 text-xs text-white"
                >
                  {Object.entries(PROVIDER_PRESETS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-nb-gray-300 font-medium mb-1.5">
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
                      className={`h-3.5 w-3.5 ${
                        syncingModels ? "animate-spin" : ""
                      }`}
                    />
                    <span>Modelle abrufen</span>
                  </button>
                </div>
                {modelSyncStatus && (
                  <p className="mt-1 font-mono text-[11px] text-netbird">
                    {modelSyncStatus}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-nb-gray-300 font-medium mb-1.5">
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
                      className="max-w-[180px] rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-2.5 py-2 font-mono text-xs text-netbird"
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
                <label className="block text-nb-gray-300 font-medium mb-1.5">
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

              <div className="flex justify-end gap-2 pt-3 border-t border-nb-gray-900">
                <button
                  type="button"
                  onClick={() => setAiEndpointModalOpen(false)}
                  className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-4 py-2 text-xs text-nb-gray-300 hover:text-white transition"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-netbird px-5 py-2 text-xs font-semibold text-white hover:bg-netbird-500 transition shadow-sm"
                >
                  Anbieter speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE NEW PROJECT VAULT */}
      {newProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newProjName.trim()) return;
              const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "create_project",
                  new_project_id: newProjName,
                  name: newProjName,
                }),
              });
              const data = await res.json();
              setNewProjName("");
              setNewProjectModal(false);
              if (data.project?.project_id) {
                await loadWorkspace(data.project.project_id, true);
              }
            }}
            className="w-full max-w-sm rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between text-sm font-semibold text-white">
              <span>Neuen Projekt-Tresor anlegen</span>
              <button
                type="button"
                onClick={() => setNewProjectModal(false)}
                className="text-nb-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              value={newProjName}
              onChange={(e) => setNewProjName(e.target.value)}
              placeholder="Projektname (z.B. prod-mesh)"
              className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 text-xs text-white"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-netbird px-4 py-2 text-xs font-semibold text-white hover:bg-netbird-500 transition shadow-sm"
              >
                Projekt anlegen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: CTRL+K COMMAND PALETTE */}
      {commandPaletteOpen && (
        <div
          onClick={() => setCommandPaletteOpen(false)}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 pt-24 backdrop-blur-sm p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-nb-gray-800 bg-nb-gray-940 shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-nb-gray-900 px-4 py-3">
              <Search className="h-4 w-4 text-netbird" />
              <input
                type="text"
                autoFocus
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Springe zu Übersicht, Server, Regeln, Dienste..."
                className="flex-1 bg-transparent text-xs text-white placeholder:text-nb-gray-400 focus:outline-none"
              />
              <span className="rounded border border-nb-gray-800 bg-nb-gray-920 px-1.5 py-0.5 font-mono text-[10px] text-nb-gray-400">
                ESC
              </span>
            </div>

            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {sidebarItems
                .filter(
                  (i) =>
                    !commandQuery.trim() ||
                    i.label.toLowerCase().includes(commandQuery.toLowerCase())
                )
                .map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveNav(item.id);
                      setCommandPaletteOpen(false);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3.5 py-2 text-left text-xs text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white transition"
                  >
                    <span>{item.label}</span>
                    <span className="font-mono text-[10px] text-netbird">
                      Navigieren
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
