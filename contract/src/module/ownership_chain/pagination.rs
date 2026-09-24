//! Cursor-based pagination for the ownership chain history response, so
//! a document with a long transfer history is served in bounded pages.

pub struct Page<T> {
    pub items: Vec<T>,
    pub next_cursor: Option<usize>,
}

pub fn paginate<T: Clone>(items: &[T], cursor: usize, page_size: usize) -> Page<T> {
    let end = std::cmp::min(cursor + page_size, items.len());
    let slice = items[cursor..end].to_vec();
    let next_cursor = if end < items.len() { Some(end) } else { None };

    Page {
        items: slice,
        next_cursor,
    }
}
