import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { DockerCommandRunner } from "../src/build/docker-command-runner.ts";

if (process.platform !== "linux")
  throw new Error("Network smoke requires the hosted Linux runner");
const expected = process.argv[2];
if (!["reachable", "blocked"].includes(expected ?? ""))
  throw new Error("Expected reachable or blocked argument");
const inspect = Bun.spawn(
  [
    "docker",
    "network",
    "inspect",
    "bridge",
    "--format",
    "{{(index .IPAM.Config 0).Gateway}}",
  ],
  { stdout: "pipe", stderr: "pipe" },
);
const gateway = (await new Response(inspect.stdout).text()).trim();
if ((await inspect.exited) !== 0 || !/^\d+\.\d+\.\d+\.\d+$/.test(gateway))
  throw new Error("Cannot inspect Docker gateway");
const server = Bun.serve({
  hostname: "0.0.0.0",
  port: 0,
  fetch: () => new Response("runner-sentinel"),
});
const root = await mkdtemp(path.join(os.tmpdir(), "dg-network-"));
try {
  await writeFile(
    path.join(root, "check.mjs"),
    `
    let reachable = false;
    try { const response = await fetch(process.env.HOST_TEST_URL,{signal:AbortSignal.timeout(3000)}); reachable = await response.text() === "runner-sentinel"; } catch {}
    if (reachable !== (process.env.EXPECTED === "reachable")) throw new Error("Unexpected host reachability: " + reachable);
  `,
  );
  await new DockerCommandRunner().run({
    cwd: root,
    command: "node check.mjs",
    env: {
      HOST_TEST_URL: `http://${gateway}:${server.port}`,
      EXPECTED: expected!,
    },
    timeoutMs: 10000,
  });
  console.log(`Runner network verified: host ${expected}`);
} finally {
  server.stop(true);
  await rm(root, { recursive: true, force: true });
}
