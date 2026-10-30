"use client";

import React from "react";
import MermaidTopologyView from "../MermaidTopologyView";
import {
  Clock,
  FolderTree,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
} from "lucide-react";
import {
  CodeBlockWithCopy,
  InlineActionHandlers,
  InteractiveMarkdownTable,
  InteractiveNumberedSteps,
  detectSeverity,
  renderInlineFormatting,
} from "./markdownInlineAndThemeHelpers";

export function StandardRichDocument({
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

export function ProseSegment({
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
          <p
            key={`${keyPrefix}-tfallback-${idx}`}
            className="text-xs text-nb-gray-300"
          >
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

    if (
      line.startsWith("|") &&
      line.endsWith("|") &&
      line.split("|").length >= 3
    ) {
      flushList(`pre-tbl-${idx}`);
      flushNumbered(`pre-tbl-${idx}`);
      tableBuffer.push(line);
      return;
    } else if (tableBuffer.length > 0) {
      flushTable(`tbl-end-${idx}`);
    }

    if (/^---+$/.test(line)) {
      flushAll(`hr-${idx}`);
      elements.push(
        <hr key={`hr-${idx}`} className="my-2 border-nb-gray-800/70" />
      );
      return;
    }

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
