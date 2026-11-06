import { Badge } from "@/platform/ui/primitives";
import { HIGH_RISK_THRESHOLD, type CaseStatus, type KycDocument } from "./schema";

export const statusLabel: Record<CaseStatus, string> = {
  pending: "Pending",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
};

const statusTone: Record<CaseStatus, "neutral" | "blue" | "green" | "red" | "purple"> = {
  pending: "neutral",
  in_review: "blue",
  approved: "green",
  rejected: "red",
  escalated: "purple",
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>;
}

export function RiskBadge({ score }: { score: number }) {
  const tone = score >= HIGH_RISK_THRESHOLD ? "red" : score >= 40 ? "amber" : "green";
  const word = score >= HIGH_RISK_THRESHOLD ? "high" : score >= 40 ? "medium" : "low";
  return (
    <Badge tone={tone}>
      {score} · {word}
    </Badge>
  );
}

export function DocBadge({ doc }: { doc: KycDocument }) {
  const tone = doc.status === "verified" ? "green" : doc.status === "failed" ? "red" : "amber";
  return (
    <Badge tone={tone}>
      {doc.type}: {doc.status}
    </Badge>
  );
}
