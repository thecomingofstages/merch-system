"use client";

import { promptpayPayload } from "@merch/shared";
import { QRCodeSVG } from "qrcode.react";
import { Price } from "./Price";

// TODO(Thai copy): accessible name of the QR
const LABEL = "PromptPay QR";

type PaymentQRProps = {
  /** `promptpay_id` from `POST /quote`. */
  promptpayId: string;
  /** Whole baht: the `total` from `POST /quote`, never one the browser added up. */
  amount: number;
};

/** A PromptPay QR with the amount set, for a Thai banking app to scan. Throws on a bad ID or amount. */
export function PaymentQR({ promptpayId, amount }: PaymentQRProps) {
  return (
    <figure className="flex flex-col items-center gap-2">
      {/* Ink on House lights; marginSize keeps the 4-module quiet zone scanners need. */}
      <div className="bg-house text-ink">
        <QRCodeSVG
          value={promptpayPayload(promptpayId, amount)}
          size={240}
          marginSize={4}
          fgColor="currentColor"
          bgColor="transparent"
          role="img"
          aria-label={LABEL}
          className="h-auto w-full max-w-60"
        />
      </div>
      <figcaption className="font-display text-h3">
        <Price amount={amount} />
      </figcaption>
    </figure>
  );
}
