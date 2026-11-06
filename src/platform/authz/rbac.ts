import type { AppManifest } from "../manifest";
import { PLATFORM_ADMIN_GROUP, type User } from "../auth/users";

/** Roles are flat: a role is granted to a user when any of the user's groups
 *  is listed on that role in the app manifest. Platform admins hold every role. */
export function rolesFor(user: User, manifest: AppManifest): string[] {
  const all = Object.keys(manifest.roles);
  if (user.groups.includes(PLATFORM_ADMIN_GROUP)) return all;
  return all.filter((role) => manifest.roles[role].groups.some((g) => user.groups.includes(g)));
}

export function hasRole(user: User, manifest: AppManifest, role: string): boolean {
  return rolesFor(user, manifest).includes(role);
}

export function canView(user: User, manifest: AppManifest): boolean {
  return hasRole(user, manifest, manifest.viewRole);
}

export function can(user: User, manifest: AppManifest, action: string): boolean {
  const def = manifest.actions[action];
  if (!def) return false;
  return hasRole(user, manifest, def.role);
}

export function isPlatformAdmin(user: User): boolean {
  return user.groups.includes(PLATFORM_ADMIN_GROUP);
}
