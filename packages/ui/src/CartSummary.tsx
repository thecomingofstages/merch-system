import type { QuoteLine } from "@merch/shared";
import { Price } from "./Price";

type CartSummaryProps = {
  lines: QuoteLine[];
  /** Left out on the POS, which charges no shipping. */
  shippingFee?: number;
  /** The total from `POST /quote`; left out while browsing. */
  total?: number;
};

/** Lines grouped by product, as in POC screen C ("Prod. X – Var. A ×1 100 ฿"). */
export function CartSummary({ lines, shippingFee, total }: CartSummaryProps) {
  if (lines.length === 0) return <p>ยังไม่มีสินค้าในตะกร้า</p>;

  const products = new Map<string, QuoteLine[]>();
  for (const line of lines) products.set(line.product_id, [...(products.get(line.product_id) ?? []), line]);

  return (
    <div className="flex flex-col gap-3">
      {[...products].map(([productId, group]) => (
        <div key={productId}>
          <p className="font-medium">{group[0]?.product_name}</p>
          <ul>
            {group.map((line) => (
              <li key={line.variant_id} className="flex justify-between gap-4">
                <span>
                  {line.variant_name} ×{line.count}
                </span>
                <Price amount={line.unit_price * line.count} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {/* TODO(Thai copy for "Shipping" and "Total"): POC wording until the team picks the Thai */}
      {shippingFee !== undefined || total !== undefined ? (
        <dl className="border-t border-rigging pt-3">
          {shippingFee !== undefined ? (
            <div className="flex justify-between">
              <dt>Shipping</dt>
              <dd>
                <Price amount={shippingFee} />
              </dd>
            </div>
          ) : null}
          {total !== undefined ? (
            <div className="flex justify-between font-semibold">
              <dt>Total</dt>
              <dd>
                <Price amount={total} />
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}
