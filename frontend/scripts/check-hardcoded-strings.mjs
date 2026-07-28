#!/usr/bin/env node

/**
 * CI script: Detect hardcoded user-facing strings in JSX/TSX files.
 * Flags text between HTML tags that isn't wrapped in a translation function.
 *
 * This is a pragmatic check — not a full AST parser. It catches obvious
 * cases like <p>Hello world</p> but allows:
 * - Strings inside t() calls
 * - className attributes
 * - data-testid attributes
 * - aria-label with t() wrapper
 * - Short technical strings (< 3 chars)
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(__dirname, "..");

function getTsxFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (entry === "node_modules" || entry === ".next" || entry === "public") continue;
    if (statSync(full).isDirectory()) {
      files.push(...getTsxFiles(full));
    } else if (/\.(tsx|jsx)$/.test(entry) && !entry.endsWith(".d.ts")) {
      files.push(full);
    }
  }
  return files;
}

// Pattern: text content between > and < that looks like user-facing text
const HARDCODED_PATTERN = />([A-Z][a-zA-Z\s]{4,})</g;
// Ignore patterns
const IGNORE_PATTERNS = [
  /className=/,
  /data-testid=/,
  /aria-label=\{.*t\(/,
  /import /,
  /export /,
  /console\./,
  /\/\//,
  /\{\/\*/,  // JSX comments
];

let hasWarnings = false;
const files = getTsxFiles(frontendDir);

for (const file of files) {
  const relPath = relative(frontendDir, file);
  const content = readFileSync(file, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip lines that use t() or have ignore patterns
    if (IGNORE_PATTERNS.some((p) => p.test(line))) continue;
    if (line.includes("t(") || line.includes("getTranslations")) continue;

    const matches = [...line.matchAll(HARDCODED_PATTERN)];
    for (const match of matches) {
      const text = match[1].trim();
      // Skip very short or obviously non-user-facing strings
      if (text.length < 5) continue;
      if (/^[A-Z_]+$/.test(text)) continue; // constants like "PDF", "URL"
      if (/^\d/.test(text)) continue; // starts with number

      console.warn(`⚠ ${relPath}:${i + 1} — Possible hardcoded string: "${text}"`);
      hasWarnings = true;
    }
  }
}

if (hasWarnings) {
  console.log("\n💡 Consider wrapping hardcoded strings with translation functions (t()).");
  console.log("   These warnings don't fail CI but help maintain i18n coverage.");
  // Don't fail CI yet — this is advisory
  process.exit(0);
} else {
  console.log("✓ No obvious hardcoded user-facing strings found.");
}
