import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { models } from "../src/models";
import { purchaseSchema } from "../src/models/purchase";
import { userSchema } from "../src/models/user";

describe("models (S1)", () => {
  it("load on a connection", () => {
    const db = mongoose.createConnection();
    expect(Object.keys(models(db)).sort()).toEqual(["Pos", "Product", "Purchase", "Shop", "User"]);
  });

  it("users.email is unique", () => {
    expect(userSchema.indexes()).toContainEqual([{ email: 1 }, expect.objectContaining({ unique: true })]);
  });

  it("slip_qr_data is unique only for strings, so sales without a slip never collide", () => {
    expect(purchaseSchema.indexes()).toContainEqual([
      { slip_qr_data: 1 },
      expect.objectContaining({ unique: true, partialFilterExpression: { slip_qr_data: { $type: "string" } } }),
    ]);
  });

  it("a manual POS sale leaves slip_qr_data out", () => {
    const Purchase = models(mongoose.createConnection()).Purchase;
    const sale = new Purchase({ products: [], original_price: 0, shipping_fee: 0, verify_method: "MANUAL" });
    expect(sale.toObject()).not.toHaveProperty("slip_qr_data");
  });
});
