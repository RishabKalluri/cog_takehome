import Link from "next/link";
import { getCurrentUser } from "@/platform/auth/provider";
import { apps } from "@/platform/registry";
import { canView, rolesFor } from "@/platform/authz/rbac";
import { Badge, PageHeader } from "@/platform/ui/primitives";

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} description="Apps you can open, and the roles you hold in each." />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {apps.map(({ manifest }) => {
          const roles = rolesFor(user, manifest);
          const ok = canView(user, manifest);
          return (
            <li key={manifest.slug} className="flex min-w-0 flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium">{manifest.name}</p>
                  <span className="shrink-0 font-mono text-xs text-zinc-500">v{manifest.version}</span>
                </div>
                <p className="mt-1 text-sm text-zinc-600">{manifest.description}</p>
                <p className="mt-1 text-xs text-zinc-500">owner: {manifest.owner}</p>
              </div>
              <div className="flex flex-wrap gap-1">
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
    </>
  );
}
