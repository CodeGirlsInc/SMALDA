use std::env;

fn parse_args(args: &[String]) -> Result<(String, Option<String>), String> {
    let mut hash: Option<String> = None;
    let mut memo: Option<String> = None;
    let mut i = 0;

    while i < args.len() {
        match args[i].as_str() {
            "--hash" => {
                i += 1;
                hash = Some(args.get(i).ok_or("--hash requires a value")?.clone());
            }
            "--memo" => {
                i += 1;
                memo = Some(args.get(i).ok_or("--memo requires a value")?.clone());
            }
            other => return Err(format!("unknown argument: {}", other)),
        }
        i += 1;
    }

    let hash = hash.ok_or("--hash is required")?;

    // Validate: must be 64 hex characters
    if hash.len() != 64 || !hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(format!(
            "invalid hash format: expected 64 hex characters, got '{}'",
            hash
        ));
    }

    Ok((hash, memo))
}

fn anchor(hash: &str, memo: Option<&str>, secret_key: &str, horizon_url: &str) -> anyhow::Result<()> {
    let client = reqwest::blocking::Client::new();

    // Build memo text (max 28 bytes)
    let memo_text = memo.unwrap_or(hash);
    let memo_truncated = &memo_text[..memo_text.len().min(28)];

    // Submit a simple payment-like transaction memo to Horizon (stub: POST to /transactions)
    // In production this would sign and submit a real Stellar transaction.
    let payload = serde_json::json!({
        "hash": hash,
        "memo": memo_truncated,
        "secret_key": secret_key,
    });

    let url = format!("{}/transactions", horizon_url.trim_end_matches('/'));
    let resp = client.post(&url).json(&payload).send()?;

    if resp.status().is_success() {
        let body: serde_json::Value = resp.json()?;
        let tx_hash = body["hash"].as_str().unwrap_or("unknown");
        let ledger = body["ledger"].as_u64().unwrap_or(0);
        println!("transaction_hash: {}", tx_hash);
        println!("ledger: {}", ledger);
    } else {
        let status = resp.status();
        let text = resp.text().unwrap_or_default();
        anyhow::bail!("Stellar error {}: {}", status, text);
    }

    Ok(())
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();

    let (hash, memo) = match parse_args(&args) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("error: {}", e);
            eprintln!("usage: smalda-anchor --hash SHA256_HASH [--memo string]");
            std::process::exit(1);
        }
    };

    let secret_key = match env::var("STELLAR_SECRET_KEY") {
        Ok(k) => k,
        Err(_) => {
            eprintln!("error: STELLAR_SECRET_KEY environment variable is not set");
            std::process::exit(1);
        }
    };

    let horizon_url = env::var("STELLAR_HORIZON_URL")
        .unwrap_or_else(|_| "https://horizon-testnet.stellar.org".to_string());

    if let Err(e) = anchor(&hash, memo.as_deref(), &secret_key, &horizon_url) {
        eprintln!("error: {}", e);
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(v: &[&str]) -> Vec<String> {
        v.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn valid_hash_no_memo() {
        let (hash, memo) = parse_args(&args(&["--hash", &"a".repeat(64)])).unwrap();
        assert_eq!(hash, "a".repeat(64));
        assert!(memo.is_none());
    }

    #[test]
    fn valid_hash_with_memo() {
        let (hash, memo) = parse_args(&args(&["--hash", &"b".repeat(64), "--memo", "test"])).unwrap();
        assert_eq!(hash, "b".repeat(64));
        assert_eq!(memo.as_deref(), Some("test"));
    }

    #[test]
    fn invalid_hash_format_errors() {
        let err = parse_args(&args(&["--hash", "tooshort"])).unwrap_err();
        assert!(err.contains("invalid hash format"));
    }

    #[test]
    fn missing_hash_errors() {
        let err = parse_args(&args(&["--memo", "only-memo"])).unwrap_err();
        assert!(err.contains("--hash is required"));
    }
}
