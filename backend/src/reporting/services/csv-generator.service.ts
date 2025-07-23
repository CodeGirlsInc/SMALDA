import { Injectable, Logger } from "@nestjs/common"
import * as fs from "fs"
import type {
  DocumentAnalysisReportData,
  RiskSummaryReportData,
  AuditTrailReportData,
  UserActivityReportData,
  SystemOverviewReportData,
  ComplianceReportData,
} from "../interfaces/report-data.interface"

@Injectable()
export class CsvGeneratorService {
  private readonly logger = new Logger(CsvGeneratorService.name)

  async generateDocumentAnalysisReport(data: DocumentAnalysisReportData, filePath: string): Promise<void> {
    const headers = [
      "Document ID",
      "Document Name",
      "Original Name",
      "Uploaded By",
      "Upload Date",
      "Size (Bytes)",
      "MIME Type",
      "Risk Level",
      "Risk Score",
      "Risk Summary",
      "Detected Keywords",
      "Analyzed By",
      "Analysis Date",
    ]

    const rows = data.documents.map((doc) => [
      doc.id,
      doc.name,
      doc.originalName,
      doc.uploadedBy,
      doc.uploadedAt.toISOString(),
      doc.size.toString(),
      doc.mimeType,
      doc.riskAnalysis?.riskLevel || "N/A",
      doc.riskAnalysis?.riskScore?.toString() || "N/A",
      doc.riskAnalysis?.summary || "N/A",
      doc.riskAnalysis?.detectedKeywords.join("; ") || "N/A",
      doc.riskAnalysis?.analyzedBy || "N/A",
      doc.riskAnalysis?.analyzedAt?.toISOString() || "N/A",
    ])

    await this.writeCsvFile(filePath, headers, rows)
  }

  async generateRiskSummaryReport(data: RiskSummaryReportData, filePath: string): Promise<void> {
    const headers = [
      "Analysis ID",
      "Document ID",
      "Document Name",
      "Risk Level",
      "Risk Score",
      "Summary",
      "Detected Keywords",
      "Risk Factors Count",
      "Top Risk Category",
      "Analyzed By",
      "Analysis Date",
      "Uploaded By",
    ]

    const rows = data.riskAnalyses.map((analysis) => [
      analysis.id,
      analysis.documentId,
      analysis.documentName,
      analysis.riskLevel,
      analysis.riskScore.toString(),
      analysis.summary,
      analysis.detectedKeywords.join("; "),
      analysis.riskFactors.length.toString(),
      analysis.riskFactors[0]?.category || "N/A",
      analysis.analyzedBy,
      analysis.analyzedAt.toISOString(),
      analysis.uploadedBy,
    ])

    await this.writeCsvFile(filePath, headers, rows)
  }

  async generateAuditTrailReport(data: AuditTrailReportData, filePath: string): Promise<void> {
    const headers = [
      "Log ID",
      "User ID",
      "User Email",
      "Action",
      "Description",
      "Resource Type",
      "Resource ID",
      "Success",
      "IP Address",
      "Timestamp",
    ]

    const rows = data.auditLogs.map((log) => [
      log.id,
      log.userId,
      log.userEmail,
      log.action,
      log.description,
      log.resourceType,
      log.resourceId,
      log.success.toString(),
      log.ipAddress,
      log.createdAt.toISOString(),
    ])

    await this.writeCsvFile(filePath, headers, rows)
  }

  async generateUserActivityReport(data: UserActivityReportData, filePath: string): Promise<void> {
    const headers = [
      "User ID",
      "Email",
      "Full Name",
      "Role",
      "Department",
      "Documents Uploaded",
      "Documents Analyzed",
      "Risk Documents",
      "Total Actions",
      "Last Activity",
    ]

    const rows = data.users.map((user) => [
      user.id,
      user.email,
      user.fullName,
      user.role,
      user.department,
      user.documentsUploaded.toString(),
      user.documentsAnalyzed.toString(),
      user.riskDocuments.toString(),
      user.totalActions.toString(),
      user.lastActivity.toISOString(),
    ])

    await this.writeCsvFile(filePath, headers, rows)
  }

  async generateSystemOverviewReport(data: SystemOverviewReportData, filePath: string): Promise<void> {
    // System metrics as CSV
    const headers = ["Metric", "Value", "Date"]

    const rows = [
      ["Total Documents", data.overview.totalDocuments.toString(), new Date().toISOString()],
      ["Total Users", data.overview.totalUsers.toString(), new Date().toISOString()],
      ["Total Risk Analyses", data.overview.totalRiskAnalyses.toString(), new Date().toISOString()],
      ["Total Audit Logs", data.overview.totalAuditLogs.toString(), new Date().toISOString()],
      ["Total Notifications", data.overview.totalNotifications.toString(), new Date().toISOString()],
      ["System Uptime", data.overview.systemUptime, new Date().toISOString()],
      ["Last Backup", data.overview.lastBackup.toISOString(), new Date().toISOString()],
      ["Database Health", data.metrics.systemHealth.database, new Date().toISOString()],
      ["Storage Health", data.metrics.systemHealth.storage, new Date().toISOString()],
      ["Notifications Health", data.metrics.systemHealth.notifications, new Date().toISOString()],
    ]

    // Add daily metrics
    data.metrics.documentsPerDay.forEach((day) => {
      rows.push(["Documents Per Day", day.count.toString(), day.date])
    })

    data.metrics.userActivity.forEach((day) => {
      rows.push(["Active Users", day.activeUsers.toString(), day.date])
    })

    await this.writeCsvFile(filePath, headers, rows)
  }

  async generateComplianceReport(data: ComplianceReportData, filePath: string): Promise<void> {
    const headers = [
      "Document ID",
      "Document Name",
      "Violation Type",
      "Severity",
      "Description",
      "Detected Date",
      "Status",
    ]

    const rows = data.violations.map((violation) => [
      violation.documentId,
      violation.documentName,
      violation.violationType,
      violation.severity,
      violation.description,
      violation.detectedAt.toISOString(),
      violation.status,
    ])

    await this.writeCsvFile(filePath, headers, rows)
  }

  private async writeCsvFile(filePath: string, headers: string[], rows: string[][]): Promise<void> {
    const csvContent = [headers, ...rows]
      .map((row) => row.map((field) => this.escapeCsvField(field)).join(","))
      .join("\n")

    await fs.promises.writeFile(filePath, csvContent, "utf-8")
  }

  private escapeCsvField(field: string): string {
    if (field.includes(",") || field.includes('"') || field.includes("\n")) {
      return `"${field.replace(/"/g, '""')}"`
    }
    return field
  }
}
