import type { z } from "zod";
import type { AppManifest } from "../manifest";
import type { User } from "../auth/users";
import type { Db } from "../db/client";

export type ActionContext = {
  user: User;
  app: AppManifest;
  action: string;
  requestId: string;
  db: Db;
};

/** What a handler returns. `before`/`after` are stored verbatim in the audit log. */
export type ActionOutcome<R = unknown> = {
  result?: R;
  message?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ActionImpl<I = any> = {
  input: z.ZodType<I>;
  handler: (ctx: ActionContext, input: I) => Promise<ActionOutcome> | ActionOutcome;
};

export type ActionImpls<M extends AppManifest> = { [K in keyof M["actions"] & string]: ActionImpl };

/** Thrown by handlers for expected business-rule failures (shown to the user, logged as `failed`). */
export class ActionError extends Error {
  constructor(message: string, public readonly code: "conflict" | "not_found" | "invalid" = "invalid") {
    super(message);
    this.name = "ActionError";
  }
}

export function defineActions<M extends AppManifest>(_manifest: M, impls: ActionImpls<M>): ActionImpls<M> {
  return impls;
}

export function action<I>(input: z.ZodType<I>, handler: ActionImpl<I>["handler"]): ActionImpl<I> {
  return { input, handler };
}
