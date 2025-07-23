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
import * as PDFKit from "pdfkit" // Declare the PDFKit variable

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name)

  async generateDocumentAnalysisReport(
    data: DocumentAnalysisReportData,
    title: string,
    filePath: string,
  ): Promise<void> {
    const doc = new PDFKit.PDFDocument({ margin: 50 })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    // Header
    this.addHeader(doc, title, "Document Analysis Report")

    // Summary Section
    doc.fontSize(16).text("Executive Summary", { underline: true })
    doc.moveDown()
    doc.fontSize(12)
    doc.text(`Total Documents: ${data.summary.totalDocuments}`)
    doc.text(`Total Size: ${this.formatBytes(data.summary.totalSize)}`)
    doc.text(`Average Risk Score: ${data.summary.averageRiskScore.toFixed(2)}`)
    doc.moveDown()

    // Risk Level Distribution
    doc.fontSize(14).text("Risk Level Distribution", { underline: true })
    doc.moveDown()
    doc.fontSize(12)
    Object.entries(data.summary.byRiskLevel).forEach(([level, count]) => {
      doc.text(`${level}: ${count} documents`)
    })
    doc.moveDown()

    // MIME Type Distribution
    doc.fontSize(14).text("Document Types", { underline: true })
    doc.moveDown()
    doc.fontSize(12)
    Object.entries(data.summary.byMimeType).forEach(([type, count]) => {
      doc.text(`${type}: ${count} documents`)
    })
    doc.moveDown()

    // Document Details
    if (data.documents.length > 0) {
      doc.addPage()
      doc.fontSize(16).text("Document Details", { underline: true })
      doc.moveDown()

      data.documents.forEach((document, index) => {
        if (index > 0 && index % 5 === 0) {
          doc.addPage()
        }

        doc.fontSize(12)
        doc.text(`Document: ${document.originalName}`, { continued: false })
        doc.text(`Uploaded by: ${document.uploadedBy}`)
        doc.text(`Upload Date: ${document.uploadedAt.toLocaleDateString()}`)
        doc.text(`Size: ${this.formatBytes(document.size)}`)
        doc.text(`Type: ${document.mimeType}`)

        if (document.riskAnalysis) {
          doc.text(`Risk Level: ${document.riskAnalysis.riskLevel}`)
          doc.text(`Risk Score: ${document.riskAnalysis.riskScore}`)
          doc.text(`Summary: ${document.riskAnalysis.summary}`)
          if (document.riskAnalysis.detectedKeywords.length > 0) {
            doc.text(`Keywords: ${document.riskAnalysis.detectedKeywords.join(", ")}`)
          }
        }
        doc.moveDown()
      })
    }

    this.addFooter(doc)
    doc.end()

    return new Promise((resolve, reject) => {
      stream.on("finish", resolve)
      stream.on("error", reject)
    })
  }

  async generateRiskSummaryReport(data: RiskSummaryReportData, title: string, filePath: string): Promise<void> {
    const doc = new PDFKit.PDFDocument({ margin: 50 })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    // Header
    this.addHeader(doc, title, "Risk Analysis Summary Report")

    // Summary Section
    doc.fontSize(16).text("Risk Overview", { underline: true })
    doc.moveDown()
    doc.fontSize(12)
    doc.text(`Total Risk Analyses: ${data.summary.totalAnalyses}`)
    doc.text(`Average Risk Score: ${data.summary.averageRiskScore.toFixed(2)}`)
    doc.text(`Critical Documents: ${data.summary.criticalDocuments}`)
    doc.moveDown()

    // Risk Level Distribution
    doc.fontSize(14).text("Risk Level Distribution", { underline: true })
    doc.moveDown()
    doc.fontSize(12)
    Object.entries(data.summary.byRiskLevel).forEach(([level, count]) => {
      const percentage = ((count / data.summary.totalAnalyses) * 100).toFixed(1)
      doc.text(`${level}: ${count} documents (${percentage}%)`)
    })
    doc.moveDown()

    // Top Risk Factors
    doc.fontSize(14).text("Top Risk Factors", { underline: true })
    doc.moveDown()
    doc.fontSize(12)
    data.summary.topRiskFactors.forEach((factor) => {
      doc.text(`${factor.category}: ${factor.count} occurrences`)
    })
    doc.moveDown()

    // High Risk Documents
    const highRiskDocs = data.riskAnalyses.filter((r) => r.riskLevel === "HIGH" || r.riskLevel === "CRITICAL")
    if (highRiskDocs.length > 0) {
      doc.addPage()
      doc.fontSize(16).text("High Risk Documents", { underline: true })
      doc.moveDown()

      highRiskDocs.forEach((analysis, index) => {
        if (index > 0 && index % 3 === 0) {
          doc.addPage()
        }

        doc.fontSize(12)
        doc.text(`Document: ${analysis.documentName}`, { continued: false })
        doc.text(`Risk Level: ${analysis.riskLevel}`)
        doc.text(`Risk Score: ${analysis.riskScore}`)
        doc.text(`Uploaded by: ${analysis.uploadedBy}`)
        doc.text(`Analyzed by: ${analysis.analyzedBy}`)
        doc.text(`Analysis Date: ${analysis.analyzedAt.toLocaleDateString()}`)
        doc.text(`Summary: ${analysis.summary}`)

        if (analysis.detectedKeywords.length > 0) {
          doc.text(`Keywords: ${analysis.detectedKeywords.join(", ")}`)
        }

        if (analysis.riskFactors.length > 0) {
          doc.text("Risk Factors:")
          analysis.riskFactors.forEach((factor) => {
            doc.text(`  • ${factor.category} (${factor.severity}): ${factor.description}`)
          })
        }
        doc.moveDown()
      })
    }

    this.addFooter(doc)
    doc.end()

    return new Promise((resolve, reject) => {
      stream.on("finish", resolve)
      stream.on("error", reject)
    })
  }

  async generateAuditTrailReport(data: AuditTrailReportData, title: string, filePath: string): Promise<void> {
    const doc = new PDFKit.PDFDocument({ margin: 50 })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    // Header
    this.addHeader(doc, title, "Audit Trail Report")

    // Summary Section
    doc.fontSize(16).text("Audit Summary", { underline: true })
    doc.moveDown()
    doc.fontSize(12)
    doc.text(`Total Audit Logs: ${data.summary.totalLogs}`)
    doc.text(`Failed Operations: ${data.summary.failedOperations}`)
    doc.text(`Success Rate: ${data.summary.successRate.toFixed(2)}%`)
    doc.moveDown()

    // Action Distribution
    doc.fontSize(14).text("Actions Distribution", { underline: true })
    doc.moveDown()
    doc.fontSize(12)
    Object.entries(data.summary.byAction).forEach(([action, count]) => {
      doc.text(`${action}: ${count} occurrences`)
    })
    doc.moveDown()

    // Top Users
    doc.fontSize(14).text("Most Active Users", { underline: true })
    doc.moveDown()
    doc.fontSize(12)
    const topUsers = Object.entries(data.summary.byUser)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
    topUsers.forEach(([user, count]) => {
      doc.text(`${user}: ${count} actions`)
    })
    doc.moveDown()

    // Recent Activities
    if (data.auditLogs.length > 0) {
      doc.addPage()
      doc.fontSize(16).text("Recent Activities", { underline: true })
      doc.moveDown()

      data.auditLogs.slice(0, 50).forEach((log, index) => {
        if (index > 0 && index % 10 === 0) {
          doc.addPage()
        }

        doc.fontSize(10)
        doc.text(`${log.createdAt.toLocaleString()} - ${log.userEmail}`)
        doc.text(`Action: ${log.action}`)
        doc.text(`Description: ${log.description}`)
        doc.text(`Resource: ${log.resourceType}/${log.resourceId}`)
        doc.text(`Status: ${log.success ? "Success" : "Failed"}`)
        doc.text(`IP: ${log.ipAddress}`)
        doc.moveDown(0.5)
      })
    }

    this.addFooter(doc)
    doc.end()

    return new Promise((resolve, reject) => {
      stream.on("finish", resolve)
      stream.on("error", reject)
    })
  }

  async generateUserActivityReport(data: UserActivityReportData, title: string, filePath: string): Promise<void> {
    const doc = new PDFKit.PDFDocument({ margin: 50 })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    // Header
    this.addHeader(doc, title, "User Activity Report")

    // Summary Section
    doc.fontSize(16).text("Activity Overview", { underline: true })
    doc.moveDown()
    doc.fontSize(12)
    doc.text(`Total Users: ${data.summary.totalUsers}`)
    doc.text(`Active Users: ${data.summary.activeUsers}`)
    doc.text(`Total Documents: ${data.summary.totalDocuments}`)
    doc.text(`Total Analyses: ${data.summary.totalAnalyses}`)
    doc.moveDown()

    // Department Distribution
    doc.fontSize(14).text("Users by Department", { underline: true })
    doc.moveDown()
    doc.fontSize(12)
    Object.entries(data.summary.byDepartment).forEach(([dept, count]) => {
      doc.text(`${dept}: ${count} users`)
    })
    doc.moveDown()

    // User Details
    if (data.users.length > 0) {
      doc.addPage()
      doc.fontSize(16).text("User Activity Details", { underline: true })
      doc.moveDown()

      data.users.forEach((user, index) => {
        if (index > 0 && index % 8 === 0) {
          doc.addPage()
        }

        doc.fontSize(12)
        doc.text(`User: ${user.fullName} (${user.email})`)
        doc.text(`Role: ${user.role}`)
        doc.text(`Department: ${user.department}`)
        doc.text(`Documents Uploaded: ${user.documentsUploaded}`)
        doc.text(`Documents Analyzed: ${user.documentsAnalyzed}`)
        doc.text(`Risk Documents: ${user.riskDocuments}`)
        doc.text(`Total Actions: ${user.totalActions}`)
        doc.text(`Last Activity: ${user.lastActivity.toLocaleDateString()}`)
        doc.moveDown()
      })
    }

    this.addFooter(doc)
    doc.end()

    return new Promise((resolve, reject) => {
      stream.on("finish", resolve)
      stream.on("error", reject)
    })
  }

  async generateSystemOverviewReport(data: SystemOverviewReportData, title: string, filePath: string): Promise<void> {
    const doc = new PDFKit.PDFDocument({ margin: 50 })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    // Header
    this.addHeader(doc, title, "System Overview Report")

    // System Overview
    doc.fontSize(16).text("System Statistics", { underline: true })
    doc.moveDown()
    doc.fontSize(12)
    doc.text(`Total Documents: ${data.overview.totalDocuments}`)
    doc.text(`Total Users: ${data.overview.totalUsers}`)
    doc.text(`Total Risk Analyses: ${data.overview.totalRiskAnalyses}`)
    doc.text(`Total Audit Logs: ${data.overview.totalAuditLogs}`)
    doc.text(`Total Notifications: ${data.overview.totalNotifications}`)
    doc.text(`System Uptime: ${data.overview.systemUptime}`)
    doc.text(`Last Backup: ${data.overview.lastBackup.toLocaleDateString()}`)
    doc.moveDown()

    // System Health
    doc.fontSize(14).text("System Health", { underline: true })
    doc.moveDown()
    doc.fontSize(12)
    doc.text(`Database: ${data.metrics.systemHealth.database}`)
    doc.text(`Storage: ${data.metrics.systemHealth.storage}`)
    doc.text(`Notifications: ${data.metrics.systemHealth.notifications}`)
    doc.moveDown()

    // Activity Trends
    doc.fontSize(14).text("Activity Trends (Last 30 Days)", { underline: true })
    doc.moveDown()
    doc.fontSize(12)

    if (data.metrics.documentsPerDay.length > 0) {
      doc.text("Documents per Day:")
      data.metrics.documentsPerDay.slice(-7).forEach((day) => {
        doc.text(`  ${day.date}: ${day.count} documents`)
      })
      doc.moveDown()
    }

    if (data.metrics.userActivity.length > 0) {
      doc.text("User Activity:")
      data.metrics.userActivity.slice(-7).forEach((day) => {
        doc.text(`  ${day.date}: ${day.activeUsers} active users`)
      })
      doc.moveDown()
    }

    this.addFooter(doc)
    doc.end()

    return new Promise((resolve, reject) => {
      stream.on("finish", resolve)
      stream.on("error", reject)
    })
  }

  async generateComplianceReport(data: ComplianceReportData, title: string, filePath: string): Promise<void> {
    const doc = new PDFKit.PDFDocument({ margin: 50 })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    // Header
    this.addHeader(doc, title, "Compliance Report")

    // Compliance Overview
    doc.fontSize(16).text("Compliance Overview", { underline: true })
    doc.moveDown()
    doc.fontSize(12)
    doc.text(`Total Documents: ${data.compliance.totalDocuments}`)
    doc.text(`Compliant Documents: ${data.compliance.compliantDocuments}`)
    doc.text(`Non-Compliant Documents: ${data.compliance.nonCompliantDocuments}`)
    doc.text(`Pending Review: ${data.compliance.pendingReview}`)
    doc.text(`Compliance Rate: ${data.compliance.complianceRate.toFixed(2)}%`)
    doc.moveDown()

    // Violations
    if (data.violations.length > 0) {
      doc.fontSize(14).text("Compliance Violations", { underline: true })
      doc.moveDown()

      data.violations.forEach((violation, index) => {
        if (index > 0 && index % 5 === 0) {
          doc.addPage()
        }

        doc.fontSize(12)
        doc.text(`Document: ${violation.documentName}`)
        doc.text(`Violation Type: ${violation.violationType}`)
        doc.text(`Severity: ${violation.severity}`)
        doc.text(`Description: ${violation.description}`)
        doc.text(`Detected: ${violation.detectedAt.toLocaleDateString()}`)
        doc.text(`Status: ${violation.status}`)
        doc.moveDown()
      })
    }

    // Recommendations
    if (data.recommendations.length > 0) {
      doc.addPage()
      doc.fontSize(14).text("Recommendations", { underline: true })
      doc.moveDown()

      data.recommendations.forEach((rec) => {
        doc.fontSize(12)
        doc.text(`Category: ${rec.category}`)
        doc.text(`Priority: ${rec.priority}`)
        doc.text(`Description: ${rec.description}`)
        doc.text(`Action Required: ${rec.actionRequired}`)
        doc.moveDown()
      })
    }

    this.addFooter(doc)
    doc.end()

    return new Promise((resolve, reject) => {
      stream.on("finish", resolve)
      stream.on("error", reject)
    })
  }

  private addHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string): void {
    doc.fontSize(20).text(title, { align: "center" })
    doc.fontSize(14).text(subtitle, { align: "center" })
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, { align: "center" })
    doc.moveDown(2)
  }

  private addFooter(doc: PDFKit.PDFDocument): void {
    const pages = doc.bufferedPageRange()
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i)
      doc.fontSize(10).text(`Page ${i + 1} of ${pages.count}`, 50, doc.page.height - 50, {
        align: "center",
      })
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }
}
