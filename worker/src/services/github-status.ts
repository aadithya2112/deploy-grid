import { githubRequest, installationToken } from "../../../shared/github.ts";
import { sql } from "../infrastructure/database.ts";
export async function reportGitHubStatus(deploymentId: string, state: "pending" | "success" | "failure") {
  try {
    const [row] = await sql`select d.commit_sha,d.preview_url,r.github_installation_id::text as installation,r.github_repository from deployments d join project_releases r on r.project_id=d.project_id where d.id=${deploymentId}`;
    if (!row?.installation || !row.commit_sha || !row.github_repository) return;
    const token = await installationToken(row.installation);
    await githubRequest(`/repos/${row.github_repository}/statuses/${row.commit_sha}`, token, { method: "POST", body: JSON.stringify({ state, context: "Deploy Grid", description: state === "success" ? "Static deployment ready" : state === "pending" ? "Building static deployment" : "Deployment failed", target_url: row.preview_url ?? undefined }) });
  } catch { console.warn("GitHub status reporting failed", { deploymentId }); }
}
