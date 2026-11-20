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

export default eslintConfig;
