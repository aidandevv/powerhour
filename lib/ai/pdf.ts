/**
 * PDF-02/04/06: PDF report generation service
 *
 * Generates an in-memory PDF report with:
 * - Spending breakdown by category
 * - Anomaly highlights (unusual charges)
 * - AI-generated narrative summary (injected by caller)
 * - Data freshness timestamp
 * - Disclaimer footer
 *
 * No files written to disk (PDF-06).
 */
import PDFDocument from "pdfkit";
import { type SpendingSummaryResult } from "@/lib/agent/tools/spending-summary";

export interface PdfReportData {
  from: string;
  to: string;
  spending: SpendingSummaryResult;
  narrative: string;      // AI-generated summary
  anomalies: string[];    // Unusual charge descriptions
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDateReadable(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function generatePdfReport(data: PdfReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Title
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("Financial Report", { align: "center" });

    doc
      .fontSize(11)
      .font("Helvetica")
      .text(
        `${formatDateReadable(data.from)} — ${formatDateReadable(data.to)}`,
        { align: "center" }
      );

    doc.moveDown(1.5);

    // AI Narrative Summary (PDF-03)
    doc.fontSize(14).font("Helvetica-Bold").text("Summary");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").text(data.narrative, {
      lineGap: 3,
    });
    doc.moveDown(1);

    // Spending Breakdown (PDF-02)
    doc.fontSize(14).font("Helvetica-Bold").text("Spending by Category");
    doc.moveDown(0.3);

    const { summary, totalSpend } = data.spending;

    if (summary.length === 0) {
      doc.fontSize(10).font("Helvetica").text("No spending found for this period.");
    } else {
      // Table header
      const col1 = 50;
      const col2 = 300;
      const col3 = 420;

      doc.fontSize(9).font("Helvetica-Bold");
      doc.text("Category", col1, doc.y, { continued: false });
      const headerY = doc.y - doc.currentLineHeight();
      doc.text("Transactions", col2, headerY);
      doc.text("Amount", col3, headerY);
      doc.moveDown(0.3);

      doc
        .moveTo(col1, doc.y)
        .lineTo(520, doc.y)
        .strokeColor("#cccccc")
        .stroke();
      doc.moveDown(0.3);

      doc.font("Helvetica").fontSize(9);
      for (const row of summary) {
        const y = doc.y;
        const category = row.category
          .split("_")
          .map(
            (w) =>
              w === "AND"
                ? "&"
                : w.charAt(0) + w.slice(1).toLowerCase()
          )
          .join(" ");

        doc.text(category, col1, y);
        doc.text(String(row.count), col2, y);
        doc.text(formatCurrency(row.amount), col3, y);
        doc.moveDown(0.2);
      }

      doc.moveDown(0.3);
      doc
        .moveTo(col1, doc.y)
        .lineTo(520, doc.y)
        .strokeColor("#cccccc")
        .stroke();
      doc.moveDown(0.3);

      doc.font("Helvetica-Bold").fontSize(9);
      const totalY = doc.y;
      doc.text("Total", col1, totalY);
      doc.text(formatCurrency(totalSpend), col3, totalY);
    }

    doc.moveDown(1.5);

    // Anomaly Highlights (PDF-04)
    if (data.anomalies.length > 0) {
      doc.fontSize(14).font("Helvetica-Bold").text("Anomaly Highlights");
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica");
      for (const anomaly of data.anomalies) {
        doc.text(`\u2022 ${anomaly}`, { indent: 10, lineGap: 2 });
      }
      doc.moveDown(1);
    }

    // Data freshness
    doc
      .fontSize(8)
      .fillColor("#888888")
      .text(
        `Report generated: ${new Date().toLocaleString("en-US", {
          dateStyle: "long",
          timeStyle: "short",
        })}`,
        { align: "center" }
      );

    doc.moveDown(0.3);

    // Disclaimer footer
    doc
      .fontSize(7)
      .fillColor("#999999")
      .text(
        "This report is generated from synced bank data and is for informational purposes only. It does not constitute financial advice.",
        { align: "center" }
      );

    doc.end();
  });
}
