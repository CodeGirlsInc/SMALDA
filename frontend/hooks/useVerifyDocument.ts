'use client';

import { useMutation } from '@tanstack/react-query';
import { request } from '@/lib/api-client';

export function useVerifyDocument(documentId: string) {
  return useMutation({
    mutationFn: () =>
      request(`/api/documents/${documentId}/verify`, {
        method: 'POST',
      }),
  });
}