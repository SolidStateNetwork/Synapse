"use client";

import React, { useState, useMemo } from "react";
import MermaidTopologyView from "./MermaidTopologyView";
import {
  Clock,
  Terminal,
  FolderTree,
  Sparkles,
  Copy,
  Check,
  Shield,
  Activity,
  RefreshCw,
  Cpu,
  Database,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileCode2,
  BookOpen,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  ArrowUpDown,
  Layers,
} from "lucide-react";

export interface RichMarkdownDocumentProps {
  markdown: string;
  variant?: "architecture" | "memory" | "cartridge" | "chat";
  onOpenPort?: (port: number) => void;
  onOpenFile?: (filePath: string) => void;
  onOpenBrainDoc?: (doc: "Architecture.md" | "Memory.md") => void;
  onRunCommand?: (cmd: string) => void;
}

interface InlineActionHandlers {
  onOpenPort?: (port: number) => void;
  onOpenFile?: (filePath: string) => void;
  onOpenBrainDoc?: (doc: "Architecture.md" | "Memory.md") => void;
  onRunCommand?: (cmd: string) => void;
}

function CodeBlockWithCopy({
  lang,
  content,
  onRunCommand,
}: {
  lang: string;
  content: string;
  onRunCommand?: (cmd: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => content.split("\n"), [content]);
  const isLong = lines.length > 14;
  const [expanded, setExpanded] = useState(!isLong);

  const normalizedLang = (lang || "text").toLowerCase();
  const isShellLike =
    ["bash", "sh", "shell", "zsh", "console"].includes(normalizedLang) ||
    /^(curl|systemctl|journalctl|apt|docker|ss|ufw|git|python3|go|npm|node)\b/m.test(
      content.trim()
    );

  const displayedContent = expanded
    ? content
    : lines.slice(0, 10).join("\n") + `\n# ... (${lines.length - 10} weitere Zeilen)`;

  return (
    <div className="my-2 min-w-0 overflow-hidden rounded-xl border border-nb-gray-800/90 bg-nb-gray-960 shadow-sm transition hover:border-nb-gray-700/80">
      <div className="flex items-center justify-between border-b border-nb-gray-900 bg-nb-gray-940/90 px-3 py-1.5 font-mono text-[11px] text-nb-gray-400">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-nb-gray-200 font-medium">
            <Terminal className="h-3 w-3 text-netbird" />
            <span>{normalizedLang}</span>
          </span>
          <span className="rounded bg-nb-gray-900 px-1.5 py-0.2 text-[9px] text-nb-gray-400">
            {lines.length} {lines.length === 1 ? "Zeile" : "Zeilen"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 text-[10px] text-nb-gray-300 transition hover:border-nb-gray-700 hover:text-white"
            >
              {expanded ? (
                <>
                  <ChevronDown className="h-3 w-3" />
                  <span>Kompakt</span>
                </>
              ) : (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span>Alle {lines.length} Zeilen</span>
                </>
              )}
            </button>
          )}
          {isShellLike && onRunCommand && (
            <button
              type="button"
              onClick={() => onRunCommand(content.trim())}
              title="Befehl direkt in die Live-PTY-Shell übertragen"
              className="flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-950/50 px-2 py-0.5 text-[10px] font-medium text-emerald-300 transition hover:bg-emerald-900/60 hover:text-white"
            >
              <Play className="h-2.5 w-2.5 fill-current" />
              <span>Terminal</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(content);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            }}
            className="flex items-center gap-1 rounded border border-nb-gray-800 bg-nb-gray-950 px-2 py-0.5 text-[10px] text-nb-gray-300 transition hover:border-nb-gray-700 hover:text-white"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Kopiert</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Kopieren</span>
              </>
            )}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all p-3 font-mono text-[11px] leading-relaxed text-nb-gray-100">
        {displayedContent}
      </pre>
    </div>
  );
}

type SectionThemeKey =
  | "security"
  | "system"
  | "update"
  | "forensics"
  | "data"
  | "findings"
  | "general";

interface SectionThemeStyle {
  key: SectionThemeKey;
  badgeLabel: string;
  borderClass: string;
  headerBgClass: string;
  accentTextClass: string;
  badgeClass: string;
  icon: React.ReactNode;
}

function resolveSectionTheme(title: string, idx: number): SectionThemeStyle {
  const lower = title.toLowerCase();
  if (
    /opsec|security|sicherheit|firewall|ssh|socket|port-exponierung|härtung|secret|zertifikat|tls|auth/.test(
      lower
    )
  ) {
    return {
      key: "security",
      badgeLabel: "Security & OpSec",
      borderClass: "border-sky-500/30 hover:border-sky-500/50",
      headerBgClass: "bg-gradient-to-r from-sky-950/45 via-nb-gray-940 to-nb-gray-940",
      accentTextClass: "text-sky-300",
      badgeClass: "border-sky-500/30 bg-sky-950/60 text-sky-300",
      icon: <Shield className="h-3.5 w-3.5 shrink-0 text-sky-400" />,
    };
  }
  if (
    /update|upgrade|version|paket|apt|runtime|axon|binary|aktuell|release/.test(
      lower
    )
  ) {
    return {
      key: "update",
      badgeLabel: "Updates & Versionen",
      borderClass: "border-cyan-500/30 hover:border-cyan-500/50",
      headerBgClass: "bg-gradient-to-r from-cyan-950/45 via-nb-gray-940 to-nb-gray-940",
      accentTextClass: "text-cyan-300",
      badgeClass: "border-cyan-500/30 bg-cyan-950/60 text-cyan-300",
      icon: <RefreshCw className="h-3.5 w-3.5 shrink-0 text-cyan-400" />,
    };
  }
  if (
    /forensik|log|fehler|error|root-cause|ursache|analyse|diagnose|journal|trace/.test(
      lower
    )
  ) {
    return {
      key: "forensics",
      badgeLabel: "Diagnose & Forensik",
      borderClass: "border-purple-500/30 hover:border-purple-500/50",
      headerBgClass:
        "bg-gradient-to-r from-purple-950/45 via-nb-gray-940 to-nb-gray-940",
      accentTextClass: "text-purple-300",
      badgeClass: "border-purple-500/30 bg-purple-950/60 text-purple-300",
      icon: <Cpu className="h-3.5 w-3.5 shrink-0 text-purple-400" />,
    };
  }
  if (
    /datenbank|sqlite|postgres|redis|brain|architecture|memory|speicher|storage|datei/.test(
      lower
    )
  ) {
    return {
      key: "data",
      badgeLabel: "Daten & Speicher",
      borderClass: "border-amber-500/30 hover:border-amber-500/50",
      headerBgClass:
        "bg-gradient-to-r from-amber-950/40 via-nb-gray-940 to-nb-gray-940",
      accentTextClass: "text-amber-300",
      badgeClass: "border-amber-500/30 bg-amber-950/60 text-amber-300",
      icon: <Database className="h-3.5 w-3.5 shrink-0 text-amber-400" />,
    };
  }
  if (
    /empfehlung|maßnahme|fazit|befund|aktion|zusammenfassung|nächste schritte|interview|entscheidung|checkliste/.test(
      lower
    )
  ) {
    return {
      key: "findings",
      badgeLabel: "Maßnahmen & Fazit",
      borderClass: "border-netbird-500/35 hover:border-netbird-500/60",
      headerBgClass:
        "bg-gradient-to-r from-netbird-950/50 via-nb-gray-940 to-nb-gray-940",
      accentTextClass: "text-netbird",
      badgeClass: "border-netbird-500/30 bg-netbird-950/60 text-netbird",
      icon: <Sparkles className="h-3.5 w-3.5 shrink-0 text-netbird" />,
    };
  }
  if (
    /system|host|hardware|cpu|ram|netzwerk|dienst|service|status|health|mesh|knoten|node|server/.test(
      lower
    ) ||
    idx === 0
  ) {
    return {
      key: "system",
      badgeLabel: "System & Infrastruktur",
      borderClass: "border-emerald-500/30 hover:border-emerald-500/50",
      headerBgClass:
        "bg-gradient-to-r from-emerald-950/45 via-nb-gray-940 to-nb-gray-940",
      accentTextClass: "text-emerald-300",
      badgeClass: "border-emerald-500/30 bg-emerald-950/60 text-emerald-300",
      icon: <Activity className="h-3.5 w-3.5 shrink-0 text-emerald-400" />,
    };
  }
  return {
    key: "general",
    badgeLabel: `Sektion ${idx + 1}`,
    borderClass: "border-nb-gray-800 hover:border-nb-gray-700",
    headerBgClass: "bg-nb-gray-940",
    accentTextClass: "text-nb-gray-200",
    badgeClass: "border-nb-gray-700 bg-nb-gray-900 text-nb-gray-300",
    icon: <Layers className="h-3.5 w-3.5 shrink-0 text-netbird" />,
  };
}

/**
 * Interactive Markdown Table Component with column sorting and automatic status badge highlighting
 */
function InteractiveMarkdownTable({
  headers,
  rows,
  handlers,
}: {
  headers: string[];
  rows: string[][];
  handlers: InlineActionHandlers;
}) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const sortedRows = useMemo(() => {
    if (sortCol === null) return rows;
    return [...rows].sort((a, b) => {
      const va = (a[sortCol] || "").replace(/[*`]/g, "").trim();
      const vb = (b[sortCol] || "").replace(/[*`]/g, "").trim();
      const na = parseFloat(va);
      const nb = parseFloat(vb);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) {
        return sortAsc ? na - nb : nb - na;
      }
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [rows, sortCol, sortAsc]);

  const renderCellContent = (cell: string) => {
    const clean = cell.replace(/\*\*/g, "").trim();
    if (
      /^(OK|ONLINE|AKTIV|AKTUELL|PASS|GESUND|JA|SUCCESS|SICHER|BEREIT|✅(\s*OK|\s*AKTUELL|\s*AKTIV|\s*PASS)?)$/i.test(
        clean
      )
    ) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {clean.replace(/^✅\s*/, "")}
        </span>
      );
    }
    if (
      /^(WARNUNG|WARN|UPDATE|VERALTET|MITTEL|PRÜFEN|HINWEIS|⚠️(\s*WARNUNG|\s*UPDATE|\s*HINWEIS)?)$/i.test(
        clean
      )
    ) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-950/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          {clean.replace(/^⚠️\s*/, "")}
        </span>
      );
    }
    if (
      /^(KRITISCH|FEHLER|ERROR|FAIL|OFFLINE|HOCH|BLOCKIERT|❌(\s*FEHLER|\s*KRITISCH|\s*FAIL)?)$/i.test(
        clean
      )
    ) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-950/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-red-300">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          {clean.replace(/^❌\s*/, "")}
        </span>
      );
    }
    return renderInlineFormatting(cell, handlers);
  };

  return (
    <div className="my-2.5 overflow-x-auto rounded-xl border border-nb-gray-800/90 bg-nb-gray-950/90 shadow-sm">
      <table className="w-full border-collapse text-left text-[11px]">
        <thead>
          <tr className="border-b border-nb-gray-800 bg-nb-gray-940/90 text-[10px] uppercase tracking-wider text-nb-gray-400">
            {headers.map((h, i) => (
              <th
                key={i}
                onClick={() => {
                  if (sortCol === i) {
                    setSortAsc((v) => !v);
                  } else {
                    setSortCol(i);
                    setSortAsc(true);
                  }
                }}
                title="Klicken zum Sortieren"
                className="cursor-pointer select-none px-3 py-2 font-semibold transition hover:bg-nb-gray-900 hover:text-white"
              >
                <div className="flex items-center gap-1.5">
                  <span>{renderInlineFormatting(h, handlers)}</span>
                  <ArrowUpDown
                    className={`h-2.5 w-2.5 shrink-0 ${
                      sortCol === i ? "text-netbird" : "text-nb-gray-600"
                    }`}
                  />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-nb-gray-800/60">
          {sortedRows.map((row, rIdx) => (
            <tr
              key={rIdx}
              className="transition hover:bg-nb-gray-900/50"
            >
              {headers.map((_, cIdx) => (
                <td
                  key={cIdx}
                  className="px-3 py-2 align-top text-nb-gray-200 leading-relaxed"
                >
                  {renderCellContent(row[cIdx] || "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Interactive Checklist / Action Items for numbered recommendations
 */
function InteractiveNumberedSteps({
  items,
  handlers,
}: {
  items: Array<{ num: string; body: string }>;
  handlers: InlineActionHandlers;
}) {
  const [checkedMap, setCheckedMap] = useState<Record<number, boolean>>({});

  return (
    <div className="my-2 space-y-2">
      {items.map((it, idx) => {
        const isChecked = Boolean(checkedMap[idx]);
        const sev = detectSeverity(it.body);

        return (
          <div
            key={idx}
            onClick={() =>
              setCheckedMap((prev) => ({ ...prev, [idx]: !prev[idx] }))
            }
            title="Klicken, um diesen Punkt als erledigt/geprüft zu markieren"
            className={`group flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 text-xs transition ${
              isChecked
                ? "border-emerald-500/30 bg-emerald-950/20 text-nb-gray-400"
                : sev === "critical"
                ? "border-red-500/35 bg-red-950/15 hover:border-red-500/60"
                : sev === "warning"
                ? "border-amber-500/35 bg-amber-950/15 hover:border-amber-500/60"
                : "border-nb-gray-800/90 bg-nb-gray-940/70 hover:border-nb-gray-700"
            }`}
          >
            <div
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border font-mono text-[10px] font-bold transition ${
                isChecked
                  ? "border-emerald-500 bg-emerald-500 text-nb-gray-950"
                  : sev === "critical"
                  ? "border-red-500/50 bg-red-950/70 text-red-300"
                  : sev === "warning"
                  ? "border-amber-500/50 bg-amber-950/70 text-amber-300"
                  : "border-netbird/40 bg-netbird/15 text-netbird group-hover:border-netbird"
              }`}
            >
              {isChecked ? <Check className="h-3 w-3 stroke-[3]" /> : it.num}
            </div>
            <div
              className={`min-w-0 flex-1 break-words leading-relaxed ${
                isChecked ? "line-through opacity-75" : "text-nb-gray-100"
              }`}
            >
              {renderInlineFormatting(it.body, handlers)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function detectSeverity(
  text: string
): "critical" | "warning" | "ok" | "info" | null {
  if (
    /(\[KRITISCH\]|\[HOCH\]|\[CRITICAL\]|\[HIGH\]|\[FAIL\]|\[ERROR\]|❌|\bKRITISCH:|\bSCHWERWIEGEND:)/i.test(
      text
    )
  ) {
    return "critical";
  }
  if (
    /(\[WARNUNG\]|\[MITTEL\]|\[WARN\]|\[MEDIUM\]|\[UPDATE\]|⚠️|\bWARNUNG:|\bHINWEIS:)/i.test(
      text
    )
  ) {
    return "warning";
  }
  if (
    /(\[OK\]|\[PASS\]|\[SICHER\]|\[AKTUELL\]|\[GESUND\]|✅|\bSTATUS:\s*OK\b)/i.test(
      text
    )
  ) {
    return "ok";
  }
  if (/(\[INFO\]|\[NIEDRIG\]|\[LOW\]|ℹ️)/i.test(text)) {
    return "info";
  }
  return null;
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

  // For chat variant with multiple `## ` sections, group into interactive Topic Cards + Filter Bar!
  if (variant === "chat") {
    return (
      <ChatRichDocument markdown={markdown} handlers={handlers} />
    );
  }

  return (
    <StandardRichDocument
      markdown={markdown}
      variant={variant}
      handlers={handlers}
    />
  );
}

/**
 * Specialized, visually varied, interactive Chat Document Renderer
 * Splits structured AI responses into:
 * 1. Intro / Executive KPI Bento Strip
 * 2. Interactive Topic Filter Bar (when >= 2 sections exist)
 * 3. Distinctly styled, collapsible Topic Section Cards (`security`, `system`, `update`, `forensics`, `data`, `findings`)
 */
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

    // Count heading levels outside code fences to auto-detect section level (`## `, `### `, or `#### `)
    let h1Count = 0;
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
      if (trimmed.startsWith("# ")) h1Count++;
      else if (trimmed.startsWith("## ")) h2Count++;
      else if (trimmed.startsWith("### ")) h3Count++;
      else if (trimmed.startsWith("#### ")) h4Count++;
    }

    // Determine which heading level represents main sections
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

      // If multiple `# ` headings exist in a report (like `# Detailbefunde`), treat mid-document `# ` as a section divider too
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

  const [activeSectionFilter, setActiveSectionFilter] = useState<number | "all">(
    "all"
  );
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

  // If there are no `## ` sections, render directly with enhanced blocks
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
      {/* Report Banner Header if `# Title` is present */}
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

      {/* Intro / Executive Summary / KPI Bento Strip */}
      {parsed.introContent && (
        <StandardRichDocument
          markdown={parsed.introContent}
          variant="chat"
          handlers={handlers}
        />
      )}

      {/* Interactive Topic Navigation & Collapse Bar (when >= 2 sections) */}
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
                    setCollapsedSections((prev) => ({ ...prev, [sIdx]: false }));
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

      {/* Topic Section Cards with Distinct Visual Personalities */}
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

function StandardRichDocument({
  markdown,
  variant,
  handlers,
}: {
  markdown: string;
  variant: "architecture" | "memory" | "cartridge" | "chat";
  handlers: InlineActionHandlers;
}) {
  const segments: Array<{
    type: "prose" | "code" | "mermaid";
    lang?: string;
    content: string;
  }> = [];

  const fenceRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "prose",
        content: markdown.slice(lastIndex, match.index),
      });
    }
    const lang = (match[1] || "").toLowerCase();
    segments.push({
      type: lang === "mermaid" ? "mermaid" : "code",
      lang: lang || "text",
      content: match[2].trim(),
    });
    lastIndex = fenceRegex.lastIndex;
  }

  if (lastIndex < markdown.length) {
    segments.push({
      type: "prose",
      content: markdown.slice(lastIndex),
    });
  }

  return (
    <div className="min-w-0 space-y-2.5 break-words leading-relaxed text-nb-gray-200">
      {segments.map((seg, idx) => {
        if (seg.type === "mermaid") {
          return (
            <div key={idx} className="my-3 overflow-x-auto">
              <MermaidTopologyView
                markdown={`\`\`\`mermaid\n${seg.content}\n\`\`\``}
              />
            </div>
          );
        }

        if (seg.type === "code") {
          return (
            <CodeBlockWithCopy
              key={idx}
              lang={seg.lang || "text"}
              content={seg.content}
              onRunCommand={handlers.onRunCommand}
            />
          );
        }

        return (
          <ProseSegment
            key={idx}
            text={seg.content}
            variant={variant}
            handlers={handlers}
          />
        );
      })}
    </div>
  );
}

function ProseSegment({
  text,
  variant,
  handlers,
}: {
  text: string;
  variant: "architecture" | "memory" | "cartridge" | "chat";
  handlers: InlineActionHandlers;
}) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let numberedBuffer: Array<{ num: string; body: string }> = [];
  let tableBuffer: string[] = [];

  const flushTable = (keyPrefix: string) => {
    if (tableBuffer.length === 0) return;
    const rawRows = [...tableBuffer];
    tableBuffer = [];

    const parsedRows = rawRows
      .map((r) =>
        r
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim())
      )
      .filter((r) => r.length > 0 && !r.every((c) => /^[-:]+$/.test(c)));

    if (parsedRows.length >= 2) {
      const headers = parsedRows[0];
      const bodyRows = parsedRows.slice(1);
      elements.push(
        <InteractiveMarkdownTable
          key={`${keyPrefix}-table`}
          headers={headers}
          rows={bodyRows}
          handlers={handlers}
        />
      );
    } else {
      parsedRows.forEach((r, idx) => {
        elements.push(
          <p key={`${keyPrefix}-tfallback-${idx}`} className="text-xs text-nb-gray-300">
            {renderInlineFormatting(r.join(" · "), handlers)}
          </p>
        );
      });
    }
  };

  const flushNumbered = (keyPrefix: string) => {
    if (numberedBuffer.length === 0) return;
    const current = [...numberedBuffer];
    numberedBuffer = [];
    elements.push(
      <InteractiveNumberedSteps
        key={`${keyPrefix}-numsteps`}
        items={current}
        handlers={handlers}
      />
    );
  };

  const flushList = (keyPrefix: string) => {
    if (listBuffer.length === 0) return;
    const currentItems = [...listBuffer];
    listBuffer = [];

    if (variant === "memory") {
      elements.push(
        <div
          key={`${keyPrefix}-timeline`}
          className="relative my-2.5 ml-1.5 space-y-2.5 border-l-2 border-netbird/40 pl-4"
        >
          {currentItems.map((item, i) => {
            const tsMatch = item.match(/^\*\*\[([^\]]+)\]\*\*\s*([\s\S]*)$/);
            const timestamp = tsMatch ? tsMatch[1] : null;
            const bodyText = tsMatch ? tsMatch[2] : item;
            return (
              <div
                key={i}
                className="relative rounded-lg border border-nb-gray-800 bg-nb-gray-930/80 p-3 transition hover:border-nb-gray-700"
              >
                <span className="absolute -left-[22px] top-3.5 h-2.5 w-2.5 rounded-full border-2 border-netbird bg-nb-gray-950" />
                {timestamp && (
                  <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] text-netbird">
                    <Clock className="h-3 w-3" />
                    <span>
                      {timestamp.replace("T", " ").replace("Z", " UTC")}
                    </span>
                  </div>
                )}
                <div className="min-w-0 break-words text-xs text-nb-gray-200">
                  {renderInlineFormatting(bodyText, handlers)}
                </div>
              </div>
            );
          })}
        </div>
      );
      return;
    }

    if (variant === "chat") {
      // Variation 1: Check if all items are short "**Key:** Value" pairs -> render as a Bento KPI Grid!
      const kvMatches = currentItems.map((it) =>
        it.match(/^\*\*([^*:]{2,32}):?\*\*:?\s+(.+)$/)
      );
      const allAreShortKv =
        currentItems.length >= 2 &&
        currentItems.length <= 8 &&
        kvMatches.every((m) => m !== null && m[2].length <= 95);

      if (allAreShortKv) {
        elements.push(
          <div
            key={`${keyPrefix}-bento-kv`}
            className="my-2 grid grid-cols-1 sm:grid-cols-2 gap-2"
          >
            {kvMatches.map((m, i) => {
              const label = m![1].trim();
              const val = m![2].trim();
              const sev = detectSeverity(val);
              return (
                <div
                  key={i}
                  className={`rounded-xl border px-3 py-2 transition ${
                    sev === "critical"
                      ? "border-red-500/35 bg-red-950/20"
                      : sev === "warning"
                      ? "border-amber-500/35 bg-amber-950/20"
                      : sev === "ok"
                      ? "border-emerald-500/30 bg-emerald-950/15"
                      : "border-nb-gray-800/90 bg-nb-gray-950/75"
                  }`}
                >
                  <div className="font-mono text-[10px] uppercase tracking-wider text-nb-gray-400">
                    {label}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-white break-words">
                    {renderInlineFormatting(val, handlers)}
                  </div>
                </div>
              );
            })}
          </div>
        );
        return;
      }

      // Variation 2: Check if items have Severity/Status markers -> render as Status-Accented Finding Cards!
      const hasSeverityItems = currentItems.some(
        (it) => detectSeverity(it) !== null
      );

      if (hasSeverityItems) {
        elements.push(
          <div key={`${keyPrefix}-findings`} className="my-2 space-y-1.5">
            {currentItems.map((item, i) => {
              const sev = detectSeverity(item);
              const borderAccent =
                sev === "critical"
                  ? "border-l-4 border-l-red-500 border-red-500/30 bg-red-950/15"
                  : sev === "warning"
                  ? "border-l-4 border-l-amber-400 border-amber-500/30 bg-amber-950/15"
                  : sev === "ok"
                  ? "border-l-4 border-l-emerald-400 border-emerald-500/25 bg-emerald-950/15"
                  : "border-l-4 border-l-sky-400 border-nb-gray-800 bg-nb-gray-950/60";

              const iconNode =
                sev === "critical" ? (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                ) : sev === "warning" ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                ) : sev === "ok" ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : (
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                );

              return (
                <div
                  key={i}
                  className={`flex min-w-0 items-start gap-2.5 rounded-lg border px-3 py-2 text-xs leading-relaxed text-nb-gray-100 ${borderAccent}`}
                >
                  {iconNode}
                  <div className="min-w-0 flex-1 break-words">
                    {renderInlineFormatting(item, handlers)}
                  </div>
                </div>
              );
            })}
          </div>
        );
        return;
      }

      // Variation 3: Standard conversational bullet list with sleek arrow/dot markers
      elements.push(
        <ul key={`${keyPrefix}-ul`} className="my-1.5 space-y-1.5">
          {currentItems.map((item, i) => (
            <li
              key={i}
              className="flex min-w-0 items-start gap-2 rounded-lg border border-transparent px-1.5 py-0.5 text-xs leading-relaxed text-nb-gray-200 transition hover:border-nb-gray-800/70 hover:bg-nb-gray-950/40"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-netbird" />
              <div className="min-w-0 flex-1 break-words">
                {renderInlineFormatting(item, handlers)}
              </div>
            </li>
          ))}
        </ul>
      );
      return;
    }

    elements.push(
      <ul key={`${keyPrefix}-ul`} className="my-2 space-y-2">
        {currentItems.map((item, i) => (
          <li
            key={i}
            className="flex min-w-0 items-start gap-2.5 rounded-lg border border-nb-gray-800 bg-nb-gray-930/80 px-3.5 py-2.5 text-xs text-nb-gray-200"
          >
            <FolderTree className="mt-0.5 h-3.5 w-3.5 shrink-0 text-netbird" />
            <div className="min-w-0 flex-1 break-words">
              {renderInlineFormatting(item, handlers)}
            </div>
          </li>
        ))}
      </ul>
    );
  };

  const flushAll = (keyPrefix: string) => {
    flushTable(keyPrefix);
    flushList(keyPrefix);
    flushNumbered(keyPrefix);
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushAll(`empty-${idx}`);
      return;
    }

    // Detect Markdown Table lines (`| Col1 | Col2 |`)
    if (line.startsWith("|") && line.endsWith("|") && line.split("|").length >= 3) {
      flushList(`pre-tbl-${idx}`);
      flushNumbered(`pre-tbl-${idx}`);
      tableBuffer.push(line);
      return;
    } else if (tableBuffer.length > 0) {
      flushTable(`tbl-end-${idx}`);
    }

    // Horizontal rule `---`
    if (/^---+$/.test(line)) {
      flushAll(`hr-${idx}`);
      elements.push(
        <hr key={`hr-${idx}`} className="my-2 border-nb-gray-800/70" />
      );
      return;
    }

    // Blockquote `> ...`
    if (line.startsWith("> ")) {
      flushAll(`quote-${idx}`);
      const quoteText = line.slice(2).trim();
      const sev = detectSeverity(quoteText);
      elements.push(
        <div
          key={`quote-${idx}`}
          className={`my-2 rounded-r-xl border-l-4 px-3 py-2 text-xs italic ${
            sev === "critical"
              ? "border-red-500 bg-red-950/20 text-red-200"
              : sev === "warning"
              ? "border-amber-400 bg-amber-950/20 text-amber-200"
              : "border-netbird bg-netbird-950/25 text-nb-gray-200"
          }`}
        >
          {renderInlineFormatting(quoteText, handlers)}
        </div>
      );
      return;
    }

    if (line.startsWith("# ")) {
      flushAll(`h1-${idx}`);
      elements.push(
        <h1
          key={`h1-${idx}`}
          className="border-b border-nb-gray-800/80 pb-2 pt-0.5 text-sm font-semibold tracking-tight text-nb-gray-100 break-words"
        >
          {renderInlineFormatting(line.slice(2), handlers)}
        </h1>
      );
      return;
    }

    if (line.startsWith("## ")) {
      flushAll(`h2-${idx}`);
      elements.push(
        <h2
          key={`h2-${idx}`}
          className="flex items-center gap-2 pt-2 text-xs font-semibold uppercase tracking-wider text-nb-gray-300 break-words"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-netbird" />
          <span className="min-w-0 break-words">
            {renderInlineFormatting(line.slice(3), handlers)}
          </span>
        </h2>
      );
      return;
    }

    if (line.startsWith("### ") || line.startsWith("#### ")) {
      flushAll(`h3-${idx}`);
      const isH4 = line.startsWith("#### ");
      const subTitle = line.slice(isH4 ? 5 : 4).trim();
      const sev = detectSeverity(subTitle);
      elements.push(
        <div
          key={`h3-${idx}`}
          className={`mt-2 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold break-words ${
            sev === "critical"
              ? "border-red-500/35 bg-red-950/25 text-red-200"
              : sev === "warning"
              ? "border-amber-500/35 bg-amber-950/25 text-amber-200"
              : sev === "ok"
              ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
              : "border-nb-gray-800/80 bg-nb-gray-950/70 text-white"
          }`}
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-netbird" />
          <span className="min-w-0 flex-1">
            {renderInlineFormatting(subTitle, handlers)}
          </span>
        </div>
      );
      return;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      flushNumbered(`pre-ul-${idx}`);
      listBuffer.push(line.slice(2));
      return;
    }

    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      flushList(`pre-num-${idx}`);
      if (variant === "chat") {
        numberedBuffer.push({ num: numMatch[1], body: numMatch[2] });
      } else {
        listBuffer.push(`**${numMatch[1]}.** ${numMatch[2]}`);
      }
      return;
    }

    // Standalone "**Key:** Value" line (including ` · `-separated KV pairs) in chat -> push to listBuffer so consecutive KV lines become a Bento Grid!
    if (
      variant === "chat" &&
      /^\*\*([^*:]{2,32}):?\*\*:?\s+(.+)$/.test(line) &&
      line.length <= 160
    ) {
      flushNumbered(`pre-kv-${idx}`);
      const subPairs = line.split(/\s+·\s+/);
      if (
        subPairs.length >= 2 &&
        subPairs.every((sp) => /^\*\*([^*:]{2,32}):?\*\*:?\s+(.+)$/.test(sp))
      ) {
        subPairs.forEach((sp) => listBuffer.push(sp.trim()));
      } else {
        listBuffer.push(line);
      }
      return;
    }

    flushAll(`p-${idx}`);
    elements.push(
      <p
        key={`p-${idx}`}
        className="min-w-0 break-words text-xs leading-relaxed text-nb-gray-200"
      >
        {renderInlineFormatting(line, handlers)}
      </p>
    );
  });

  flushAll("final");

  return <div className="min-w-0 space-y-2 break-words">{elements}</div>;
}

function renderInlineFormatting(
  text: string,
  handlers: InlineActionHandlers
): React.ReactNode {
  const boldTokens = text.split(/(\*\*[^*]+\*\*)/g);
  return boldTokens.map((segment, i) => {
    if (
      segment.startsWith("**") &&
      segment.endsWith("**") &&
      segment.length > 4
    ) {
      const inner = segment.slice(2, -2);
      // Highlight inline severity badges like **[KRITISCH]** or **[OK]**
      if (/^\[?(KRITISCH|CRITICAL|HOCH|HIGH|FAIL|ERROR)\]?$/i.test(inner.trim())) {
        return (
          <span
            key={i}
            className="mx-0.5 inline-flex items-center rounded border border-red-500/40 bg-red-950/70 px-1.5 py-0.2 font-mono text-[10px] font-bold text-red-300"
          >
            {inner}
          </span>
        );
      }
      if (/^\[?(WARNUNG|WARN|MITTEL|MEDIUM|UPDATE)\]?$/i.test(inner.trim())) {
        return (
          <span
            key={i}
            className="mx-0.5 inline-flex items-center rounded border border-amber-500/40 bg-amber-950/70 px-1.5 py-0.2 font-mono text-[10px] font-bold text-amber-300"
          >
            {inner}
          </span>
        );
      }
      if (/^\[?(OK|PASS|AKTUELL|SICHER|ONLINE)\]?$/i.test(inner.trim())) {
        return (
          <span
            key={i}
            className="mx-0.5 inline-flex items-center rounded border border-emerald-500/40 bg-emerald-950/70 px-1.5 py-0.2 font-mono text-[10px] font-bold text-emerald-300"
          >
            {inner}
          </span>
        );
      }

      return (
        <strong key={i} className="font-semibold text-white break-words">
          {renderCodeTokens(inner, `b-${i}`, handlers)}
        </strong>
      );
    }
    return (
      <React.Fragment key={i}>
        {renderCodeTokens(segment, `t-${i}`, handlers)}
      </React.Fragment>
    );
  });
}

function renderCodeTokens(
  text: string,
  keyPrefix: string,
  handlers: InlineActionHandlers
): React.ReactNode {
  const codeTokens = text.split(/(`[^`]+`)/g);
  return codeTokens.map((tok, j) => {
    if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 2) {
      const rawCode = tok.slice(1, -1).trim();

      // 1. Detect Brain Document (`Architecture.md` / `Memory.md`)
      if (
        (rawCode === "Architecture.md" || rawCode === "Memory.md") &&
        handlers.onOpenBrainDoc
      ) {
        return (
          <button
            key={`${keyPrefix}-${j}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlers.onOpenBrainDoc!(rawCode);
            }}
            title={`${rawCode} im Brain Vault öffnen`}
            className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-purple-500/40 bg-purple-950/50 px-1.5 py-0.5 font-mono text-[11px] text-purple-300 transition hover:border-purple-400 hover:bg-purple-900/60 hover:text-white"
          >
            <BookOpen className="h-2.5 w-2.5 shrink-0" />
            <span>{rawCode}</span>
          </button>
        );
      }

      // 2. Detect Port Token (`:4070`, `Port 4090`, `127.0.0.1:4085`, `0.0.0.0:4050`)
      const portMatch = rawCode.match(
        /^(?:(?:127\.0\.0\.1|0\.0\.0\.0|localhost|\*)?:|Port\s+)(\d{2,5})$/i
      );
      if (portMatch && handlers.onOpenPort) {
        const portNum = parseInt(portMatch[1], 10);
        if (portNum >= 80 && portNum <= 65535) {
          return (
            <button
              key={`${keyPrefix}-${j}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlers.onOpenPort!(portNum);
              }}
              title={`Port :${portNum} im Dienste- & API-Tester öffnen`}
              className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-950/50 px-1.5 py-0.5 font-mono text-[11px] text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-900/60 hover:text-white"
            >
              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
              <span>{rawCode}</span>
            </button>
          );
        }
      }

      // 3. Detect File Path (`/opt/...`, `/etc/...`, `/var/...`, `service/...`, `apps/...`)
      const isFilePath =
        /^(\/opt\/|\/etc\/|\/var\/|\/home\/|\/root\/|service\/|apps\/)[a-zA-Z0-9_./-]+$/.test(
          rawCode
        ) && rawCode.length > 4;
      if (isFilePath && handlers.onOpenFile) {
        return (
          <button
            key={`${keyPrefix}-${j}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlers.onOpenFile!(rawCode);
            }}
            title={`Pfad ${rawCode} im Datei-Explorer öffnen`}
            className="mx-0.5 inline-flex max-w-full items-center gap-1 break-all rounded-md border border-sky-500/35 bg-sky-950/40 px-1.5 py-0.5 font-mono text-[11px] text-sky-300 transition hover:border-sky-400 hover:bg-sky-900/50 hover:text-white"
          >
            <FileCode2 className="h-2.5 w-2.5 shrink-0" />
            <span>{rawCode}</span>
          </button>
        );
      }

      return (
        <code
          key={`${keyPrefix}-${j}`}
          className="inline-block max-w-full break-all rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[11px] text-netbird"
        >
          {rawCode}
        </code>
      );
    }
    return (
      <span key={`${keyPrefix}-${j}`} className="break-words">
        {tok}
      </span>
    );
  });
}
