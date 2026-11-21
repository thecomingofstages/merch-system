/** The short order number buyers and staff both see, e.g. "#2A9950": the id's last 6 hex digits. */
export function shortOrderId(id: string): string {
  return id.length > 8 ? `#${id.slice(-6).toUpperCase()}` : `#${id}`;
}
