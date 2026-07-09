import { invoke } from '@tauri-apps/api/core';
import { isDesktopRuntime } from './desktop';

export type RobustFetchInit = {
  method?: string;
  headers?: HeadersInit;
  body?: string | null;
  signal?: AbortSignal;
  /** Override timeout for desktop proxy (ms). 0 = no timeout. Default 120000. */
  timeoutMs?: number;
};

type DesktopHttpResponse = {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
};

function headersToRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const out: Record<string, string> = {};
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return { ...headers };
}

/**
 * Rewrite absolute API URLs through the Vite dev proxy so browser mode
 * avoids CORS / Private Network Access blocks.
 */
export function toProxiedUrl(url: string): string {
  if (typeof window === 'undefined') return url;
  // Desktop uses Rust proxy — never rewrite there.
  if (isDesktopRuntime()) return url;

  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.hostname === 'openrouter.ai' || parsed.hostname.endsWith('.openrouter.ai')) {
      return `/__proxy/openrouter${parsed.pathname}${parsed.search}`;
    }
    if (
      (parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '[::1]') &&
      (parsed.port === '11434' || parsed.port === '')
    ) {
      // Default Ollama port when omitted is not 11434 — only rewrite explicit 11434
      if (parsed.port === '11434') {
        return `/__proxy/ollama${parsed.pathname}${parsed.search}`;
      }
    }
  } catch {
    // keep original
  }
  return url;
}

/**
 * Network fetch that works in:
 * - Tauri desktop: Rust reqwest proxy (no WebView CORS / mixed-content)
 * - Browser dev: Vite reverse proxies for OpenRouter + Ollama
 * - Fallback: native fetch
 */
export async function robustFetch(url: string, init: RobustFetchInit = {}): Promise<Response> {
  if (init.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }

  const method = (init.method || 'GET').toUpperCase();
  const headers = headersToRecord(init.headers);
  const body = init.body ?? undefined;

  if (isDesktopRuntime()) {
    try {
      // Honour AbortSignal by racing a reject — invoke itself is not abortable.
      const invokePromise = invoke<DesktopHttpResponse>('http_request', {
        request: {
          url,
          method,
          headers,
          body: body ?? null,
          timeoutMs: init.timeoutMs ?? 120_000,
        },
      });

      const result = init.signal
        ? await Promise.race([
            invokePromise,
            new Promise<never>((_, reject) => {
              const onAbort = () => {
                reject(new DOMException('The operation was aborted.', 'AbortError'));
              };
              if (init.signal!.aborted) {
                onAbort();
                return;
              }
              init.signal!.addEventListener('abort', onAbort, { once: true });
            }),
          ])
        : await invokePromise;

      return new Response(result.body, {
        status: result.status,
        statusText: result.ok ? 'OK' : 'Error',
        headers: result.headers,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // Old desktop binary without http_request — fall through to browser fetch
      if (/http_request|command.*not found|unknown command|Command/i.test(msg) && !/timed out|Connection failed|HTTP request failed|Blocked URL/i.test(msg)) {
        // fall through
      } else if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      } else {
        // Surface as TypeError so existing "Failed to fetch" handlers stay consistent,
        // but keep the real reason in the message.
        throw new TypeError(msg.startsWith('Failed to fetch') ? msg : `Failed to fetch: ${msg}`);
      }
    }
  }

  const target = toProxiedUrl(url);
  try {
    return await fetch(target, {
      method,
      headers,
      body,
      signal: init.signal,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Enrich opaque browser errors
    throw new TypeError(
      `${msg} (url: ${target}${target !== url ? `; original: ${url}` : ''})`,
    );
  }
}
