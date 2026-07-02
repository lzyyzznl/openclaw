/**
 * Response-body retrieval for Playwright-backed browser tools.
 */
import { normalizeOptionalString } from "openclaw/plugin-sdk/string-coerce-runtime";
import type { CDPSession, Page } from "playwright-core";
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

  // Truly bounded capture via CDP Fetch.takeResponseBodyAsStream (Chromium only).
  let cdpSession: CDPSession | null = null;
  try {
    cdpSession = await page.context().newCDPSession(page);
  } catch {
    // cdpSession stays null
  }
  if (cdpSession) {
    try {
      return await boundedStreamViaCdpFetch(cdpSession, pattern, maxChars, maxBytes, timeout);
    } finally {
      await cdpSession.detach().catch(() => {});
    }
  }

  // Fallback: body()+subarray for browsers without CDP (Firefox, WebKit).
  return await bodySubarrayFallback(page, pattern, maxChars, maxBytes, timeout);
}

/**
 * CDP Fetch.takeResponseBodyAsStream + IO.read chunked streaming.
 *
 * Unlike Playwright's resp.body() which buffers the entire body in Node.js
 * memory before returning, CDP streaming reads small chunks and stops at the
 * byte cap — no full-Buffer allocation for large responses.
 */
async function boundedStreamViaCdpFetch(
  cdpSession: CDPSession,
  pattern: string,
  maxChars: number,
  maxBytes: number,
  timeoutMs: number,
): Promise<ResponseBodyResult> {
  return new Promise<ResponseBodyResult>((resolve, reject) => {
    let done = false;
    let timer: NodeJS.Timeout | undefined;

    const cleanup = () => {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      cdpSession.off("Fetch.requestPaused" as never, handler as never);
      cdpSession.send("Fetch.disable" as never).catch(() => {});
    };

    const handler = async (event: unknown) => {
      if (done) {
        return;
      }

      const evt = event as {
        requestId: string;
        request?: { url: string };
        responseHeaders?: { name: string; value: string }[];
      };
      const reqUrl = evt.request?.url ?? "";
      if (!matchBrowserUrlPattern(pattern, reqUrl)) {
        // Not a match — continue immediately so the page is not held up.
        cdpSession
          .send(
            "Fetch.continueResponse" as never,
            {
              requestId: evt.requestId,
            } as never,
          )
          .catch(() => {});
        return;
      }

      // Match found — read body via stream.
      done = true;
      clearTimeout(timer);
      timer = undefined;
      // cleanup() (Fetch.disable + listener removal) deferred until after
      // stream operations complete — Fetch.disable before
      // takeResponseBodyAsStream is undefined behavior per CDP docs.

      try {
        const headers = responseHeadersToRecord(evt.responseHeaders);
        const status = (evt as { responseStatusCode?: number }).responseStatusCode ?? undefined;

        const { stream } = (await cdpSession.send(
          "Fetch.takeResponseBodyAsStream" as never,
          { requestId: evt.requestId } as never,
        )) as { stream: unknown };

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        let isEof = false;

        while (totalBytes < maxBytes) {
          const result = (await cdpSession.send(
            "IO.read" as never,
            {
              handle: stream,
              size: 65536,
            } as never,
          )) as { data?: string; base64Encoded?: boolean; eof?: boolean };

          if (result.data) {
            const chunk = result.base64Encoded
              ? Buffer.from(result.data, "base64")
              : Buffer.from(result.data);
            totalBytes += chunk.length;
            chunks.push(chunk);
          }

          if (result.eof) {
            isEof = true;
            break;
          }
        }

        // Close stream early if we hit the cap, safe to call even at eof.
        await cdpSession.send("IO.close" as never, { handle: stream } as never).catch(() => {});

        // Assemble captured buffer before fulfill.
        const fullBuf = Buffer.concat(chunks);

        // Fulfill the request so the page's fetch/navigation completes.
        // continueResponse fails after takeResponseBodyAsStream ("unable to continue
        // request as is after body is taken"), so fulfillRequest with captured body.
        const responseHeadersForFulfill = (evt.responseHeaders || [])
          .filter((h) => !h.name.startsWith(":"))
          .map((h) => ({ name: h.name, value: h.value }));
        await cdpSession
          .send(
            "Fetch.fulfillRequest" as never,
            {
              requestId: evt.requestId,
              responseCode: status ?? 200,
              responseHeaders: responseHeadersForFulfill,
              body: fullBuf.toString("base64"),
            } as never,
          )
          .catch(() => {});

        // Decode bounded buffer for tool return value.
        const decodeLen = Math.min(fullBuf.byteLength, maxBytes);
        const bodyText = new TextDecoder("utf-8").decode(fullBuf.subarray(0, decodeLen));
        const trimmed = bodyText.length > maxChars ? bodyText.slice(0, maxChars) : bodyText;

        cleanup();

        resolve({
          url: reqUrl,
          status,
          headers,
          body: trimmed,
          truncated: totalBytes >= maxBytes && !isEof ? true : undefined,
        });
      } catch (err) {
        cleanup();
        reject(
          new Error(`Failed to read response body for "${reqUrl}": ${String(err)}`, {
            cause: err,
          }),
        );
      }
    };

    cdpSession.on("Fetch.requestPaused" as never, handler as never);
    cdpSession
      .send(
        "Fetch.enable" as never,
        {
          patterns: [{ requestStage: "Response" }],
        } as never,
      )
      .catch(reject);

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
}

function responseHeadersToRecord(
  headers?: { name: string; value: string }[],
): Record<string, string> | undefined {
  if (!headers || headers.length === 0) {
    return undefined;
  }
  const record: Record<string, string> = {};
  for (const h of headers) {
    if (h.name.startsWith(":")) {
      continue; // Skip pseudo-headers like :status, :method, :path.
    }
    record[h.name] = h.value;
  }
  return Object.keys(record).length > 0 ? record : undefined;
}

/** Fallback: body()+subarray bounded decode when CDP is unavailable. */
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

  let bodyText = "";
  try {
    if (typeof resp.body === "function") {
      const buf = await resp.body();
      // ponytail: Playwright body() buffers the full response; subarray
      // avoids full-string decoding. Upstream to CDP streaming when feasible.
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
    truncated: bodyText.length > maxChars ? true : undefined,
  };
}
