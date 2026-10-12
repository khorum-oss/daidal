import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Env } from "./env";

export type KeySource = JWTVerifyGetKey;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const remoteKeySets = new Map<string, KeySource>();

export function remoteKeys(env: Env): KeySource {
  let keys = remoteKeySets.get(env.ACCESS_TEAM_DOMAIN);
  if (!keys) {
    keys = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", env.ACCESS_TEAM_DOMAIN));
    remoteKeySets.set(env.ACCESS_TEAM_DOMAIN, keys);
  }
  return keys;
}

export async function currentEmail(
  request: Request,
  env: Env,
  getKeys: () => KeySource,
): Promise<string | null> {
  const host = new URL(request.url).hostname;
  if (env.DEV_USER_EMAIL && LOCAL_HOSTS.has(host)) {
    return env.DEV_USER_EMAIL.trim().toLowerCase();
  }

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;

  try {
    const { payload } = await jwtVerify(token, getKeys(), {
      issuer: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
    });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    return email.includes("@") ? email : null;
  } catch (e) {
    console.warn("Access token rejected:", e instanceof Error ? e.name : e);
    return null;
  }
}
