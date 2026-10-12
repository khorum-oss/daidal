export interface User {
  email: string;
  name: string;
  title: string;
  settings: Record<string, unknown>;
}

export interface ProfilePatch {
  name?: string;
  title?: string;
  settings?: Record<string, unknown>;
}

interface UserRow {
  email: string;
  name: string;
  title: string;
  settings: string;
}

export function personalWorkspaceId(email: string): string {
  return `personal:${email}`;
}

async function getUser(db: D1Database, email: string): Promise<User> {
  const row = await db
    .prepare("SELECT email, name, title, settings FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();
  if (!row) throw new Error(`user ${email} not found`);
  return { email: row.email, name: row.name, title: row.title, settings: JSON.parse(row.settings) };
}

export async function ensureUser(db: D1Database, email: string, now = Date.now()): Promise<User> {
  const workspaceId = personalWorkspaceId(email);
  await db.batch([
    db
      .prepare("INSERT OR IGNORE INTO users (email, name, created_at) VALUES (?, ?, ?)")
      .bind(email, email.split("@")[0], now),
    db
      .prepare("INSERT OR IGNORE INTO workspaces (id, name, owner_email, created_at) VALUES (?, 'Personal', ?, ?)")
      .bind(workspaceId, email, now),
    db
      .prepare("INSERT OR IGNORE INTO workspace_members (workspace_id, email, added_at) VALUES (?, ?, ?)")
      .bind(workspaceId, email, now),
  ]);
  return getUser(db, email);
}

export async function updateUser(db: D1Database, email: string, patch: ProfilePatch): Promise<User> {
  await db
    .prepare(
      "UPDATE users SET name = COALESCE(?, name), title = COALESCE(?, title), settings = COALESCE(?, settings) WHERE email = ?",
    )
    .bind(
      patch.name ?? null,
      patch.title ?? null,
      patch.settings ? JSON.stringify(patch.settings) : null,
      email,
    )
    .run();
  return getUser(db, email);
}
