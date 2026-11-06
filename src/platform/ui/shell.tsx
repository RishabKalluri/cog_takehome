import Link from "next/link";
import type { ReactNode } from "react";
import type { User } from "../auth/users";
import { users } from "../auth/users";
import { switchUser } from "../auth/switch-user";
import { apps } from "../registry";
import { canView, rolesFor } from "../authz/rbac";
import { buildInfo } from "../build-info";

export function Shell({ user, children }: { user: User; children: ReactNode }) {
  const visible = apps.filter((a) => canView(user, a.manifest));
  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-900">
      <aside className="flex w-64 shrink-0 flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-5 py-4">
          <Link href="/" className="text-base font-semibold">
            Internal Apps
          </Link>
          <p className="text-xs text-zinc-500">Platform v{buildInfo.platformVersion}</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <NavLink href="/">Home</NavLink>
          <p className="px-2 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-zinc-400">Apps</p>
          {visible.map((a) => (
            <NavLink key={a.manifest.slug} href={`/apps/${a.manifest.slug}`}>
              <span className="flex items-center justify-between">
                {a.manifest.name}
                <span className="text-xs text-zinc-400">v{a.manifest.version}</span>
              </span>
            </NavLink>
          ))}
          {visible.length === 0 && <p className="px-2 text-xs text-zinc-500">You don&apos;t have access to any apps.</p>}
        </nav>
        <div className="border-t border-zinc-200 p-3 text-xs text-zinc-500">
          env <span className="font-mono">{buildInfo.environment}</span> · build <span className="font-mono">{buildInfo.gitSha}</span>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-3 border-b border-zinc-200 bg-white px-6 py-3">
          <div className="text-right">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-zinc-500">
              {user.title} · groups: {user.groups.join(", ")}
            </p>
          </div>
          <form action={switchUser} className="flex items-center gap-2">
            <label className="text-xs text-zinc-500" htmlFor="userId">
              Sign in as
            </label>
            <select id="userId" name="userId" defaultValue={user.id} className="rounded-md border border-zinc-300 px-2 py-1 text-sm">
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {u.title}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white">
              Switch
            </button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="block rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100">
      {children}
    </Link>
  );
}

export function roleSummary(user: User) {
  return apps.map((a) => ({ app: a.manifest, roles: rolesFor(user, a.manifest) }));
}
