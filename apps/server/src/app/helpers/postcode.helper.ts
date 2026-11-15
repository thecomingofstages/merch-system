import { PostalCode, type PostcodeLookupResponse } from "@merch/shared";
import data from "../data/postcodes.json";

const postcodes: Readonly<Record<string, PostcodeLookupResponse>> = data;

// shortcut: the source has one postcode per tambon; replace it if alternate delivery codes are needed.
export function lookupPostcode(code: unknown): PostcodeLookupResponse {
  return postcodes[PostalCode.parse(code)] ?? [];
}
