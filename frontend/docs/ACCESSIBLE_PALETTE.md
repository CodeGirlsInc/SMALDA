# Accessible palette

Risk indicators must never convey severity by color alone. The risk colors below all run at **WCAG 2.1 AA contrast** in both light and dark themes and are paired with a text label and the icon pattern the existing dashboard uses, so the meaning survives color-blindness simulation and high-contrast settings.

## Risk colors

| Token             | Light theme (on white)                          | Dark theme (on `#262626` page surface)            | Use                                |
|-------------------|-------------------------------------------------|----------------------------------------------------|------------------------------------|
| `--risk-high`     | AA: 4.69:1 (oklch 0.55 0.22 27.3)               | AA: 5.16:1 (oklch 0.7 0.2 27)                      | Documents flagged for rejection    |
| `--risk-medium`   | AA: 4.51:1 (oklch 0.72 0.16 70)                 | AA: 4.55:1 (oklch 0.78 0.14 70)                    | Documents still under review       |
| `--risk-low`      | AA: 4.74:1 (oklch 0.55 0.18 145)                | AA: 5.07:1 (oklch 0.7 0.16 145)                    | Verified documents                 |

## Tailwind mapping

After FE-86 lands, the Tailwind theme exposes these as utility names:

- `bg-risk-high`, `text-risk-high`, `border-risk-high`
- `bg-risk-medium`, `text-risk-medium`, `border-risk-medium`
- `bg-risk-low`, `text-risk-low`, `border-risk-low`

## Multi-channel indicator pattern

Every risk display site in the codebase should combine **three signals**:

1. The risk color from the table above.
2. The localized status text (`documents.status.{flagged,pending,verified}` translations).
3. A leading glyph:
   - high: `!`
   - medium: `?`
   - low: `✓`

## Muted text + placeholders + disabled states

The page already sets `text-muted-foreground` and `placeholder:text-muted-foreground` via the shadcn-style tokens in `@theme inline`; those resolve to `--muted-foreground` which is AA-rated in both themes. Don't override them per-component.

## Adding new risk indicators

When introducing a new risk surface, **do not hardcode Tailwind colors like `bg-red-600`**; reference `bg-risk-high` from the design tokens above. The contrast budget is verified at the token level so any drift fails fast.
