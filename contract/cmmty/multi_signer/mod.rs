use tracing::info;

#[derive(Debug, Clone)]
pub struct SignerAccount {
    pub secret_key: String,
    pub balance_xlm: f64,
}

/// Parse comma-separated STELLAR_SECRET_KEYS into a list of `SignerAccount`s
/// with placeholder balances (0.0). Call `refresh_balances` to populate them.
pub fn load_accounts(keys_csv: &str) -> Vec<SignerAccount> {
    keys_csv
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|key| SignerAccount {
            secret_key: key.to_string(),
            balance_xlm: 0.0,
        })
        .collect()
}

/// Select the account with the highest balance. Returns `None` if the list is empty.
pub fn select_best(accounts: &[SignerAccount]) -> Option<&SignerAccount> {
    accounts
        .iter()
        .max_by(|a, b| a.balance_xlm.partial_cmp(&b.balance_xlm).unwrap())
}

/// Attempt to use `accounts` in descending balance order, calling `try_sign` for each.
/// Returns the secret key of the account that succeeded, or an error if all fail.
pub fn sign_with_fallback<F>(accounts: &[SignerAccount], mut try_sign: F) -> anyhow::Result<String>
where
    F: FnMut(&str) -> anyhow::Result<()>,
{
    let mut sorted: Vec<&SignerAccount> = accounts.iter().collect();
    sorted.sort_by(|a, b| b.balance_xlm.partial_cmp(&a.balance_xlm).unwrap());

    for account in &sorted {
        match try_sign(&account.secret_key) {
            Ok(()) => {
                info!("Transaction signed with account ending in ...{}", &account.secret_key[account.secret_key.len().saturating_sub(4)..]);
                return Ok(account.secret_key.clone());
            }
            Err(e) => {
                info!("Account failed, trying next: {}", e);
            }
        }
    }

    anyhow::bail!("all signing accounts failed")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn load_accounts_parses_csv() {
        let accounts = load_accounts("KEY1, KEY2, KEY3");
        assert_eq!(accounts.len(), 3);
        assert_eq!(accounts[0].secret_key, "KEY1");
        assert_eq!(accounts[2].secret_key, "KEY3");
    }

    #[test]
    fn select_best_picks_highest_balance() {
        let accounts = vec![
            SignerAccount { secret_key: "A".into(), balance_xlm: 5.0 },
            SignerAccount { secret_key: "B".into(), balance_xlm: 50.0 },
            SignerAccount { secret_key: "C".into(), balance_xlm: 20.0 },
        ];
        let best = select_best(&accounts).unwrap();
        assert_eq!(best.secret_key, "B");
    }

    #[test]
    fn sign_with_fallback_uses_next_on_failure() {
        let accounts = vec![
            SignerAccount { secret_key: "FAIL".into(), balance_xlm: 100.0 },
            SignerAccount { secret_key: "OK".into(), balance_xlm: 50.0 },
        ];

        let used = sign_with_fallback(&accounts, |key| {
            if key == "FAIL" {
                anyhow::bail!("simulated failure")
            } else {
                Ok(())
            }
        })
        .unwrap();

        assert_eq!(used, "OK");
    }

    #[test]
    fn sign_with_fallback_errors_when_all_fail() {
        let accounts = vec![
            SignerAccount { secret_key: "A".into(), balance_xlm: 10.0 },
            SignerAccount { secret_key: "B".into(), balance_xlm: 5.0 },
        ];

        let result = sign_with_fallback(&accounts, |_| anyhow::bail!("always fails"));
        assert!(result.is_err());
    }
}
