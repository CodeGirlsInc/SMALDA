//! Retry policy + circuit breaker for every Horizon HTTP call.
//!
//! See [`with_retry_and_cb`] for the single helper that wraps both layers.
//!
//! Behaviour:
//!
//! * **Backoff** is bounded exponential-with-jitter. The cap is taken from
//!   [`RetryPolicy::max_backoff`].
//! * Only **retryable errors** (network timeouts, 5xx, 429) are retried.
//!   [`RetryableError::Terminal`] (4xx other than 429, parse failures, ...) is
//!   bubbled immediately **without** penalising the breaker.
//! * The [`CircuitBreaker`] tracks consecutive failures across all Horizon
//!   calls; once `failure_threshold` is crossed it opens, fails fast for
//!   `cooldown`, then probes once in the `HalfOpen` state.
//! * Circuit state is observable via [`CircuitBreaker::state`],
//!   [`CircuitBreaker::state_label`] and the [`MetricsRegistry`] gauges
//!   `horizon_circuit_state` / `horizon_circuit_opens_total`.

use rand::Rng;
use std::future::Future;
use std::sync::atomic::{AtomicU32, AtomicU64, AtomicU8, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use thiserror::Error;

/// State of [`CircuitBreaker`].
///
/// The numeric values are the canonical Prometheus gauge encoding exposed
/// via `horizon_circuit_state`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    /// Healthy — calls flow through.
    Closed = 0,
    /// Failing fast — calls rejected without invoking the underlying service.
    Open = 1,
    /// Probing — a single request is allowed through; on success the breaker
    /// closes, on failure it remains open for another cooldown.
    HalfOpen = 2,
}

impl CircuitState {
    pub fn as_u8(self) -> u8 {
        self as u8
    }

    pub fn as_label(self) -> &'static str {
        match self {
            Self::Closed => "closed",
            Self::Open => "open",
            Self::HalfOpen => "half_open",
        }
    }

    fn from_u8(v: u8) -> Self {
        match v {
            1 => Self::Open,
            2 => Self::HalfOpen,
            _ => Self::Closed,
        }
    }
}

/// Distinguishes errors the retry helper should back off and retry from
/// errors it must propagate immediately.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum RetryableError {
    /// Transient — timeout, 5xx, 429, transport error. Eligible for retry and
    /// penalises the breaker on each occurrence.
    #[error("retryable error: {0}")]
    Retryable(String),
    /// Permanent — 4xx other than 429, JSON parse error, validation failure.
    /// Not retried; not counted against the breaker.
    #[error("non-retryable error: {0}")]
    Terminal(String),
}

impl RetryableError {
    pub fn is_retryable(&self) -> bool {
        matches!(self, Self::Retryable(_))
    }

    /// Flatten the variant into the underlying string, regardless of kind.
    pub fn into_string(self) -> String {
        match self {
            Self::Retryable(s) | Self::Terminal(s) => s,
        }
    }
}

/// Exponential-with-jitter retry policy.
///
/// `wall_clock_attempts = 1 + max_attempts`. Backoff between retry `i` and
/// `i + 1` is `min(initial * multiplier^i, max_backoff)`, then multiplied by
/// `1 + uniform(-jitter, jitter)` and clamped to `[0, max_backoff]`.
#[derive(Debug, Clone)]
pub struct RetryPolicy {
    pub max_attempts: u32,
    pub initial_backoff: Duration,
    pub max_backoff: Duration,
    pub multiplier: f64,
    /// Must satisfy `0.0 <= jitter <= 1.0`.
    pub jitter: f64,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_backoff: Duration::from_millis(200),
            max_backoff: Duration::from_secs(5),
            multiplier: 2.0,
            jitter: 0.25,
        }
    }
}

impl RetryPolicy {
    /// Compute the backoff for retry index `retry_index` (0-based).
    pub fn backoff_for(&self, retry_index: u32) -> Duration {
        if self.multiplier <= 0.0 {
            return self.initial_backoff;
        }
        let raw =
            (self.initial_backoff.as_millis() as f64) * self.multiplier.powi(retry_index as i32);
        let capped = raw.min(self.max_backoff.as_millis() as f64).max(0.0) as u64;
        let base = Duration::from_millis(capped);
        self.apply_jitter(base)
    }

    fn apply_jitter(&self, base: Duration) -> Duration {
        if self.jitter <= 0.0 {
            return base;
        }
        let mut rng = rand::thread_rng();
        let factor: f64 = rng.gen_range(-self.jitter..=self.jitter);
        let millis = (base.as_millis() as f64) * (1.0 + factor);
        let bounded = millis.max(0.0).min(self.max_backoff.as_millis() as f64) as u64;
        Duration::from_millis(bounded)
    }
}

/// Circuit breaker state machine.
///
/// `failure_threshold` consecutive failures in the `Closed` state open the
/// breaker. While `Open` the breaker rejects calls; once `cooldown` has
/// elapsed, the next call is admitted in the `HalfOpen` state as a probe.
/// Success closes; failure re-opens.
#[derive(Debug)]
pub struct CircuitBreaker {
    failure_threshold: u32,
    cooldown: Duration,
    consecutive_failures: AtomicU32,
    state: AtomicU8,
    opened_at_ms: AtomicU64,
}

impl CircuitBreaker {
    pub fn new(failure_threshold: u32, cooldown: Duration) -> Arc<Self> {
        Arc::new(Self {
            failure_threshold,
            cooldown,
            consecutive_failures: AtomicU32::new(0),
            state: AtomicU8::new(CircuitState::Closed.as_u8()),
            opened_at_ms: AtomicU64::new(0),
        })
    }

    pub fn with_defaults() -> Arc<Self> {
        Self::new(5, Duration::from_secs(30))
    }

    pub fn state(&self) -> CircuitState {
        CircuitState::from_u8(self.state.load(Ordering::Acquire))
    }

    pub fn state_label(&self) -> &'static str {
        self.state().as_label()
    }

    pub fn opened_at_ms(&self) -> u64 {
        self.opened_at_ms.load(Ordering::Acquire)
    }

    /// Decide whether a call may proceed:
    ///
    /// * `Closed` -> admit.
    /// * `Open` & cooldown elapsed -> atomically transition to `HalfOpen` and admit (single probe).
    /// * `Open` & cooldown not elapsed -> reject.
    /// * `HalfOpen` -> reject (a trial request is already in-flight; prevents flood).
    pub fn try_admit(&self) -> bool {
        match self.state() {
            CircuitState::Closed => true,
            CircuitState::HalfOpen => false,
            CircuitState::Open => {
                let opened = self.opened_at_ms.load(Ordering::Acquire);
                let now_ms = unix_ms();
                if now_ms.saturating_sub(opened) >= self.cooldown.as_millis() as u64 {
                    self.state
                        .compare_exchange(
                            CircuitState::Open.as_u8(),
                            CircuitState::HalfOpen.as_u8(),
                            Ordering::AcqRel,
                            Ordering::Acquire,
                        )
                        .is_ok()
                } else {
                    false
                }
            }
        }
    }

    /// Record a successful invocation; resets counter and closes the breaker.
    pub fn on_success(&self) {
        self.consecutive_failures.store(0, Ordering::Release);
        self.state
            .store(CircuitState::Closed.as_u8(), Ordering::Release);
    }

    /// Record a failed invocation; on `failure_threshold` consecutive
    /// failures (or when failing a probe in `HalfOpen`), the breaker opens
    /// and records the timestamp.
    /// Returns `true` if this call opened the breaker.
    pub fn on_failure(&self) -> bool {
        let n = self.consecutive_failures.fetch_add(1, Ordering::AcqRel) + 1;
        let is_half_open = self.state() == CircuitState::HalfOpen;
        if (n >= self.failure_threshold || is_half_open) && self.state() != CircuitState::Open {
            self.state
                .store(CircuitState::Open.as_u8(), Ordering::Release);
            self.opened_at_ms.store(unix_ms(), Ordering::Release);
            return true;
        }
        false
    }

    pub fn is_open(&self) -> bool {
        self.state() == CircuitState::Open
    }

    pub fn is_half_open(&self) -> bool {
        self.state() == CircuitState::HalfOpen
    }

    pub fn is_closed(&self) -> bool {
        self.state() == CircuitState::Closed
    }

    pub fn failures(&self) -> u32 {
        self.consecutive_failures.load(Ordering::Acquire)
    }
}

fn unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Run an async operation through the retry policy AND the circuit breaker.
pub async fn with_retry_and_cb<T, F, Fut>(
    breaker: &Arc<CircuitBreaker>,
    policy: &RetryPolicy,
    mut op: F,
) -> Result<T, RetryableError>
where
    F: FnMut() -> Fut,
    Fut: Future<Output = Result<T, RetryableError>>,
{
    if !breaker.try_admit() {
        return Err(RetryableError::Retryable(
            "horizon circuit breaker is open; failing fast".to_string(),
        ));
    }

    let total_attempts = policy.max_attempts.saturating_add(1);
    let mut last_err: Option<RetryableError> = None;

    for attempt in 0..total_attempts {
        match op().await {
            Ok(value) => {
                breaker.on_success();
                return Ok(value);
            }
            Err(err @ RetryableError::Terminal(_)) => {
                return Err(err);
            }
            Err(err @ RetryableError::Retryable(_)) => {
                breaker.on_failure();
                last_err = Some(err);
                if attempt + 1 == total_attempts {
                    break;
                }
                if !breaker.try_admit() {
                    return Err(last_err.unwrap_or_else(|| {
                        RetryableError::Retryable(
                            "horizon circuit breaker opened mid-retry; failing fast".to_string(),
                        )
                    }));
                }
                let backoff = policy.backoff_for(attempt);
                tokio::time::sleep(backoff).await;
            }
        }
    }
    Err(last_err.unwrap_or_else(|| RetryableError::Retryable("retry budget exhausted".to_string())))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicU32 as AU32;
    use std::sync::atomic::Ordering as AOrd;

    #[test]
    fn retry_policy_exponential_growth() {
        let p = RetryPolicy {
            max_attempts: 5,
            initial_backoff: Duration::from_millis(100),
            max_backoff: Duration::from_secs(60),
            multiplier: 2.0,
            jitter: 0.0,
        };
        assert_eq!(p.backoff_for(0), Duration::from_millis(100));
        assert_eq!(p.backoff_for(1), Duration::from_millis(200));
        assert_eq!(p.backoff_for(2), Duration::from_millis(400));
        assert_eq!(p.backoff_for(3), Duration::from_millis(800));
    }

    #[test]
    fn retry_policy_caps_at_max_backoff() {
        let p = RetryPolicy {
            max_attempts: 10,
            initial_backoff: Duration::from_millis(100),
            max_backoff: Duration::from_millis(500),
            multiplier: 2.0,
            jitter: 0.0,
        };
        assert_eq!(p.backoff_for(0), Duration::from_millis(100));
        assert_eq!(p.backoff_for(1), Duration::from_millis(200));
        assert_eq!(p.backoff_for(2), Duration::from_millis(400));
        assert_eq!(p.backoff_for(3), Duration::from_millis(500));
        assert_eq!(p.backoff_for(8), Duration::from_millis(500));
    }

    #[test]
    fn retry_policy_jitter_stays_within_bounds() {
        let p = RetryPolicy {
            max_attempts: 3,
            initial_backoff: Duration::from_millis(1000),
            max_backoff: Duration::from_secs(60),
            multiplier: 1.0,
            jitter: 0.25,
        };
        for _ in 0..200 {
            let b = p.backoff_for(0);
            let ms = b.as_millis() as i64;
            assert!((750..=1250).contains(&ms), "jitter out of bounds: {ms}ms");
        }
    }

    #[test]
    fn retry_policy_zero_jitter_returns_base() {
        let p = RetryPolicy {
            max_attempts: 3,
            initial_backoff: Duration::from_millis(1000),
            max_backoff: Duration::from_secs(60),
            multiplier: 1.0,
            jitter: 0.0,
        };
        for _ in 0..50 {
            assert_eq!(p.backoff_for(0), Duration::from_millis(1000));
        }
    }

    #[test]
    fn retryable_error_classification() {
        assert!(RetryableError::Retryable("timeout".into()).is_retryable());
        assert!(!RetryableError::Terminal("400 bad request".into()).is_retryable());
        assert_eq!(
            RetryableError::Retryable("x".into()).into_string(),
            "x".to_string()
        );
    }

    #[test]
    fn circuit_state_label_round_trip() {
        assert_eq!(CircuitState::Closed.as_u8(), 0);
        assert_eq!(CircuitState::Open.as_u8(), 1);
        assert_eq!(CircuitState::HalfOpen.as_u8(), 2);
        assert_eq!(CircuitState::Closed.as_label(), "closed");
        assert_eq!(CircuitState::Open.as_label(), "open");
        assert_eq!(CircuitState::HalfOpen.as_label(), "half_open");
        assert_eq!(CircuitState::from_u8(0), CircuitState::Closed);
        assert_eq!(CircuitState::from_u8(1), CircuitState::Open);
        assert_eq!(CircuitState::from_u8(2), CircuitState::HalfOpen);
        assert_eq!(CircuitState::from_u8(99), CircuitState::Closed);
    }

    #[tokio::test]
    async fn circuit_opens_after_threshold_failures() {
        let cb = CircuitBreaker::new(3, Duration::from_millis(200));
        assert_eq!(cb.state(), CircuitState::Closed);
        assert!(!cb.on_failure());
        assert_eq!(cb.state(), CircuitState::Closed);
        assert!(!cb.on_failure());
        assert_eq!(cb.state(), CircuitState::Closed);
        assert!(cb.on_failure());
        assert_eq!(cb.state(), CircuitState::Open);
        assert!(cb.opened_at_ms() > 0);
    }

    #[tokio::test]
    async fn circuit_recovers_after_cooldown_then_success() {
        let cb = CircuitBreaker::new(2, Duration::from_millis(50));
        // First failure increments the counter but does not yet open (threshold=2).
        cb.on_failure();
        // Second failure trips the breaker.
        assert!(cb.on_failure());
        assert_eq!(cb.state(), CircuitState::Open);
        assert!(!cb.try_admit());
        tokio::time::sleep(Duration::from_millis(60)).await;
        assert!(cb.try_admit());
        assert_eq!(cb.state(), CircuitState::HalfOpen);
        cb.on_success();
        assert_eq!(cb.state(), CircuitState::Closed);
        assert_eq!(cb.failures(), 0);
    }

    #[tokio::test]
    async fn circuit_reopens_on_probe_failure() {
        let cb = CircuitBreaker::new(2, Duration::from_millis(50));
        cb.on_failure();
        cb.on_failure();
        tokio::time::sleep(Duration::from_millis(60)).await;
        assert!(cb.try_admit());
        assert!(cb.on_failure());
        assert_eq!(cb.state(), CircuitState::Open);
    }

    #[tokio::test]
    async fn circuit_half_open_transition_closed_to_open_to_half_open_to_closed() {
        let cb = CircuitBreaker::new(3, Duration::from_millis(50));
        assert_eq!(cb.state(), CircuitState::Closed);
        assert!(cb.is_closed());

        // 1. Drive Closed -> Open via failures
        assert!(!cb.on_failure());
        assert!(!cb.on_failure());
        assert!(cb.on_failure());
        assert_eq!(cb.state(), CircuitState::Open);
        assert!(cb.is_open());

        // During cooldown, all calls rejected
        assert!(!cb.try_admit());

        // Wait for cooldown to elapse
        tokio::time::sleep(Duration::from_millis(60)).await;

        // 2. First call transitions Open -> HalfOpen and is admitted as single trial request
        assert!(cb.try_admit());
        assert_eq!(cb.state(), CircuitState::HalfOpen);
        assert!(cb.is_half_open());
        assert_eq!(cb.state_label(), "half_open");

        // 3. Assert ONLY ONE trial request is allowed through during HalfOpen (prevent flood)
        for _ in 0..20 {
            assert!(
                !cb.try_admit(),
                "HalfOpen state must reject subsequent calls while trial request is in-flight"
            );
        }

        // 4. On trial success, breaker transitions HalfOpen -> Closed
        cb.on_success();
        assert_eq!(cb.state(), CircuitState::Closed);
        assert!(cb.is_closed());
        assert_eq!(cb.failures(), 0);

        // Calls now flow through freely
        for _ in 0..10 {
            assert!(cb.try_admit());
        }
    }

    #[tokio::test]
    async fn circuit_half_open_transition_closed_to_open_to_half_open_back_to_open() {
        let cb = CircuitBreaker::new(3, Duration::from_millis(50));
        assert_eq!(cb.state(), CircuitState::Closed);

        // 1. Drive Closed -> Open via failures
        cb.on_failure();
        cb.on_failure();
        cb.on_failure();
        assert_eq!(cb.state(), CircuitState::Open);

        // Wait for cooldown
        tokio::time::sleep(Duration::from_millis(60)).await;

        // 2. Single trial request admitted -> HalfOpen
        assert!(cb.try_admit());
        assert_eq!(cb.state(), CircuitState::HalfOpen);

        // Flood attempts while in HalfOpen are rejected
        assert!(!cb.try_admit());
        assert!(!cb.try_admit());

        // 3. On trial failure, breaker transitions back to Open
        assert!(cb.on_failure());
        assert_eq!(cb.state(), CircuitState::Open);
        assert!(cb.is_open());

        // Re-opens and rejects requests during the new cooldown
        assert!(!cb.try_admit());
    }

    #[tokio::test]
    async fn circuit_half_open_concurrent_flood_admits_strictly_one_trial_request() {
        let cb = CircuitBreaker::new(2, Duration::from_millis(50));
        cb.on_failure();
        cb.on_failure();
        assert_eq!(cb.state(), CircuitState::Open);

        tokio::time::sleep(Duration::from_millis(60)).await;

        // Launch 50 concurrent tasks trying to admit simultaneously
        let mut handles = Vec::new();
        for _ in 0..50 {
            let cb_clone = cb.clone();
            handles.push(tokio::spawn(async move {
                cb_clone.try_admit()
            }));
        }

        let mut admitted = 0;
        for h in handles {
            if h.await.unwrap() {
                admitted += 1;
            }
        }

        // Exactly one trial request is admitted
        assert_eq!(
            admitted, 1,
            "Only one trial request must be admitted during half-open, not a flood"
        );
        assert_eq!(cb.state(), CircuitState::HalfOpen);
    }

    #[tokio::test]
    async fn with_retry_succeeds_after_two_failures() {
        let cb = CircuitBreaker::new(10, Duration::from_secs(60));
        let policy = RetryPolicy {
            max_attempts: 3,
            initial_backoff: Duration::from_millis(10),
            max_backoff: Duration::from_millis(10),
            multiplier: 1.0,
            jitter: 0.0,
        };
        let counter = Arc::new(AU32::new(0));
        let c = counter.clone();
        let breaker = cb.clone();
        let result: Result<&'static str, RetryableError> =
            with_retry_and_cb(&breaker, &policy, || {
                let c = c.clone();
                async move {
                    let n = c.fetch_add(1, AOrd::SeqCst);
                    if n < 2 {
                        Err(RetryableError::Retryable("simulated".into()))
                    } else {
                        Ok("ok")
                    }
                }
            })
            .await;
        assert_eq!(result, Ok("ok"));
        assert_eq!(counter.load(AOrd::SeqCst), 3);
        assert_eq!(breaker.state(), CircuitState::Closed);
    }

    #[tokio::test]
    async fn with_retry_exhausts_on_retryable_error() {
        let cb = CircuitBreaker::new(100, Duration::from_secs(60));
        let policy = RetryPolicy {
            max_attempts: 2,
            initial_backoff: Duration::from_millis(1),
            max_backoff: Duration::from_millis(1),
            multiplier: 1.0,
            jitter: 0.0,
        };
        let counter = Arc::new(AU32::new(0));
        let c = counter.clone();
        let breaker = cb.clone();
        let result: Result<(), RetryableError> = with_retry_and_cb(&breaker, &policy, || {
            let c = c.clone();
            async move {
                c.fetch_add(1, AOrd::SeqCst);
                Err(RetryableError::Retryable("always".into()))
            }
        })
        .await;
        assert!(matches!(result, Err(RetryableError::Retryable(_))));
        assert_eq!(counter.load(AOrd::SeqCst), 3);
    }

    #[tokio::test]
    async fn with_retry_terminal_error_is_not_retried() {
        let cb = CircuitBreaker::new(100, Duration::from_secs(60));
        let policy = RetryPolicy::default();
        let counter = Arc::new(AU32::new(0));
        let c = counter.clone();
        let breaker = cb.clone();
        let result: Result<(), RetryableError> = with_retry_and_cb(&breaker, &policy, || {
            let c = c.clone();
            async move {
                c.fetch_add(1, AOrd::SeqCst);
                Err(RetryableError::Terminal("400 bad request".into()))
            }
        })
        .await;
        assert!(matches!(result, Err(RetryableError::Terminal(_))));
        assert_eq!(counter.load(AOrd::SeqCst), 1);
        assert_eq!(breaker.failures(), 0);
    }

    #[tokio::test]
    async fn with_retry_fails_fast_when_circuit_open() {
        let cb = CircuitBreaker::new(1, Duration::from_secs(60));
        cb.on_failure();
        assert_eq!(cb.state(), CircuitState::Open);
        let counter = Arc::new(AU32::new(0));
        let c = counter.clone();
        let breaker = cb.clone();
        let result: Result<(), RetryableError> =
            with_retry_and_cb(&breaker, &RetryPolicy::default(), || {
                let c = c.clone();
                async move {
                    c.fetch_add(1, AOrd::SeqCst);
                    Ok(())
                }
            })
            .await;
        assert!(matches!(result, Err(RetryableError::Retryable(_))));
        assert_eq!(counter.load(AOrd::SeqCst), 0);
    }
}
