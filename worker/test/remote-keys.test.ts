import { env } from "cloudflare:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { currentEmail, remoteKeys } from "../src/auth";

afterEach(() => vi.unstubAllGlobals());

// remoteKeys caches per team domain, so each test uses its own domain.
async function setup(teamDomain: string) {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256" };
  const token = await new SignJWT({ email: "josh@example.com" })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(teamDomain)
    .setAudience("test-aud")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  const teamEnv = { ...env, ACCESS_TEAM_DOMAIN: teamDomain };
  const request = new Request("https://skope.khorum-oss.org/api/me", {
    headers: { "Cf-Access-Jwt-Assertion": token },
  });
  return { jwk, teamEnv, request };
}

describe("remoteKeys", () => {
  it("verifies a token against the team's published keys", async () => {
    const { jwk, teamEnv, request } = await setup("https://team-ok.cloudflareaccess.com");
    const fetched: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      fetched.push(input instanceof Request ? input.url : String(input));
      return Response.json({ keys: [jwk] });
    });

    expect(await currentEmail(request, teamEnv, () => remoteKeys(teamEnv))).toBe("josh@example.com");
    expect(fetched).toEqual(["https://team-ok.cloudflareaccess.com/cdn-cgi/access/certs"]);
  });

  it("treats a failed key fetch as not signed in", async () => {
    const { teamEnv, request } = await setup("https://team-down.cloudflareaccess.com");
    vi.stubGlobal("fetch", async () => new Response("unavailable", { status: 503 }));

    expect(await currentEmail(request, teamEnv, () => remoteKeys(teamEnv))).toBeNull();
  });
});
