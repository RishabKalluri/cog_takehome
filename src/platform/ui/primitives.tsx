import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-zinc-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-600">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`mb-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>}
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-zinc-500">{children}</p>;
}

const tones: Record<string, string> = {
  neutral: "bg-zinc-100 text-zinc-700",
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-blue-100 text-blue-800",
  purple: "bg-purple-100 text-purple-800",
};
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof tones }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

const buttonVariants = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-700",
  secondary: "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
};
export type ButtonVariant = keyof typeof buttonVariants;

export function SubmitButton({ children, variant = "primary", disabled }: { children: ReactNode; variant?: ButtonVariant; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]}`}
    >
      {children}
    </button>
  );
}

const fieldClass = "w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} ${props.className ?? ""}`} />;
}
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldClass} ${props.className ?? ""}`} />;
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldClass} ${props.className ?? ""}`} />;
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">{children}</tbody>
      </table>
    </div>
  );
}
export function Td({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top text-zinc-800 ${className}`}>{children}</td>;
}

export function Callout({ tone = "neutral", children }: { tone?: "neutral" | "red" | "amber"; children: ReactNode }) {
  const cls = { neutral: "border-zinc-200 bg-zinc-50 text-zinc-700", red: "border-red-200 bg-red-50 text-red-800", amber: "border-amber-200 bg-amber-50 text-amber-800" }[tone];
  return <div className={`rounded-md border p-4 text-sm ${cls}`}>{children}</div>;
}
