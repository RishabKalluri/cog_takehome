import { defineManifest } from "@/platform/manifest";

export const manifest = defineManifest({
  slug: "kyc-review",
  name: "KYC Review Queue",
  description: "Know-Your-Customer onboarding cases: claim, approve, reject or escalate, with every step audited.",
  version: "1.0.0",
  owner: "compliance",
  roles: {
    viewer: { description: "Can read the queue and case history", groups: ["kyc-viewers", "kyc-reviewers", "kyc-supervisors", "auditors"] },
    reviewer: { description: "Can claim cases and decide on them", groups: ["kyc-reviewers"] },
    supervisor: { description: "Can decide escalated cases and reopen closed ones", groups: ["kyc-supervisors"] },
  },
  viewRole: "viewer",
  actions: {
    claim: { description: "Take a pending case into review", role: "reviewer" },
    release: { description: "Put a case back in the queue", role: "reviewer" },
    approve: { description: "Approve a case under review", role: "reviewer" },
    reject: { description: "Reject a case under review", role: "reviewer" },
    escalate: { description: "Escalate a case to a supervisor", role: "reviewer" },
    supervisorDecide: { description: "Approve or reject an escalated case", role: "supervisor" },
    reopen: { description: "Reopen an approved or rejected case", role: "supervisor" },
  },
  dataSources: ["platform-db"],
});
