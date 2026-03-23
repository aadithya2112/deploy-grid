import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import type { CommandRunner } from "./command-runner.ts";

export interface CheckoutRepositoryInput {
  deploymentId: string;
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

export async function checkoutRepository(
  input: CheckoutRepositoryInput,
): Promise<CheckoutRepositoryResult> {
  const workspaceDir = path.join(
    input.tmpBaseDir,
    `${input.deploymentId}-${crypto.randomUUID()}`,
  );

  await mkdir(input.tmpBaseDir, { recursive: true });

  await input.commandRunner.run({
    command: `git clone ${JSON.stringify(input.repoUrl)} ${JSON.stringify(workspaceDir)}`,
    cwd: input.tmpBaseDir,
    onStdout: input.onStdout,
    onStderr: input.onStderr,
  });

  await input.commandRunner.run({
    command: `git checkout ${JSON.stringify(input.gitRef)}`,
    cwd: workspaceDir,
    onStdout: input.onStdout,
    onStderr: input.onStderr,
  });

  const revision = Bun.spawn(["git", "rev-parse", "HEAD"], {
    cwd: workspaceDir,
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

    const details = await stat(buildDir).catch(() => null);

    if (!details || !details.isDirectory()) {
      throw new Error(`rootDirectory does not exist: ${input.rootDirectory}`);
    }
  }

  return { workspaceDir, buildDir, commitSha };
}
