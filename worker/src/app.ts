import { currentEmail, type KeySource } from "./auth";
import { ensureUser, updateUser } from "./db";
import type { Env } from "./env";
import { parseProfilePatch } from "./profile";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function handleRequest(
  request: Request,
  env: Env,
  getKeys: () => KeySource,
): Promise<Response> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

  const email = await currentEmail(request, env, getKeys);
  if (!email) return json({ error: "not signed in" }, 401);

  if (url.pathname === "/api/me") {
    if (request.method === "GET") return json(await ensureUser(env.DB, email));
    if (request.method === "PUT") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "body must be JSON" }, 400);
      }
      const parsed = parseProfilePatch(body);
      if (!parsed.ok) return json({ error: parsed.error }, 400);
      await ensureUser(env.DB, email);
      return json(await updateUser(env.DB, email, parsed.patch));
    }
    return json({ error: "method not allowed" }, 405);
  }

  return json({ error: "not found" }, 404);
}
