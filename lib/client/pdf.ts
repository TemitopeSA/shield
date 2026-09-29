import type { ReportData } from "../reports";
import { fmtMoney } from "../money";
import { fmtDate } from "../dates";

/** Render a report to a PDF document (jsPDF + autotable). */
export async function buildReportPdf(r: ReportData) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const cur = r.account.currency;

  doc.setFillColor(252, 213, 53);
  doc.rect(0, 0, W, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(r.title, 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(110);
  doc.text(`${r.reference} · Tax year ${r.year}`, 40, 66);
  doc.setFillColor(255, 243, 220);
  doc.roundedRect(40, 78, W - 80, 22, 4, 4, "F");
  doc.setTextColor(154, 91, 0);
  doc.text(r.disclaimer, 50, 92);

  doc.setTextColor(20);
  const meta: [string, string][] = [
    ["Account holder", r.holder.name],
    ["Tax residency", r.holder.tax_residency],
    ["Provider", r.provider.name],
    ["Account", `${r.account.id} · ${r.account.wrapper_name}`],
    ["Opened", fmtDate(r.account.opened_at)],
    ["Generated", fmtDate(r.generated_at)],
  ];
  autoTable(doc, {
    startY: 114,
    body: meta,
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: 3 },
    columnStyles: { 0: { textColor: 110, cellWidth: 110 } },
    margin: { left: 40, right: 40 },
  });

  for (const s of r.sections) {
    autoTable(doc, {
      head: [[s.title, ""]],
      body: s.lines.map((l) => [l.label, l.kind === "money" ? fmtMoney(l.value as number, cur) : String(l.value)]),
      theme: "grid",
      headStyles: { fillColor: [18, 18, 17], textColor: 255, fontSize: 10 },
      styles: { fontSize: 9.5, cellPadding: 5, lineColor: [230, 229, 225] },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: 40, right: 40 },
    });
  }
  for (const t of r.tables) {
    if (!t.rows.length) continue;
    autoTable(doc, {
      head: [t.columns],
      body: t.rows.map((row) => row.map(String)),
      theme: "striped",
      headStyles: { fillColor: [242, 242, 239], textColor: 40, fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 4 },
      margin: { left: 40, right: 40 },
      didDrawPage: () => undefined,
    });
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Shield · EU Wrapper Engine prototype — ${r.disclaimer}`, 40, doc.internal.pageSize.getHeight() - 24);
    doc.text(`${i} / ${pages}`, W - 60, doc.internal.pageSize.getHeight() - 24);
  }
  return doc;
}

export async function downloadReportPdf(r: ReportData) {
  const doc = await buildReportPdf(r);
  doc.save(`${r.account.id}-${r.year}-${r.format}.pdf`);
}
