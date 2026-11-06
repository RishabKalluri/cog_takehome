export const ENVIRONMENTS = ["dev", "staging", "prod"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

const parse = (v: string) => v.split(".").map((n) => Number.parseInt(n, 10) || 0) as [number, number, number];

/** -1 if a < b, 0 if equal, 1 if a > b (semver, numeric parts only). */
export function compareVersions(a: string, b: string): number {
  const [pa, pb] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  return 0;
}

/** The version "one step before" v, used only to fabricate plausible seed history. */
export function previousVersion(v: string): string {
  let [major, minor, patch] = parse(v);
  if (patch > 0) patch--;
  else if (minor > 0) {
    minor--;
    patch = 0;
  } else if (major > 0) {
    major--;
    minor = 9;
    patch = 0;
  }
  return `${major}.${minor}.${patch}`;
}

/** Deterministic fake 7-char git SHA for seed rows. */
export function fakeSha(seed: string): string {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h.toString(16).padStart(8, "0").slice(0, 7);
}

export const shortSha = (sha: string) => sha.slice(0, 7);
