import { afterAll, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { Deployment } from "../../src/domain/deployment.ts";
import {
  buildJobs,
  deploymentLogs,
  deployments,
  projectEnvVars,
  projects,
} from "../../src/db/schema.ts";
import { db, sql } from "../../src/infrastructure/database.ts";
import { BuildJobRepository } from "../../src/repositories/build-job.repository.ts";
import { DeploymentLogRepository } from "../../src/repositories/deployment-log.repository.ts";
import { DeploymentRepository } from "../../src/repositories/deployment.repository.ts";
import { ProjectEnvVarRepository } from "../../src/repositories/project-env-var.repository.ts";
import { ProjectRepository } from "../../src/repositories/project.repository.ts";

const projectRepository = new ProjectRepository();
const deploymentRepository = new DeploymentRepository();
const buildJobRepository = new BuildJobRepository();
const deploymentLogRepository = new DeploymentLogRepository();
const projectEnvVarRepository = new ProjectEnvVarRepository();

function createRepoUrl(name: string): string {
  return `https://example.com/test-suite/${name}-${crypto.randomUUID()}.git`;
}

function createSlug(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

async function cleanupProjectsByRepoUrl(repoUrls: string[]): Promise<void> {
  if (repoUrls.length === 0) {
    return;
  }

  const projectRows = await db
    .select({
      id: projects.id,
    })
    .from(projects)
    .where(inArray(projects.repoUrl, repoUrls));

  const projectIds = projectRows.map((row) => row.id);

  if (projectIds.length === 0) {
    return;
  }

  const deploymentRows = await db
    .select({
      id: deployments.id,
    })
    .from(deployments)
    .where(inArray(deployments.projectId, projectIds));

  const deploymentIds = deploymentRows.map((row) => row.id);

  if (deploymentIds.length > 0) {
    await db
      .delete(deploymentLogs)
      .where(inArray(deploymentLogs.deploymentId, deploymentIds));
    await db.delete(buildJobs).where(inArray(buildJobs.deploymentId, deploymentIds));
    await db.delete(deployments).where(inArray(deployments.id, deploymentIds));
  }

  await db.delete(projectEnvVars).where(inArray(projectEnvVars.projectId, projectIds));
  await db.delete(projects).where(inArray(projects.id, projectIds));
}

describe("repository integration tests", () => {
  afterAll(async () => {
    await sql.end();
  });

  test(
    "ProjectRepository creates or reuses projects by repoUrl",
    async () => {
    const repoUrl = createRepoUrl("project");
      try {
        const first = await projectRepository.createOrGet({
          slug: createSlug("react-app-project"),
          name: "react-app",
          repoUrl,
          defaultBranch: "main",
          rootDirectory: null,
          installCommand: null,
          buildCommand: null,
          outputDirectory: null,
        });

        const second = await projectRepository.createOrGet({
          slug: createSlug("ignored-slug"),
          name: "ignored-name",
          repoUrl,
          defaultBranch: "main",
          rootDirectory: null,
          installCommand: null,
          buildCommand: null,
          outputDirectory: null,
        });

        const loaded = await projectRepository.findByRepoUrl(repoUrl);

        expect(second.id).toBe(first.id);
        expect(loaded?.id).toBe(first.id);
        expect(loaded?.repoUrl).toBe(repoUrl);
      } finally {
        await cleanupProjectsByRepoUrl([repoUrl]);
      }
    },
    { timeout: 30000 },
  );

  test(
    "DeploymentRepository creates, updates, and loads deployments with repoUrl",
    async () => {
    const repoUrl = createRepoUrl("deployment");
      try {
        const project = await projectRepository.createOrGet({
          slug: createSlug("react-app-deployment"),
          name: "react-app",
          repoUrl,
          defaultBranch: "main",
          rootDirectory: null,
          installCommand: null,
          buildCommand: null,
          outputDirectory: null,
        });
        const deployment = Deployment.create({
          projectId: project.id,
          repoUrl,
          gitRef: "main",
        });

        await deploymentRepository.create(deployment);

        const created = await deploymentRepository.findById(deployment.id);

        expect(created).not.toBeNull();
        expect(created?.repoUrl).toBe(repoUrl);
        expect(created?.status).toBe("queued");
        expect(created?.gitRef).toBe("main");

        deployment.commitSha = "abc123";
        deployment.previewUrl = "https://preview.example.com/deploy";
        deployment.artifactUrl = "https://artifact.example.com/build";
        deployment.markFailed("Queue unavailable");

        await deploymentRepository.update(deployment);

        const updated = await deploymentRepository.findById(deployment.id);

        expect(updated).not.toBeNull();
        expect(updated?.status).toBe("failed");
        expect(updated?.commitSha).toBe("abc123");
        expect(updated?.previewUrl).toBe("https://preview.example.com/deploy");
        expect(updated?.artifactUrl).toBe("https://artifact.example.com/build");
        expect(updated?.errorMessage).toBe("Queue unavailable");
        expect(typeof updated?.buildFinishedAt).toBe("string");
      } finally {
        await cleanupProjectsByRepoUrl([repoUrl]);
      }
    },
    { timeout: 30000 },
  );

  test(
    "BuildJobRepository creates jobs and marks them as failed",
    async () => {
    const repoUrl = createRepoUrl("build-job");
      try {
        const project = await projectRepository.createOrGet({
          slug: createSlug("react-app-build-job"),
          name: "react-app",
          repoUrl,
          defaultBranch: "main",
          rootDirectory: null,
          installCommand: null,
          buildCommand: null,
          outputDirectory: null,
        });
        const deployment = Deployment.create({
          projectId: project.id,
          repoUrl,
          gitRef: "main",
        });

        await deploymentRepository.create(deployment);
        const job = await buildJobRepository.create(deployment.id);
        await buildJobRepository.markRunning(job.id, {
          claimedBy: "worker-1",
          leaseUntil: new Date("2025-01-01T00:10:00.000Z"),
        });
        await buildJobRepository.refreshLease(
          job.id,
          new Date("2025-01-01T00:20:00.000Z"),
        );
        await buildJobRepository.markSucceeded(job.id);
        await buildJobRepository.markFailed(job.id, "worker crashed");

        const foundById = await buildJobRepository.findById(job.id);
        const foundByDeploymentId = await buildJobRepository.findByDeploymentId(
          deployment.id,
        );

        const [storedJob] = await db
          .select()
          .from(buildJobs)
          .where(eq(buildJobs.id, job.id))
          .limit(1);

        expect(storedJob).toBeDefined();
        expect(storedJob?.deploymentId).toBe(deployment.id);
        expect(storedJob?.status).toBe("failed");
        expect(storedJob?.lastError).toBe("worker crashed");
        expect(storedJob?.claimedBy).toBe("worker-1");
        expect(storedJob?.leaseUntil?.toISOString()).toBe(
          "2025-01-01T00:20:00.000Z",
        );
        expect(foundById?.id).toBe(job.id);
        expect(foundByDeploymentId?.id).toBe(job.id);
      } finally {
        await cleanupProjectsByRepoUrl([repoUrl]);
      }
    },
    { timeout: 30000 },
  );

  test(
    "ProjectRepository lists, finds, and updates project settings",
    async () => {
      const repoUrl = createRepoUrl("project-settings");

      try {
        const project = await projectRepository.create({
          slug: createSlug("react-app-settings"),
          name: "react-app",
          repoUrl,
          defaultBranch: "main",
          rootDirectory: null,
          installCommand: null,
          buildCommand: null,
          outputDirectory: null,
        });

        const listedProjects = await projectRepository.list({
          limit: 50,
          offset: 0,
        });
        const loaded = await projectRepository.findById(project.id);
        const updated = await projectRepository.updateSettings(project.id, {
          defaultBranch: "develop",
          buildCommand: "bun run build",
        });

        expect(listedProjects.some((entry) => entry.id === project.id)).toBe(true);
        expect(loaded?.id).toBe(project.id);
        expect(updated?.defaultBranch).toBe("develop");
        expect(updated?.buildCommand).toBe("bun run build");
      } finally {
        await cleanupProjectsByRepoUrl([repoUrl]);
      }
    },
    { timeout: 30000 },
  );

  test(
    "DeploymentRepository lists deployments by project",
    async () => {
      const repoUrl = createRepoUrl("deployment-list");

      try {
        const project = await projectRepository.create({
          slug: createSlug("react-app-list"),
          name: "react-app",
          repoUrl,
          defaultBranch: "main",
          rootDirectory: null,
          installCommand: null,
          buildCommand: null,
          outputDirectory: null,
        });
        const first = Deployment.create({
          projectId: project.id,
          repoUrl,
          gitRef: "main",
        });
        const second = Deployment.create({
          projectId: project.id,
          repoUrl,
          gitRef: "develop",
        });

        await deploymentRepository.create(first);
        await deploymentRepository.create(second);

        const deploymentsForProject = await deploymentRepository.listByProjectId(
          project.id,
          { limit: 10, offset: 0 },
        );
        const latest = await deploymentRepository.findLatestByProjectId(project.id);

        expect(deploymentsForProject.length).toBe(2);
        expect(deploymentsForProject.some((item) => item.id === first.id)).toBe(true);
        expect(deploymentsForProject.some((item) => item.id === second.id)).toBe(true);
        expect(latest?.projectId).toBe(project.id);
      } finally {
        await cleanupProjectsByRepoUrl([repoUrl]);
      }
    },
    { timeout: 30000 },
  );

  test(
    "DeploymentLogRepository appends and lists logs by deployment",
    async () => {
      const repoUrl = createRepoUrl("deployment-logs");

      try {
        const project = await projectRepository.create({
          slug: createSlug("react-app-logs"),
          name: "react-app",
          repoUrl,
          defaultBranch: "main",
          rootDirectory: null,
          installCommand: null,
          buildCommand: null,
          outputDirectory: null,
        });
        const deployment = Deployment.create({
          projectId: project.id,
          repoUrl,
          gitRef: "main",
        });

        await deploymentRepository.create(deployment);
        await deploymentLogRepository.append({
          deploymentId: deployment.id,
          stream: "stdout",
          sequence: 1,
          message: "Installing dependencies",
        });
        await deploymentLogRepository.append({
          deploymentId: deployment.id,
          stream: "stderr",
          sequence: 2,
          message: "Warning message",
        });

        const logs = await deploymentLogRepository.listByDeploymentId(
          deployment.id,
          { limit: 10 },
        );
        const laterLogs = await deploymentLogRepository.listByDeploymentId(
          deployment.id,
          { limit: 10, afterSequence: 1 },
        );

        expect(logs.map((entry) => entry.sequence)).toEqual([1, 2]);
        expect(laterLogs.map((entry) => entry.sequence)).toEqual([2]);
      } finally {
        await cleanupProjectsByRepoUrl([repoUrl]);
      }
    },
    { timeout: 30000 },
  );

  test(
    "ProjectEnvVarRepository upserts, lists, and deletes env vars",
    async () => {
      const repoUrl = createRepoUrl("env-vars");

      try {
        const project = await projectRepository.create({
          slug: createSlug("react-app-env"),
          name: "react-app",
          repoUrl,
          defaultBranch: "main",
          rootDirectory: null,
          installCommand: null,
          buildCommand: null,
          outputDirectory: null,
        });

        const first = await projectEnvVarRepository.upsert({
          projectId: project.id,
          key: "API_KEY",
          value: "secret-1234",
          target: "preview",
        });
        const second = await projectEnvVarRepository.upsert({
          projectId: project.id,
          key: "API_KEY",
          value: "updated-5678",
          target: "preview",
        });

        const envVars = await projectEnvVarRepository.listByProjectId(project.id);
        await projectEnvVarRepository.delete(project.id, "API_KEY", "preview");
        const envVarsAfterDelete = await projectEnvVarRepository.listByProjectId(
          project.id,
        );

        expect(second.id).toBe(first.id);
        expect(envVars).toHaveLength(1);
        expect(envVars[0]?.value).toBe("updated-5678");
        expect(envVarsAfterDelete).toHaveLength(0);
      } finally {
        await cleanupProjectsByRepoUrl([repoUrl]);
      }
    },
    { timeout: 30000 },
  );
});
