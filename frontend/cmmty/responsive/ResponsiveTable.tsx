"use client";

import React from "react";

export interface Column<T> {
  key: keyof T;
  header: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  /** Hide this column on mobile card layout */
  hideOnMobile?: boolean;
}

interface ResponsiveTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  emptyState?: React.ReactNode;
  /** Key to use as the card title on mobile (defaults to first column) */
  cardTitleKey?: keyof T;
  /** Key to use as the card subtitle on mobile */
  cardSubtitleKey?: keyof T;
  /** Optional href builder - makes the card clickable linking to detail */
  getRowHref?: (row: T) => string;
}

export default function ResponsiveTable<T extends Record<string, unknown>>({
  columns,
  data,
  emptyState,
  cardTitleKey,
  cardSubtitleKey,
  getRowHref,
}: ResponsiveTableProps<T>) {
  const visibleColumns = columns.filter((c) => !c.hideOnMobile);
  const titleKey = cardTitleKey || columns[0]?.key;
  const subtitleKey = cardSubtitleKey;

  if (data.length === 0) {
    return (
      <div data-testid="empty-state">
        {emptyState ?? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No data available.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Desktop table view */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={String(col.key)}
                    className="px-4 py-3 text-left font-medium text-muted-foreground"
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((row, i) => (
                <tr key={i} className="hover:bg-muted/30">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 text-foreground">
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {data.map((row, i) => {
          const titleValue = titleKey
            ? columns
                .find((c) => c.key === titleKey)
                ?.render?.(row[titleKey], row) ?? String(row[titleKey] ?? "")
            : null;

          const subtitleValue = subtitleKey
            ? columns
                .find((c) => c.key === subtitleKey)
                ?.render?.(row[subtitleKey], row) ??
              String(row[subtitleKey] ?? "")
            : null;

          const cardContent = (
            <div
              key={i}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              {titleValue && (
                <p className="text-sm font-semibold text-foreground mb-1">
                  {titleValue}
                </p>
              )}
              {subtitleValue && (
                <p className="text-xs text-muted-foreground mb-3">
                  {subtitleValue}
                </p>
              )}
              <dl className="space-y-2">
                {visibleColumns
                  .filter((col) => col.key !== titleKey && col.key !== subtitleKey)
                  .map((col) => (
                    <div key={String(col.key)} className="flex justify-between gap-2">
                      <dt className="text-xs text-muted-foreground shrink-0">
                        {col.header}
                      </dt>
                      <dd className="text-xs font-medium text-foreground text-right">
                        {col.render
                          ? col.render(row[col.key], row)
                          : String(row[col.key] ?? "")}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          );

          if (getRowHref) {
            return (
              <a
                key={i}
                href={getRowHref(row)}
                className="block min-h-[44px] transition-colors hover:bg-muted/50 active:bg-muted"
              >
                {cardContent}
              </a>
            );
          }

          return cardContent;
        })}
      </div>
    </div>
  );
}
