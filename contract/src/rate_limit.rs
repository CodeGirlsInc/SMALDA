// Rate limiting can be added using governor crate
// Example implementation for future enhancement

use std::sync::Arc;
use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;

pub struct RateLimitService {
    limiter: Arc<RateLimiter<String, governor::state::keyed::DefaultKeyedStateStore<String>, governor::clock::DefaultClock>>,
}

impl RateLimitService {
    pub fn new(per_second: u32) -> Self {
        let quota = Quota::per_second(NonZeroU32::new(per_second).unwrap());
        let limiter = Arc::new(RateLimiter::keyed(quota));
        Self { limiter }
    }
}
