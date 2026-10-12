import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { handleRequest } from "../src/app";

describe("handleRequest", () => {
  it("returns 404 JSON for an unknown API route", async () => {
    const res = await handleRequest(new Request("https://skope.khorum-oss.org/api/nope"), env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
  });
});
