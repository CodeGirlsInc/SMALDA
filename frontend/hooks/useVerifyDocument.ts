'use client';

import { useMutation } from '@tanstack/react-query';
import { request } from '@/lib/api-client';
import { apiUrl } from '@/lib/api-config';

export function useVerifyDocument(documentId: string) {
  return useMutation({
    mutationFn: () =>
      request(apiUrl(`/documents/${documentId}/verify`), {
        method: 'POST',
      }),
  });
}