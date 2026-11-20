import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
    ],
    ignores: [
      "**/*.test.{ts,tsx}",
      "**/__tests__/**",
      "e2e/**",
      "test-utils/**",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "TemplateLiteral > TemplateElement[value.raw=/\\/api\\//]",
          message:
            "Do not build /api/ URLs outside lib/; use apiUrl() from lib/api-config.",
        },
      ],
    },
  },
];

// Locale-aware navigation (#1650): `next/link` and the router hooks from
// `next/navigation` drop the active locale, so use `@/i18n/navigation`.
eslintConfig.push({
  files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
  ignores: ["**/*.test.{ts,tsx}", "**/__tests__/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "next/link",
            message: "Import Link from @/i18n/navigation so the locale is kept.",
          },
          {
            name: "next/navigation",
            importNames: ["useRouter", "redirect", "usePathname"],
            message:
              "Import useRouter/redirect/usePathname from @/i18n/navigation so the locale is kept.",
          },
        ],
      },
    ],
  },
});

export default eslintConfig;
