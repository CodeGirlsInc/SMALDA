'use client';

import { StatusBadge } from './StatusBadge';

interface DocumentHeaderProps {
  title: string;
  uploadedAt: string;
  status: string;
}

export function DocumentHeader({ title, uploadedAt, status }: DocumentHeaderProps) {
  const isRevoked = status === 'REJECTED';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          {isRevoked && (
            <div className="mt-2 flex items-center gap-2 text-red-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm font-medium">This document has been revoked</span>
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">Uploaded {new Date(uploadedAt).toLocaleDateString()}</p>
        </div>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}