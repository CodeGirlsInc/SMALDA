/**
 * FE-70 — Verify all locale JSON files have identical keys.
 */

import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import es from "@/messages/es.json";

function collectLeafKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      keys.push(...collectLeafKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe("translation parity", () => {
  const enKeys = collectLeafKeys(en as Record<string, unknown>);
  const frKeys = collectLeafKeys(fr as Record<string, unknown>);
  const esKeys = collectLeafKeys(es as Record<string, unknown>);

  it("en and fr have identical keys", () => {
    expect(frKeys).toEqual(enKeys);
  });

  it("en and es have identical keys", () => {
    expect(esKeys).toEqual(enKeys);
  });

  it("all locales have the same number of leaf keys", () => {
    expect(new Set([enKeys.length, frKeys.length, esKeys.length]).size).toBe(1);
  });
});
