"use client";

import { isPromptpayId } from "@merch/shared";
import { Price } from "./Price";

// TODO(Thai copy): accessible name of the QR, and the label before the account
const LABEL = "PromptPay QR";
const ACCOUNT = "PromptPay";

type PaymentQRProps = {
  /** `promptpay_id` from `POST /quote` (the server's PROMPTPAY_ID). */
  promptpayId: string;
  /** `promptpay_name` from `POST /quote` (the server's PROMPTPAY_NAME). */
  name: string;
  /** Whole baht: the `total` from `POST /quote`, never one the browser added up. */
  amount: number;
};

/**
 * A PromptPay QR with the amount set, drawn by promptpay.io (D14), and the account it pays
 * to, so the buyer can check the name their banking app shows. Throws on a bad ID or amount.
 */
export function PaymentQR({ promptpayId, name, amount }: PaymentQRProps) {
  if (!isPromptpayId(promptpayId)) throw new Error("PromptPay ID must be a 10-digit phone number or a 13-digit ID");
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("amount must be a whole number of baht above 0");
  const id = promptpayId.replace(/[\s-]/g, "");

  return (
    <figure className="flex flex-col items-center gap-2">
      <img
        src={`https://promptpay.io/${id}/${amount}.png`}
        alt={LABEL}
        // promptpay.io needs the ID and amount, not which checkout page asked.
        referrerPolicy="no-referrer"
        width={240}
        height={240}
        className="h-auto w-full max-w-60 bg-surface"
      />
      <figcaption className="flex flex-col items-center text-center">
        <span className="font-display text-h3">
          <Price amount={amount} />
        </span>
        <span>
          {ACCOUNT}: {name} · {id}
        </span>
      </figcaption>
    </figure>
  );
}
