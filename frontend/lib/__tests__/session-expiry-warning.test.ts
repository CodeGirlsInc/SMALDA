import { act, renderHook } from "@testing-library/react";
import {
  getTokenExpiryMs,
  useSessionExpiryWarning,
} from "../session-expiry-warning";

const values: Record<string, string> = {};
let storageBlocked = false;
const localStorage = {
  getItem: jest.fn((key: string) => {
    if (storageBlocked) throw new DOMException("blocked", "SecurityError");
    return values[key] ?? null;
  }),
};

function makeToken(expiresInSeconds: number): string {
  const payload = btoa(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expiresInSeconds }),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  Object.keys(values).forEach((key) => delete values[key]);
  values["auth-token"] = makeToken(600);
  storageBlocked = false;
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: localStorage,
  });
  localStorage.getItem.mockClear();
  Object.defineProperty(window, "confirm", {
    configurable: true,
    value: jest.fn(() => false),
  });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe("session expiry warning", () => {
  it("parses base64url JWT payloads without requiring padding", () => {
    const token =
      "header.eyJleHAiOjE4OTM0NTYwMDAsIngiOiL_wiJ9.signature";

    expect(getTokenExpiryMs(token)).toBe(
      1893456000000 - new Date("2026-01-01T00:00:00.000Z").getTime(),
    );
  });

  it("postpones the prompt until a continuous typing stream stops", () => {
    values["auth-token"] = makeToken(360);
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const editor = document.createElement("textarea");
    document.body.appendChild(editor);
    const { unmount } = renderHook(() =>
      useSessionExpiryWarning({ onRefresh }),
    );

    act(() => {
      for (let index = 0; index < 400; index += 1) {
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        jest.advanceTimersByTime(200);
      }
    });

    expect(window.confirm).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(250);
      jest.advanceTimersByTime(60 * 1000);
    });
    expect(window.confirm).toHaveBeenCalledTimes(1);
    unmount();
    editor.remove();
  });

  it("handles blocked localStorage without throwing from activity", () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const editor = document.createElement("input");
    document.body.appendChild(editor);
    const { unmount } = renderHook(() =>
      useSessionExpiryWarning({ onRefresh }),
    );
    storageBlocked = true;

    expect(() => {
      act(() => {
        editor.dispatchEvent(new Event("focusin", { bubbles: true }));
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        jest.advanceTimersByTime(10 * 60 * 1000);
      });
    }).not.toThrow();
    expect(window.confirm).not.toHaveBeenCalled();
    unmount();
    editor.remove();
  });

  it("uses the latest refresh callback without restarting on identity changes", async () => {
    values["auth-token"] = makeToken(1200);
    const firstRefresh = jest.fn().mockResolvedValue(undefined);
    const secondRefresh = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, "confirm", {
      configurable: true,
      value: jest.fn(() => true),
    });
    const { rerender, unmount } = renderHook(
      ({ onRefresh }: { onRefresh: () => Promise<void> }) =>
        useSessionExpiryWarning({ onRefresh }),
      { initialProps: { onRefresh: firstRefresh } },
    );

    rerender({ onRefresh: secondRefresh });
    await act(async () => {
      jest.advanceTimersByTime(5 * 60 * 1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(firstRefresh).not.toHaveBeenCalled();
    expect(secondRefresh).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("cleans the timer and listeners on unmount", () => {
    const editor = document.createElement("textarea");
    document.body.appendChild(editor);
    const { unmount } = renderHook(() =>
      useSessionExpiryWarning({ onRefresh: jest.fn().mockResolvedValue(undefined) }),
    );

    act(() => {
      jest.advanceTimersByTime(4 * 60 * 1000);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    unmount();

    act(() => {
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      jest.advanceTimersByTime(10 * 60 * 1000);
    });
    expect(window.confirm).not.toHaveBeenCalled();
    editor.remove();
  });
});
