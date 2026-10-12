import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { handleRequest } from "../src/app";
import { makeSigner } from "./tokens";

let signer: Awaited<ReturnType<typeof makeSigner>>;
let other: Awaited<ReturnType<typeof makeSigner>>;

beforeAll(async () => {
  signer = await makeSigner();
  other = await makeSigner();
});

function request(path: string, token?: string) {
  return new Request(`https://skope.khorum-oss.org${path}`, {
    headers: token ? { "Cf-Access-Jwt-Assertion": token } : {},
  });
}

describe("handleRequest", () => {
  it("passes non-API paths to the static assets", async () => {
    const assets = { fetch: async () => new Response("the bundle") } as unknown as Fetcher;
    const res = await handleRequest(request("/index.html"), { ...env, ASSETS: assets }, signer.getKeys);
    expect(await res.text()).toBe("the bundle");
  });

  it("rejects a token signed by a different key", async () => {
    const token = await other.sign({ email: "forged@example.com" });
    const res = await handleRequest(request("/api/me", token), env, signer.getKeys);
    expect(res.status).toBe(401);
  });

  it("answers a database failure with 500 JSON instead of throwing", async () => {
    const broken = {
      batch: async () => {
        throw new Error("D1 is down");
      },
    } as unknown as D1Database;
    const token = await signer.sign({ email: "db-down@example.com" });
    const res = await handleRequest(request("/api/me", token), { ...env, DB: broken }, signer.getKeys);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal error" });
  });
});
