import { cp, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { DockerCommandRunner } from "../src/build/docker-command-runner.ts";
import { detectFramework } from "../src/build/framework.ts";
import { resolveArtifactDirectory } from "../src/build/artifact-detection.ts";
import { listDirectoryFiles } from "../src/build/fs.ts";
const runner = new DockerCommandRunner();
for (const name of ["react-vite", "vue-vite", "astro", "next-static"]) {
  const root = await mkdtemp(path.join(os.tmpdir(), `dg-${name}-`));
  try {
    await cp(path.resolve(import.meta.dir, "../../fixtures", name), root, {
      recursive: true,
      filter: (source) => !/(node_modules|\/dist|\/out|\.next)/.test(source),
    });
    const plan = await detectFramework(root);
    const start = performance.now();
    await runner.run({
      cwd: root,
      command: "bun install && bun run build",
      timeoutMs: 300_000,
      onStdout: (line) => console.log(`[${name}] ${line}`),
      onStderr: (line) => console.error(`[${name}] ${line}`),
    });
    const directory = await resolveArtifactDirectory(
      root,
      plan.outputDirectory,
    );
    const files = await listDirectoryFiles(directory);
    if (!files.some((file) => file.relativePath === "index.html"))
      throw new Error(`${name}: missing index`);
    if (
      ["astro", "next-static"].includes(name) &&
      !files.some((file) =>
        /^about(?:\.html|\/index.html)$/.test(file.relativePath),
      )
    )
      throw new Error(`${name}: missing nested route`);
    console.log(
      JSON.stringify({
        framework: name,
        ms: Math.round(performance.now() - start),
        files: files.length,
        bytes: files.reduce((sum, file) => sum + file.contents.byteLength, 0),
      }),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
