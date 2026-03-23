import type { ProjectEnvVar } from "../db/schema.ts";
import { decryptProjectEnvValue } from "../infrastructure/project-env-crypto.ts";

export async function resolveBuildEnvironment(
  envVars: ProjectEnvVar[],
  target: "preview" | "production" = "preview",
): Promise<Record<string, string>> {
  const resolved = new Map<string, string>();

  for (const envVar of envVars.filter((item) => item.target === "all")) {
    resolved.set(envVar.key, await decryptProjectEnvValue(envVar.value));
  }

  for (const envVar of envVars.filter((item) => item.target === target)) {
    resolved.set(envVar.key, await decryptProjectEnvValue(envVar.value));
  }

  return Object.fromEntries(resolved);
}
