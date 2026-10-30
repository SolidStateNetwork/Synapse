"use client";

import React, { useState, useMemo } from "react";
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import {
  InlineActionHandlers,
  resolveSectionTheme,
  renderInlineFormatting,
} from "./markdown/markdownInlineAndThemeHelpers";
import { StandardRichDocument } from "./markdown/MarkdownProseAndStandardRenderer";

export interface RichMarkdownDocumentProps {
  markdown: string;
  variant?: "architecture" | "memory" | "cartridge" | "chat";
  onOpenPort?: (port: number) => void;
  onOpenFile?: (filePath: string) => void;
  onOpenBrainDoc?: (doc: "Architecture.md" | "Memory.md") => void;
  onRunCommand?: (cmd: string) => void;
}

/**
 * Renders Synapse Markdown artifacts (`Architecture.md`, `Memory.md`, `Cartridges/*.md`, and Chat replies)
 * into interactive, grouped, topic-themed cards, KPI bento strips, sortable tables, and smart action chips.
 */
export default function RichMarkdownDocument({
  markdown,
  variant = "architecture",
  onOpenPort,
  onOpenFile,
  onOpenBrainDoc,
  onRunCommand,
}: RichMarkdownDocumentProps) {
  const handlers: InlineActionHandlers = useMemo(
    () => ({
      onOpenPort,
      onOpenFile,
      onOpenBrainDoc,
      onRunCommand,
    }),
    [onOpenPort, onOpenFile, onOpenBrainDoc, onRunCommand]
  );

  if (!markdown || !markdown.trim()) {
    return (
      <div className="py-3 text-xs italic text-nb-gray-400">
        Noch keine Inhalte vorhanden.
      </div>
    );
  }

  if (variant === "chat") {
    return <ChatRichDocument markdown={markdown} handlers={handlers} />;
  }

  return (
    <StandardRichDocument
      markdown={markdown}
      variant={variant}
      handlers={handlers}
    />
  );
}

function ChatRichDocument({
  markdown,
  handlers,
}: {
  markdown: string;
  handlers: InlineActionHandlers;
}) {
  const parsed = useMemo(() => {
    const lines = markdown.split("\n");
    let inFence = false;

    let h2Count = 0;
    let h3Count = 0;
    let h4Count = 0;

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (trimmed.startsWith("```")) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      if (trimmed.startsWith("## ")) h2Count++;
      else if (trimmed.startsWith("### ")) h3Count++;
      else if (trimmed.startsWith("#### ")) h4Count++;
    }

    let sectionPrefix = "## ";
    let titlePrefixes = ["# "];
    if (h2Count >= 2) {
      sectionPrefix = "## ";
      titlePrefixes = ["# "];
    } else if (h3Count >= 2) {
      sectionPrefix = "### ";
      titlePrefixes = ["# ", "## "];
    } else if (h4Count >= 2) {
      sectionPrefix = "#### ";
      titlePrefixes = ["# ", "## ", "### "];
    }

    inFence = false;
    let mainTitle: string | null = null;
    const introLines: string[] = [];
    const sections: Array<{ title: string; content: string }> = [];
    let currentSection: { title: string; lines: string[] } | null = null;

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (trimmed.startsWith("```")) {
        inFence = !inFence;
      }

      if (
        !inFence &&
        !mainTitle &&
        !currentSection &&
        titlePrefixes.some((p) => trimmed.startsWith(p))
      ) {
        const matchedPrefix = titlePrefixes.find((p) => trimmed.startsWith(p))!;
        mainTitle = trimmed.slice(matchedPrefix.length).trim();
        continue;
      }

      if (!inFence && trimmed.startsWith(sectionPrefix)) {
        if (currentSection) {
          sections.push({
            title: currentSection.title,
            content: currentSection.lines.join("\n").trim(),
          });
        }
        currentSection = {
          title: trimmed.slice(sectionPrefix.length).trim(),
          lines: [],
        };
        continue;
      }

      if (
        !inFence &&
        sectionPrefix === "## " &&
        trimmed.startsWith("# ") &&
        (mainTitle || currentSection)
      ) {
        if (currentSection) {
          sections.push({
            title: currentSection.title,
            content: currentSection.lines.join("\n").trim(),
          });
        }
        currentSection = {
          title: trimmed.slice(2).trim(),
          lines: [],
        };
        continue;
      }

      if (currentSection) {
        currentSection.lines.push(rawLine);
      } else {
        introLines.push(rawLine);
      }
    }

    if (currentSection) {
      sections.push({
        title: currentSection.title,
        content: currentSection.lines.join("\n").trim(),
      });
    }

    return {
      mainTitle,
      introContent: introLines.join("\n").trim(),
      sections,
    };
  }, [markdown]);

  const [activeSectionFilter, setActiveSectionFilter] = useState<
    number | "all"
  >("all");
  const [collapsedSections, setCollapsedSections] = useState<
    Record<number, boolean>
  >({});

  const toggleAllSections = () => {
    const anyCollapsed = parsed.sections.some((_, i) => collapsedSections[i]);
    if (anyCollapsed) {
      setCollapsedSections({});
    } else {
      const next: Record<number, boolean> = {};
      parsed.sections.forEach((_, i) => {
        next[i] = true;
      });
      setCollapsedSections(next);
    }
  };

  if (parsed.sections.length === 0) {
    return (
      <div className="min-w-0 space-y-2.5 break-words leading-relaxed text-nb-gray-200">
        {parsed.mainTitle && (
          <div className="flex items-center gap-2 border-b border-nb-gray-800/80 pb-2">
            <Sparkles className="h-4 w-4 shrink-0 text-netbird" />
            <h1 className="text-sm font-bold tracking-tight text-white break-words">
              {renderInlineFormatting(parsed.mainTitle, handlers)}
            </h1>
          </div>
        )}
        <StandardRichDocument
          markdown={parsed.introContent || markdown}
          variant="chat"
          handlers={handlers}
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3 break-words leading-relaxed text-nb-gray-200">
      {parsed.mainTitle && (
        <div className="rounded-xl border border-netbird-500/30 bg-gradient-to-r from-netbird-950/60 via-nb-gray-940 to-nb-gray-940 px-3.5 py-2.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-netbird-500/40 bg-netbird/15 text-netbird">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <h1 className="text-xs sm:text-sm font-bold tracking-tight text-white break-words">
                {renderInlineFormatting(parsed.mainTitle, handlers)}
              </h1>
            </div>
            <span className="shrink-0 rounded-full border border-nb-gray-800 bg-nb-gray-950/80 px-2 py-0.5 font-mono text-[10px] text-nb-gray-300">
              {parsed.sections.length} Themenbereiche
            </span>
          </div>
        </div>
      )}

      {parsed.introContent && (
        <StandardRichDocument
          markdown={parsed.introContent}
          variant="chat"
          handlers={handlers}
        />
      )}

      {parsed.sections.length >= 2 && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 rounded-xl border border-nb-gray-800/90 bg-nb-gray-950/90 p-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveSectionFilter("all")}
              className={`rounded-lg px-2 py-1 font-mono text-[10px] font-medium transition ${
                activeSectionFilter === "all"
                  ? "bg-netbird text-white shadow-sm"
                  : "text-nb-gray-400 hover:bg-nb-gray-900 hover:text-white"
              }`}
            >
              Alle ({parsed.sections.length})
            </button>
            {parsed.sections.map((sec, sIdx) => {
              const cleanTitle = sec.title
                .replace(/^\d+\.\s*/, "")
                .replace(/\*\*/g, "")
                .trim();
              const shortLabel =
                cleanTitle.length > 22
                  ? cleanTitle.slice(0, 20) + "…"
                  : cleanTitle;
              const isSelected = activeSectionFilter === sIdx;
              return (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => {
                    setActiveSectionFilter(isSelected ? "all" : sIdx);
                    setCollapsedSections((prev) => ({
                      ...prev,
                      [sIdx]: false,
                    }));
                  }}
                  title={cleanTitle}
                  className={`rounded-lg px-2 py-1 text-[10px] font-medium transition ${
                    isSelected
                      ? "border border-netbird-500/50 bg-netbird/20 text-white"
                      : "text-nb-gray-300 hover:bg-nb-gray-900 hover:text-white"
                  }`}
                >
                  {sIdx + 1}. {shortLabel}
                </button>
              );
            })}
          </div>

          {activeSectionFilter === "all" && (
            <button
              type="button"
              onClick={toggleAllSections}
              className="rounded-lg border border-nb-gray-800 bg-nb-gray-930 px-2 py-1 font-mono text-[10px] text-nb-gray-300 transition hover:border-nb-gray-700 hover:text-white"
            >
              {parsed.sections.some((_, i) => collapsedSections[i])
                ? "Alle aufklappen"
                : "Kompaktansicht"}
            </button>
          )}
        </div>
      )}

      <div className="space-y-2.5">
        {parsed.sections.map((sec, sIdx) => {
          if (activeSectionFilter !== "all" && activeSectionFilter !== sIdx) {
            return null;
          }
          const theme = resolveSectionTheme(sec.title, sIdx);
          const isCollapsed =
            activeSectionFilter === "all" && Boolean(collapsedSections[sIdx]);

          return (
            <div
              key={sIdx}
              className={`overflow-hidden rounded-xl border bg-nb-gray-940/50 transition ${theme.borderClass}`}
            >
              <button
                type="button"
                onClick={() =>
                  setCollapsedSections((prev) => ({
                    ...prev,
                    [sIdx]: !prev[sIdx],
                  }))
                }
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition ${theme.headerBgClass}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {theme.icon}
                  <span
                    className={`text-xs font-semibold tracking-tight break-words ${theme.accentTextClass}`}
                  >
                    {renderInlineFormatting(sec.title, handlers)}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`hidden sm:inline-block rounded-full border px-2 py-0.5 font-mono text-[9px] font-medium ${theme.badgeClass}`}
                  >
                    {theme.badgeLabel}
                  </span>
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-nb-gray-400" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-nb-gray-400" />
                  )}
                </div>
              </button>

              {!isCollapsed && (
                <div className="border-t border-nb-gray-800/60 p-3">
                  <StandardRichDocument
                    markdown={sec.content}
                    variant="chat"
                    handlers={handlers}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
