"use server";

import { revalidatePath } from "next/cache";
import { invoke, type InvokeResult } from "./gateway";

export type ActionState = InvokeResult | null;

/**
 * Generic server action used by <ActionForm>. Hidden fields `_app`, `_action`
 * and optional `_input` (JSON) identify the action; every other form field
 * becomes part of the input object. Handlers use `z.coerce` for numbers.
 */
export async function runAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const app = String(formData.get("_app") ?? "");
  const action = String(formData.get("_action") ?? "");
  const input: Record<string, unknown> = {};
  const fixed = formData.get("_input");
  if (typeof fixed === "string" && fixed) Object.assign(input, JSON.parse(fixed));
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("_") || k.startsWith("$")) continue;
    input[k] = typeof v === "string" ? v : undefined;
  }
  const res = await invoke(app, action, input);
  revalidatePath("/", "layout");
  return res;
}
