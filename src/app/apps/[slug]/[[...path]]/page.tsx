import { notFound } from "next/navigation";
import { getCurrentUser } from "@/platform/auth/provider";
import { getApp } from "@/platform/registry";
import { canView, isPlatformAdmin } from "@/platform/authz/rbac";
import { isAppEnabled } from "@/platform/flags";
import { Callout, PageHeader } from "@/platform/ui/primitives";

type Props = { params: Promise<{ slug: string; path?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Single entry point for every app. Access is checked here before any app code runs. */
export default async function AppPage({ params, searchParams }: Props) {
  const { slug, path = [] } = await params;
  const app = getApp(slug);
  if (!app) notFound();
  const user = await getCurrentUser();

  if (!canView(user, app.manifest)) {
    return (
      <>
        <PageHeader title={app.manifest.name} />
        <Callout tone="red">
          You don&apos;t have access to this app. It requires the <b>{app.manifest.viewRole}</b> role, granted to groups:{" "}
          {app.manifest.roles[app.manifest.viewRole].groups.join(", ")}.
        </Callout>
      </>
    );
  }

  if (!isAppEnabled(app.manifest)) {
    if (!isPlatformAdmin(user)) {
      return (
        <>
          <PageHeader title={app.manifest.name} />
          <Callout tone="amber">This app has been disabled by an administrator. Please check back later.</Callout>
        </>
      );
    }
    return (
      <>
        <div className="mb-6">
          <Callout tone="amber">
            <b>Disabled.</b> This app is switched off for everyone else; you see it because you are a platform admin. All actions are blocked until{" "}
            <code className="rounded bg-amber-100 px-1">app:{slug}:enabled</code> is turned back on in Feature Flags.
          </Callout>
        </div>
        <app.Page user={user} path={path} searchParams={await searchParams} />
      </>
    );
  }

  return <app.Page user={user} path={path} searchParams={await searchParams} />;
}
