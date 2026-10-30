"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FsEntry, ProjectState } from "@/types/synapse";

export function useRemoteWorkspaceActions({
  isDe,
  activeProject,
  primaryNode,
  showToast,
  loadWorkspace,
}: {
  isDe: boolean;
  activeProject: ProjectState | null;
  primaryNode: string;
  showToast: (msg: string, durationMs?: number) => void;
  loadWorkspace: (projectId?: string, syncAiSettings?: boolean) => Promise<void>;
}) {
  const [remoteDir, setRemoteDir] = useState(".");
  const [remoteEntries, setRemoteEntries] = useState<FsEntry[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string>("");
  const [editorContent, setEditorContent] = useState<string>("");
  const [diffPatchText, setDiffPatchText] = useState<string>("");
  const [showDiffDrawer, setShowDiffDrawer] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  const openRemoteFile = useCallback(
    async (filePath: string) => {
      if (!activeProject || !primaryNode || !filePath) return;
      try {
        const res = await fetch("/api/orchestrator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: activeProject.project_id,
            direct_tool: {
              name: "node_fs_operation",
              arguments: {
                node_id: primaryNode,
                operation: "read_file",
                path: filePath,
              },
            },
          }),
        });
        const data = await res.json();
        const tr = data.tool_results?.[0];
        if (tr?.output?.success) {
          setActiveFilePath(filePath);
          setEditorContent(tr.output.content || "");
        }
      } catch {
        // ignore
      }
    },
    [activeProject, primaryNode]
  );

  const fetchRemoteDir = useCallback(
    async (dirPath: string, autoSelectFirstFile = false) => {
      if (!activeProject || !primaryNode || activeProject.planning_only) return;
      try {
        const res = await fetch("/api/orchestrator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: activeProject.project_id,
            direct_tool: {
              name: "node_fs_operation",
              arguments: {
                node_id: primaryNode,
                operation: "list_dir",
                path: dirPath,
              },
            },
          }),
        });
        const data = await res.json();
        const tr = data.tool_results?.[0];
        if (Array.isArray(tr?.output?.entries)) {
          const entries = tr.output.entries as FsEntry[];
          setRemoteEntries((prev) => {
            try {
              return JSON.stringify(prev) === JSON.stringify(entries)
                ? prev
                : entries;
            } catch {
              return entries;
            }
          });
          setRemoteDir(dirPath);
          if (autoSelectFirstFile) {
            const firstFile = entries.find((e) => !e.is_dir);
            if (firstFile?.path) {
              void openRemoteFile(firstFile.path);
            }
          }
        }
      } catch {
        // ignore
      }
    },
    [activeProject, primaryNode, openRemoteFile]
  );

  useEffect(() => {
    if (primaryNode && activeProject && !activeProject.planning_only) {
      fetchRemoteDir(".", !activeFilePath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryNode, activeProject?.project_id, activeProject?.planning_only]);

  async function handleSaveRemoteFile() {
    if (!activeProject || !primaryNode || !activeFilePath) return;
    const res = await fetch("/api/orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: activeProject.project_id,
        direct_tool: {
          name: "node_fs_operation",
          arguments: {
            node_id: primaryNode,
            operation: "write_file",
            path: activeFilePath,
            content: editorContent,
          },
        },
      }),
    });
    const data = await res.json();
    const tr = data.tool_results?.[0];
    if (tr?.output?.success) {
      showToast(
        isDe ? `Gespeichert: ${activeFilePath}` : `Saved ${activeFilePath}`
      );
      fetchRemoteDir(remoteDir);
    }
    loadWorkspace(activeProject.project_id);
  }

  async function handleApplyUnifiedDiff() {
    if (!activeProject || !primaryNode || !activeFilePath || !diffPatchText)
      return;
    const res = await fetch("/api/orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: activeProject.project_id,
        direct_tool: {
          name: "node_fs_operation",
          arguments: {
            node_id: primaryNode,
            operation: "apply_unified_diff",
            path: activeFilePath,
            diff: diffPatchText,
          },
        },
      }),
    });
    const data = await res.json();
    const tr = data.tool_results?.[0];
    if (tr?.output?.success) {
      showToast(
        isDe
          ? `Atomarer Diff auf ${activeFilePath} angewendet`
          : `Applied atomic diff to ${activeFilePath}`
      );
      setShowDiffDrawer(false);
      setDiffPatchText("");
      openRemoteFile(activeFilePath);
    }
    loadWorkspace(activeProject.project_id);
  }

  async function handleCreateRemoteFile(e: React.FormEvent) {
    e.preventDefault();
    if (!activeProject || !primaryNode || !newFileName.trim()) return;
    const targetPath =
      remoteDir === "."
        ? newFileName.trim()
        : `${remoteDir}/${newFileName.trim()}`;
    await fetch("/api/orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: activeProject.project_id,
        direct_tool: {
          name: "node_fs_operation",
          arguments: {
            node_id: primaryNode,
            operation: "write_file",
            path: targetPath,
            content: "// Created via Synapse Control Center\n",
          },
        },
      }),
    });
    setNewFileName("");
    fetchRemoteDir(remoteDir);
    openRemoteFile(targetPath);
  }

  async function handleDeleteRemoteFile(targetPath: string) {
    if (!activeProject || !primaryNode) return;
    await fetch("/api/orchestrator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: activeProject.project_id,
        direct_tool: {
          name: "node_fs_operation",
          arguments: {
            node_id: primaryNode,
            operation: "delete",
            path: targetPath,
          },
        },
      }),
    });
    fetchRemoteDir(remoteDir);
    loadWorkspace(activeProject.project_id);
  }

  return {
    remoteDir,
    remoteEntries,
    activeFilePath,
    editorContent,
    setEditorContent,
    diffPatchText,
    setDiffPatchText,
    showDiffDrawer,
    setShowDiffDrawer,
    newFileName,
    setNewFileName,
    openRemoteFile,
    fetchRemoteDir,
    handleSaveRemoteFile,
    handleApplyUnifiedDiff,
    handleCreateRemoteFile,
    handleDeleteRemoteFile,
  };
}
