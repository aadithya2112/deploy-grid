import { describe, expect, mock, test } from "bun:test";
import { WorkerService } from "../src/services/worker.ts";

describe("WorkerService", () => {
  test("processUntilIdle runs recovery and drains the queue", async () => {
    const jobs = [
      { buildJobId: "job-1", deploymentId: "deployment-1" },
      { buildJobId: "job-2", deploymentId: "deployment-2" },
    ];

    const pop = mock(async () => jobs.shift() ?? null);
    const process = mock(async () => {});
    const runOnce = mock(async () => {});

    const service = new WorkerService(
      { pop } as never,
      { process } as never,
      { runOnce } as never,
    );

    const result = await service.processUntilIdle();

    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(pop).toHaveBeenCalledTimes(3);
    expect(process).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ processed: 2 });
  });
});
