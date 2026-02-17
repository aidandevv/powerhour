/**
 * PDF-02/04/06: Comprehensive PDF report generation service
 *
 * Sections:
 *  1. Cover header + KPI summary row
 *  2. AI-generated narrative summary
 *  3. Net Worth History — line chart (90 days)
 *  4. Monthly Spending Trend — vertical bar chart (6 months)
 *  5. Spending by Category — horizontal bar chart
 *  6. Top Merchants — horizontal bar chart
 *  7. Account Balances — table
 *  8. Recurring Expenses — table
 *  9. Anomaly Highlights
 * 10. Footer / disclaimer
 *
 * No files written to disk (PDF-06).
 */
import PDFDocument from "pdfkit";
import { type SpendingSummaryResult } from "@/lib/agent/tools/spending-summary";
import { type AccountBalancesResult } from "@/lib/agent/tools/account-balances";
import { type RecurringExpensesResult } from "@/lib/agent/tools/recurring-expenses";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface NetWorthPoint {
  date: string;      // YYYY-MM-DD
  netWorth: number;
}

export interface MonthlyTrend {
  month: string;     // YYYY-MM
  amount: number;
}

export interface MerchantSpend {
  name: string;
  amount: number;
  count: number;
}

export interface PdfReportData {
  from: string;
  to: string;
  spending: SpendingSummaryResult;
  accounts: AccountBalancesResult;
  recurring: RecurringExpensesResult;
  netWorthHistory: NetWorthPoint[];   // last 90 days, one point per day
  monthlyTrends: MonthlyTrend[];      // last 6 months
  topMerchants: MerchantSpend[];      // top 10 by spend in the report period
  narrative: string;                  // AI-generated summary paragraph(s)
  anomalies: string[];                // Detected unusual charges
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const PAGE_W  = 612;   // LETTER width  (8.5 in × 72 dpi)
const PAGE_H  = 792;   // LETTER height (11 in × 72 dpi)
const M       = 50;    // page margin
const CONTENT_W = PAGE_W - 2 * M;   // 512 pt

const MAX_Y   = PAGE_H - M;         // 742 — bottom safe zone

// ─── Colour palette ───────────────────────────────────────────────────────────

const C_PRIMARY   = "#2563eb";
const C_SECONDARY = "#0891b2";
const C_TEXT      = "#1e293b";
const C_MUTED     = "#64748b";
const C_GRID      = "#e2e8f0";
const C_TRACK     = "#f1f5f9";
const C_AREA_FILL = "#eff6ff";
const C_POSITIVE  = "#16a34a";
const C_NEGATIVE  = "#dc2626";

// ─── Type alias ───────────────────────────────────────────────────────────────

type Doc = PDFKit.PDFDocument;

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return fmtCurrency(n);
}

function fmtDateLong(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function fmtDateShort(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

function fmtMonthLabel(yyyyMM: string): string {
  const [y, mo] = yyyyMM.split("-");
  const d = new Date(parseInt(y), parseInt(mo) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function fmtCategory(raw: string): string {
  return raw
    .split("_")
    .map((w) => (w === "AND" ? "&" : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ─── Page-break helper ────────────────────────────────────────────────────────

function ensurePage(doc: Doc, neededHeight: number) {
  if (doc.y + neededHeight > MAX_Y) {
    doc.addPage();
  }
}

// ─── Section heading ─────────────────────────────────────────────────────────

function sectionHeading(doc: Doc, title: string) {
  ensurePage(doc, 32);
  doc.fontSize(13).font("Helvetica-Bold").fillColor(C_TEXT).text(title, M, doc.y);
  doc.moveDown(0.35);
  doc
    .moveTo(M, doc.y)
    .lineTo(PAGE_W - M, doc.y)
    .strokeColor(C_GRID)
    .lineWidth(0.6)
    .stroke();
  doc.moveDown(0.5);
}

// ─── Horizontal bar chart ─────────────────────────────────────────────────────
// Suitable for "spending by category" and "top merchants" layouts.

function hBarChart(
  doc: Doc,
  data: Array<{ label: string; value: number }>,
  color: string = C_PRIMARY,
  barH = 14,
  rowGap = 5,
) {
  if (data.length === 0) {
    doc.fontSize(9).fillColor(C_MUTED).font("Helvetica").text("No data.", M);
    doc.moveDown(0.5);
    return;
  }

  const LABEL_W  = 155;
  const VALUE_W  = 82;
  const barAreaW = CONTENT_W - LABEL_W - VALUE_W - 12;  // remaining width for bars
  const barX     = M + LABEL_W + 6;
  const maxVal   = Math.max(...data.map((d) => d.value), 1);

  ensurePage(doc, data.length * (barH + rowGap) + 12);

  for (const item of data) {
    const rowY    = doc.y;
    const fillLen = (item.value / maxVal) * barAreaW;

    // label
    doc
      .fontSize(8).font("Helvetica").fillColor(C_TEXT)
      .text(trunc(item.label, 24), M, rowY + 2, { width: LABEL_W, lineBreak: false });

    // track
    doc.rect(barX, rowY + 1, barAreaW, barH - 2).fillColor(C_TRACK).fill();

    // fill
    if (fillLen > 0) {
      doc.rect(barX, rowY + 1, fillLen, barH - 2).fillColor(color).fill();
    }

    // value label
    doc
      .fontSize(8).font("Helvetica-Bold").fillColor(C_TEXT)
      .text(fmtCurrency(item.value), barX + barAreaW + 5, rowY + 2, {
        width: VALUE_W - 4,
        lineBreak: false,
      });

    doc.y = rowY + barH + rowGap;
  }

  doc.y += 4;
}

// ─── Vertical bar chart ───────────────────────────────────────────────────────
// Suitable for monthly spending trends.

function vBarChart(
  doc: Doc,
  data: Array<{ label: string; value: number }>,
  chartH = 130,
  color: string = C_PRIMARY,
) {
  if (data.length === 0) {
    doc.fontSize(9).fillColor(C_MUTED).font("Helvetica").text("No data.", M);
    doc.moveDown(0.5);
    return;
  }

  ensurePage(doc, chartH + 40);

  const Y_LBL_W   = 46;
  const chartLeft  = M + Y_LBL_W;
  const chartRight = PAGE_W - M;
  const chartW     = chartRight - chartLeft;
  const chartTop   = doc.y;
  const chartBot   = chartTop + chartH;

  const maxVal  = Math.max(...data.map((d) => d.value), 1);
  const n       = data.length;
  const slotW   = chartW / n;
  const barW    = slotW * 0.65;
  const barOff  = (slotW - barW) / 2;

  // axes
  doc.moveTo(chartLeft, chartTop).lineTo(chartLeft, chartBot).strokeColor(C_GRID).lineWidth(0.5).stroke();
  doc.moveTo(chartLeft, chartBot).lineTo(chartRight, chartBot).strokeColor(C_GRID).lineWidth(0.5).stroke();

  // Y grid + labels
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const val = (maxVal * i) / ySteps;
    const ty  = chartBot - (chartH * i) / ySteps;
    if (i > 0) {
      doc.moveTo(chartLeft, ty).lineTo(chartRight, ty).strokeColor(C_GRID).lineWidth(0.3).stroke();
    }
    doc
      .fontSize(6.5).font("Helvetica").fillColor(C_MUTED)
      .text(fmtCompact(val), M, ty - 4, { width: Y_LBL_W - 2, align: "right" });
  }

  // bars + X labels
  for (let i = 0; i < n; i++) {
    const item  = data[i];
    const barHt = (item.value / maxVal) * chartH;
    const bx    = chartLeft + i * slotW + barOff;
    const by    = chartBot - barHt;

    if (barHt > 0) {
      doc.rect(bx, by, barW, barHt).fillColor(color).fill();
    }

    doc
      .fontSize(6.5).font("Helvetica").fillColor(C_MUTED)
      .text(item.label, bx - 4, chartBot + 3, { width: slotW + 8, align: "center" });
  }

  doc.y = chartBot + 22;
}

// ─── Line chart ───────────────────────────────────────────────────────────────
// Suitable for net worth history.

function lineChart(
  doc: Doc,
  data: Array<{ date: string; value: number }>,
  chartH = 130,
  color: string = C_PRIMARY,
) {
  if (data.length < 2) {
    doc.fontSize(9).fillColor(C_MUTED).font("Helvetica").text("Insufficient data for chart.", M);
    doc.moveDown(0.5);
    return;
  }

  ensurePage(doc, chartH + 40);

  const Y_LBL_W   = 46;
  const chartLeft  = M + Y_LBL_W;
  const chartRight = PAGE_W - M;
  const chartW     = chartRight - chartLeft;
  const chartTop   = doc.y;
  const chartBot   = chartTop + chartH;

  const vals   = data.map((d) => d.value);
  const maxVal = Math.max(...vals);
  const minVal = Math.min(...vals);
  const range  = maxVal - minVal || 1;

  // axes
  doc.moveTo(chartLeft, chartTop).lineTo(chartLeft, chartBot).strokeColor(C_GRID).lineWidth(0.5).stroke();
  doc.moveTo(chartLeft, chartBot).lineTo(chartRight, chartBot).strokeColor(C_GRID).lineWidth(0.5).stroke();

  // Y grid + labels
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const val = minVal + (range * i) / ySteps;
    const ty  = chartBot - (chartH * i) / ySteps;
    if (i > 0) {
      doc.moveTo(chartLeft, ty).lineTo(chartRight, ty).strokeColor(C_GRID).lineWidth(0.3).stroke();
    }
    doc
      .fontSize(6.5).font("Helvetica").fillColor(C_MUTED)
      .text(fmtCompact(val), M, ty - 4, { width: Y_LBL_W - 2, align: "right" });
  }

  // map data → pixel coords
  const pts = data.map((d, i) => ({
    x: chartLeft + (i / (data.length - 1)) * chartW,
    y: chartBot - ((d.value - minVal) / range) * chartH,
  }));

  // filled area under the line
  doc.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i].x, pts[i].y);
  doc
    .lineTo(pts[pts.length - 1].x, chartBot)
    .lineTo(pts[0].x, chartBot)
    .closePath()
    .fillColor(C_AREA_FILL)
    .fill();

  // line itself (drawn on top of fill)
  doc.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) doc.lineTo(pts[i].x, pts[i].y);
  doc.strokeColor(color).lineWidth(1.5).stroke();

  // X labels: first / mid / last
  const labelIdxs = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  const labelSet  = Array.from(new Set(labelIdxs));
  for (const idx of labelSet) {
    const px = pts[idx].x;
    doc
      .fontSize(6.5).font("Helvetica").fillColor(C_MUTED)
      .text(fmtDateShort(data[idx].date), px - 18, chartBot + 3, {
        width: 36, align: "center",
      });
  }

  doc.y = chartBot + 22;
}

// ─── Account balances table ───────────────────────────────────────────────────

function drawAccountTable(doc: Doc, accountData: AccountBalancesResult) {
  const rows = accountData.accounts;

  if (rows.length === 0) {
    doc.fontSize(9).fillColor(C_MUTED).font("Helvetica").text("No accounts.", M);
    doc.moveDown(0.5);
    return;
  }

  const COL = [M, M + 175, M + 295, M + 385, M + 460] as const;
  const HDR = ["Account", "Institution", "Type", "Balance", "Available"];
  const WIDTHS = [172, 118, 88, 73, 60];
  const ROW_H = 16;

  // header
  doc.fontSize(8).font("Helvetica-Bold").fillColor(C_MUTED);
  HDR.forEach((h, i) => {
    const align = i >= 3 ? "right" : "left";
    doc.text(h, COL[i], doc.y, { width: WIDTHS[i], align, lineBreak: false });
  });
  doc.y += ROW_H;
  doc.moveTo(M, doc.y - 3).lineTo(PAGE_W - M, doc.y - 3).strokeColor(C_GRID).lineWidth(0.4).stroke();

  // rows
  for (const acct of rows) {
    ensurePage(doc, ROW_H + 4);
    const y          = doc.y;
    const bal        = acct.currentBalance ?? 0;
    const isLiab     = acct.type === "credit" || acct.type === "loan";
    const balColor   = isLiab ? C_NEGATIVE : C_TEXT;

    doc.fontSize(8).font("Helvetica").fillColor(C_TEXT)
       .text(trunc(acct.name, 26),             COL[0], y, { width: WIDTHS[0], lineBreak: false });
    doc.fillColor(C_MUTED)
       .text(trunc(acct.institutionName, 18),  COL[1], y, { width: WIDTHS[1], lineBreak: false });
    doc.fillColor(C_MUTED)
       .text(acct.subtype ?? acct.type,         COL[2], y, { width: WIDTHS[2], lineBreak: false });
    doc.fillColor(balColor)
       .text(fmtCurrency(bal),                  COL[3], y, { width: WIDTHS[3], align: "right", lineBreak: false });
    if (acct.availableBalance !== null) {
      doc.fillColor(C_MUTED)
         .text(fmtCurrency(acct.availableBalance), COL[4], y, { width: WIDTHS[4], align: "right", lineBreak: false });
    }
    doc.y = y + ROW_H;
  }

  // total row
  doc.moveTo(M, doc.y).lineTo(PAGE_W - M, doc.y).strokeColor(C_GRID).lineWidth(0.4).stroke();
  doc.y += 3;
  const totalY = doc.y;
  const nwColor = accountData.netWorth >= 0 ? C_POSITIVE : C_NEGATIVE;
  doc.fontSize(8).font("Helvetica-Bold").fillColor(C_TEXT)
     .text("Net Worth", M, totalY, { width: 200, lineBreak: false });
  doc.fillColor(nwColor)
     .text(fmtCurrency(accountData.netWorth), COL[3], totalY, {
       width: WIDTHS[3], align: "right", lineBreak: false,
     });
  doc.y = totalY + ROW_H;
}

// ─── Recurring expenses table ─────────────────────────────────────────────────

function drawRecurringTable(doc: Doc, recurring: RecurringExpensesResult) {
  const items = recurring.items.slice(0, 15);

  const COL    = [M, M + 195, M + 290, M + 380, M + 455] as const;
  const HDR    = ["Name", "Account", "Frequency", "Amount", "Next Date"];
  const WIDTHS = [192, 93, 88, 73, 65];
  const ROW_H  = 16;

  // header
  doc.fontSize(8).font("Helvetica-Bold").fillColor(C_MUTED);
  HDR.forEach((h, i) => {
    const align = i === 3 ? "right" : "left";
    doc.text(h, COL[i], doc.y, { width: WIDTHS[i], align, lineBreak: false });
  });
  doc.y += ROW_H;
  doc.moveTo(M, doc.y - 3).lineTo(PAGE_W - M, doc.y - 3).strokeColor(C_GRID).lineWidth(0.4).stroke();

  // rows
  for (const item of items) {
    ensurePage(doc, ROW_H + 4);
    const y       = doc.y;
    const nextDt  = item.nextProjectedDate ? fmtDateShort(item.nextProjectedDate) : "—";

    doc.fontSize(8).font("Helvetica").fillColor(C_TEXT)
       .text(trunc(item.name, 28),          COL[0], y, { width: WIDTHS[0], lineBreak: false });
    doc.fillColor(C_MUTED)
       .text(trunc(item.accountName, 14),   COL[1], y, { width: WIDTHS[1], lineBreak: false });
    doc.fillColor(C_MUTED)
       .text(item.frequency,                COL[2], y, { width: WIDTHS[2], lineBreak: false });
    doc.fillColor(C_TEXT)
       .text(fmtCurrency(item.amount),      COL[3], y, { width: WIDTHS[3], align: "right", lineBreak: false });
    doc.fillColor(C_MUTED)
       .text(nextDt,                        COL[4], y, { width: WIDTHS[4], lineBreak: false });
    doc.y = y + ROW_H;
  }

  // total row
  doc.moveTo(M, doc.y).lineTo(PAGE_W - M, doc.y).strokeColor(C_GRID).lineWidth(0.4).stroke();
  doc.y += 3;
  const totalY = doc.y;
  doc.fontSize(8).font("Helvetica-Bold").fillColor(C_TEXT)
     .text("Est. Monthly Total", M, totalY, { width: 200, lineBreak: false });
  doc.fillColor(C_TEXT)
     .text(fmtCurrency(recurring.totalMonthlyEstimate), COL[3], totalY, {
       width: WIDTHS[3], align: "right", lineBreak: false,
     });
  doc.y = totalY + ROW_H;
}

// ─── Thin dense datasets for charts ─────────────────────────────────────────

function thinData<T>(data: T[], maxPts: number): T[] {
  if (data.length <= maxPts) return data;
  const step = data.length / maxPts;
  return Array.from({ length: maxPts }, (_, i) => data[Math.round(i * step)]);
}

// ─── Main report builder ──────────────────────────────────────────────────────

function buildReport(doc: Doc, data: PdfReportData) {
  const {
    from, to,
    spending, accounts, recurring,
    netWorthHistory, monthlyTrends, topMerchants,
    narrative, anomalies,
  } = data;

  // ── 1. Header ───────────────────────────────────────────────────────────────

  doc
    .fontSize(22).font("Helvetica-Bold").fillColor(C_TEXT)
    .text("Financial Report", M, M, { align: "center", width: CONTENT_W });
  doc
    .fontSize(11).font("Helvetica").fillColor(C_MUTED)
    .text(`${fmtDateLong(from)} — ${fmtDateLong(to)}`, { align: "center", width: CONTENT_W });
  doc.moveDown(0.5);
  doc
    .fontSize(8).font("Helvetica").fillColor(C_MUTED)
    .text(
      `Generated ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
      { align: "center", width: CONTENT_W },
    );
  doc.moveDown(1.2);

  // divider
  doc.moveTo(M, doc.y).lineTo(PAGE_W - M, doc.y).strokeColor(C_GRID).lineWidth(0.8).stroke();
  doc.moveDown(0.8);

  // ── KPI row ─────────────────────────────────────────────────────────────────

  const kpiTopY = doc.y;
  const colW    = CONTENT_W / 3;
  const kpis    = [
    { label: "Total Spend",        value: fmtCurrency(spending.totalSpend) },
    { label: "Net Worth",          value: fmtCompact(accounts.netWorth) },
    { label: "Monthly Expenses",   value: `${fmtCurrency(recurring.totalMonthlyEstimate)}/mo` },
  ];

  kpis.forEach(({ label, value }, i) => {
    const cx = M + i * colW;
    doc.fontSize(8).font("Helvetica").fillColor(C_MUTED)
       .text(label, cx, kpiTopY, { width: colW, align: "center" });
    doc.fontSize(18).font("Helvetica-Bold").fillColor(C_TEXT)
       .text(value, cx, kpiTopY + 14, { width: colW, align: "center" });
  });

  doc.y = kpiTopY + 52;
  doc.moveTo(M, doc.y).lineTo(PAGE_W - M, doc.y).strokeColor(C_GRID).lineWidth(0.8).stroke();
  doc.moveDown(1);

  // ── 2. AI Narrative ─────────────────────────────────────────────────────────

  sectionHeading(doc, "Summary");
  doc
    .fontSize(10).font("Helvetica").fillColor(C_TEXT)
    .text(narrative, M, doc.y, { lineGap: 3, width: CONTENT_W });
  doc.moveDown(1.5);

  // ── 3. Net Worth History ────────────────────────────────────────────────────

  sectionHeading(doc, "Net Worth History (90 Days)");
  if (netWorthHistory.length >= 2) {
    const nwData = thinData(
      netWorthHistory.map((p) => ({ date: p.date, value: p.netWorth })),
      90,
    );
    lineChart(doc, nwData, 130, C_PRIMARY);
  } else {
    doc.fontSize(9).fillColor(C_MUTED).font("Helvetica")
       .text("No balance history available.", M);
  }
  doc.moveDown(1.2);

  // ── 4. Monthly Spending Trend ───────────────────────────────────────────────

  sectionHeading(doc, "Monthly Spending Trend");
  vBarChart(
    doc,
    monthlyTrends.map((t) => ({ label: fmtMonthLabel(t.month), value: t.amount })),
    130,
    C_PRIMARY,
  );
  doc.moveDown(1.2);

  // ── 5. Spending by Category ─────────────────────────────────────────────────

  ensurePage(doc, 200);
  sectionHeading(doc, "Spending by Category");
  hBarChart(
    doc,
    spending.summary.slice(0, 10).map((r) => ({
      label: fmtCategory(r.category),
      value: r.amount,
    })),
    C_PRIMARY,
  );
  doc.moveDown(1.2);

  // ── 6. Top Merchants ────────────────────────────────────────────────────────

  if (topMerchants.length > 0) {
    ensurePage(doc, 200);
    sectionHeading(doc, "Top Merchants");
    hBarChart(
      doc,
      topMerchants.slice(0, 10).map((m) => ({ label: m.name, value: m.amount })),
      C_SECONDARY,
    );
    doc.moveDown(1.2);
  }

  // ── 7. Account Balances ─────────────────────────────────────────────────────

  ensurePage(doc, 140);
  sectionHeading(doc, "Account Balances");
  drawAccountTable(doc, accounts);
  doc.moveDown(1.2);

  // ── 8. Recurring Expenses ───────────────────────────────────────────────────

  if (recurring.items.length > 0) {
    ensurePage(doc, 140);
    sectionHeading(doc, "Recurring Expenses");
    drawRecurringTable(doc, recurring);
    doc.moveDown(1.2);
  }

  // ── 9. Anomaly Highlights ───────────────────────────────────────────────────

  if (anomalies.length > 0) {
    ensurePage(doc, 60);
    sectionHeading(doc, "Notable Anomalies");
    doc.fontSize(9).font("Helvetica").fillColor(C_TEXT);
    for (const a of anomalies) {
      ensurePage(doc, 18);
      doc.text(`• ${a}`, M, doc.y, { indent: 10, lineGap: 2, width: CONTENT_W });
    }
    doc.moveDown(1.2);
  }

  // ── 10. Footer ──────────────────────────────────────────────────────────────

  ensurePage(doc, 40);
  doc.moveTo(M, doc.y).lineTo(PAGE_W - M, doc.y).strokeColor(C_GRID).lineWidth(0.5).stroke();
  doc.moveDown(0.5);
  doc
    .fontSize(7).font("Helvetica").fillColor(C_MUTED)
    .text(
      "This report is generated from synced bank data and is for informational purposes only. " +
      "It does not constitute financial advice.",
      M, doc.y,
      { align: "center", width: CONTENT_W },
    );
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function generatePdfReport(data: PdfReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: M, size: "LETTER" }) as Doc;
    const chunks: Buffer[] = [];

    doc.on("data",  (chunk: Buffer) => chunks.push(chunk));
    doc.on("end",   () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    buildReport(doc, data);
    doc.end();
  });
}
