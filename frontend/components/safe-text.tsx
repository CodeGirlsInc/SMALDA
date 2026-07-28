import { sanitizeForDisplay } from "@/lib/sanitize";

interface SafeTextProps {
  content: unknown;
  className?: string;
  as?: "p" | "span" | "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

export function SafeText({ content, className, as: Tag = "span" }: SafeTextProps) {
  return <Tag className={className}>{sanitizeForDisplay(content)}</Tag>;
}
