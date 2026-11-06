import { defineManifest } from "@/platform/manifest";

export const manifest = defineManifest({
  slug: "example-notes",
  name: "Team Notes (reference app)",
  description: "Smallest possible app: a shared notes board. Used as the template for new apps.",
  version: "1.0.0",
  owner: "platform-team",
  roles: {
    viewer: { description: "Can read notes", groups: ["engineering", "support", "kyc-reviewers", "auditors"] },
    editor: { description: "Can post and delete notes", groups: ["engineering", "support"] },
  },
  viewRole: "viewer",
  actions: {
    postNote: { description: "Post a note", role: "editor" },
    deleteNote: { description: "Delete a note", role: "editor" },
  },
  dataSources: ["platform-db"],
});
