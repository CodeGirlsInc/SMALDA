//! Cursor-based pagination for ownership-chain history responses, so a
//! document with a long transfer history is served in bounded pages (#1346).

/// One bounded page of items plus the cursor that fetches the next one.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub next_cursor: Option<usize>,
}

/// Slice `items` into a single page.
///
/// A `cursor` past the end of `items` yields an empty page instead of panicking
/// (a caller that paginates while the chain is being trimmed would otherwise get
/// a 500), and `page_size` of 0 is treated as 1 so a page always makes progress.
pub fn paginate<T: Clone>(items: &[T], cursor: usize, page_size: usize) -> Page<T> {
    let page_size = page_size.max(1);
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

    fn items(n: usize) -> Vec<usize> {
        (0..n).collect()
    }

    #[test]
    fn first_page_reports_the_next_cursor() {
        let page = paginate(&items(5), 0, 2);
        assert_eq!(page.items, vec![0, 1]);
        assert_eq!(page.next_cursor, Some(2));
    }

    #[test]
    fn last_page_has_no_next_cursor() {
        let page = paginate(&items(5), 4, 2);
        assert_eq!(page.items, vec![4]);
        assert_eq!(page.next_cursor, None);
    }

    #[test]
    fn exact_fit_has_no_next_cursor() {
        let page = paginate(&items(4), 2, 2);
        assert_eq!(page.items, vec![2, 3]);
        assert_eq!(page.next_cursor, None);
    }

    #[test]
    fn cursor_past_the_end_is_an_empty_page_not_a_panic() {
        let page = paginate(&items(3), 99, 10);
        assert!(page.items.is_empty());
        assert_eq!(page.next_cursor, None);
    }

    #[test]
    fn cursor_at_the_end_is_an_empty_page() {
        let page = paginate(&items(3), 3, 10);
        assert!(page.items.is_empty());
        assert_eq!(page.next_cursor, None);
    }

    #[test]
    fn zero_page_size_still_makes_progress() {
        let page = paginate(&items(3), 0, 0);
        assert_eq!(page.items, vec![0]);
        assert_eq!(page.next_cursor, Some(1));
    }

    #[test]
    fn empty_input_is_an_empty_page() {
        let page: Page<usize> = paginate(&items(0), 0, 10);
        assert!(page.items.is_empty());
        assert_eq!(page.next_cursor, None);
    }
}
