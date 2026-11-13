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
  plan: { framework: string; routing: "spa" | "static" } = {
    framework: "static",
    routing: "static",
  },
  beforeUpload?: (usage: { bytes: number; files: number }) => Promise<void>,
): Promise<string> {
  const files = await listDirectoryFiles(directoryPath);

  if (files.length === 0) {
    throw new Error("Artifact directory is empty");
  }

  if (!files.some((file) => file.relativePath === "index.html"))
    throw new Error("Static output must contain index.html");
  if (
    files.length > 10_000 ||
    files.reduce((sum, file) => sum + file.contents.byteLength, 0) >
      100 * 1024 * 1024
  )
    throw new Error("Artifact limit exceeded (10,000 files / 100 MiB)");

  await beforeUpload?.({
    files: files.length,
    bytes: files.reduce((sum, file) => sum + file.contents.byteLength, 0),
  });

  for (const file of files) {
    if (
      file.relativePath === "_deploy-grid.json" ||
      file.relativePath.split("/").some((part) => part.startsWith("."))
    )
      throw new Error("Reserved or hidden artifact path");
    const sanitizedRelativePath = sanitizeArtifactPath(file.relativePath);
    const key = `deployments/${deploymentId}/${sanitizedRelativePath}`;

    await artifactStorage.uploadObject({
      key,
      body: file.contents,
      contentType: file.contentType,
    });
  }

  // Publish the manifest only after every file has uploaded successfully.
  await artifactStorage.uploadObject({
    key: `deployments/${deploymentId}/_deploy-grid.json`,
    body: new TextEncoder().encode(
      JSON.stringify({
        version: 1,
        ...plan,
        files: files.length,
        bytes: files.reduce((sum, f) => sum + f.contents.byteLength, 0),
      }),
    ),
    contentType: "application/json",
  });
  return artifactStorage.buildArtifactUrl(deploymentId);
}
