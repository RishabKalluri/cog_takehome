import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { getApp } from "../registry";
import { can, canView } from "../authz/rbac";
import { getCurrentUser } from "../auth/provider";
import type { User } from "../auth/users";
import { recordAudit } from "../audit/log";
import { getDb } from "../db/client";
import { buildInfo } from "../build-info";
import { isAppEnabled } from "../flags";
import { ActionError, type ActionOutcome } from "./define";

export type InvokeResult =
  | { ok: true; requestId: string; message?: string; result?: unknown }
  | { ok: false; requestId: string; status: "not_found" | "disabled" | "denied" | "invalid" | "failed"; error: string };

/**
 * The single choke point for every mutation in every app.
 *   1. resolve app + action     4. validate input (zod)
 *   2. kill switch (app flag)   5. run handler
 *   3. authorize (RBAC)         6. write audit row (always, even on failure)
 */
export async function invokeAs(user: User, appSlug: string, actionName: string, rawInput: unknown): Promise<InvokeResult> {
  const requestId = randomUUID();
  const started = Date.now();
  const app = getApp(appSlug);
  const actionDef = app?.manifest.actions[actionName];
  const impl = app?.actions[actionName];

  if (!app || !actionDef || !impl) {
    return { ok: false, requestId, status: "not_found", error: `Unknown action ${appSlug}/${actionName}` };
  }

  const base = {
    ts: new Date().toISOString(),
    requestId,
    actorId: user.id,
    actorName: user.name,
    actorEmail: user.email,
    appSlug,
    appVersion: app.manifest.version,
    action: actionName,
    gitSha: buildInfo.gitSha,
    environment: buildInfo.environment,
    input: safeJson(rawInput),
  };
  const finish = (
    status: "success" | "denied" | "invalid" | "failed" | "disabled",
    extra: Partial<{ entityId: string; before: unknown; after: unknown; error: string }> = {},
  ) =>
    recordAudit({
      ...base,
      status,
      entityId: extra.entityId,
      before: extra.before === undefined ? null : safeJson(extra.before),
      after: extra.after === undefined ? null : safeJson(extra.after),
      error: extra.error,
      durationMs: Date.now() - started,
    });

  if (!isAppEnabled(app.manifest)) {
    finish("disabled", { error: "app disabled by kill switch" });
    return { ok: false, requestId, status: "disabled", error: `${app.manifest.name} is currently disabled by an administrator.` };
  }

  if (!canView(user, app.manifest) || !can(user, app.manifest, actionName)) {
    finish("denied", { error: `requires role "${actionDef.role}"` });
    return { ok: false, requestId, status: "denied", error: `You need the "${actionDef.role}" role to do that.` };
  }

  const parsed = impl.input.safeParse(rawInput);
  if (!parsed.success) {
    const msg = formatZodError(parsed.error);
    finish("invalid", { error: msg });
    return { ok: false, requestId, status: "invalid", error: msg };
  }

  try {
    const outcome: ActionOutcome = await impl.handler(
      { user, app: app.manifest, action: actionName, requestId, db: getDb() },
      parsed.data,
    );
    finish("success", { entityId: outcome.entityId, before: outcome.before, after: outcome.after });
    return { ok: true, requestId, message: outcome.message, result: outcome.result };
  } catch (err) {
    const msg = err instanceof ActionError ? err.message : "Something went wrong.";
    finish("failed", { error: err instanceof Error ? err.message : String(err) });
    if (!(err instanceof ActionError)) console.error(`[gateway] ${appSlug}/${actionName} ${requestId}`, err);
    return { ok: false, requestId, status: "failed", error: msg };
  }
}

export async function invoke(appSlug: string, actionName: string, rawInput: unknown): Promise<InvokeResult> {
  return invokeAs(await getCurrentUser(), appSlug, actionName, rawInput);
}

function safeJson(v: unknown): string | null {
  if (v === undefined) return null;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function formatZodError(e: ZodError): string {
  return e.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
}
