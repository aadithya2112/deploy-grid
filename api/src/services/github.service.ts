import { readBoundedBody } from "../http/validation.ts";
import { createHmac, timingSafeEqual } from "node:crypto";
import { githubRepo, githubRequest } from "../../../shared/github.ts";
import { sql } from "../infrastructure/database.ts";
import { PlatformError } from "../repositories/platform.repository.ts";
import type { DeploymentService } from "./deployment.service.ts";

export function verifyWebhook(
  body: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!secret || !signature || !/^sha256=[0-9a-f]{64}$/.test(signature))
    return false;
  return timingSafeEqual(
    Buffer.from(signature.slice(7), "hex"),
    createHmac("sha256", secret).update(body).digest(),
  );
}
export async function connectGitHub(
  projectId: string,
  userId: string,
  code: string,
) {
  const [project] =
    await sql`select repo_url from projects where id=${projectId} and clerk_user_id=${userId}`;
  if (!project) throw new PlatformError("Project not found", 404);
  if (
    !process.env.GITHUB_CLIENT_ID ||
    !process.env.GITHUB_CLIENT_SECRET ||
    !process.env.WEB_BASE_URL
  )
    throw new PlatformError("GitHub integration is not configured", 503);
  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.WEB_BASE_URL}/api/github/callback`,
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token)
    throw new PlatformError("GitHub authorization failed", 401);
  const repo = githubRepo(project.repo_url);
  // Verify this GitHub user can access the installation AND repository. An installation ID alone proves neither.
  for (let page = 1; page <= 10; page++) {
    const { installations } = await githubRequest<{
      installations: { id: number }[];
    }>(`/user/installations?per_page=100&page=${page}`, token.access_token);
    for (const installation of installations) {
      for (let repoPage = 1; repoPage <= 10; repoPage++) {
        const { repositories } = await githubRequest<{
          repositories: {
            full_name: string;
            permissions?: { admin?: boolean; push?: boolean };
          }[];
        }>(
          `/user/installations/${installation.id}/repositories?per_page=100&page=${repoPage}`,
          token.access_token,
        );
        const match = repositories.find(
          (item) =>
            item.full_name.toLowerCase() === repo &&
            (item.permissions?.admin || item.permissions?.push),
        );
        if (match) {
          await sql`insert into project_releases(project_id,github_installation_id,github_repository) values (${projectId},${installation.id},${repo}) on conflict(project_id) do update set github_installation_id=excluded.github_installation_id,github_repository=excluded.github_repository,updated_at=now()`;
          return { repository: repo };
        }
        if (repositories.length < 100) break;
      }
    }
    if (installations.length < 100) break;
  }
  throw new PlatformError(
    "Install the Deploy Grid GitHub App on this repository and authorize an account with write access",
    403,
  );
}

interface WebhookPayload {
  action?: string;
  deleted?: boolean;
  ref?: string;
  after?: string;
  installation?: { id: number };
  repository?: { full_name: string };
  pull_request?: {
    number: number;
    head: { sha: string; repo: { full_name: string } | null };
    base: { repo: { full_name: string } };
  };
}
export async function handleGitHubWebhook(
  request: Request,
  service: DeploymentService,
): Promise<Response> {
  const text = await readBoundedBody(request, 1_000_000);
  if (text.length > 1_000_000)
    return Response.json({ error: "Payload too large" }, { status: 413 });
  if (
    !verifyWebhook(
      text,
      request.headers.get("x-hub-signature-256"),
      process.env.GITHUB_WEBHOOK_SECRET ?? "",
    )
  )
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  const delivery = request.headers.get("x-github-delivery");
  if (!delivery || delivery.length > 100)
    throw new PlatformError("Invalid delivery ID");
  const payload = JSON.parse(text) as WebhookPayload;
  const event = request.headers.get("x-github-event");
  if (
    !payload.installation ||
    !payload.repository ||
    !["push", "pull_request"].includes(event ?? "")
  )
    return Response.json({ ignored: true });
  const [received] =
    await sql`insert into github_deliveries(id) values (${delivery}) on conflict(id) do update set id=excluded.id returning completed_at`;
  if (received?.completed_at) return Response.json({ duplicate: true });
  const projects =
    await sql`select p.id,p.clerk_user_id,p.default_branch from projects p join project_releases r on r.project_id=p.id where r.github_installation_id=${payload.installation.id} and r.github_repository=${payload.repository.full_name.toLowerCase()}`;
  for (const project of projects) {
    if (event === "pull_request" && payload.pull_request) {
      const pr = payload.pull_request;
      if (payload.action === "closed") {
        await sql.begin(async (transaction) => {
          const tx = transaction;
          await tx`select id from projects where id=${project.id} for update`;
          await tx`update deployment_details x set expires_at=now() from deployments d where x.deployment_id=d.id and d.project_id=${project.id} and x.pull_request=${pr.number}`;
          await tx`update deployments d set status='cancelled',updated_at=now() from deployment_details x where x.deployment_id=d.id and d.project_id=${project.id} and x.pull_request=${pr.number} and d.status in ('queued','building')`;
          await tx`update build_jobs b set status='failed',lease_until=null,last_error='PR closed' from deployments d where b.deployment_id=d.id and d.project_id=${project.id} and d.status='cancelled'`;
        });
        continue;
      }
      if (
        !["opened", "synchronize", "reopened"].includes(payload.action ?? "") ||
        pr.head.repo?.full_name !== pr.base.repo.full_name
      )
        continue;
      if (!/^[a-f0-9]{40}$/.test(pr.head.sha))
        throw new PlatformError("Invalid commit SHA");
      try {
        await service.createDeploymentForProject(
          project.id,
          project.clerk_user_id,
          pr.head.sha,
          {
            environment: "preview",
            pullRequest: pr.number,
            eventKey: `${delivery}:${project.id}`,
          },
        );
      } catch (error) {
        if (!(error instanceof PlatformError && error.status === 409))
          throw error;
      }
    } else if (
      event === "push" &&
      !payload.deleted &&
      payload.ref === `refs/heads/${project.default_branch}` &&
      payload.after &&
      /^[a-f0-9]{40}$/.test(payload.after)
    ) {
      try {
        await service.createDeploymentForProject(
          project.id,
          project.clerk_user_id,
          payload.after,
          { environment: "production", eventKey: `${delivery}:${project.id}` },
        );
      } catch (error) {
        if (!(error instanceof PlatformError && error.status === 409))
          throw error;
      }
    }
  }
  await sql`update github_deliveries set completed_at=now() where id=${delivery}`;
  return Response.json({ accepted: true });
}
