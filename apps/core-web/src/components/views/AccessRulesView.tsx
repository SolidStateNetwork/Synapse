"use client";

import React from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Shield,
  ShieldAlert,
  X,
} from "lucide-react";
import RichMarkdownDocument from "@/components/RichMarkdownDocument";
import {
  CartridgeMeta,
  PendingApproval,
  ProjectState,
} from "@/types/synapse";
import { SynapseViewHeader } from "@/components/ui/SynapseDesignSystem";

export interface AccessRulesViewProps {
  activeProject: ProjectState | null;
  cartridges: CartridgeMeta[];
  pendingApprovals: PendingApproval[];
  selectedCartridgeId: string;
  setSelectedCartridgeId: (id: string) => void;
  showCustomCartModal: boolean;
  setShowCustomCartModal: React.Dispatch<React.SetStateAction<boolean>>;
  customCartName: string;
  setCustomCartName: (val: string) => void;
  customCartCategory: string;
  setCustomCartCategory: (val: string) => void;
  customCartDesc: string;
  setCustomCartDesc: (val: string) => void;
  customCartContent: string;
  setCustomCartContent: (val: string) => void;
  handleCreateCustomCartridge: (e: React.FormEvent) => void;
  handleToggleCartridge: (id: string) => void;
  handleResolveApproval: (
    approvalId: string,
    decision: "approve" | "reject"
  ) => void;
}

export default function AccessRulesView({
  activeProject,
  cartridges,
  pendingApprovals,
  selectedCartridgeId,
  setSelectedCartridgeId,
  showCustomCartModal,
  setShowCustomCartModal,
  customCartName,
  setCustomCartName,
  customCartCategory,
  setCustomCartCategory,
  customCartDesc,
  setCustomCartDesc,
  customCartContent,
  setCustomCartContent,
  handleCreateCustomCartridge,
  handleToggleCartridge,
  handleResolveApproval,
}: AccessRulesViewProps) {
  const activeCount = (activeProject?.active_cartridges || []).length;

  return (
    <div className="mx-auto max-w-6xl p-6 space-y-5">
      <SynapseViewHeader
        icon={<Shield className="h-5 w-5" />}
        accentColor="amber"
        title="Sicherheits-Regeln & KI-Richtlinien (Rule Cartridges)"
        badgeText={`${activeCount} von ${cartridges.length} aktiv`}
        badgeTone="amber"
        description="Steuere in verständlicher Sprache, welche Sicherheits- und Architektur-Leitplanken der KI-Agent auf deinen Servern strikt einhalten muss. Klicke auf eine Karte, um das Regelwerk aufzuklappen."
        actions={
          <button
            type="button"
            onClick={() => setShowCustomCartModal((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl bg-netbird px-3.5 py-2 text-xs font-medium text-white hover:bg-netbird-500 transition shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Neue Regel-Cartridge erstellen</span>
          </button>
        }
      />

      {showCustomCartModal && (
        <form
          onSubmit={handleCreateCustomCartridge}
          className="rounded-xl border border-netbird-500/50 bg-nb-gray-940 p-5 space-y-3 text-xs shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">
              Eigene Regel-Cartridge erstellen (.md)
            </span>
            <button
              type="button"
              onClick={() => setShowCustomCartModal(false)}
              className="text-nb-gray-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="text"
              value={customCartName}
              onChange={(e) => setCustomCartName(e.target.value)}
              placeholder="Cartridge-Name (z.B. DSGVO / HIPAA)"
              className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-white"
            />
            <input
              type="text"
              value={customCartCategory}
              onChange={(e) => setCustomCartCategory(e.target.value)}
              placeholder="Kategorie (z.B. Sicherheit)"
              className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-white"
            />
            <input
              type="text"
              value={customCartDesc}
              onChange={(e) => setCustomCartDesc(e.target.value)}
              placeholder="Kurzbeschreibung..."
              className="rounded-lg border border-nb-gray-800 bg-nb-gray-920 px-3 py-2 text-white"
            />
          </div>
          <textarea
            value={customCartContent}
            onChange={(e) => setCustomCartContent(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-nb-gray-800 bg-nb-gray-960 p-3 font-mono text-xs text-nb-gray-100"
          />
          <div className="flex justify-end gap-2">
            <button
              type="submit"
              className="rounded-lg bg-netbird px-4 py-1.5 text-xs font-medium text-white hover:bg-netbird-500 transition"
            >
              Cartridge speichern &amp; aktivieren
            </button>
          </div>
        </form>
      )}

      {/* Pending Tier-3 Approvals Gate with Visual Unified Diff Highlighting */}
      {pendingApprovals.length > 0 && (
        <div className="rounded-xl border border-netbird-500/60 bg-netbird-950/30 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-netbird flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Ausstehende Tier-3-Freigaben ({pendingApprovals.length})
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {pendingApprovals.map((req) => {
              const rawPreview = String(
                req.arguments?.command ||
                  req.arguments?.content_or_patch ||
                  req.arguments?.content ||
                  JSON.stringify(req.arguments, null, 2)
              );
              return (
                <div
                  key={req.approval_id}
                  className="rounded-xl border border-nb-gray-800 bg-nb-gray-940 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="font-semibold text-white">
                      {req.tool_name}
                    </span>
                    <span className="text-nb-gray-400">{req.node_id}</span>
                  </div>
                  <div className="max-h-40 overflow-auto rounded-lg bg-nb-gray-960 p-2.5 font-mono text-[11px] space-y-0.5">
                    {rawPreview.split("\n").map((line, idx) => {
                      const isAdd =
                        line.startsWith("+") && !line.startsWith("+++");
                      const isDel =
                        line.startsWith("-") && !line.startsWith("---");
                      const isHunk = line.startsWith("@@");
                      return (
                        <div
                          key={idx}
                          className={`px-1 rounded-sm whitespace-pre-wrap break-all ${
                            isAdd
                              ? "bg-green-950/70 text-green-300"
                              : isDel
                                ? "bg-red-950/70 text-red-300"
                                : isHunk
                                  ? "bg-sky-950/60 text-sky-300"
                                  : "text-nb-gray-200"
                          }`}
                        >
                          {line}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        handleResolveApproval(req.approval_id, "approve")
                      }
                      className="flex-1 rounded-lg bg-green-600 py-1.5 text-xs font-medium text-white hover:bg-green-500 transition"
                    >
                      Freigeben &amp; Ausführen
                    </button>
                    <button
                      onClick={() =>
                        handleResolveApproval(req.approval_id, "reject")
                      }
                      className="flex-1 rounded-lg border border-red-500/50 bg-red-950/50 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950 transition"
                    >
                      Ablehnen
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pluggable Rule Cartridges Grid with Inline Expandable Markdown Policy */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-start">
        {cartridges.map((c) => {
          const enabled = activeProject?.active_cartridges?.includes(c.id);
          const selected = selectedCartridgeId === c.id;
          return (
            <div
              key={c.id}
              onClick={() => setSelectedCartridgeId(selected ? "" : c.id)}
              className={`cursor-pointer rounded-xl border p-4 transition-all ${
                selected
                  ? "border-netbird bg-nb-gray-930 ring-1 ring-netbird/30 sm:col-span-2"
                  : "border-nb-gray-900 bg-nb-gray-940 hover:border-nb-gray-800"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        enabled ? "bg-green-400" : "bg-nb-gray-500"
                      }`}
                    />
                    <span className="text-sm font-semibold text-white leading-snug">
                      {c.name}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 font-mono text-[9.5px] text-nb-gray-400">
                    {c.category}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-nb-gray-400 hover:text-white">
                    <span>{selected ? "Einklappen" : "Erweitern"}</span>
                    {selected ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleCartridge(c.id);
                    }}
                    className={`rounded-md border px-2.5 py-1 font-mono text-[10px] font-medium transition ${
                      enabled
                        ? "border-green-500/50 bg-green-950/70 text-green-400"
                        : "border-nb-gray-800 bg-nb-gray-920 text-nb-gray-400 hover:text-white"
                    }`}
                  >
                    {enabled ? "AKTIV" : "AUS"}
                  </button>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-nb-gray-400">{c.description}</p>

              {selected && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3.5 border-t border-nb-gray-800 pt-3.5"
                >
                  <RichMarkdownDocument markdown={c.content} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
