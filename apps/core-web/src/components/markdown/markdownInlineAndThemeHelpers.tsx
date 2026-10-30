"use client";

import React, { useState, useMemo } from "react";
import {
  Terminal, Sparkles, Copy, Check, Shield, Activity, RefreshCw, Cpu,
  Database, ChevronDown, ChevronRight, ExternalLink, FileCode2, BookOpen,
  Play, ArrowUpDown, Layers,
} from "lucide-react";

export interface InlineActionHandlers {
  onOpenPort?: (port: number) => void;
  onOpenFile?: (filePath: string) => void;
  onOpenBrainDoc?: (doc: "Architecture.md" | "Memory.md") => void;
  onRunCommand?: (cmd: string) => void;
}

export function CodeBlockWithCopy({
  lang, content, onRunCommand,
}: { lang: string; content: string; onRunCommand?: (cmd: string) => void }) {
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => content.split("\n"), [content]);
  const isLong = lines.length > 14;
  const [expanded, setExpanded] = useState(!isLong);

  const normalizedLang = (lang || "text").toLowerCase();
  const isShellLike =
    ["bash", "sh", "shell", "zsh", "console"].includes(normalizedLang) ||
    /^(curl|systemctl|journalctl|apt|docker|ss|ufw|git|python3|go|npm|node)\b/m.test(content.trim());

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

export type SectionThemeKey =
  | "security"
  | "system"
  | "update"
  | "forensics"
  | "data"
  | "findings"
  | "general";

export interface SectionThemeStyle {
  key: SectionThemeKey;
  badgeLabel: string;
  borderClass: string;
  headerBgClass: string;
  accentTextClass: string;
  badgeClass: string;
  icon: React.ReactNode;
}

export function resolveSectionTheme(
  title: string,
  idx: number
): SectionThemeStyle {
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
      headerBgClass:
        "bg-gradient-to-r from-sky-950/45 via-nb-gray-940 to-nb-gray-940",
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
      borderClass: "border-sky-500/30 hover:border-sky-500/50",
      headerBgClass:
        "bg-gradient-to-r from-sky-950/45 via-nb-gray-940 to-nb-gray-940",
      accentTextClass: "text-sky-300",
      badgeClass: "border-sky-500/30 bg-sky-950/60 text-sky-300",
      icon: <RefreshCw className="h-3.5 w-3.5 shrink-0 text-sky-400" />,
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
      borderClass: "border-sky-500/30 hover:border-sky-500/50",
      headerBgClass:
        "bg-gradient-to-r from-sky-950/45 via-nb-gray-940 to-nb-gray-940",
      accentTextClass: "text-sky-300",
      badgeClass: "border-sky-500/30 bg-sky-950/60 text-sky-300",
      icon: <Cpu className="h-3.5 w-3.5 shrink-0 text-sky-400" />,
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

export function InteractiveMarkdownTable({
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
            <tr key={rIdx} className="transition hover:bg-nb-gray-900/50">
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

export function InteractiveNumberedSteps({
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

export function detectSeverity(
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

export function renderInlineFormatting(
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
      if (
        /^\[?(KRITISCH|CRITICAL|HOCH|HIGH|FAIL|ERROR)\]?$/i.test(inner.trim())
      ) {
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

export function renderCodeTokens(
  text: string,
  keyPrefix: string,
  handlers: InlineActionHandlers
): React.ReactNode {
  const codeTokens = text.split(/(`[^`]+`)/g);
  return codeTokens.map((tok, j) => {
    if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 2) {
      const rawCode = tok.slice(1, -1).trim();

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
            className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-netbird-500/40 bg-netbird-950/50 px-1.5 py-0.5 font-mono text-[11px] text-netbird transition hover:border-netbird hover:bg-netbird-900/60 hover:text-white"
          >
            <BookOpen className="h-2.5 w-2.5 shrink-0" />
            <span>{rawCode}</span>
          </button>
        );
      }

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
