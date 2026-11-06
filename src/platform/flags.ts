import { eq } from "drizzle-orm";
import { featureFlags } from "@/apps/feature-flags/schema";
import { getDb } from "./db/client";
import type { AppManifest } from "./manifest";

/**
 * Feature flags the platform itself reads. The table is owned by the
 * feature-flags app; the platform only reads it (the app writes through the gateway).
 *
 * Reserved keys `app:<slug>:enabled` are per-app kill switches: when off, the
 * gateway refuses every action of that app and the shell greys it out.
 * A missing flag means "enabled" so a new app is live until someone turns it off.
 */
export const RESERVED_PREFIX = "app:";
/** Only business apps can be killed. Platform surfaces (kind: "platform") are exempt,
 *  otherwise an admin could lock themselves out of the flags/audit tooling. */
export const isKillSwitchable = (m: Pick<AppManifest, "kind">) => m.kind === "app";

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

export function isAppEnabled(m: Pick<AppManifest, "slug" | "kind">): boolean {
  if (!isKillSwitchable(m)) return true;
  const flag = getFlag(appFlagKey(m.slug));
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
