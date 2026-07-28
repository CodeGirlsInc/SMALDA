#!/usr/bin/env python3
"""Per-module line-coverage floor enforcement.

Usage:
    check_coverage.py <coverage.json> <thresholds.json>

`coverage.json` is produced by `cargo llvm-cov --json-path coverage.json`.
`thresholds.json` looks like:

    {
      "default": 0,
      "files": {
        "contract/src/retry.rs": 70,
        "contract/src/cache.rs": 75
      }
    }

Floors are matched as globs against the file paths reported by cargo-llvm-cov.
Exits 0 when every covered module meets or exceeds its floor. Exits 1 with a
report on stderr when any module is below the floor.
"""

from __future__ import annotations

import fnmatch
import json
import sys
from pathlib import Path
from typing import Any


def load_json(path: Path) -> Any:
    with path.open() as fh:
        return json.load(fh)


def floor_for(path: str, files: dict[str, int], default: int) -> int | None:
    norm = path.lstrip("./")
    best: int | None = None
    best_pattern = ""
    for pattern, value in files.items():
        if fnmatch.fnmatch(norm, pattern):
            if best is None or len(pattern) > len(best_pattern):
                best_pattern = pattern
            best = value
    if best is None:
        return default
    return best


def coverage_percent(entry: dict[str, Any]) -> float | None:
    summary = (entry.get("summary") or {}).get("lines") or {}
    count = summary.get("count")
    covered = summary.get("covered")
    if count:
        return 100.0 * covered / count
    if "percent" in entry:
        return float(entry["percent"])
    return None


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        sys.stderr.write(
            f"usage: {Path(argv[0]).name} <coverage.json> <thresholds.json>\n"
        )
        return 2

    cov_path = Path(argv[1])
    thr_path = Path(argv[2])

    cov = load_json(cov_path)
    thr = load_json(thr_path)
    default_floor = int(thr.get("default", 0))
    file_floors = thr.get("files") or {}

    entries = (cov or {}).get("data") or []
    rows: list[tuple[str, int, float | None]] = []
    failures: list[tuple[str, int, float]] = []

    for entry in entries:
        path = entry.get("path") or ""
        if not path:
            continue
        floor = floor_for(path, file_floors, default_floor)
        pct = coverage_percent(entry)
        rows.append((path, floor, pct))
        if pct is not None and floor is not None and pct < floor:
            failures.append((path, floor, pct))

    rows.sort(key=lambda r: r[0])

    width = max((len(r[0]) for r in rows), default=12)
    sys.stdout.write("Per-module line coverage:\n")
    sys.stdout.write(
        f"  {'module':<{width}}  {'floor':>6}  {'actual':>8}\n"
    )
    for path, floor, pct in rows:
        pct_s = "  n/a" if pct is None else f"{pct:6.2f}%"
        sys.stdout.write(
            f"  {path:<{width}}  {floor:>5}%  {pct_s}\n"
        )

    if failures:
        sys.stderr.write(f"\n{len(failures)} module(s) below floor:\n")
        for path, floor, pct in failures:
            sys.stderr.write(
                f"  {path}  floor={floor}%  actual={pct:.2f}%\n"
            )
        return 1

    sys.stdout.write("\nAll modules meet or exceed their floor.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
