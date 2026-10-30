export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  json: <R = T>() => Promise<R>;
  text: () => Promise<string>;
}

/**
 * Executes a timeout-guarded `fetch` and safely parses the JSON response without throwing
 * on network drops, aborted requests, or non-JSON error pages (e.g. HTTP 502/504 HTML).
 * Supports both `{ ok, data, error }` destructuring and drop-in `await res.json()` usage.
 */
export async function safeFetchJson<T = any>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult<T>> {
  const { timeoutMs = 20_000, signal: externalSignal, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      const errObj = { ok: false, status: 0, error: "Request aborted" };
      return {
        ok: false,
        status: 0,
        data: null,
        error: "Request aborted",
        json: async <R = T>() => errObj as unknown as R,
        text: async () => "",
      };
    }
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
    });
    const rawText = await res.text();
    let parsed: T | null = null;
    if (rawText && rawText.trim()) {
      try {
        parsed = JSON.parse(rawText) as T;
      } catch {
        parsed = null;
      }
    }
    const errMsg = !res.ok
      ? (parsed as Record<string, unknown> | null)?.error
        ? String((parsed as Record<string, unknown>).error)
        : parsed === null && rawText.trim()
        ? `Non-JSON response (HTTP ${res.status})`
        : `HTTP ${res.status}`
      : parsed === null
      ? "Invalid JSON response"
      : undefined;

    const fallbackObj = {
      ok: false,
      status: res.status,
      error: errMsg || `HTTP ${res.status}`,
    };

    return {
      ok: res.ok && parsed !== null,
      status: res.status,
      data: parsed,
      error: errMsg,
      text: async () => rawText,
      json: async <R = T>() => (parsed !== null ? (parsed as unknown as R) : (fallbackObj as unknown as R)),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network request failed";
    const errObj = { ok: false, status: 0, error: msg };
    return {
      ok: false,
      status: 0,
      data: null,
      error: msg,
      text: async () => "",
      json: async <R = T>() => errObj as unknown as R,
    };
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}

export const safeFetch = safeFetchJson;
