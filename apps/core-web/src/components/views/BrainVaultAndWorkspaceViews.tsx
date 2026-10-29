"use client";

import React from "react";
import {
  BookOpen,
  Brain,
  Code2,
  FileCode2,
  FileText,
  Folder,
  FolderGit2,
  GitCompare,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import RichMarkdownDocument from "@/components/RichMarkdownDocument";
import {
  SynapseSubTabs,
  SynapseViewHeader,
} from "@/components/ui/SynapseDesignSystem";
import type { FsEntry } from "@/types/synapse";

export interface BrainVaultViewProps {
  projectId: string;
  brainDocTab: "Architecture.md" | "Memory.md";
  setBrainDocTab: (doc: "Architecture.md" | "Memory.md") => void;
  isEditingMarkdown: boolean;
  setIsEditingMarkdown: React.Dispatch<React.SetStateAction<boolean>>;
  architectureMd: string;
  setArchitectureMd: (val: string) => void;
  memoryMd: string;
  setMemoryMd: (val: string) => void;
  handleSaveBrainDoc: (doc: "Architecture.md" | "Memory.md") => void;
}

export const BrainVaultView = React.memo(function BrainVaultView({
  projectId,
  brainDocTab,
  setBrainDocTab,
  isEditingMarkdown,
  setIsEditingMarkdown,
  architectureMd,
  setArchitectureMd,
  memoryMd,
  setMemoryMd,
  handleSaveBrainDoc,
}: BrainVaultViewProps) {
  return (
    <div className="mx-auto max-w-6xl p-6 space-y-5">
      <SynapseViewHeader
        icon={<Brain className="h-5 w-5" />}
        accentColor="purple"
        title="Brain Vault (Architektur- & System-Gedächtnis)"
        description="Das persistente Langzeit-Gedächtnis deines Projekts. Der KI-Orchestrator liest und aktualisiert Architecture.md (Topologie, Ports, Dienste) und Memory.md (Runbooks, gelöste Fehler) vollautomatisch."
        actions={
          <>
            <button
              onClick={() => setIsEditingMarkdown((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 text-xs font-medium text-nb-gray-200 hover:text-white transition"
            >
              <Code2 className="h-3.5 w-3.5 text-netbird" />
              <span>{isEditingMarkdown ? "Leseansicht" : "Bearbeiten"}</span>
            </button>

            {isEditingMarkdown && (
              <button
                onClick={() => handleSaveBrainDoc(brainDocTab)}
                className="flex items-center gap-1.5 rounded-xl bg-netbird px-4 py-2 text-xs font-medium text-white hover:bg-netbird-500 transition shadow-sm"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Speichern</span>
              </button>
            )}
          </>
        }
        subTabs={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <SynapseSubTabs
              activeTab={brainDocTab}
              onChange={(doc) => {
                setBrainDocTab(doc);
                setIsEditingMarkdown(false);
              }}
              tabs={[
                {
                  id: "Architecture.md",
                  label: "Architecture.md (System-Topologie)",
                  icon: <FileText className="h-3.5 w-3.5" />,
                },
                {
                  id: "Memory.md",
                  label: "Memory.md (KI-Erfahrungsschatz)",
                  icon: <BookOpen className="h-3.5 w-3.5" />,
                },
              ]}
            />
            <span className="hidden sm:inline font-mono text-[11px] text-nb-gray-400">
              /projects/{projectId || "synapse-cloud-demo"}/{brainDocTab}
            </span>
          </div>
        }
      />

      <div className="flex flex-col overflow-hidden rounded-xl border border-nb-gray-900 bg-nb-gray-940">
        <div className="p-6">
          {isEditingMarkdown ? (
            <textarea
              value={
                brainDocTab === "Architecture.md" ? architectureMd : memoryMd
              }
              onChange={(e) =>
                brainDocTab === "Architecture.md"
                  ? setArchitectureMd(e.target.value)
                  : setMemoryMd(e.target.value)
              }
              className="h-[560px] w-full rounded-lg border border-nb-gray-800 bg-nb-gray-960 p-4 font-mono text-xs text-nb-gray-100 focus:border-netbird focus:outline-none"
            />
          ) : (
            <RichMarkdownDocument
              variant={
                brainDocTab === "Memory.md" ? "memory" : "architecture"
              }
              markdown={
                brainDocTab === "Architecture.md" ? architectureMd : memoryMd
              }
            />
          )}
        </div>
      </div>
    </div>
  );
});

export interface WorkspaceExplorerViewProps {
  showDiffDrawer: boolean;
  setShowDiffDrawer: React.Dispatch<React.SetStateAction<boolean>>;
  handleSaveRemoteFile: () => void;
  workspaceSidebarWidth: number;
  setWorkspaceSidebarWidth: (w: number) => void;
  remoteDir: string;
  fetchRemoteDir: (dirPath: string) => void;
  remoteEntries: FsEntry[];
  activeFilePath: string;
  openRemoteFile: (filePath: string) => void;
  handleDeleteRemoteFile: (filePath: string) => void;
  handleCreateRemoteFile: (e: React.FormEvent) => void;
  newFileName: string;
  setNewFileName: (name: string) => void;
  diffPatchText: string;
  setDiffPatchText: (val: string) => void;
  handleApplyUnifiedDiff: () => void;
  editorContent: string;
  setEditorContent: (val: string) => void;
}

export const WorkspaceExplorerView = React.memo(function WorkspaceExplorerView({
  showDiffDrawer,
  setShowDiffDrawer,
  handleSaveRemoteFile,
  workspaceSidebarWidth,
  setWorkspaceSidebarWidth,
  remoteDir,
  fetchRemoteDir,
  remoteEntries,
  activeFilePath,
  openRemoteFile,
  handleDeleteRemoteFile,
  handleCreateRemoteFile,
  newFileName,
  setNewFileName,
  diffPatchText,
  setDiffPatchText,
  handleApplyUnifiedDiff,
  editorContent,
  setEditorContent,
}: WorkspaceExplorerViewProps) {
  return (
    <div className="mx-auto max-w-6xl p-6 space-y-5">
      <SynapseViewHeader
        icon={<FolderGit2 className="h-5 w-5" />}
        accentColor="indigo"
        title="Remote-Dateien & Code-Editor"
        description="Durchsuche und bearbeite Dateien direkt im isolierten Server-Workspace (/opt/axon/workspaces) oder wende Unified-Diff-Patches mit automatischem Backup-Schutz an."
        actions={
          <>
            <button
              onClick={() => setShowDiffDrawer((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-nb-gray-800 bg-nb-gray-920 px-3.5 py-2 text-xs font-medium text-nb-gray-200 hover:text-white transition"
            >
              <GitCompare className="h-3.5 w-3.5 text-netbird" />
              <span>Unified-Diff-Patch</span>
            </button>
            <button
              onClick={handleSaveRemoteFile}
              className="flex items-center gap-1.5 rounded-xl bg-netbird px-4 py-2 text-xs font-medium text-white hover:bg-netbird-500 transition shadow-sm"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Auf Server speichern</span>
            </button>
          </>
        }
      />

      <div className="flex h-[620px] overflow-hidden rounded-xl border border-nb-gray-900 bg-nb-gray-940 shadow-lg">
        <div
          style={{ width: `${workspaceSidebarWidth}px` }}
          className="relative shrink-0 border-r border-nb-gray-900 bg-nb-gray-940 p-3 flex flex-col justify-between"
        >
          <div
            title="Mit der Maus ziehen, um die Dateiliste breiter/schmaler zu machen"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startW = workspaceSidebarWidth;
              const onMove = (ev: MouseEvent) => {
                setWorkspaceSidebarWidth(
                  Math.max(
                    190,
                    Math.min(480, startW + (ev.clientX - startX))
                  )
                );
              };
              const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-netbird/60 transition-colors z-20"
          />
          <div className="space-y-2 overflow-y-auto">
            <div className="flex items-center justify-between px-2 py-1 text-xs font-medium text-nb-gray-300">
              <span className="font-mono truncate">{remoteDir}</span>
              <button
                onClick={() => fetchRemoteDir(".")}
                className="text-nb-gray-400 hover:text-white"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            {remoteEntries.map((ent) => (
              <div
                key={ent.path}
                className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs cursor-pointer ${
                  activeFilePath === ent.path
                    ? "bg-nb-gray-900 text-white"
                    : "text-nb-gray-400 hover:bg-nb-gray-900/50 hover:text-nb-gray-200"
                }`}
                onClick={() =>
                  ent.is_dir
                    ? fetchRemoteDir(ent.path)
                    : openRemoteFile(ent.path)
                }
              >
                <div className="flex items-center gap-2 truncate">
                  {ent.is_dir ? (
                    <Folder className="h-3.5 w-3.5 text-netbird shrink-0" />
                  ) : (
                    <FileCode2 className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                  )}
                  <span className="truncate font-mono">{ent.name}</span>
                </div>
                {!ent.is_dir && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRemoteFile(ent.path);
                    }}
                    className="text-nb-gray-500 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <form
            onSubmit={handleCreateRemoteFile}
            className="flex gap-1.5 pt-2 border-t border-nb-gray-900"
          >
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="Neuer Dateipfad..."
              className="flex-1 rounded-lg border border-nb-gray-800 bg-nb-gray-950 px-2.5 py-1 font-mono text-xs text-white"
            />
            <button
              type="submit"
              className="rounded-lg bg-netbird px-2.5 py-1 text-xs text-white hover:bg-netbird-500 transition"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>

        <div className="flex flex-1 flex-col bg-nb-gray-960">
          {showDiffDrawer && (
            <div className="border-b border-nb-gray-900 bg-nb-gray-940 p-4 space-y-2">
              <textarea
                value={diffPatchText}
                onChange={(e) => setDiffPatchText(e.target.value)}
                placeholder="Unified-Diff einfügen (@@ -1,3 +1,4 @@)..."
                className="h-28 w-full rounded-lg border border-nb-gray-800 bg-nb-gray-960 p-2.5 font-mono text-xs text-emerald-400"
              />
              <button
                onClick={handleApplyUnifiedDiff}
                className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 transition"
              >
                Unified-Diff anwenden
              </button>
            </div>
          )}

          <textarea
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
            className="flex-1 w-full resize-none bg-nb-gray-960 p-5 font-mono text-xs leading-relaxed text-nb-gray-100 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
});
