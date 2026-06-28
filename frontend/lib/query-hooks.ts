import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './api-client';

// Auth
export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => apiClient.get('/users/me').then((r) => r.data),
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      apiClient.post('/auth/login', data).then((r) => r.data),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (data: { email: string; password: string; fullName: string }) =>
      apiClient.post('/auth/register', data).then((r) => r.data),
  });
}

// Documents
export function useDocuments(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['documents', page, limit],
    queryFn: () => apiClient.get('/documents', { params: { page, limit } }).then((r) => r.data),
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => apiClient.get(`/documents/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useVerifyDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/documents/${id}/verify`).then((r) => r.data),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['document', id] });
    },
  });
}

// Organizations
export function useOrganizations() {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: () => apiClient.get('/organizations').then((r) => r.data),
  });
}

export function useOrganization(id: string) {
  return useQuery({
    queryKey: ['organization', id],
    queryFn: () => apiClient.get(`/organizations/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      apiClient.post('/organizations', data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['organizations'] }),
  });
}

// Shared documents
export function useSharedDocuments() {
  return useQuery({
    queryKey: ['shared-documents'],
    queryFn: () => apiClient.get('/sharing/documents').then((r) => r.data),
  });
}

export function useShareInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { documentId: string; invitedEmail: string }) =>
      apiClient.post('/sharing/invite', data).then((r) => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shared-documents'] }),
  });
}

// Admin
export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => apiClient.get('/admin/stats').then((r) => r.data),
  });
}

export function useAdminDocuments(params?: { page?: number; limit?: number; status?: string; search?: string }) {
  return useQuery({
    queryKey: ['admin-documents', params],
    queryFn: () => apiClient.get('/admin/documents', { params }).then((r) => r.data),
  });
}

export function useQueueStats() {
  return useQuery({
    queryKey: ['queue-stats'],
    queryFn: () => apiClient.get('/admin/queue/stats').then((r) => r.data),
  });
}
