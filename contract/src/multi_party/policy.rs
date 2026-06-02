use crate::multi_party::error::MultiPartyError;
use crate::multi_party::types::MultiPartyPolicy;
use std::collections::HashSet;

pub fn default_land_sale_policy() -> MultiPartyPolicy {
    let mut allowed = HashSet::new();
    allowed.insert("seller".to_string());
    allowed.insert("buyer".to_string());
    allowed.insert("notary".to_string());

    MultiPartyPolicy {
        required_signatures: 3,
        allowed_verifiers: allowed,
        policy_name: "land_sale".to_string(),
    }
}

pub fn default_internal_review_policy() -> MultiPartyPolicy {
    let mut allowed = HashSet::new();
    allowed.insert("dept_lead_1".to_string());
    allowed.insert("dept_lead_2".to_string());
    allowed.insert("dept_lead_3".to_string());
    allowed.insert("dept_lead_4".to_string());
    allowed.insert("dept_lead_5".to_string());

    MultiPartyPolicy {
        required_signatures: 2,
        allowed_verifiers: allowed,
        policy_name: "internal_review".to_string(),
    }
}

pub fn from_policy_name(name: &str) -> Result<MultiPartyPolicy, MultiPartyError> {
    match name {
        "land_sale" => Ok(default_land_sale_policy()),
        "internal_review" => Ok(default_internal_review_policy()),
        _ => Err(MultiPartyError::StorageError),
    }
}
