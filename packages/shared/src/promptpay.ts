// PromptPay IDs (D14: the QR image itself comes from promptpay.io, see packages/ui PaymentQR).

/**
 * A phone number (10 digits, 0…) or a national or tax ID (13); spaces and dashes are ignored.
 * Not e-wallet IDs (15): promptpay.io answers 400 "Invalid PromptPay ID" for them.
 */
export function isPromptpayId(promptpayId: string): boolean {
  return /^(0\d{9}|\d{13})$/.test(promptpayId.replace(/[\s-]/g, ""));
}
