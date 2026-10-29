/**
 * Models are bound to the per-request connection from withDb (database/db.ts), not to the
 * global mongoose instance, so they are built from schemas on each connection.
 */
import type { Connection } from "mongoose";
import { posSchema } from "./pos.model";
import { productSchema } from "./product.model";
import { purchaseSchema } from "./purchase.model";
import { shopSchema } from "./shop.model";
import { userSchema } from "./user.model";

export function models(db: Connection) {
  return {
    User: db.model("User", userSchema, "users"),
    Shop: db.model("Shop", shopSchema, "shops"),
    Product: db.model("Product", productSchema, "products"),
    Purchase: db.model("Purchase", purchaseSchema, "purchases"),
    Pos: db.model("Pos", posSchema, "pos"),
  };
}

export type Models = ReturnType<typeof models>;

/**
 * Creates the declared indexes and drops ones no longer declared. autoIndex is off
 * (config/db.conf.ts), so run this once per database and after any index change.
 */
export async function syncAllIndexes(db: Connection) {
  for (const model of Object.values(models(db))) {
    await model.createCollection();
    await model.syncIndexes();
  }
}
