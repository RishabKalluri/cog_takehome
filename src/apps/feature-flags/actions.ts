import { z } from "zod";
import { eq } from "drizzle-orm";
import { action, ActionError, defineActions } from "@/platform/actions/define";
import { appFlagKey, isReservedKey, KILL_SWITCH_EXEMPT_SLUG } from "@/platform/flags";
import type { Db } from "@/platform/db/client";
import { manifest } from "./manifest";
import { featureFlags } from "./schema";

const key = z.string().trim().min(1, "Key is required").max(120);
/** Form fields arrive as strings ("true"/"false"); server callers may pass booleans. */
const boolish = z.union([z.boolean(), z.enum(["true", "false", "on", "off", "1", "0"]).transform((v) => v === "true" || v === "on" || v === "1")]);
const percent = z.coerce.number().int("Percent must be a whole number").min(0, "Percent must be 0–100").max(100, "Percent must be 0–100");

function mustFind(db: Db, k: string) {
  const row = db.select().from(featureFlags).where(eq(featureFlags.key, k)).get();
  if (!row) throw new ActionError(`Flag "${k}" not found`, "not_found");
  return row;
}

export const actions = defineActions(manifest, {
  createFlag: action(
    z.object({
      key: key.regex(/^[a-z0-9][a-z0-9._:-]*$/, "Use lowercase letters, digits, dots, dashes or underscores (e.g. refunds.instant-approval)"),
      description: z.string().trim().max(300).default(""),
      enabled: boolish.default(false),
      rolloutPercent: percent.default(100),
    }),
    ({ db, user }, input) => {
      if (isReservedKey(input.key)) throw new ActionError("Keys starting with app: are reserved for the platform kill switches.", "invalid");
      if (db.select().from(featureFlags).where(eq(featureFlags.key, input.key)).get()) throw new ActionError(`Flag "${input.key}" already exists`, "conflict");
      const row = db
        .insert(featureFlags)
        .values({ ...input, updatedAt: new Date().toISOString(), updatedBy: user.name })
        .returning()
        .get();
      return { entityId: row.key, after: row, message: `Flag ${row.key} created.` };
    },
  ),

  toggleFlag: action(z.object({ key, enabled: boolish }), ({ db, user }, input) => {
    if (input.key === appFlagKey(KILL_SWITCH_EXEMPT_SLUG)) throw new ActionError("The Feature Flags app cannot be disabled.", "invalid");
    const before = mustFind(db, input.key);
    const after = db
      .update(featureFlags)
      .set({ enabled: input.enabled, updatedAt: new Date().toISOString(), updatedBy: user.name })
      .where(eq(featureFlags.key, input.key))
      .returning()
      .get();
    return { entityId: input.key, before, after, message: `${input.key} is now ${input.enabled ? "on" : "off"}.` };
  }),

  setRollout: action(z.object({ key, percent }), ({ db, user }, input) => {
    const before = mustFind(db, input.key);
    const after = db
      .update(featureFlags)
      .set({ rolloutPercent: input.percent, updatedAt: new Date().toISOString(), updatedBy: user.name })
      .where(eq(featureFlags.key, input.key))
      .returning()
      .get();
    return { entityId: input.key, before, after, message: `${input.key} rolled out to ${input.percent}%.` };
  }),

  deleteFlag: action(z.object({ key }), ({ db }, input) => {
    if (isReservedKey(input.key)) throw new ActionError("Kill-switch flags cannot be deleted; turn the app back on instead.", "invalid");
    const before = mustFind(db, input.key);
    db.delete(featureFlags).where(eq(featureFlags.key, input.key)).run();
    return { entityId: input.key, before, message: `Flag ${input.key} deleted.` };
  }),
});
