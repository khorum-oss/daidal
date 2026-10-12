import type { ProfilePatch } from "./db";

export const MAX_TEXT = 100;
export const MAX_SETTINGS_BYTES = 16 * 1024;

export type ParsedPatch = { ok: true; patch: ProfilePatch } | { ok: false; error: string };

export function parseProfilePatch(body: unknown): ParsedPatch {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "body must be a JSON object" };
  }
  const { name, title, settings } = body as Record<string, unknown>;
  const patch: ProfilePatch = {};

  if (name !== undefined) {
    if (typeof name !== "string") return { ok: false, error: "name must be a string" };
    const trimmed = name.trim();
    if (trimmed.length > MAX_TEXT) return { ok: false, error: `name must be ${MAX_TEXT} characters or fewer` };
    if (trimmed) patch.name = trimmed;
  }

  if (title !== undefined) {
    if (typeof title !== "string") return { ok: false, error: "title must be a string" };
    const trimmed = title.trim();
    if (trimmed.length > MAX_TEXT) return { ok: false, error: `title must be ${MAX_TEXT} characters or fewer` };
    patch.title = trimmed;
  }

  if (settings !== undefined) {
    if (typeof settings !== "object" || settings === null || Array.isArray(settings)) {
      return { ok: false, error: "settings must be a JSON object" };
    }
    if (JSON.stringify(settings).length > MAX_SETTINGS_BYTES) {
      return { ok: false, error: "settings is too large" };
    }
    patch.settings = settings as Record<string, unknown>;
  }

  return { ok: true, patch };
}
