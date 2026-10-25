"use client";

import React from "react";
import MermaidTopologyView from "./MermaidTopologyView";
import { Clock, Terminal, FolderTree, Sparkles } from "lucide-react";

interface RichMarkdownDocumentProps {
  markdown: string;
  variant?: "architecture" | "memory" | "cartridge" | "chat";
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
      <div className="text-xs text-nb-gray-400 italic py-3">
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
    <div className="space-y-4 text-nb-gray-200 leading-relaxed">
      {segments.map((seg, idx) => {
        if (seg.type === "mermaid") {
          return (
            <div key={idx} className="my-3">
              <MermaidTopologyView
                markdown={`\`\`\`mermaid\n${seg.content}\n\`\`\``}
              />
            </div>
          );
        }

        if (seg.type === "code") {
          return (
            <div
              key={idx}
              className="overflow-hidden rounded-lg border border-nb-gray-800 bg-nb-gray-960 shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-nb-gray-900 bg-nb-gray-940 px-3.5 py-1.5 text-[11px] font-mono text-nb-gray-400">
                <span className="flex items-center gap-1.5">
                  <Terminal className="h-3 w-3 text-netbird" />
                  {seg.lang}
                </span>
              </div>
              <pre className="overflow-x-auto p-3.5 font-mono text-xs leading-relaxed text-nb-gray-100">
                {seg.content}
              </pre>
            </div>
          );
        }

        return (
          <ProseSegment key={idx} text={seg.content} variant={variant} />
        );
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
          className="relative space-y-2.5 border-l-2 border-netbird/40 pl-4 ml-1.5 my-2.5"
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
                    <span>{timestamp.replace("T", " ").replace("Z", " UTC")}</span>
                  </div>
                )}
                <div className="text-xs text-nb-gray-200">
                  {renderInlineFormatting(bodyText)}
                </div>
              </div>
            );
          })}
        </div>
      );
      return;
    }

    elements.push(
      <ul key={`${keyPrefix}-ul`} className="space-y-2 my-2">
        {currentItems.map((item, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 rounded-lg border border-nb-gray-800 bg-nb-gray-930/80 px-3.5 py-2.5 text-xs text-nb-gray-200"
          >
            <FolderTree className="h-3.5 w-3.5 shrink-0 text-netbird mt-0.5" />
            <div className="flex-1">{renderInlineFormatting(item)}</div>
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
          className="text-base font-medium tracking-tight text-nb-gray-100 border-b border-nb-gray-800/80 pb-2.5 pt-0.5"
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
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-nb-gray-300 pt-2"
        >
          <Sparkles className="h-3.5 w-3.5 text-netbird" />
          <span>{renderInlineFormatting(line.slice(3))}</span>
        </h2>
      );
      return;
    }

    if (line.startsWith("### ")) {
      flushList(`h3-${idx}`);
      elements.push(
        <h3
          key={`h3-${idx}`}
          className="text-xs font-semibold text-nb-gray-100 pt-1"
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
      <p key={`p-${idx}`} className="text-xs text-nb-gray-200 leading-relaxed">
        {renderInlineFormatting(line)}
      </p>
    );
  });

  flushList("final");

  return <div className="space-y-2">{elements}</div>;
}

function renderInlineFormatting(text: string): React.ReactNode {
  // First split by bold **...**, then recursively parse inline code `...` inside or outside bold
  const boldTokens = text.split(/(\*\*[^*]+\*\*)/g);
  return boldTokens.map((segment, i) => {
    if (
      segment.startsWith("**") &&
      segment.endsWith("**") &&
      segment.length > 4
    ) {
      const inner = segment.slice(2, -2);
      return (
        <strong key={i} className="font-semibold text-white">
          {renderCodeTokens(inner, `b-${i}`)}
        </strong>
      );
    }
    return <React.Fragment key={i}>{renderCodeTokens(segment, `t-${i}`)}</React.Fragment>;
  });
}

function renderCodeTokens(text: string, keyPrefix: string): React.ReactNode {
  const codeTokens = text.split(/(`[^`]+`)/g);
  return codeTokens.map((tok, j) => {
    if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 2) {
      return (
        <code
          key={`${keyPrefix}-${j}`}
          className="rounded border border-nb-gray-800 bg-nb-gray-950 px-1.5 py-0.5 font-mono text-[11px] text-netbird"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    return <span key={`${keyPrefix}-${j}`}>{tok}</span>;
  });
}
