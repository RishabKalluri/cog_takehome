"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE } from "./provider";
import { findUser } from "./users";

/** Demo-only: impersonate another directory user. Not present in production. */
export async function switchUser(userId: string) {
  if (!findUser(userId)) return;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
}
