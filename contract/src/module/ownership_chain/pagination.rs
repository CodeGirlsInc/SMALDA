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
