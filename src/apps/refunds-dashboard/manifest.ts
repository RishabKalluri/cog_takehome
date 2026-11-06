import { defineManifest } from "@/platform/manifest";

export const manifest = defineManifest({
  slug: "refunds-dashboard",
  name: "Refunds Dashboard",
  description: "Queue of customer refund requests for the payments team: approve, reject and pay out, with large refunds gated behind a lead.",
  version: "1.0.0",
  owner: "payments",
  kind: "app",
  roles: {
    viewer: { description: "Can see the refund queue", groups: ["refunds-agents", "refunds-leads", "auditors"] },
    agent: { description: "Can approve small refunds and reject any refund", groups: ["refunds-agents"] },
    lead: { description: "Can approve large refunds and mark approved refunds as paid", groups: ["refunds-leads"] },
  },
  viewRole: "viewer",
  actions: {
    approve: { description: "Approve a requested refund below the large-refund threshold", role: "agent" },
    reject: { description: "Reject a requested refund, with a reason", role: "agent" },
    approveLarge: { description: "Approve a requested refund at or above the large-refund threshold", role: "lead" },
    markPaid: { description: "Record that an approved refund has been paid out", role: "lead" },
  },
  dataSources: ["platform-db"],
});
