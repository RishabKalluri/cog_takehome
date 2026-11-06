import { notFound } from "next/navigation";
import type { AppPageProps } from "@/platform/registry";
import { CaseDetail } from "./case-detail";
import { Queue } from "./queue";

/** /apps/kyc-review → queue; /apps/kyc-review/<id> → case detail. */
export default async function Page({ user, path, searchParams }: AppPageProps) {
  if (path.length === 0) return <Queue user={user} searchParams={searchParams} />;
  const id = Number(path[0]);
  if (path.length !== 1 || !Number.isInteger(id) || id <= 0) notFound();
  return <CaseDetail user={user} id={id} />;
}
