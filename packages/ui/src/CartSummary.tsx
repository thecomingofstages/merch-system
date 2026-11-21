import type { QuoteLine, QuotePromotion } from "@merch/shared";
import { Bilingual } from "./Bilingual";
import { Price } from "./Price";

type CartSummaryProps = {
  lines: QuoteLine[];
  /** Promotion sets (D13): the set's price, then the pieces chosen. */
  sets?: QuotePromotion[];
  /** Left out on the POS, which charges no shipping. */
  shippingFee?: number;
  /** The total from `POST /quote`; left out while browsing. */
  total?: number;
  /** Shows a remove button per line / per set (by its place in `sets`). Leave out where the cart is fixed. */
  onRemoveLine?: (variantId: string) => void;
  onRemoveSet?: (index: number) => void;
};

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="min-h-11 shrink-0 px-2 text-small text-gold underline underline-offset-2">
      <Bilingual th="ลบ" en="Remove" />
      <span className="sr-only"> {label}</span>
    </button>
  );
}

/** Lines grouped by product, as in POC screen C ("Prod. X – Var. A ×1 100 ฿"). */
export function CartSummary({ lines, sets = [], shippingFee, total, onRemoveLine, onRemoveSet }: CartSummaryProps) {
  if (lines.length === 0 && sets.length === 0) return <p><Bilingual th="ยังไม่มีสินค้าในตะกร้า" en="Your cart is empty" /></p>;

  const products = new Map<string, QuoteLine[]>();
  for (const line of lines) products.set(line.product_id, [...(products.get(line.product_id) ?? []), line]);

  return (
    <div className="flex flex-col gap-3">
      {[...products].map(([productId, group]) => (
        <div key={productId}>
          <p className="font-medium">{group[0]?.product_name}</p>
          <ul>
            {group.map((line) => (
              <li key={line.variant_id} className="flex items-center justify-between gap-4">
                <span>
                  {line.variant_name} ×{line.count}
                </span>
                <span className="flex items-center gap-2">
                  <Price amount={line.unit_price * line.count} />
                  {onRemoveLine ? <RemoveButton label={`${line.product_name} ${line.variant_name}`} onClick={() => onRemoveLine(line.variant_id)} /> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {sets.map((set, i) => (
        <div key={i}>
          <p className="flex items-center justify-between gap-4 font-medium">
            <span>{set.name}</span>
            <span className="flex items-center gap-2">
              <Price amount={set.price} />
              {onRemoveSet ? <RemoveButton label={set.name} onClick={() => onRemoveSet(i)} /> : null}
            </span>
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
      {shippingFee !== undefined || total !== undefined ? (
        <dl className="border-t border-line pt-3">
          {shippingFee !== undefined ? (
            <div className="flex justify-between">
              <dt><Bilingual th="ค่าส่ง" en="Shipping" /></dt>
              <dd>
                <Price amount={shippingFee} />
              </dd>
            </div>
          ) : null}
          {total !== undefined ? (
            <div className="flex justify-between font-semibold">
              <dt><Bilingual th="ยอดรวม" en="Total" /></dt>
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
