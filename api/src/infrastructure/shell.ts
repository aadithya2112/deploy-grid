export interface ShellRunOptions {
  cwd?: string;
  env?: Record<string, string>;
}

export class Shell {
  static async run(
    command: string,
    args: string[] = [],
    options: ShellRunOptions = {},
  ): Promise<void> {
    const process = Bun.spawn({
      cmd: [command, ...args],
      cwd: options.cwd,
      env: {
        ...Bun.env,
        ...options.env,
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    const [exitCode, stdout, stderr] = await Promise.all([
      process.exited,
      process.stdout ? new Response(process.stdout).text() : "",
      process.stderr ? new Response(process.stderr).text() : "",
    ]);

    if (exitCode !== 0) {
      const details = stderr.trim() || stdout.trim() || "unknown error";
      throw new Error(
        `Command failed: ${command} ${args.join(" ")}\n${details}`,
      );
    }
  }
}
