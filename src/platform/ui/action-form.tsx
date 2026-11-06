"use client";

import { useActionState, type ReactNode } from "react";
import { runAction, type ActionState } from "../actions/run";
import { SubmitButton, type ButtonVariant } from "./primitives";

type Props = {
  app: string;
  action: string;
  /** Fixed input merged under any form fields (e.g. the entity id). */
  input?: Record<string, unknown>;
  className?: string;
  children: ReactNode;
};

/** Every mutation in the UI goes through this -> runAction -> gateway. */
export function ActionForm({ app, action, input, className, children }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(runAction, null);
  return (
    <form action={formAction} className={className} aria-busy={pending}>
      <input type="hidden" name="_app" value={app} />
      <input type="hidden" name="_action" value={action} />
      {input && <input type="hidden" name="_input" value={JSON.stringify(input)} />}
      {children}
      <Feedback state={state} />
    </form>
  );
}

export function ActionButton({ label, variant = "secondary", confirm, ...rest }: Omit<Props, "children" | "className"> & { label: string; variant?: ButtonVariant; confirm?: string }) {
  return (
    <ActionForm {...rest} className="inline-block">
      <span onClickCapture={(e) => confirm && !window.confirm(confirm) && e.preventDefault()}>
        <SubmitButton variant={variant}>{label}</SubmitButton>
      </span>
    </ActionForm>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (!state) return null;
  if (state.ok) return state.message ? <p className="mt-2 text-xs text-emerald-700">{state.message}</p> : null;
  return (
    <p className="mt-2 text-xs text-red-700" role="alert">
      {state.error} <span className="text-zinc-400">(ref {state.requestId.slice(0, 8)})</span>
    </p>
  );
}
