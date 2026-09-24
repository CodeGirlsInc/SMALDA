//! Distinguishes a network timeout (retryable) from a Horizon-returned
//! business error (not blindly retryable) for retry purposes.

pub enum HorizonOutcome {
    Timeout,
    BusinessError { status: u16 },
    Success,
}

pub fn should_retry(outcome: &HorizonOutcome) -> bool {
    matches!(outcome, HorizonOutcome::Timeout)
}

#[test]
fn timeout_is_retried_but_business_error_is_not() {
    assert!(should_retry(&HorizonOutcome::Timeout));
    assert!(!should_retry(&HorizonOutcome::BusinessError { status: 400 }));
}
