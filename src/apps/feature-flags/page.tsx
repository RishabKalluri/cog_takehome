import { asc } from "drizzle-orm";
import { getDb } from "@/platform/db/client";
import { can } from "@/platform/authz/rbac";
import { appSlugFromKey, isKillSwitchable, isReservedKey } from "@/platform/flags";
import { apps, type AppPageProps } from "@/platform/registry";
import { ActionButton, ActionForm } from "@/platform/ui/action-form";
import { Badge, Callout, Card, EmptyState, PageHeader, SubmitButton, Table, Td, TextInput } from "@/platform/ui/primitives";
import { manifest } from "./manifest";
import { featureFlags, type FeatureFlag } from "./schema";

export default async function Page({ user }: AppPageProps) {
  const rows = getDb().select().from(featureFlags).orderBy(asc(featureFlags.key)).all();
  const killSwitches = rows.filter((f) => isReservedKey(f.key));
  const flags = rows.filter((f) => !isReservedKey(f.key));
  const canEdit = can(user, manifest, "toggleFlag");
  const appFor = (key: string) => apps.find((a) => a.manifest.slug === appSlugFromKey(key));
  const appName = (key: string) => appFor(key)?.manifest.name ?? appSlugFromKey(key) ?? key;
  const switchable = (key: string) => {
    const app = appFor(key);
    return !app || isKillSwitchable(app.manifest);
  };

  return (
    <>
      <PageHeader title={manifest.name} description={manifest.description} />

      <Card title="App kill switches">
        <p className="mb-3 text-sm text-zinc-600">
          Turning an app off blocks every action in it (logged as <code className="rounded bg-zinc-100 px-1">disabled</code>) and greys it out in the navigation. Nothing is
          deployed or deleted; turn it back on to recover.
          {" "}<b>Feature Flags</b> itself cannot be switched off.
        </p>
        {killSwitches.length === 0 ? (
          <EmptyState>No kill switches seeded yet — run <code>pnpm db:reset</code>.</EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {killSwitches.map((f) => (
              <li key={f.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">{appName(f.key)}</p>
                  <p className="truncate font-mono text-xs text-zinc-500">{f.key}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge flag={f} />
                  {canEdit && switchable(f.key) && <ToggleButton flag={f} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Feature flags (${flags.length})`}>
        {flags.length === 0 ? (
          <EmptyState>No flags yet.</EmptyState>
        ) : (
          <Table headers={canEdit ? ["Flag", "Status", "Rollout", "Updated", ""] : ["Flag", "Status", "Rollout", "Updated"]}>
            {flags.map((f) => (
              <tr key={f.key}>
                <Td>
                  <p className="font-mono text-sm text-zinc-900">{f.key}</p>
                  {f.description && <p className="mt-0.5 max-w-xs text-xs text-zinc-500">{f.description}</p>}
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <StatusBadge flag={f} />
                    {canEdit && <ToggleButton flag={f} />}
                  </div>
                </Td>
                <Td>
                  {canEdit ? (
                    <ActionForm app={manifest.slug} action="setRollout" input={{ key: f.key }} className="flex items-center gap-1">
                      <TextInput name="percent" type="number" min={0} max={100} defaultValue={f.rolloutPercent} aria-label={`Rollout percent for ${f.key}`} className="!w-20" />
                      <span className="text-xs text-zinc-500">%</span>
                      <SubmitButton variant="secondary">Set</SubmitButton>
                    </ActionForm>
                  ) : (
                    <span className="text-sm">{f.rolloutPercent}%</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-xs text-zinc-500">
                  {new Date(f.updatedAt).toLocaleString()}
                  <br />
                  by {f.updatedBy}
                </Td>
                {canEdit && (
                  <Td className="text-right">
                    <ActionButton app={manifest.slug} action="deleteFlag" input={{ key: f.key }} label="Delete" variant="danger" confirm={`Delete flag ${f.key}?`} />
                  </Td>
                )}
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {canEdit ? (
        <Card title="Create a flag">
          <ActionForm app={manifest.slug} action="createFlag" className="grid gap-3 sm:grid-cols-2">
            <TextInput name="key" placeholder="refunds.instant-approval" required aria-label="Flag key" />
            <TextInput name="description" placeholder="What does it switch on?" aria-label="Description" />
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" name="enabled" value="true" /> Enabled immediately
            </label>
            <div className="flex items-center gap-2 text-sm text-zinc-700">
              <span>Rollout</span>
              <TextInput name="rolloutPercent" type="number" min={0} max={100} defaultValue={100} aria-label="Rollout percent" className="!w-20" />
              <span>%</span>
            </div>
            <div className="sm:col-span-2">
              <SubmitButton>Create flag</SubmitButton>
            </div>
          </ActionForm>
        </Card>
      ) : (
        <Callout>You can see flags but not change them — that needs the <b>flag-admin</b> role (group: engineering).</Callout>
      )}
    </>
  );
}

function StatusBadge({ flag }: { flag: FeatureFlag }) {
  if (!flag.enabled) return <Badge tone="red">off</Badge>;
  if (flag.rolloutPercent < 100 && !isReservedKey(flag.key)) return <Badge tone="amber">on · {flag.rolloutPercent}%</Badge>;
  return <Badge tone="green">on</Badge>;
}

function ToggleButton({ flag }: { flag: FeatureFlag }) {
  return (
    <ActionButton
      app={manifest.slug}
      action="toggleFlag"
      input={{ key: flag.key, enabled: !flag.enabled }}
      label={flag.enabled ? "Turn off" : "Turn on"}
      variant={flag.enabled ? "danger" : "secondary"}
    />
  );
}
