//! A `governor`-based rate limiter builder.
//!
//! Builds the independent process-wide quotas used by the Axum router.
//! Verification and other routes use `RATE_LIMIT_*`; `/submit` uses the
//! lower `SUBMIT_RATE_LIMIT_*` quota. These are global per service instance,
//! not per-client limits; the API currently has no authenticated client ID.

use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;

pub type DefaultRateLimiter = RateLimiter<
    governor::state::NotKeyed,
    governor::state::InMemoryState,
    governor::clock::DefaultClock,
>;

/// Build an in-memory rate limiter allowing `per_second` sustained requests
/// with a burst capacity of `burst`.
///
/// Panics if either argument is zero (`NonZeroU32::new(...).unwrap()`).
pub fn build_rate_limiter(per_second: u32, burst: u32) -> DefaultRateLimiter {
    let quota = Quota::per_second(NonZeroU32::new(per_second).unwrap())
        .allow_burst(NonZeroU32::new(burst).unwrap());
    RateLimiter::direct(quota)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_rate_limiter_does_not_panic() {
        let _limiter = build_rate_limiter(10, 10);
    }

    #[test]
    fn test_rate_limiter_allows_first_request() {
        let limiter = build_rate_limiter(10, 10);
        assert!(limiter.check().is_ok());
    }

    #[test]
    fn test_rate_limiter_allows_burst() {
        let limiter = build_rate_limiter(10, 5);
        for _ in 0..5 {
            assert!(limiter.check().is_ok());
        }
    }

    #[test]
    fn test_build_rate_limiter_various_burst_values() {
        let _l1 = build_rate_limiter(1, 1);
        let _l2 = build_rate_limiter(100, 200);
        let _l3 = build_rate_limiter(50, 50);
    }
}
