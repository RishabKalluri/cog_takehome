import type { Db } from "@/platform/db/client";
import { appFlagKey, KILL_SWITCH_EXEMPT_SLUG } from "@/platform/flags";
import { apps } from "@/platform/registry";
import { featureFlags } from "./schema";

export function seed(db: Db) {
  const now = new Date().toISOString();
  const by = "seed";
  db.insert(featureFlags)
    .values([
      { key: "refunds.instant-approval", description: "Auto-approve refunds under $50 without a reviewer.", enabled: true, rolloutPercent: 25, updatedAt: now, updatedBy: by },
      { key: "kyc.auto-escalate-high-risk", description: "Escalate cases with risk score ≥ 80 straight to supervisors.", enabled: true, rolloutPercent: 100, updatedAt: now, updatedBy: by },
      { key: "kyc.new-document-viewer", description: "Side-by-side document viewer in the KYC queue (beta).", enabled: false, rolloutPercent: 100, updatedAt: now, updatedBy: by },
      { key: "support.macros-v2", description: "New canned-response editor for support agents.", enabled: true, rolloutPercent: 50, updatedAt: now, updatedBy: by },
      { key: "platform.dark-mode", description: "Dark theme for the shell.", enabled: false, rolloutPercent: 0, updatedAt: now, updatedBy: by },
      // One kill switch per registered app. The flags app itself is exempt so an admin can always get back in.
      ...apps
        .filter((a) => a.manifest.slug !== KILL_SWITCH_EXEMPT_SLUG)
        .map((a) => ({ key: appFlagKey(a.manifest.slug), description: `Kill switch for ${a.manifest.name}.`, enabled: true, rolloutPercent: 100, updatedAt: now, updatedBy: by })),
    ])
    .run();
}
