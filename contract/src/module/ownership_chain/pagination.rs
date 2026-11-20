//! Cursor-based pagination for the ownership chain history response, so
//! a document with a long transfer history is served in bounded pages.

pub struct Page<T> {
    pub items: Vec<T>,
    pub next_cursor: Option<usize>,
}

pub fn paginate<T: Clone>(items: &[T], cursor: usize, page_size: usize) -> Page<T> {
    // Clamp inputs so no cursor or page size can panic or loop forever (issue #1449).
    const MAX_PAGE_SIZE: usize = 100;
    let page_size = page_size.clamp(1, MAX_PAGE_SIZE);
    let start = cursor.min(items.len());
    let end = std::cmp::min(start + page_size, items.len());
    let slice = items[start..end].to_vec();
    let next_cursor = if end < items.len() { Some(end) } else { None };

    Page {
        items: slice,
        next_cursor,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_size_zero_is_clamped_and_terminates() {
        let items = [1, 2, 3];
        let page = paginate(&items, 0, 0);
        assert_eq!(page.items, vec![1]);
        assert_eq!(page.next_cursor, Some(1));
    }

    #[test]
    fn cursor_past_the_end_returns_an_empty_last_page() {
        let items = [1, 2, 3];
        let page = paginate(&items, 99, 10);
        assert!(page.items.is_empty());
        assert_eq!(page.next_cursor, None);
    }

    #[test]
    fn pages_walk_the_whole_list() {
        let items: Vec<u32> = (0..5).collect();
        let first = paginate(&items, 0, 2);
        assert_eq!(first.items, vec![0, 1]);
        let second = paginate(&items, first.next_cursor.unwrap(), 2);
        assert_eq!(second.items, vec![2, 3]);
        let third = paginate(&items, second.next_cursor.unwrap(), 2);
        assert_eq!(third.items, vec![4]);
        assert_eq!(third.next_cursor, None);
    }

    #[test]
    fn page_size_is_capped_at_100() {
        let items: Vec<u32> = (0..250).collect();
        assert_eq!(paginate(&items, 0, 10_000).items.len(), 100);
    }
}
