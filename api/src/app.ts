import { env } from "./config/env.ts";
import { handleRequest } from "./http-app.ts";
const server = Bun.serve({ port: env.port, fetch: handleRequest });
export default server;
