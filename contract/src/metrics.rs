use axum::response::IntoResponse;
use prometheus::{Counter, Encoder, Registry, TextEncoder};

pub struct MetricsRegistry {
    registry: Registry,
    request_count: Counter,
    cache_hits: Counter,
    cache_misses: Counter,
    error_count: Counter,
}

impl Default for MetricsRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl MetricsRegistry {
    pub fn new() -> Self {
        let registry = Registry::new();
        let request_count = Counter::new("requests_total", "Total number of requests").unwrap();
        let cache_hits = Counter::new("cache_hits_total", "Total cache hits").unwrap();
        let cache_misses = Counter::new("cache_misses_total", "Total cache misses").unwrap();
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

    pub fn render(&self) -> impl IntoResponse {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = Vec::new();
        encoder
            .encode(&metric_families, &mut buffer)
            .unwrap_or_default();
        String::from_utf8(buffer).unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use tower::ServiceExt;

    #[test]
    fn test_metrics_registry_new() {
        let metrics = MetricsRegistry::new();
        let output = metrics.render();
        assert!(output.contains("requests_total"));
        assert!(output.contains("cache_hits_total"));
        assert!(output.contains("cache_misses_total"));
        assert!(output.contains("errors_total"));
    }

    #[test]
    fn test_increment_request_count() {
        let metrics = MetricsRegistry::new();
        metrics.increment_request_count();
        metrics.increment_request_count();
        metrics.increment_request_count();
        let output = metrics.render();
        assert!(output.contains("requests_total 3"));
    }

    #[test]
    fn test_increment_cache_hits() {
        let metrics = MetricsRegistry::new();
        metrics.increment_cache_hits();
        metrics.increment_cache_hits();
        let output = metrics.render();
        assert!(output.contains("cache_hits_total 2"));
    }

    #[test]
    fn test_increment_cache_misses() {
        let metrics = MetricsRegistry::new();
        metrics.increment_cache_misses();
        let output = metrics.render();
        assert!(output.contains("cache_misses_total 1"));
    }

    #[test]
    fn test_increment_error_count() {
        let metrics = MetricsRegistry::new();
        metrics.increment_error_count();
        metrics.increment_error_count();
        metrics.increment_error_count();
        metrics.increment_error_count();
        let output = metrics.render();
        assert!(output.contains("errors_total 4"));
    }

    #[test]
    fn test_default_trait() {
        let metrics = MetricsRegistry::default();
        let output = metrics.render();
        assert!(output.contains("requests_total"));
    }

    #[test]
    fn test_render_returns_valid_prometheus_text() {
        let metrics = MetricsRegistry::new();
        metrics.increment_request_count();
        let output = metrics.render();
        let lines: Vec<&str> = output.lines().collect();
        assert!(!lines.is_empty());
        let has_metric = lines.iter().any(|l| l.starts_with("requests_total"));
        assert!(has_metric);
    }

    #[test]
    fn test_multiple_increments_accumulate() {
        let metrics = MetricsRegistry::new();
        for _ in 0..10 {
            metrics.increment_request_count();
        }
        let output = metrics.render();
        assert!(output.contains("requests_total 10"));
    }
}
