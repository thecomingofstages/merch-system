/**
 * The dashboard's browser calls /api/admin/*; this Next.js server adds ADMIN_ACCESS_TOKEN
 * from its own env and forwards the call to apps/server, so the token never reaches the
 * browser (AGENTS.md "Secrets", D15). Only /admin/* paths: the token is for nothing else.
 */
import type { NextRequest } from "next/server";

const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });

async function forward(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  // The token is added here, so another site's form must not get through (CSRF): browsers mark
  // every request with Sec-Fetch-Site, and the dashboard's own calls are same-origin.
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return fail(403, "FORBIDDEN", "Only the dashboard itself can call this");
  const { path } = await params;
  if (path[0] !== "admin" || path.some((s) => s === ".." || s === ".")) return fail(404, "NOT_FOUND", "Not found");
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
  const token = process.env.ADMIN_ACCESS_TOKEN;
  if (!base || !token) return fail(500, "INTERNAL", "Set NEXT_PUBLIC_API_URL and ADMIN_ACCESS_TOKEN in the dashboard's .env");

  let res: Response;
  try {
    res = await fetch(`${base}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(req.headers.get("content-type") && { "Content-Type": req.headers.get("content-type")! }),
      },
      body: req.method === "GET" ? undefined : await req.text(),
      cache: "no-store",
    });
  } catch {
    return fail(502, "UNAVAILABLE", `Cannot reach apps/server at ${base}`);
  }
  return new Response(res.body, { status: res.status, headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" } });
}

export { forward as DELETE, forward as GET, forward as PATCH, forward as POST };
