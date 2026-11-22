import type { OrderStatus, PaymentStatus } from "@merch/shared";

// TODO(Thai copy for Orders page): POC and docs/BACKEND.md wording until the team picks the Thai
// TODO(native speaker review)
export const COPY = {
  tokenRejected: "The dashboard's ADMIN_ACCESS_TOKEN (in its .env) doesn't match the server's.",
  pageTitle: "Orders",
  tableCaption: "Online orders list",
  loading: "Loading...",
  retry: "Retry",
  backToOrders: "← Back to orders",

  // Filters
  statusFilterLabel: "Shipping status",
  paymentFilterLabel: "Payment status",
  filterAll: "All",

  // Channels
  channelLabel: "Channel",
  channelOnline: "Online",
  channelPos: "On-site (POS)",

  // Status labels
  statusOrdered: "ORDERED",
  statusShipping: "SHIPPING",
  statusArrived: "ARRIVED",

  // Payment status labels
  paymentPendingCheck: "PENDING_CHECK",
  paymentVerified: "VERIFIED",
  paymentRejected: "REJECTED",
  paymentRefundDue: "REFUND_DUE",

  // Badge
  newOrdersBadgeLabel: (n: number) => `${n} new orders`,

  // List table headers
  colCreatedAt: "Created",
  colBuyer: "Buyer",
  colItemCount: "Items",
  colTotal: "Total",
  colPaymentStatus: "Payment",
  colShippingStatus: "Status",
  colActions: "Details",
  viewOrder: "View",

  // Pagination & Empty states
  emptyNoOrders: "No orders yet.",
  emptyNoMatchingOrders: "No orders match the selected filters.",
  prevPage: "Previous",
  nextPage: "Next",
  pageInfo: (page: number, totalPages: number, total: number) =>
    `Page ${page} of ${totalPages} (${total} orders)`,

  // Detail sections
  orderHeading: (shortId: string) => `Order ${shortId}`,
  buyerSectionTitle: "Buyer & shipping address",
  buyerNameLabel: "Name",
  buyerNicknameLabel: "Nickname",
  buyerPhoneLabel: "Phone",
  buyerLineIdLabel: "LINE ID",
  buyerEmailLabel: "Email",
  shippingAddressLabel: "Shipping address",
  noValue: "-",

  // Copy button
  copyButton: "Copy",
  copiedButton: "Copied",
  copyPhoneAria: "Copy phone number",
  copyAddressAria: "Copy shipping address",
  copySlipAria: "Copy slip reference",

  // Items & Money
  itemsSectionTitle: "Items",
  itemsTableCaption: "Ordered items",
  colProduct: "Product",
  colVariant: "Variant",
  colQuantity: "Qty",
  colUnitPrice: "Unit price",
  subtotalLabel: "Subtotal",
  discountLabel: "Set discount",
  shippingFeeLabel: "Shipping fee",
  totalLabel: "Total",

  // Payment check (D10)
  paymentSectionTitle: "Payment verification",
  slipReferenceLabel: "Transaction reference",
  slipQrLabel: "Slip QR",
  slipQrInstruction: "Scan this with your banking app's slip check to see the amount and the receiving account.",
  expectedTotalLabel: "Expected total",
  paymentCheckInstruction:
    "A slip is not proof of payment. Check this transaction reference and expected total against the bank account before verifying.",
  verifyButton: "Verify payment",
  rejectButton: "Reject",
  saving: "Saving...",
  cancelButton: "Cancel",
  verifiedAtLabel: "Verified at",
  posPaidOnSite: "Paid on site (POS)",
  noSlipData: "No slip QR data on this order.",
  refundDueInstruction:
    "The buyer paid, but the stock ran out before the order was saved. Nothing will ship. Check the payment against the bank account, refund the buyer over LINE, then mark it refunded.",
  markRefundedButton: "Mark refunded",

  // Confirm dialogs
  verifyConfirmTitle: "Verify payment",
  verifyConfirmQuestion:
    "Have you checked this transaction reference and amount against the bank account?",
  rejectConfirmTitle: "Reject payment",
  rejectConfirmBody:
    "Items will be returned to online stock, and this page has no undo. The buyer cannot reuse this slip.",
  refundConfirmTitle: "Mark refunded",
  refundConfirmBody: "Have you refunded the buyer? This order then counts as rejected, and this page has no undo.",

  // Tracking section
  trackingSectionTitle: "Shipping & tracking",
  trackingInputLabel: "Tracking ID",
  trackingPlaceholder: "Enter carrier tracking ID",
  saveTrackingButton: "Submit for shipping",
  trackingDisabledHint: "Verify the payment first before entering a tracking ID.",
  trackingRejectedHint: "This order's payment was rejected; it cannot be shipped.",
  trackingConfirmTitle: "Submit for shipping",
  trackingConfirmBody: (trackingId: string, buyerName: string) =>
    `Save tracking ID "${trackingId}" for ${buyerName} and mark the order as SHIPPING?`,

  // Validation & API errors
  trackingRequiredError: "Please enter a tracking ID",
  notVerifiedError: "This order's payment has not been verified yet",
  orderChangedNotice: "This order was updated by another admin. Showing the latest state.",
  notFoundError: "Order not found",
  networkError: "Cannot reach the server, try again",
} as const;

export function formatOrderStatus(status: OrderStatus): string {
  switch (status) {
    case "ORDERED":
      return COPY.statusOrdered;
    case "SHIPPING":
      return COPY.statusShipping;
    case "ARRIVED":
      return COPY.statusArrived;
  }
}

export function formatPaymentStatus(status: PaymentStatus): string {
  switch (status) {
    case "PENDING_CHECK":
      return COPY.paymentPendingCheck;
    case "VERIFIED":
      return COPY.paymentVerified;
    case "REJECTED":
      return COPY.paymentRejected;
    case "REFUND_DUE":
      return COPY.paymentRefundDue;
  }
}
