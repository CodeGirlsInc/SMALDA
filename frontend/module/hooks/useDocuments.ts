"use client";

import { useCallback, useEffect, useState } from "react";
import { get, post, del } from "../lib/api-client";

interface Document {
  id: string;
  title: string;
  status: string;
  riskScore: number | null;
  uploadedAt: string;
}

interface DocumentsFilters {
  status?: string;
  page?: number;
  limit?: number;
}

interface UseDocumentsResult {
  documents: Document[];
  total: number;
  isLoading: boolean;
  error: string | null;
  uploadDocument: (file: File) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  refetch: () => void;
}

export function useDocuments(filters: DocumentsFilters = {}): UseDocumentsResult {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const params: Record<string, unknown> = {};
    if (filters.status) params.status = filters.status;
    if (filters.page) params.page = filters.page;
    if (filters.limit) params.limit = filters.limit;

    get<{ data: Document[]; total: number } | Document[]>(
      "/api/module/documents",
      params
    )
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setDocuments(data);
          setTotal(data.length);
        } else {
          setDocuments(data.data);
          setTotal(data.total);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message ?? "Failed to fetch documents.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filters.status, filters.page, filters.limit, tick]);

  const uploadDocument = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const optimisticDoc: Document = {
      id: `temp-${Date.now()}`,
      title: file.name,
      status: "PENDING",
      riskScore: null,
      uploadedAt: new Date().toISOString(),
    };
    setDocuments((prev) => [optimisticDoc, ...prev]);

    try {
      const uploaded = await post<Document>("/api/documents/upload", formData);
      setDocuments((prev) =>
        prev.map((d) => (d.id === optimisticDoc.id ? uploaded : d))
      );
    } catch (err) {
      setDocuments((prev) => prev.filter((d) => d.id !== optimisticDoc.id));
      throw err;
    }
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    await del(`/api/module/documents/${id}`);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return { documents, total, isLoading, error, uploadDocument, deleteDocument, refetch };
}

export default useDocuments;
