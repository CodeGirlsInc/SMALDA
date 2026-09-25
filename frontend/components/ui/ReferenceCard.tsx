import React from 'react';

interface ReferenceCardProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export const ReferenceCard: React.FC<ReferenceCardProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
};
