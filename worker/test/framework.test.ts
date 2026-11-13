import { expect, test } from "bun:test";
import { mkdtemp, writeFile, rm, mkdir, symlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { detectFramework } from "../src/build/framework.ts";
import { sandboxArgs } from "../src/build/docker-command-runner.ts";
import { uploadArtifactDirectory } from "../src/services/artifact-upload.ts";

test("detects supported frameworks and rejects Next SSR without executing configuration", async () => {
 const root = await mkdtemp(path.join(os.tmpdir(), "dg-adapter-"));
 try {
  for (const [deps, framework] of [[{ vite: "1", react: "1" }, "react-vite"], [{ vite: "1", vue: "1" }, "vue-vite"], [{ astro: "1" }, "astro"]] as const) {
   await writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies: deps }));
   expect((await detectFramework(root)).framework).toBe(framework);
  }
  await writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies: { next: "16" } }));
  await expect(detectFramework(root)).rejects.toThrow("output:");
  await writeFile(path.join(root, "next.config.mjs"), 'throw new Error("never execute me"); export default { output: "export" };');
  expect((await detectFramework(root)).outputDirectory).toBe("out");
 } finally { await rm(root, { recursive: true, force: true }); }
});
test("sandbox never mounts infrastructure credentials and rejects Docker control variables", () => {
 const args = sandboxArgs({ command: "npm run build", cwd: "/tmp/repo/app", workspaceDir: "/tmp/repo", env: { PUBLIC_COLOR: "blue" } }, "image", "name");
 expect(args).toContain("--read-only"); expect(args).toContain("--cap-drop=ALL");
 expect(args).not.toContain("blue"); expect(args.join(" ")).not.toContain("docker.sock");
 expect(() => sandboxArgs({ command: "x", cwd: "/tmp", env: { DOCKER_HOST: "evil" } }, "image", "name")).toThrow("Reserved");
});
test("artifact manifest is published last, paths are isolated, symlinks fail", async () => {
 const root = await mkdtemp(path.join(os.tmpdir(), "dg-upload-")); const keys: string[] = [];
 const store = { uploadObject: async (input: { key: string }) => { keys.push(input.key); }, buildArtifactUrl: () => "https://example.test" };
 try {
  await mkdir(path.join(root, "assets")); await writeFile(path.join(root, "index.html"), "hi"); await writeFile(path.join(root, "assets/app.js"), "hi");
  await uploadArtifactDirectory(store, "deploy/attempt", root);
  expect(keys.every(key => key.startsWith("deployments/deploy/attempt/"))).toBe(true);
  expect(keys.at(-1)).toEndWith("_deploy-grid.json");
  await symlink("/etc/passwd", path.join(root, "leak"));
  await expect(uploadArtifactDirectory(store, "deploy/attempt", root)).rejects.toThrow("Symlinks");
 } finally { await rm(root, { recursive: true, force: true }); }
});
