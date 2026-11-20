// PromptPay IDs (D14: the QR image itself comes from promptpay.io, see packages/ui PaymentQR).

/** A phone number (10 digits, 0…), a national or tax ID (13) or an e-wallet ID (15); spaces and dashes are ignored. */
export function isPromptpayId(promptpayId: string): boolean {
  return /^(0\d{9}|\d{13}|\d{15})$/.test(promptpayId.replace(/[\s-]/g, ""));
}
