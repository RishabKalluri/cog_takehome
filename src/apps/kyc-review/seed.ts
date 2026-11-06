import type { Db } from "@/platform/db/client";
import { kycCases, type KycDocument } from "./schema";

const ago = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();
const docs = (passport: KycDocument["status"], address: KycDocument["status"], selfie?: KycDocument["status"]): KycDocument[] => [
  { type: "Passport", status: passport },
  { type: "Proof of address", status: address },
  ...(selfie ? [{ type: "Selfie match", status: selfie }] : []),
];

export function seed(db: Db) {
  db.insert(kycCases)
    .values([
      { customerName: "Aisha Rahman", customerEmail: "aisha.rahman@example.net", country: "GB", riskScore: 12, documents: docs("verified", "verified", "verified"), status: "pending", createdAt: ago(2), updatedAt: ago(2) },
      { customerName: "Tomás Herrera", customerEmail: "tomas.h@example.net", country: "ES", riskScore: 27, documents: docs("verified", "pending"), status: "pending", createdAt: ago(5), updatedAt: ago(5) },
      { customerName: "Grace Okonkwo", customerEmail: "grace.ok@example.net", country: "NG", riskScore: 64, documents: docs("verified", "pending", "verified"), status: "pending", createdAt: ago(7), updatedAt: ago(7) },
      { customerName: "Viktor Petrov", customerEmail: "v.petrov@example.net", country: "BG", riskScore: 88, documents: docs("verified", "failed", "verified"), status: "pending", createdAt: ago(9), updatedAt: ago(9) },
      { customerName: "Mei Lin", customerEmail: "mei.lin@example.net", country: "SG", riskScore: 8, documents: docs("verified", "verified"), status: "pending", createdAt: ago(12), updatedAt: ago(12) },
      { customerName: "Jonas Lindqvist", customerEmail: "jonas.l@example.net", country: "SE", riskScore: 45, documents: docs("pending", "verified"), status: "pending", createdAt: ago(20), updatedAt: ago(20) },
      { customerName: "Fatima Al-Sayed", customerEmail: "fatima.as@example.net", country: "AE", riskScore: 71, documents: docs("verified", "verified", "pending"), status: "in_review", assigneeId: "u-marcus", assigneeName: "Marcus Reyes", createdAt: ago(26), updatedAt: ago(1) },
      { customerName: "Daniel Brooks", customerEmail: "d.brooks@example.net", country: "US", riskScore: 33, documents: docs("verified", "verified", "verified"), status: "in_review", assigneeId: "u-marcus", assigneeName: "Marcus Reyes", createdAt: ago(30), updatedAt: ago(3) },
      { customerName: "Nadia Kowalski", customerEmail: "nadia.k@example.net", country: "PL", riskScore: 52, documents: docs("verified", "pending"), status: "in_review", assigneeId: "u-dana", assigneeName: "Dana Osei", createdAt: ago(31), updatedAt: ago(4) },
      { customerName: "Sergei Volkov", customerEmail: "s.volkov@example.net", country: "CY", riskScore: 93, documents: docs("verified", "failed", "failed"), status: "escalated", assigneeId: "u-marcus", assigneeName: "Marcus Reyes", decisionReason: "Address proof failed twice and the account is funded from a sanctioned-adjacent jurisdiction.", createdAt: ago(50), updatedAt: ago(6) },
      { customerName: "Chen Wei", customerEmail: "chen.wei@example.net", country: "HK", riskScore: 81, documents: docs("verified", "verified", "pending"), status: "escalated", assigneeId: "u-marcus", assigneeName: "Marcus Reyes", decisionReason: "Risk score above the reviewer limit; documents otherwise in order.", createdAt: ago(55), updatedAt: ago(8) },
      { customerName: "Lucas Moreau", customerEmail: "lucas.m@example.net", country: "FR", riskScore: 19, documents: docs("verified", "verified", "verified"), status: "approved", assigneeId: "u-dana", assigneeName: "Dana Osei", decisionReason: "All documents verified, low risk, matches sanctions screening negative.", createdAt: ago(72), updatedAt: ago(48) },
      { customerName: "Ibrahim Diallo", customerEmail: "i.diallo@example.net", country: "SN", riskScore: 76, documents: docs("failed", "pending"), status: "rejected", assigneeId: "u-marcus", assigneeName: "Marcus Reyes", decisionReason: "Passport failed authenticity check; customer did not respond to re-submission request.", createdAt: ago(96), updatedAt: ago(60) },
    ])
    .run();
}
