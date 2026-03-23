import { readdir, readFile, rm } from "node:fs/promises";
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
): Promise<DirectoryFile[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files: DirectoryFile[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listDirectoryFiles(absolutePath, basePath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

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
