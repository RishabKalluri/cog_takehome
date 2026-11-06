import { notFound } from "next/navigation";
import { getCurrentUser } from "@/platform/auth/provider";
import { getApp } from "@/platform/registry";
import { canView } from "@/platform/authz/rbac";
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

  return <app.Page user={user} path={path} searchParams={await searchParams} />;
}
