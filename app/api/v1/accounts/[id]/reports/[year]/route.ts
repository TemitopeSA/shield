import type { NextRequest } from "next/server";
import { handle } from "@/lib/server/http";
import { generateReport, ShieldError } from "@/lib/service";
import { reportToCsv } from "@/lib/reports";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/v1/accounts/[id]/reports/[year]">) {
  const { id, year } = await ctx.params;
  const format = req.nextUrl.searchParams.get("format");
  return handle(req, (s) => {
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2020 || y > 2100) throw new ShieldError(400, "INVALID_YEAR", `Invalid report year ${year}.`);
    const report = generateReport(s, id, y);
    if (format === "csv")
      return new Response(reportToCsv(report), {
        headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${id}-${y}-${report.format}.csv"` },
      });
    return report;
  });
}
