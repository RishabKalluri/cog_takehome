import type { Db } from "@/platform/db/client";
import { refunds } from "./schema";

const ago = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();

export function seed(db: Db) {
  db.insert(refunds)
    .values([
      { orderId: "ORD-10482", customerName: "Aisha Rahman", customerEmail: "aisha.rahman@example.net", amountCents: 49_99, currency: "GBP", reason: "Item arrived damaged; customer sent photos.", status: "requested", createdBy: "u-omar", createdAt: ago(1), updatedAt: ago(1) },
      { orderId: "ORD-10477", customerName: "Tomás Herrera", customerEmail: "tomas.h@example.net", amountCents: 129_00, currency: "EUR", reason: "Duplicate charge on the same order.", status: "requested", createdBy: "u-omar", createdAt: ago(3), updatedAt: ago(3) },
      { orderId: "ORD-10469", customerName: "Grace Okonkwo", customerEmail: "grace.ok@example.net", amountCents: 1_250_00, currency: "USD", reason: "Order cancelled before shipment but payment was captured.", status: "requested", createdBy: "u-omar", createdAt: ago(6), updatedAt: ago(6) },
      { orderId: "ORD-10461", customerName: "Mei Lin", customerEmail: "mei.lin@example.net", amountCents: 500_00, currency: "USD", reason: "Service not delivered within the promised window.", status: "requested", createdBy: "u-omar", createdAt: ago(9), updatedAt: ago(9) },
      { orderId: "ORD-10455", customerName: "Jonas Lindqvist", customerEmail: "jonas.l@example.net", amountCents: 24_50, currency: "EUR", reason: "Wrong size shipped; replacement already sent.", status: "requested", createdBy: "u-omar", createdAt: ago(14), updatedAt: ago(14) },
      { orderId: "ORD-10440", customerName: "Daniel Brooks", customerEmail: "d.brooks@example.net", amountCents: 89_00, currency: "USD", reason: "Customer changed their mind within the 14-day window.", status: "approved", decidedById: "u-omar", decidedByName: "Omar Haddad", decisionNote: "Within returns policy.", createdBy: "u-omar", createdAt: ago(30), updatedAt: ago(20) },
      { orderId: "ORD-10431", customerName: "Fatima Al-Sayed", customerEmail: "fatima.as@example.net", amountCents: 2_400_00, currency: "USD", reason: "Enterprise plan billed twice after a failed card retry.", status: "approved", decidedById: "u-dana", decidedByName: "Dana Osei", decisionNote: "Confirmed double capture with the processor.", createdBy: "u-omar", createdAt: ago(48), updatedAt: ago(26) },
      { orderId: "ORD-10402", customerName: "Lucas Moreau", customerEmail: "lucas.m@example.net", amountCents: 15_00, currency: "EUR", reason: "Claims item never arrived.", status: "rejected", decidedById: "u-omar", decidedByName: "Omar Haddad", decisionNote: "Carrier shows signed delivery at the registered address.", createdBy: "u-omar", createdAt: ago(72), updatedAt: ago(60) },
      { orderId: "ORD-10388", customerName: "Nadia Kowalski", customerEmail: "nadia.k@example.net", amountCents: 310_00, currency: "GBP", reason: "Promo code was not applied at checkout.", status: "paid", decidedById: "u-omar", decidedByName: "Omar Haddad", decisionNote: null, paidAt: ago(90), createdBy: "u-omar", createdAt: ago(120), updatedAt: ago(90) },
    ])
    .run();
}
