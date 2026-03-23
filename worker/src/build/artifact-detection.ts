import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const defaultOutputDirectories = ["dist", "build"];

async function directoryExists(directoryPath: string): Promise<boolean> {
  try {
    const details = await stat(directoryPath);
    return details.isDirectory();
  } catch {
    return false;
  }
}

async function directoryHasFiles(directoryPath: string): Promise<boolean> {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile()) {
      return true;
    }

    if (entry.isDirectory()) {
      const nestedPath = path.join(directoryPath, entry.name);

      if (await directoryHasFiles(nestedPath)) {
        return true;
      }
    }
  }

  return false;
}

export async function resolveArtifactDirectory(
  buildDir: string,
  outputDirectory: string | null,
): Promise<string> {
  const configuredCandidate = outputDirectory
    ? path.resolve(buildDir, outputDirectory)
    : null;

  if (
    configuredCandidate &&
    !configuredCandidate.startsWith(`${buildDir}${path.sep}`) &&
    configuredCandidate !== buildDir
  ) {
    throw new Error("outputDirectory escapes the build directory");
  }

  const candidates = configuredCandidate
    ? [configuredCandidate]
    : defaultOutputDirectories.map((candidate) => path.join(buildDir, candidate));

  for (const candidate of candidates) {
    if (!(await directoryExists(candidate))) {
      continue;
    }

    if (!(await directoryHasFiles(candidate))) {
      continue;
    }

    return candidate;
  }

  throw new Error("Unable to locate a deployable output directory");
}
