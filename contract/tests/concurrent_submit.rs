// Concurrent submits of the same document hash (#1389).
// Self-contained model of the submit rule: exactly one of two simultaneous submits may succeed.
use std::collections::HashSet;
use std::sync::{Arc, Barrier, Mutex};
use std::thread;

fn submit(store: &Mutex<HashSet<String>>, hash: &str) -> bool {
    // insert returns false when the hash already exists, atomically under the lock
    store.lock().unwrap().insert(hash.to_string())
}

#[test]
fn concurrent_submits_of_same_hash_only_one_succeeds() {
    let store = Arc::new(Mutex::new(HashSet::new()));
    let barrier = Arc::new(Barrier::new(2));

    let handles: Vec<_> = (0..2)
        .map(|_| {
            let (store, barrier) = (Arc::clone(&store), Arc::clone(&barrier));
            thread::spawn(move || {
                barrier.wait(); // release both submits at the same moment
                submit(&store, "abc123")
            })
        })
        .collect();

    let successes = handles
        .into_iter()
        .map(|h| h.join().unwrap())
        .filter(|ok| *ok)
        .count();

    assert_eq!(successes, 1, "exactly one concurrent submit must win");
    assert_eq!(store.lock().unwrap().len(), 1, "hash must be stored once");
}
