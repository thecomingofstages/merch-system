/** Database secrets. The URI holds the password: never log it. */
import { z } from "zod";

export const dbKeysSchema = z.object({
  MONGODB_URI: z.string().startsWith("mongodb"),
});
