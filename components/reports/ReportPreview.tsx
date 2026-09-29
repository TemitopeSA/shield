"use client";
import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import type { ReportData } from "@/lib/reports";
import { fmtMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { downloadReportPdf } from "@/lib/client/pdf";
import { downloadFile } from "@/lib/client/api";
import { Button, WrapperBadge, cx } from "@/components/ui";

export function ReportPreview({ report, className }: { report: ReportData; className?: string }) {
  const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);
  const cur = report.account.currency;
  return (
    <div className={cx("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          size="sm"
          loading={busy === "csv"}
          icon={<FileSpreadsheet className="size-3.5" />}
          onClick={async () => {
            setBusy("csv");
            await downloadFile(`/api/v1/accounts/${report.account.id}/reports/${report.year}?format=csv`, `${report.account.id}-${report.year}-${report.format}.csv`);
            setBusy(null);
          }}
        >
          Download CSV
        </Button>
        <Button
          size="sm"
          variant="primary"
          loading={busy === "pdf"}
          icon={<Download className="size-3.5" />}
          onClick={async () => {
            setBusy("pdf");
            await downloadReportPdf(report);
            setBusy(null);
          }}
        >
          Download PDF
        </Button>
      </div>
      <article className="bg-white border border-border rounded-xl shadow-(--shadow-card) overflow-hidden anim-rise">
        <div className="h-1.5 bg-brand" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">{report.provider.name}</div>
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] mt-1">{report.title}</h3>
              <div className="text-[12.5px] text-muted mt-0.5">{report.reference} · Tax year {report.year}</div>
            </div>
            <WrapperBadge wrapper={report.account.wrapper} />
          </div>
          <div className="mt-4 rounded-lg bg-warn-soft text-warn text-[12px] px-3 py-2 font-medium">{report.disclaimer}</div>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 text-[12.5px]">
            {[
              ["Account holder", report.holder.name],
              ["Tax residency", report.holder.tax_residency],
              ["Account", report.account.id],
              ["Wrapper", report.account.wrapper_name],
              ["Opened", fmtDate(report.account.opened_at)],
              ["Generated", fmtDate(report.generated_at)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-muted">{k}</dt>
                <dd className="font-medium mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 space-y-5">
            {report.sections.map((s) => (
              <section key={s.title}>
                <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-2 pb-2 border-b border-ink">{s.title}</h4>
                <div>
                  {s.lines.map((l) => (
                    <div key={l.label} className="flex items-baseline justify-between gap-4 py-2 border-b border-border text-[13px]">
                      <span className="text-fg-2">
                        {l.label}
                        {l.note && <span className="block text-[11px] text-faint">{l.note}</span>}
                      </span>
                      <span className="tnum font-medium text-right">{l.kind === "money" ? fmtMoney(l.value as number, cur) : l.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {report.tables.map((t) => (
              <section key={t.title}>
                <h4 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-2 pb-2 border-b border-ink">{t.title}</h4>
                {t.rows.length === 0 ? (
                  <div className="text-[12.5px] text-muted py-3">None in {report.year}.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>{t.columns.map((c) => <th key={c}>{c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {t.rows.slice(0, 12).map((row, i) => (
                          <tr key={i}>{row.map((c, j) => <td key={j} className={cx(j >= 2 && "num")}>{c}</td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                    {t.rows.length > 12 && <div className="text-[11.5px] text-muted pt-2">+ {t.rows.length - 12} more rows in the CSV / PDF export</div>}
                  </div>
                )}
              </section>
            ))}
          </div>
          <div className="mt-6 text-[11px] text-faint">Generated by Shield · rule pack {report.account.wrapper} · totals: {Object.entries(report.totals).map(([k, v]) => `${k} ${fmtMoney(v, cur, { decimals: 0 })}`).join(" · ")}</div>
        </div>
      </article>
    </div>
  );
}
