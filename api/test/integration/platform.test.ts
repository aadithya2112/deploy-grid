import { afterEach, expect, test } from "bun:test";
import { sql } from "../../src/infrastructure/database.ts";
import { PlatformRepository } from "../../src/repositories/platform.repository.ts";
import { ProjectRepository } from "../../src/repositories/project.repository.ts";
import { Deployment } from "../../src/domain/deployment.ts";
const ids: string[] = [];
async function project() {
  const id = crypto.randomUUID();
  const row = await new ProjectRepository().create({
    clerkUserId: `test-${id}`,
    slug: id,
    name: "test",
    repoUrl: `https://github.com/acme/${id}`,
    defaultBranch: "main",
    rootDirectory: null,
    installCommand: null,
    buildCommand: null,
    outputDirectory: null,
  });
  ids.push(row.id);
  return row;
}
afterEach(async () => {
  for (const id of ids.splice(0))
    await sql`delete from projects where id=${id}`;
});
test("atomic handoff creates one job, freezes settings, and rejects duplicate event", async () => {
  const p = await project();
  const store = new PlatformRepository();
  const d = Deployment.create({
    projectId: p.id,
    repoUrl: p.repoUrl,
    gitRef: "abc",
  });
  await store.createQueued(d, p, {
    eventKey: "test-" + p.id,
    environment: "production",
  });
  const [row] =
    await sql`select b.id,x.environment,x.settings from build_jobs b join deployment_details x on b.deployment_id=x.deployment_id where b.deployment_id=${d.id}`;
  expect(row?.environment).toBe("production");
  expect(row?.settings.outputDirectory).toBeNull();
  await expect(
    store.createQueued(
      Deployment.create({ projectId: p.id, repoUrl: p.repoUrl, gitRef: "abc" }),
      p,
      { eventKey: "test-" + p.id },
    ),
  ).rejects.toThrow("already deployed");
  const [count] =
    await sql`select count(*)::int as n from deployments where project_id=${p.id}`;
  expect(count?.n).toBe(1);
});
test("concurrent build admission enforces the active-build limit", async () => {
  const p = await project();
  const store = new PlatformRepository();
  const results = await Promise.allSettled(
    Array.from({ length: 6 }, () =>
      store.createQueued(
        Deployment.create({
          projectId: p.id,
          repoUrl: p.repoUrl,
          gitRef: "main",
        }),
        p,
      ),
    ),
  );
  expect(
    results.filter((result) => result.status === "fulfilled"),
  ).toHaveLength(3);
});
test("promotion, rollback, ownership and tombstone protections", async () => {
  const p = await project();
  const store = new PlatformRepository();
  const deployments: string[] = [];
  for (let index = 0; index < 2; index++) {
    const d = Deployment.create({
      projectId: p.id,
      repoUrl: p.repoUrl,
      gitRef: "main",
    });
    await store.createQueued(d, p);
    await sql`update deployments set status='ready' where id=${d.id}`;
    await sql`update deployment_details set artifact_prefix=${`deployments/${d.id}/attempt`},routing='spa' where deployment_id=${d.id}`;
    deployments.push(d.id);
  }
  const first = deployments[0]!;
  const second = deployments[1]!;
  await expect(store.promote(p.id, first, "other-user")).rejects.toThrow(
    "not found",
  );
  await store.promote(p.id, first, p.clerkUserId!);
  await store.promote(p.id, second, p.clerkUserId!);
  await store.promote(p.id, first, p.clerkUserId!);
  expect((await store.resolveSite(`p-${p.id}`))?.prefix).toBe(
    `deployments/${first}/attempt`,
  );
  expect((await store.overview(p.id, p.clerkUserId!)).history).toHaveLength(3);
  await sql`update deployment_details set deleted_at=now() where deployment_id=${second}`;
  await expect(store.promote(p.id, second, p.clerkUserId!)).rejects.toThrow(
    "retained",
  );
  expect(await store.resolveSite(`d-${second}`)).toBeNull();
});
test("cancellation revokes the build lease", async () => {
  const p = await project();
  const store = new PlatformRepository();
  const d = Deployment.create({
    projectId: p.id,
    repoUrl: p.repoUrl,
    gitRef: "main",
  });
  await store.createQueued(d, p);
  await store.cancel(d.id, p.clerkUserId!);
  const [row] =
    await sql`select d.status,b.status as job_status,b.lease_until from deployments d join build_jobs b on b.deployment_id=d.id where d.id=${d.id}`;
  expect(row?.status).toBe("cancelled");
  expect(row?.job_status).toBe("failed");
  expect(row?.lease_until).toBeNull();
});

test("signed GitHub deliveries deploy once, ignore forks, and cancel closed PRs", async () => {
  const { createHmac } = await import("node:crypto");
  const { handleGitHubWebhook } =
    await import("../../src/services/github.service.ts");
  const p = await project();
  const store = new PlatformRepository();
  const repository = `acme/${p.slug}`;
  await sql`insert into project_releases(project_id,github_installation_id,github_repository) values (${p.id},123,${repository})`;
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  process.env.GITHUB_WEBHOOK_SECRET = "webhook-test";
  const deliveries: string[] = [];
  const service = {
    async createDeploymentForProject(
      projectId: string,
      _userId: string,
      gitRef: string,
      options: import("../../src/repositories/platform.repository.ts").DeploymentOptions,
    ) {
      const d = Deployment.create({ projectId, repoUrl: p.repoUrl, gitRef });
      await store.createQueued(d, p, options);
      return d;
    },
  } as unknown as import("../../src/services/deployment.service.ts").DeploymentService;
  async function deliver(
    event: string,
    extra: Record<string, unknown>,
    delivery = crypto.randomUUID(),
  ) {
    deliveries.push(delivery);
    const body = JSON.stringify({
      installation: { id: 123 },
      repository: { full_name: repository },
      ...extra,
    });
    const signature = createHmac("sha256", "webhook-test")
      .update(body)
      .digest("hex");
    return handleGitHubWebhook(
      new Request("https://api.test/webhooks/github", {
        method: "POST",
        headers: {
          "x-github-event": event,
          "x-github-delivery": delivery,
          "x-hub-signature-256": `sha256=${signature}`,
        },
        body,
      }),
      service,
    );
  }
  try {
    const delivery = crypto.randomUUID();
    const push = { ref: "refs/heads/main", after: "a".repeat(40) };
    expect((await deliver("push", push, delivery)).status).toBe(200);
    expect(await (await deliver("push", push, delivery)).json()).toEqual({
      duplicate: true,
    });
    const pr = {
      number: 42,
      head: { sha: "b".repeat(40), repo: { full_name: "fork/repo" } },
      base: { repo: { full_name: repository } },
    };
    await deliver("pull_request", { action: "opened", pull_request: pr });
    expect(
      (
        await sql`select count(*)::int as n from deployments where project_id=${p.id}`
      )[0]?.n,
    ).toBe(1);
    pr.head.repo.full_name = repository;
    await deliver("pull_request", { action: "opened", pull_request: pr });
    await deliver("pull_request", { action: "closed", pull_request: pr });
    const rows =
      await sql`select d.status,x.environment,x.pull_request,b.status as job_status,x.expires_at < now() as expired from deployments d join deployment_details x on x.deployment_id=d.id join build_jobs b on b.deployment_id=d.id where d.project_id=${p.id}`;
    expect(rows.find((row) => row.environment === "production")?.status).toBe(
      "queued",
    );
    const preview = rows.find((row) => row.pull_request === 42);
    expect(preview?.status).toBe("cancelled");
    expect(preview?.job_status).toBe("failed");
    expect(preview?.expired).toBe(true);
  } finally {
    if (secret === undefined) delete process.env.GITHUB_WEBHOOK_SECRET;
    else process.env.GITHUB_WEBHOOK_SECRET = secret;
    for (const delivery of deliveries)
      await sql`delete from github_deliveries where id=${delivery}`;
  }
});
