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
 * Creates each collection and its declared indexes, and drops indexes no longer declared.
 * autoIndex and autoCreate are off (config/db.conf.ts); `npm run db:sync` runs this.
 */
export async function syncAllIndexes(db: Connection) {
  for (const model of Object.values(models(db))) {
    await model.createCollection();
    await model.syncIndexes();
  }
}
