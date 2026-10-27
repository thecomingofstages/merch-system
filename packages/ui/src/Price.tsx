/** Whole baht, e.g. ฿1,270. Amounts are integers (docs/FRONTEND.md "Rules every app follows"). */
export function Price({ amount }: { amount: number }) {
  return <span className="tabular-nums">฿{amount.toLocaleString("th-TH")}</span>;
}
