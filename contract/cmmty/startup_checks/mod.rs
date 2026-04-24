use serde::Deserialize;
use tracing::warn;

const LOW_BALANCE_THRESHOLD_XLM: f64 = 10.0;

#[derive(Debug, Clone)]
pub struct BalanceCheckResult {
    pub balance_xlm: f64,
    pub is_sufficient: bool,
}

#[derive(Debug, Deserialize)]
struct HorizonAccountBalance {
    balance: String,
    asset_type: String,
}

#[derive(Debug, Deserialize)]
struct HorizonAccountResponse {
    balances: Vec<HorizonAccountBalance>,
}

/// Fetches the native XLM balance for `account_id` from Horizon.
pub async fn fetch_xlm_balance(
    horizon_url: &str,
    account_id: &str,
    client: &reqwest::Client,
) -> anyhow::Result<f64> {
    let url = format!("{}/accounts/{}", horizon_url.trim_end_matches('/'), account_id);
    let resp: HorizonAccountResponse = client.get(&url).send().await?.json().await?;

    let native = resp
        .balances
        .iter()
        .find(|b| b.asset_type == "native")
        .ok_or_else(|| anyhow::anyhow!("no native balance found"))?;

    Ok(native.balance.parse()?)
}

/// Runs the startup balance check. Logs a WARNING if balance < 10 XLM.
/// Returns a `BalanceCheckResult` for inclusion in health responses.
pub async fn run(
    horizon_url: &str,
    account_id: &str,
    client: &reqwest::Client,
) -> anyhow::Result<BalanceCheckResult> {
    let balance_xlm = fetch_xlm_balance(horizon_url, account_id, client).await?;
    let is_sufficient = balance_xlm >= LOW_BALANCE_THRESHOLD_XLM;

    if !is_sufficient {
        warn!(
            "Stellar account {} has low balance: {:.7} XLM (threshold: {} XLM)",
            account_id, balance_xlm, LOW_BALANCE_THRESHOLD_XLM
        );
    }

    Ok(BalanceCheckResult {
        balance_xlm,
        is_sufficient,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use httpmock::prelude::*;

    fn make_account_body(balance: &str) -> String {
        format!(
            r#"{{"balances":[{{"balance":"{}","asset_type":"native"}}]}}"#,
            balance
        )
    }

    #[tokio::test]
    async fn sufficient_balance_returns_ok() {
        let server = MockServer::start();
        server.mock(|when, then| {
            when.method(GET).path_contains("/accounts/");
            then.status(200).body(make_account_body("100.0000000"));
        });

        let client = reqwest::Client::new();
        let result = run(&server.base_url(), "GACCOUNT", &client).await.unwrap();

        assert!(result.is_sufficient);
        assert!((result.balance_xlm - 100.0).abs() < 0.001);
    }

    #[tokio::test]
    async fn insufficient_balance_flags_warning() {
        let server = MockServer::start();
        server.mock(|when, then| {
            when.method(GET).path_contains("/accounts/");
            then.status(200).body(make_account_body("5.0000000"));
        });

        let client = reqwest::Client::new();
        let result = run(&server.base_url(), "GACCOUNT", &client).await.unwrap();

        assert!(!result.is_sufficient);
        assert!((result.balance_xlm - 5.0).abs() < 0.001);
    }

    #[tokio::test]
    async fn exactly_threshold_is_sufficient() {
        let server = MockServer::start();
        server.mock(|when, then| {
            when.method(GET).path_contains("/accounts/");
            then.status(200).body(make_account_body("10.0000000"));
        });

        let client = reqwest::Client::new();
        let result = run(&server.base_url(), "GACCOUNT", &client).await.unwrap();

        assert!(result.is_sufficient);
    }
}
