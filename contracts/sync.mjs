import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(repositoryRoot, "contracts/api-contracts.json");
const targets = [
  resolve(repositoryRoot, "backend/src/contracts/api-contracts.json"),
  resolve(repositoryRoot, "frontend/contracts/api-contracts.json"),
];

for (const target of targets) {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
