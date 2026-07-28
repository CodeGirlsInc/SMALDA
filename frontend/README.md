# SMALDA Frontend

Next.js 15 application with React 19, next-intl for i18n, and Tailwind CSS v4.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
frontend/
├── app/                    # Next.js App Router
│   ├── (protected)/        # Auth-protected route group
│   │   ├── admin/          # Admin-only pages
│   │   └── documents/      # Document management pages
│   ├── [locale]/           # Locale-aware layout wrapper
│   ├── layout.tsx          # Root layout
│   ├── globals.css         # Global styles
│   └── global-error.tsx    # Global error boundary
├── components/             # Shared React components
│   ├── ui/                 # Primitives (buttons, inputs, cards)
│   ├── map/                # Map-related components
│   ├── safe-text.tsx       # Safe text rendering
│   ├── safe-link.tsx       # Safe URL rendering
│   ├── safe-document-content.tsx  # Document content renderer
│   ├── Skeleton.tsx        # Loading skeleton
│   └── LanguageSwitcher.tsx # i18n language switcher
├── lib/                    # Utilities
│   ├── sanitize.ts         # HTML/URL sanitization
│   └── client-storage.ts   # Safe localStorage helpers
├── __tests__/              # Unit tests
├── i18n/                   # Internationalization config
├── messages/               # Translation JSON files
├── types/                  # TypeScript type definitions
├── public/                 # Static assets
└── e2e/                    # Playwright E2E tests
```

## Component Conventions

### Directory Structure

Components follow a three-tier organization:

1. **Primitives** (`components/ui/`) — Atomic UI elements: `Button`, `Input`, `Card`, `Dialog`. These have no business logic and accept only UI props.

2. **Composed Components** (`components/`) — Combinations of primitives for common patterns: `SafeText`, `SafeLink`, `SafeDocumentContent`, `Skeleton`, `LanguageSwitcher`.

3. **Feature Components** (`app/(protected)/`) — Page-specific components co-located with their routes.

### Naming

- Files: `kebab-case.tsx` (e.g., `safe-text.tsx`)
- Components: `PascalCase` export (e.g., `export function SafeText()`)
- Use named exports, not default exports
- One component per file

### File Structure

```tsx
import { ... } from "...";

interface ComponentProps {
  // Props with JSDoc when non-obvious
}

export function ComponentName({ prop1, prop2 }: ComponentProps) {
  return <div>...</div>;
}
```

### Styling

- Use Tailwind CSS utility classes
- Use `class-variance-authority` (cva) for component variants
- Use `clsx` for conditional classes
- Use `tailwind-merge` (cn utility) to merge conflicting classes
- Never use inline styles

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex items-center rounded-md font-medium", {
  variants: {
    variant: {
      primary: "bg-blue-600 text-white hover:bg-blue-700",
      secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    },
    size: {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 text-sm",
    },
  },
  defaultVariants: { variant: "primary", size: "md" },
});
```

### Translations

All user-visible text must use next-intl translations:

```tsx
"use client";
import { useTranslations } from "next-intl";

export function MyComponent() {
  const t = useTranslations("MyComponent");
  return <h1>{t("title")}</h1>;
}
```

Translation keys go in `messages/{locale}.json` under a namespace matching the component name.

### Accessibility

Every component must meet this baseline before merge:

- Semantic HTML elements (buttons, not divs with onClick)
- All interactive elements are keyboard navigable
- Images have alt text
- Form inputs have associated labels
- Color contrast meets WCAG 2.1 AA (4.5:1 for text)
- Focus states are visible
- Use `aria-*` attributes when native semantics are insufficient

### Security

- Never use `dangerouslySetInnerHTML`
- Use `SafeText` for rendering user-generated content
- Use `SafeLink` for rendering user-provided URLs
- Use `SafeDocumentContent` for document metadata display
- Sanitize all content from documents, disputes, and user input
- Only allow safe URL schemes: `http:`, `https:`, `mailto:`

### Testing

- Unit tests go in `__tests__/` using Jest
- E2E tests go in `e2e/` using Playwright
- Test sanitization with deliberately hostile input
- Test component rendering with various prop combinations

## Security Headers

The following headers are configured in `next.config.ts`:

- `Content-Security-Policy` — Restricts script, style, and connection sources
- `X-Content-Type-Options: nosniff` — Prevents MIME type sniffing
- `X-Frame-Options: DENY` — Prevents clickjacking
- `Referrer-Policy: strict-origin-when-cross-origin` — Controls referrer info
- `Permissions-Policy` — Disables camera, microphone, geolocation
- `Strict-Transport-Security` — Enforces HTTPS

## Available Scripts

- `npm run dev` — Start development server
- `npm run build` — Production build
- `npm run start` — Start production server
- `npm run lint` — Run ESLint
- `npm test` — Run Jest tests
- `npm run test:e2e` — Run Playwright E2E tests
