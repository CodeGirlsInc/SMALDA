//! Small shared helpers for #1386, #1428, #1432 and #1440.
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Mutex;

/// #1386: parse a config value into its real type at load time.
pub fn parse_typed<T: FromStr>(key: &str, raw: &str) -> Result<T, String> {
    raw.trim().parse::<T>().map_err(|_| format!("invalid value for {key}: {raw:?}"))
}

/// #1428: one cache-key scheme for submit, revoke, transfer and verify.
pub mod cache_keys {
    pub fn verify_key(hash: &str) -> String { format!("stellar:verify:{hash}") }
    pub fn transfer_key(hash: &str) -> String { format!("transfer:{hash}") }
    pub fn audit_key(hash: &str) -> String { format!("audit:{hash}") }
}

/// #1432: atomic append (Redis RPUSH semantics); in-memory version for tests.
#[derive(Default)]
pub struct InMemoryAppendLog {
    inner: Mutex<HashMap<String, Vec<String>>>,
}

impl InMemoryAppendLog {
    pub fn append(&self, key: &str, value: String) -> usize {
        let mut map = self.inner.lock().expect("append log poisoned");
        let list = map.entry(key.to_string()).or_default();
        list.push(value);
        list.len()
    }

    pub fn list(&self, key: &str) -> Vec<String> {
        self.inner.lock().expect("append log poisoned").get(key).cloned().unwrap_or_default()
    }
}

/// #1440: shared ManageData entry builder for anchor_hash / anchor_transfer / anchor_revocation.
pub fn manage_data_entry(kind: &str, hash: &str) -> (String, Vec<u8>) {
    let name: String = format!("smalda:{kind}").chars().take(64).collect();
    (name, hash.as_bytes().iter().take(64).copied().collect())
}
