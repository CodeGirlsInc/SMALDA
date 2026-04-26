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
