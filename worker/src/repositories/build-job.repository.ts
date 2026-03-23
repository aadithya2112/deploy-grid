import { eq } from "drizzle-orm";
import type { BuildJob } from "../db/schema.ts";
import { buildJobs } from "../db/schema.ts";
import { db, sql as postgresClient } from "../infrastructure/database.ts";

export interface ClaimBuildJobInput {
  jobId: string;
  claimedBy: string;
  leaseUntil: Date;
  maxAttempts: number;
  now: Date;
}

export interface RecoveryJobCandidate {
  buildJobId: string;
  deploymentId: string;
  projectId: string;
  repoUrl: string;
  gitRef: string;
  rootDirectory: string | null;
  installCommand: string | null;
  buildCommand: string | null;
  outputDirectory: string | null;
  attempts: number;
  status: "queued" | "running";
}

export class BuildJobRepository {
  async findById(id: string): Promise<BuildJob | null> {
    const [job] = await db.select().from(buildJobs).where(eq(buildJobs.id, id)).limit(1);
    return job ?? null;
  }

  async claim(input: ClaimBuildJobInput): Promise<BuildJob | null> {
    const [job] = await postgresClient<BuildJob[]>`
      update build_jobs
      set
        status = 'running',
        claimed_by = ${input.claimedBy},
        lease_until = ${input.leaseUntil},
        attempts = attempts + 1,
        last_error = null,
        updated_at = ${input.now}
      where id = ${input.jobId}
        and attempts < ${input.maxAttempts}
        and (
          status = 'queued'
          or (
            status = 'running'
            and (lease_until is null or lease_until < ${input.now})
          )
        )
      returning *
    `;

    return job ?? null;
  }

  async refreshLease(
    id: string,
    claimedBy: string,
    leaseUntil: Date,
    now: Date,
  ): Promise<boolean> {
    const [job] = await postgresClient<BuildJob[]>`
      update build_jobs
      set
        lease_until = ${leaseUntil},
        updated_at = ${now}
      where id = ${id}
        and status = 'running'
        and claimed_by = ${claimedBy}
      returning *
    `;

    return Boolean(job);
  }

  async markSucceeded(id: string, claimedBy: string, now: Date): Promise<void> {
    await postgresClient`
      update build_jobs
      set
        status = 'succeeded',
        lease_until = null,
        last_error = null,
        updated_at = ${now}
      where id = ${id}
        and claimed_by = ${claimedBy}
    `;
  }

  async markFailed(
    id: string,
    claimedBy: string,
    lastError: string,
    now: Date,
  ): Promise<void> {
    await postgresClient`
      update build_jobs
      set
        status = 'failed',
        lease_until = null,
        last_error = ${lastError},
        updated_at = ${now}
      where id = ${id}
        and claimed_by = ${claimedBy}
    `;
  }

  async listRecoveryCandidates(input: {
    staleQueuedBefore: Date;
    now: Date;
    maxAttempts: number;
    limit: number;
  }): Promise<RecoveryJobCandidate[]> {
    const [runningRows, queuedRows] = await Promise.all([
      postgresClient<RecoveryJobCandidate[]>`
        select
          bj.id as "buildJobId",
          d.id as "deploymentId",
          d.project_id as "projectId",
          p.repo_url as "repoUrl",
          d.git_ref as "gitRef",
          p.root_directory as "rootDirectory",
          p.install_command as "installCommand",
          p.build_command as "buildCommand",
          p.output_directory as "outputDirectory",
          bj.attempts as "attempts",
          bj.status as "status"
        from build_jobs bj
        inner join deployments d on d.id = bj.deployment_id
        inner join projects p on p.id = d.project_id
        where bj.status = 'running'
          and d.status in ('queued', 'building')
          and bj.attempts < ${input.maxAttempts}
          and bj.lease_until is not null
          and bj.lease_until < ${input.now}
        order by bj.updated_at asc
        limit ${input.limit}
      `,
      postgresClient<RecoveryJobCandidate[]>`
        select
          bj.id as "buildJobId",
          d.id as "deploymentId",
          d.project_id as "projectId",
          p.repo_url as "repoUrl",
          d.git_ref as "gitRef",
          p.root_directory as "rootDirectory",
          p.install_command as "installCommand",
          p.build_command as "buildCommand",
          p.output_directory as "outputDirectory",
          bj.attempts as "attempts",
          bj.status as "status"
        from build_jobs bj
        inner join deployments d on d.id = bj.deployment_id
        inner join projects p on p.id = d.project_id
        where bj.status = 'queued'
          and d.status = 'queued'
          and bj.attempts < ${input.maxAttempts}
          and bj.updated_at < ${input.staleQueuedBefore}
        order by bj.updated_at asc
        limit ${input.limit}
      `,
    ]);

    const deduped = new Map<string, RecoveryJobCandidate>();

    for (const row of [...runningRows, ...queuedRows]) {
      deduped.set(row.buildJobId, row);
    }

    return [...deduped.values()].slice(0, input.limit);
  }

  async listExceededRunningJobs(now: Date, maxAttempts: number): Promise<BuildJob[]> {
    return postgresClient<BuildJob[]>`
      select *
      from build_jobs
      where status = 'running'
        and attempts >= ${maxAttempts}
        and lease_until is not null
        and lease_until < ${now}
    `;
  }

  async releaseClaim(id: string, claimedBy: string, now: Date): Promise<void> {
    await postgresClient`
      update build_jobs
      set
        lease_until = ${now},
        updated_at = ${now}
      where id = ${id}
        and claimed_by = ${claimedBy}
        and status = 'running'
    `;
  }

  async findByDeploymentId(deploymentId: string): Promise<BuildJob | null> {
    const [job] = await db
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.deploymentId, deploymentId))
      .limit(1);

    return job ?? null;
  }
}
