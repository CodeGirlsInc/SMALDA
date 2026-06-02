"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface DocumentSearchResult {
  id: string;
  title: string;
  status: string;
  uploadedAt: string;
}

interface DocumentSearchBarProps {
  onResults: (results: DocumentSearchResult[]) => void;
}

export default function DocumentSearchBar({ onResults }: DocumentSearchBarProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        onResults([]);
        setEmpty(false);
        return;
      }

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setLoading(true);
      setEmpty(false);

      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/module/documents/search?q=${encodeURIComponent(q)}`,
          {
            headers: {
              Authorization: `Bearer ${
                typeof localStorage !== "undefined"
                  ? (localStorage.getItem("access_token") ?? "")
                  : ""
              }`,
            },
            signal: abortRef.current.signal,
          }
        );
        if (!res.ok) throw new Error("Search failed");
        const data: DocumentSearchResult[] = await res.json();
        onResults(data);
        setEmpty(data.length === 0);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
      } finally {
        setLoading(false);
      }
    },
    [onResults]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(query);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  function handleClear() {
    setQuery("");
    setEmpty(false);
    onResults([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      search(query);
    }
    if (e.key === "Escape") handleClear();
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
        <svg
          className="h-4 w-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search documents…"
        aria-label="Search documents"
        className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="absolute inset-y-0 right-3 flex items-center gap-1">
        {loading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        )}
        {!loading && query && (
          <button
            onClick={handleClear}
            aria-label="Clear search"
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {empty && !loading && (
        <p className="mt-2 text-sm text-gray-500">No results found.</p>
      )}
    </div>
  );
}
