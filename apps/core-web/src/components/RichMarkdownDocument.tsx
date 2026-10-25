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
 * into clean, modern 2026 typographic blocks, timeline entries, and visual Mermaid topology graphs
 * instead of raw markdown text.
 */
export default function RichMarkdownDocument({
  markdown,
  variant = "architecture",
}: RichMarkdownDocumentProps) {
  if (!markdown || !markdown.trim()) {
    return (
      <div className="text-sm text-zinc-500 italic py-4">
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
    <div className="space-y-5 text-zinc-200 leading-relaxed">
      {segments.map((seg, idx) => {
        if (seg.type === "mermaid") {
          return (
            <div key={idx} className="my-4">
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
              className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#07070b] shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3.5 py-1.5 text-[11px] font-mono text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Terminal className="h-3 w-3 text-emerald-400" />
                  {seg.lang}
                </span>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-emerald-300">
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
      // Render chronological timeline cards for Memory.md
      elements.push(
        <div
          key={`${keyPrefix}-timeline`}
          className="relative space-y-3 border-l-2 border-emerald-500/25 pl-5 ml-2 my-3"
        >
          {currentItems.map((item, i) => {
            const tsMatch = item.match(/^\*\*\[([^\]]+)\]\*\*\s*([\s\S]*)$/);
            const timestamp = tsMatch ? tsMatch[1] : null;
            const bodyText = tsMatch ? tsMatch[2] : item;
            return (
              <div
                key={i}
                className="relative rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 transition hover:border-white/[0.12]"
              >
                <span className="absolute -left-[27px] top-4 h-2.5 w-2.5 rounded-full border-2 border-emerald-400 bg-[#09090f]" />
                {timestamp && (
                  <div className="mb-1 flex items-center gap-1.5 font-mono text-[11px] text-emerald-400">
                    <Clock className="h-3 w-3" />
                    <span>{timestamp.replace("T", " ").replace("Z", " UTC")}</span>
                  </div>
                )}
                <div className="text-sm text-zinc-200">
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
            className="flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.015] px-3.5 py-2.5 text-sm text-zinc-300"
          >
            <FolderTree className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
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
          className="text-xl font-semibold tracking-tight text-white border-b border-white/[0.07] pb-2.5 pt-1"
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
          className="flex items-center gap-2 text-base font-semibold text-emerald-300 pt-2"
        >
          <Sparkles className="h-4 w-4 text-emerald-400" />
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
          className="text-sm font-semibold text-zinc-100 pt-1"
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
      <p key={`p-${idx}`} className="text-sm text-zinc-300 leading-relaxed">
        {renderInlineFormatting(line)}
      </p>
    );
  });

  flushList("final");

  return <div className="space-y-2.5">{elements}</div>;
}

function renderInlineFormatting(text: string): React.ReactNode {
  // Split by inline code `...` and bold **...**
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 2) {
      return (
        <code
          key={i}
          className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-xs text-emerald-300"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    if (tok.startsWith("**") && tok.endsWith("**") && tok.length > 4) {
      return (
        <strong key={i} className="font-semibold text-white">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{tok}</span>;
  });
}
