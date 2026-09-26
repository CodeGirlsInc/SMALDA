//! Cursor-based pagination for the ownership chain history response, so
//! a document with a long transfer history is served in bounded pages.

use serde::Serialize;

/// Page size used when the client does not ask for one.
pub const DEFAULT_PAGE_SIZE: usize = 50;
/// Upper bound on a requested page size, so a client cannot ask for the whole
/// chain in one request.
pub const MAX_PAGE_SIZE: usize = 200;

#[derive(Debug, Clone, Serialize)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub next_cursor: Option<usize>,
}

/// Slice `items` for the page that starts at `cursor`.
///
/// A cursor past the end yields an empty page rather than panicking, and a page
/// size of zero yields an empty page with no next cursor rather than a cursor
/// that never advances. Both are inputs a client can send.
pub fn paginate<T: Clone>(items: &[T], cursor: usize, page_size: usize) -> Page<T> {
    let start = std::cmp::min(cursor, items.len());
    let end = std::cmp::min(start.saturating_add(page_size), items.len());
    let next_cursor = if page_size > 0 && end < items.len() {
        Some(end)
    } else {
        None
    };

    Page {
        items: items[start..end].to_vec(),
        next_cursor,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn items() -> Vec<u32> {
        (1..=10).collect()
    }

    #[test]
    fn first_page_starts_at_zero_and_points_at_three() {
        let page = paginate(&items(), 0, 3);
        assert_eq!(page.items, vec![1, 2, 3]);
        assert_eq!(page.next_cursor, Some(3));
    }

    #[test]
    fn a_middle_page_continues_from_its_cursor() {
        let page = paginate(&items(), 3, 3);
        assert_eq!(page.items, vec![4, 5, 6]);
        assert_eq!(page.next_cursor, Some(6));
    }

    #[test]
    fn the_last_page_has_no_next_cursor() {
        let page = paginate(&items(), 9, 3);
        assert_eq!(page.items, vec![10]);
        assert_eq!(page.next_cursor, None);
    }

    #[test]
    fn a_page_that_covers_the_remainder_has_no_next_cursor() {
        let page = paginate(&items(), 2, 100);
        assert_eq!(page.items, vec![3, 4, 5, 6, 7, 8, 9, 10]);
        assert_eq!(page.next_cursor, None);
    }

    #[test]
    fn a_cursor_past_the_end_is_an_empty_page_not_a_panic() {
        let page = paginate(&items(), 999, 3);
        assert!(page.items.is_empty());
        assert_eq!(page.next_cursor, None);
    }

    #[test]
    fn a_zero_page_size_cannot_produce_a_cursor_that_never_advances() {
        let page = paginate(&items(), 0, 0);
        assert!(page.items.is_empty());
        assert_eq!(page.next_cursor, None);
    }

    #[test]
    fn an_empty_chain_is_an_empty_page() {
        let empty: Vec<u32> = Vec::new();
        let page = paginate(&empty, 0, 10);
        assert!(page.items.is_empty());
        assert_eq!(page.next_cursor, None);
    }
}
