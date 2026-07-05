/**
 * Response-body retrieval for Playwright-backed browser tools.
 */
import { normalizeOptionalString } from "openclaw/plugin-sdk/string-coerce-runtime";
import type { Page } from "playwright-core";
import { ensurePageState, getPageForTargetId } from "./pw-session.js";
import { normalizeTimeoutMs } from "./pw-tools-core.shared.js";
import { matchBrowserUrlPattern } from "./url-pattern.js";

/** Convenience return type for response body results. */
type ResponseBodyResult = {
  url: string;
  status?: number;
  headers?: Record<string, string>;
  body: string;
  truncated?: boolean;
};

/** Waits for a response URL pattern and returns a bounded text body. */
export async function responseBodyViaPlaywright(opts: {
  cdpUrl: string;
  targetId?: string;
  url: string;
  timeoutMs?: number;
  maxChars?: number;
}): Promise<ResponseBodyResult> {
  const pattern = normalizeOptionalString(opts.url) ?? "";
  if (!pattern) {
    throw new Error("url is required");
  }
  const maxChars =
    typeof opts.maxChars === "number" && Number.isFinite(opts.maxChars)
      ? Math.max(1, Math.min(5_000_000, Math.floor(opts.maxChars)))
      : 200_000;
  const timeout = normalizeTimeoutMs(opts.timeoutMs, 20_000);
  const maxBytes = maxChars * 4;

  const page = await getPageForTargetId(opts);
  ensurePageState(page);

  return await bodySubarrayFallback(page, pattern, maxChars, maxBytes, timeout);
}

/** body()+subarray bounded decode to avoid full-string allocation. */
async function bodySubarrayFallback(
  page: Page,
  pattern: string,
  maxChars: number,
  maxBytes: number,
  timeoutMs: number,
): Promise<ResponseBodyResult> {
  const promise = new Promise<unknown>((resolve, reject) => {
    let done = false;
    let timer: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      if (handler) {
        page.off("response", handler as never);
      }
    };

    const handler: ((resp: unknown) => void) | undefined = (resp: unknown) => {
      if (done) {
        return;
      }
      const r = resp as { url?: () => string };
      const u = r.url?.() || "";
      if (!matchBrowserUrlPattern(pattern, u)) {
        return;
      }
      done = true;
      cleanup();
      resolve(resp);
    };

    page.on("response", handler as never);
    timer = setTimeout(() => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      reject(
        new Error(
          `Response not found for url pattern "${pattern}". Run 'openclaw browser requests' to inspect recent network activity.`,
        ),
      );
    }, timeoutMs);
  });

  const resp = (await promise) as {
    url?: () => string;
    status?: () => number;
    headers?: () => Record<string, string>;
    body?: () => Promise<Buffer>;
    text?: () => Promise<string>;
  };

  const url = resp.url?.() || "";
  const status = resp.status?.();
  const headers = resp.headers?.();

  // Reject oversized responses before buffering via body(), when the
  // content-length header is available. For chunked/unknown-length responses,
  // body() still allocates the full buffer; subarray bounds string decoding.
  const contentLength = headers ? Number(headers["content-length"]) : Number.NaN;
  const oversized = !Number.isNaN(contentLength) && contentLength > maxBytes;

  let bodyText = "";
  try {
    if (typeof resp.body === "function" && !oversized) {
      const buf = await resp.body();
      // ponytail: subarray bounds string alloc. maxBytes = maxChars * 4
      // guarantees ≥maxChars chars decoded (UTF-8 max 4 bytes/char).
      const decodeLen = Math.min(buf.byteLength, maxBytes);
      bodyText = new TextDecoder("utf-8").decode(buf.subarray(0, decodeLen));
    }
  } catch (err) {
    throw new Error(`Failed to read response body for "${url}": ${String(err)}`, { cause: err });
  }

  const trimmed = bodyText.length > maxChars ? bodyText.slice(0, maxChars) : bodyText;
  return {
    url,
    status,
    headers,
    body: trimmed,
    truncated: bodyText.length > maxChars || oversized ? true : undefined,
  };
}
