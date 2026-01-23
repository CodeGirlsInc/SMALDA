use napi_derive::napi;
use smalda_core::Extractor;

#[napi]
pub fn extract_metadata(text: String) -> String {
    let extractor = Extractor::new();
    let metadata = extractor.extract(&text);
    serde_json::to_string(&metadata).unwrap()
}
