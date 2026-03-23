import { access } from "node:fs/promises";
import path from "node:path";

export type PackageManager = "bun" | "pnpm" | "yarn" | "npm";

export interface BuildCommandOverrides {
  installCommand: string | null;
  buildCommand: string | null;
  outputDirectory: string | null;
}

export interface ResolvedBuildCommands {
  packageManager: PackageManager;
  installCommand: string;
  buildCommand: string;
  outputDirectory: string | null;
}

const lockfileOrder: Array<{ file: string; packageManager: PackageManager }> = [
  { file: "bun.lock", packageManager: "bun" },
  { file: "bun.lockb", packageManager: "bun" },
  { file: "pnpm-lock.yaml", packageManager: "pnpm" },
  { file: "yarn.lock", packageManager: "yarn" },
  { file: "package-lock.json", packageManager: "npm" },
];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function detectPackageManager(buildDir: string): Promise<PackageManager> {
  for (const candidate of lockfileOrder) {
    if (await fileExists(path.join(buildDir, candidate.file))) {
      return candidate.packageManager;
    }
  }

  return "bun";
}

function defaultInstallCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case "bun":
      return "bun install";
    case "pnpm":
      return "pnpm install --frozen-lockfile";
    case "yarn":
      return "yarn install --frozen-lockfile";
    case "npm":
      return "npm ci";
  }
}

function defaultBuildCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case "bun":
      return "bun run build";
    case "pnpm":
      return "pnpm build";
    case "yarn":
      return "yarn build";
    case "npm":
      return "npm run build";
  }
}

export async function resolveBuildCommands(
  buildDir: string,
  overrides: BuildCommandOverrides,
): Promise<ResolvedBuildCommands> {
  const packageManager = await detectPackageManager(buildDir);

  return {
    packageManager,
    installCommand: overrides.installCommand?.trim() || defaultInstallCommand(packageManager),
    buildCommand: overrides.buildCommand?.trim() || defaultBuildCommand(packageManager),
    outputDirectory: overrides.outputDirectory?.trim() || null,
  };
}
