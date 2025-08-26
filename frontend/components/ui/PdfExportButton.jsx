"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import jsPDF from "jspdf";

const PdfExportButton = ({ 
  data, 
  filename = "SMALDA_Report.pdf", 
  title = "Export as PDF",
  className = "",
  variant = "default",
  size = "default"
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const generatePDF = async () => {
    setIsExporting(true);
    
    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let yPosition = margin;

      // Add SMALDA branding
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(33, 33, 33);
      pdf.text("SMALDA", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 10;

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text("AI-Powered Legal Document Analysis", pageWidth / 2, yPosition, { align: "center" });
      yPosition += 20;

      // Add timestamp
      pdf.setFontSize(10);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, margin, yPosition);
      yPosition += 15;

      // Add content based on data structure
      if (data && typeof data === 'object') {
        // Handle different data structures
        if (data.documentInfo) {
          // Legal report format
          pdf.setFontSize(16);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(33, 33, 33);
          pdf.text("Document Analysis Report", margin, yPosition);
          yPosition += 15;

          pdf.setFontSize(12);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(100, 100, 100);
          
          Object.entries(data.documentInfo).forEach(([key, value]) => {
            if (yPosition > pageHeight - 30) {
              pdf.addPage();
              yPosition = margin;
            }
            
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            pdf.text(`${label}: ${value}`, margin, yPosition);
            yPosition += 8;
          });

          if (data.findings) {
            yPosition += 10;
            pdf.setFontSize(14);
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(33, 33, 33);
            pdf.text("Analysis Findings", margin, yPosition);
            yPosition += 12;

            data.findings.forEach((finding, index) => {
              if (yPosition > pageHeight - 40) {
                pdf.addPage();
                yPosition = margin;
              }

              pdf.setFontSize(11);
              pdf.setFont("helvetica", "bold");
              pdf.setTextColor(33, 33, 33);
              pdf.text(`${finding.type}: ${finding.status}`, margin, yPosition);
              yPosition += 6;

              pdf.setFontSize(9);
              pdf.setFont("helvetica", "normal");
              pdf.setTextColor(100, 100, 100);
              
              const descriptionLines = pdf.splitTextToSize(finding.description, pageWidth - 2 * margin);
              pdf.text(descriptionLines, margin, yPosition);
              yPosition += descriptionLines.length * 4 + 4;
            });
          }
        } else {
          // Generic data format
          pdf.setFontSize(14);
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(33, 33, 33);
          pdf.text("Report Data", margin, yPosition);
          yPosition += 12;

          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(100, 100, 100);

          const addDataToPDF = (obj, indent = 0) => {
            Object.entries(obj).forEach(([key, value]) => {
              if (yPosition > pageHeight - 30) {
                pdf.addPage();
                yPosition = margin;
              }

              const indentStr = "  ".repeat(indent);
              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              
              if (typeof value === 'object' && value !== null) {
                pdf.setFont("helvetica", "bold");
                pdf.text(`${indentStr}${label}:`, margin, yPosition);
                yPosition += 6;
                addDataToPDF(value, indent + 1);
              } else {
                pdf.setFont("helvetica", "normal");
                pdf.text(`${indentStr}${label}: ${value}`, margin, yPosition);
                yPosition += 6;
              }
            });
          };

          addDataToPDF(data);
        }
      }

      // Add footer
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
      }

      // Save the PDF
      pdf.save(filename);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Error generating PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={generatePDF}
      disabled={isExporting}
      className={className}
      variant={variant}
      size={size}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {isExporting ? "Generating PDF..." : title}
    </Button>
  );
};

export default PdfExportButton; 