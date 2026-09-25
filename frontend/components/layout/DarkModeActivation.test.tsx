import React from "react";
import { act, render } from "@testing-library/react";
import { SystemThemeProvider } from "@/components/layout/DarkModeActivation";

const originalMatchMedia = window.matchMedia;

describe("SystemThemeProvider", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.removeProperty("color-scheme");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
  });

  it("activates and follows the system dark theme", () => {
    let dark = true;
    let listener: (() => void) | undefined;
    const media = {
      get matches() {
        return dark;
      },
      addEventListener: jest.fn((_event: string, nextListener: () => void) => {
        listener = nextListener;
      }),
      removeEventListener: jest.fn(),
    } as unknown as MediaQueryList;

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: jest.fn(() => media),
    });

    const { unmount } = render(
      <SystemThemeProvider>
        <div>Content</div>
      </SystemThemeProvider>,
    );

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    act(() => {
      dark = false;
      listener?.();
    });

    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");

    unmount();
    expect(media.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
  });
});
