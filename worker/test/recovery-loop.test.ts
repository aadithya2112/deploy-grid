import "./setup.ts";
import { describe, expect, test } from "bun:test";
import type { BuildJob, LogStream } from "../src/db/schema.ts";
import { RecoveryLoop } from "../src/services/recovery-loop.ts";

class InMemoryLogRepository {
  entries: Array<{
    deploymentId: string;
    stream: LogStream;
    sequence: number;
    message: string;
  }> = [];

  async getNextSequence(deploymentId: string): Promise<number> {
    const sequences = this.entries
      .filter((entry) => entry.deploymentId === deploymentId)
      .map((entry) => entry.sequence);

    return sequences.length === 0 ? 1 : Math.max(...sequences) + 1;
  }

  async append(entry: {
    deploymentId: string;
    stream: LogStream;
    sequence: number;
    message: string;
  }): Promise<unknown> {
    this.entries.push(entry);
    return entry;
  }
}

describe("RecoveryLoop", () => {
  test("re-enqueues recoverable jobs and permanently fails expired jobs over the attempt limit", async () => {
    const enqueuedMessages: Array<{ buildJobId: string; deploymentId: string }> = [];
    const failedJobs: Array<{ buildJobId: string; deploymentId: string; errorMessage: string }> = [];
    const logRepository = new InMemoryLogRepository();

    const expiredJob: BuildJob = {
      id: "job-expired",
      deploymentId: "deployment-expired",
      status: "running",
      claimedBy: "worker-a",
      leaseUntil: new Date(Date.now() - 10_000),
      attempts: 3,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const recoveryLoop = new RecoveryLoop({
      buildJobRepository: {
        async listRecoveryCandidates() {
          return [
            {
              buildJobId: "job-requeue",
              deploymentId: "deployment-requeue",
              projectId: "project-1",
              repoUrl: "https://example.com/repo.git",
              gitRef: "main",
              rootDirectory: null,
              installCommand: null,
              buildCommand: null,
              outputDirectory: null,
              attempts: 1,
              status: "queued" as const,
            },
          ];
        },
        async listExceededRunningJobs() {
          return [expiredJob];
        },
      },
      workerStateRepository: {
        async failExpiredRunningJob(input: {
          deploymentId: string;
          buildJobId: string;
          errorMessage: string;
          now: Date;
        }) {
          failedJobs.push(input);
        },
      },
      deploymentLogRepository: logRepository,
      queue: {
        async enqueue(message) {
          enqueuedMessages.push({
            buildJobId: message.buildJobId,
            deploymentId: message.deploymentId,
          });
        },
      },
      now: () => new Date(),
    });

    await recoveryLoop.runOnce();

    expect(enqueuedMessages).toEqual([
      {
        buildJobId: "job-requeue",
        deploymentId: "deployment-requeue",
      },
    ]);
    expect(failedJobs).toHaveLength(1);
    expect(failedJobs[0]).toMatchObject({
      buildJobId: "job-expired",
      deploymentId: "deployment-expired",
      errorMessage: "Build job exceeded the max attempts (3)",
    });
    expect(logRepository.entries.map((entry) => entry.message)).toContain(
      "deployment marked failed: Build job exceeded the max attempts (3)",
    );
  });
});
