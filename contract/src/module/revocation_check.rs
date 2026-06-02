use anyhow::Result;

use crate::cache::CacheBackend;

pub async fn is_revoked(cache: &CacheBackend, document_hash: &str) -> Result<bool> {
    let key = format!("revoke:{}", document_hash);
    is_revoked_with_lookup(|| async { cache.get_raw(&key).await }).await
}

async fn is_revoked_with_lookup<F, Fut>(lookup: F) -> Result<bool>
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Result<Option<String>>>,
{
    Ok(lookup().await?.is_some())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cache::{CacheBackend, InMemoryCache};
    use anyhow::anyhow;

    fn sample_hash() -> &'static str {
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }

    #[tokio::test]
    async fn returns_false_when_revocation_key_is_absent() {
        let cache = CacheBackend::InMemory(InMemoryCache::new());
        let revoked = is_revoked(&cache, sample_hash()).await.unwrap();
        assert!(!revoked);
    }

    #[tokio::test]
    async fn returns_true_when_revocation_key_exists() {
        let cache = CacheBackend::InMemory(InMemoryCache::new());
        let key = format!("revoke:{}", sample_hash());
        cache.set_raw(&key, "revoked", 60).await.unwrap();

        let revoked = is_revoked(&cache, sample_hash()).await.unwrap();
        assert!(revoked);
    }

    #[tokio::test]
    async fn returns_error_when_lookup_fails() {
        let error = is_revoked_with_lookup(|| async { Err(anyhow!("redis failure")) })
            .await
            .unwrap_err();
        assert_eq!(error.to_string(), "redis failure");
    }
}
