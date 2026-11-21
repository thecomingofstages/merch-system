/**
 * Usage statistics (D21): record the shop's events, and count them for the dashboard.
 * Each step is counted as hits, sessions and visitors; days are Thailand days.
 */
import { ANALYTICS_STEPS, type AnalyticsCounts, type AnalyticsEventsRequest, type AnalyticsRange, type AnalyticsStep } from "@merch/shared";
import { Types } from "mongoose";
import type { Models } from "../models";
import { ApiError } from "../utils/ApiError";

const TZ = "Asia/Bangkok"; // UTC+7 all year

/** Only from a visitor who said yes, and hasn't taken it back (PDPA s.19). */
export async function recordEvents(m: Models, body: AnalyticsEventsRequest) {
  if (!(await m.AnalyticsConsent.exists({ visitor_id: body.visitor_id, accepted: true }))) {
    throw ApiError.conflict("NO_CONSENT", "No recorded consent for this visitor");
  }
  await m.AnalyticsEvent.insertMany(
    body.events.map((e) => ({ visitor_id: body.visitor_id, session_id: body.session_id, type: e.type, product_id: e.product_id })),
  );
}

/** Thailand days to a time filter; `to` counts its whole day. */
function timeFilter(range: AnalyticsRange) {
  const at: { $gte?: Date; $lt?: Date } = {};
  if (range.from) at.$gte = new Date(`${range.from}T00:00:00+07:00`);
  if (range.to) at.$lt = new Date(new Date(`${range.to}T00:00:00+07:00`).getTime() + 24 * 60 * 60 * 1000);
  return Object.keys(at).length ? { at } : {};
}

const zero = (): AnalyticsCounts => ({ hits: 0, sessions: 0, visitors: 0 });
const emptySteps = () => Object.fromEntries(ANALYTICS_STEPS.map((s) => [s, zero()])) as Record<AnalyticsStep, AnalyticsCounts>;
// Per group: every event, and the distinct sessions and visitors among them.
const counted = { hits: { $sum: 1 }, sessions: { $addToSet: "$session_id" }, visitors: { $addToSet: "$visitor_id" } };
type Counted<K> = { _id: K; hits: number; sessions: string[]; visitors: string[] };
const counts = (g: Counted<unknown>): AnalyticsCounts => ({ hits: g.hits, sessions: g.sessions.length, visitors: g.visitors.length });

// shortcut: $addToSet keeps every session id of a group in memory; fine for a few thousand
// visitors a sale, switch to $group-then-$count stages if a sale ever reaches the hundreds of thousands.
export async function summary(m: Models, range: AnalyticsRange) {
  const match = timeFilter(range);
  const groups = await m.AnalyticsEvent.aggregate<Counted<{ product_id: Types.ObjectId; type: AnalyticsStep }>>([
    { $match: match },
    { $group: { _id: { product_id: "$product_id", type: "$type" }, ...counted } },
  ]);
  const [all] = await m.AnalyticsEvent.aggregate<{ visitors: string[]; sessions: string[] }>([
    { $match: match },
    { $group: { _id: null, visitors: { $addToSet: "$visitor_id" }, sessions: { $addToSet: "$session_id" } } },
  ]);
  // The isPurchased label: a visit in which an order was placed.
  const purchased = await m.AnalyticsEvent.distinct("session_id", { ...match, type: "purchase" });

  const ids = [...new Set(groups.map((g) => String(g._id.product_id)))];
  const names = new Map(
    (await m.Product.find({ _id: { $in: ids } }, { name: 1 }).lean()).map((p) => [String(p._id), p.name]),
  );
  const products = new Map<string, { product_id: string; product_name: string } & Record<AnalyticsStep, AnalyticsCounts>>();
  for (const g of groups) {
    const id = String(g._id.product_id);
    // Products are archived, never deleted: an id with no product was made up by whoever sent it.
    const name = names.get(id);
    if (!name) continue;
    const row = products.get(id) ?? { product_id: id, product_name: name, ...emptySteps() };
    row[g._id.type] = counts(g);
    products.set(id, row);
  }
  return {
    totals: { visitors: all?.visitors.length ?? 0, sessions: all?.sessions.length ?? 0, purchased_sessions: purchased.length },
    products: [...products.values()].sort((a, b) => b.view.sessions - a.view.sessions || a.product_name.localeCompare(b.product_name)),
  };
}

/** One product's steps per Thailand day, for the trend chart. */
export async function daily(m: Models, productId: Types.ObjectId, range: AnalyticsRange) {
  const groups = await m.AnalyticsEvent.aggregate<Counted<{ date: string; type: AnalyticsStep }>>([
    { $match: { ...timeFilter(range), product_id: productId } },
    { $group: { _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$at", timezone: TZ } }, type: "$type" }, ...counted } },
  ]);
  const days = new Map<string, { date: string } & Record<AnalyticsStep, AnalyticsCounts>>();
  for (const g of groups) {
    const day = days.get(g._id.date) ?? { date: g._id.date, ...emptySteps() };
    day[g._id.type] = counts(g);
    days.set(g._id.date, day);
  }
  return { days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}

/** Every event before that Thailand day, or all of them. Consent records stay (they prove the yes). */
export async function deleteEvents(m: Models, before?: string) {
  const filter = before ? { at: { $lt: new Date(`${before}T00:00:00+07:00`) } } : {};
  const { deletedCount } = await m.AnalyticsEvent.deleteMany(filter);
  return { deleted: deletedCount };
}
