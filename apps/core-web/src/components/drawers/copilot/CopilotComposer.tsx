"use client";

import React from "react";
import {
  Activity,
  AtSign,
  Cpu,
  FileText,
  Paperclip,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { ChatAttachment } from "@/types/synapse";
import type {
  MentionCandidateItem,
  SelectedChatSkillType,
} from "../CopilotDrawer";

export interface CopilotComposerProps {
  chatComposerRef: React.RefObject<HTMLFormElement | null>;
  chatInputRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleSendPrompt: (e?: React.FormEvent) => void;
  selectedChatSkill: SelectedChatSkillType;
  setSelectedChatSkill: (skill: SelectedChatSkillType) => void;
  skillMenuOpen: boolean;
  setSkillMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mentionMenuOpen: boolean;
  setMentionMenuOpen: (val: boolean) => void;
  setMentionFilter: (val: string) => void;
  mentionCandidates: MentionCandidateItem[];
  insertMentionToken: (token: string) => void;
  chatAttachments: ChatAttachment[];
  setChatAttachments: React.Dispatch<React.SetStateAction<ChatAttachment[]>>;
  processDroppedOrSelectedFiles: (files: FileList | File[]) => void;
  chatInput: string;
  setChatInput: React.Dispatch<React.SetStateAction<string>>;
  handleChatInputChange: (val: string) => void;
  handleChatPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  chatBusy: boolean;
}

export function CopilotComposer({
  chatComposerRef,
  chatInputRef,
  fileInputRef,
  handleSendPrompt,
  selectedChatSkill,
  setSelectedChatSkill,
  skillMenuOpen,
  setSkillMenuOpen,
  mentionMenuOpen,
  setMentionMenuOpen,
  setMentionFilter,
  mentionCandidates,
  insertMentionToken,
  chatAttachments,
  setChatAttachments,
  processDroppedOrSelectedFiles,
  chatInput,
  setChatInput,
  handleChatInputChange,
  handleChatPaste,
  chatBusy,
}: CopilotComposerProps) {
  return (
    <form
      ref={chatComposerRef}
      onSubmit={handleSendPrompt}
      className="relative border-t border-nb-gray-900 bg-nb-gray-950 p-3 space-y-2"
    >
      {selectedChatSkill && (
        <div
          className={`flex items-start justify-between gap-2.5 rounded-lg border p-2.5 text-xs ${
            selectedChatSkill === "CheckSystem"
              ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-100"
              : selectedChatSkill === "CheckOpsec" ||
                selectedChatSkill === "CheckUpdates"
              ? "border-sky-500/40 bg-sky-950/30 text-sky-100"
              : "border-amber-500/40 bg-amber-950/30 text-amber-100"
          }`}
        >
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 font-semibold text-white">
              {selectedChatSkill === "CheckSystem" ? (
                <Activity className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              ) : selectedChatSkill === "CheckOpsec" ? (
                <Shield className="h-3.5 w-3.5 shrink-0 text-sky-400" />
              ) : selectedChatSkill === "CheckUpdates" ? (
                <RefreshCw className="h-3.5 w-3.5 shrink-0 text-sky-400" />
              ) : selectedChatSkill === "DeepForensics" ? (
                <Cpu className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              ) : (
                <Search className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              )}
              <span>Skill ausgewählt: {selectedChatSkill}</span>
            </div>
            <p className="text-[11px] text-nb-gray-300 leading-snug">
              {selectedChatSkill === "CheckSystem"
                ? "Mehrstufiger Senior-DevOps-Tiefenscan: Prüft Host, Ports, Quellcode, SQLite-Integrität, Logs & Brain-Sync mit erweiterten Suchfunktionen."
                : selectedChatSkill === "CheckOpsec"
                ? "Mehrstufiger DevSecOps-Tiefenaudit: Prüft offene Sockets, SSH, Firewall, Sysctl, Dateirechte, Code-Schwachstellen, Secrets & HTTP-Header."
                : selectedChatSkill === "CheckUpdates"
                ? "Muscle & Backend Update-Prüfung: Prüft Axon-Daemons, Workspace-Backends, Runtimes & OS-Pakete auf Updates und fragt danach nach Ausführung + Funktionstest."
                : selectedChatSkill === "DeepForensics"
                ? "Tiefgreifende DevOps-Forensik: Durchsucht alle Logs, Prozesse, Datenbanken und Quellcode-Dateien nach versteckten Fehlern & Root-Causes."
                : "Erweiterte System-, Code-, Datenbank-, Log- & UI-Tiefensuche: Findet jede Funktion, Einstellung, Datei oder Zeile im gesamten System."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedChatSkill(null)}
            className="rounded p-1 text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white shrink-0"
            title="Skill abwählen"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {skillMenuOpen && (
        <div className="absolute bottom-full left-3 right-3 mb-1.5 rounded-lg border border-nb-gray-800 bg-nb-gray-930 p-2 shadow-2xl z-30 space-y-1">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-nb-gray-400">
              Senior DevOps AI Skills &amp; Deep-Search
            </span>
            <button
              type="button"
              onClick={() => setSkillMenuOpen(false)}
              className="rounded p-0.5 text-nb-gray-400 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedChatSkill("CheckUpdates");
              setSkillMenuOpen(false);
              setTimeout(() => chatInputRef.current?.focus(), 50);
            }}
            className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-nb-gray-900 transition"
          >
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-semibold text-xs text-sky-300">
                <span>CheckUpdates</span>
                <span className="rounded border border-sky-500/30 bg-sky-950/40 px-1.5 py-0.2 font-mono text-[9px] text-sky-300">
                  Muscle &amp; Backend Updates + Test
                </span>
              </div>
              <p className="text-[11px] text-nb-gray-400 leading-snug">
                Prüft alle Muscle-Server, Axon-Binaries, Runtimes, OS-Pakete
                &amp; Backends auf Updates, fragt nach Freigabe und führt danach
                einen Funktionstest durch.
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedChatSkill("CheckSystem");
              setSkillMenuOpen(false);
              setTimeout(() => chatInputRef.current?.focus(), 50);
            }}
            className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-nb-gray-900 transition"
          >
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-semibold text-xs text-emerald-300">
                <span>CheckSystem</span>
                <span className="rounded border border-emerald-500/30 bg-emerald-950/40 px-1.5 py-0.2 font-mono text-[9px] text-emerald-300">
                  6-Phasen SRE Audit
                </span>
              </div>
              <p className="text-[11px] text-nb-gray-400 leading-snug">
                Tiefenscan wie durch einen Senior DevOps Engineer: Host, Ports,
                Quellcode-Grep, SQLite-Integrität, Logs &amp; Brain-Drift.
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedChatSkill("CheckOpsec");
              setSkillMenuOpen(false);
              setTimeout(() => chatInputRef.current?.focus(), 50);
            }}
            className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-nb-gray-900 transition"
          >
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-semibold text-xs text-sky-300">
                <span>CheckOpsec</span>
                <span className="rounded border border-sky-500/30 bg-sky-950/40 px-1.5 py-0.2 font-mono text-[9px] text-sky-300">
                  DevSecOps Forensik
                </span>
              </div>
              <p className="text-[11px] text-nb-gray-400 leading-snug">
                Mehrstufiger Security-Audit: Socket-Bindings, SSH, Firewall,
                Sysctl, Dateirechte, Secret-Leak-Scan &amp; HTTP-Header.
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedChatSkill("DeepForensics");
              setSkillMenuOpen(false);
              setTimeout(() => chatInputRef.current?.focus(), 50);
            }}
            className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-nb-gray-900 transition"
          >
            <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-semibold text-xs text-amber-300">
                <span>DeepForensics</span>
                <span className="rounded border border-amber-500/30 bg-amber-950/40 px-1.5 py-0.2 font-mono text-[9px] text-amber-300">
                  Root-Cause &amp; Logs
                </span>
              </div>
              <p className="text-[11px] text-nb-gray-400 leading-snug">
                Durchsucht sämtliche Logs, Journalctl, Prozesse, Datenbanken
                &amp; Code-Dateien nach Fehlern, Engpässen &amp; Ursachen.
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedChatSkill("SkillSearch");
              setSkillMenuOpen(false);
              setTimeout(() => chatInputRef.current?.focus(), 50);
            }}
            className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-nb-gray-900 transition"
          >
            <Search className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-semibold text-xs text-amber-300">
                <span>SkillSearch</span>
                <span className="rounded border border-amber-500/30 bg-amber-950/40 px-1.5 py-0.2 font-mono text-[9px] text-amber-300">
                  Code-, System- &amp; UI-Suche
                </span>
              </div>
              <p className="text-[11px] text-nb-gray-400 leading-snug">
                Durchsucht UI-Sitemap, Server-Dateien, Code-Zeilen, Ports, DBs
                &amp; Brain Vault nach jeder gesuchten Funktion.
              </p>
            </div>
          </button>
        </div>
      )}

      {mentionMenuOpen && mentionCandidates.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-1.5 max-h-52 overflow-y-auto rounded-lg border border-nb-gray-800 bg-nb-gray-930 p-1.5 shadow-2xl z-30">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-nb-gray-400">
              Insert @Context Mention
            </span>
            <button
              type="button"
              onClick={() => {
                setMentionMenuOpen(false);
                setMentionFilter("");
                setChatInput((prev) => prev.replace(/(?:^|\s)@$/, ""));
              }}
              className="rounded p-0.5 text-nb-gray-400 hover:text-white"
              title="Schließen"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {mentionCandidates.map((cand) => (
            <button
              key={cand.token}
              type="button"
              onClick={() => insertMentionToken(cand.token)}
              className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs text-nb-gray-200 hover:bg-nb-gray-900 hover:text-white"
            >
              <div>
                <span className="font-mono font-semibold text-netbird">
                  {cand.token}
                </span>
                <span className="ml-2 text-[11px] text-nb-gray-400">
                  {cand.label}
                </span>
              </div>
              <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[9px] text-nb-gray-400">
                {cand.category}
              </span>
            </button>
          ))}
        </div>
      )}

      {chatAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-1">
          {chatAttachments.map((att) => (
            <div
              key={att.id}
              className="relative flex items-center gap-2 rounded-md border border-netbird-500/40 bg-nb-gray-930 p-1.5 pr-6 text-[11px] text-nb-gray-200"
            >
              {att.mime_type?.startsWith("image/") ? (
                <img
                  src={att.data_url}
                  alt={att.name}
                  className="h-9 w-9 rounded object-cover"
                />
              ) : (
                <FileText className="h-5 w-5 text-netbird" />
              )}
              <div className="max-w-[110px] truncate font-mono text-[10px]">
                {att.name}
              </div>
              <button
                type="button"
                onClick={() =>
                  setChatAttachments((prev) =>
                    prev.filter((x) => x.id !== att.id)
                  )
                }
                className="absolute right-1 top-1 rounded bg-nb-gray-900 p-0.5 text-nb-gray-400 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.log,.txt,.json,.md,.yml,.yaml"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            processDroppedOrSelectedFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />

      <div className="rounded-xl border border-nb-gray-800 bg-nb-gray-920 p-2 focus-within:border-netbird transition">
        <textarea
          ref={chatInputRef}
          rows={2}
          value={chatInput}
          onClick={() => {
            setSkillMenuOpen(false);
            if (!/(?:^|\s)@([a-zA-Z0-9._:-]*)$/.test(chatInput)) {
              setMentionMenuOpen(false);
            }
          }}
          onChange={(e) => handleChatInputChange(e.target.value)}
          onPaste={handleChatPaste}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendPrompt();
            }
          }}
          placeholder={
            selectedChatSkill === "SkillSearch"
              ? "Wonach suchst du? (z.B. Firewall, SQL, Ports)..."
              : selectedChatSkill
              ? `Optionaler Fokus für ${selectedChatSkill}...`
              : "Frage Synapse AI (@ Kontext, Bilder)..."
          }
          className="w-full resize-none bg-transparent px-1.5 py-1 text-xs leading-relaxed text-white placeholder:text-nb-gray-400 focus:outline-none"
        />

        <div className="mt-1.5 flex items-center justify-between border-t border-nb-gray-800/80 pt-1.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach image, screenshot, diagram, or log file (or Drag & Drop / Ctrl+V)"
              className="flex h-7 items-center gap-1 rounded-md border border-nb-gray-800 bg-nb-gray-940 px-2 text-[11px] text-nb-gray-300 hover:border-netbird hover:text-white transition"
            >
              <Paperclip className="h-3 w-3" />
              <span>Anhang</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (mentionMenuOpen) {
                  setMentionMenuOpen(false);
                  setMentionFilter("");
                  setChatInput((prev) => prev.replace(/(?:^|\s)@$/, ""));
                } else {
                  setSkillMenuOpen(false);
                  setMentionFilter("");
                  setMentionMenuOpen(true);
                }
              }}
              title="Mention a Peer, Service, or Brain Vault Doc (@)"
              className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] transition ${
                mentionMenuOpen
                  ? "border-netbird bg-netbird/15 text-netbird"
                  : "border-nb-gray-800 bg-nb-gray-940 text-nb-gray-300 hover:border-netbird hover:text-white"
              }`}
            >
              <AtSign className="h-3 w-3" />
              <span>Kontext</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMentionMenuOpen(false);
                setMentionFilter("");
                setChatInput((prev) => prev.replace(/(?:^|\s)@$/, ""));
                setSkillMenuOpen((v) => !v);
              }}
              title="AI Skills auswählen (CheckSystem, CheckOpsec, SkillSearch)"
              className={`flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition ${
                skillMenuOpen || selectedChatSkill
                  ? "border-netbird bg-netbird/15 text-netbird"
                  : "border-nb-gray-800 bg-nb-gray-940 text-nb-gray-300 hover:border-netbird hover:text-white"
              }`}
            >
              <Sparkles className="h-3 w-3 shrink-0" />
              <span>Skills</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={chatBusy}
            className="flex h-7 items-center gap-1.5 rounded-md bg-netbird px-3 text-[11px] font-semibold text-white hover:bg-netbird-500 disabled:opacity-40 transition shadow-sm"
          >
            <Send className="h-3 w-3" />
            <span>Senden</span>
          </button>
        </div>
      </div>
    </form>
  );
}
