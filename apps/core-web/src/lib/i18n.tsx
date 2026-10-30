"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Globe } from "lucide-react";

export type LocaleCode = "de" | "en" | (string & {});

export interface PatternRule {
  match: RegExp;
  replace: string;
}

export interface LocaleDefinition {
  code: LocaleCode;
  label: string;
  nativeLabel: string;
  shortCode: string;
  flag: string;
  htmlLang: string;
  /** Exact phrase lookup map: canonical source string -> translated string */
  dictionary: Record<string, string>;
  /** Dynamic regex pattern rules (e.g., "Alle (5)" -> "All (5)") */
  patterns: PatternRule[];
}

import { DE_DICTIONARY, EN_DICTIONARY } from "./i18n/deDict";
import { DE_PATTERNS, EN_PATTERNS } from "./i18n/patterns";

export const LOCALE_REGISTRY: Record<string, LocaleDefinition> = {
  de: {
    code: "de",
    label: "German",
    nativeLabel: "Deutsch",
    shortCode: "DE",
    flag: "🇩🇪",
    htmlLang: "de",
    dictionary: DE_DICTIONARY,
    patterns: DE_PATTERNS,
  },
  en: {
    code: "en",
    label: "English",
    nativeLabel: "English",
    shortCode: "EN",
    flag: "🇬🇧",
    htmlLang: "en",
    dictionary: EN_DICTIONARY,
    patterns: EN_PATTERNS,
  },
};

export function registerLocale(definition: LocaleDefinition) {
  LOCALE_REGISTRY[definition.code] = definition;
}

export function translateStringForLocale(
  raw: string,
  locale: LocaleCode
): string {
  if (!raw) return raw;
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return raw;

  const def = LOCALE_REGISTRY[locale] || LOCALE_REGISTRY.de;

  // 1. Exact match in active locale dictionary
  if (def.dictionary[trimmed]) {
    const leading = raw.match(/^\s*/)?.[0] || "";
    const trailing = raw.match(/\s*$/)?.[0] || "";
    return `${leading}${def.dictionary[trimmed]}${trailing}`;
  }

  // 2. Pattern match in active locale
  for (const rule of def.patterns) {
    if (rule.match.test(trimmed)) {
      const replaced = trimmed.replace(rule.match, rule.replace);
      const leading = raw.match(/^\s*/)?.[0] || "";
      const trailing = raw.match(/\s*$/)?.[0] || "";
      return `${leading}${replaced}${trailing}`;
    }
  }

  return raw;
}

interface I18nContextValue {
  locale: LocaleCode;
  setLocale: (next: LocaleCode) => void;
  locales: LocaleDefinition[];
  /** Inline multilingual helper: `t("Übersicht", "Overview", { fr: "Aperçu" })` */
  t: (
    deText: string,
    enText: string,
    extraLocales?: Record<string, string>
  ) => string;
  translateText: (raw: string) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "de",
  setLocale: () => {},
  locales: Object.values(LOCALE_REGISTRY),
  t: (deText) => deText,
  translateText: (raw) => raw,
});

export function useI18n() {
  return useContext(I18nContext);
}

const STORAGE_KEY = "synapse_ui_locale";

interface SynchronizedTextNode extends Text {
  __synapseOrigText?: string;
  __synapseLastApplied?: string;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>("de");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && LOCALE_REGISTRY[saved]) {
        setLocaleState(saved);
      }
    }
  }, []);

  const setLocale = useCallback((next: LocaleCode) => {
    if (!LOCALE_REGISTRY[next]) return;
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = LOCALE_REGISTRY[next].htmlLang;
    }
  }, []);

  const t = useCallback(
    (
      deText: string,
      enText: string,
      extraLocales?: Record<string, string>
    ): string => {
      if (locale === "de") return deText;
      if (locale === "en") return enText;
      if (extraLocales && extraLocales[locale]) {
        return extraLocales[locale];
      }
      return translateStringForLocale(deText, locale) || enText;
    },
    [locale]
  );

  const translateText = useCallback(
    (raw: string) => translateStringForLocale(raw, locale),
    [locale]
  );

  // Automatic DOM Synchronizer so every button, badge, header, modal, placeholder & tooltip switches language seamlessly
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang =
      LOCALE_REGISTRY[locale]?.htmlLang || locale;

    let isApplying = false;

    const shouldSkipElement = (el: Element | null): boolean => {
      if (!el) return true;
      const tag = el.tagName;
      if (
        tag === "SCRIPT" ||
        tag === "STYLE" ||
        tag === "CODE" ||
        tag === "TEXTAREA"
      ) {
        return true;
      }
      if (tag === "PRE") {
        const txt = (el.textContent || "").trim();
        if (
          txt === "Klicke links auf eine Option oder auf 'Ausführen'." ||
          txt === "Click an option on the left or press 'Execute'." ||
          txt ===
            "Click 'Refresh' or 'Run 5-Step Self-Test' to inspect live Core & Gateway state." ||
          txt ===
            "Klicke auf 'Aktualisieren' oder '5-Stufen-Selbsttest starten', um den Live-Status zu prüfen."
        ) {
          return false;
        }
        return true;
      }
      if (
        el.closest(
          "pre, code, .xterm, [data-no-i18n='true']"
        )
      ) {
        return true;
      }
      return false;
    };

    const syncSubtree = (root: Node) => {
      if (isApplying) return;
      isApplying = true;
      try {
        const walker = document.createTreeWalker(
          root,
          NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
        );

        let current: Node | null = walker.currentNode;
        while (current) {
          if (current.nodeType === Node.TEXT_NODE) {
            const textNode = current as SynchronizedTextNode;
            const parent = textNode.parentElement;
            if (!shouldSkipElement(parent)) {
              const currentVal = textNode.nodeValue || "";
              if (
                textNode.__synapseOrigText === undefined ||
                (textNode.__synapseLastApplied !== undefined &&
                  currentVal !== textNode.__synapseLastApplied)
              ) {
                // React updated the underlying text node -> capture new canonical original text
                textNode.__synapseOrigText = currentVal;
              }
              const orig = textNode.__synapseOrigText;
              if (orig && orig.trim().length > 1) {
                const nextVal = translateStringForLocale(orig, locale);
                if (nextVal !== currentVal) {
                  textNode.nodeValue = nextVal;
                }
                textNode.__synapseLastApplied = nextVal;
              }
            }
          } else if (current.nodeType === Node.ELEMENT_NODE) {
            const el = current as HTMLElement;
            for (const attr of ["placeholder", "title", "aria-label"]) {
              const val = el.getAttribute(attr);
              if (val) {
                const origAttrKey = `data-synapse-orig-${attr}`;
                const lastAttrKey = `data-synapse-last-${attr}`;
                let orig = el.getAttribute(origAttrKey);
                const lastApplied = el.getAttribute(lastAttrKey);
                if (!orig || (lastApplied && val !== lastApplied)) {
                  orig = val;
                  el.setAttribute(origAttrKey, orig);
                }
                const nextVal = translateStringForLocale(orig, locale);
                if (nextVal !== val) {
                  el.setAttribute(attr, nextVal);
                }
                el.setAttribute(lastAttrKey, nextVal);
              }
            }
          }
          current = walker.nextNode();
        }
      } finally {
        isApplying = false;
      }
    };

    syncSubtree(document.body);

    const observer = new MutationObserver((mutations) => {
      if (isApplying) return;
      for (const m of mutations) {
        if (m.type === "childList") {
          m.addedNodes.forEach((n) => syncSubtree(n));
        } else if (m.type === "characterData" && m.target) {
          syncSubtree(m.target);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      locales: Object.values(LOCALE_REGISTRY),
      t,
      translateText,
    }),
    [locale, setLocale, t, translateText]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Compact, extensible Language Switcher Pill for the Top Header Bar & Settings
 * Automatically renders all registered languages from `LOCALE_REGISTRY`.
 */
export function LanguageSwitcher({
  variant = "header",
}: {
  variant?: "header" | "settings";
}) {
  const { locale, setLocale, locales } = useI18n();

  if (variant === "settings") {
    return (
      <div className="flex flex-wrap items-center gap-2" data-no-i18n="true">
        {locales.map((loc) => {
          const active = locale === loc.code;
          return (
            <button
              key={loc.code}
              type="button"
              onClick={() => setLocale(loc.code)}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition ${
                active
                  ? "border-netbird bg-netbird/20 text-white shadow-sm"
                  : "border-nb-gray-800 bg-nb-gray-950 text-nb-gray-300 hover:border-nb-gray-700 hover:text-white"
              }`}
            >
              <span className="text-sm">{loc.flag}</span>
              <span>{loc.nativeLabel}</span>
              <span className="rounded bg-nb-gray-900 px-1.5 py-0.2 font-mono text-[10px] text-nb-gray-400">
                {loc.shortCode}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="flex h-8 items-center rounded-lg border border-nb-gray-800/80 bg-nb-gray-930 text-xs font-medium"
      style={{ paddingLeft: "10px", paddingRight: "4px", gap: "4px" }}
      data-no-i18n="true"
      title={
        locale === "de"
          ? "Sprache wechseln (Deutsch / English)"
          : "Switch language (Deutsch / English)"
      }
    >
      <Globe
        className="h-3.5 w-3.5 text-nb-gray-400 shrink-0"
        style={{ marginRight: "4px" }}
      />
      {locales.map((loc) => {
        const active = locale === loc.code;
        return (
          <button
            key={loc.code}
            type="button"
            onClick={() => setLocale(loc.code)}
            style={{ height: "22px", paddingLeft: "9px", paddingRight: "9px" }}
            className={`flex items-center justify-center rounded-md font-mono text-[11px] font-semibold leading-none transition-colors ${
              active
                ? "bg-netbird text-white shadow-sm"
                : "text-nb-gray-400 hover:text-white"
            }`}
          >
            {loc.shortCode}
          </button>
        );
      })}
    </div>
  );
}
