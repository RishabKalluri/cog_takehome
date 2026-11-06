import Link from "next/link";
import { getCurrentUser } from "@/platform/auth/provider";
import { apps } from "@/platform/registry";
import { canView, rolesFor } from "@/platform/authz/rbac";
import { Badge, Card, PageHeader, Table, Td } from "@/platform/ui/primitives";

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`} description="Apps you can open, and the roles you hold in each." />
      <Card title="Your apps">
        <Table headers={["App", "Version", "Owner", "Your roles", ""]}>
          {apps.map(({ manifest }) => {
            const roles = rolesFor(user, manifest);
            const ok = canView(user, manifest);
            return (
              <tr key={manifest.slug}>
                <Td>
                  <p className="font-medium">{manifest.name}</p>
                  <p className="text-xs text-zinc-500">{manifest.description}</p>
                </Td>
                <Td className="font-mono text-xs">{manifest.version}</Td>
                <Td className="text-xs">{manifest.owner}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {roles.length ? roles.map((r) => <Badge key={r} tone="blue">{r}</Badge>) : <Badge tone="neutral">no access</Badge>}
                  </div>
                </Td>
                <Td>
                  {ok ? (
                    <Link href={`/apps/${manifest.slug}`} className="text-sm font-medium text-zinc-900 underline">
                      Open
                    </Link>
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}
