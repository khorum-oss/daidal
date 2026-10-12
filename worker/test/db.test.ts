import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { ensureUser, personalWorkspaceId, updateUser } from "../src/db";

async function count(sql: string, ...args: unknown[]) {
  const row = await env.DB.prepare(sql).bind(...args).first<{ n: number }>();
  return row?.n ?? 0;
}

// Tests in a file share one database, so each test uses its own email.
describe("ensureUser", () => {
  it("creates the user with a default name and a personal workspace", async () => {
    const user = await ensureUser(env.DB, "create@example.com");
    expect(user).toEqual({ email: "create@example.com", name: "create", title: "", settings: {} });

    const id = personalWorkspaceId("create@example.com");
    expect(await count("SELECT COUNT(*) AS n FROM workspaces WHERE id = ? AND name = 'Personal'", id)).toBe(1);
    expect(
      await count("SELECT COUNT(*) AS n FROM workspace_members WHERE workspace_id = ? AND email = ?", id, "create@example.com"),
    ).toBe(1);
  });

  it("does not overwrite an existing user or duplicate the workspace", async () => {
    await ensureUser(env.DB, "again@example.com");
    await updateUser(env.DB, "again@example.com", { name: "Josh" });
    const again = await ensureUser(env.DB, "again@example.com");
    expect(again.name).toBe("Josh");
    expect(await count("SELECT COUNT(*) AS n FROM workspaces WHERE owner_email = ?", "again@example.com")).toBe(1);
  });

  it("survives two first visits at the same time", async () => {
    const [a, b] = await Promise.all([ensureUser(env.DB, "race@example.com"), ensureUser(env.DB, "race@example.com")]);
    expect(a).toEqual(b);
    expect(await count("SELECT COUNT(*) AS n FROM users WHERE email = ?", "race@example.com")).toBe(1);
    expect(await count("SELECT COUNT(*) AS n FROM workspaces WHERE owner_email = ?", "race@example.com")).toBe(1);
  });
});

describe("updateUser", () => {
  it("changes only the fields in the patch", async () => {
    await ensureUser(env.DB, "patch@example.com");
    await updateUser(env.DB, "patch@example.com", { title: "Engineer", settings: { theme: "dark" } });
    const user = await updateUser(env.DB, "patch@example.com", { name: "Josh" });
    expect(user).toEqual({ email: "patch@example.com", name: "Josh", title: "Engineer", settings: { theme: "dark" } });
  });

  it("can clear the title", async () => {
    await ensureUser(env.DB, "clear@example.com");
    await updateUser(env.DB, "clear@example.com", { title: "Engineer" });
    expect((await updateUser(env.DB, "clear@example.com", { title: "" })).title).toBe("");
  });
});
