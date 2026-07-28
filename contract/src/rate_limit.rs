//! A `governor`-based rate limiter builder.
//!
//! **Not currently wired into the service.** [`build_rate_limiter`] is
//! defined but never called from `main.rs` or the Axum router - see the
//! "Known issues" section of `contract/README.md`. `RATE_LIMIT_PER_SECOND`
//! / `RATE_LIMIT_BURST` are parsed by [`crate::config::AppConfig`] but not
//! currently enforced anywhere.

use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;

pub type DefaultRateLimiter = RateLimiter<
    governor::state::NotKeyed,
    governor::state::InMemoryState,
    governor::clock::DefaultClock,
>;

/// Build an in-memory, non-keyed rate limiter allowing `per_second`
/// sustained requests with a burst capacity of `burst`.
///
/// Panics if either argument is zero (`NonZeroU32::new(...).unwrap()`).
pub fn build_rate_limiter(per_second: u32, burst: u32) -> DefaultRateLimiter {
    let quota = Quota::per_second(NonZeroU32::new(per_second).unwrap())
        .allow_burst(NonZeroU32::new(burst).unwrap());
    RateLimiter::direct(quota)
}
