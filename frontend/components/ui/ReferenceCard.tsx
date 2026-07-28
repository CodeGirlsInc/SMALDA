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
    <div className="rounded-lg border border-gray-200 p-4 shadow-sm bg-white">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
};
