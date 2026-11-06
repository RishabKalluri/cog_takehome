import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/platform/db/client";
import type { AppPageProps } from "@/platform/registry";
import { Badge, Callout, Card, EmptyState, PageHeader, Select, SubmitButton, Table, Td, TextInput } from "@/platform/ui/primitives";
import { manifest } from "./manifest";
import { filterOptions, getAuditRow, parseFilters, queryAudit, STATUSES, toQuery, type AuditFilters, type Status } from "./query";
import { changedKeys, diffObjects, parseJson } from "./diff";
import { RowLink } from "./row-link";

const BASE = `/apps/${manifest.slug}`;
const statusTone: Record<Status, "green" | "red" | "amber" | "neutral"> = { success: "green", denied: "red", invalid: "amber", failed: "red", disabled: "neutral" };

export default async function Page({ path, searchParams }: AppPageProps) {
  if (path.length === 1 && /^\d+$/.test(path[0])) return <Detail id={Number(path[0])} />;
  if (path.length > 0) notFound();
  return <List filters={parseFilters(searchParams)} />;
}

function List({ filters }: { filters: AuditFilters }) {
  const db = getDb();
  const page = queryAudit(db, filters);
  const options = filterOptions(db);
  const active = Object.entries(filters).some(([k, v]) => k !== "page" && v !== undefined);

  return (
    <>
      <PageHeader title={manifest.name} description={manifest.description} />

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STATUSES.map((s) => {
          const selected = filters.status === s;
          return (
            <Link
              key={s}
              href={`${BASE}${toQuery({ ...filters, status: selected ? undefined : s, page: 1 })}`}
              className={`rounded-lg border bg-white p-3 shadow-sm ${selected ? "border-zinc-900" : "border-zinc-200 hover:border-zinc-400"}`}
            >
              <p className="text-2xl font-semibold tabular-nums text-zinc-900">{page.counts[s]}</p>
              <Badge tone={statusTone[s]}>{s}</Badge>
            </Link>
          );
        })}
      </div>

      <Card title="Filter">
        <form method="get" action={BASE} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="App">
            <Select name="app" defaultValue={filters.app ?? ""}>
              <option value="">Any</option>
              {options.apps.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          </Field>
          <Field label="Actor">
            <Select name="actor" defaultValue={filters.actor ?? ""}>
              <option value="">Anyone</option>
              {options.actors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Action">
            <Select name="action" defaultValue={filters.action ?? ""}>
              <option value="">Any</option>
              {options.actions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={filters.status ?? ""}>
              <option value="">Any</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="From">
            <TextInput type="date" name="from" defaultValue={filters.from ?? ""} />
          </Field>
          <Field label="To">
            <TextInput type="date" name="to" defaultValue={filters.to ?? ""} />
          </Field>
          <Field label="Entity / request id">
            <TextInput name="q" placeholder="contains…" defaultValue={filters.q ?? ""} />
          </Field>
          <div className="flex items-end gap-2">
            <SubmitButton>Apply</SubmitButton>
            {active && (
              <Link href={BASE} className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50">
                Clear
              </Link>
            )}
          </div>
        </form>
      </Card>

      <Card title={`${page.total} ${page.total === 1 ? "entry" : "entries"}`}>
        {page.rows.length === 0 ? (
          <EmptyState>No audit entries match this filter.</EmptyState>
        ) : (
          <Table headers={["When", "Actor", "App", "Action", "Status", "Entity", "ms"]}>
            {page.rows.map((r) => (
              <RowLink key={r.id} href={`${BASE}/${r.id}`}>
                <Td className="whitespace-nowrap">
                  <Link href={`${BASE}/${r.id}`} className="font-mono text-xs text-zinc-600 hover:underline">
                    {fmt(r.ts)}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap">{r.actorName}</Td>
                <Td className="whitespace-nowrap font-mono text-xs">
                  {r.appSlug}
                  <span className="text-zinc-400">@{r.appVersion}</span>
                </Td>
                <Td className="font-mono text-xs">{r.action}</Td>
                <Td>
                  <Badge tone={statusTone[r.status]}>{r.status}</Badge>
                </Td>
                <Td className="font-mono text-xs text-zinc-600">{r.entityId ?? "—"}</Td>
                <Td className="text-right tabular-nums text-xs text-zinc-500">{r.durationMs}</Td>
              </RowLink>
            ))}
          </Table>
        )}
        {page.pageCount > 1 && (
          <nav className="mt-4 flex items-center justify-between text-sm">
            <PageLink filters={filters} page={page.page - 1} disabled={page.page <= 1}>← Newer</PageLink>
            <span className="text-zinc-500">
              Page {page.page} of {page.pageCount}
            </span>
            <PageLink filters={filters} page={page.page + 1} disabled={page.page >= page.pageCount}>Older →</PageLink>
          </nav>
        )}
      </Card>
    </>
  );
}

function Detail({ id }: { id: number }) {
  const row = getAuditRow(getDb(), id);
  if (!row) notFound();
  const input = parseJson(row.input);
  const before = parseJson(row.before);
  const after = parseJson(row.after);
  const diff = diffObjects(before, after).filter((d) => d.kind !== "same");
  const changed = changedKeys(before, after);

  return (
    <>
      <PageHeader
        title={`Audit entry #${row.id}`}
        description={`${row.actorName} · ${row.appSlug}/${row.action} · ${fmt(row.ts)}`}
        actions={
          <Link href={BASE} className="text-sm text-zinc-700 underline">
            ← Back to log
          </Link>
        }
      />

      {row.error && <div className="mb-6"><Callout tone={row.status === "invalid" ? "amber" : "red"}><b>{row.status}:</b> {row.error}</Callout></div>}

      <Card title="Details">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Item label="Status"><Badge tone={statusTone[row.status]}>{row.status}</Badge></Item>
          <Item label="When">{fmt(row.ts)}</Item>
          <Item label="Duration">{row.durationMs} ms</Item>
          <Item label="Actor">{row.actorName}{row.actorEmail && <span className="text-zinc-500"> ({row.actorEmail})</span>}</Item>
          <Item label="Actor id" mono>{row.actorId}</Item>
          <Item label="Request id" mono>{row.requestId}</Item>
          <Item label="App" mono>{row.appSlug}@{row.appVersion}</Item>
          <Item label="Action" mono>{row.action}</Item>
          <Item label="Entity id" mono>{row.entityId ?? "—"}</Item>
          <Item label="Environment" mono>{row.environment}</Item>
          <Item label="Build" mono>{row.gitSha}</Item>
        </dl>
      </Card>

      {diff.length > 0 && (
        <Card title={`Changed fields (${diff.length})`}>
          <Table headers={["Field", "Before", "After"]}>
            {diff.map((d) => (
              <tr key={d.key}>
                <Td className="font-mono text-xs">
                  {d.key} <Badge tone={d.kind === "added" ? "green" : d.kind === "removed" ? "red" : "amber"}>{d.kind}</Badge>
                </Td>
                <Td className="font-mono text-xs text-red-800">{d.kind === "added" ? "—" : JSON.stringify(d.before)}</Td>
                <Td className="font-mono text-xs text-emerald-800">{d.kind === "removed" ? "—" : JSON.stringify(d.after)}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <JsonCard title="Input" value={input} />
        <JsonCard title="Before" value={before} highlight={changed} />
        <JsonCard title="After" value={after} highlight={changed} />
      </div>
    </>
  );
}

function JsonCard({ title, value, highlight }: { title: string; value: unknown; highlight?: Set<string> }) {
  const isObj = typeof value === "object" && value !== null && !Array.isArray(value);
  return (
    <Card title={title} className="!mb-0 min-w-0">
      {value === undefined ? (
        <EmptyState>none</EmptyState>
      ) : (
        <pre className="overflow-x-auto rounded-md bg-zinc-50 p-3 text-xs leading-5 text-zinc-800">
          {isObj ? (
            <>
              {"{\n"}
              {Object.entries(value as Record<string, unknown>).map(([k, v], i, arr) => (
                <span key={k} className={highlight?.has(k) ? "block -mx-3 bg-amber-100 px-3" : "block"}>
                  {`  ${JSON.stringify(k)}: ${JSON.stringify(v, null, 2).replace(/\n/g, "\n  ")}${i < arr.length - 1 ? "," : ""}`}
                </span>
              ))}
              {"}"}
            </>
          ) : (
            JSON.stringify(value, null, 2)
          )}
        </pre>
      )}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-zinc-600">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Item({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className={`break-all text-zinc-900 ${mono ? "font-mono text-xs" : ""}`}>{children}</dd>
    </div>
  );
}

function PageLink({ filters, page, disabled, children }: { filters: AuditFilters; page: number; disabled: boolean; children: React.ReactNode }) {
  if (disabled) return <span className="text-zinc-300">{children}</span>;
  return (
    <Link href={`${BASE}${toQuery({ ...filters, page })}`} className="text-zinc-800 underline">
      {children}
    </Link>
  );
}

function fmt(iso: string) {
  return iso.replace("T", " ").slice(0, 19) + "Z";
}
