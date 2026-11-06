import { z } from "zod";
import { action, defineActions } from "@/platform/actions/define";
import { manifest } from "./manifest";
import { recordPromotion } from "./promote";
import { ENVIRONMENTS } from "./versions";

export const actions = defineActions(manifest, {
  promote: action(
    z.object({
      appSlug: z.string().trim().min(1),
      environment: z.enum(ENVIRONMENTS),
      notes: z.string().trim().max(500).optional(),
    }),
    ({ db, user }, input) => {
      const { before, after } = recordPromotion(db, { ...input, deployedBy: user.name });
      return {
        entityId: `${after.appSlug}:${after.environment}`,
        before,
        after,
        message: `Recorded ${after.appSlug} ${after.version} (${after.gitSha}) as live in ${after.environment}.`,
      };
    },
  ),
});
