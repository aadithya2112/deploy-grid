import { readdir, readFile, rm, lstat } from "node:fs/promises";
import path from "node:path";

export interface DirectoryFile {
  absolutePath: string;
  relativePath: string;
  contents: Uint8Array;
  contentType: string;
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

export async function listDirectoryFiles(
  directoryPath: string,
  basePath = directoryPath,
  budget = { bytes: 0, files: 0 },
): Promise<DirectoryFile[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files: DirectoryFile[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listDirectoryFiles(absolutePath, basePath, budget)));
      continue;
    }

    if (entry.isSymbolicLink()) throw new Error("Symlinks are not allowed in deployment artifacts");
    if (!entry.isFile()) continue;

    const metadata = await lstat(absolutePath);
    budget.bytes += metadata.size; budget.files += 1;
    if (metadata.nlink !== 1 || metadata.size > 25 * 1024 * 1024 || budget.bytes > 100 * 1024 * 1024 || budget.files > 10000) throw new Error("Artifact size/file limit exceeded, or hard link detected");
    files.push({
      absolutePath,
      relativePath: normalizeRelativePath(path.relative(basePath, absolutePath)),
      contents: await readFile(absolutePath),
      contentType: Bun.file(absolutePath).type || "application/octet-stream",
    });
  }

  return files;
}

export async function cleanupDirectory(directoryPath: string): Promise<void> {
  await rm(directoryPath, { recursive: true, force: true });
}
