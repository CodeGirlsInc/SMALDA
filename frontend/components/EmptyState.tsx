import React from "react";

export type EmptyStateVariant = "empty" | "no-match";

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: EmptyStateVariant;
}

/**
 * Reusable empty-state component for list views.
 *
 * - `variant="empty"` (default): first-run case, may include a primary
 *   action pointing the user at the highest-value next step.
 * - `variant="no-match"`: filter or query returned no rows. Caller
 *   typically passes a clear-filters action.
 *
 * `role="status"` + `aria-live="polite"` so screen readers announce
 * "empty list" rather than treating the lack of a region as an error.
 */
export function EmptyState({
  title,
  description,
  action,
  variant = "empty",
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-variant={variant}
      data-testid="empty-state"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-12 text-center"
    >
      <p className="text-base font-medium text-gray-900">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-gray-600">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
