import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";

const mockEnsureValidSession = jest.fn();
const mockInitCrossTabLogoutSync = jest.fn(() => jest.fn());

jest.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {},
  ensureValidSession: (...args: unknown[]) =>
    mockEnsureValidSession(...args),
}));

jest.mock("@/lib/session-expiry-warning", () => ({
  initCrossTabLogoutSync: () => mockInitCrossTabLogoutSync(),
}));

import { SessionBootstrap } from "./SessionBootstrap";

describe("SessionBootstrap", () => {
  beforeEach(() => {
    mockEnsureValidSession.mockReset();
    mockInitCrossTabLogoutSync.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("gates protected children until a current session is established", async () => {
    let resolveSession!: (accessToken: string) => void;
    mockEnsureValidSession.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveSession = resolve;
      }),
    );

    render(
      <SessionBootstrap>
        <div>protected content</div>
      </SessionBootstrap>,
    );

    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
    resolveSession("access-token");
    await waitFor(() =>
      expect(screen.getByText("protected content")).toBeInTheDocument(),
    );
    expect(mockInitCrossTabLogoutSync).toHaveBeenCalledTimes(1);
  });

  it("keeps children gated after bounded session verification failures", async () => {
    jest.useFakeTimers();
    mockEnsureValidSession.mockRejectedValue(new Error("network unavailable"));

    render(
      <SessionBootstrap>
        <div>protected content</div>
      </SessionBootstrap>,
    );

    await act(async () => {
      await jest.runAllTimersAsync();
    });

    expect(mockEnsureValidSession).toHaveBeenCalledTimes(3);
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Session verification failed.",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
