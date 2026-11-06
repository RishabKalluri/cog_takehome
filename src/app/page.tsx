import Link from "next/link";
import { getCurrentUser } from "@/platform/auth/provider";
import { apps } from "@/platform/registry";
import { canView, rolesFor } from "@/platform/authz/rbac";
import { isAppEnabled } from "@/platform/flags";
import { Badge, PageHeader } from "@/platform/ui/primitives";

const SECTIONS = [
  { kind: "app", title: "Apps", blurb: "Business apps owned by teams. Each can be switched off by an administrator." },
  { kind: "platform", title: "Platform", blurb: "Operational surfaces built on the same app contract, so they get the same roles and audit. Always on." },
] as const;

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} description="What you can open, and the roles you hold in each." />
      {SECTIONS.map(({ kind, title, blurb }) => {
        const items = apps.filter((a) => a.manifest.kind === kind);
        const platform = kind === "platform";
        return (
          <section key={kind} className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
            <p className="mb-4 mt-1 text-sm text-zinc-600">{blurb}</p>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map(({ manifest }) => {
              const roles = rolesFor(user, manifest);
              const ok = canView(user, manifest);
              const enabled = isAppEnabled(manifest);
              return (
                <li key={manifest.slug} className={`flex min-w-0 flex-col gap-3 rounded-lg border p-5 ${platform ? "border-dashed border-zinc-300 bg-zinc-50/60" : "border-zinc-200 bg-white shadow-sm"}`}>
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`truncate font-medium ${enabled ? "" : "text-zinc-400"}`}>{manifest.name}</p>
                      <span className="shrink-0 font-mono text-xs text-zinc-500">v{manifest.version}</span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">{manifest.description}</p>
                    <p className="mt-1 text-xs text-zinc-500">owner: {manifest.owner}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {platform && <Badge tone="neutral">platform</Badge>}
                    {!enabled && <Badge tone="red">disabled</Badge>}
                    {roles.length ? roles.map((r) => <Badge key={r} tone="blue">{r}</Badge>) : <Badge tone="neutral">no access</Badge>}
                  </div>
                  <div className="mt-auto">
                    {ok ? (
                      <Link href={`/apps/${manifest.slug}`} className="text-sm font-medium text-zinc-900 underline">
                        Open →
                      </Link>
                    ) : (
                      <span className="text-xs text-zinc-400">You don&apos;t hold the view role</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          </section>
        );
      })}
    </>
  );
}
