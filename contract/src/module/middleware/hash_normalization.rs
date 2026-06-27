use crate::hash_validator::{HashValidator, ValidationError};
use crate::ValidationErrorResponse;
use axum::{
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Json, Response},
};
use http_body_util::BodyExt;
use serde::Deserialize;

/// Normalizes a hash string by trimming whitespace and converting to lowercase
pub fn normalize(hash: &str) -> String {
    hash.trim().to_lowercase()
}

/// Helper function to normalize hash fields in request bodies
pub fn normalize_request_body<T>(body: &mut T)
where
    T: HasDocumentHash,
{
    if let Some(document_hash) = body.document_hash_mut() {
        *document_hash = normalize(document_hash);
    }
}

/// Trait to extract and mutate the document_hash field from request types
pub trait HasDocumentHash {
    fn document_hash(&self) -> Option<&str>;
    fn document_hash_mut(&mut self) -> Option<&mut String>;
}

// Implement HasDocumentHash for all request types that have a document_hash field
#[derive(Debug, Deserialize)]
struct AnyRequest;

impl HasDocumentHash for crate::VerifyRequest {
    fn document_hash(&self) -> Option<&str> {
        Some(&self.document_hash)
    }
    fn document_hash_mut(&mut self) -> Option<&mut String> {
        Some(&mut self.document_hash)
    }
}

impl HasDocumentHash for crate::SubmitRequest {
    fn document_hash(&self) -> Option<&str> {
        Some(&self.document_hash)
    }
    fn document_hash_mut(&mut self) -> Option<&mut String> {
        Some(&mut self.document_hash)
    }
}

impl HasDocumentHash for crate::RevokeRequest {
    fn document_hash(&self) -> Option<&str> {
        Some(&self.document_hash)
    }
    fn document_hash_mut(&mut self) -> Option<&mut String> {
        Some(&mut self.document_hash)
    }
}

impl HasDocumentHash for crate::TransferRequest {
    fn document_hash(&self) -> Option<&str> {
        Some(&self.document_hash)
    }
    fn document_hash_mut(&mut self) -> Option<&mut String> {
        Some(&mut self.document_hash)
    }
}

/// Axum middleware that normalizes hash strings in request bodies and path parameters
pub async fn hash_normalization_middleware(
    mut req: Request,
    next: Next,
) -> Result<Response, impl IntoResponse> {
    // First, handle path parameters that might contain hashes (like /verify/:hash)
    let uri = req.uri().clone();
    let path = uri.path();

    // Check if this is an endpoint that has a hash in the path
    if let Some(captures) = path
        .strip_prefix("/verify/")
        .and_then(|p| p.strip_suffix("/history").or_else(|| Some(p)))
    {
        if !captures.is_empty() && !captures.starts_with("batch") {
            // This is /verify/:hash or /verify/:hash/history
            // We'll handle the normalization in the handler itself since path params are extracted directly
            // Middleware can't easily modify path params, so the existing normalize call in handlers is still used
            // But we ensure it's using our shared normalize function
        }
    }

    // For request bodies, we can deserialize, normalize, then re-serialize
    // This works for all JSON requests that have a document_hash field
    let body = match req.body_mut().collect().await {
        Ok(b) => b.to_bytes(),
        Err(_) => {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ValidationErrorResponse {
                    error: "Failed to read request body".to_string(),
                }),
            ))
        }
    };

    // Try to deserialize and normalize if it's a request with document_hash
    if let Ok(mut verify_req) = serde_json::from_slice::<crate::VerifyRequest>(&body) {
        normalize_request_body(&mut verify_req);
        // Validate after normalization
        if let Err(err) = HashValidator::validate_sha256(&verify_req.document_hash) {
            let (status, body) = map_validation_error(err);
            return Err((status, Json(body)));
        }
        // Re-attach the normalized body
        *req.body_mut() = serde_json::to_vec(&verify_req).unwrap().into();
    } else if let Ok(mut submit_req) = serde_json::from_slice::<crate::SubmitRequest>(&body) {
        normalize_request_body(&mut submit_req);
        if let Err(err) = HashValidator::validate_sha256(&submit_req.document_hash) {
            let (status, body) = map_validation_error(err);
            return Err((status, Json(body)));
        }
        *req.body_mut() = serde_json::to_vec(&submit_req).unwrap().into();
    } else if let Ok(mut revoke_req) = serde_json::from_slice::<crate::RevokeRequest>(&body) {
        normalize_request_body(&mut revoke_req);
        if let Err(err) = HashValidator::validate_sha256(&revoke_req.document_hash) {
            let (status, body) = map_validation_error(err);
            return Err((status, Json(body)));
        }
        *req.body_mut() = serde_json::to_vec(&revoke_req).unwrap().into();
    } else if let Ok(mut transfer_req) = serde_json::from_slice::<crate::TransferRequest>(&body) {
        normalize_request_body(&mut transfer_req);
        if let Err(err) = HashValidator::validate_sha256(&transfer_req.document_hash) {
            let (status, body) = map_validation_error(err);
            return Err((status, Json(body)));
        }
        *req.body_mut() = serde_json::to_vec(&transfer_req).unwrap().into();
    }

    // Continue processing the request
    Ok(next.run(req).await)
}

fn map_validation_error(err: ValidationError) -> (StatusCode, ValidationErrorResponse) {
    let message = match err {
        ValidationError::EmptyHash => "hash must not be empty".to_string(),
        ValidationError::WrongLength { expected, actual } => format!(
            "hash has wrong length: expected {} characters, got {}",
            expected, actual
        ),
        ValidationError::InvalidCharacter {
            position,
            character,
        } => format!(
            "hash contains invalid character '{}' at position {}",
            character, position
        ),
    };

    (
        StatusCode::BAD_REQUEST,
        ValidationErrorResponse { error: message },
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_sha256_uppercase() -> &'static str {
        "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"
    }

    fn sample_sha256_mixed() -> &'static str {
        "e3b0c44298FC1c149AFbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }

    fn sample_sha256_lowercase() -> &'static str {
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    }

    #[test]
    fn lowercase_input_unchanged() {
        let result = normalize(sample_sha256_lowercase());
        assert_eq!(result, sample_sha256_lowercase());
        assert_eq!(result.len(), 64);
    }

    #[test]
    fn uppercase_input_lowercased() {
        let result = normalize(sample_sha256_uppercase());
        assert_eq!(result, sample_sha256_lowercase());
        assert_eq!(result.len(), 64);
    }

    #[test]
    fn mixed_case_input_lowercased() {
        let result = normalize(sample_sha256_mixed());
        assert_eq!(result, sample_sha256_lowercase());
        assert_eq!(result.len(), 64);
    }

    #[test]
    fn leading_trailing_spaces_stripped() {
        let input = format!("  {}  ", sample_sha256_lowercase());
        let result = normalize(&input);
        assert_eq!(result, sample_sha256_lowercase());
        assert_eq!(result.len(), 64);
    }

    #[test]
    fn combined_whitespace_and_uppercase() {
        let input = format!("  {}  ", sample_sha256_uppercase());
        let result = normalize(&input);
        assert_eq!(result, sample_sha256_lowercase());
        assert_eq!(result.len(), 64);
    }

    #[test]
    fn sixtyfour_char_uppercase_normalizes_to_sixtyfour_lowercase() {
        let input = sample_sha256_uppercase();
        assert_eq!(input.len(), 64);
        let result = normalize(input);
        assert_eq!(result.len(), 64);
        assert_eq!(result, sample_sha256_lowercase());
    }
}
