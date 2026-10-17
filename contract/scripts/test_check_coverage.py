#!/usr/bin/env python3
"""Tests for check_coverage.py.

The coverage script is the only thing standing between a new module and an
enforced floor, and it is easy to break silently: `min_total_percent` was
declared in the thresholds file and never read by the script for a long time,
which is precisely the kind of gap these tests exist to catch.

Run:  cd contract && python3 scripts/test_check_coverage.py
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).with_name("check_coverage.py")
THRESHOLDS = Path(__file__).parent.parent / "coverage-thresholds.json"

# A single module at 100% coverage. With `min_total_percent` above zero this
# must FAIL, because that is the case the aggregate floor exists for.
PERFECT_SINGLE_FILE = {
    "data": [
        {
            "path": "contract/src/cache.rs",
            "summary": {"lines": {"count": 10, "covered": 10}},
        }
    ],
    "totals": {"lines": {"count": 10, "covered": 10}},
}

# Two modules, one fully covered and one untouched. This is the shape that
# passes every per-file floor with `default: 0` while the crate as a whole is
# barely exercised.
MIXED_TWO_FILES = {
    "data": [
        {
            "path": "contract/src/cache.rs",
            "summary": {"lines": {"count": 10, "covered": 10}},
        },
        {
            "path": "contract/src/new_module.rs",
            "summary": {"lines": {"count": 10, "covered": 0}},
        },
    ],
    "totals": {"lines": {"count": 20, "covered": 10}},
}


def run_script(coverage: dict, thresholds: dict) -> subprocess.CompletedProcess:
    with tempfile.TemporaryDirectory() as tmp:
        cov_path = Path(tmp) / "coverage.json"
        thr_path = Path(tmp) / "thresholds.json"
        cov_path.write_text(json.dumps(coverage))
        thr_path.write_text(json.dumps(thresholds))
        return subprocess.run(
            [sys.executable, str(SCRIPT), str(cov_path), str(thr_path)],
            capture_output=True,
            text=True,
        )


def base_thresholds(**overrides) -> dict:
    thr = {
        "default": 0,
        "min_total_percent": 0,
        "files": {"contract/src/cache.rs": 70},
    }
    thr.update(overrides)
    return thr


def test_a_module_below_its_floor_fails() -> None:
    coverage = {
        "data": [
            {
                "path": "contract/src/cache.rs",
                "summary": {"lines": {"count": 10, "covered": 5}},
            }
        ],
        "totals": {"lines": {"count": 10, "covered": 5}},
    }
    result = run_script(coverage, base_thresholds())
    assert result.returncode == 1, result.stdout + result.stderr
    assert "contract/src/cache.rs" in result.stderr
    assert "floor=70%" in result.stderr


def test_the_aggregate_floor_is_enforced() -> None:
    """The regression: min_total_percent was declared but never read.

    Every per-file floor passes here - cache.rs is at 100% against a 70% floor,
    and the uncovered module is unlisted so it inherits `default: 0`. The only
    thing that catches it is the aggregate.
    """
    result = run_script(
        MIXED_TWO_FILES,
        base_thresholds(min_total_percent=60),
    )
    assert result.returncode == 1, (
        "50% overall coverage must not satisfy a 60% aggregate floor: "
        + result.stdout
        + result.stderr
    )
    assert "60%" in result.stderr, result.stderr


def test_the_aggregate_floor_passes_when_met() -> None:
    result = run_script(
        PERFECT_SINGLE_FILE,
        base_thresholds(min_total_percent=100),
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_a_low_default_floor_catches_uncovered_new_modules() -> None:
    """`default: 0` lets any unlisted module through with no coverage."""
    result = run_script(
        MIXED_TWO_FILES,
        base_thresholds(default=25),
    )
    assert result.returncode == 1, result.stdout + result.stderr
    assert "contract/src/new_module.rs" in result.stderr


def test_a_missing_total_is_reported_rather_than_passing() -> None:
    """Silently passing because the report had no totals would be worse than
    failing: it would look like the floor was checked and met."""
    coverage = {
        "data": [
            {
                "path": "contract/src/cache.rs",
                "summary": {"lines": {"count": 10, "covered": 10}},
            }
        ]
    }
    result = run_script(coverage, base_thresholds(min_total_percent=25))
    assert result.returncode == 1
    assert "no totals" in result.stderr


def test_the_longest_matching_pattern_wins() -> None:
    """`handlers/*.rs` must not silently override a specific file's floor.

    The script picks the longest matching pattern, so
    `contract/src/handlers/verify.rs` (specific) beats
    `contract/src/handlers/*.rs` (glob). If the comparison were reversed, the
    per-file floors would be dead config.
    """
    thr = {
        "default": 0,
        "min_total_percent": 0,
        "files": {
            "contract/src/handlers/*.rs": 25,
            "contract/src/handlers/verify.rs": 90,
        },
    }
    coverage = {
        "data": [
            {
                "path": "contract/src/handlers/verify.rs",
                "summary": {"lines": {"count": 100, "covered": 50}},
            }
        ],
        "totals": {"lines": {"count": 100, "covered": 50}},
    }
    result = run_script(coverage, thr)
    assert result.returncode == 1
    assert "floor=90%" in result.stderr, result.stderr


def test_the_real_thresholds_file_is_valid_json() -> None:
    data = json.loads(THRESHOLDS.read_text())
    assert "files" in data and data["files"], "thresholds must list files"
    assert data["min_total_percent"] > 0, "the aggregate floor must be non-zero"


def main() -> int:
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failures = 0
    for test in tests:
        try:
            test()
            print(f"PASS  {test.__name__}")
        except AssertionError as exc:
            failures += 1
            print(f"FAIL  {test.__name__}: {exc}")
    print(f"\n{len(tests) - failures}/{len(tests)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
