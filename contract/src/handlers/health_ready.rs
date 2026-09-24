//! Splits liveness from readiness so an orchestrator can distinguish a
//! dead process from a live process with an unreachable dependency.

pub struct ReadinessStatus {
    pub redis_reachable: bool,
    pub horizon_reachable: bool,
}

impl ReadinessStatus {
    pub fn is_ready(&self) -> bool {
        self.redis_reachable && self.horizon_reachable
    }
}

pub fn liveness() -> bool {
    // The process handling this request is, by definition, alive.
    true
}

pub fn readiness(status: &ReadinessStatus) -> bool {
    status.is_ready()
}
