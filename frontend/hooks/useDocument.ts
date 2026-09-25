'use client';

import { useQuery } from '@tanstack/react-query';
import { request } from '@/lib/api-client';

interface DocumentDetail {
  id: string;
  title: string;
  fileHash: string;
  status: string;
  riskScore: number | null;
  riskFlags: string[] | null;
  createdAt: string;
  updatedAt: string;
  timeline: Array<{ status: string; timestamp: string; description?: string }>;
}

export function useDocument(documentId: string) {
  return useQuery<DocumentDetail>({
    queryKey: ['document', documentId],
    queryFn: () => request(`/api/documents/${documentId}`),
    enabled: !!documentId,
  });
}