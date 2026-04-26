import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  ThemeProvider,
  useTheme,
  getThemeScript,
} from "./useTheme";
import type { Theme } from "./useTheme";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Render a component inside ThemeProvider */
function renderWithProvider(
  ui: React.ReactNode,
  defaultTheme?: Theme
) {
  return render(
    <ThemeProvider defaultTheme={defaultTheme ?? "system"}>
      {ui}
    </ThemeProvider>
  );
}

/** Component that displays theme info using the hook */
function ThemeDisplay() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button data-testid="set-dark" onClick={() => setTheme("dark")} />
      <button data-testid="set-light" onClick={() => setTheme("light")} />
      <button data-testid="set-system" onClick={() => setTheme("system")} />
      <button data-testid="toggle" onClick={toggleTheme} />
    </div>
  );
}

/** Component that uses useTheme outside of ThemeProvider */
function OrphanComponent() {
  useTheme();
  return <div>orphan</div>;
}

// ─── Storage mock ────────────────────────────────────────────────────────────

const STORAGE_KEY = "smalda-theme";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

// ─── ThemeProvider ───────────────────────────────────────────────────────────

describe("ThemeProvider", () => {
  it("defaults to system theme when no stored preference", () => {
    renderWithProvider(<ThemeDisplay />);
    // The effect runs after mount; resolvedTheme may be "light" or "dark"
    // depending on the test environment's matchMedia mock.
    // The theme preference should be "system" by default.
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
  });

  it("reads stored theme from localStorage on mount", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    renderWithProvider(<ThemeDisplay />);

    // After the effect runs, the stored "dark" preference should be loaded
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("applies .dark class when resolved theme is dark", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    renderWithProvider(<ThemeDisplay />);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes .dark class when resolved theme is light", () => {
    localStorage.setItem(STORAGE_KEY, "light");
    renderWithProvider(<ThemeDisplay />);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("uses defaultTheme prop when localStorage is empty", () => {
    renderWithProvider(<ThemeDisplay />, "light");
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });
});

// ─── useTheme hook ───────────────────────────────────────────────────────────

describe("useTheme", () => {
  it("throws when used outside ThemeProvider", () => {
    // Suppress console.error for expected error
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<OrphanComponent />)).toThrow(
      "useTheme must be used within a <ThemeProvider>"
    );
    spy.mockRestore();
  });

  it("setTheme updates the theme preference", () => {
    renderWithProvider(<ThemeDisplay />);

    act(() => {
      fireEvent.click(screen.getByTestId("set-dark"));
    });

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("setTheme persists to localStorage", () => {
    renderWithProvider(<ThemeDisplay />);

    act(() => {
      fireEvent.click(screen.getByTestId("set-light"));
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
  });

  it("setTheme('light') removes .dark class", () => {
    // Start with dark
    localStorage.setItem(STORAGE_KEY, "dark");
    renderWithProvider(<ThemeDisplay />);

    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      fireEvent.click(screen.getByTestId("set-light"));
    });

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
  });

  it("toggleTheme switches from dark to light", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    renderWithProvider(<ThemeDisplay />);

    act(() => {
      fireEvent.click(screen.getByTestId("toggle"));
    });

    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
  });

  it("toggleTheme switches from light to dark", () => {
    localStorage.setItem(STORAGE_KEY, "light");
    renderWithProvider(<ThemeDisplay />);

    act(() => {
      fireEvent.click(screen.getByTestId("toggle"));
    });

    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("system theme resolves based on OS preference", () => {
    renderWithProvider(<ThemeDisplay />);

    // In jsdom, matchMedia defaults to light (no prefers-color-scheme: dark)
    // So system should resolve to "light"
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
    // resolvedTheme will be "light" because jsdom defaults to light
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
  });
});

// ─── Persistence ─────────────────────────────────────────────────────────────

describe("theme persistence", () => {
  it("persists dark theme to localStorage", () => {
    renderWithProvider(<ThemeDisplay />);

    act(() => {
      fireEvent.click(screen.getByTestId("set-dark"));
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("persists light theme to localStorage", () => {
    renderWithProvider(<ThemeDisplay />);

    act(() => {
      fireEvent.click(screen.getByTestId("set-light"));
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
  });

  it("persists system theme to localStorage", () => {
    renderWithProvider(<ThemeDisplay />);

    act(() => {
      fireEvent.click(screen.getByTestId("set-system"));
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("system");
  });

  it("restores theme from localStorage on remount", () => {
    localStorage.setItem(STORAGE_KEY, "dark");

    const { unmount } = renderWithProvider(<ThemeDisplay />);
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");

    unmount();
    document.documentElement.classList.remove("dark");

    renderWithProvider(<ThemeDisplay />);
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("ignores invalid localStorage values", () => {
    localStorage.setItem(STORAGE_KEY, "invalid-value");

    renderWithProvider(<ThemeDisplay />);
    // Should fall back to defaultTheme="system"
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
  });
});

// ─── getThemeScript ──────────────────────────────────────────────────────────

describe("getThemeScript", () => {
  it("returns a script string that sets dark class", () => {
    const script = getThemeScript();
    expect(script).toContain("localStorage.getItem");
    expect(script).toContain("smalda-theme");
    expect(script).toContain("classList.add");
    expect(script).toContain("prefers-color-scheme");
  });
});
