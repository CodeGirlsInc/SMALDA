use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;

pub type DefaultRateLimiter = RateLimiter<
    governor::state::NotKeyed,
    governor::state::InMemoryState,
    governor::clock::DefaultClock,
>;

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
