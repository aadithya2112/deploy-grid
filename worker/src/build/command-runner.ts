export interface RunCommandOptions {
  command: string;
  cwd: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  onStdout?: (line: string) => Promise<void> | void;
  onStderr?: (line: string) => Promise<void> | void;
}

export interface RunCommandResult {
  exitCode: number;
}

export interface CommandRunner {
  run(options: RunCommandOptions): Promise<RunCommandResult>;
}

export class CommandExecutionError extends Error {
  constructor(
    readonly command: string,
    readonly exitCode: number,
    readonly output: string,
  ) {
    super(
      output
        ? `Command failed with exit code ${exitCode}: ${command}\n${output}`
        : `Command failed with exit code ${exitCode}: ${command}`,
    );
    this.name = "CommandExecutionError";
  }
}

async function streamLines(
  stream: ReadableStream<Uint8Array> | null,
  onLine?: (line: string) => Promise<void> | void,
  capturedLines?: string[],
): Promise<void> {
  if (!stream || !onLine) {
    return;
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const parsedLines = buffer.split(/\r?\n/);
      buffer = parsedLines.pop() ?? "";

      for (const line of parsedLines) {
        capturedLines?.push(line);
        if (capturedLines && capturedLines.length > 50) {
          capturedLines.shift();
        }
        await onLine(line);
      }
    }

    buffer += decoder.decode();

    if (buffer) {
      capturedLines?.push(buffer);
      if (capturedLines && capturedLines.length > 50) {
        capturedLines.shift();
      }
      await onLine(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}

export class BunCommandRunner implements CommandRunner {
  async run(options: RunCommandOptions): Promise<RunCommandResult> {
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const child = Bun.spawn(["sh", "-lc", options.command], {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...Bun.env,
        ...options.env,
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCodePromise = (async () => {
      const [exitCode] = await Promise.all([
        child.exited,
        streamLines(child.stdout, options.onStdout, stdoutLines),
        streamLines(child.stderr, options.onStderr, stderrLines),
      ]);

      return exitCode;
    })();

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    try {
      const exitCode =
        options.timeoutMs === undefined
          ? await exitCodePromise
          : await Promise.race([
              exitCodePromise,
              new Promise<never>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                  child.kill("SIGTERM");
                  reject(new Error(`Command timed out after ${options.timeoutMs}ms`));
                }, options.timeoutMs);
              }),
            ]);

      if (exitCode !== 0) {
        const output = [...stderrLines, ...stdoutLines].join("\n").trim();
        throw new CommandExecutionError(options.command, exitCode, output);
      }

      return { exitCode };
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}
