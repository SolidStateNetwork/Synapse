"use client";

import React, { useState } from "react";
import MermaidTopologyView from "./MermaidTopologyView";
import { Clock, Terminal, FolderTree, Sparkles, Copy, Check } from "lucide-react";

interface RichMarkdownDocumentProps {
  markdown: string;
  variant?: "architecture" | "memory" | "cartridge" | "chat";
}

function CodeBlockWithCopy({
  lang,
  content,
}: {
  lang: string;
  content: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-nb-gray-800 bg-nb-gray-960 shadow-sm">
      <div className="flex items-center justify-between border-b border-nb-gray-900 bg-nb-gray-940 px-3 py-1.5 font-mono text-[11px] text-nb-gray-400">
        <span className="flex items-center gap-1.5">
          <Terminal className="h-3 w-3 text-netbird" />
          {lang}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-nb-gray-400 transition hover:bg-nb-gray-900 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-green-400" />
              <span className="text-green-400">Kopiert</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Kopieren</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all p-3 font-mono text-xs leading-relaxed text-nb-gray-100">
        {content}
      </pre>
    </div>
  );
}

/**
 * Renders Synapse Markdown artifacts (`Architecture.md`, `Memory.md`, `Cartridges/*.md`, and Chat replies)
 * into NetBird-styled typographic blocks, timeline entries, and visual Mermaid topology graphs.
 */
export default function RichMarkdownDocument({
  markdown,
  variant = "architecture",
}: RichMarkdownDocumentProps) {
  if (!markdown || !markdown.trim()) {
    return (
      <div className="py-3 text-xs italic text-nb-gray-400">
        No content documented yet.
      </div>
    );
  }

  // Extract fenced code blocks (including ```mermaid) and prose segments
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
    <div className="min-w-0 space-y-3 break-words leading-relaxed text-nb-gray-200">
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
            />
          );
        }

        return <ProseSegment key={idx} text={seg.content} variant={variant} />;
      })}
    </div>
  );
}

function ProseSegment({
  text,
  variant,
}: {
  text: string;
  variant: "architecture" | "memory" | "cartridge" | "chat";
}) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];

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
                  {renderInlineFormatting(bodyText)}
                </div>
              </div>
            );
          })}
        </div>
      );
      return;
    }

    if (variant === "chat") {
      elements.push(
        <ul key={`${keyPrefix}-ul`} className="my-1.5 space-y-1.5">
          {currentItems.map((item, i) => (
            <li
              key={i}
              className="flex min-w-0 items-start gap-2 text-xs leading-relaxed text-nb-gray-200"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-netbird" />
              <div className="min-w-0 flex-1 break-words">
                {renderInlineFormatting(item)}
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
              {renderInlineFormatting(item)}
            </div>
          </li>
        ))}
      </ul>
    );
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList(`empty-${idx}`);
      return;
    }

    if (line.startsWith("# ")) {
      flushList(`h1-${idx}`);
      elements.push(
        <h1
          key={`h1-${idx}`}
          className="border-b border-nb-gray-800/80 pb-2 pt-0.5 text-sm font-semibold tracking-tight text-nb-gray-100 break-words"
        >
          {renderInlineFormatting(line.slice(2))}
        </h1>
      );
      return;
    }

    if (line.startsWith("## ")) {
      flushList(`h2-${idx}`);
      elements.push(
        <h2
          key={`h2-${idx}`}
          className="flex items-center gap-2 pt-2 text-xs font-semibold uppercase tracking-wider text-nb-gray-300 break-words"
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-netbird" />
          <span className="min-w-0 break-words">
            {renderInlineFormatting(line.slice(3))}
          </span>
        </h2>
      );
      return;
    }

    if (line.startsWith("### ")) {
      flushList(`h3-${idx}`);
      elements.push(
        <h3
          key={`h3-${idx}`}
          className="pt-1 text-xs font-semibold text-nb-gray-100 break-words"
        >
          {renderInlineFormatting(line.slice(4))}
        </h3>
      );
      return;
    }

    if (line.startsWith("- ") || line.startsWith("* ")) {
      listBuffer.push(line.slice(2));
      return;
    }

    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      listBuffer.push(`**${numMatch[1]}.** ${numMatch[2]}`);
      return;
    }

    flushList(`p-${idx}`);
    elements.push(
      <p
        key={`p-${idx}`}
        className="min-w-0 break-words text-xs leading-relaxed text-nb-gray-200"
      >
        {renderInlineFormatting(line)}
      </p>
    );
  });

  flushList("final");

  return <div className="min-w-0 space-y-2 break-words">{elements}</div>;
}

function renderInlineFormatting(text: string): React.ReactNode {
  const boldTokens = text.split(/(\*\*[^*]+\*\*)/g);
  return boldTokens.map((segment, i) => {
    if (
      segment.startsWith("**") &&
      segment.endsWith("**") &&
      segment.length > 4
    ) {
      const inner = segment.slice(2, -2);
      return (
        <strong key={i} className="font-semibold text-white break-words">
          {renderCodeTokens(inner, `b-${i}`)}
        </strong>
      );
    }
    return (
      <React.Fragment key={i}>
        {renderCodeTokens(segment, `t-${i}`)}
      </React.Fragment>
    );
  });
}

function renderCodeTokens(text: string, keyPrefix: string): React.ReactNode {
  const codeTokens = text.split(/(`[^`]+`)/g);
  return codeTokens.map((tok, j) => {
    if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 2) {
      return (
        <code
          key={`${keyPrefix}-${j}`}
          className="inline-block max-w-full break-all rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[11px] text-netbird"
        >
          {tok.slice(1, -1)}
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
