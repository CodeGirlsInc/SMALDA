import React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white ${className ?? ""}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: CardProps) {
  return (
    <div className={`p-5 pb-0 ${className ?? ""}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: CardProps) {
  return (
    <h3 className={`text-lg font-semibold ${className ?? ""}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: CardProps) {
  return (
    <p className={`text-sm text-gray-500 ${className ?? ""}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: CardProps) {
  return (
    <div className={`p-5 ${className ?? ""}`} {...props}>
      {children}
    </div>
  );
}
