# Shared UI Component Library on Radix Primitives

**Date:** 2026-07-29
**Branch:** `feat/ui-component-library`
**Scope:** `frontend/components/ui/`, `frontend/lib/utils.ts`, `frontend/jest.config.js`, `frontend/package.json`

## Problem

`@radix-ui/react-slot`, `class-variance-authority`, `clsx`, and `tailwind-merge` are all declared in
`frontend/package.json` but are used by exactly zero files. Pages hand-roll their markup with
hardcoded Tailwind classes, so there is no consistent Button, Input, Card, Badge, Dialog, or Toast
to build on.

## Findings that amend the original issue

The issue text says "no `components/ui` directory exists yet." That is out of date. Four conditions
in the repository change what has to be built:

1. **`components/ui/` already exists** — it holds `card.tsx`, `table.tsx`, and `ReferenceCard.tsx`.
   `card.tsx` is imported by `app/(protected)/admin/activity/page.tsx` and
   `app/(protected)/admin/audit-logs/page.tsx`. Card is therefore a compatibility-constrained
   rewrite, not a new file.

2. **Radix Dialog and Toast primitives are not installed.** `node_modules/@radix-ui` contains only
   `react-slot` and its transitive `react-compose-refs`. `package-lock.json` has zero references to
   `@radix-ui/react-dialog`.

3. **Jest is broken at baseline — all 7 suites fail to run.** `msw` and `jest-axe` are declared in
   `package.json` but absent from `node_modules`; `@testing-library/user-event` is imported by
   `test-utils/component-test-example.test.tsx` but is not declared anywhere. Because
   `test-utils/test-setup.ts` imports the msw server and is wired into `setupFilesAfterEnv`, every
   suite dies on module resolution. No render test can pass until this is repaired.

4. **Theming is token-based, not `dark:`-based.** `app/globals.css` declares
   `@custom-variant dark (&:is(.dark *))` and a complete `.dark { … }` block of shadcn CSS
   variables. Semantic utilities such as `bg-card` and `text-card-foreground` already flip
   automatically; literal `dark:` pairs would bypass that system.

A fifth observation, recorded but deliberately not acted on: nothing in the application ever applies
the `.dark` class to `<html>`. The dark palette is defined but never activated.

## Decisions

| Question | Decision | Rationale |
|---|---|---|
| Radix dependency | Install `@radix-ui/react-dialog` only; hand-roll Toast | Radix Dialog supplies focus trap, portal, scroll lock, and ARIA wiring. `@radix-ui/react-toast` carries swipe/duration/viewport machinery this app has no need for, and shadcn has moved off it. |
| Test location | Co-locate under `components/ui/__tests__/`, extend `testMatch` | Conventional for a component library; keeps spec beside source. |
| Migration scope | Rewrite `card.tsx` in place, preserving export names. Leave `table.tsx` and `ReferenceCard.tsx` | Card is in the acceptance criteria; the other two are not. Preserving exports keeps the two admin pages working and gives them dark mode for free. |
| Theming | Semantic tokens throughout; explicit `dark:` only where no token exists | Reuses the system already built in `globals.css`, so component and page colors cannot drift. |
| Toast architecture | `ToastProvider` + `useToast()` hook + `<Toaster />` | Idiomatic React. No module-global state to reset between Jest tests. |

## Foundation

**`lib/utils.ts`** exports `cn`:

```ts
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

This is the first real use of `clsx` and `tailwind-merge` in the repo. It matters because
`tailwind-merge` resolves conflicts by Tailwind's own precedence rules, so a caller passing
`className="bg-red-500"` reliably overrides a variant's `bg-primary` instead of depending on
stylesheet order.

**Dependency and config changes:**

- Run `npm install` in `frontend/` to repair `node_modules` (restores `msw` and `jest-axe`, which
  alone unbreaks the 7 existing suites)
- Add `@radix-ui/react-dialog` to `dependencies`
- Add `@testing-library/user-event` to `devDependencies`
- Add `**/components/**/*.test.{ts,tsx}` to `testMatch` in `jest.config.js`, alongside the existing
  `**/test-utils/**/*.test.{ts,tsx}`

## Components

All files live in `frontend/components/ui/`. Every component uses `cva` for variants, `cn` for class
composition, `forwardRef` where it wraps a DOM element, and semantic color tokens.

### `button.tsx`

- `variant`: `default` | `secondary` | `outline` | `ghost` | `destructive`
- `size`: `sm` | `md` | `lg` | `icon`
- `asChild?: boolean` renders through Radix `Slot`, so a `Button` can become a `Link` without losing
  its styling
- Exports `Button` and `buttonVariants`
- Props: `ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean }`

### `input.tsx`

- `variant`: `default` | `error`
- `inputSize`: `sm` | `md` | `lg`

The size prop is named `inputSize`, not `size`, because the native `<input>` `size` attribute is a
`number`. The prop type is `Omit<InputHTMLAttributes<HTMLInputElement>, "size">` so the two cannot
collide. `variant="error"` also sets `aria-invalid`, keeping the visual and assistive-technology
signals in sync.

Exports `Input` and `inputVariants`.

### `card.tsx` (rewrite in place)

- `variant`: `default` | `outline` | `elevated`
- Preserves the exact existing export names: `Card`, `CardHeader`, `CardTitle`, `CardDescription`,
  `CardContent`
- Adds `CardFooter`
- Replaces `bg-white` / `border-gray-200` / `text-gray-500` with `bg-card` /
  `text-card-foreground` / `border-border` / `text-muted-foreground`

The two admin pages that import Card require no edits and gain dark-mode support.

### `badge.tsx`

- `variant`: `default` | `secondary` | `outline` | `destructive` | `success` | `warning`

`success` and `warning` are the only place in the library where explicit `dark:` utilities appear,
because `globals.css` defines no semantic token for either. Renders a `span`; no `asChild`.

Exports `Badge` and `badgeVariants`.

### `dialog.tsx`

A thin wrapper over `@radix-ui/react-dialog`. Radix owns focus trapping, Escape handling, scroll
lock, and `aria-modal` — none of that is reimplemented.

- `size` on `DialogContent`: `sm` | `md` | `lg` | `full`
- Exports `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogOverlay`, `DialogContent`,
  `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose`
- Enter/exit animations use `tw-animate-css`, already a devDependency

### `toast.tsx` and `use-toast.ts`

- `variant`: `default` | `success` | `destructive` | `warning`
- `ToastProvider` holds a `useReducer` queue with `ADD` / `DISMISS` / `REMOVE` actions
- Auto-dismiss defaults to **5000 ms**, overridable per toast via a `duration` field; passing
  `duration: 0` disables auto-dismiss so the toast persists until dismissed
- At most **3** toasts are visible at once; adding a fourth drops the oldest
- `useToast()` returns `{ toast, dismiss, toasts }`
- `<Toaster />` renders the viewport
- The viewport is `aria-live="polite"` by default; a `destructive` toast renders with `role="alert"`
  and assertive politeness so errors are announced immediately

Mounting requirement: `ToastProvider` and `Toaster` must be added to `app/layout.tsx` — the root
layout that owns `<html>`/`<body>` and `NextIntlClientProvider`. `app/[locale]/layout.tsx` is a
nested skip-link wrapper and is not the right mount point. Tests mount the provider directly and do
not depend on the app layout.

### `index.ts`

Barrel file re-exporting every component and its `*Variants` helper.

## Testing

Six specs at `components/ui/__tests__/<name>.test.tsx`, using `@testing-library/react` and the
existing Jest setup.

Each spec asserts:

1. The component renders and is findable by its accessible role
2. One variant produces the expected classes
3. A caller-supplied `className` wins over the variant class — this is the regression test for `cn`

Component-specific additions:

- **Button** — `asChild` renders the child element rather than a nested `<button>`
- **Input** — `variant="error"` sets `aria-invalid`
- **Dialog** — opens via its trigger, exposes `role="dialog"` with the title as accessible name, and
  closes on Escape
- **Toast** — provider plus consumer; firing a toast puts its text in the live region; dismissing
  removes it

## Non-goals

- `table.tsx` and `ReferenceCard.tsx` keep their hardcoded light-only styling
- No theme toggle or `.dark` class setter is added; the app still renders light-only at runtime
- Admin pages are not migrated beyond what Card's preserved API provides automatically
- The two test files in `frontend/__tests__/` remain unmatched by `testMatch` and continue not to
  run. This is a pre-existing condition unrelated to this work.

## Verification

Work is complete when, from `frontend/`:

- `npm test` runs and passes, including the 7 previously-broken suites and the 6 new specs
- `npm run typecheck` passes
- `npm run lint` passes
