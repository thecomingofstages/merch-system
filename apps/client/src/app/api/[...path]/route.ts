/**
 * The shop's browser calls /api/*; this forwards each call to apps/server. The session cookie
 * then belongs to the shop's own address, so the browser sends it on every call, wherever the
 * shop runs (a custom domain, workers.dev, localhost). Called directly, apps/server on another
 * site never got the cookie back (SameSite=Lax), and placing an order came back "signed out".
 * CSRF stays with apps/server: it checks the forwarded Origin on every cookie route.
 */
import type { NextRequest } from "next/server";

const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });
const FORWARDED = ["content-type", "cookie", "origin"];

async function forward(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  if (path.some((s) => s === ".." || s === ".")) return fail(404, "NOT_FOUND", "Not found");
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
  if (!base) return fail(500, "INTERNAL", "Set NEXT_PUBLIC_API_URL to apps/server's address");

  const headers = new Headers();
  for (const name of FORWARDED) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  let res: Response;
  try {
    res = await fetch(`${base}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`, {
      method: req.method,
      headers,
      body: req.method === "GET" ? undefined : await req.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return fail(502, "UNAVAILABLE", "Cannot reach the shop's server");
  }
  const out = new Headers({ "Content-Type": res.headers.get("content-type") ?? "application/json" });
  for (const cookie of res.headers.getSetCookie()) out.append("Set-Cookie", cookie); // the session, now on the shop's address
  return new Response(res.body, { status: res.status, headers: out });
}

export { forward as GET, forward as POST };
