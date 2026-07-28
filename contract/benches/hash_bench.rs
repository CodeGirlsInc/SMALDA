//! Criterion micro-benchmarks for HashValidator functions.
//! Tracked under CT-65 (Stellar Wave).
//!
//! Run:  cd contract && cargo bench --bench hash_bench
//! Compile only:  cargo bench --no-run --bench hash_bench

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use stellar_doc_verifier::hash_validator::HashValidator;

fn sample_sha256() -> &'static str {
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}

fn sample_sha512() -> &'static str {
    "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce\
     47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"
}

/// `normalize` is called on every inbound /verify request, both for the
/// path-parameter variant and the POST body variant. Hot path.
fn bench_normalize(c: &mut Criterion) {
    let inputs = [
        ("lowercase_clean", "abcdef123"),
        ("uppercase_with_spaces", "  ABCDEF1234567890  "),
        ("full_sha256", sample_sha256()),
    ];
    let mut group = c.benchmark_group("normalize");
    for (label, value) in inputs.iter() {
        group.bench_with_input(BenchmarkId::from_parameter(label), value, |b, &v| {
            b.iter(|| HashValidator::normalize(v));
        });
    }
    group.finish();
}

/// `validate_sha256` walks every character and returns a typed error.
/// Benchmarks across a 64-character input to surface the worst case.
fn bench_validate_sha256(c: &mut Criterion) {
    let mut group = c.benchmark_group("validate_sha256");
    group.bench_function("full_hex", |b| {
        b.iter(|| HashValidator::validate_sha256(sample_sha256()));
    });
    group.bench_function("upper_normalized", |b| {
        let upper = sample_sha256().to_uppercase();
        let normalized = HashValidator::normalize(&upper);
        b.iter(|| HashValidator::validate_sha256(&normalized));
    });
    group.finish();
}

/// `detect_algorithm` only inspects the length. Cheap, worth confirming.
fn bench_detect_algorithm(c: &mut Criterion) {
    let mut group = c.benchmark_group("detect_algorithm");
    group.bench_function("sha256_input", |b| {
        b.iter(|| HashValidator::detect_algorithm(sample_sha256()));
    });
    group.bench_function("sha512_input", |b| {
        b.iter(|| HashValidator::detect_algorithm(sample_sha512()));
    });
    group.finish();
}

criterion_group!(name = hash_benches; config = Criterion::default(); targets = bench_normalize, bench_validate_sha256, bench_detect_algorithm);
criterion_main!(hash_benches);
