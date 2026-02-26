use std::sync::atomic::{AtomicU32, AtomicU64, AtomicU8, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

// Circuit breaker states encoded as u8
const STATE_CLOSED: u8 = 0;
const STATE_OPEN: u8 = 1;
const STATE_HALF_OPEN: u8 = 2;

#[derive(Debug, Clone, PartialEq)]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

impl CircuitState {
    pub fn as_str(&self) -> &'static str {
        match self {
            CircuitState::Closed => "closed",
            CircuitState::Open => "open",
            CircuitState::HalfOpen => "half_open",
        }
    }
}

#[derive(Debug, Clone)]
pub struct CircuitBreakerConfig {
    pub failure_threshold: u32,  // failures before opening
    pub success_threshold: u32,  // successes in HalfOpen before closing
    pub timeout_secs: u64,       // seconds before trying HalfOpen
}

impl Default for CircuitBreakerConfig {
    fn default() -> Self {
        Self {
            failure_threshold: 5,
            success_threshold: 2,
            timeout_secs: 30,
        }
    }
}

#[derive(Debug)]
pub struct CircuitBreaker {
    state: AtomicU8,
    failure_count: AtomicU32,
    success_count: AtomicU32,
    opened_at: AtomicU64, // Unix timestamp secs when circuit opened
    config: CircuitBreakerConfig,
}

impl CircuitBreaker {
    pub fn new(config: CircuitBreakerConfig) -> Arc<Self> {
        Arc::new(Self {
            state: AtomicU8::new(STATE_CLOSED),
            failure_count: AtomicU32::new(0),
            success_count: AtomicU32::new(0),
            opened_at: AtomicU64::new(0),
            config,
        })
    }

    pub fn state(&self) -> CircuitState {
        match self.state.load(Ordering::Acquire) {
            STATE_OPEN => CircuitState::Open,
            STATE_HALF_OPEN => CircuitState::HalfOpen,
            _ => CircuitState::Closed,
        }
    }

    fn now_secs() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    }

    /// Returns Ok(()) if the request should be allowed through, Err if circuit is open.
    pub fn before_request(&self) -> Result<(), CircuitOpenError> {
        loop {
            let state = self.state.load(Ordering::Acquire);
            match state {
                STATE_CLOSED => return Ok(()),
                STATE_OPEN => {
                    // Check if timeout has elapsed to transition to HalfOpen
                    let opened_at = self.opened_at.load(Ordering::Acquire);
                    let elapsed = Self::now_secs().saturating_sub(opened_at);
                    if elapsed >= self.config.timeout_secs {
                        // Try to transition to HalfOpen
                        if self
                            .state
                            .compare_exchange(
                                STATE_OPEN,
                                STATE_HALF_OPEN,
                                Ordering::AcqRel,
                                Ordering::Acquire,
                            )
                            .is_ok()
                        {
                            self.success_count.store(0, Ordering::Release);
                            return Ok(()); // Allow this one through
                        }
                        // Another thread changed state, loop again
                        continue;
                    }
                    return Err(CircuitOpenError {
                        remaining_secs: self.config.timeout_secs - elapsed,
                    });
                }
                STATE_HALF_OPEN => {
                    // Allow request through; caller must call on_success/on_failure
                    return Ok(());
                }
                _ => return Ok(()),
            }
        }
    }

    /// Call after a successful request completes.
    pub fn on_success(&self) {
        let state = self.state.load(Ordering::Acquire);
        match state {
            STATE_CLOSED => {
                // Reset failure count on success
                self.failure_count.store(0, Ordering::Release);
            }
            STATE_HALF_OPEN => {
                let successes = self.success_count.fetch_add(1, Ordering::AcqRel) + 1;
                if successes >= self.config.success_threshold {
                    // Transition back to Closed
                    self.state.store(STATE_CLOSED, Ordering::Release);
                    self.failure_count.store(0, Ordering::Release);
                    self.success_count.store(0, Ordering::Release);
                }
            }
            _ => {}
        }
    }

    /// Call after a failed request.
    pub fn on_failure(&self) {
        let state = self.state.load(Ordering::Acquire);
        match state {
            STATE_CLOSED => {
                let failures = self.failure_count.fetch_add(1, Ordering::AcqRel) + 1;
                if failures >= self.config.failure_threshold {
                    self.trip();
                }
            }
            STATE_HALF_OPEN => {
                // Single failure in HalfOpen reopens the circuit
                self.trip();
            }
            _ => {}
        }
    }

    fn trip(&self) {
        self.opened_at.store(Self::now_secs(), Ordering::Release);
        self.state.store(STATE_OPEN, Ordering::Release);
        self.failure_count.store(0, Ordering::Release);
        self.success_count.store(0, Ordering::Release);
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct CircuitOpenError {
    pub remaining_secs: u64,
}

impl std::fmt::Display for CircuitOpenError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "Circuit breaker is open; retry after {} seconds",
            self.remaining_secs
        )
    }
}

impl std::error::Error for CircuitOpenError {}

// ─── StellarClient integration ───────────────────────────────────────────────

#[derive(Debug)]
pub enum StellarError {
    CircuitOpen(CircuitOpenError),
    Http(String),
}

impl std::fmt::Display for StellarError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StellarError::CircuitOpen(e) => write!(f, "CircuitOpen: {}", e),
            StellarError::Http(msg) => write!(f, "Http error: {}", msg),
        }
    }
}

impl std::error::Error for StellarError {}

pub struct StellarClient {
    pub breaker: Arc<CircuitBreaker>,
    horizon_url: String,
}

impl StellarClient {
    pub fn new(horizon_url: impl Into<String>, config: CircuitBreakerConfig) -> Self {
        Self {
            breaker: CircuitBreaker::new(config),
            horizon_url: horizon_url.into(),
        }
    }

    /// Execute a Stellar Horizon request through the circuit breaker.
    /// `f` receives the base URL and returns Ok/Err.
    pub fn execute<F, T>(&self, f: F) -> Result<T, StellarError>
    where
        F: FnOnce(&str) -> Result<T, String>,
    {
        self.breaker
            .before_request()
            .map_err(StellarError::CircuitOpen)?;

        match f(&self.horizon_url) {
            Ok(val) => {
                self.breaker.on_success();
                Ok(val)
            }
            Err(e) => {
                self.breaker.on_failure();
                Err(StellarError::Http(e))
            }
        }
    }

    /// Returns the current state as a string, suitable for health endpoints.
    pub fn circuit_state(&self) -> CircuitState {
        self.breaker.state()
    }
}

// ─── Health endpoint helper ───────────────────────────────────────────────────

#[derive(Debug, serde::Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub stellar_circuit: &'static str,
}

impl HealthResponse {
    pub fn from_client(client: &StellarClient) -> Self {
        let state = client.circuit_state();
        Self {
            status: if state == CircuitState::Open {
                "degraded"
            } else {
                "ok"
            },
            stellar_circuit: state.as_str(),
        }
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> CircuitBreakerConfig {
        CircuitBreakerConfig {
            failure_threshold: 3,
            success_threshold: 2,
            timeout_secs: 1, // short timeout for tests
        }
    }

    fn make_breaker() -> Arc<CircuitBreaker> {
        CircuitBreaker::new(test_config())
    }

    // ── Closed → Open transition ─────────────────────────────────────────────

    #[test]
    fn test_closed_to_open_after_threshold_failures() {
        let cb = make_breaker();
        assert_eq!(cb.state(), CircuitState::Closed);

        for _ in 0..2 {
            cb.before_request().unwrap();
            cb.on_failure();
            assert_eq!(cb.state(), CircuitState::Closed, "should still be closed");
        }

        // Third failure trips the breaker
        cb.before_request().unwrap();
        cb.on_failure();
        assert_eq!(cb.state(), CircuitState::Open);
    }

    #[test]
    fn test_open_rejects_immediately() {
        let cb = make_breaker();
        for _ in 0..3 {
            cb.before_request().unwrap();
            cb.on_failure();
        }
        assert_eq!(cb.state(), CircuitState::Open);

        let result = cb.before_request();
        assert!(result.is_err(), "open circuit should reject request");
    }

    // ── Open → HalfOpen transition ───────────────────────────────────────────

    #[test]
    fn test_open_to_half_open_after_timeout() {
        let cb = make_breaker();
        for _ in 0..3 {
            cb.before_request().unwrap();
            cb.on_failure();
        }
        assert_eq!(cb.state(), CircuitState::Open);

        // Simulate timeout by backdating opened_at
        cb.opened_at.store(
            CircuitBreaker::now_secs() - 10, // well past 1-sec timeout
            Ordering::Release,
        );

        // Next request should be allowed and transition to HalfOpen
        cb.before_request().expect("should allow through after timeout");
        assert_eq!(cb.state(), CircuitState::HalfOpen);
    }

    #[test]
    fn test_half_open_failure_reopens() {
        let cb = make_breaker();
        for _ in 0..3 {
            cb.before_request().unwrap();
            cb.on_failure();
        }
        cb.opened_at.store(
            CircuitBreaker::now_secs() - 10,
            Ordering::Release,
        );

        cb.before_request().unwrap(); // transition to HalfOpen
        assert_eq!(cb.state(), CircuitState::HalfOpen);

        cb.on_failure(); // single failure in HalfOpen should reopen
        assert_eq!(cb.state(), CircuitState::Open);
    }

    // ── HalfOpen → Closed transition ─────────────────────────────────────────

    #[test]
    fn test_half_open_to_closed_after_success_threshold() {
        let cb = make_breaker();
        for _ in 0..3 {
            cb.before_request().unwrap();
            cb.on_failure();
        }
        cb.opened_at.store(
            CircuitBreaker::now_secs() - 10,
            Ordering::Release,
        );

        cb.before_request().unwrap(); // transition to HalfOpen
        assert_eq!(cb.state(), CircuitState::HalfOpen);

        cb.on_success(); // first success – still HalfOpen (threshold = 2)
        assert_eq!(cb.state(), CircuitState::HalfOpen);

        cb.on_success(); // second success – should close
        assert_eq!(cb.state(), CircuitState::Closed);
    }

    // ── Success resets failure count in Closed ────────────────────────────────

    #[test]
    fn test_success_resets_failure_count() {
        let cb = make_breaker();

        cb.before_request().unwrap();
        cb.on_failure();
        cb.before_request().unwrap();
        cb.on_failure();
        // Two failures – still closed

        cb.before_request().unwrap();
        cb.on_success(); // reset counter

        // Now two more failures shouldn't open the breaker (counter was reset)
        cb.before_request().unwrap();
        cb.on_failure();
        cb.before_request().unwrap();
        cb.on_failure();
        assert_eq!(cb.state(), CircuitState::Closed);

        // One more failure (total 3) should open it
        cb.before_request().unwrap();
        cb.on_failure();
        assert_eq!(cb.state(), CircuitState::Open);
    }

    // ── StellarClient integration ─────────────────────────────────────────────

    #[test]
    fn test_stellar_client_circuit_open_error() {
        let client = StellarClient::new("https://horizon.stellar.org", test_config());

        for _ in 0..3 {
            let _ = client.execute(|_url| Err("network error".to_string()));
        }

        assert_eq!(client.circuit_state(), CircuitState::Open);

        let result = client.execute(|_url| Ok("should not reach"));
        assert!(matches!(result, Err(StellarError::CircuitOpen(_))));
    }

    // ── Health response ───────────────────────────────────────────────────────

    #[test]
    fn test_health_response_reflects_state() {
        let client = StellarClient::new("https://horizon.stellar.org", test_config());
        let health = HealthResponse::from_client(&client);
        assert_eq!(health.stellar_circuit, "closed");
        assert_eq!(health.status, "ok");

        for _ in 0..3 {
            let _ = client.execute(|_url| Err::<(), String>("err".to_string()));
        }

        let health = HealthResponse::from_client(&client);
        assert_eq!(health.stellar_circuit, "open");
        assert_eq!(health.status, "degraded");
    }
}