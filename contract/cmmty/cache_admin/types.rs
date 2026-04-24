use serde::Serialize;

#[derive(Serialize)]
pub struct CacheResult {
    pub invalidated: usize,
}