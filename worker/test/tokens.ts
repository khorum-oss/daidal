import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import type { KeySource } from "../src/auth";

export const ISSUER = "https://test-team.cloudflareaccess.com";
export const AUD = "test-aud";

export async function makeSigner() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "RS256" };
  const keys: KeySource = createLocalJWKSet({ keys: [jwk] });

  async function sign(
    claims: JWTPayload,
    opts: { issuer?: string; audience?: string; expiresIn?: string } = {},
  ): Promise<string> {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(opts.issuer ?? ISSUER)
      .setAudience(opts.audience ?? AUD)
      .setIssuedAt()
      .setExpirationTime(opts.expiresIn ?? "5m")
      .sign(privateKey);
  }

  return { getKeys: () => keys, sign };
}
