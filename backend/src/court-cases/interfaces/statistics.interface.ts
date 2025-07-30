export interface RegionStats {
  region: string;
  totalCases: number;
  wonCases: number;
  lostCases: number;
  settledCases: number;
  winRate: number;
  avgTimeToResolution: number;
  avgClaimAmount: number;
  avgSettlementAmount: number;
}

export interface TimeToResolutionStats {
  overall: {
    average: number;
    median: number;
    min: number;
    max: number;
  };
  byRegion: Array<{
    region: string;
    average: number;
    median: number;
  }>;
  byCaseType: Array<{
    caseType: string;
    average: number;
    median: number;
  }>;
}

export interface WinRateStats {
  overall: {
    totalCases: number;
    wonCases: number;
    winRate: number;
  };
  byRegion: Array<{
    region: string;
    totalCases: number;
    wonCases: number;
    winRate: number;
  }>;
  byCaseType: Array<{
    caseType: string;
    totalCases: number;
    wonCases: number;
    winRate: number;
  }>;
}

export interface ComprehensiveStats {
  totalCases: number;
  resolvedCases: number;
  resolutionRate: number;
  winRateStats: WinRateStats;
  timeToResolutionStats: TimeToResolutionStats;
  regionStats: RegionStats[];
  caseTypeDistribution: Array<{
    caseType: string;
    count: number;
    percentage: number;
  }>;
  outcomeDistribution: Array<{
    outcome: string;
    count: number;
    percentage: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    casesFiledCount: number;
    casesResolvedCount: number;
    avgResolutionTime: number;
  }>;
}