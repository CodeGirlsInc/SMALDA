import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ExcelExportService {
  private readonly logger = new Logger(ExcelExportService.name);
  private readonly outputDir = path.join(process.cwd(), 'reports');

  constructor() {
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async generateDocumentVerificationExcel(data: any, title: string): Promise<string> {
    this.logger.log(`Generating document verification Excel report: ${title}`);

    const fileName = `doc-verification-${Date.now()}.xlsx`;
    const filePath = path.join(this.outputDir, fileName);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smalda System';
    workbook.created = new Date();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    this.styleSummarySheet(summarySheet);

    summarySheet.addRow(['Document Verification Report']);
    summarySheet.addRow([`Generated: ${new Date().toLocaleString()}`]);
    summarySheet.addRow([]);

    if (data.startDate && data.endDate) {
      summarySheet.addRow(['Period:', `${data.startDate} to ${data.endDate}`]);
      summarySheet.addRow([]);
    }

    const summary = data.summary || {};
    summarySheet.addRow(['Metric', 'Value']);
    summarySheet.addRow(['Total Verifications', summary.totalVerifications || 0]);
    summarySheet.addRow(['Successful', summary.successfulVerifications || 0]);
    summarySheet.addRow(['Failed', summary.failedVerifications || 0]);
    summarySheet.addRow(['Success Rate', `${summary.successRate || 0}%`]);
    summarySheet.addRow(['Avg Processing Time (s)', summary.averageProcessingTime || 0]);

    // Style the summary table
    summarySheet.getRow(6).font = { bold: true };
    summarySheet.getColumn(1).width = 25;
    summarySheet.getColumn(2).width = 20;

    // Transactions Sheet
    if (data.transactions && data.transactions.length > 0) {
      const transactionsSheet = workbook.addWorksheet('Transactions');
      
      transactionsSheet.columns = [
        { header: 'Transaction Hash', key: 'transactionHash', width: 40 },
        { header: 'Document Hash', key: 'documentHash', width: 40 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Network', key: 'network', width: 15 },
        { header: 'Fee (XLM)', key: 'fee', width: 12 },
        { header: 'Created At', key: 'createdAt', width: 20 },
        { header: 'Confirmed At', key: 'confirmedAt', width: 20 },
      ];

      // Style header
      transactionsSheet.getRow(1).font = { bold: true };
      transactionsSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      transactionsSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

      // Add data
      data.transactions.forEach((tx: any) => {
        transactionsSheet.addRow({
          transactionHash: tx.transactionHash || '',
          documentHash: tx.documentHash || '',
          status: tx.status || '',
          network: tx.network || '',
          fee: tx.fee || '0',
          createdAt: tx.createdAt ? new Date(tx.createdAt).toLocaleString() : '',
          confirmedAt: tx.confirmedAt ? new Date(tx.confirmedAt).toLocaleString() : '',
        });
      });
    }

    // Daily Stats Sheet
    if (data.verificationsPerDay && data.verificationsPerDay.length > 0) {
      const dailySheet = workbook.addWorksheet('Daily Stats');
      
      dailySheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Count', key: 'count', width: 12 },
      ];

      dailySheet.getRow(1).font = { bold: true };
      dailySheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      dailySheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

      data.verificationsPerDay.forEach((day: any) => {
        dailySheet.addRow(day);
      });
    }

    await workbook.xlsx.writeFile(filePath);
    this.logger.log(`Excel report generated: ${filePath}`);
    return filePath;
  }

  async generateUserActivityExcel(data: any, title: string): Promise<string> {
    this.logger.log(`Generating user activity Excel report: ${title}`);

    const fileName = `user-activity-${Date.now()}.xlsx`;
    const filePath = path.join(this.outputDir, fileName);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smalda System';
    workbook.created = new Date();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    this.styleSummarySheet(summarySheet);

    summarySheet.addRow(['User Activity Report']);
    summarySheet.addRow([`Generated: ${new Date().toLocaleString()}`]);
    summarySheet.addRow([]);

    const summary = data.summary || {};
    summarySheet.addRow(['Metric', 'Value']);
    summarySheet.addRow(['Total Users', summary.totalUsers || 0]);
    summarySheet.addRow(['Active Users', summary.activeUsers || 0]);
    summarySheet.addRow(['New Users Today', summary.newUsersToday || 0]);
    summarySheet.addRow(['New Users This Week', summary.newUsersThisWeek || 0]);
    summarySheet.addRow(['New Users This Month', summary.newUsersThisMonth || 0]);

    summarySheet.getRow(4).font = { bold: true };
    summarySheet.getColumn(1).width = 25;
    summarySheet.getColumn(2).width = 20;

    // Most Active Users Sheet
    if (data.mostActiveUsers && data.mostActiveUsers.length > 0) {
      const activeUsersSheet = workbook.addWorksheet('Most Active Users');
      
      activeUsersSheet.columns = [
        { header: 'User ID', key: 'userId', width: 40 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Activity Count', key: 'activityCount', width: 15 },
      ];

      activeUsersSheet.getRow(1).font = { bold: true };
      activeUsersSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      activeUsersSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

      data.mostActiveUsers.forEach((user: any) => {
        activeUsersSheet.addRow(user);
      });
    }

    // User Growth Sheet
    if (data.userGrowth && data.userGrowth.length > 0) {
      const growthSheet = workbook.addWorksheet('User Growth');
      
      growthSheet.columns = [
        { header: 'Date', key: 'date', width: 15 },
        { header: 'New Users', key: 'count', width: 12 },
      ];

      growthSheet.getRow(1).font = { bold: true };
      growthSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      growthSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

      data.userGrowth.forEach((day: any) => {
        growthSheet.addRow(day);
      });
    }

    await workbook.xlsx.writeFile(filePath);
    this.logger.log(`Excel report generated: ${filePath}`);
    return filePath;
  }

  async generateSystemAnalyticsExcel(data: any, title: string): Promise<string> {
    this.logger.log(`Generating system analytics Excel report: ${title}`);

    const fileName = `system-analytics-${Date.now()}.xlsx`;
    const filePath = path.join(this.outputDir, fileName);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Smalda System';
    workbook.created = new Date();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    this.styleSummarySheet(summarySheet);

    summarySheet.addRow(['System Analytics Report']);
    summarySheet.addRow([`Generated: ${new Date().toLocaleString()}`]);
    summarySheet.addRow([]);

    const summary = data.summary || {};
    summarySheet.addRow(['Metric', 'Value']);
    summarySheet.addRow(['Total Transactions', summary.totalTransactions || 0]);
    summarySheet.addRow(['Transactions Today', summary.transactionsToday || 0]);
    summarySheet.addRow(['Transactions This Week', summary.transactionsThisWeek || 0]);
    summarySheet.addRow(['Transactions This Month', summary.transactionsThisMonth || 0]);
    summarySheet.addRow(['Average Fee (XLM)', summary.averageTransactionFee || '0']);

    summarySheet.getRow(4).font = { bold: true };
    summarySheet.getColumn(1).width = 25;
    summarySheet.getColumn(2).width = 20;

    // Network Distribution Sheet
    if (data.networkDistribution && data.networkDistribution.length > 0) {
      const networkSheet = workbook.addWorksheet('Network Distribution');
      
      networkSheet.columns = [
        { header: 'Network', key: 'network', width: 20 },
        { header: 'Count', key: 'count', width: 12 },
      ];

      networkSheet.getRow(1).font = { bold: true };
      networkSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      networkSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

      data.networkDistribution.forEach((item: any) => {
        networkSheet.addRow(item);
      });
    }

    // Status Distribution Sheet
    if (data.statusDistribution && data.statusDistribution.length > 0) {
      const statusSheet = workbook.addWorksheet('Status Distribution');
      
      statusSheet.columns = [
        { header: 'Status', key: 'status', width: 20 },
        { header: 'Count', key: 'count', width: 12 },
      ];

      statusSheet.getRow(1).font = { bold: true };
      statusSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      statusSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

      data.statusDistribution.forEach((item: any) => {
        statusSheet.addRow(item);
      });
    }

    // Peak Hours Sheet
    if (data.peakHours && data.peakHours.length > 0) {
      const peakSheet = workbook.addWorksheet('Peak Hours');
      
      peakSheet.columns = [
        { header: 'Hour', key: 'hour', width: 12 },
        { header: 'Transaction Count', key: 'count', width: 15 },
      ];

      peakSheet.getRow(1).font = { bold: true };
      peakSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      peakSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

      data.peakHours.forEach((hour: any) => {
        peakSheet.addRow(hour);
      });
    }

    await workbook.xlsx.writeFile(filePath);
    this.logger.log(`Excel report generated: ${filePath}`);
    return filePath;
  }

  async generateCSV(data: any[], columns: string[], fileName: string): Promise<string> {
    this.logger.log(`Generating CSV file: ${fileName}`);

    const csvFileName = `${fileName}-${Date.now()}.csv`;
    const filePath = path.join(this.outputDir, csvFileName);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');

    worksheet.columns = columns.map(col => ({
      header: col,
      key: col,
      width: 20,
    }));

    data.forEach(row => {
      worksheet.addRow(row);
    });

    await workbook.csv.writeFile(filePath);
    this.logger.log(`CSV file generated: ${filePath}`);
    return filePath;
  }

  private styleSummarySheet(sheet: ExcelJS.Worksheet) {
    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 20;
    sheet.getRow(1).font = { size: 16, bold: true };
    sheet.getRow(2).font = { size: 10, color: { argb: 'FF666666' } };
  }
}
