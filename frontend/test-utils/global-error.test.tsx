import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import GlobalError from "@/app/global-error";
import { POST } from "@/app/api/client-errors/route";
import { clientErrorRateLimiter } from "@/lib/client-error-rate-limit";

const EVENT_ID = "00000000-0000-4000-8000-000000000001";
const originalFetch = globalThis.fetch;
const originalRandomUUID = globalThis.crypto.randomUUID;
const fetchMock = jest.fn();

function globalErrorWithDigest(digest?: string) {
  return Object.assign(new Error("private database token"), { digest });
}

function clientErrorRequest(payload: unknown) {
  return new Request("http://localhost/api/client-errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

describe("GlobalError", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: () => EVENT_ID,
    });
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: originalRandomUUID,
    });
  });

  it("renders a standalone fallback document with a provider-free home anchor", () => {
    const reset = jest.fn();
    const { container } = render(
      <GlobalError error={globalErrorWithDigest()} reset={reset} />,
    );

    expect(container.querySelector("html")).toHaveAttribute("lang", "en");
    expect(container.querySelector("body")).toHaveStyle({
      backgroundColor: "#ffffff",
    });
    expect(
      screen.getByRole("heading", { name: "Something went wrong" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go back home" })).toHaveAttribute(
      "href",
      "/",
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("reports a bounded coded digest and opaque event ID", async () => {
    render(
      <GlobalError
        error={globalErrorWithDigest("1234567890@E123")}
        reset={jest.fn()}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/client-errors");
    expect(options).toMatchObject({
      method: "POST",
      credentials: "omit",
      keepalive: true,
      referrerPolicy: "no-referrer",
    });
    expect(JSON.parse(String(options.body))).toEqual({
      boundary: "global-error",
      digest: "1234567890@E123",
      eventId: EVENT_ID,
    });
    expect(String(options.body)).not.toContain("private database token");
  });

  it("does not retry a non-2xx reporting response", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    render(<GlobalError error={globalErrorWithDigest()} reset={jest.fn()} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("swallows reporting failures", async () => {
    fetchMock.mockRejectedValueOnce(new Error("reporting unavailable"));
    render(<GlobalError error={globalErrorWithDigest()} reset={jest.fn()} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});

describe("client error endpoint", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    clientErrorRateLimiter.reset();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    clientErrorRateLimiter.reset();
  });

  it("accepts and logs only a valid coded digest and event ID", async () => {
    const response = await POST(
      clientErrorRequest({
        boundary: "global-error",
        digest: "1234567890@E123",
        eventId: EVENT_ID,
      }),
    );

    expect(response.status).toBe(204);
    expect(consoleError).toHaveBeenCalledWith("client-global-error", {
      digest: "1234567890@E123",
      eventId: EVENT_ID,
    });
  });

  it("rejects reports containing error details", async () => {
    const response = await POST(
      clientErrorRequest({
        boundary: "global-error",
        digest: null,
        eventId: EVENT_ID,
        message: "private database token",
      }),
    );

    expect(response.status).toBe(400);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("rejects an invalid Content-Length before reading the body", async () => {
    const request = {
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      }),
      headers: new Headers({
        "Content-Type": "application/json",
        "Content-Length": "invalid",
      }),
    } as unknown as Request;

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("cancels a streaming body as soon as it exceeds the byte limit", async () => {
    const cancel = jest.fn().mockResolvedValue(undefined);
    const releaseLock = jest.fn();
    const reader = {
      read: jest.fn().mockResolvedValue({
        done: false,
        value: new TextEncoder().encode("x".repeat(2048)),
      }),
      cancel,
      releaseLock,
    };
    const request = {
      body: {
        getReader: jest.fn(() => reader),
      },
      headers: new Headers({ "Content-Type": "application/json" }),
    } as unknown as Request;

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });

  it("deduplicates repeated reports", async () => {
    const payload = {
      boundary: "global-error",
      digest: "dedup-digest@E200",
      eventId: EVENT_ID,
    };

    const first = await POST(clientErrorRequest(payload));
    const second = await POST(clientErrorRequest(payload));

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("samples client-only reports", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0.99);

    const response = await POST(
      clientErrorRequest({
        boundary: "global-error",
        digest: null,
        eventId: EVENT_ID,
      }),
    );

    expect(response.status).toBe(204);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("returns 429 after the per-instance request limit", async () => {
    const responses = await Promise.all(
      Array.from({ length: 30 }, (_, index) =>
        POST(
          clientErrorRequest({
            boundary: "global-error",
            digest: `rate-${index}`,
            eventId: EVENT_ID,
          }),
        ),
      ),
    );

    expect(responses.some((response) => response.status === 429)).toBe(true);
  });
});
