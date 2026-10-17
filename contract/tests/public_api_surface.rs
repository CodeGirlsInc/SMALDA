//! Guard rail for the crate's public module surface.
//!
//! `src/lib.rs` opens with a documented list of which modules are public and
//! why. That list is prose, and prose rots: a module added last week is a module
//! nobody remembers to question next month, which is exactly how the surface got
//! unclear in the first place.
//!
//! This test parses `lib.rs` and compares the declared `pub mod` set against an
//! explicit allowlist, so:
//!
//! - adding a module fails here until someone has written down why it is public;
//! - removing one fails here too, so a deletion is a considered act rather than
//!   an accident.
//!
//! The allowlist is intentionally a `Vec` of `&str` rather than a count, so the
//! failure message names the module that moved.

use std::path::Path;

/// Reads the crate root `src/lib.rs` relative to this test file.
fn lib_source() -> String {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
        .parent()
        .expect("contract/ has a parent")
        .join("contract")
        .join("src")
        .join("lib.rs");
    std::fs::read_to_string(&manifest_dir)
        .unwrap_or_else(|e| panic!("cannot read {}: {e}", manifest_dir.display()))
}

/// Every `pub mod <name>;` declaration in declaration order.
fn declared_modules(source: &str) -> Vec<&str> {
    source
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            let rest = line.strip_prefix("pub mod ")?;
            let name = rest.strip_suffix(';')?.trim();
            Some(name)
        })
        .collect()
}

/// The intended public surface, mirroring the table in `src/lib.rs`.
///
/// Grouped the way the doc comment groups them, so the two lists cannot drift
/// apart silently.
const DELIBERATELY_PUBLIC: &[&str] = &[
    "app",
    "cache",
    "config",
    "hash_validator",
    "metrics",
    "rate_limit",
    "stellar",
    "types",
];

/// Not intended for consumers, but `pub` for the reasons documented in
/// `src/lib.rs` (a public signature names one of their types, or narrowing would
/// surface pre-existing dead code under `-- -D warnings`).
const PUBLIC_BUT_INTERNAL: &[&str] = &[
    "error",
    "event",
    "handlers",
    "health",
    "module",
    "retry",
    "routes",
    "site",
    "webhook",
];

#[test]
fn the_public_module_set_matches_the_documented_surface() {
    let source = lib_source();
    let declared = declared_modules(&source);

    let mut expected = DELIBERATELY_PUBLIC.to_vec();
    expected.extend_from_slice(PUBLIC_BUT_INTERNAL);
    expected.sort_unstable();

    let mut actual = declared.clone();
    actual.sort_unstable();

    assert_eq!(
        actual, expected,
        "the set of `pub mod` declarations in src/lib.rs no longer matches the \
         documented surface.\n\nIf you ADDED a module: decide which group it \
         belongs to, move it into the right list here, and add a row to the \
         table in src/lib.rs. If you REMOVED one: say so, because that is a \
         breaking change for anyone who reached it."
    );
}

#[test]
fn every_module_in_the_allowlist_exists_in_the_source() {
    // Catches a typo in the allowlist that the set comparison above would miss:
    // a bogus name would simply never appear on either side.
    let source = lib_source();
    let declared = declared_modules(&source);

    for name in DELIBERATELY_PUBLIC.iter().chain(PUBLIC_BUT_INTERNAL) {
        assert!(
            declared.contains(name),
            "allowlist names `{name}` but src/lib.rs has no `pub mod {name};`"
        );
    }
}

#[test]
fn no_module_is_declared_twice() {
    let source = lib_source();
    let declared = declared_modules(&source);

    let mut sorted = declared.clone();
    sorted.sort_unstable();
    sorted.dedup();

    assert_eq!(
        sorted.len(),
        declared.len(),
        "src/lib.rs declares a module more than once: {declared:?}"
    );
}

#[test]
fn the_documentation_table_lists_every_public_module() {
    // The prose table and the allowlist are the same fact stated twice. This
    // keeps them from drifting: if a module is public but absent from the table,
    // a reader has no way to learn it is supported.
    let source = lib_source();
    let declared = declared_modules(&source);

    for name in declared {
        assert!(
            source.contains(name),
            "module `{name}` is public but not mentioned in the src/lib.rs table"
        );
    }
}
