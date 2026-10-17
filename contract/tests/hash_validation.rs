//! Integration tests for hash validation, non-UTF8 / binary input, and unexpected hash lengths.

use axum::http::StatusCode;
use axum_test::TestServer;
use serde_json::{json, Value};
use std::sync::Arc;
use stellar_doc_verifier::app;
use stellar_doc_verifier::cache::{CacheBackend, InMemoryCache};
use stellar_doc_verifier::hash_validator::{HashAlgorithm, HashValidator, ValidationError};
use stellar_doc_verifier::metrics::MetricsRegistry;
use stellar_doc_verifier::rate_limit::build_rate_limiter;
use stellar_doc_verifier::stellar::StellarClient;
use stellar_doc_verifier::AppState;

const SECRET: &str = "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

fn test_state() -> AppState {
    AppState {
        stellar: Arc::new(StellarClient::new("https://horizon-testnet.stellar.org")),
        cache: Arc::new(CacheBackend::InMemory(InMemoryCache::new())),
        metrics: Arc::new(MetricsRegistry::new()),
        stellar_secret_key: SECRET.to_string(),
        rate_limiter: build_rate_limiter(1000, 1000),
        submit_rate_limiter: build_rate_limiter(1000, 1000),
        webhook_urls: Vec::new(),
        webhook_secret: None,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Non-UTF8 and binary input tests on HashValidator directly
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_hash_validator_rejects_invalid_utf8_binary_bytes() {
    let invalid_bytes: Vec<&[u8]> = vec![
        &[0xFF, 0xFE, 0xFD],
        &[0x80, 0x81, 0x82],
        &[0xC3, 0x28],
        &[0xE2, 0x28, 0xA1],
        &[0xF0, 0x90, 0x28, 0xBC],
        b"\x00\xFF\xFErawbinarydata",
    ];

    for bytes in invalid_bytes {
        assert_eq!(
            HashValidator::validate_sha256_bytes(bytes),
            Err(ValidationError::InvalidUtf8)
        );
        assert_eq!(
            HashValidator::validate_sha512_bytes(bytes),
            Err(ValidationError::InvalidUtf8)
        );
        assert_eq!(
            HashValidator::validate_bytes(bytes, 64),
            Err(ValidationError::InvalidUtf8)
        );
    }
}

#[test]
fn test_hash_validator_unexpected_length_sha256() {
    // Too short
    assert_eq!(
        HashValidator::validate_sha256(""),
        Err(ValidationError::EmptyHash)
    );
    for len in [1, 10, 32, 63] {
        let h = "f".repeat(len);
        assert_eq!(
            HashValidator::validate_sha256(&h),
            Err(ValidationError::WrongLength {
                expected: 64,
                actual: len,
            })
        );
    }

    // Too long
    for len in [65, 100, 128, 256] {
        let h = "f".repeat(len);
        assert_eq!(
            HashValidator::validate_sha256(&h),
            Err(ValidationError::WrongLength {
                expected: 64,
                actual: len,
            })
        );
    }
}

#[test]
fn test_hash_validator_unexpected_length_sha512() {
    // Too short
    assert_eq!(
        HashValidator::validate_sha512(""),
        Err(ValidationError::EmptyHash)
    );
    for len in [1, 32, 64, 127] {
        let h = "f".repeat(len);
        assert_eq!(
            HashValidator::validate_sha512(&h),
            Err(ValidationError::WrongLength {
                expected: 128,
                actual: len,
            })
        );
    }

    // Too long
    for len in [129, 150, 200, 256] {
        let h = "f".repeat(len);
        assert_eq!(
            HashValidator::validate_sha512(&h),
            Err(ValidationError::WrongLength {
                expected: 128,
                actual: len,
            })
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Axum extractor/validator rejection of non-UTF8 / malformed binary input
// ─────────────────────────────────────────────────────────────────────────────

#[test]
fn test_hash_validator_rejects_non_hex_characters_with_position() {
    // Length is exactly right but the content is not hex. Without a position in
    // the error an integrator has to diff the string themselves to find which
    // byte they got wrong.
    let mut hash = "a".repeat(64);
    hash.replace_range(0..1, "g");
    assert_eq!(
        HashValidator::validate_sha256(&hash),
        Err(ValidationError::InvalidCharacter {
            position: 0,
            character: 'g'
        })
    );

    // Uppercase must be accepted, not silently rejected as a non-hex character:
    // both spellings are the same value, and a client that has been talking to a
    // lowercase-only service must not start failing.
    assert!(HashValidator::validate_sha256(&"A".repeat(64)).is_ok());

    for bad in ['g', 'z', ' ', '!', '/'] {
        let mut hash = "a".repeat(64);
        hash.replace_range(10..11, &bad.to_string());
        match HashValidator::validate_sha256(&hash) {
            Err(ValidationError::InvalidCharacter { position, character }) => {
                assert_eq!(position, 10, "position reported for {bad}");
                assert_eq!(character, bad);
            }
            other => panic!("expected InvalidCharacter for {bad}, got {other:?}"),
        }
    }
}

#[test]
fn test_hash_validator_reports_the_expected_length_not_the_algorithm_guess() {
    // A 64-char string offered to the SHA-512 validator is a SHA-256 hash, and
    // the error should say so. Otherwise a caller that mixed up the two helpers
    // sees "expected 64, got 64" and has nothing to act on.
    let sha256 = "a".repeat(64);
    assert_eq!(
        HashValidator::validate_sha512(&sha256),
        Err(ValidationError::WrongLength {
            expected: 128,
            actual: 64
        })
    );

    let sha512 = "a".repeat(128);
    assert_eq!(
        HashValidator::validate_sha256(&sha512),
        Err(ValidationError::WrongLength {
            expected: 64,
            actual: 128
        })
    );
}

#[test]
fn test_hash_validator_normalizes_before_rejecting() {
    // Trimming and lowercasing happen first, so padding and case must not turn a
    // valid hash into a length error.
    assert!(HashValidator::validate_sha256(&format!("  {}  ", "a".repeat(64))).is_ok());

    let mut mixed = "a".repeat(64);
    mixed.replace_range(0..1, "B");
    assert!(HashValidator::validate_sha256(&mixed).is_ok());
}

#[tokio::test]
async fn test_axum_verify_endpoint_rejects_invalid_utf8_binary_body_with_4xx() {
    let server = TestServer::new(app(test_state())).unwrap();

    // Body with non-UTF8 byte sequence in JSON string
    let invalid_utf8_in_json: &[u8] = b"{\"document_hash\": \"\xFF\xFE\xFD\"}";

    let resp = server
        .post("/verify")
        .content_type("application/json")
        .bytes(invalid_utf8_in_json.to_vec().into())
        .await;

    let status = resp.status_code();
    assert!(
        status.is_client_error(),
        "expected a 4xx client error status for invalid UTF-8 in hash field, got {}",
        status
    );
    assert_ne!(status, StatusCode::INTERNAL_SERVER_ERROR);
}

#[tokio::test]
async fn test_axum_endpoints_reject_malformed_binary_payload_cleanly() {
    let server = TestServer::new(app(test_state())).unwrap();

    let raw_binary_body: &[u8] = &[0xDE, 0xAD, 0xBE, 0xEF, 0xFF, 0x00, 0xFE];

    for endpoint in ["/verify", "/submit", "/revoke", "/transfer", "/verify/batch"] {
        let resp = server
            .post(endpoint)
            .content_type("application/json")
            .bytes(raw_binary_body.to_vec().into())
            .await;

        let status = resp.status_code();
        assert!(
            status.is_client_error(),
            "endpoint {} must return 4xx for raw binary payload, got {}",
            endpoint,
            status
        );
        assert_ne!(
            status,
            StatusCode::INTERNAL_SERVER_ERROR,
            "endpoint {} must not panic or 500 on raw binary payload",
            endpoint
        );
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Axum endpoint tests for unexpected hash lengths
// ─────────────────────────────────────────────────────────────────────────────

#[tokio::test]
async fn test_axum_endpoints_reject_unexpected_length_hashes() {
    let server = TestServer::new(app(test_state())).unwrap();

    // 1) Verify endpoint: too short
    let resp_short = server
        .post("/verify")
        .json(&json!({ "document_hash": "abcdef" }))
        .await;
    assert_eq!(resp_short.status_code(), StatusCode::BAD_REQUEST);
    let body_short: Value = resp_short.json();
    assert!(body_short["error"].as_str().unwrap().contains("wrong length"));

    // 2) Verify endpoint: too long (e.g. 65 chars or SHA-512 length 128 chars)
    let resp_long = server
        .post("/verify")
        .json(&json!({ "document_hash": "a".repeat(65) }))
        .await;
    assert_eq!(resp_long.status_code(), StatusCode::BAD_REQUEST);
    let body_long: Value = resp_long.json();
    assert!(body_long["error"].as_str().unwrap().contains("wrong length"));

    // 3) Verify endpoint: empty
    let resp_empty = server
        .post("/verify")
        .json(&json!({ "document_hash": "" }))
        .await;
    assert_eq!(resp_empty.status_code(), StatusCode::BAD_REQUEST);
    let body_empty: Value = resp_empty.json();
    assert!(body_empty["error"].as_str().unwrap().contains("empty"));

    // 4) Submit endpoint: unexpected length
    let resp_submit = server
        .post("/submit")
        .json(&json!({
            "document_hash": "12345",
            "document_id": "doc-1",
            "submitter": "tester"
        }))
        .await;
    assert_eq!(resp_submit.status_code(), StatusCode::BAD_REQUEST);

    // 5) Revoke endpoint: unexpected length
    let resp_revoke = server
        .post("/revoke")
        .json(&json!({
            "document_hash": "a".repeat(128), // 128 chars is invalid for sha256 revoke
            "reason": "testing",
            "revoked_by": "tester"
        }))
        .await;
    assert_eq!(resp_revoke.status_code(), StatusCode::BAD_REQUEST);
}
