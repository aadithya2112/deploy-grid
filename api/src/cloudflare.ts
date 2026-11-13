import { handleRequest } from "./http-app.ts";
import { withDatabase } from "./infrastructure/database.ts";
import { wakeDeploymentWorkerAsync } from "./infrastructure/worker-wake.ts";
export default {
  fetch(request: Request) { return withDatabase(() => handleRequest(request)); },
  async scheduled() { await wakeDeploymentWorkerAsync(); },
};
