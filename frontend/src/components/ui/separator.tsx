/**
 * Separator component (#1498).
 *
 * `app/document/[id]/page.tsx` imported `@/components/ui/separator`, which did
 * not exist and broke the build. This provides the missing component.
 */
import * as React from "react";

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ orientation = "horizontal", className = "", ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      aria-orientation={orientation}
      className={[
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        "bg-gray-200",
        className,
      ].join(" ")}
      {...props}
    />
  ),
);

Separator.displayName = "Separator";

export default Separator;
