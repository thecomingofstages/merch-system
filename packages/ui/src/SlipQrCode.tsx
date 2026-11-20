"use client";

import { QRCodeSVG } from "qrcode.react";

/**
 * The slip's own QR, drawn again from `slip_qr_data` exactly as it was read, so an admin can
 * scan it with a banking app's slip check and see the amount and the receiving account.
 */
export function SlipQrCode({ data, label }: { data: string; label: string }) {
  return (
    // Ink on House lights; marginSize keeps the 4-module quiet zone scanners need.
    <div className="w-fit bg-house text-ink">
      <QRCodeSVG value={data} size={200} marginSize={4} fgColor="currentColor" bgColor="transparent" role="img" aria-label={label} />
    </div>
  );
}
