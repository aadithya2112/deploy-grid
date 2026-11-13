import path from "node:path";
import { createHash } from "node:crypto";
import { readFile, mkdir } from "node:fs/promises";
import {
  CommandExecutionError,
  type CommandRunner,
  type RunCommandOptions,
} from "./command-runner.ts";

export function sandboxArgs(
  options: RunCommandOptions,
  image: string,
  name: string,
  cache?: string,
): string[] {
  if (process.getuid?.() === 0)
    throw new Error("Run the build supervisor as an unprivileged user");
  const root = options.workspaceDir ?? options.cwd;
  const relative = path.relative(root, options.cwd);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("Build cwd escapes workspace");
  const args = [
    "run",
    "--rm",
    "--name",
    name,
    "--init",
    "--read-only",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--pids-limit=256",
    "--memory=2g",
    "--memory-swap=2g",
    "--cpus=2",
    "--user",
    `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    "--tmpfs",
    "/tmp:rw,nosuid,nodev,size=536870912,mode=1777",
    "--mount",
    `type=bind,src=${root},dst=/workspace`,
    "--workdir",
    path.posix.join("/workspace", relative),
    "--env",
    "HOME=/tmp",
    "--env",
    "CI=true",
    "--env",
    "NEXT_TELEMETRY_DISABLED=1",
    "--env",
    "ASTRO_TELEMETRY_DISABLED=1",
  ];
  if (cache)
    args.push(
      "--mount",
      `type=bind,src=${cache},dst=/cache`,
      "--env",
      "npm_config_cache=/cache/npm",
      "--env",
      "BUN_INSTALL_CACHE_DIR=/cache/bun",
      "--env",
      "YARN_CACHE_FOLDER=/cache/yarn",
    );
  for (const key of Object.keys(options.env ?? {})) {
    if (/^(DOCKER_|LD_|DYLD_|PATH$|HOME$|BASH_ENV$|ENV$)/.test(key))
      throw new Error("Reserved environment key");
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
      throw new Error("Invalid environment key");
    // Values travel through the Docker client's environment, never argv/logs.
    args.push("--env", key);
  }
  return [...args, image, "sh", "-c", options.command];
}

export class DockerCommandRunner implements CommandRunner {
  constructor(
    private readonly image = process.env.BUILD_IMAGE ??
      "deploy-grid-builder:local",
  ) {}
  async run(options: RunCommandOptions): Promise<{ exitCode: number }> {
    const name = `dg-${crypto.randomUUID()}`;
    let cache: string | undefined;
    if (options.cacheKey) {
      const hash = createHash("sha256")
        .update(options.cacheKey)
        .update(this.image);
      for (const file of [
        "bun.lock",
        "bun.lockb",
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
      ]) {
        const data = await readFile(path.join(options.cwd, file)).catch(
          () => null,
        );
        if (data) hash.update(file).update(data);
      }
      cache = path.join(
        process.env.WORKER_TMP_DIR ?? "/tmp/deploy-grid",
        "cache",
        hash.digest("hex"),
      );
      await mkdir(cache, { recursive: true });
    }
    const args = sandboxArgs(options, this.image, name, cache);
    const child = Bun.spawn(["docker", ...args], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME, ...options.env },
      stdout: "pipe",
      stderr: "pipe",
    });
    let timedOut = false;
    const kill = async () => {
      const cleanup = Bun.spawn(["docker", "rm", "-f", name], {
        stdout: "ignore",
        stderr: "ignore",
      });
      await cleanup.exited;
      child.kill();
    };
    const timer = setTimeout(() => {
      timedOut = true;
      void kill();
    }, options.timeoutMs ?? 900_000);
    const abort = () => {
      void kill();
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    const tail: string[] = [];
    const stream = async (
      source: ReadableStream<Uint8Array>,
      write?: (line: string) => Promise<void> | void,
    ) => {
      const decoder = new TextDecoder();
      let pending = "";
      for await (const chunk of source) {
        pending += decoder.decode(chunk, { stream: true });
        const lines = pending.split(/\r?\n/);
        pending = (lines.pop() ?? "").slice(-8_000);
        for (const line of lines) {
          tail.push(line.slice(0, 8_000));
          if (tail.length > 20) tail.shift();
          await write?.(line.slice(0, 8_000));
        }
      }
      if (pending) await write?.(pending);
    };
    try {
      const [exitCode] = await Promise.all([
        child.exited,
        stream(child.stdout, options.onStdout),
        stream(child.stderr, options.onStderr),
      ]);
      if (options.signal?.aborted)
        throw new Error("Build cancelled or lease lost");
      if (timedOut) throw new Error("Build exceeded its time budget");
      if (exitCode !== 0)
        throw new CommandExecutionError(
          options.command,
          exitCode,
          tail.join("\n"),
        );
      return { exitCode };
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      await kill();
    }
  }
}
