import { describe, expect, it } from "vitest";
import { seedState, DEMO } from "@/lib/seed";
import { generateReport } from "@/lib/service";
import { reportToCsv } from "@/lib/reports";
import { buildReportPdf } from "@/lib/client/pdf";

describe("reports", () => {
  const s = seedState();
  for (const [id, format] of [[DEMO.pea, "IFU"], [DEMO.isk, "KU"], [DEMO.pir, "PIR_ANNUAL"]] as const) {
    it(`${id}: ${format} report renders to CSV and PDF with the demo disclaimer`, async () => {
      const before = s.audit.length;
      const r = generateReport(s, id, 2026);
      expect(r.format).toBe(format);
      expect(r.disclaimer).toContain("Simplified format for demonstration");
      expect(s.audit.slice(before).map((e) => e.action)).toEqual(["TAX_CALCULATED", "REPORT_GENERATED"]);
      const csv = reportToCsv(r);
      expect(csv.split("\n").length).toBeGreaterThan(15);
      const pdf = (await buildReportPdf(r)).output("arraybuffer");
      expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
      expect(pdf.byteLength).toBeGreaterThan(3000);
    });
  }
  it("ISK report shows the capital-base working", () => {
    const r = generateReport(s, DEMO.isk, 2026);
    const lines = r.sections.flatMap((x) => x.lines.map((l) => l.label));
    expect(lines).toContain("Capital base (sum ÷ 4)");
    expect(lines).toContain("Tax-free allowance");
  });
});
