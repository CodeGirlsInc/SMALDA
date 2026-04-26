"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-6">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center justify-center min-h-[44px] rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted active:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="relative ml-3 inline-flex items-center justify-center min-h-[44px] rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted active:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Page <span className="font-medium">{currentPage}</span> of{" "}
          <span className="font-medium">{totalPages}</span>
        </p>
        <nav
          className="isolate inline-flex -space-x-px rounded-md shadow-sm"
          aria-label="Pagination"
        >
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="relative inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-l-md px-2 py-2 text-foreground ring-1 ring-inset ring-border hover:bg-muted focus:z-20 focus:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="sr-only">Previous</span>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`relative inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-border focus:z-20 focus:outline-offset-0 ${
                page === currentPage
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="relative inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-r-md px-2 py-2 text-foreground ring-1 ring-inset ring-border hover:bg-muted focus:z-20 focus:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="sr-only">Next</span>
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </div>
  );
}
