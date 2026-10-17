//! A `governor`-based rate limiter builder.
//!
//! Builds the independent process-wide quotas used by the Axum router.
//! Verification and other routes use `RATE_LIMIT_*`; `/submit` uses the
//! lower `SUBMIT_RATE_LIMIT_*` quota. These are global per service instance,
//! not per-client limits; the API currently has no authenticated client ID.
//!
//! [`RateLimitPolicy`] wraps the limiter together with the quota it was built
//! from, so a rejection can be turned into a `Retry-After` value without
//! introspecting `governor`'s internals. See [`RateLimitPolicy::retry_after_secs`]
//! for why that is a calculation rather than a lookup.

use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;
use std::time::Duration;

pub type DefaultRateLimiter = RateLimiter<
    governor::state::NotKeyed,
    governor::state::InMemoryState,
    governor::clock::DefaultClock,
>;

/// A rate limiter bundled with the quota parameters it was built from.
///
/// `Retry-After` (RFC 9110 §10.2.3) asks the server to tell a client *when* it
/// may retry. Returning the bare status code with no hint forces clients into
/// either fixed sleeps or aggressive immediate retries.
///
/// Deriving the value needs the quota, and `governor` does not expose a quota
/// from a built limiter. Keeping the two numbers alongside the limiter is the
/// simplest way to stay honest about where the answer comes from.
pub struct RateLimitPolicy {
    limiter: DefaultRateLimiter,
    per_second: u32,
}

impl RateLimitPolicy {
    /// Build a policy allowing `per_second` sustained requests with a burst
    /// capacity of `burst`.
    ///
    /// Panics if either argument is zero (`NonZeroU32::new(...).unwrap()`).
    pub fn new(per_second: u32, burst: u32) -> Self {
        let quota = Quota::per_second(NonZeroU32::new(per_second).unwrap())
            .allow_burst(NonZeroU32::new(burst).unwrap());

        Self {
            limiter: RateLimiter::direct(quota),
            per_second,
        }
    }

    /// Consume one token, or report how long the caller should wait.
    ///
    /// The error is the number of seconds to put in `Retry-After`.
    pub fn check(&self) -> Result<(), u64> {
        self.limiter.check().map_err(|_| self.retry_after_secs())
    }

    /// Seconds a rejected client should wait before retrying.
    ///
    /// A rejection means the bucket is empty. The quota refills continuously at
    /// `per_second` tokens per second, so the next token appears at most
    /// `1 / per_second` seconds from now — never the whole `burst` window, and
    /// never more than a second for any quota `config.rs` accepts (`per_second`
    /// is validated to be greater than zero).
    ///
    /// That last part is worth stating plainly rather than hiding behind a
    /// formula: for every valid configuration this evaluates to 1 second. It is
    /// still computed rather than hardcoded so the value stays correct if the
    /// quota is ever switched to a coarser unit such as per-minute, where the
    /// rounding would start to matter.
    pub fn retry_after_secs(&self) -> u64 {
        // Ceiling division written out rather than with `div_ceil`: the crate
        // pins 1.82 in `contract/rust-toolchain.toml` while the workspace root
        // pins 1.89, and the two disagree (see #1452), so this avoids depending
        // on when a given intrinsic stabilised.
        let per_second = self.per_second.max(1) as u64;

        // Microseconds until one token refills: ceil(1_000_000 / per_second).
        let one_token_micros = (1_000_000 + per_second - 1) / per_second;
        // Round up to whole seconds, and never report zero.
        let secs = (one_token_micros + 999_999) / 1_000_000;

        secs.max(1)
    }
}

/// Build an in-memory rate limiter allowing `per_second` sustained requests
/// with a burst capacity of `burst`.
///
/// Panics if either argument is zero (`NonZeroU32::new(...).unwrap()`).
pub fn build_rate_limiter(per_second: u32, burst: u32) -> RateLimitPolicy {
    RateLimitPolicy::new(per_second, burst)
}

/// Total time to wait, for callers that prefer a `Duration`.
pub fn retry_after_duration(secs: u64) -> Duration {
    Duration::from_secs(secs)
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

    // ── Retry-After ───────────────────────────────────────────────

    #[test]
    fn retry_after_is_at_least_one_second_for_every_accepted_quota() {
        // `config.rs` rejects `per_second == 0`, so this is the whole domain.
        // Never return 0: a client that honours `Retry-After: 0` retries
        // immediately and gets rejected again, which is the failure mode this
        // issue is about.
        for per_second in [1u32, 2, 3, 10, 50, 100, 1_000] {
            let policy = RateLimitPolicy::new(per_second, per_second);
            let secs = policy.retry_after_secs();
            assert!(
                secs >= 1,
                "per_second={} produced Retry-After: 0",
                per_second
            );
        }
    }

    #[test]
    fn retry_after_never_exceeds_one_token_interval() {
        // The bucket refills a full token within 1/per_second, so promising
        // longer than that would be lying to the client and just adds latency.
        for per_second in [1u32, 7, 10, 99] {
            let policy = RateLimitPolicy::new(per_second, per_second);
            let per_second = per_second as u64;
            let one_token_micros = (1_000_000 + per_second - 1) / per_second;
            let upper_bound_secs = (one_token_micros + 999_999) / 1_000_000;
            assert!(
                policy.retry_after_secs() <= upper_bound_secs,
                "per_second={} promised more than one token interval",
                per_second
            );
        }
    }

    #[test]
    fn check_reports_retry_after_once_the_burst_is_spent() {
        let policy = RateLimitPolicy::new(1, 2);
        assert!(policy.check().is_ok());
        assert!(policy.check().is_ok());

        // Burst exhausted. The error is the Retry-After value, not a bool.
        let secs = policy.check().expect_err("third check should be rejected");
        assert!(
            (1..=2).contains(&secs),
            "expected a bounded Retry-After, got {}",
            secs
        );
    }

    #[test]
    fn check_error_matches_retry_after_secs() {
        // The header and the policy must not drift apart.
        let policy = RateLimitPolicy::new(5, 1);
        assert!(policy.check().is_ok());
        let from_check = policy.check().expect_err("burst of 1 is spent");
        assert_eq!(from_check, policy.retry_after_secs());
    }

    #[test]
    fn retry_after_duration_matches_the_header_value() {
        assert_eq!(retry_after_duration(3), Duration::from_secs(3));
    }
}