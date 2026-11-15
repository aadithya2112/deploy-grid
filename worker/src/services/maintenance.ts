import { sql } from "../infrastructure/database.ts";
import { ArtifactStorage } from "../infrastructure/r2.ts";

export async function maintainArtifacts(
  storage: Pick<ArtifactStorage, "deletePrefix"> = new ArtifactStorage(),
) {
  const candidates =
    await sql`select d.id,d.project_id from deployments d join deployment_details x on x.deployment_id=d.id where x.expires_at < now() and x.purged_at is null and d.status in ('ready','failed','cancelled')
    and not exists (select 1 from project_releases r where r.deployment_id=d.id)
    and (x.deleted_at is not null or d.id not in (
      select recent.id from deployments recent join deployment_details metadata on metadata.deployment_id=recent.id
      where recent.project_id=d.project_id and recent.status='ready' and metadata.deleted_at is null and metadata.pull_request is null
      order by recent.created_at desc limit 3
    )) order by x.expires_at limit 100`;
  let purged = 0;
  for (const row of candidates) {
    const removable = await sql.begin(async (tx) => {
      // Match promotion lock ordering, so a release cannot race with deletion.
      await tx`select id from projects where id=${row.project_id} for update`;
      const [live] =
        await tx`select deployment_id from project_releases where project_id=${row.project_id} and deployment_id=${row.id}`;
      if (live) return false;
      const [protectedBuild] =
        await tx`select id from (select d.id from deployments d join deployment_details x on x.deployment_id=d.id where d.project_id=${row.project_id} and d.status='ready' and x.deleted_at is null and x.pull_request is null order by d.created_at desc limit 3) retained where id=${row.id}`;
      if (protectedBuild) return false;
      await tx`update deployment_details set deleted_at=coalesce(deleted_at,now()) where deployment_id=${row.id}`;
      return true;
    });
    if (!removable) continue;
    // Tombstone first. Failed deletes remain retryable; the router already rejects the site.
    await storage.deletePrefix(`deployments/${row.id}/`);
    await sql`update deployment_details set purged_at=now() where deployment_id=${row.id}`;
    await sql`delete from deployment_logs where deployment_id=${row.id}`;
    purged++;
  }
  await sql`delete from github_deliveries where completed_at < now() - interval '30 days'`;
  return { purged };
}
