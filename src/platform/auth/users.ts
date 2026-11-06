/**
 * Mock user directory. In production this is replaced by the identity
 * provider (Entra ID): `groups` come from the token's group claims.
 */
export type User = {
  id: string;
  name: string;
  email: string;
  title: string;
  groups: string[];
};

export const PLATFORM_ADMIN_GROUP = "platform-admins";

export const users: User[] = [
  { id: "u-priya", name: "Priya Natarajan", email: "priya@example.com", title: "Platform admin", groups: [PLATFORM_ADMIN_GROUP] },
  { id: "u-marcus", name: "Marcus Reyes", email: "marcus@example.com", title: "KYC analyst", groups: ["kyc-reviewers"] },
  { id: "u-dana", name: "Dana Osei", email: "dana@example.com", title: "KYC team lead", groups: ["kyc-reviewers", "kyc-supervisors", "refunds-leads"] },
  { id: "u-sam", name: "Sam Chen", email: "sam@example.com", title: "Software engineer", groups: ["engineering"] },
  { id: "u-lena", name: "Lena Fischer", email: "lena@example.com", title: "Compliance auditor", groups: ["auditors", "kyc-viewers"] },
  { id: "u-omar", name: "Omar Haddad", email: "omar@example.com", title: "Support agent", groups: ["support", "refunds-agents"] },
];

export function findUser(id: string | undefined): User | undefined {
  return users.find((u) => u.id === id);
}
