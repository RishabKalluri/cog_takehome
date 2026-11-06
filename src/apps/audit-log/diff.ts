/** Top-level key diff between the `before` and `after` JSON of an audit row. */
export type DiffEntry = { key: string; kind: "added" | "removed" | "changed" | "same"; before?: unknown; after?: unknown };

export function parseJson(s: string | null | undefined): unknown {
  if (s == null) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function diffObjects(before: unknown, after: unknown): DiffEntry[] {
  if (!isRecord(before) || !isRecord(after)) return [];
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return keys.map((key) => {
    const inB = key in before;
    const inA = key in after;
    if (inB && !inA) return { key, kind: "removed", before: before[key] };
    if (!inB && inA) return { key, kind: "added", after: after[key] };
    const same = JSON.stringify(before[key]) === JSON.stringify(after[key]);
    return { key, kind: same ? "same" : "changed", before: before[key], after: after[key] };
  });
}

export function changedKeys(before: unknown, after: unknown): Set<string> {
  return new Set(diffObjects(before, after).filter((d) => d.kind !== "same").map((d) => d.key));
}
