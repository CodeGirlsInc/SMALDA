import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "./useTheme";
import ThemeToggle from "./ThemeToggle";

const STORAGE_KEY = "smalda-theme";

function renderToggle(variant: "icon" | "segmented" = "icon") {
  return render(
    <ThemeProvider defaultTheme="light">
      <ThemeToggle variant={variant} />
    </ThemeProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("dark");
});

// ─── Icon variant ────────────────────────────────────────────────────────────

describe("ThemeToggle (icon variant)", () => {
  it("renders a button with accessible label", () => {
    renderToggle();
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label");
  });

  it("has at least 44x44px touch target", () => {
    renderToggle();
    const button = screen.getByRole("button");
    expect(button.className).toContain("min-w-[44px]");
    expect(button.className).toContain("min-h-[44px]");
  });

  it("toggles from light to dark on click", () => {
    renderToggle();

    act(() => {
      fireEvent.click(screen.getByRole("button"));
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("toggles from dark to system on click", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    renderToggle();

    // After mount it reads "dark" from storage
    act(() => {
      fireEvent.click(screen.getByRole("button"));
    });

    // Toggling from dark should go to system
    expect(localStorage.getItem(STORAGE_KEY)).toBe("system");
  });

  it("updates aria-label when theme changes", () => {
    renderToggle();
    const button = screen.getByRole("button");
    const initialLabel = button.getAttribute("aria-label");

    act(() => {
      fireEvent.click(button);
    });

    // Label should change after toggle
    expect(button.getAttribute("aria-label")).not.toBe(initialLabel);
  });

  it("shows Sun icon for light theme", () => {
    renderToggle();
    // Sun should be visible (opacity-100) when theme is light
    const button = screen.getByRole("button");
    const sunSpan = button.querySelector('[aria-hidden="false"]');
    expect(sunSpan).toBeInTheDocument();
  });
});

// ─── Segmented variant ───────────────────────────────────────────────────────

describe("ThemeToggle (segmented variant)", () => {
  it("renders a radiogroup with three options", () => {
    renderToggle("segmented");
    const radioGroup = screen.getByRole("radiogroup");
    expect(radioGroup).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(3);
  });

  it("marks light as checked by default", () => {
    renderToggle("segmented");
    const lightRadio = screen.getByRole("radio", { name: "Light" });
    expect(lightRadio).toHaveAttribute("aria-checked", "true");
  });

  it("switches to dark when Dark is clicked", () => {
    renderToggle("segmented");

    act(() => {
      fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    });

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("switches to system when System is clicked", () => {
    renderToggle("segmented");

    act(() => {
      fireEvent.click(screen.getByRole("radio", { name: "System" }));
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("system");
  });

  it("updates aria-checked states when selection changes", () => {
    renderToggle("segmented");

    act(() => {
      fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    });

    const darkRadio = screen.getByRole("radio", { name: "Dark" });
    const lightRadio = screen.getByRole("radio", { name: "Light" });
    expect(darkRadio).toHaveAttribute("aria-checked", "true");
    expect(lightRadio).toHaveAttribute("aria-checked", "false");
  });

  it("persists selection to localStorage", () => {
    renderToggle("segmented");

    act(() => {
      fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("dark");

    act(() => {
      fireEvent.click(screen.getByRole("radio", { name: "Light" }));
    });

    expect(localStorage.getItem(STORAGE_KEY)).toBe("light");
  });
});
