"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Folder,
  GitCompare,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import type { FsEntry } from "@proto/tunnel";

interface RemoteWorkspaceExplorerProps {
  projectId: string;
  nodeId: string;
  onAuditRefresh?: () => void;
}

export default function RemoteWorkspaceExplorer({
  projectId,
  nodeId,
  onAuditRefresh,
}: RemoteWorkspaceExplorerProps) {
  const [currentDir, setCurrentDir] = useState(".");
  const [entries, setEntries] = useState<FsEntry[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [unifiedDiff, setUnifiedDiff] = useState<string>("");
  const [newFilePath, setNewFilePath] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const loadDirectory = useCallback(
    async (dirPath: string) => {
      if (!nodeId) return;
      setLoading(true);
      try {
        const res = await fetch("/api/orchestrator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            direct_tool: {
              name: "node_fs_operation",
              arguments: {
                node_id: nodeId,
                operation: "list_dir",
                path: dirPath,
              },
            },
          }),
        });
        const data = await res.json();
        const tr = data.tool_results?.[0];
        if (tr?.status === "executed" && tr?.output?.entries) {
          setEntries(tr.output.entries);
          setCurrentDir(dirPath);
          setStatusMsg(`Loaded ${tr.output.entries.length} entries from ${dirPath}`);
        } else if (tr?.status === "blocked_planning_mode") {
          setStatusMsg("Blocked: Project is in Planning-Only Mode (0 nodes assigned).");
        } else {
          setStatusMsg(tr?.output?.error || "Failed to list directory");
        }
      } finally {
        setLoading(false);
        onAuditRefresh?.();
      }
    },
    [nodeId, projectId, onAuditRefresh]
  );

  useEffect(() => {
    if (nodeId) {
      loadDirectory(".");
    }
  }, [nodeId, loadDirectory]);

  async function handleReadFile(targetPath: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          direct_tool: {
            name: "node_fs_operation",
            arguments: {
              node_id: nodeId,
              operation: "read_file",
              path: targetPath,
            },
          },
        }),
      });
      const data = await res.json();
      const tr = data.tool_results?.[0];
      if (tr?.output?.success) {
        setSelectedFile(targetPath);
        setFileContent(tr.output.content || "");
        setStatusMsg(`Read ${targetPath} via STREAM_TYPE_RPC_FS`);
      } else {
        setStatusMsg(tr?.output?.error || "Failed reading file");
      }
    } finally {
      setLoading(false);
      onAuditRefresh?.();
    }
  }

  async function handleSaveFile() {
    if (!selectedFile) return;
    setLoading(true);
    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          direct_tool: {
            name: "node_fs_operation",
            arguments: {
              node_id: nodeId,
              operation: "write_file",
              path: selectedFile,
              content: fileContent,
            },
          },
        }),
      });
      const data = await res.json();
      const tr = data.tool_results?.[0];
      setStatusMsg(
        tr?.status === "paused_tier3"
          ? `Paused by TIER_3_SUPERVISED Interceptor (${tr.approval_id})`
          : tr?.output?.success
          ? `Atomically saved ${selectedFile}`
          : tr?.output?.error || "Write failed"
      );
      await loadDirectory(currentDir);
    } finally {
      setLoading(false);
      onAuditRefresh?.();
    }
  }

  async function handleApplyUnifiedDiff() {
    if (!selectedFile || !unifiedDiff.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          direct_tool: {
            name: "node_fs_operation",
            arguments: {
              node_id: nodeId,
              operation: "apply_unified_diff",
              path: selectedFile,
              diff: unifiedDiff,
            },
          },
        }),
      });
      const data = await res.json();
      const tr = data.tool_results?.[0];
      if (tr?.output?.success) {
        setFileContent(tr.output.content || fileContent);
        setUnifiedDiff("");
        setStatusMsg(`Applied unified diff to ${selectedFile}`);
      } else {
        setStatusMsg(tr?.output?.error || "Unified diff failed");
      }
    } finally {
      setLoading(false);
      onAuditRefresh?.();
    }
  }

  async function handleCreateFile(e: React.FormEvent) {
    e.preventDefault();
    if (!newFilePath.trim()) return;
    setSelectedFile(newFilePath.trim());
    setFileContent("// Created via Synapse Remote Workspace Explorer\n");
    setNewFilePath("");
  }

  async function handleDeleteEntry(targetPath: string) {
    setLoading(true);
    try {
      await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          direct_tool: {
            name: "node_fs_operation",
            arguments: {
              node_id: nodeId,
              operation: "delete",
              path: targetPath,
            },
          },
        }),
      });
      if (selectedFile === targetPath) {
        setSelectedFile("");
        setFileContent("");
      }
      await loadDirectory(currentDir);
    } finally {
      setLoading(false);
      onAuditRefresh?.();
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left Column: Directory Tree */}
      <div className="rounded-xl border border-slate-800 bg-[#0c0e17] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Remote Node Filesystem
            </h3>
            <p className="font-mono text-[11px] text-slate-400">
              Node: {nodeId || "unassigned"} ({currentDir})
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => loadDirectory(".")}
              className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
            >
              Root (.)
            </button>
            <button
              onClick={() => loadDirectory(currentDir)}
              disabled={loading}
              className="rounded border border-slate-700 bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleCreateFile} className="flex gap-1.5">
          <input
            type="text"
            value={newFilePath}
            onChange={(e) => setNewFilePath(e.target.value)}
            placeholder="New relative path (e.g. src/index.js)"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-slate-200"
          />
          <button
            type="submit"
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
          >
            <Plus className="h-3.5 w-3.5" />
            New
          </button>
        </form>

        <div className="space-y-1 max-h-[420px] overflow-y-auto">
          {entries.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">
              No files found in workspace directory.
            </p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.path}
                className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-[#07090e] px-3 py-2 text-xs hover:border-slate-700"
              >
                <button
                  onClick={() =>
                    entry.is_dir
                      ? loadDirectory(entry.path)
                      : handleReadFile(entry.path)
                  }
                  className="flex items-center gap-2 text-left font-mono text-slate-200 hover:text-emerald-400 truncate"
                >
                  {entry.is_dir ? (
                    <Folder className="h-4 w-4 text-amber-400 shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                  )}
                  <span className="truncate">{entry.name}</span>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {!entry.is_dir && (
                    <span className="font-mono text-[10px] text-slate-400">
                      {entry.size}B
                    </span>
                  )}
                  <button
                    onClick={() => handleDeleteEntry(entry.path)}
                    className="text-slate-500 hover:text-rose-400"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {statusMsg && (
          <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 font-mono text-[11px] text-emerald-300">
            {statusMsg}
          </div>
        )}
      </div>

      {/* Right Column: Atomic File Editor & Unified Diff Patcher */}
      <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#0c0e17] p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-mono text-xs font-semibold text-cyan-400">
              {selectedFile || "Select or create a file on the remote node"}
            </span>
          </div>
          <button
            onClick={handleSaveFile}
            disabled={!selectedFile || loading}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            Atomic Write (`write_file`)
          </button>
        </div>

        <textarea
          value={fileContent}
          onChange={(e) => setFileContent(e.target.value)}
          rows={13}
          placeholder="File content on remote Axon Muscle Node..."
          className="w-full rounded-lg border border-slate-800 bg-[#07090e] p-3 font-mono text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
        />

        <div className="border-t border-slate-800 pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
              <GitCompare className="h-4 w-4" />
              Apply Unified Diff (`apply_unified_diff`)
            </span>
            <button
              onClick={handleApplyUnifiedDiff}
              disabled={!selectedFile || !unifiedDiff.trim() || loading}
              className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-40"
            >
              Patch File on Node
            </button>
          </div>
          <textarea
            value={unifiedDiff}
            onChange={(e) => setUnifiedDiff(e.target.value)}
            rows={5}
            placeholder={`@@ -1,3 +1,3 @@\n-const port = 4050;\n+const port = 5000;\n`}
            className="w-full rounded-lg border border-slate-800 bg-[#07090e] p-2.5 font-mono text-xs text-amber-200 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
