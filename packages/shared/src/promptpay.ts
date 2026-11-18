// PromptPay (Thai QR, EMVCo merchant-presented) payload with the amount set (task 1.6).

const tlv = (tag: string, value: string) => tag + String(value.length).padStart(2, "0") + value;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as uppercase hex: the EMVCo QR checksum. */
export function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** A phone number (10 digits, 0…), a national or tax ID (13) or an e-wallet ID (15); spaces and dashes are ignored. */
export function isPromptpayId(promptpayId: string): boolean {
  return /^(0\d{9}|\d{13}|\d{15})$/.test(promptpayId.replace(/[\s-]/g, ""));
}

/** `promptpayId`: see `isPromptpayId`. `amount`: whole baht, above 0. */
export function promptpayPayload(promptpayId: string, amount: number): string {
  if (!isPromptpayId(promptpayId)) {
    throw new Error("PromptPay ID must be a 10-digit phone number, a 13-digit ID or a 15-digit e-wallet ID");
  }
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("amount must be a whole number of baht above 0");

  const id = promptpayId.replace(/[\s-]/g, "");
  const target =
    id.length === 10 ? tlv("01", ("66" + id.slice(1)).padStart(13, "0")) : tlv(id.length === 13 ? "02" : "03", id);

  const body =
    tlv("00", "01") +
    tlv("01", "12") + // dynamic: the amount is set
    tlv("29", tlv("00", "A000000677010111") + target) +
    tlv("58", "TH") +
    tlv("53", "764") + // THB
    tlv("54", amount.toFixed(2)) +
    "6304";
  return body + crc16(body);
}
