/** GET /catalog (S3): what the client shows. Only live, visible_to_online variants. */
export type CatalogVariant = {
  _id: string;
  name: string;
  price: number;
  image: string | null;
  online_stock: number;
  buy_limit: number;
  sold_out: boolean;
};

export type CatalogProduct = {
  _id: string;
  name: string;
  description: string;
  image: string[];
  variants: CatalogVariant[];
};

export type CatalogShop = {
  _id: string;
  shop_name: string;
  products: CatalogProduct[];
};

export type CatalogResponse = { shops: CatalogShop[] };
