"use client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Calendar,
  Hash,
  Shield,
  FileSearch,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import PdfExportButton from "@/components/ui/PdfExportButton";

// Mock data for the legal report
const mockReportData = {
  documentInfo: {
    title: "Land Ownership Certificate - Plot No. 1234",
    documentType: "Land Ownership Certificate",
    documentNumber: "LOC-2024-001234",
    uploadDate: "2024-01-15",
    analyzedDate: "2024-01-15T14:30:00Z",
    fileSize: "2.4 MB",
    pages: 8,
  },
  analysis: {
    overallRisk: "LOW",
    confidence: 94,
    processingTime: "2.3 seconds",
    aiModel: "SMALDA v2.1",
  },
  findings: [
    {
      id: 1,
      type: "VERIFICATION",
      status: "PASSED",
      description: "Document authenticity verified through blockchain verification",
      details: "All digital signatures and timestamps are valid and traceable to authorized entities.",
      severity: "LOW",
    },
    {
      id: 2,
      type: "OWNERSHIP",
      status: "PASSED",
      description: "Clear chain of ownership established",
      details: "Ownership history shows 3 previous transfers, all properly documented and registered.",
      severity: "LOW",
    },
    {
      id: 3,
      type: "BOUNDARIES",
      status: "WARNING",
      description: "Minor boundary discrepancy detected",
      details: "Survey coordinates show 0.5% variance from official records. Recommended: Professional survey verification.",
      severity: "MEDIUM",
    },
    {
      id: 4,
      type: "ENCUMBRANCES",
      status: "PASSED",
      description: "No active encumbrances found",
      details: "Property is free from liens, mortgages, or other encumbrances.",
      severity: "LOW",
    },
    {
      id: 5,
      type: "COMPLIANCE",
      status: "PASSED",
      description: "All regulatory requirements met",
      details: "Document complies with current land registration and zoning regulations.",
      severity: "LOW",
    },
  ],
  recommendations: [
    "Schedule professional survey to resolve boundary discrepancy",
    "Maintain regular monitoring for any new encumbrances",
    "Consider title insurance for additional protection",
    "Keep digital copies of all related documents",
  ],
  metadata: {
    location: "District: Central, City: Metropolis",
    area: "1,250 square meters",
    zoning: "Residential",
    assessedValue: "$450,000",
    lastAssessment: "2023-12-01",
  },
};

export default function LegalReportPage() {
  const getSeverityColor = (severity) => {
    switch (severity) {
      case "LOW":
        return "text-green-600 bg-green-50";
      case "MEDIUM":
        return "text-yellow-600 bg-yellow-50";
      case "HIGH":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "PASSED":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "WARNING":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "FAILED":
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="px-4 lg:px-6 h-16 flex items-center border-b">
        <Link className="flex items-center justify-center" href="/">
          <Shield className="h-8 w-8 text-primary" />
          <span className="ml-2 text-2xl font-bold text-primary">SMALDA</span>
        </Link>
        <nav className="ml-auto hidden md:flex gap-6">
          <Link
            className="text-sm font-medium hover:text-primary transition-colors"
            href="/case-search"
          >
            Case Search
          </Link>
          <Link
            className="text-sm font-medium hover:text-primary transition-colors"
            href="/legal-chat"
          >
            Legal Chat
          </Link>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Report Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Legal Analysis Report</h1>
              <p className="text-muted-foreground">
                Comprehensive analysis of uploaded land documents
              </p>
            </div>
            <PdfExportButton
              data={mockReportData}
              filename={`SMALDA_Report_${mockReportData.documentInfo.documentNumber}.pdf`}
              title="Export as PDF"
              className="gap-2"
              size="lg"
            />
          </div>
        </div>

        {/* Document Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Document Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Document Title</p>
                <p className="font-medium">{mockReportData.documentInfo.title}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Document Type</p>
                <p className="font-medium">{mockReportData.documentInfo.documentType}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Document Number</p>
                <p className="font-medium">{mockReportData.documentInfo.documentNumber}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Upload Date</p>
                <p className="font-medium">{mockReportData.documentInfo.uploadDate}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Analysis Date</p>
                <p className="font-medium">
                  {new Date(mockReportData.analysis.analyzedDate).toLocaleDateString()}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">File Size</p>
                <p className="font-medium">{mockReportData.documentInfo.fileSize}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              Analysis Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {mockReportData.analysis.overallRisk}
                </div>
                <p className="text-sm text-muted-foreground">Overall Risk</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {mockReportData.analysis.confidence}%
                </div>
                <p className="text-sm text-muted-foreground">Confidence</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {mockReportData.analysis.processingTime}
                </div>
                <p className="text-sm text-muted-foreground">Processing Time</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 mb-2">
                  {mockReportData.analysis.aiModel}
                </div>
                <p className="text-sm text-muted-foreground">AI Model</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Property Metadata */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Property Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Location</p>
                <p className="font-medium">{mockReportData.metadata.location}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Area</p>
                <p className="font-medium">{mockReportData.metadata.area}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Zoning</p>
                <p className="font-medium">{mockReportData.metadata.zoning}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Assessed Value</p>
                <p className="font-medium">{mockReportData.metadata.assessedValue}</p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Last Assessment</p>
                <p className="font-medium">{mockReportData.metadata.lastAssessment}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Findings */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Detailed Findings
            </CardTitle>
            <CardDescription>
              Comprehensive analysis results with risk assessment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockReportData.findings.map((finding) => (
                <div
                  key={finding.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(finding.status)}
                      <div>
                        <h3 className="font-semibold text-lg">{finding.type}</h3>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(
                            finding.severity
                          )}`}
                        >
                          {finding.severity} RISK
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-muted-foreground">
                        Status
                      </span>
                      <div className="font-semibold">{finding.status}</div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {finding.description}
                  </p>
                  <p className="text-sm">{finding.details}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Recommendations
            </CardTitle>
            <CardDescription>
              Suggested actions based on analysis results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockReportData.recommendations.map((recommendation, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <p className="text-sm">{recommendation}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground mt-12 pb-8">
          <p>
            This report was generated by SMALDA AI on{" "}
            {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
          </p>
          <p className="mt-1">
            For questions or support, please contact our legal team.
          </p>
        </div>
      </main>
    </div>
  );
} 