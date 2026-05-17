import { describe, expect, mock, test } from "bun:test";

describe("wakeDeploymentWorker", () => {
  test("posts to the configured worker wake URL with the shared token header", async () => {
    mock.module("../config/env.ts", () => ({
      env: {
        workerWakeUrl: "https://worker.example.com/internal/process",
        workerWakeSecret: "wake-secret",
      },
    }));

    const fetchMock = mock(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("metadata.google.internal")) {
        throw new Error("metadata unavailable in tests");
      }

      return new Response(JSON.stringify({ status: "accepted" }), { status: 202 });
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const { wakeDeploymentWorkerAsync } = await import("./worker-wake.ts");
      await wakeDeploymentWorkerAsync();

      const wakeCalls = fetchMock.mock.calls.filter(([input]) => {
        const url = typeof input === "string" ? input : input.toString();
        return url.includes("worker.example.com");
      });

      expect(wakeCalls.length).toBeGreaterThanOrEqual(1);
      const [, init] = wakeCalls.at(-1) as [string, RequestInit];
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>)["X-Worker-Wake-Token"]).toBe(
        "wake-secret",
      );
    } finally {
      globalThis.fetch = originalFetch;
      mock.restore();
    }
  });

  test("does not call the worker when WORKER_WAKE_URL is unset", async () => {
    mock.module("../config/env.ts", () => ({
      env: {
        workerWakeUrl: null,
        workerWakeSecret: null,
      },
    }));

    const fetchMock = mock(async () => new Response(null, { status: 200 }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const { wakeDeploymentWorkerAsync } = await import("./worker-wake.ts");
      await wakeDeploymentWorkerAsync();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      mock.restore();
    }
  });
});
