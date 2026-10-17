//! Criterion micro-benchmarks for ownership-chain lookups.
//!
//! `validate_chain` is the most likely performance bottleneck in the service as
//! chains grow long: it deserialises every `TransferRecord` for a document and
//! then walks them linearly, and the record count is unbounded because transfer
//! history is retained for ten years.
//!
//! Run:  cd contract && cargo bench --bench ownership_chain_bench
//! Compile only:  cargo bench --no-run --bench ownership_chain_bench

use criterion::{criterion_group, criterion_main, BenchmarkId, Criterion};
use stellar_doc_verifier::cache::{CacheBackend, InMemoryCache};
use stellar_doc_verifier::module::ownership_chain::validate_chain;
use stellar_doc_verifier::types::TransferRecord;

const DOCUMENT_HASH: &str =
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

/// Build a chain of `len` records where each link connects to the next, which is
/// the shape `validate_chain` has to walk in full.
fn connected_chain(len: usize) -> Vec<TransferRecord> {
    (0..len)
        .map(|i| TransferRecord {
            document_hash: DOCUMENT_HASH.to_string(),
            from_owner: format!("owner_{i}"),
            to_owner: format!("owner_{}", i + 1),
            transfer_date: "2024-01-15".to_string(),
            transfer_reference: None,
            transfer_hash: format!("{i:064x}"),
            memo: "TRANSFER:0000".to_string(),
            anchored_at: "2024-01-15T00:00:00+00:00".to_string(),
        })
        .collect()
}

/// Seed an in-memory cache with a chain of the given length.
///
/// `validate_chain` reads through `CacheBackend`, so the benchmark has to go
/// through the same deserialisation a real request would.
async fn seeded_cache(len: usize) -> CacheBackend {
    let cache = CacheBackend::InMemory(InMemoryCache::new());
    let chain = connected_chain(len);
    cache
        .set(&format!("transfer:{DOCUMENT_HASH}"), &chain, 3600)
        .await
        .expect("seeding the cache must not fail");
    cache
}

/// The lookup itself, across chain lengths.
///
/// The lengths are chosen to show where the cost starts to matter: a handful of
/// transfers is the common case, a few hundred is a heavily traded document, and
/// a thousand is the tail that a long-lived registry will eventually reach.
fn bench_validate_chain(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().expect("a tokio runtime is required");

    let lengths = [1usize, 10, 100, 1_000];
    let mut group = c.benchmark_group("validate_chain");
    group.sample_size(50);

    for len in lengths {
        let cache = rt.block_on(seeded_cache(len));

        group.bench_with_input(
            BenchmarkId::from_parameter(len),
            &len,
            |b, &_len| {
                b.to_async(&rt).iter(|| async {
                    validate_chain(DOCUMENT_HASH, &cache)
                        .await
                        .expect("a connected chain must validate")
                });
            },
        );
    }

    group.finish();
}

/// The empty-chain path.
///
/// A document that has never been transferred is the common case for a fresh
/// registry, and it short-circuits before deserialising anything. Worth
/// confirming it stays cheap.
fn bench_validate_chain_empty(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().expect("a tokio runtime is required");
    let cache = CacheBackend::InMemory(InMemoryCache::new());

    c.bench_function("validate_chain/empty", |b| {
        b.to_async(&rt).iter(|| async {
            validate_chain(DOCUMENT_HASH, &cache)
                .await
                .expect("an empty chain must validate")
        });
    });
}

criterion_group!(
    name = ownership_chain_benches;
    config = Criterion::default();
    targets = bench_validate_chain, bench_validate_chain_empty
);
criterion_main!(ownership_chain_benches);
