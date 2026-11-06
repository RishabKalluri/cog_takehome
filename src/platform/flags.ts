import { eq } from "drizzle-orm";
import { featureFlags } from "@/apps/feature-flags/schema";
import { getDb } from "./db/client";

/**
 * Feature flags the platform itself reads. The table is owned by the
 * feature-flags app; the platform only reads it (the app writes through the gateway).
 *
 * Reserved keys `app:<slug>:enabled` are per-app kill switches: when off, the
 * gateway refuses every action of that app and the shell greys it out.
 * A missing flag means "enabled" so a new app is live until someone turns it off.
 */
export const RESERVED_PREFIX = "app:";
/** The flags app can never be killed, otherwise nobody could turn things back on. */
export const KILL_SWITCH_EXEMPT_SLUG = "feature-flags";

export const appFlagKey = (slug: string) => `${RESERVED_PREFIX}${slug}:enabled`;
export const isReservedKey = (key: string) => key.startsWith(RESERVED_PREFIX);
/** Inverse of appFlagKey; undefined for ordinary flags. */
export function appSlugFromKey(key: string): string | undefined {
  const m = /^app:([a-z0-9][a-z0-9-]*):enabled$/.exec(key);
  return m?.[1];
}

function getFlag(key: string) {
  return getDb().select().from(featureFlags).where(eq(featureFlags.key, key)).get();
}

/**
 * Is `key` on? With a `subject` (e.g. user id) the rollout percentage is applied
 * deterministically, so the same user always gets the same answer.
 */
export function isFlagOn(key: string, subject?: string): boolean {
  const flag = getFlag(key);
  if (!flag || !flag.enabled) return false;
  if (flag.rolloutPercent >= 100 || subject === undefined) return true;
  return bucket(`${key}:${subject}`) < flag.rolloutPercent;
}

export function isAppEnabled(slug: string): boolean {
  if (slug === KILL_SWITCH_EXEMPT_SLUG) return true;
  const flag = getFlag(appFlagKey(slug));
  return flag ? flag.enabled : true;
}

/** Stable 0–99 bucket for a string (FNV-1a). */
function bucket(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
}
