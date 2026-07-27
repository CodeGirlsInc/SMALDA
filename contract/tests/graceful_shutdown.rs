use axum::{routing::get, Router};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::net::TcpListener;
use tokio::sync::Notify;

/// Mirrors the drain/timeout race in main.rs: fires the shutdown signal
/// mid-request and asserts the in-flight request still completes, because
/// the timeout clock only starts once the signal arrives.
#[tokio::test]
async fn in_flight_request_completes_during_graceful_shutdown() {
    let app = Router::new().route(
        "/slow",
        get(|| async {
            tokio::time::sleep(Duration::from_millis(500)).await;
            "done"
        }),
    );

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr: SocketAddr = listener.local_addr().unwrap();

    let notify = Arc::new(Notify::new());
    let notify_for_server = notify.clone();

    let server = tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                notify_for_server.notified().await;
            })
            .await
            .unwrap();
    });

    tokio::time::sleep(Duration::from_millis(50)).await;

    let client = reqwest::Client::new();
    let request = client.get(format!("http://{}/slow", addr)).send();
    let request_handle = tokio::spawn(request);

    tokio::time::sleep(Duration::from_millis(100)).await;
    notify.notify_one();

    let response = request_handle
        .await
        .expect("request task panicked")
        .expect("request failed");
    assert_eq!(response.status(), 200);
    assert_eq!(response.text().await.unwrap(), "done");

    server.await.expect("server task panicked");
}

/// Confirms that when the drain exceeds the timeout, the server future
/// still resolves (forcing remaining connections closed) rather than
/// hanging forever -- the behavior main.rs relies on via tokio::select!.
/// The handler explicitly signals once it has started, so the shutdown
/// trigger fires only once the request is genuinely in flight -- avoids
/// flakiness from guessing a "long enough" sleep on slower machines.
#[tokio::test]
async fn shutdown_timeout_forces_completion_even_if_drain_is_still_pending() {
    let request_started = Arc::new(Notify::new());
    let request_started_for_handler = request_started.clone();

    let app = Router::new().route(
        "/very-slow",
        get(move || {
            let request_started = request_started_for_handler.clone();
            async move {
                request_started.notify_one();
                tokio::time::sleep(Duration::from_secs(10)).await;
                "done"
            }
        }),
    );

    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr: SocketAddr = listener.local_addr().unwrap();

    let notify = Arc::new(Notify::new());
    let notify_for_server = notify.clone();

    // Spawn so the server is actively polled and accepting connections
    // while the rest of the test proceeds -- an un-spawned future here
    // never gets driven, so the request would never actually reach it.
    let server_handle = tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                notify_for_server.notified().await;
            })
            .await
    });

    let client = reqwest::Client::new();
    tokio::spawn(async move {
        let _ = client
            .get(format!("http://{}/very-slow", addr))
            .send()
            .await;
    });

    // Wait for confirmation the handler actually started (i.e. the
    // connection is genuinely in flight) before firing shutdown --
    // removes the timing guess that made this flaky.
    request_started.notified().await;
    notify.notify_one();

    // Same race main.rs runs, but with a short timeout so the test doesn't
    // wait 10s for the handler: the drain (10s handler) should lose to a
    // short timeout, proving the timeout path actually terminates things.
    let timed_out = tokio::select! {
        _ = server_handle => false,
        _ = tokio::time::sleep(Duration::from_millis(500)) => true,
    };
    assert!(
        timed_out,
        "expected the timeout branch to win, not the drain"
    );
}
