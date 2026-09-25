import {
  isClientErrorReport,
} from "@/lib/client-error-report";
import { clientErrorRateLimiter } from "@/lib/client-error-rate-limit";

const MAX_REPORT_BYTES = 1024;

type ReadBodyResult =
  | { ok: true; body: string }
  | { ok: false; status: 400 | 413 };

function emptyResponse(status: number) {
  return new Response(null, {
    status,
    headers: status === 429 ? { "Retry-After": "60" } : undefined,
  });
}

async function cancelBody(request: Request) {
  try {
    await request.body?.cancel();
  } catch {
    return;
  }
}

function parseContentLength(value: string | null) {
  if (value === null) {
    return null;
  }

  if (!/^\d+$/.test(value)) {
    return undefined;
  }

  const length = Number(value);
  return Number.isSafeInteger(length) ? length : undefined;
}

async function readLimitedBody(
  request: Request,
  contentLength: number | null,
): Promise<ReadBodyResult> {
  if (!request.body) {
    return { ok: false, status: 400 };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const chunks: string[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      receivedBytes += value.byteLength;

      if (receivedBytes > MAX_REPORT_BYTES) {
        await reader.cancel();
        return { ok: false, status: 413 };
      }

      chunks.push(decoder.decode(value, { stream: true }));
    }

    if (contentLength !== null && receivedBytes !== contentLength) {
      return { ok: false, status: 400 };
    }

    chunks.push(decoder.decode());
    return { ok: true, body: chunks.join("") };
  } catch {
    try {
      await reader.cancel();
    } catch {
      return { ok: false, status: 400 };
    }

    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: Request) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    await cancelBody(request);
    return emptyResponse(415);
  }

  const contentLength = parseContentLength(
    request.headers.get("content-length"),
  );

  if (contentLength === undefined) {
    await cancelBody(request);
    return emptyResponse(400);
  }

  if (contentLength !== null && contentLength > MAX_REPORT_BYTES) {
    await cancelBody(request);
    return emptyResponse(413);
  }

  if (clientErrorRateLimiter.isRateLimited(Date.now())) {
    await cancelBody(request);
    return emptyResponse(429);
  }

  const bodyResult = await readLimitedBody(request, contentLength);

  if (!bodyResult.ok) {
    return emptyResponse(bodyResult.status);
  }

  let report: unknown;

  try {
    report = JSON.parse(bodyResult.body);
  } catch {
    return emptyResponse(400);
  }

  if (!isClientErrorReport(report)) {
    return emptyResponse(400);
  }

  if (clientErrorRateLimiter.shouldDropReport(report, Date.now())) {
    return emptyResponse(204);
  }

  console.error("client-global-error", {
    digest: report.digest,
    eventId: report.eventId,
  });

  return emptyResponse(204);
}
