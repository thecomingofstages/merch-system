// Shared React components: base parts in F8, product and cart parts in 1.1 (docs/TASKS.md).
export { Button } from "./Button";
export { CartSummary } from "./CartSummary";
export { CartTicket } from "./CartTicket";
export { Dialog } from "./Dialog";
export { Input } from "./Input";
export { PaymentQR } from "./PaymentQR";
export { Price } from "./Price";
export { ProductCard, type ShopProduct, type ShopVariant } from "./ProductCard";
export { ProductPopup, maxCount } from "./ProductPopup";
export { PromotionCard } from "./PromotionCard";
export { PromotionPopup, setSoldOut, type SetVariant, type ShopPromotion } from "./PromotionPopup";
export { QuantityStepper } from "./QuantityStepper";
export { Select } from "./Select";
export { readSlipQr, readSlipQrFromFrame } from "./slipQr";
export { SlipQrCode } from "./SlipQrCode";
export { CartProvider, useCart } from "./useCart";
