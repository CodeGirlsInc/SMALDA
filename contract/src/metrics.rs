use prometheus::{Counter, Encoder, Registry, TextEncoder};
use std::sync::Arc;

pub struct MetricsRegistry {
    registry: Registry,
    request_count: Counter,
    cache_hits: Counter,
    cache_misses: Counter,
    error_count: Counter,
}

impl MetricsRegistry {
    pub fn new() -> Self {
        let registry = Registry::new();

        let request_count = Counter::new("requests_total", "Total requests").unwrap();
        let cache_hits = Counter::new("cache_hits_total", "Cache hits").unwrap();
        let cache_misses = Counter::new("cache_misses_total", "Cache misses").unwrap();
        let error_count = Counter::new("errors_total", "Total errors").unwrap();

        registry.register(Box::new(request_count.clone())).unwrap();
        registry.register(Box::new(cache_hits.clone())).unwrap();
        registry.register(Box::new(cache_misses.clone())).unwrap();
        registry.register(Box::new(error_count.clone())).unwrap();

        Self {
            registry,
            request_count,
            cache_hits,
            cache_misses,
            error_count,
        }
    }

    pub fn increment_request_count(&self) {
        self.request_count.inc();
    }

    pub fn increment_cache_hits(&self) {
        self.cache_hits.inc();
    }

    pub fn increment_cache_misses(&self) {
        self.cache_misses.inc();
    }

    pub fn increment_error_count(&self) {
        self.error_count.inc();
    }

    pub fn render(&self) -> String {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = vec![];
        encoder.encode(&metric_families, &mut buffer).unwrap();
        String::from_utf8(buffer).unwrap()
    }
}
