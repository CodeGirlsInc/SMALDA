use prometheus::{
    exponential_buckets, Counter, Histogram, HistogramOpts, Opts, Registry,
};
use std::sync::Arc;

/// Central metrics registry shared across all handlers via `AppState`.
///
/// Every new metric MUST be registered with `self.registry` in
/// `MetricsRegistry::new()` so that `/cmmty/metrics` can gather them all.
#[derive(Clone)]
pub struct MetricsRegistry {
    pub registry: Arc<Registry>,

    /// Total number of verify requests received.
    pub verify_requests_total: Counter,

    /// Total number of anchor requests received.
    pub anchor_requests_total: Counter,

    /// Total number of cache hits (hash found in local cache).
    pub cache_hits_total: Counter,

    /// Total number of cache misses (hash not in local cache → Stellar lookup).
    pub cache_misses_total: Counter,

    /// Total number of errors returned by the Stellar RPC.
    pub stellar_errors_total: Counter,

    /// End-to-end request latency histogram (seconds).
    pub request_duration_seconds: Histogram,
}

impl MetricsRegistry {
    pub fn new() -> Self {
        let registry = Arc::new(Registry::new());

        // ── Counters ────────────────────────────────────────────────────────
        let verify_requests_total = Counter::with_opts(
            Opts::new("verify_requests_total", "Total verify requests received"),
        )
        .expect("metric creation failed");

        let anchor_requests_total = Counter::with_opts(
            Opts::new("anchor_requests_total", "Total anchor requests received"),
        )
        .expect("metric creation failed");

        let cache_hits_total = Counter::with_opts(
            Opts::new("cache_hits_total", "Total cache hits"),
        )
        .expect("metric creation failed");

        let cache_misses_total = Counter::with_opts(
            Opts::new("cache_misses_total", "Total cache misses"),
        )
        .expect("metric creation failed");

        let stellar_errors_total = Counter::with_opts(
            Opts::new("stellar_errors_total", "Total Stellar RPC errors"),
        )
        .expect("metric creation failed");

        // ── Histogram ───────────────────────────────────────────────────────
        // Buckets: 5 ms → ~10 s covering typical RPC latencies
        let request_duration_seconds = Histogram::with_opts(
            HistogramOpts::new(
                "request_duration_seconds",
                "End-to-end HTTP request duration in seconds",
            )
            .buckets(
                exponential_buckets(0.005, 2.0, 11)
                    .expect("bucket config is valid"),
            ),
        )
        .expect("metric creation failed");

        // ── Register everything ─────────────────────────────────────────────
        registry
            .register(Box::new(verify_requests_total.clone()))
            .expect("register verify_requests_total");
        registry
            .register(Box::new(anchor_requests_total.clone()))
            .expect("register anchor_requests_total");
        registry
            .register(Box::new(cache_hits_total.clone()))
            .expect("register cache_hits_total");
        registry
            .register(Box::new(cache_misses_total.clone()))
            .expect("register cache_misses_total");
        registry
            .register(Box::new(stellar_errors_total.clone()))
            .expect("register stellar_errors_total");
        registry
            .register(Box::new(request_duration_seconds.clone()))
            .expect("register request_duration_seconds");

        Self {
            registry,
            verify_requests_total,
            anchor_requests_total,
            cache_hits_total,
            cache_misses_total,
            stellar_errors_total,
            request_duration_seconds,
        }
    }
}

impl Default for MetricsRegistry {
    fn default() -> Self {
        Self::new()
    }
}