import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { DockerCommandRunner } from "../src/build/docker-command-runner.ts";
const root = await mkdtemp(path.join(os.tmpdir(), "dg-isolation-"));
process.env.DEPLOY_GRID_ISOLATION_SENTINEL = "platform-only-secret";
const runner = new DockerCommandRunner();
try {
  await runner.run({
    cwd: root,
    command:
      'node -e \'const fs=require("fs"); if(process.env.DEPLOY_GRID_ISOLATION_SENTINEL) process.exit(1); if(fs.existsSync("/var/run/docker.sock")) process.exit(2); try { fs.writeFileSync("/etc/dg-test","bad"); process.exit(3) } catch {} fs.writeFileSync("result.txt",process.env.PUBLIC_VALUE)\'',
    env: { PUBLIC_VALUE: "ok" },
    timeoutMs: 10000,
  });
  assert.equal(await readFile(path.join(root, "result.txt"), "utf8"), "ok");
  await assert.rejects(
    runner.run({ cwd: root, command: "sleep 60", timeoutMs: 500 }),
    /time budget/,
  );
  console.log(
    "Isolation passed: supervisor secret absent, Docker socket absent, read-only root, project environment present, timeout terminates container.",
  );
} finally {
  delete process.env.DEPLOY_GRID_ISOLATION_SENTINEL;
  await rm(root, { recursive: true, force: true });
}
