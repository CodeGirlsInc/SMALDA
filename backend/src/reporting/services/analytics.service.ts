import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { StellarTransaction, TransactionStatus } from '../../stellar/entities/stellar-transaction.entity';
import { User } from '../../entities/user.entity';

export interface DocumentAnalytics {
  totalVerifications: number;
  successfulVerifications: number;
  failedVerifications: number;
  successRate: number;
  averageProcessingTime: number;
  verificationsPerDay: { date: string; count: number }[];
  riskTrends: { date: string; low: number; medium: number; high: number }[];
}

export interface UserActivityAnalytics {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  userGrowth: { date: string; count: number }[];
  mostActiveUsers: { userId: string; email: string; activityCount: number }[];
}

export interface SystemAnalytics {
  totalTransactions: number;
  transactionsToday: number;
  transactionsThisWeek: number;
  transactionsThisMonth: number;
  averageTransactionFee: string;
  networkDistribution: Array<{ network: string; count: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
  peakHours: { hour: number; count: number }[];
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(StellarTransaction)
    private readonly transactionRepository: Repository<StellarTransaction>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getDocumentAnalytics(startDate: Date, endDate: Date): Promise<DocumentAnalytics> {
    this.logger.log(`Generating document analytics from ${startDate} to ${endDate}`);

    const transactions = await this.transactionRepository.find({
      where: {
        createdAt: Between(startDate, endDate),
      },
    });

    const totalVerifications = transactions.length;
    const successfulVerifications = transactions.filter(
      (t) => t.status === TransactionStatus.SUCCESS,
    ).length;
    const failedVerifications = transactions.filter(
      (t) => t.status === TransactionStatus.FAILED,
    ).length;
    const successRate = totalVerifications > 0 
      ? (successfulVerifications / totalVerifications) * 100 
      : 0;

    // Calculate average processing time (mock calculation)
    const averageProcessingTime = transactions.length > 0 
      ? transactions.reduce((sum, t) => {
          const diff = t.confirmedAt 
            ? new Date(t.confirmedAt).getTime() - new Date(t.createdAt).getTime()
            : 0;
          return sum + diff;
        }, 0) / transactions.length / 1000
      : 0;

    // Group by day
    const verificationsPerDay = this.groupByDay(transactions, startDate, endDate);

    // Mock risk trends (you'd calculate this based on your risk assessment logic)
    const riskTrends = this.calculateRiskTrends(startDate, endDate);

    return {
      totalVerifications,
      successfulVerifications,
      failedVerifications,
      successRate: Math.round(successRate * 100) / 100,
      averageProcessingTime: Math.round(averageProcessingTime * 100) / 100,
      verificationsPerDay,
      riskTrends,
    };
  }

  async getUserActivityAnalytics(startDate: Date, endDate: Date): Promise<UserActivityAnalytics> {
    this.logger.log(`Generating user activity analytics from ${startDate} to ${endDate}`);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      allUsers,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { isActive: true } }),
      this.userRepository.count({ where: { createdAt: MoreThanOrEqual(todayStart) } }),
      this.userRepository.count({ where: { createdAt: MoreThanOrEqual(weekStart) } }),
      this.userRepository.count({ where: { createdAt: MoreThanOrEqual(monthStart) } }),
      this.userRepository.find({
        where: {
          createdAt: Between(startDate, endDate),
        },
        order: { createdAt: 'ASC' },
      }),
    ]);

    const userGrowth = this.calculateUserGrowth(allUsers, startDate, endDate);
    const mostActiveUsers = await this.getMostActiveUsers(startDate, endDate);

    return {
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      userGrowth,
      mostActiveUsers,
    };
  }

  async getSystemAnalytics(startDate: Date, endDate: Date): Promise<SystemAnalytics> {
    this.logger.log(`Generating system analytics from ${startDate} to ${endDate}`);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalTransactions,
      transactionsToday,
      transactionsThisWeek,
      transactionsThisMonth,
      allTransactions,
    ] = await Promise.all([
      this.transactionRepository.count(),
      this.transactionRepository.count({ where: { createdAt: MoreThanOrEqual(todayStart) } }),
      this.transactionRepository.count({ where: { createdAt: MoreThanOrEqual(weekStart) } }),
      this.transactionRepository.count({ where: { createdAt: MoreThanOrEqual(monthStart) } }),
      this.transactionRepository.find({
        where: {
          createdAt: Between(startDate, endDate),
        },
      }),
    ]);

    // Calculate average transaction fee
    const totalFee = allTransactions.reduce((sum, t) => sum + (parseFloat(t.fee) || 0), 0);
    const averageTransactionFee = allTransactions.length > 0 
      ? (totalFee / allTransactions.length).toFixed(7)
      : '0';

    // Network distribution
    const networkDistribution = this.calculateDistribution(allTransactions, 'network') as Array<{ network: string; count: number }>;

    // Status distribution
    const statusDistribution = this.calculateDistribution(allTransactions, 'status') as Array<{ status: string; count: number }>;

    // Peak hours
    const peakHours = this.calculatePeakHours(allTransactions);

    return {
      totalTransactions,
      transactionsToday,
      transactionsThisWeek,
      transactionsThisMonth,
      averageTransactionFee,
      networkDistribution,
      statusDistribution,
      peakHours,
    };
  }

  private groupByDay(
    transactions: StellarTransaction[],
    startDate: Date,
    endDate: Date,
  ): { date: string; count: number }[] {
    const dayMap = new Map<string, number>();

    // Initialize all days with 0
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dayMap.set(dateStr, 0);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Count transactions per day
    transactions.forEach((t) => {
      const dateStr = new Date(t.createdAt).toISOString().split('T')[0];
      dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + 1);
    });

    return Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateRiskTrends(
    startDate: Date,
    endDate: Date,
  ): { date: string; low: number; medium: number; high: number }[] {
    // Mock risk trends - in production, you'd calculate based on actual risk assessment
    const trends = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      trends.push({
        date: currentDate.toISOString().split('T')[0],
        low: Math.floor(Math.random() * 50) + 20,
        medium: Math.floor(Math.random() * 30) + 10,
        high: Math.floor(Math.random() * 10),
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return trends;
  }

  private calculateUserGrowth(
    users: User[],
    startDate: Date,
    endDate: Date,
  ): { date: string; count: number }[] {
    const dayMap = new Map<string, number>();

    // Initialize all days with 0
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dayMap.set(dateStr, 0);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Count new users per day
    users.forEach((user) => {
      const dateStr = new Date(user.createdAt).toISOString().split('T')[0];
      dayMap.set(dateStr, (dayMap.get(dateStr) || 0) + 1);
    });

    return Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private async getMostActiveUsers(
    startDate: Date,
    endDate: Date,
  ): Promise<{ userId: string; email: string; activityCount: number }[]> {
    // This is a simplified version - in production, you'd track user activities in a separate table
    const users = await this.userRepository.find({
      where: {
        lastLoginAt: Between(startDate, endDate),
      },
      order: { lastLoginAt: 'DESC' },
      take: 10,
    });

    return users.map((user) => ({
      userId: user.id,
      email: user.email,
      activityCount: Math.floor(Math.random() * 100) + 1, // Mock count
    }));
  }

  private calculateDistribution(
    items: any[],
    field: string,
  ): Array<Record<string, any>> {
    const distribution = new Map<string, number>();

    items.forEach((item) => {
      const value = item[field] || 'unknown';
      distribution.set(value, (distribution.get(value) || 0) + 1);
    });

    return Array.from(distribution.entries())
      .map(([key, count]) => ({ [field]: key, count }))
      .sort((a, b) => b.count - a.count);
  }

  private calculatePeakHours(transactions: StellarTransaction[]): { hour: number; count: number }[] {
    const hourMap = new Map<number, number>();

    // Initialize all hours with 0
    for (let i = 0; i < 24; i++) {
      hourMap.set(i, 0);
    }

    // Count transactions per hour
    transactions.forEach((t) => {
      const hour = new Date(t.createdAt).getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
    });

    return Array.from(hourMap.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);
  }
}
