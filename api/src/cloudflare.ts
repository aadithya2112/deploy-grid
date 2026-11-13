export default {
  async fetch(request: Request) {
    // Load request-dependent database/client setup inside the invocation scope.
    const [{ handleRequest }, { withDatabase }] = await Promise.all([
      import("./http-app.ts"),
      import("./infrastructure/database.ts"),
    ]);
    return withDatabase(() => handleRequest(request));
  },
  async scheduled() {
    const { wakeDeploymentWorkerAsync } =
      await import("./infrastructure/worker-wake.ts");
    await wakeDeploymentWorkerAsync();
  },
};
