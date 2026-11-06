import { desc } from "drizzle-orm";
import { getDb } from "@/platform/db/client";
import { can } from "@/platform/authz/rbac";
import type { AppPageProps } from "@/platform/registry";
import { ActionButton, ActionForm } from "@/platform/ui/action-form";
import { Card, EmptyState, PageHeader, SubmitButton, TextArea } from "@/platform/ui/primitives";
import { manifest } from "./manifest";
import { notes } from "./schema";

export default async function Page({ user }: AppPageProps) {
  const rows = getDb().select().from(notes).orderBy(desc(notes.id)).all();
  const canEdit = can(user, manifest, "postNote");

  return (
    <>
      <PageHeader title={manifest.name} description={manifest.description} />
      {canEdit && (
        <Card title="Post a note">
          <ActionForm app={manifest.slug} action="postNote" className="space-y-3">
            <TextArea name="body" placeholder="What should the team know?" rows={3} required />
            <SubmitButton>Post</SubmitButton>
          </ActionForm>
        </Card>
      )}
      <Card title={`Notes (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyState>No notes yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {rows.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm break-words text-zinc-900">{n.body}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {n.authorName} · {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                {canEdit && <ActionButton app={manifest.slug} action="deleteNote" input={{ id: n.id }} label="Delete" variant="danger" />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
