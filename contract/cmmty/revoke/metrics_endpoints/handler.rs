use axum::{extract::State, http::StatusCode, response::Response};
use axum::body::Body;
use axum::http::header;
use prometheus::{Encoder, TextEncoder};

use crate::shared::{AppError, AppState};

/// GET /cmmty/metrics
///
/// Returns all registered Prometheus metrics in the standard text exposition
/// format (text/plain; version=0.0.4).
pub async fn metrics_handler(
    State(state): State<AppState>,
) -> Result<Response<Body>, AppError> {
    let encoder = TextEncoder::new();
    let metric_families = state.metrics.registry.gather();

    let mut buffer = Vec::new();
    encoder
        .encode(&metric_families, &mut buffer)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let response = Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_TYPE,
            encoder.format_type(), // "text/plain; version=0.0.4"
        )
        .body(Body::from(buffer))
        .map_err(|e| AppError::Internal(e.to_string()))?;

    Ok(response)
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::test_helpers::mock_state;
    use axum::{body::Body, http::Request};
    use tower::ServiceExt;

    #[tokio::test]
    async fn metrics_endpoint_returns_200_with_prometheus_content_type() {
        let state = mock_state().await;
        let app = crate::router(state);

        let req = Request::builder()
            .method("GET")
            .uri("/cmmty/metrics")
            .body(Body::empty())
            .unwrap();

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        let ct = resp
            .headers()
            .get("content-type")
            .unwrap()
            .to_str()
            .unwrap();
        assert!(ct.contains("text/plain"));
    }

    #[tokio::test]
    async fn verify_counter_increments_are_reflected_in_metrics() {
        let state = mock_state().await;

        // Simulate two verify requests
        state.metrics.verify_requests_total.inc();
        state.metrics.verify_requests_total.inc();

        let gathered = state.metrics.registry.gather();
        let verify_family = gathered
            .iter()
            .find(|mf| mf.get_name() == "verify_requests_total")
            .expect("verify_requests_total metric should be registered");

        let value = verify_family.get_metric()[0].get_counter().get_value();
        assert_eq!(value as u64, 2);
    }

    #[tokio::test]
    async fn anchor_counter_increments_are_reflected_in_metrics() {
        let state = mock_state().await;

        state.metrics.anchor_requests_total.inc();

        let gathered = state.metrics.registry.gather();
        let family = gathered
            .iter()
            .find(|mf| mf.get_name() == "anchor_requests_total")
            .expect("anchor_requests_total metric should be registered");

        let value = family.get_metric()[0].get_counter().get_value();
        assert_eq!(value as u64, 1);
    }

    #[tokio::test]
    async fn cache_hit_miss_counters_are_registered() {
        let state = mock_state().await;

        state.metrics.cache_hits_total.inc();
        state.metrics.cache_misses_total.inc();
        state.metrics.cache_misses_total.inc();

        let gathered = state.metrics.registry.gather();

        let hits = gathered
            .iter()
            .find(|mf| mf.get_name() == "cache_hits_total")
            .unwrap()
            .get_metric()[0]
            .get_counter()
            .get_value();

        let misses = gathered
            .iter()
            .find(|mf| mf.get_name() == "cache_misses_total")
            .unwrap()
            .get_metric()[0]
            .get_counter()
            .get_value();

        assert_eq!(hits as u64, 1);
        assert_eq!(misses as u64, 2);
    }

    #[tokio::test]
    async fn stellar_errors_counter_is_registered() {
        let state = mock_state().await;
        state.metrics.stellar_errors_total.inc();

        let gathered = state.metrics.registry.gather();
        let family = gathered
            .iter()
            .find(|mf| mf.get_name() == "stellar_errors_total")
            .expect("stellar_errors_total should be registered");

        let value = family.get_metric()[0].get_counter().get_value();
        assert_eq!(value as u64, 1);
    }
}