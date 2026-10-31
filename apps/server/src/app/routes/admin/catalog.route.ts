import { Router } from "express";
import { AdminCatalogController as C } from "../../controllers/admin/catalog.controller";

/** Mounted under /admin, after Auth (routes/init.ts). */
export const adminCatalogRoute = Router();

adminCatalogRoute.get("/shops", C.listShops);
adminCatalogRoute.post("/shops", C.createShop);
adminCatalogRoute.patch("/shops/:id", C.updateShop);
adminCatalogRoute.delete("/shops/:id", C.archiveShop);

adminCatalogRoute.get("/products", C.listProducts);
adminCatalogRoute.post("/products", C.createProduct);
adminCatalogRoute.get("/products/:id", C.getProduct);
adminCatalogRoute.patch("/products/:id", C.updateProduct);
adminCatalogRoute.delete("/products/:id", C.archiveProduct);

adminCatalogRoute.post("/products/:id/variants", C.addVariant);
adminCatalogRoute.patch("/products/:id/variants/:vid", C.updateVariant);
adminCatalogRoute.delete("/products/:id/variants/:vid", C.archiveVariant);
adminCatalogRoute.post("/products/:id/variants/:vid/stock", C.addStock);
