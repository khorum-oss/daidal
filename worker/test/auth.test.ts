import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { currentEmail } from "../src/auth";
import { makeSigner } from "./tokens";

let signer: Awaited<ReturnType<typeof makeSigner>>;
let other: Awaited<ReturnType<typeof makeSigner>>;

beforeAll(async () => {
  signer = await makeSigner();
  other = await makeSigner();
});

function req(token?: string, url = "https://skope.khorum-oss.org/api/me") {
  return new Request(url, { headers: token ? { "Cf-Access-Jwt-Assertion": token } : {} });
}

describe("currentEmail", () => {
  it("returns the lowercased email for a valid token", async () => {
    const token = await signer.sign({ email: "Josh@Example.com" });
    expect(await currentEmail(req(token), env, signer.getKeys)).toBe("josh@example.com");
  });

  it("returns null when the header is missing", async () => {
    expect(await currentEmail(req(), env, signer.getKeys)).toBeNull();
  });

  it("returns null for a token signed by a different key", async () => {
    const token = await other.sign({ email: "josh@example.com" });
    expect(await currentEmail(req(token), env, signer.getKeys)).toBeNull();
  });

  it("returns null for the wrong audience", async () => {
    const token = await signer.sign({ email: "josh@example.com" }, { audience: "another-app" });
    expect(await currentEmail(req(token), env, signer.getKeys)).toBeNull();
  });

  it("returns null for the wrong issuer", async () => {
    const token = await signer.sign({ email: "josh@example.com" }, { issuer: "https://evil.example" });
    expect(await currentEmail(req(token), env, signer.getKeys)).toBeNull();
  });

  it("returns null for an expired token", async () => {
    const token = await signer.sign({ email: "josh@example.com" }, { expiresIn: "-1m" });
    expect(await currentEmail(req(token), env, signer.getKeys)).toBeNull();
  });

  it("returns null for a token with no email (a service token)", async () => {
    const token = await signer.sign({ common_name: "ci-bot" });
    expect(await currentEmail(req(token), env, signer.getKeys)).toBeNull();
  });

  it("returns null when the Access settings are empty, without fetching keys", async () => {
    const token = await signer.sign({ email: "josh@example.com" });
    const unconfigured = { ...env, ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" };
    const getKeys = () => {
      throw new Error("must not be called");
    };
    expect(await currentEmail(req(token), unconfigured, getKeys)).toBeNull();
  });

  it("uses DEV_USER_EMAIL on localhost", async () => {
    const dev = { ...env, DEV_USER_EMAIL: "Dev@Example.com" };
    expect(await currentEmail(req(undefined, "http://localhost:8787/api/me"), dev, signer.getKeys)).toBe(
      "dev@example.com",
    );
  });

  it("ignores DEV_USER_EMAIL on any other host", async () => {
    const dev = { ...env, DEV_USER_EMAIL: "dev@example.com" };
    expect(await currentEmail(req(), dev, signer.getKeys)).toBeNull();
  });
});
