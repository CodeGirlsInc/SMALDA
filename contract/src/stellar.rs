use anyhow::{anyhow, Result};
use base64::Engine as _;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum StellarError {
    #[error("HTTP request failed: {0}")]
    HttpRequestFailed(#[from] reqwest::Error),
    
    #[error("Horizon returned error status: {0}")]
    HorizonErrorStatus(reqwest::StatusCode),
    
    #[error("Failed to parse response: {0}")]
    ResponseParseError(#[from] serde_json::Error),
    
    #[error("Request timed out")]
    Timeout,
    
    #[error("Connection failed")]
    ConnectionFailed,
}

#[derive(Debug, Clone)]
pub struct StellarClient {
    horizon_url: String,
    http_client: reqwest::Client,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TransactionRecord {
    pub transaction_id: String,
    pub timestamp: i64,
    pub verified: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct VerificationResult {
    pub verified: bool,
    pub transaction_id: Option<String>,
    pub timestamp: Option<i64>,
    pub data_key: Option<String>,
    pub raw_value: Option<String>,
    pub decoded_value: Option<String>,
}

/// Verification details matching NestJS verification response payload format.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VerificationRecord {
    pub hash: String,
    pub anchored: bool,
    pub data_key: String,
    pub transaction_id: Option<String>,
    pub timestamp: Option<i64>,
    pub raw_value_base64: Option<String>,
    pub decoded_value: Option<String>,
}

/// History entry for GET /verify/:hash/history (CT-03 / CT-04 compatibility).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryEntry {
    pub id: String,
    pub transaction_hash: String,
    pub created_at: String,
    pub data_name: String,
    pub data_value_base64: Option<String>,
    pub decoded_value: Option<String>,
}

/// Successful result returned by [`StellarClient::anchor_hash`].
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnchorResult {
    /// Stellar transaction hash.
    pub tx_hash: String,
    /// Ledger sequence number where the transaction was included.
    pub ledger: u32,
    /// Unix timestamp (seconds) when the transaction was anchored.
    pub anchored_at: i64,
}

/// Horizon account object (subset of fields).
#[derive(Debug, Deserialize)]
struct HorizonAccount {
    sequence: String,
    #[serde(default)]
    data: HashMap<String, String>,
}

/// Horizon transaction submission response (subset of fields).
#[derive(Debug, Deserialize)]
struct HorizonTxResponse {
    hash: String,
    ledger: u32,
    created_at: Option<String>,
}

/// Horizon error envelope returned on failure.
#[derive(Debug, Deserialize)]
struct HorizonError {
    detail: Option<String>,
    title: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HorizonTransaction {
    id: String,
    created_at: String,
}

#[derive(Debug, Deserialize)]
struct HorizonTransactionsResponse {
    _embedded: HorizonEmbedded,
}

#[derive(Debug, Deserialize)]
struct HorizonEmbedded {
    records: Vec<HorizonTransaction>,
}

impl StellarClient {
    /// Create a new client with sensible timeout and connection-pool defaults.
    pub fn new(horizon_url: &str) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");
            
        Self {
            horizon_url: horizon_url.to_string(),
            http_client,
        }
    }

    pub async fn check_connection(&self) -> Result<bool, StellarError> {
        let result = self.http_client
            .get(&self.horizon_url)
            .send()
            .await;
            
        match result {
            Ok(resp) => Ok(resp.status().is_success()),
            Err(e) if e.is_timeout() => Err(StellarError::Timeout),
            Err(e) if e.is_connect() => Err(StellarError::ConnectionFailed),
            Err(e) => Err(StellarError::HttpRequestFailed(e)),
        }
    }

    pub async fn verify_hash(&self, hash: &str) -> Result<VerificationResult, StellarError> {
        let url = format!("{}/transactions?memo={}", self.horizon_url, hash);
        let resp = match self.http_client.get(&url).send().await {
            Ok(r) => r,
            Err(e) if e.is_timeout() => return Err(StellarError::Timeout),
            Err(e) if e.is_connect() => return Err(StellarError::ConnectionFailed),
            Err(e) => return Err(StellarError::HttpRequestFailed(e)),
        };

        if !resp.status().is_success() {
            return Err(StellarError::HorizonErrorStatus(resp.status()));
        }

        let horizon_resp: HorizonTransactionsResponse = match resp.json().await {
            Ok(r) => r,
            Err(e) => return Err(StellarError::ResponseParseError(e)),
        };

        if let Some(tx) = horizon_resp._embedded.records.first() {
            // Parse timestamp from created_at string (RFC3339 format)
            let timestamp = chrono::DateTime::parse_from_rfc3339(&tx.created_at)
                .map(|dt| dt.timestamp())
                .unwrap_or(0);
                
            Ok(VerificationResult {
                verified: true,
                transaction_id: Some(tx.id.clone()),
                timestamp: Some(timestamp),
            })
        } else {
            Ok(VerificationRecord {
                hash: hash.to_string(),
                anchored: false,
                data_key,
                transaction_id: None,
                timestamp: None,
                raw_value_base64: None,
                decoded_value: None,
            })
        }
    }

    pub async fn anchor_transfer(&self, _transfer_hash: &str, _memo: &str) -> Result<(), StellarError> {
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use httpmock::prelude::*;
    use chrono::Utc;
    
    fn create_test_client(mock_server: &MockServer) -> StellarClient {
        StellarClient::new(&mock_server.url("/"))
    }

    #[tokio::test]
    async fn test_verify_hash_correct_endpoint_and_query() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        let test_hash = "test_hash_123";
        
        // Mock the expected request
        let mock = mock_server.mock(|when, then| {
            when.method(GET)
                .path("/transactions")
                .query_param("memo", test_hash);
            then.status(200)
                .json_body(serde_json::json!({
                    "_embedded": {
                        "records": []
                    }
                }));
        });

        // Act
        let result = client.verify_hash(test_hash).await;
        
        // Assert
        assert!(result.is_ok());
        mock.assert();
    }

    #[tokio::test]
    async fn test_verify_hash_success_with_transaction() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        let test_hash = "test_hash_123";
        let tx_id = "abc123txid";
        let now = Utc::now().to_rfc3339();
        
        let mock = mock_server.mock(|when, then| {
            when.method(GET)
                .path("/transactions")
                .query_param("memo", test_hash);
            then.status(200)
                .json_body(serde_json::json!({
                    "_embedded": {
                        "records": [
                            {
                                "id": tx_id,
                                "created_at": now
                            }
                        ]
                    }
                }));
        });

        // Act
        let result = client.verify_hash(test_hash).await;
        
        // Assert
        assert!(result.is_ok());
        let verification = result.unwrap();
        assert!(verification.verified);
        assert_eq!(verification.transaction_id, Some(tx_id.to_string()));
        assert!(verification.timestamp.is_some());
        mock.assert();
    }

    #[tokio::test]
    async fn test_verify_hash_no_transactions_returns_not_verified() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        let test_hash = "test_hash_123";
        
        let mock = mock_server.mock(|when, then| {
            when.method(GET)
                .path("/transactions")
                .query_param("memo", test_hash);
            then.status(200)
                .json_body(serde_json::json!({
                    "_embedded": {
                        "records": []
                    }
                }));
        });

        // Act
        let result = client.verify_hash(test_hash).await;
        
        // Assert
        assert!(result.is_ok());
        let verification = result.unwrap();
        assert!(!verification.verified);
        assert_eq!(verification.transaction_id, None);
        assert_eq!(verification.timestamp, None);
        mock.assert();
    }

    #[tokio::test]
    async fn test_verify_hash_404_returns_horizon_error() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        let test_hash = "test_hash_123";
        
        let mock = mock_server.mock(|when, then| {
            when.method(GET)
                .path("/transactions")
                .query_param("memo", test_hash);
            then.status(404);
        });

        // Act
        let result = client.verify_hash(test_hash).await;
        
        // Assert
        assert!(result.is_err());
        match result.err().unwrap() {
            StellarError::HorizonErrorStatus(status) => assert_eq!(status.as_u16(), 404),
            _ => panic!("Expected HorizonErrorStatus for 404"),
        }
        mock.assert();
    }

    #[tokio::test]
    async fn test_verify_hash_429_returns_horizon_error() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        let test_hash = "test_hash_123";
        
        let mock = mock_server.mock(|when, then| {
            when.method(GET)
                .path("/transactions")
                .query_param("memo", test_hash);
            then.status(429);
        });

        // Act
        let result = client.verify_hash(test_hash).await;
        
        // Assert
        assert!(result.is_err());
        match result.err().unwrap() {
            StellarError::HorizonErrorStatus(status) => assert_eq!(status.as_u16(), 429),
            _ => panic!("Expected HorizonErrorStatus for 429"),
        }
        mock.assert();
    }

    #[tokio::test]
    async fn test_verify_hash_500_returns_horizon_error() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        let test_hash = "test_hash_123";
        
        let mock = mock_server.mock(|when, then| {
            when.method(GET)
                .path("/transactions")
                .query_param("memo", test_hash);
            then.status(500);
        });

        // Act
        let result = client.verify_hash(test_hash).await;
        
        // Assert
        assert!(result.is_err());
        match result.err().unwrap() {
            StellarError::HorizonErrorStatus(status) => assert_eq!(status.as_u16(), 500),
            _ => panic!("Expected HorizonErrorStatus for 500"),
        }
        mock.assert();
    }

    #[tokio::test]
    async fn test_verify_hash_malformed_json_returns_parse_error() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        let test_hash = "test_hash_123";
        
        let mock = mock_server.mock(|when, then| {
            when.method(GET)
                .path("/transactions")
                .query_param("memo", test_hash);
            then.status(200)
                .body("invalid json {");
        });

        // Act
        let result = client.verify_hash(test_hash).await;
        
        // Assert
        assert!(result.is_err());
        match result.err().unwrap() {
            StellarError::ResponseParseError(_) => {},
            _ => panic!("Expected ResponseParseError for malformed JSON"),
        }
        mock.assert();
    }

    #[tokio::test]
    async fn test_verify_hash_missing_fields_in_json_returns_parse_error() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        let test_hash = "test_hash_123";
        
        let mock = mock_server.mock(|when, then| {
            when.method(GET)
                .path("/transactions")
                .query_param("memo", test_hash);
            then.status(200)
                .json_body(serde_json::json!({
                    "wrong_field": {}
                }));
        });

        // Act
        let result = client.verify_hash(test_hash).await;
        
        // Assert
        assert!(result.is_err());
        match result.err().unwrap() {
            StellarError::ResponseParseError(_) => {},
            _ => panic!("Expected ResponseParseError for invalid JSON structure"),
        }
        mock.assert();
    }

    #[tokio::test]
    async fn test_check_connection_success() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        
        let mock = mock_server.mock(|when, then| {
            when.method(GET).path("/");
            then.status(200);
        });

        // Act
        let result = client.check_connection().await;
        
        // Assert
        assert!(result.is_ok());
        assert!(result.unwrap());
        mock.assert();
    }

    #[tokio::test]
    async fn test_check_connection_failure() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        
        let mock = mock_server.mock(|when, then| {
            when.method(GET).path("/");
            then.status(500);
        });

        // Act
        let result = client.check_connection().await;
        
        // Assert
        assert!(result.is_ok());
        assert!(!result.unwrap());
        mock.assert();
    }

    #[tokio::test]
    async fn test_client_has_timeout_configured() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        
        // Create a mock that hangs
        let mock = mock_server.mock(|when, then| {
            when.method(GET)
                .path("/transactions")
                .query_param("memo", "test");
            then.delay(std::time::Duration::from_secs(15)) // Longer than client's 10s timeout
                .status(200);
        });

        // Act
        let result = client.verify_hash("test").await;
        
        // Assert
        assert!(result.is_err());
        match result.err().unwrap() {
            StellarError::Timeout => {},
            _ => panic!("Expected Timeout error for hanging request"),
        }
    }

    #[tokio::test]
    async fn test_invalid_horizon_url_returns_connection_failed() {
        // Arrange - use an invalid URL that can't be connected to
        let client = StellarClient::new("http://non-existent-domain-12345.com");
        
        // Act
        let result = client.verify_hash("test_hash").await;
        
        // Assert
        assert!(result.is_err());
        match result.err().unwrap() {
            StellarError::ConnectionFailed => {},
            StellarError::Timeout => {}, // Could also timeout, which is acceptable
            e => panic!("Expected ConnectionFailed or Timeout, got {:?}", e),
        }
    }

    #[tokio::test]
    async fn test_never_suceeds_on_network_failure() {
        // Arrange
        let client = StellarClient::new("http://non-existent-domain-12345.com");
        
        // Act
        let result = client.verify_hash("test_hash").await;
        
        // Assert - must never return Ok(VerificationResult { verified: true })
        assert!(result.is_err() || !result.unwrap().verified);
    }

    #[tokio::test]
    async fn test_never_succeeds_on_parse_failure() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        
        let mock = mock_server.mock(|when, then| {
            when.method(GET)
                .path("/transactions")
                .query_param("memo", "test_hash");
            then.status(200)
                .body("garbage data");
        });

        // Act
        let result = client.verify_hash("test_hash").await;
        
        // Assert
        assert!(result.is_err());
        assert!(!matches!(result, Ok(VerificationResult { verified: true, .. })));
    }

    #[tokio::test]
    async fn test_never_succeeds_on_http_error() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        
        let mock = mock_server.mock(|when, then| {
            when.method(GET)
                .path("/transactions")
                .query_param("memo", "test_hash");
            then.status(500);
        });

        // Act
        let result = client.verify_hash("test_hash").await;
        
        // Assert
        assert!(result.is_err());
        assert!(!matches!(result, Ok(VerificationResult { verified: true, .. })));
    }

    #[tokio::test]
    async fn test_client_constructor_works() {
        // Arrange & Act
        let client = StellarClient::new("https://horizon.stellar.org");
        
        // Assert
        assert_eq!(client.horizon_url, "https://horizon.stellar.org");
    }

    #[tokio::test]
    async fn test_verify_hash_timestamp_parsing() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        let specific_time = "2023-01-01T00:00:00Z";
        let expected_timestamp = 1672531200; // Unix timestamp for that date
        
        let mock = mock_server.mock(|when, then| {
            when.method(GET)
                .path("/transactions")
                .query_param("memo", "test_hash");
            then.status(200)
                .json_body(serde_json::json!({
                    "_embedded": {
                        "records": [
                            {
                                "id": "tx123",
                                "created_at": specific_time
                            }
                        ]
                    }
                }));
        });

        // Act
        let result = client.verify_hash("test_hash").await;
        
        // Assert
        assert!(result.is_ok());
        assert_eq!(result.unwrap().timestamp, Some(expected_timestamp));
    }

    #[tokio::test]
    async fn test_invalid_timestamp_format_returns_zero() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        
        let mock = mock_server.mock(|when, then| {
            when.method(GET)
                .path("/transactions")
                .query_param("memo", "test_hash");
            then.status(200)
                .json_body(serde_json::json!({
                    "_embedded": {
                        "records": [
                            {
                                "id": "tx123",
                                "created_at": "not-a-valid-timestamp"
                            }
                        ]
                    }
                }));
        });

        // Act
        let result = client.verify_hash("test_hash").await;
        
        // Assert - should not panic, returns 0 for invalid timestamp
        assert!(result.is_ok());
        assert_eq!(result.unwrap().timestamp, Some(0));
    }

    #[tokio::test]
    async fn test_multiple_transactions_returns_first() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        let first_tx_id = "first_tx";
        let second_tx_id = "second_tx";
        
        let mock = mock_server.mock(|when, then| {
            when.method(GET)
                .path("/transactions")
                .query_param("memo", "test_hash");
            then.status(200)
                .json_body(serde_json::json!({
                    "_embedded": {
                        "records": [
                            {
                                "id": first_tx_id,
                                "created_at": "2023-01-01T00:00:00Z"
                            },
                            {
                                "id": second_tx_id,
                                "created_at": "2023-01-02T00:00:00Z"
                            }
                        ]
                    }
                }));
        });

        // Act
        let result = client.verify_hash("test_hash").await;
        
        // Assert
        assert!(result.is_ok());
        assert_eq!(result.unwrap().transaction_id, Some(first_tx_id.to_string()));
    }

    #[tokio::test]
    async fn test_anchor_transfer_returns_ok() {
        // Arrange
        let client = StellarClient::new("https://horizon.stellar.org");
        
        // Act
        let result = client.anchor_transfer("hash", "memo").await;
        
        // Assert
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_check_connection_timeout() {
        // Arrange
        let mock_server = MockServer::start();
        let client = create_test_client(&mock_server);
        
        let mock = mock_server.mock(|when, then| {
            when.method(GET).path("/");
            then.delay(std::time::Duration::from_secs(15))
                .status(200);
        });

        // Act
        let result = client.check_connection().await;
        
        // Assert
        assert!(result.is_err());
        match result.err().unwrap() {
            StellarError::Timeout => {},
            _ => panic!("Expected Timeout error"),
        }
    }
}