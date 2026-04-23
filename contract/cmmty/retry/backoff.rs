use tokio::time::{sleep, Duration};

pub async fn retry_async<F, Fut, T, E>(
    max_attempts: u32,
    base_delay_ms: u64,
    multiplier: u64,
    mut op: F,
) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
{
    let mut attempt = 1;
    let mut delay = base_delay_ms;

    loop {
        match op().await {
            Ok(v) => return Ok(v),
            Err(e) if attempt >= max_attempts => return Err(e),
            Err(_) => {
                println!("Retry attempt {} in {}ms", attempt, delay);
                sleep(Duration::from_millis(delay)).await;
                delay *= multiplier;
                attempt += 1;
            }
        }
    }
}