import { createSign } from "node:crypto";

export async function githubRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, { ...init, headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Deploy-Grid", Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`GitHub request failed (${response.status})`);
  return response.status === 204 ? undefined as T : await response.json() as T;
}
export async function installationToken(installationId: string): Promise<string> {
  const key = process.env.GITHUB_APP_PRIVATE_KEY;
  const appId = process.env.GITHUB_APP_ID;
  if (!key || !appId) throw new Error("GitHub App is not configured");
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const data = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iat: now - 60, exp: now + 540, iss: appId })}`;
  const sign = createSign("RSA-SHA256").update(data).sign(key.replaceAll("\\n", "\n")).toString("base64url");
  const result = await githubRequest<{ token: string }>(`/app/installations/${installationId}/access_tokens`, `${data}.${sign}`, { method: "POST" });
  return result.token;
}
export function githubRepo(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "github.com" || parsed.username || parsed.password || parsed.search || parsed.hash || !/^\/[\w.-]+\/[\w.-]+$/.test(parsed.pathname)) throw new Error("Use an HTTPS GitHub repository URL");
  return parsed.pathname.slice(1).replace(/\.git$/, "").toLowerCase();
}
