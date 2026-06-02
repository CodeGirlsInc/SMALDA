"use client";

import { useEffect, useRef, useState } from "react";

interface Tag {
  name: string;
}

interface DocumentTagsInputProps {
  documentId: string;
  initialTags?: string[];
  readOnly?: boolean;
}

export default function DocumentTagsInput({
  documentId,
  initialTags = [],
  readOnly = false,
}: DocumentTagsInputProps) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const token = () => localStorage.getItem("access_token") ?? "";
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";

  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${apiBase}/api/module/tags`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        if (res.ok) {
          const data: Tag[] = await res.json();
          const matches = data
            .map((t) => t.name)
            .filter(
              (name) =>
                name.toLowerCase().includes(input.toLowerCase()) &&
                !tags.includes(name)
            );
          setSuggestions(matches);
          setShowDropdown(matches.length > 0);
        }
      } catch {}
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, tags, apiBase]);

  async function addTag(name: string) {
    const normalized = name.trim().toLowerCase();
    if (!normalized || tags.includes(normalized)) return;
    setTags((prev) => [...prev, normalized]);
    setInput("");
    setSuggestions([]);
    setShowDropdown(false);
    try {
      await fetch(`${apiBase}/api/module/documents/${documentId}/tags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ tagName: normalized }),
      });
    } catch {
      setTags((prev) => prev.filter((t) => t !== normalized));
    }
  }

  async function removeTag(name: string) {
    setTags((prev) => prev.filter((t) => t !== name));
    try {
      await fetch(
        `${apiBase}/api/module/documents/${documentId}/tags/${encodeURIComponent(name)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token()}` },
        }
      );
    } catch {
      setTags((prev) => [...prev, name]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  return (
    <div className="relative">
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 ${
          readOnly ? "bg-gray-50" : "cursor-text bg-white focus-within:ring-2 focus-within:ring-blue-500"
        }`}
        onClick={() => !readOnly && inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700"
          >
            {tag}
            {!readOnly && (
              <button
                onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                aria-label={`Remove tag ${tag}`}
                className="ml-0.5 text-blue-500 hover:text-blue-800"
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!readOnly && (
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
            placeholder={tags.length === 0 ? "Add tags…" : ""}
            className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none"
          />
        )}
      </div>

      {showDropdown && (
        <ul className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-md">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag(s)}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
