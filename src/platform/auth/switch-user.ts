"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE } from "./provider";
import { findUser } from "./users";

/** Demo-only: impersonate another directory user. Not present in production. */
export async function switchUser(formData: FormData) {
  const id = String(formData.get("userId") ?? "");
  if (!findUser(id)) return;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
}
