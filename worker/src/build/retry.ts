import { setTimeout as sleep } from "node:timers/promises";
import type { CommandRunner, RunCommandOptions, RunCommandResult } from "./command-runner.ts";

const transientErrorPatterns = [
  /\beconnreset\b/i,
  /\betimedout\b/i,
  /\beai_again\b/i,
  /\bnetwork\b/i,
  /\bfetch failed\b/i,
  /\btemporary failure\b/i,
  /\b503\b/,
  /\b502\b/,
  /\b504\b/,
  /\b429\b/,
  /\bconnection reset\b/i,
];

export interface RetryCommandOptions extends RunCommandOptions {
  retryLimit: number;
  retryDelayMs: number;
  onRetry?: (attempt: number, error: Error) => Promise<void> | void;
}

export function isTransientCommandError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }

  return transientErrorPatterns.some((pattern) => pattern.test(error.message));
}

export async function runCommandWithRetry(
  commandRunner: CommandRunner,
  options: RetryCommandOptions,
): Promise<RunCommandResult> {
  let attempt = 1;

  while (true) {
    try {
      return await commandRunner.run(options);
    } catch (error) {
      if (!(error instanceof Error) || attempt >= options.retryLimit || !isTransientCommandError(error)) {
        throw error;
      }

      attempt += 1;
      await options.onRetry?.(attempt, error);
      await sleep(options.retryDelayMs);
    }
  }
}
