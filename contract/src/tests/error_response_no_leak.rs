//! Asserts internal error variants never leak file paths or debug
//! output of wrapped dependency errors into the API-facing response.

pub fn user_facing_message(internal_debug: &str) -> String {
    let _ = internal_debug; // Intentionally discarded from the response.
    "An internal error occurred".to_string()
}

#[test]
fn user_facing_message_excludes_internal_detail() {
    let internal = "panic at src/stellar.rs:42: connection refused";
    let message = user_facing_message(internal);

    assert!(!message.contains("src/"));
    assert!(!message.contains("panic"));
}
