import { mkdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { CommandRunner } from "./command-runner.ts";

export interface CheckoutRepositoryInput {
  deploymentId: string;
  gitToken?: string;
  repoUrl: string;
  gitRef: string;
  tmpBaseDir: string;
  rootDirectory: string | null;
  commandRunner: CommandRunner;
  onStdout?: (line: string) => Promise<void> | void;
  onStderr?: (line: string) => Promise<void> | void;
}

export interface CheckoutRepositoryResult {
  workspaceDir: string;
  buildDir: string;
  commitSha: string;
}

function sanitizeRootDirectory(rootDirectory: string): string {
  const normalized = rootDirectory.replace(/^\/+/, "");

  if (normalized.includes("\0")) {
    throw new Error("Invalid rootDirectory");
  }

  return normalized;
}

function quote(value: string): string { return "'" + value.replaceAll("'", "'\\''") + "'"; }

export async function checkoutRepository(
  input: CheckoutRepositoryInput,
): Promise<CheckoutRepositoryResult> {
  const repo = new URL(input.repoUrl);
  if (repo.protocol !== "https:" || repo.hostname !== "github.com" || repo.username || repo.password || repo.search || repo.hash || !/^\/[\w.-]+\/[\w.-]+(?:\.git)?$/.test(repo.pathname)) {
    throw new Error("Only HTTPS GitHub repository URLs are supported");
  }
  if (!input.gitRef || input.gitRef.startsWith("-") || /[\x00-\x20~^:?*\[\\]/.test(input.gitRef)) throw new Error("Invalid git ref");
  const workspaceDir = path.join(
    input.tmpBaseDir,
    `${input.deploymentId}-${crypto.randomUUID()}`,
  );

  await mkdir(input.tmpBaseDir, { recursive: true });

  await input.commandRunner.run({
    command: `git -c core.hooksPath=/dev/null clone --no-recurse-submodules -- ${quote(input.repoUrl)} ${quote(workspaceDir)}`,
    cwd: input.tmpBaseDir,
    timeoutMs: 120_000,
    env: input.gitToken ? { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader", GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${input.gitToken}`).toString("base64")}` } : {},
    onStdout: input.onStdout,
    onStderr: input.onStderr,
  });

  await input.commandRunner.run({
    command: `git -c core.hooksPath=/dev/null checkout --detach ${quote(input.gitRef)}`,
    cwd: workspaceDir,
    timeoutMs: 120_000,
    env: input.gitToken ? { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "http.https://github.com/.extraheader", GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${input.gitToken}`).toString("base64")}` } : {},
    onStdout: input.onStdout,
    onStderr: input.onStderr,
  });

  const revision = Bun.spawn(["git", "rev-parse", "HEAD"], {
    cwd: workspaceDir,
    env: { PATH: process.env.PATH, HOME: workspaceDir, GIT_CONFIG_NOSYSTEM: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });

  const commitSha = (await new Response(revision.stdout).text()).trim();
  const exitCode = await revision.exited;

  if (exitCode !== 0 || !commitSha) {
    throw new Error("Failed to resolve commit SHA");
  }

  let buildDir = workspaceDir;

  if (input.rootDirectory) {
    const normalized = sanitizeRootDirectory(input.rootDirectory);
    buildDir = path.resolve(workspaceDir, normalized);

    if (!buildDir.startsWith(`${workspaceDir}${path.sep}`) && buildDir !== workspaceDir) {
      throw new Error("rootDirectory escapes the repository checkout");
    }

    buildDir = await realpath(buildDir);
    if (!buildDir.startsWith(`${workspaceDir}${path.sep}`) && buildDir !== workspaceDir) throw new Error("rootDirectory symlink escapes checkout");
    const details = await stat(buildDir).catch(() => null);

    if (!details || !details.isDirectory()) {
      throw new Error(`rootDirectory does not exist: ${input.rootDirectory}`);
    }
  }

  return { workspaceDir, buildDir, commitSha };
}
