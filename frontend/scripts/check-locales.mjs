#!/usr/bin/env node

/**
 * CI script: Verify all locale files have identical key sets.
 * Exits with code 1 if key sets diverge.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const messagesDir = resolve(__dirname, "..", "messages");

const locales = ["en", "es", "fr"];

function flattenKeys(obj, prefix = "") {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

let allKeys = {};
let hasError = false;

for (const locale of locales) {
  const filePath = resolve(messagesDir, `${locale}.json`);
  try {
    const content = JSON.parse(readFileSync(filePath, "utf-8"));
    allKeys[locale] = flattenKeys(content);
  } catch (err) {
    console.error(`Failed to read ${filePath}: ${err.message}`);
    process.exit(1);
  }
}

const referenceLocale = "en";
const referenceKeys = allKeys[referenceLocale];

for (const locale of locales.filter((l) => l !== referenceLocale)) {
  const localeKeys = allKeys[locale];
  const missingInLocale = referenceKeys.filter((k) => !localeKeys.includes(k));
  const extraInLocale = localeKeys.filter((k) => !referenceKeys.includes(k));

  if (missingInLocale.length > 0) {
    console.error(`[${locale}] Missing keys: ${missingInLocale.join(", ")}`);
    hasError = true;
  }
  if (extraInLocale.length > 0) {
    console.error(`[${locale}] Extra keys: ${extraInLocale.join(", ")}`);
    hasError = true;
  }
}

if (hasError) {
  console.error("\nLocale key sets are not in sync. Please update all locale files.");
  process.exit(1);
} else {
  console.log(`✓ All locale files (${locales.join(", ")}) have identical key sets (${referenceKeys.length} keys).`);
}
