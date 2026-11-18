import jsQR from "jsqr";

// Slip QR reader (1.7). Returns the payload exactly as read, never trimmed: the server
// stores it as `slip_qr_data`, and the dashboard may re-render it as a QR for checking.

const MAX_SIDE = 2048;

/** Reads the slip QR from one camera frame (POS). */
export function readSlipQrFromFrame(frame: ImageData): string | null {
  return jsQR(frame.data, frame.width, frame.height)?.data || null;
}

/** Reads the slip QR from an uploaded image (client). Null when there is no QR or the browser can't decode the file. */
export async function readSlipQr(image: Blob): Promise<string | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(image);
  } catch {
    return null;
  }
  // Camera photos can pass iOS Safari's ~16.7 MP canvas limit and take seconds to scan; slips decode fine at 600 px.
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return readSlipQrFromFrame(ctx.getImageData(0, 0, canvas.width, canvas.height));
}
