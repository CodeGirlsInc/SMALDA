export type AnalyticsOverview = {
  totalUsers: number;
  totalDocuments: number;
  totalVerifications: number;
};

export type AnalyticsTrendPoint = {
  date: string;
  users: number;
  documents: number;
  verifications: number;
};

export type RiskDistributionItem = {
  risk: "low" | "medium" | "high";
  count: number;
};

export type UserActivityRow = {
  userId: string;
  name: string;
  email: string;
  lastActiveAt: string;
  actionsCount: number;
};

export type SystemHealth = {
  apiStatus: "healthy" | "degraded" | "down";
  dbStatus: "healthy" | "degraded" | "down";
  latencyMs: number;
};

export type RecentVerification = {
  id: string;
  documentId: string;
  userEmail: string;
  status: "approved" | "rejected";
  verifiedAt: string;
};

export type AdminAnalyticsResponse = {
  overview: AnalyticsOverview;
  trends: AnalyticsTrendPoint[];
  riskDistribution: RiskDistributionItem[];
  userActivity: UserActivityRow[];
  systemHealth: SystemHealth;
  recentVerifications: RecentVerification[];
};
