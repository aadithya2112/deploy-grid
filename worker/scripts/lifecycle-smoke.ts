import assert from "node:assert/strict";
await import("../test/setup.ts");
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55432/deploy_grid_test";
if (
  !["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  )
)
  throw new Error("Lifecycle smoke tests require a local database");
const { sql } = await import("../src/infrastructure/database.ts");
const { WorkerStateRepository } =
  await import("../src/repositories/worker-state.repository.ts");
const { maintainArtifacts } = await import("../src/services/maintenance.ts");
const state = new WorkerStateRepository();
const projectId = crypto.randomUUID();
await sql`insert into projects(id,clerk_user_id,slug,name,repo_url) values (${projectId},'lifecycle-smoke',${projectId},'lifecycle','https://github.com/acme/lifecycle')`;
async function build() {
  const id = crypto.randomUUID();
  const job = crypto.randomUUID();
  await sql`insert into deployments(id,project_id,status,git_ref) values (${id},${projectId},'building','main')`;
  await sql`insert into build_jobs(id,deployment_id,status,claimed_by,lease_until) values (${job},${id},'running','current-worker',now()+interval '1 minute')`;
  await sql`insert into deployment_details(deployment_id,pull_request,expires_at) values (${id},1,now()-interval '1 day')`;
  return {
    deploymentId: id,
    buildJobId: job,
    claimedBy: "current-worker",
    commitSha: "a".repeat(40),
    artifactUrl: "https://preview.test",
    now: new Date(),
    artifactPrefix: `deployments/${id}/attempt`,
    framework: "react-vite",
    routing: "spa" as const,
    metrics: { totalMs: 123 },
  };
}
try {
  const good = await build();
  const previousBudget = process.env.MAX_ARTIFACT_STORAGE_BYTES;
  const used = Number(
    (
      await sql`select coalesce(sum(artifact_bytes),0)::text as bytes from deployment_details where purged_at is null`
    )[0]?.bytes,
  );
  process.env.MAX_ARTIFACT_STORAGE_BYTES = String(used + 100);
  try {
    const reservations = await Promise.allSettled([
      state.reserveArtifacts(good.deploymentId, 60),
      state.reserveArtifacts(good.deploymentId, 60),
    ]);
    assert.equal(
      reservations.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      Number(
        (
          await sql`select artifact_bytes from deployment_details where deployment_id=${good.deploymentId}`
        )[0]?.artifact_bytes,
      ),
      60,
    );
  } finally {
    if (previousBudget === undefined)
      delete process.env.MAX_ARTIFACT_STORAGE_BYTES;
    else process.env.MAX_ARTIFACT_STORAGE_BYTES = previousBudget;
  }
  await state.finalizeSuccess(good);
  assert.equal(
    (await sql`select status from deployments where id=${good.deploymentId}`)[0]
      ?.status,
    "ready",
  );
  const cancelled = await build();
  await sql`update deployments set status='cancelled' where id=${cancelled.deploymentId}`;
  await sql`update build_jobs set status='failed',lease_until=null where id=${cancelled.buildJobId}`;
  await assert.rejects(state.finalizeSuccess(cancelled), /Lease lost/);
  assert.equal(
    (
      await sql`select status from deployments where id=${cancelled.deploymentId}`
    )[0]?.status,
    "cancelled",
  );
  const stale = await build();
  await sql`update build_jobs set claimed_by='new-worker' where id=${stale.buildJobId}`;
  await assert.rejects(state.finalizeSuccess(stale), /Lease lost/);
  await state.finalizeFailure({ ...stale, errorMessage: "old failure" });
  assert.equal(
    (
      await sql`select status from deployments where id=${stale.deploymentId}`
    )[0]?.status,
    "building",
  );
  await sql`insert into project_releases(project_id,deployment_id) values (${projectId},${good.deploymentId})`;
  const deleted: string[] = [];
  await maintainArtifacts({
    deletePrefix: async (prefix) => {
      deleted.push(prefix);
    },
  });
  assert(!deleted.includes(`deployments/${good.deploymentId}/`));
  assert(deleted.includes(`deployments/${cancelled.deploymentId}/`));
  assert(
    (
      await sql`select purged_at from deployment_details where deployment_id=${cancelled.deploymentId}`
    )[0]?.purged_at,
  );
  console.log(
    "Lifecycle passed: concurrent storage admission, fenced publication, cancellation, stale-worker rejection, retained production and expired artifact cleanup.",
  );
} finally {
  await sql`delete from projects where id=${projectId}`;
  await sql.end();
}
