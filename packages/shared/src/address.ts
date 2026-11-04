/**
 * Thai mailing format for a shipping address (task 2.4): the checkout preview (2.3),
 * the confirmation email (2.5) and the dashboard order detail (2.8) all use it.
 */
import type { Address } from "./schemas/common";

// TODO(province spelling from the postcode source, 2.2): this assumes Bangkok comes as "กรุงเทพมหานคร"
const BANGKOK = "กรุงเทพมหานคร";

/** Bangkok uses แขวง/เขต and no จังหวัด; every other province uses ตำบล/อำเภอ/จังหวัด. */
export function formatThaiAddress(address: Address): string {
  const { details, tambon, amphoe, province, postal_code } = address;
  const area =
    province === BANGKOK
      ? `แขวง${tambon} เขต${amphoe} ${province}`
      : `ตำบล${tambon} อำเภอ${amphoe} จังหวัด${province}`;
  return `${details} ${area} ${postal_code}`;
}
