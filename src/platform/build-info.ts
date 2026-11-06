import { execSync } from "node:child_process";
import pkg from "../../package.json";

function resolveSha(): string {
  if (process.env.GIT_SHA) return process.env.GIT_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
}

export const buildInfo = {
  platformVersion: pkg.version as string,
  gitSha: resolveSha(),
  environment: (process.env.PLATFORM_ENV ?? "local") as "local" | "dev" | "staging" | "prod",
};
