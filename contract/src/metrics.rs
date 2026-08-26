use prometheus::{opts, Counter, Encoder, Gauge, IntCounterVec, Registry, TextEncoder};

#[derive(Clone)]
pub struct MetricsRegistry {
    registry: Registry,
    request_count: Counter,
    cache_hits: Counter,
    cache_misses: Counter,
    error_count: Counter,
    /// Per-route request counts so /metrics can distinguish verify vs submit
    /// vs revoke vs transfer volume, not just a single global counter (CT-40).
    request_count_by_route: IntCounterVec,
    /// Horizon calls that triggered a retry (each retry occurrence counted).
    horizon_retries_total: Counter,
    /// Times the Horizon circuit breaker transitioned into the `Open` state.
    horizon_circuit_opens_total: Counter,
    /// Current circuit-breaker state. 0 = Closed, 1 = Open, 2 = HalfOpen.
    horizon_circuit_state: Gauge,
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
        let request_count_by_route = IntCounterVec::new(
            opts!("requests_total_by_route", "Total requests by route"),
            &["route"],
        )
        .unwrap();
        let horizon_retries_total = Counter::new(
            "horizon_retries_total",
            "Total Horizon call retries triggered by the retry policy",
        )
        .unwrap();
        let horizon_circuit_opens_total = Counter::new(
            "horizon_circuit_opens_total",
            "Times the Horizon circuit breaker transitioned to Open",
        )
        .unwrap();
        let horizon_circuit_state = Gauge::new(
            "horizon_circuit_state",
            "Current Horizon circuit-breaker state (0=Closed, 1=Open, 2=HalfOpen)",
        )
        .unwrap();

        registry.register(Box::new(request_count.clone())).unwrap();
        registry.register(Box::new(cache_hits.clone())).unwrap();
        registry.register(Box::new(cache_misses.clone())).unwrap();
        registry.register(Box::new(error_count.clone())).unwrap();
        registry
            .register(Box::new(request_count_by_route.clone()))
            .unwrap();
        registry
            .register(Box::new(horizon_retries_total.clone()))
            .unwrap();
        registry
            .register(Box::new(horizon_circuit_opens_total.clone()))
            .unwrap();
        registry
            .register(Box::new(horizon_circuit_state.clone()))
            .unwrap();

        Self {
            registry,
            request_count,
            cache_hits,
            cache_misses,
            error_count,
            request_count_by_route,
            horizon_retries_total,
            horizon_circuit_opens_total,
            horizon_circuit_state,
        }
    }

    pub fn increment_request_count(&self) {
        self.request_count.inc();
    }

    /// Increment the per-route request counter (e.g. "verify", "submit").
    pub fn increment_route_count(&self, route: &str) {
        self.request_count_by_route.with_label_values(&[route]).inc();
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

    pub fn record_horizon_retry(&self) {
        self.horizon_retries_total.inc();
    }

    pub fn record_circuit_open(&self) {
        self.horizon_circuit_opens_total.inc();
    }

    pub fn set_circuit_state(&self, state: u8) {
        self.horizon_circuit_state.set(f64::from(state));
    }

    pub fn render(&self) -> String {
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
    fn test_increment_route_count() {
        let metrics = MetricsRegistry::new();
        metrics.increment_route_count("verify");
        metrics.increment_route_count("verify");
        metrics.increment_route_count("submit");
        let output = metrics.render();
        assert!(output.contains("requests_total_by_route{route=\"verify\"} 2"));
        assert!(output.contains("requests_total_by_route{route=\"submit\"} 1"));
    }

    #[test]
    fn test_route_counts_are_isolated_per_route() {
        let metrics = MetricsRegistry::new();
        metrics.increment_route_count("verify");
        metrics.increment_route_count("transfer");
        metrics.increment_route_count("transfer");
        let output = metrics.render();
        assert!(output.contains("requests_total_by_route{route=\"verify\"} 1"));
        assert!(output.contains("requests_total_by_route{route=\"transfer\"} 2"));
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
