import type { QuoteLine, QuotePromotion } from "@merch/shared";
import { Price } from "./Price";

type CartSummaryProps = {
  lines: QuoteLine[];
  /** Promotion sets (D13): the set's price, then the pieces chosen. */
  sets?: QuotePromotion[];
  /** Left out on the POS, which charges no shipping. */
  shippingFee?: number;
  /** The total from `POST /quote`; left out while browsing. */
  total?: number;
};

/** Lines grouped by product, as in POC screen C ("Prod. X – Var. A ×1 100 ฿"). */
export function CartSummary({ lines, sets = [], shippingFee, total }: CartSummaryProps) {
  if (lines.length === 0 && sets.length === 0) return <p>ยังไม่มีสินค้าในตะกร้า</p>;

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
      {sets.map((set, i) => (
        <div key={i}>
          <p className="flex justify-between gap-4 font-medium">
            <span>{set.name}</span>
            <Price amount={set.price} />
          </p>
          <ul className="text-small">
            {set.picks.flat().map((pick) => (
              <li key={`${pick.product_id}-${pick.variant_id}`}>
                {pick.product_name} ({pick.variant_name}) ×{pick.count}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {/* TODO(Thai copy for "Shipping" and "Total"): POC wording until the team picks the Thai */}
      {shippingFee !== undefined || total !== undefined ? (
        <dl className="border-t border-line pt-3">
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
