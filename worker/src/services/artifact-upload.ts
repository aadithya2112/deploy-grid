import path from "node:path";
import { listDirectoryFiles } from "../build/fs.ts";
import type { ArtifactStorageLike } from "../infrastructure/r2.ts";

function sanitizeArtifactPath(relativePath: string): string {
  const normalized = path.posix.normalize(relativePath.replace(/\\/g, "/"));

  if (normalized.startsWith("../") || normalized === "..") {
    throw new Error("Artifact path escapes output directory");
  }

  return normalized.replace(/^\/+/, "");
}

export async function uploadArtifactDirectory(
  artifactStorage: ArtifactStorageLike,
  deploymentId: string,
  directoryPath: string,
): Promise<string> {
  const files = await listDirectoryFiles(directoryPath);

  if (files.length === 0) {
    throw new Error("Artifact directory is empty");
  }

  for (const file of files) {
    const key = `deployments/${deploymentId}/${sanitizeArtifactPath(file.relativePath)}`;

    await artifactStorage.uploadObject({
      key,
      body: file.contents,
      contentType: file.contentType,
    });
  }

  return artifactStorage.buildArtifactUrl(deploymentId);
}
