import Link from "next/link";
import type { ReactNode } from "react";
import type { User } from "../auth/users";
import { users } from "../auth/users";
import { apps } from "../registry";
import { canView, rolesFor } from "../authz/rbac";
import { buildInfo } from "../build-info";
import { isAppEnabled } from "../flags";
import { Badge } from "./primitives";
import { UserSwitcher } from "./user-switcher";

export function Shell({ user, children }: { user: User; children: ReactNode }) {
  const visible = apps.filter((a) => canView(user, a.manifest));
  const groups = [
    { title: "Apps", items: visible.filter((a) => a.manifest.kind === "app") },
    { title: "Platform", items: visible.filter((a) => a.manifest.kind === "platform") },
  ].filter((g) => g.items.length > 0);
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 text-zinc-900 md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-zinc-200 bg-white md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-baseline justify-between gap-3 border-b border-zinc-200 px-4 py-3 md:block md:px-5 md:py-4">
          <Link href="/" className="text-base font-semibold">
            Internal Apps
          </Link>
          <p className="text-xs text-zinc-500">Platform v{buildInfo.platformVersion}</p>
        </div>
        <nav className="flex flex-wrap gap-1 p-2 md:flex-1 md:flex-col md:flex-nowrap md:space-y-1 md:p-3">
          <NavLink href="/">Home</NavLink>
          {groups.map((g) => (
            <div key={g.title} className="contents md:block">
              <p className="hidden px-2 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-zinc-400 md:block">{g.title}</p>
              {g.items.map((a) => {
                const enabled = isAppEnabled(a.manifest);
                return (
                  <NavLink key={a.manifest.slug} href={`/apps/${a.manifest.slug}`} muted={!enabled} platform={a.manifest.kind === "platform"}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate">{a.manifest.name}</span>
                      {enabled ? <span className="shrink-0 text-xs text-zinc-400">v{a.manifest.version}</span> : <Badge tone="red">disabled</Badge>}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          ))}
          {visible.length === 0 && <p className="px-2 py-1.5 text-xs text-zinc-500">You don&apos;t have access to any apps.</p>}
        </nav>
        <div className="hidden border-t border-zinc-200 p-3 text-xs text-zinc-500 md:block">
          env <span className="font-mono">{buildInfo.environment}</span> · build <span className="font-mono">{buildInfo.gitSha}</span>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-zinc-500">
              {user.title} · groups: {user.groups.join(", ")}
            </p>
          </div>
          <UserSwitcher users={users.map(({ id, name, title }) => ({ id, name, title }))} current={user.id} />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
        <footer className="border-t border-zinc-200 px-4 py-2 text-xs text-zinc-500 md:hidden">
          env <span className="font-mono">{buildInfo.environment}</span> · build <span className="font-mono">{buildInfo.gitSha}</span>
        </footer>
      </div>
    </div>
  );
}

function NavLink({ href, muted = false, platform = false, children }: { href: string; muted?: boolean; platform?: boolean; children: ReactNode }) {
  const tone = muted ? "text-zinc-400 line-through decoration-zinc-300" : platform ? "text-zinc-500" : "text-zinc-700";
  return (
    <Link href={href} className={`block min-w-0 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-100 ${tone}`}>
      {children}
    </Link>
  );
}

export function roleSummary(user: User) {
  return apps.map((a) => ({ app: a.manifest, roles: rolesFor(user, a.manifest) }));
}
