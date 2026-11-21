"use client";

import { ANALYTICS_STEPS, type AnalyticsCounts, type AnalyticsDailyResponse, type AnalyticsStep, type AnalyticsSummaryResponse } from "@merch/shared";
import { Button, Dialog, Input, Select } from "@merch/ui";
import { useEffect, useState } from "react";
import { mapDashboardError } from "@/app/(admin)/products/helpers";
import { deleteAnalytics, getAnalytics, getAnalyticsDaily } from "@/lib/api";
import { COPY } from "./copy";

type Measure = keyof AnalyticsCounts;
type Row = AnalyticsSummaryResponse["products"][number];

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–");

// One token colour per step (packages/ui/src/styles.css); the step that matters most, ordering, is gold.
const STEP_STYLE: Record<AnalyticsStep, string> = {
  impression: "text-fg-3",
  view: "text-fg-2",
  add_to_cart: "text-fg",
  checkout: "text-spotlight",
  purchase: "text-gold",
};

/** Days from first to last, filling the days without events with zeros. */
function fillDays(days: AnalyticsDailyResponse["days"]) {
  if (days.length === 0) return [];
  const byDate = new Map(days.map((d) => [d.date, d]));
  const out: AnalyticsDailyResponse["days"] = [];
  const zero = Object.fromEntries(ANALYTICS_STEPS.map((s) => [s, { hits: 0, sessions: 0, visitors: 0 }])) as Record<AnalyticsStep, AnalyticsCounts>;
  for (let t = Date.parse(days[0]!.date); t <= Date.parse(days.at(-1)!.date); t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    out.push(byDate.get(date) ?? { date, ...zero });
  }
  return out;
}

/** A small line chart, one line per step, in the chosen measure. */
function Trend({ days, measure }: { days: AnalyticsDailyResponse["days"]; measure: Measure }) {
  const filled = fillDays(days);
  if (filled.length === 0) return <p className="text-small text-fg-2">{COPY.noTrend}</p>;
  const W = 640, H = 200, P = 24;
  const max = Math.max(1, ...filled.flatMap((d) => ANALYTICS_STEPS.map((s) => d[s][measure])));
  const x = (i: number) => P + (filled.length === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (filled.length - 1));
  const y = (v: number) => H - P - (v * (H - 2 * P)) / max;
  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ANALYTICS_STEPS.map((s) => `${COPY.steps[s]}: ${filled.map((d) => d[s][measure]).join(", ")}`).join("; ")}>
        <line x1={P} x2={W - P} y1={H - P} y2={H - P} className="stroke-line" />
        <text x={P} y={P - 8} className="fill-fg-3 text-[11px]">{max}</text>
        <text x={P} y={H - 6} className="fill-fg-3 text-[11px]">{filled[0]!.date}</text>
        <text x={W - P} y={H - 6} textAnchor="end" className="fill-fg-3 text-[11px]">{filled.at(-1)!.date}</text>
        {ANALYTICS_STEPS.map((s) => (
          <polyline
            key={s}
            fill="none"
            strokeWidth={s === "purchase" ? 2.5 : 1.5}
            strokeDasharray={s === "impression" ? "4 3" : undefined}
            className={`stroke-current ${STEP_STYLE[s]}`}
            points={filled.map((d, i) => `${x(i)},${y(d[s][measure])}`).join(" ")}
          />
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-small">
        {ANALYTICS_STEPS.map((s) => (
          <span key={s} className={`inline-flex items-center gap-1 ${STEP_STYLE[s]}`}>
            <span aria-hidden="true">{s === "impression" ? "┄" : "━"}</span>
            {COPY.steps[s]}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export default function AnalyticsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [measure, setMeasure] = useState<Measure>("sessions");
  const [data, setData] = useState<AnalyticsSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Row | null>(null);
  const [days, setDays] = useState<AnalyticsDailyResponse["days"] | null>(null);
  const [reload, setReload] = useState(0);
  const [deleteBefore, setDeleteBefore] = useState("");
  const [confirm, setConfirm] = useState<{ before?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAnalytics({ from: from || undefined, to: to || undefined }).then(
      (d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      },
      (err) => !cancelled && setError(mapDashboardError(err)),
    );
    return () => {
      cancelled = true;
    };
  }, [from, to, reload]);

  useEffect(() => {
    if (!picked) return;
    let cancelled = false;
    getAnalyticsDaily(picked.product_id, { from: from || undefined, to: to || undefined }).then(
      (d) => !cancelled && setDays(d.days),
      (err) => !cancelled && setError(mapDashboardError(err)),
    );
    return () => {
      cancelled = true;
    };
  }, [picked, from, to, reload]);

  async function runDelete() {
    if (!confirm) return;
    setDeleting(true);
    try {
      const { deleted } = await deleteAnalytics(confirm.before);
      setNotice(COPY.deleted(deleted));
      setConfirm(null);
      setPicked(null);
      setDays(null);
      setReload((n) => n + 1);
    } catch (err) {
      setError(mapDashboardError(err));
    } finally {
      setDeleting(false);
    }
  }

  const n = (c: AnalyticsCounts) => c[measure];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-h2 font-semibold text-fg">{COPY.pageTitle}</h1>
        <p className="max-w-3xl text-small text-fg-2">{COPY.intro}</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Input type="date" label={COPY.from} value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" label={COPY.to} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        <Select label={COPY.countBy} value={measure} onChange={(e) => setMeasure(e.target.value as Measure)}>
          {(Object.keys(COPY.measures) as Measure[]).map((m) => (
            <option key={m} value={m}>
              {COPY.measures[m]}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-small text-fg">
          {notice}
        </p>
      ) : null}

      {data === null ? (
        <p className="text-small text-fg-2">{COPY.loading}</p>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              [COPY.visitors, data.totals.visitors, null],
              [COPY.sessions, data.totals.sessions, null],
              [COPY.purchased, data.totals.purchased_sessions, COPY.ofSessions(pct(data.totals.purchased_sessions, data.totals.sessions))],
            ].map(([label, value, note]) => (
              <div key={String(label)} className="rounded-lg border border-line bg-surface p-4">
                <dt className="text-small text-fg-2">{label}</dt>
                <dd className="font-display text-h2 tabular-nums text-fg">{value}</dd>
                {note ? <dd className="text-small text-fg-3">{note}</dd> : null}
              </div>
            ))}
          </dl>

          {data.products.length === 0 ? (
            <p className="rounded-lg border border-line bg-surface p-4 text-small text-fg-2">{COPY.empty}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-small">
                <caption className="sr-only">{COPY.tableCaption}</caption>
                <thead className="bg-raised text-left text-fg-2">
                  <tr>
                    <th className="px-3 py-2 font-medium">{COPY.product}</th>
                    {ANALYTICS_STEPS.map((s) => (
                      <th key={s} className="px-3 py-2 text-right font-medium">
                        {COPY.steps[s]}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right font-medium">{COPY.openRate}</th>
                    <th className="px-3 py-2 text-right font-medium">{COPY.addRate}</th>
                    <th className="px-3 py-2 text-right font-medium">{COPY.orderRate}</th>
                    <th className="px-3 py-2">
                      <span className="sr-only">{COPY.trend}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.products.map((row) => (
                    <tr key={row.product_id} className={picked?.product_id === row.product_id ? "bg-raised" : undefined}>
                      <th scope="row" className="px-3 py-2 text-left font-medium text-fg">
                        {row.product_name}
                      </th>
                      {ANALYTICS_STEPS.map((s) => (
                        <td key={s} className={`px-3 py-2 text-right tabular-nums ${s === "purchase" ? "text-gold" : "text-fg"}`}>
                          {n(row[s])}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right tabular-nums text-fg-2">{pct(n(row.view), n(row.impression))}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-fg-2">{pct(n(row.add_to_cart), n(row.view))}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-fg-2">{pct(n(row.purchase), n(row.view))}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="secondary"
                          aria-pressed={picked?.product_id === row.product_id}
                          aria-label={`${COPY.trend}: ${row.product_name}`}
                          onClick={() => {
                            setDays(null);
                            setPicked(row);
                          }}
                        >
                          {COPY.trend}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-small text-fg-3">{COPY.rateHelp}</p>

          {picked ? (
            <section aria-labelledby="trend-heading" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
              <h2 id="trend-heading" className="text-h3 font-semibold text-fg">
                {COPY.trendTitle(picked.product_name)}
              </h2>
              {days === null ? <p className="text-small text-fg-2">{COPY.loading}</p> : <Trend days={days} measure={measure} />}
            </section>
          ) : null}
        </>
      )}

      <section aria-labelledby="delete-heading" className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4">
        <h2 id="delete-heading" className="text-h3 font-semibold text-fg">
          {COPY.deleteTitle}
        </h2>
        <p className="text-small text-fg-2">{COPY.deleteIntro}</p>
        <div className="flex flex-wrap items-end gap-3">
          <Input type="date" label={COPY.deleteBefore} value={deleteBefore} onChange={(e) => setDeleteBefore(e.target.value)} />
          <Button variant="secondary" disabled={!deleteBefore} onClick={() => setConfirm({ before: deleteBefore })}>
            {COPY.deleteBeforeButton}
          </Button>
          <Button variant="secondary" onClick={() => setConfirm({})}>
            {COPY.deleteAll}
          </Button>
        </div>
      </section>

      <Dialog open={confirm !== null} onClose={() => !deleting && setConfirm(null)} title={COPY.confirmTitle}>
        <p className="mb-6 text-fg">{confirm?.before ? COPY.confirmBefore(confirm.before) : COPY.confirmAll}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={deleting} onClick={() => setConfirm(null)}>
            {COPY.cancel}
          </Button>
          <Button disabled={deleting} onClick={runDelete}>
            {deleting ? COPY.deleting : COPY.delete}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
