import { Injectable } from "@nestjs/common"
import type { NotificationTemplate } from "../interfaces/notification-template.interface"
import { NotificationEvent } from "../entities/notification.entity"

@Injectable()
export class TemplateService {
  private templates: Map<NotificationEvent, NotificationTemplate> = new Map()

  constructor() {
    this.initializeTemplates()
  }

  private initializeTemplates() {
    // Risk Detection Templates
    this.templates.set(NotificationEvent.RISK_DETECTED, {
      id: "risk-detected",
      event: NotificationEvent.RISK_DETECTED,
      title: "Risk Detected in Document",
      emailSubject: "Risk Alert: Document {{documentName}} requires attention",
      emailTemplate: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f39c12;">⚠️ Risk Detected</h2>
          <p>Hello {{recipientName}},</p>
          <p>Our system has detected potential risks in the document <strong>{{documentName}}</strong>.</p>
          
          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #856404; margin-top: 0;">Risk Details:</h3>
            <p><strong>Risk Level:</strong> {{riskLevel}}</p>
            <p><strong>Summary:</strong> {{riskSummary}}</p>
            <p><strong>Detected Keywords:</strong> {{detectedKeywords}}</p>
          </div>
          
          <p>Please review this document at your earliest convenience.</p>
          <p><a href="{{documentUrl}}" style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Document</a></p>
          
          <p>Best regards,<br>Land Registry System</p>
        </div>
      `,
      inAppTemplate: "Risk detected in document {{documentName}}. Risk Level: {{riskLevel}}",
      variables: ["recipientName", "documentName", "riskLevel", "riskSummary", "detectedKeywords", "documentUrl"],
    })

    this.templates.set(NotificationEvent.HIGH_RISK_DETECTED, {
      id: "high-risk-detected",
      event: NotificationEvent.HIGH_RISK_DETECTED,
      title: "HIGH RISK ALERT",
      emailSubject: "🚨 HIGH RISK ALERT: Immediate attention required for {{documentName}}",
      emailTemplate: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e74c3c;">🚨 HIGH RISK ALERT</h2>
          <p>Hello {{recipientName}},</p>
          <p><strong>URGENT:</strong> A high-risk situation has been detected in document <strong>{{documentName}}</strong>.</p>
          
          <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #721c24; margin-top: 0;">⚠️ High Risk Details:</h3>
            <p><strong>Risk Level:</strong> <span style="color: #e74c3c;">{{riskLevel}}</span></p>
            <p><strong>Risk Score:</strong> {{riskScore}}</p>
            <p><strong>Summary:</strong> {{riskSummary}}</p>
            <p><strong>Critical Keywords:</strong> {{detectedKeywords}}</p>
          </div>
          
          <p><strong>Immediate action is required. Please review this document immediately.</strong></p>
          <p><a href="{{documentUrl}}" style="background-color: #e74c3c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">REVIEW NOW</a></p>
          
          <p>This is an automated alert from the Land Registry Risk Management System.</p>
        </div>
      `,
      inAppTemplate: "🚨 HIGH RISK: Document {{documentName}} requires immediate attention. Risk Level: {{riskLevel}}",
      variables: [
        "recipientName",
        "documentName",
        "riskLevel",
        "riskScore",
        "riskSummary",
        "detectedKeywords",
        "documentUrl",
      ],
    })

    this.templates.set(NotificationEvent.CRITICAL_RISK_DETECTED, {
      id: "critical-risk-detected",
      event: NotificationEvent.CRITICAL_RISK_DETECTED,
      title: "🔴 CRITICAL RISK ALERT",
      emailSubject: "🔴 CRITICAL RISK: Immediate escalation required - {{documentName}}",
      emailTemplate: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 3px solid #dc3545;">
          <div style="background-color: #dc3545; color: white; padding: 15px; text-align: center;">
            <h1 style="margin: 0;">🔴 CRITICAL RISK ALERT</h1>
          </div>
          <div style="padding: 20px;">
            <p>Hello {{recipientName}},</p>
            <p><strong>CRITICAL ALERT:</strong> A critical risk situation has been detected that requires immediate escalation.</p>
            
            <div style="background-color: #f8d7da; border: 2px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 5px;">
              <h3 style="color: #721c24; margin-top: 0;">🔴 Critical Risk Details:</h3>
              <p><strong>Document:</strong> {{documentName}}</p>
              <p><strong>Risk Level:</strong> <span style="color: #dc3545; font-size: 18px; font-weight: bold;">{{riskLevel}}</span></p>
              <p><strong>Risk Score:</strong> {{riskScore}}</p>
              <p><strong>Summary:</strong> {{riskSummary}}</p>
              <p><strong>Critical Issues:</strong> {{detectedKeywords}}</p>
              <p><strong>Detected At:</strong> {{detectedAt}}</p>
            </div>
            
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <h4 style="color: #856404; margin-top: 0;">Required Actions:</h4>
              <ul style="color: #856404;">
                <li>Review document immediately</li>
                <li>Escalate to senior management</li>
                <li>Consider document quarantine</li>
                <li>Initiate investigation if necessary</li>
              </ul>
            </div>
            
            <p style="text-align: center;">
              <a href="{{documentUrl}}" style="background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">REVIEW IMMEDIATELY</a>
            </p>
            
            <p><em>This is an automated critical alert from the Land Registry Risk Management System. Please do not ignore this notification.</em></p>
          </div>
        </div>
      `,
      inAppTemplate: "🔴 CRITICAL RISK: Document {{documentName}} has critical issues requiring immediate escalation",
      variables: [
        "recipientName",
        "documentName",
        "riskLevel",
        "riskScore",
        "riskSummary",
        "detectedKeywords",
        "documentUrl",
        "detectedAt",
      ],
    })

    // Review Templates
    this.templates.set(NotificationEvent.REVIEW_APPROVED, {
      id: "review-approved",
      event: NotificationEvent.REVIEW_APPROVED,
      title: "Document Review Approved",
      emailSubject: "✅ Review Approved: {{documentName}}",
      emailTemplate: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #27ae60;">✅ Review Approved</h2>
          <p>Hello {{recipientName}},</p>
          <p>Good news! The review for document <strong>{{documentName}}</strong> has been approved.</p>
          
          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #155724; margin-top: 0;">Approval Details:</h3>
            <p><strong>Reviewed By:</strong> {{reviewerName}}</p>
            <p><strong>Approved At:</strong> {{approvedAt}}</p>
            <p><strong>Comments:</strong> {{reviewComments}}</p>
          </div>
          
          <p>The document is now cleared for processing.</p>
          <p><a href="{{documentUrl}}" style="background-color: #27ae60; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Document</a></p>
          
          <p>Best regards,<br>Land Registry System</p>
        </div>
      `,
      inAppTemplate: "Document {{documentName}} review has been approved by {{reviewerName}}",
      variables: ["recipientName", "documentName", "reviewerName", "approvedAt", "reviewComments", "documentUrl"],
    })

    this.templates.set(NotificationEvent.REVIEW_REJECTED, {
      id: "review-rejected",
      event: NotificationEvent.REVIEW_REJECTED,
      title: "Document Review Rejected",
      emailSubject: "❌ Review Rejected: {{documentName}} requires attention",
      emailTemplate: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e74c3c;">❌ Review Rejected</h2>
          <p>Hello {{recipientName}},</p>
          <p>The review for document <strong>{{documentName}}</strong> has been rejected and requires your attention.</p>
          
          <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #721c24; margin-top: 0;">Rejection Details:</h3>
            <p><strong>Reviewed By:</strong> {{reviewerName}}</p>
            <p><strong>Rejected At:</strong> {{rejectedAt}}</p>
            <p><strong>Reason:</strong> {{rejectionReason}}</p>
            <p><strong>Comments:</strong> {{reviewComments}}</p>
          </div>
          
          <p>Please address the issues mentioned and resubmit for review.</p>
          <p><a href="{{documentUrl}}" style="background-color: #e74c3c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Document</a></p>
          
          <p>Best regards,<br>Land Registry System</p>
        </div>
      `,
      inAppTemplate: "Document {{documentName}} review was rejected by {{reviewerName}}. Reason: {{rejectionReason}}",
      variables: [
        "recipientName",
        "documentName",
        "reviewerName",
        "rejectedAt",
        "rejectionReason",
        "reviewComments",
        "documentUrl",
      ],
    })

    this.templates.set(NotificationEvent.REVIEW_REQUESTED, {
      id: "review-requested",
      event: NotificationEvent.REVIEW_REQUESTED,
      title: "Document Review Requested",
      emailSubject: "📋 Review Required: {{documentName}}",
      emailTemplate: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3498db;">📋 Review Requested</h2>
          <p>Hello {{recipientName}},</p>
          <p>A review has been requested for document <strong>{{documentName}}</strong>.</p>
          
          <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; margin: 20px 0; border-radius: 5px;">
            <h3 style="color: #0c5460; margin-top: 0;">Review Details:</h3>
            <p><strong>Requested By:</strong> {{requesterName}}</p>
            <p><strong>Priority:</strong> {{priority}}</p>
            <p><strong>Due Date:</strong> {{dueDate}}</p>
            <p><strong>Notes:</strong> {{requestNotes}}</p>
          </div>
          
          <p>Please review this document at your earliest convenience.</p>
          <p><a href="{{reviewUrl}}" style="background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Start Review</a></p>
          
          <p>Best regards,<br>Land Registry System</p>
        </div>
      `,
      inAppTemplate: "Review requested for document {{documentName}} by {{requesterName}}",
      variables: ["recipientName", "documentName", "requesterName", "priority", "dueDate", "requestNotes", "reviewUrl"],
    })
  }

  getTemplate(event: NotificationEvent): NotificationTemplate | undefined {
    return this.templates.get(event)
  }

  getAllTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values())
  }

  renderTemplate(template: string, data: Record<string, any>): string {
    let rendered = template

    // Replace all {{variable}} placeholders with actual data
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`{{${key}}}`, "g")
      rendered = rendered.replace(placeholder, String(value || ""))
    }

    return rendered
  }
}
