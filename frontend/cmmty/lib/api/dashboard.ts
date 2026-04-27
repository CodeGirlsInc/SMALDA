import { get } from '../apiClient';
import { Document } from '../../types/document';

export interface DashboardStats {
  totalDocuments: number;
  verifiedDocuments: number;
  flaggedDocuments: number;
  pendingDocuments: number;
  avgRiskScore: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentDocuments: Document[];
}

/**
 * Fetch all documents for the current user
 * Uses the pagination endpoint to get documents
 */
export const fetchUserDocuments = async (): Promise<Document[]> => {
  try {
    // Using the documents pagination endpoint
    const response = await get<any>('/documents');
    
    // Handle both paginated and non-paginated responses
    if (response.data && Array.isArray(response.data)) {
      return response.data;
    } else if (Array.isArray(response)) {
      return response;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching documents:', error);
    throw error;
  }
};

/**
 * Calculate dashboard statistics from documents
 */
export const calculateDashboardStats = (documents: Document[]): DashboardStats => {
  const totalDocuments = documents.length;
  const verifiedDocuments = documents.filter(
    (d) => d.status === 'verified'
  ).length;
  const flaggedDocuments = documents.filter(
    (d) => d.status === 'flagged'
  ).length;
  const pendingDocuments = documents.filter(
    (d) => d.status === 'pending'
  ).length;
  
  const avgRiskScore = totalDocuments > 0
    ? Math.round(
        documents.reduce((sum, d) => sum + (d.riskScore ?? 0), 0) / totalDocuments
      )
    : 0;

  return {
    totalDocuments,
    verifiedDocuments,
    flaggedDocuments,
    pendingDocuments,
    avgRiskScore,
  };
};

/**
 * Get recent documents (last 5)
 */
export const getRecentDocuments = (documents: Document[], limit: number = 5): Document[] => {
  return [...documents]
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, limit);
};

/**
 * Fetch complete dashboard data
 */
export const fetchDashboardData = async (): Promise<DashboardData> => {
  const documents = await fetchUserDocuments();
  const stats = calculateDashboardStats(documents);
  const recentDocuments = getRecentDocuments(documents, 5);

  return {
    stats,
    recentDocuments,
  };
};
