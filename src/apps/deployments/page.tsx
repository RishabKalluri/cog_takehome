import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { can } from "@/platform/authz/rbac";
import { buildInfo } from "@/platform/build-info";
import { getDb } from "@/platform/db/client";
import { deployments } from "@/platform/db/schema";
import { apps, getApp, type AppPageProps } from "@/platform/registry";
import { ActionForm } from "@/platform/ui/action-form";
import { Badge, Callout, Card, EmptyState, PageHeader, Select, SubmitButton, Table, Td, TextInput } from "@/platform/ui/primitives";
import type { AppManifest } from "@/platform/manifest";
import { manifest } from "./manifest";
import { latestDeployment, type Deployment } from "./promote";
import { compareVersions, ENVIRONMENTS, shortSha, type Environment } from "./versions";

const BASE = `/apps/${manifest.slug}`;

export default async function Page({ user, path }: AppPageProps) {
  const canPromote = can(user, manifest, "promote");
  if (path.length === 1) return <History slug={path[0]} canPromote={canPromote} />;
  if (path.length > 0) notFound();
  return <Matrix canPromote={canPromote} />;
}

function Matrix({ canPromote }: { canPromote: boolean }) {
  const db = getDb();
  const rows = apps.map((a) => ({
    manifest: a.manifest,
    cells: Object.fromEntries(ENVIRONMENTS.map((env) => [env, latestDeployment(db, a.manifest.slug, env)])) as Record<Environment, Deployment | undefined>,
  }));
  const behind = rows.flatMap((r) => ENVIRONMENTS.filter((env) => isBehind(r.cells[env], r.manifest.version)).map((env) => `${r.manifest.slug} in ${env}`));

  return (
    <>
      <PageHeader title={manifest.name} description={manifest.description} />
      <div className="mb-6">
        <Callout tone={behind.length ? "amber" : "neutral"}>
          {behind.length ? (
            <>
              <b>{behind.length} behind:</b> {behind.join(", ")} — the recorded version is older than the app&apos;s current manifest version.
            </>
          ) : (
            <>Every environment is recorded at its app&apos;s current version.</>
          )}
        </Callout>
      </div>

      <Card title="App × environment">
        <div className="hidden sm:block">
          <Table headers={["App", ...ENVIRONMENTS]}>
            {rows.map((r) => (
              <tr key={r.manifest.slug}>
                <Td className="whitespace-nowrap">
                  <AppName manifest={r.manifest} />
                </Td>
                {ENVIRONMENTS.map((env) => (
                  <Td key={env}>
                    <Cell d={r.cells[env]} current={r.manifest.version} />
                  </Td>
                ))}
              </tr>
            ))}
          </Table>
        </div>
        <ul className="divide-y divide-zinc-100 sm:hidden">
          {rows.map((r) => (
            <li key={r.manifest.slug} className="py-3">
              <AppName manifest={r.manifest} />
              <dl className="mt-2 grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-2">
                {ENVIRONMENTS.map((env) => (
                  <div key={env} className="contents">
                    <dt className="pt-2 text-xs uppercase tracking-wide text-zinc-500">{env}</dt>
                    <dd>
                      <Cell d={r.cells[env]} current={r.manifest.version} />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </Card>

      {canPromote && <PromoteForm />}
    </>
  );
}

function AppName({ manifest: m }: { manifest: AppManifest }) {
  return (
    <>
      <Link href={`${BASE}/${m.slug}`} className="font-medium text-zinc-900 hover:underline">
        {m.name}
      </Link>
      <p className="font-mono text-xs text-zinc-500">
        {m.slug} · current v{m.version}
      </p>
    </>
  );
}

function Cell({ d, current }: { d: Deployment | undefined; current: string }) {
  if (!d) return <span className="text-xs text-zinc-400">never deployed</span>;
  const behind = isBehind(d, current);
  const ahead = compareVersions(d.version, current) > 0;
  return (
    <div className={`min-w-[9rem] rounded-md p-2 ${behind ? "bg-amber-50 ring-1 ring-amber-300" : ""}`}>
      <div className="flex flex-wrap items-center gap-1">
        <Badge tone={behind ? "amber" : ahead ? "blue" : "green"}>v{d.version}</Badge>
        {behind && <span className="text-xs text-amber-800">behind</span>}
      </div>
      <p className="mt-1 font-mono text-xs text-zinc-600">{shortSha(d.gitSha)}</p>
      <p className="text-xs text-zinc-500">
        {timeAgo(d.deployedAt)} · {d.deployedBy}
      </p>
    </div>
  );
}

function History({ slug, canPromote }: { slug: string; canPromote: boolean }) {
  const app = getApp(slug);
  const rows = getDb().select().from(deployments).where(eq(deployments.appSlug, slug)).orderBy(desc(deployments.deployedAt), desc(deployments.id)).all();
  if (!app && rows.length === 0) notFound();
  const title = app?.manifest.name ?? slug;

  return (
    <>
      <PageHeader
        title={`${title} — deployment history`}
        description={app ? `${slug} · current manifest version v${app.manifest.version} · this build ${buildInfo.gitSha}` : `${slug} is no longer installed; showing historical records only.`}
        actions={
          <Link href={BASE} className="text-sm text-zinc-700 underline">
            ← All apps
          </Link>
        }
      />
      <Card title={`${rows.length} ${rows.length === 1 ? "record" : "records"}, newest first`}>
        {rows.length === 0 ? (
          <EmptyState>No deployments recorded yet.</EmptyState>
        ) : (
          <Table headers={["Deployed at", "Environment", "Version", "SHA", "By", "Notes"]}>
            {rows.map((d) => {
              const behind = app ? isBehind(d, app.manifest.version) : false;
              return (
                <tr key={d.id}>
                  <Td className="whitespace-nowrap font-mono text-xs text-zinc-600">{d.deployedAt.replace("T", " ").slice(0, 16)}Z</Td>
                  <Td>
                    <Badge tone={envTone[d.environment]}>{d.environment}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={behind ? "amber" : "green"}>v{d.version}</Badge>
                  </Td>
                  <Td className="font-mono text-xs">{shortSha(d.gitSha)}</Td>
                  <Td className="whitespace-nowrap">{d.deployedBy}</Td>
                  <Td className="text-zinc-600">{d.notes ?? "—"}</Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      {canPromote && app && <PromoteForm fixedApp={slug} />}
    </>
  );
}

function PromoteForm({ fixedApp }: { fixedApp?: string }) {
  return (
    <Card title="Record a promotion">
      <div className="mb-4">
        <Callout tone="neutral">
          This <b>records</b> that an app&apos;s current version (from its manifest, at build <span className="font-mono">{buildInfo.gitSha}</span>) is now live in an environment. It does not ship anything — real deploys are CI&apos;s job. The same record can be written from the command line with <span className="font-mono">pnpm promote &lt;app&gt; &lt;env&gt;</span>.
        </Callout>
      </div>
      <ActionForm app={manifest.slug} action="promote" input={fixedApp ? { appSlug: fixedApp } : undefined} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {!fixedApp && (
          <label className="block text-xs font-medium text-zinc-600">
            App
            <div className="mt-1">
              <Select name="appSlug" required defaultValue="">
                <option value="" disabled>Choose…</option>
                {apps.map((a) => (
                  <option key={a.manifest.slug} value={a.manifest.slug}>
                    {a.manifest.name} (v{a.manifest.version})
                  </option>
                ))}
              </Select>
            </div>
          </label>
        )}
        <label className="block text-xs font-medium text-zinc-600">
          Environment
          <div className="mt-1">
            <Select name="environment" required defaultValue="">
              <option value="" disabled>Choose…</option>
              {ENVIRONMENTS.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </Select>
          </div>
        </label>
        <label className="block text-xs font-medium text-zinc-600 sm:col-span-2 lg:col-span-1">
          Notes (optional)
          <div className="mt-1">
            <TextInput name="notes" placeholder="e.g. release train 42" />
          </div>
        </label>
        <div className="flex items-end">
          <SubmitButton>Record promotion</SubmitButton>
        </div>
      </ActionForm>
    </Card>
  );
}

const envTone = { dev: "neutral", staging: "blue", prod: "purple" } as const;

function isBehind(d: Deployment | undefined, current: string) {
  return !!d && compareVersions(d.version, current) < 0;
}

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
