export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number;
}

export interface SafeFetchResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

/**
 * Executes a timeout-guarded `fetch` and safely parses the JSON response without throwing
 * on network drops, aborted requests, or non-JSON error pages.
 */
export async function safeFetchJson<T = Record<string, unknown>>(
  url: string,
  options: SafeFetchOptions = {}
): Promise<SafeFetchResult<T>> {
  const { timeoutMs = 15_000, signal: externalSignal, ...rest } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      return { ok: false, status: 0, data: null, error: "Request aborted" };
    }
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: T | null = null;
    if (text && text.trim()) {
      try {
        parsed = JSON.parse(text) as T;
      } catch {
        parsed = null;
      }
    }
    return {
      ok: res.ok && parsed !== null,
      status: res.status,
      data: parsed,
      error: !res.ok
        ? (parsed as Record<string, unknown> | null)?.error
          ? String((parsed as Record<string, unknown>).error)
          : `HTTP ${res.status}`
        : undefined,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : "Network request failed",
    };
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }
}
