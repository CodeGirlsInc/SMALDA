use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferRequest {
    pub hash: String,
    pub from_public_key: String,
    pub to_public_key: String,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TransferPayload {
    pub from_public_key: String,
    pub to_public_key: String,
    pub transferred_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferResponse {
    pub tx_hash: String,
    pub ledger: u32,
    pub transferred_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferRecord {
    pub key: String,
    pub payload: TransferPayload,
    pub ledger: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferHistoryResponse {
    pub hash: String,
    pub total_transfers: usize,
    pub history: Vec<TransferRecord>,
}