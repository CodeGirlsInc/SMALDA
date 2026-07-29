# Shared UI Component Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `frontend/components/ui/` with Button, Input, Card, Badge, Dialog, and Toast — all cva-variant-driven, theme-aware, and covered by render tests.

**Architecture:** Every component uses `class-variance-authority` for variants and a new `cn()` helper (`twMerge(clsx(...))`) so caller-supplied `className` reliably beats variant classes. Colors come from the semantic CSS-variable tokens already declared in `app/globals.css`, which flip automatically under `.dark`. Dialog wraps `@radix-ui/react-dialog` so focus trapping and ARIA are not reimplemented; Toast is a small `useReducer` queue behind a provider + hook.

**Tech Stack:** Next.js 15.4.10 (App Router), React 19.1.0, TypeScript 5 (strict), Tailwind CSS v4, `class-variance-authority` 0.7.1, `tailwind-merge` 3.5.0, `clsx` 2.1.1, `@radix-ui/react-slot` 1.2.3, `@radix-ui/react-dialog` (to add), Jest 29 + `@testing-library/react` 16.

**Spec:** `docs/superpowers/specs/2026-07-29-ui-component-library-design.md`

**Working directory:** All commands run from `frontend/` unless stated otherwise.

---

## Deviations from the spec (decided during planning, deliberate)

1. **Toast reducer has two actions, not three.** The spec listed `ADD` / `DISMISS` / `REMOVE`. A separate `REMOVE` only earns its keep when there is an exit-animation delay between "user dismissed" and "unmount". We are not building exit animations, so `DISMISS` removes immediately and `REMOVE` would be dead code. YAGNI.
2. **The hook file is `use-toast.tsx`, not `use-toast.ts`.** It contains `ToastProvider`, which returns JSX.
3. **`testMatch` also gains a `lib/**` pattern**, so `cn()` can have a direct unit test. One extra line; `lib/` currently contains no test files, so nothing unexpected gets picked up.
4. **Destructive variants use `text-white`, not `text-destructive-foreground`.** `app/globals.css` declares `--destructive` but no `--destructive-foreground`, so that token does not exist.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `frontend/lib/utils.ts` | `cn()` — the single class-composition helper |
| `frontend/lib/__tests__/utils.test.ts` | Unit tests for `cn()` |
| `frontend/components/ui/button.tsx` | `Button`, `buttonVariants` |
| `frontend/components/ui/input.tsx` | `Input`, `inputVariants` |
| `frontend/components/ui/badge.tsx` | `Badge`, `badgeVariants` |
| `frontend/components/ui/dialog.tsx` | Radix Dialog wrapper, `dialogContentVariants` |
| `frontend/components/ui/use-toast.tsx` | Toast state: context, reducer, `ToastProvider`, `useToast` |
| `frontend/components/ui/toast.tsx` | Toast presentation: `Toast`, `Toaster`, `toastVariants` |
| `frontend/components/ui/index.ts` | Barrel export |
| `frontend/components/ui/__tests__/{button,input,card,badge,dialog,toast}.test.tsx` | One spec per component |

**Modify:**

| File | Change |
|---|---|
| `frontend/package.json` | Add `@radix-ui/react-dialog` dep, `@testing-library/user-event` devDep |
| `frontend/jest.config.js` | Extend `testMatch` with `components/**` and `lib/**` |
| `frontend/components/ui/card.tsx` | Rewrite with cva + tokens, **preserving all existing export names** |
| `frontend/app/layout.tsx` | Mount `ToastProvider` + `Toaster` |

**Do not touch:** `components/ui/table.tsx`, `components/ui/ReferenceCard.tsx`, `frontend/__tests__/`.

---

## Task 1: Repair the toolchain

Jest currently fails on all 7 suites because `node_modules` predates `msw`/`jest-axe` being added, and `@testing-library/user-event` is imported by an existing test but never declared. Nothing else in this plan can be verified until this is fixed.

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/jest.config.js:9`

- [ ] **Step 1: Confirm the baseline failure**

Run: `npm test 2>&1 | tail -5`

Expected: `Test Suites: 7 failed, 7 total` with `Cannot find module 'msw/node'`.

- [ ] **Step 2: Install the missing and new dependencies**

```bash
npm install @radix-ui/react-dialog
npm install --save-dev @testing-library/user-event
npm install
```

The bare `npm install` at the end restores `msw` and `jest-axe`, which are already declared but absent from `node_modules`.

- [ ] **Step 3: Verify the previously-broken suites now run**

Run: `npm test 2>&1 | tail -8`

Expected: all 7 suites now *execute* — no `Cannot find module` errors remain. The likely result is `Test Suites: 7 passed, 7 total`, but these suites have never run in this working copy, so a genuine assertion failure is possible.

If a suite fails on an **actual assertion**, record it in your task notes as a pre-existing failure and continue — fixing pre-existing product bugs is out of scope for this plan. Note the exact suite name so the final count in Task 9 can account for it. If the failure is another missing module, install that module instead and re-run.

- [ ] **Step 4: Extend `testMatch`**

In `frontend/jest.config.js`, replace line 9:

```js
  testMatch: ["**/test-utils/**/*.test.{ts,tsx}"],
```

with:

```js
  testMatch: [
    "**/test-utils/**/*.test.{ts,tsx}",
    "**/components/**/*.test.{ts,tsx}",
    "**/lib/**/*.test.{ts,tsx}",
  ],
```

- [ ] **Step 5: Verify testMatch change picked up no surprises**

Run: `npx jest --listTests`

Expected: the same 7 files as before and no others. (`frontend/__tests__/` is intentionally still unmatched — it sits at the project root, not under `components/` or `lib/`.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json jest.config.js
git commit -m "chore(frontend): repair jest deps and widen testMatch for components

Restores msw and jest-axe to node_modules, declares the previously
undeclared @testing-library/user-event, and adds @radix-ui/react-dialog
for the upcoming Dialog component. All 7 suites run again."
```

---

## Task 2: The `cn` class-composition helper

**Files:**
- Create: `frontend/lib/utils.ts`
- Test: `frontend/lib/__tests__/utils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/lib/__tests__/utils.test.ts`:

```ts
import { cn } from "../utils";

describe("cn", () => {
  it("joins plain class strings", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("supports conditional object syntax", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });

  it("lets a later Tailwind class win over an earlier conflicting one", () => {
    expect(cn("bg-primary", "bg-red-500")).toBe("bg-red-500");
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("keeps non-conflicting Tailwind classes", () => {
    expect(cn("rounded-md bg-primary", "text-sm")).toBe("rounded-md bg-primary text-sm");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest lib/__tests__/utils.test.ts`

Expected: FAIL — `Cannot find module '../utils'`.

- [ ] **Step 3: Write the implementation**

Create `frontend/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compose Tailwind class names.
 *
 * `clsx` flattens conditionals and arrays; `twMerge` then resolves conflicts
 * using Tailwind's own precedence rules, so the last class wins regardless of
 * stylesheet order. This is what lets a caller's `className` override a
 * component's cva variant classes.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest lib/__tests__/utils.test.ts`

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts lib/__tests__/utils.test.ts
git commit -m "feat(frontend): add cn class-composition helper

First actual use of clsx and tailwind-merge, both already declared as
dependencies. Gives components a way to let caller className win over
cva variant classes."
```

---

## Task 3: Button

**Files:**
- Create: `frontend/components/ui/button.tsx`
- Test: `frontend/components/ui/__tests__/button.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/components/ui/__tests__/button.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "../button";

describe("Button", () => {
  it("renders as a button with its label as accessible name", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("applies the default variant and size classes", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveClass("bg-primary", "text-primary-foreground", "h-10");
  });

  it("applies the destructive variant classes", () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("bg-destructive");
  });

  it("applies the requested size", () => {
    render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button", { name: "Small" })).toHaveClass("h-8");
  });

  it("lets a caller className override the variant background", () => {
    render(<Button className="bg-red-500">Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveClass("bg-red-500");
    expect(button).not.toHaveClass("bg-primary");
  });

  it("renders the child element instead of a button when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/docs">Docs</a>
      </Button>
    );
    const link = screen.getByRole("link", { name: "Docs" });
    expect(link).toHaveClass("bg-primary");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("forwards a ref to the underlying button", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Save</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest components/ui/__tests__/button.test.tsx`

Expected: FAIL — `Cannot find module '../button'`.

- [ ] **Step 3: Write the implementation**

Create `frontend/components/ui/button.tsx`:

```tsx
"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline:
          "border border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        ghost: "bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        // globals.css defines --destructive but no --destructive-foreground,
        // so the readable pairing is an explicit white.
        destructive: "bg-destructive text-white hover:bg-destructive/90",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-11 px-6 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the single child element instead of a `<button>`, keeping Button's styling. */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        // Only a real <button> gets a type; Slot may render an <a>, where type is invalid.
        {...(asChild ? {} : { type: type ?? "button" })}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest components/ui/__tests__/button.test.tsx`

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add components/ui/button.tsx components/ui/__tests__/button.test.tsx
git commit -m "feat(ui): add Button with cva variants and asChild support

Five variants, four sizes, Radix Slot for asChild, semantic color tokens
so it themes with the .dark palette in globals.css."
```

---

## Task 4: Input

**Files:**
- Create: `frontend/components/ui/input.tsx`
- Test: `frontend/components/ui/__tests__/input.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/components/ui/__tests__/input.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "../input";

describe("Input", () => {
  it("renders a textbox", () => {
    render(<Input aria-label="Email" />);
    expect(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument();
  });

  it("defaults to type=text and the md size", () => {
    render(<Input aria-label="Email" />);
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveClass("h-10", "border-input");
  });

  it("applies the requested size", () => {
    render(<Input aria-label="Email" inputSize="lg" />);
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveClass("h-11");
  });

  it("marks the field invalid when variant is error", () => {
    render(<Input aria-label="Email" variant="error" />);
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveClass("border-destructive");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("does not set aria-invalid on the default variant", () => {
    render(<Input aria-label="Email" />);
    expect(screen.getByRole("textbox", { name: "Email" })).not.toHaveAttribute("aria-invalid");
  });

  it("lets an explicit aria-invalid override the variant default", () => {
    render(<Input aria-label="Email" variant="error" aria-invalid={false} />);
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("aria-invalid", "false");
  });

  it("lets a caller className override the variant border", () => {
    render(<Input aria-label="Email" className="border-green-500" />);
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveClass("border-green-500");
    expect(input).not.toHaveClass("border-input");
  });

  it("accepts typed text", async () => {
    const user = userEvent.setup();
    render(<Input aria-label="Email" />);
    const input = screen.getByRole("textbox", { name: "Email" });
    await user.type(input, "ada@example.com");
    expect(input).toHaveValue("ada@example.com");
  });

  it("forwards a ref to the underlying input", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input aria-label="Email" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest components/ui/__tests__/input.test.tsx`

Expected: FAIL — `Cannot find module '../input'`.

- [ ] **Step 3: Write the implementation**

Create `frontend/components/ui/input.tsx`:

```tsx
"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full rounded-md border bg-background text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:font-medium",
  {
    variants: {
      variant: {
        default: "border-input focus-visible:ring-ring",
        error: "border-destructive focus-visible:ring-destructive",
      },
      inputSize: {
        sm: "h-8 px-2 py-1 text-xs",
        md: "h-10 px-3 py-2 text-sm",
        lg: "h-11 px-4 py-2 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      inputSize: "md",
    },
  }
);

export interface InputProps
  // The native `size` attribute is a number and would collide with a string
  // variant prop, so the size variant is exposed as `inputSize`.
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, variant, inputSize, type = "text", "aria-invalid": ariaInvalid, ...props },
    ref
  ) => (
    <input
      ref={ref}
      type={type}
      // Keep the visual error state and the assistive-technology state in sync,
      // unless the caller says otherwise.
      aria-invalid={ariaInvalid ?? (variant === "error" || undefined)}
      className={cn(inputVariants({ variant, inputSize }), className)}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input, inputVariants };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest components/ui/__tests__/input.test.tsx`

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add components/ui/input.tsx components/ui/__tests__/input.test.tsx
git commit -m "feat(ui): add Input with error variant wired to aria-invalid

Size variant is named inputSize because the native input size attribute
is a number and would collide."
```

---

## Task 5: Card (rewrite in place)

`components/ui/card.tsx` already exists and is imported by `app/(protected)/admin/activity/page.tsx:1` and `app/(protected)/admin/audit-logs/page.tsx:1-2`. **All five existing export names must survive**, and the existing padding values (`p-5`, `p-5 pb-0`) must be preserved so the admin pages do not shift visually. Only the colors change (hardcoded grays become semantic tokens) plus a new `variant` prop and a new `CardFooter`.

**Files:**
- Modify: `frontend/components/ui/card.tsx` (full rewrite, same exports)
- Test: `frontend/components/ui/__tests__/card.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/components/ui/__tests__/card.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../card";

describe("Card", () => {
  it("renders its children", () => {
    render(<Card>Body</Card>);
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("applies theme-aware token classes rather than hardcoded grays", () => {
    render(<Card data-testid="card">Body</Card>);
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("bg-card", "text-card-foreground", "border-border");
    expect(card).not.toHaveClass("bg-white");
    expect(card).not.toHaveClass("border-gray-200");
  });

  it("applies the elevated variant", () => {
    render(
      <Card data-testid="card" variant="elevated">
        Body
      </Card>
    );
    expect(screen.getByTestId("card")).toHaveClass("shadow-md");
  });

  it("applies the outline variant without a card background", () => {
    render(
      <Card data-testid="card" variant="outline">
        Body
      </Card>
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("bg-transparent");
    expect(card).not.toHaveClass("bg-card");
  });

  it("lets a caller className override the variant background", () => {
    render(
      <Card data-testid="card" className="bg-red-500">
        Body
      </Card>
    );
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("bg-red-500");
    expect(card).not.toHaveClass("bg-card");
  });

  it("renders CardTitle as a heading", () => {
    render(<CardTitle>Recent activity</CardTitle>);
    expect(screen.getByRole("heading", { name: "Recent activity" })).toBeInTheDocument();
  });

  it("renders CardDescription with muted token color", () => {
    render(<CardDescription data-testid="desc">Last 30 days</CardDescription>);
    const desc = screen.getByTestId("desc");
    expect(desc).toHaveTextContent("Last 30 days");
    expect(desc).toHaveClass("text-muted-foreground");
    expect(desc).not.toHaveClass("text-gray-500");
  });

  it("preserves the original header and content padding", () => {
    render(
      <>
        <CardHeader data-testid="header">H</CardHeader>
        <CardContent data-testid="content">C</CardContent>
      </>
    );
    expect(screen.getByTestId("header")).toHaveClass("p-5", "pb-0");
    expect(screen.getByTestId("content")).toHaveClass("p-5");
  });

  it("composes the full set of subcomponents", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    );
    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest components/ui/__tests__/card.test.tsx`

Expected: FAIL — the current `card.tsx` exports no `CardFooter` and no `variant` prop, so both the import and several class assertions fail.

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `frontend/components/ui/card.tsx`:

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-lg text-card-foreground", {
  variants: {
    variant: {
      default: "border border-border bg-card",
      outline: "border border-border bg-transparent",
      elevated: "border border-border bg-card shadow-md",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
  )
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-5 pb-0", className)} {...props} />
  )
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
  )
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-5", className)} {...props} />
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-5 pt-0", className)} {...props} />
  )
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest components/ui/__tests__/card.test.tsx`

Expected: PASS, 9 tests.

- [ ] **Step 5: Verify the existing consumers still typecheck**

Run: `npm run typecheck`

Expected: no output, exit 0. This is the guard that the two admin pages importing `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent` still compile.

- [ ] **Step 6: Commit**

```bash
git add components/ui/card.tsx components/ui/__tests__/card.test.tsx
git commit -m "feat(ui): rewrite Card with cva variants and semantic tokens

Swaps bg-white/border-gray-200/text-gray-500 for bg-card/border-border/
text-muted-foreground, adds default|outline|elevated variants and
CardFooter. All previous export names and padding values are preserved,
so the two admin pages importing Card need no changes and gain dark mode."
```

---

## Task 6: Badge

**Files:**
- Create: `frontend/components/ui/badge.tsx`
- Test: `frontend/components/ui/__tests__/badge.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/components/ui/__tests__/badge.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { Badge } from "../badge";

describe("Badge", () => {
  it("renders its children", () => {
    render(<Badge>Verified</Badge>);
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("applies the default variant classes", () => {
    render(<Badge data-testid="badge">Verified</Badge>);
    expect(screen.getByTestId("badge")).toHaveClass("bg-primary", "text-primary-foreground");
  });

  it("applies the secondary variant", () => {
    render(
      <Badge data-testid="badge" variant="secondary">
        Draft
      </Badge>
    );
    expect(screen.getByTestId("badge")).toHaveClass("bg-secondary", "text-secondary-foreground");
  });

  it("applies the destructive variant", () => {
    render(
      <Badge data-testid="badge" variant="destructive">
        Flagged
      </Badge>
    );
    expect(screen.getByTestId("badge")).toHaveClass("bg-destructive");
  });

  it("gives the success variant an explicit dark-mode pairing", () => {
    render(
      <Badge data-testid="badge" variant="success">
        Approved
      </Badge>
    );
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("bg-green-100", "text-green-800");
    expect(badge).toHaveClass("dark:bg-green-950", "dark:text-green-300");
  });

  it("gives the warning variant an explicit dark-mode pairing", () => {
    render(
      <Badge data-testid="badge" variant="warning">
        Pending
      </Badge>
    );
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("bg-amber-100", "text-amber-800");
    expect(badge).toHaveClass("dark:bg-amber-950", "dark:text-amber-300");
  });

  it("applies the outline variant without a filled background", () => {
    render(
      <Badge data-testid="badge" variant="outline">
        Neutral
      </Badge>
    );
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("border-border", "text-foreground");
    expect(badge).not.toHaveClass("bg-primary");
  });

  it("lets a caller className override the variant background", () => {
    render(
      <Badge data-testid="badge" className="bg-red-500">
        Verified
      </Badge>
    );
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveClass("bg-red-500");
    expect(badge).not.toHaveClass("bg-primary");
  });

  it("renders a span element", () => {
    render(<Badge data-testid="badge">Verified</Badge>);
    expect(screen.getByTestId("badge").tagName).toBe("SPAN");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest components/ui/__tests__/badge.test.tsx`

Expected: FAIL — `Cannot find module '../badge'`.

- [ ] **Step 3: Write the implementation**

Create `frontend/components/ui/badge.tsx`:

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border bg-transparent text-foreground",
        destructive: "border-transparent bg-destructive text-white",
        // globals.css has no success/warning tokens, so these two are the only
        // variants in the library that need explicit dark: pairings.
        success:
          "border-transparent bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
        warning:
          "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  )
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest components/ui/__tests__/badge.test.tsx`

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add components/ui/badge.tsx components/ui/__tests__/badge.test.tsx
git commit -m "feat(ui): add Badge with six status variants

success and warning carry explicit dark: pairings because globals.css
defines no semantic token for either."
```

---

## Task 7: Dialog

Wraps `@radix-ui/react-dialog`. Radix owns focus trapping, Escape handling, scroll lock, and `aria-modal` — do not reimplement any of it.

**Note on jsdom:** Radix renders the dialog into a portal attached to `document.body`. Testing Library queries `document.body` by default, so `screen.getByRole("dialog")` finds it without extra configuration. Radix logs a console warning if `DialogContent` has no description, which is why `DialogDescription` appears in the test fixture.

**Files:**
- Create: `frontend/components/ui/dialog.tsx`
- Test: `frontend/components/ui/__tests__/dialog.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/components/ui/__tests__/dialog.test.tsx`:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "../dialog";

function Fixture({ size }: { size?: "sm" | "md" | "lg" | "full" }) {
  return (
    <Dialog>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>Delete document</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("renders the trigger and keeps the dialog closed initially", () => {
    render(<Fixture />);
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on trigger click with the title as accessible name", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog", { name: "Delete document" })).toBeInTheDocument();
  });

  it("renders the description inside the open dialog", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByText("This action cannot be undone.")).toBeInTheDocument();
  });

  it("closes when Escape is pressed", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes when DialogClose is activated", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("applies the default md size class", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog")).toHaveClass("max-w-lg");
  });

  it("applies the requested size class", async () => {
    const user = userEvent.setup();
    render(<Fixture size="sm" />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog")).toHaveClass("max-w-sm");
  });

  it("styles the content with theme tokens", async () => {
    const user = userEvent.setup();
    render(<Fixture />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog")).toHaveClass("bg-background", "text-foreground");
  });

  it("lets a caller className override the content max width", async () => {
    const user = userEvent.setup();
    render(
      <Dialog defaultOpen>
        <DialogContent className="max-w-3xl">
          <DialogTitle>Titled</DialogTitle>
          <DialogDescription>Described</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveClass("max-w-3xl");
    expect(dialog).not.toHaveClass("max-w-lg");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest components/ui/__tests__/dialog.test.tsx`

Expected: FAIL — `Cannot find module '../dialog'`.

- [ ] **Step 3: Write the implementation**

Create `frontend/components/ui/dialog.tsx`:

```tsx
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const dialogContentVariants = cva(
  "fixed left-1/2 top-1/2 z-50 grid w-full -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-background p-6 text-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
  {
    variants: {
      size: {
        sm: "max-w-sm",
        md: "max-w-lg",
        lg: "max-w-2xl",
        full: "max-w-[calc(100vw-2rem)]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    VariantProps<typeof dialogContentVariants> {}

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, size, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(dialogContentVariants({ size }), className)}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 text-left", className)} {...props} />;
}
DialogHeader.displayName = "DialogHeader";

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  dialogContentVariants,
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest components/ui/__tests__/dialog.test.tsx`

Expected: PASS, 9 tests.

If `user.click` on the trigger throws about `hasPointerCapture` or `PointerEvent` (a known jsdom gap that affects some Radix primitives), substitute `fireEvent.click(screen.getByRole("button", { name: "Open" }))` from `@testing-library/react` for that interaction and note the substitution in your task notes. Do not add jsdom polyfills to `test-setup.ts` — that file is shared by every suite.

- [ ] **Step 5: Commit**

```bash
git add components/ui/dialog.tsx components/ui/__tests__/dialog.test.tsx
git commit -m "feat(ui): add Dialog wrapping @radix-ui/react-dialog

Radix supplies focus trap, escape handling, scroll lock and aria-modal.
Adds four content sizes via cva plus tw-animate-css enter/exit classes."
```

---

## Task 8: Toast

Split across two files: `use-toast.tsx` owns state, `toast.tsx` owns presentation.

**Files:**
- Create: `frontend/components/ui/use-toast.tsx`
- Create: `frontend/components/ui/toast.tsx`
- Test: `frontend/components/ui/__tests__/toast.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/components/ui/__tests__/toast.test.tsx`:

```tsx
import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast, type ToastOptions } from "../use-toast";
import { Toaster } from "../toast";

function Harness({ options }: { options?: ToastOptions }) {
  const { toast } = useToast();
  return <button onClick={() => toast(options ?? { title: "Saved" })}>Fire</button>;
}

function renderToasts(options?: ToastOptions) {
  return render(
    <ToastProvider>
      <Harness options={options} />
      <Toaster />
    </ToastProvider>
  );
}

describe("Toast", () => {
  it("renders an empty polite live region before any toast fires", () => {
    renderToasts();
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toBeEmptyDOMElement();
  });

  it("shows a toast title after firing", async () => {
    const user = userEvent.setup();
    renderToasts();
    await user.click(screen.getByRole("button", { name: "Fire" }));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("shows the description when provided", async () => {
    const user = userEvent.setup();
    renderToasts({ title: "Saved", description: "Your document was stored." });
    await user.click(screen.getByRole("button", { name: "Fire" }));
    expect(await screen.findByText("Your document was stored.")).toBeInTheDocument();
  });

  it("applies the success variant classes", async () => {
    const user = userEvent.setup();
    renderToasts({ title: "Saved", variant: "success" });
    await user.click(screen.getByRole("button", { name: "Fire" }));
    const toast = await screen.findByTestId("toast");
    expect(toast).toHaveClass("bg-green-100", "text-green-900");
    expect(toast).toHaveClass("dark:bg-green-950", "dark:text-green-100");
  });

  it("announces a destructive toast assertively", async () => {
    const user = userEvent.setup();
    renderToasts({ title: "Upload failed", variant: "destructive" });
    await user.click(screen.getByRole("button", { name: "Fire" }));
    const toast = await screen.findByTestId("toast");
    expect(toast).toHaveAttribute("role", "alert");
    expect(toast).toHaveAttribute("aria-live", "assertive");
  });

  it("removes the toast when its close button is clicked", async () => {
    const user = userEvent.setup();
    renderToasts();
    await user.click(screen.getByRole("button", { name: "Fire" }));
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("auto-dismisses after the default 5000ms", async () => {
    jest.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderToasts();
      await user.click(screen.getByRole("button", { name: "Fire" }));
      expect(screen.getByText("Saved")).toBeInTheDocument();
      act(() => {
        jest.advanceTimersByTime(5000);
      });
      expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("does not auto-dismiss when duration is 0", async () => {
    jest.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderToasts({ title: "Sticky", duration: 0 });
      await user.click(screen.getByRole("button", { name: "Fire" }));
      act(() => {
        jest.advanceTimersByTime(60_000);
      });
      expect(screen.getByText("Sticky")).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("keeps at most three toasts, dropping the oldest", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Counter />
        <Toaster />
      </ToastProvider>
    );
    const fire = screen.getByRole("button", { name: "Fire" });
    for (let i = 0; i < 4; i++) {
      await user.click(fire);
    }
    expect(screen.getAllByTestId("toast")).toHaveLength(3);
    expect(screen.queryByText("Toast 0")).not.toBeInTheDocument();
    expect(screen.getByText("Toast 3")).toBeInTheDocument();
  });

  it("throws a helpful error when useToast is used outside the provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<Harness />)).toThrow(/useToast must be used within a ToastProvider/);
    } finally {
      spy.mockRestore();
    }
  });
});

function Counter() {
  const { toast } = useToast();
  const n = React.useRef(0);
  return <button onClick={() => toast({ title: `Toast ${n.current++}` })}>Fire</button>;
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest components/ui/__tests__/toast.test.tsx`

Expected: FAIL — `Cannot find module '../use-toast'`.

- [ ] **Step 3: Write the state module**

Create `frontend/components/ui/use-toast.tsx`:

```tsx
"use client";

import * as React from "react";

export type ToastVariant = "default" | "success" | "destructive" | "warning";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss. `0` keeps the toast until dismissed. */
  duration?: number;
}

export interface ToastRecord extends ToastOptions {
  id: string;
}

export const TOAST_DEFAULT_DURATION = 5000;
export const TOAST_MAX_VISIBLE = 3;

type ToastAction =
  | { type: "ADD"; toast: ToastRecord }
  | { type: "DISMISS"; id: string };

function toastReducer(state: ToastRecord[], action: ToastAction): ToastRecord[] {
  switch (action.type) {
    case "ADD":
      // Newest wins: keep only the most recent TOAST_MAX_VISIBLE entries.
      return [...state, action.toast].slice(-TOAST_MAX_VISIBLE);
    case "DISMISS":
      return state.filter((toast) => toast.id !== action.id);
  }
}

interface ToastContextValue {
  toasts: ToastRecord[];
  /** Queue a toast. Returns its id so the caller can dismiss it early. */
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = React.useReducer(toastReducer, []);
  const nextId = React.useRef(0);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    dispatch({ type: "DISMISS", id });
  }, []);

  const toast = React.useCallback(
    (options: ToastOptions) => {
      const id = `toast-${nextId.current++}`;
      dispatch({ type: "ADD", toast: { ...options, id } });

      const duration = options.duration ?? TOAST_DEFAULT_DURATION;
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration)
        );
      }
      return id;
    },
    [dismiss]
  );

  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = React.useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (context === null) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
```

- [ ] **Step 4: Write the presentation module**

Create `frontend/components/ui/toast.tsx`:

```tsx
"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useToast, type ToastRecord } from "./use-toast";

const toastVariants = cva(
  "pointer-events-auto flex w-full items-start gap-3 rounded-lg border p-4 shadow-lg",
  {
    variants: {
      variant: {
        default: "border-border bg-background text-foreground",
        success:
          "border-green-300 bg-green-100 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100",
        destructive: "border-transparent bg-destructive text-white",
        warning:
          "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface ToastProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof toastVariants> {
  title: string;
  description?: string;
  onDismiss?: () => void;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant, title, description, onDismiss, ...props }, ref) => {
    const isError = variant === "destructive";
    return (
      <div
        ref={ref}
        data-testid="toast"
        // Errors interrupt; everything else waits for a pause in speech.
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        className={cn(toastVariants({ variant }), className)}
        {...props}
      >
        <div className="flex-1">
          <p className="text-sm font-semibold">{title}</p>
          {description ? <p className="mt-1 text-sm opacity-90">{description}</p> : null}
        </div>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="shrink-0 rounded-md px-1 text-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ×
          </button>
        ) : null}
      </div>
    );
  }
);
Toast.displayName = "Toast";

/**
 * Renders the toast viewport. Mount once, inside a ToastProvider.
 *
 * The outer region is a permanently-present live region so that assistive
 * technology observes additions to it; individual toasts also carry their own
 * role for their severity.
 */
function Toaster({ className }: { className?: string }) {
  const { toasts, dismiss } = useToast();
  return (
    <div
      role="status"
      aria-live="polite"
      aria-relevant="additions text"
      className={cn(
        "pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2",
        className
      )}
    >
      {toasts.map((toast: ToastRecord) => (
        <Toast
          key={toast.id}
          title={toast.title}
          description={toast.description}
          variant={toast.variant}
          onDismiss={() => dismiss(toast.id)}
        />
      ))}
    </div>
  );
}
Toaster.displayName = "Toaster";

export { Toast, Toaster, toastVariants };
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest components/ui/__tests__/toast.test.tsx`

Expected: PASS, 10 tests.

The "empty live region" assertion depends on `Toaster` rendering its container even with zero toasts — that is intentional, because a live region added to the DOM at the same time as its content is often not announced.

- [ ] **Step 6: Commit**

```bash
git add components/ui/use-toast.tsx components/ui/toast.tsx components/ui/__tests__/toast.test.tsx
git commit -m "feat(ui): add Toast provider, useToast hook and Toaster viewport

useReducer queue capped at 3 visible toasts, 5000ms default auto-dismiss
overridable per toast (0 disables). Destructive toasts announce
assertively via role=alert; everything else is polite."
```

---

## Task 9: Barrel export, app wiring, and full verification

**Files:**
- Create: `frontend/components/ui/index.ts`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Create the barrel export**

Create `frontend/components/ui/index.ts`:

```ts
export { Button, buttonVariants, type ButtonProps } from "./button";
export { Input, inputVariants, type InputProps } from "./input";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  cardVariants,
  type CardProps,
} from "./card";
export { Badge, badgeVariants, type BadgeProps } from "./badge";
export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
  dialogContentVariants,
  type DialogContentProps,
} from "./dialog";
export { Toast, Toaster, toastVariants, type ToastProps } from "./toast";
export {
  ToastProvider,
  useToast,
  TOAST_DEFAULT_DURATION,
  TOAST_MAX_VISIBLE,
  type ToastOptions,
  type ToastRecord,
  type ToastVariant,
} from "./use-toast";
```

- [ ] **Step 2: Mount the toast provider in the root layout**

`app/layout.tsx` is the root layout that owns `<html>`/`<body>` and `NextIntlClientProvider`. Add the import alongside the existing ones:

```tsx
import { ToastProvider } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toast";
```

Then wrap the existing `NextIntlClientProvider` block so it reads:

```tsx
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ToastProvider>
            {children}
            <Toaster />
          </ToastProvider>
        </NextIntlClientProvider>
```

`ToastProvider` is a client component; mounting it inside this async server layout is fine because it only wraps `children`.

- [ ] **Step 3: Verify the barrel export typechecks**

Run: `npm run typecheck`

Expected: no output, exit 0.

- [ ] **Step 4: Run the whole suite**

Run: `npm test 2>&1 | tail -8`

Expected: `Test Suites: 14 passed, 14 total` — the 7 pre-existing suites plus 7 new spec files (`lib/__tests__/utils.test.ts` and one each for button, input, card, badge, dialog, toast).

If Task 1 Step 3 recorded a pre-existing assertion failure, the expected line is `13 passed, 1 failed, 14 total` and the failing suite must be the one you recorded there — no new failures.

- [ ] **Step 5: Run lint**

Run: `npm run lint`

Expected: `✔ No ESLint warnings or errors`.

If lint objects to the empty interfaces `InputProps`, `CardProps`, `BadgeProps` (`@typescript-eslint/no-empty-object-type`), convert that declaration to a type alias instead of disabling the rule, e.g.:

```ts
export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> &
  VariantProps<typeof inputVariants>;
```

- [ ] **Step 6: Commit**

```bash
git add components/ui/index.ts app/layout.tsx
git commit -m "feat(ui): add components/ui barrel and mount ToastProvider

Wires ToastProvider and Toaster into the root layout so useToast works
anywhere in the app."
```

- [ ] **Step 7: Final verification against acceptance criteria**

Confirm each of these by running the command, not by inspection:

```bash
npm test          # all suites pass, including one render spec per component
npm run typecheck # exit 0
npm run lint      # exit 0
```

Then confirm by reading the files:
- `components/ui/` contains `button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`, `dialog.tsx`, `toast.tsx`
- every one of them imports `cva` and `cn`
- every color class is either a semantic token or carries an explicit `dark:` pairing — grep for stragglers: `grep -nE "bg-white|border-gray-|text-gray-" components/ui/{button,input,card,badge,dialog,toast}.tsx` should return nothing
- every component exports a `VariantProps`-derived props interface

---

## Notes for the implementer

- **Do not add jsdom polyfills to `test-utils/test-setup.ts`.** That file runs for all 14 suites; a change there can break unrelated tests.
- **Do not modify `components/ui/table.tsx` or `components/ui/ReferenceCard.tsx`.** They are deliberately out of scope and still light-only.
- **The app has no theme toggle.** Nothing applies `.dark` to `<html>`, so these components will render light-only at runtime even though they are correctly theme-aware. That is expected and is separate work.
- **`npm run check:hardcoded`** may emit advisory warnings about strings in the new files. It exits 0 by design and does not gate CI.
