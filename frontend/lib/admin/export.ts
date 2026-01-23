import jsPDF from "jspdf";
import { AdminAnalyticsResponse } from "@/lib/admin/types";

export function exportAnalyticsCSV(data: AdminAnalyticsResponse) {
  const rows: string[] = [];

  rows.push("Section,Key,Value");

  rows.push(`Overview,Total Users,${data.overview.totalUsers}`);
  rows.push(`Overview,Total Documents,${data.overview.totalDocuments}`);
  rows.push(`Overview,Total Verifications,${data.overview.totalVerifications}`);

  rows.push("");
  rows.push("Trends,Date,Users,Documents,Verifications");
  data.trends.forEach((t) => {
    rows.push(`Trends,${t.date},${t.users},${t.documents},${t.verifications}`);
  });

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `admin-analytics-${new Date().toISOString()}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

export function exportAnalyticsPDF(data: AdminAnalyticsResponse) {
  const doc = new jsPDF();

  doc.setFontSize(14);
  doc.text("Admin Analytics Report", 10, 10);

  doc.setFontSize(11);
  doc.text(`Total Users: ${data.overview.totalUsers}`, 10, 20);
  doc.text(`Total Documents: ${data.overview.totalDocuments}`, 10, 28);
  doc.text(`Total Verifications: ${data.overview.totalVerifications}`, 10, 36);

  doc.text("Recent Verifications:", 10, 50);

  let y = 58;
  data.recentVerifications.slice(0, 10).forEach((v) => {
    doc.text(
      `• ${v.userEmail} | ${v.status.toUpperCase()} | ${new Date(
        v.verifiedAt
      ).toLocaleString()}`,
      10,
      y
    );
    y += 7;
  });

  doc.save(`admin-analytics-${new Date().toISOString()}.pdf`);
}
