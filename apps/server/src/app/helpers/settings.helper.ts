/** Shop-wide settings (D22): one document. Before the first save, free shipping is off. */
import type { Settings } from "@merch/shared";
import type { ClientSession } from "mongoose";
import type { Models } from "../models";

const ID = "shop";

export async function getSettings(m: Models, session: ClientSession | null = null): Promise<Settings> {
  const s = await m.Setting.findById(ID).session(session).lean();
  return { free_shipping_enabled: s?.free_shipping_enabled ?? false, free_shipping_min: s?.free_shipping_min ?? 1 };
}

export async function saveSettings(m: Models, body: Settings): Promise<Settings> {
  await m.Setting.updateOne({ _id: ID }, { $set: body }, { upsert: true, runValidators: true });
  return body;
}
