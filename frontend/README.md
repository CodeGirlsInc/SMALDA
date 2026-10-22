This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Testing convention

Reusable test setups, mocks, and shared helpers live in `frontend/test-utils/`. Jest discovers tests via the `testMatch` pattern in `frontend/jest.config.js`. Tests for feature-specific behavior live alongside the source file they cover, not in `test-utils/`.

To add a new shared helper, drop it into `frontend/test-utils/` (same directory as `test-setup.ts`) and reference it from individual tests via relative imports.

## Routing and i18n

Every page lives under `app/[locale]/`. With `localePrefix: "as-needed"`, English URLs stay unprefixed (`/documents/abc`) and other locales are prefixed (`/fr/documents/abc`). Do not add pages outside `app/[locale]/`: they would bypass translations and duplicate a localised route. If a page moves to a new URL, add the old prefix to `LEGACY_ROUTE_REDIRECTS` in `middleware.ts` so existing links keep working.

User-facing copy goes in `messages/{en,fr,es}.json` and is read with `useTranslations` / `getTranslations`. CI enforces two checks:

- `npm run check:locales` fails if the three message files do not have identical key sets.
- `npm run check:hardcoded` flags JSX text that looks like untranslated copy (test files are skipped).

### Hardcoded-string baseline

Strings that were already hardcoded when the check was added to CI are listed in `scripts/hardcoded-strings-baseline.json`, keyed by file and text (not line number). The check fails only on strings that are **not** in the baseline, so existing debt does not block PRs but new debt cannot be added. The CI step is currently `continue-on-error` while the heuristic beds in.

- **Translated a baselined string?** The check prints a reminder. Run `npm run check:hardcoded -- --update-baseline` and commit the smaller baseline. The goal is to ratchet it down to empty.
- **Got a new violation?** Move the copy into `messages/*.json`. Do not regenerate the baseline to silence it. If the match is a false positive, adjust the markup or the ignore patterns in `scripts/check-hardcoded-strings.mjs`.

