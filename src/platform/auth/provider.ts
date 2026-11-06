import { cookies } from "next/headers";
import { findUser, users, type User } from "./users";

/**
 * Identity is pluggable. The rest of the platform only ever calls
 * `getCurrentUser()`; swapping the mock for Entra ID means implementing this
 * interface with an OIDC flow and mapping token claims:
 *   oid -> id, name -> name, preferred_username -> email, groups -> groups
 * Nothing in apps or the gateway changes.
 */
export interface IdentityProvider {
  name: string;
  currentUser(): Promise<User | null>;
}

export const SESSION_COOKIE = "iap_user";

export const mockDirectoryProvider: IdentityProvider = {
  name: "mock-directory",
  async currentUser() {
    const jar = await cookies();
    return findUser(jar.get(SESSION_COOKIE)?.value) ?? users[0];
  },
};

const provider: IdentityProvider = mockDirectoryProvider;

export async function getCurrentUser(): Promise<User> {
  const user = await provider.currentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}
