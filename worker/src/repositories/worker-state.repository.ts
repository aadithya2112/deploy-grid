import { sql } from "../infrastructure/database.ts";

export class WorkerStateRepository {
  async reserveArtifacts(deploymentId: string, bytes: number): Promise<void> {
    await sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext('deploy-grid-storage-budget'))`;
      const [usage] =
        await tx`select coalesce(sum(artifact_bytes),0)::text as bytes from deployment_details where purged_at is null`;
      if (
        Number(usage?.bytes) + bytes >
        Number(process.env.MAX_ARTIFACT_STORAGE_BYTES ?? 8_000_000_000)
      )
        throw new Error(
          "Platform artifact storage budget reached; expire old deployments before retrying",
        );
      const [reserved] =
        await tx`update deployment_details set artifact_bytes=artifact_bytes+${bytes} where deployment_id=${deploymentId} and deleted_at is null returning deployment_id`;
      if (!reserved)
        throw new Error("Deployment is unavailable for artifact upload");
    });
  }

  async markBuilding(deploymentId: string, now: Date): Promise<void> {
    await sql`update deployments set status='building',build_started_at=coalesce(build_started_at,${now.toISOString()}),error_message=null,updated_at=${now.toISOString()} where id=${deploymentId} and status in ('queued','building')`;
  }
  async finalizeSuccess(input: {
    deploymentId: string;
    buildJobId: string;
    claimedBy: string;
    commitSha: string;
    artifactUrl: string;
    now: Date;
    artifactPrefix?: string;
    framework?: string;
    routing?: "spa" | "static";
    metrics?: Record<string, number>;
  }): Promise<void> {
    await sql.begin(async (tx) => {
      // Use the same project -> deployment -> job order as cancellation and promotion.
      await tx`select p.id from projects p join deployments d on d.project_id=p.id where d.id=${input.deploymentId} for update of p`;
      await tx`select id from deployments where id=${input.deploymentId} for update`;
      const [job] =
        await tx`update build_jobs set status='succeeded',last_error=null,lease_until=null,updated_at=${input.now.toISOString()} where id=${input.buildJobId} and claimed_by=${input.claimedBy} and status='running' and lease_until > now() returning id`;
      if (!job)
        throw new Error(
          "Lease lost or deployment cancelled before publication",
        );
      const [deployment] =
        await tx`update deployments set status='ready',commit_sha=${input.commitSha},artifact_url=${input.artifactUrl},build_finished_at=${input.now.toISOString()},updated_at=${input.now.toISOString()},error_message=null where id=${input.deploymentId} and status='building' returning project_id`;
      if (!deployment) throw new Error("Deployment is no longer building");
      const [details] =
        await tx`update deployment_details set artifact_prefix=${input.artifactPrefix ?? null},framework=${input.framework ?? null},routing=${input.routing ?? "static"},metrics=${JSON.stringify(input.metrics ?? {})}::jsonb where deployment_id=${input.deploymentId} returning environment,pull_request`;
      if (details?.environment === "production" && !details.pull_request) {
        // Serialize promotions and refuse to replace a more recent production build.
        await tx`select id from projects where id=${deployment.project_id} for update`;
        const [newer] =
          await tx`select d.id from deployments d join deployment_details x on x.deployment_id=d.id where d.project_id=${deployment.project_id} and x.environment='production' and d.created_at > (select created_at from deployments where id=${input.deploymentId}) limit 1`;
        if (!newer) {
          await tx`insert into project_releases(project_id,deployment_id) values (${deployment.project_id},${input.deploymentId}) on conflict(project_id) do update set deployment_id=excluded.deployment_id,updated_at=now()`;
          await tx`insert into release_events(project_id,deployment_id,actor) values (${deployment.project_id},${input.deploymentId},'production-build')`;
        }
      }
    });
  }
  async finalizeFailure(input: {
    deploymentId: string;
    buildJobId: string;
    claimedBy: string;
    errorMessage: string;
    now: Date;
  }): Promise<void> {
    await sql.begin(async (tx) => {
      // Use the same project -> deployment -> job order as cancellation and promotion.
      await tx`select p.id from projects p join deployments d on d.project_id=p.id where d.id=${input.deploymentId} for update of p`;
      await tx`select id from deployments where id=${input.deploymentId} for update`;
      const [job] =
        await tx`update build_jobs set status='failed',last_error=${input.errorMessage},lease_until=null,updated_at=now() where id=${input.buildJobId} and claimed_by=${input.claimedBy} and status='running' and lease_until > now() returning id`;
      if (!job) return;
      await tx`update deployments set status='failed',error_message=${input.errorMessage},build_finished_at=now(),updated_at=now() where id=${input.deploymentId} and status in ('queued','building')`;
    });
  }
  async failExpiredRunningJob(input: {
    deploymentId: string;
    buildJobId: string;
    errorMessage: string;
    now: Date;
  }): Promise<void> {
    await sql.begin(async (tx) => {
      // Use the same project -> deployment -> job order as cancellation and promotion.
      await tx`select p.id from projects p join deployments d on d.project_id=p.id where d.id=${input.deploymentId} for update of p`;
      await tx`select id from deployments where id=${input.deploymentId} for update`;
      const [job] =
        await tx`update build_jobs set status='failed',last_error=${input.errorMessage},lease_until=null,updated_at=now() where id=${input.buildJobId} and status='running' and lease_until < now() returning id`;
      if (job)
        await tx`update deployments set status='failed',error_message=${input.errorMessage},build_finished_at=now(),updated_at=now() where id=${input.deploymentId} and status in ('queued','building')`;
    });
  }
}
