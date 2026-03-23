const runtimeEnv =
  typeof Bun !== "undefined" ? { ...process.env, ...Bun.env } : process.env;

function requireEnv(name: string): string {
  const value = runtimeEnv[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function optionalEnv(name: string): string | null {
  const value = runtimeEnv[name]?.trim();
  return value ? value : null;
}

function integerEnv(name: string, defaultValue: number): number {
  const rawValue = runtimeEnv[name];

  if (!rawValue) {
    return defaultValue;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

type DeploymentStatus = "queued" | "building" | "ready" | "failed" | "cancelled";

interface DeploymentResponse {
  id: string;
  status: DeploymentStatus;
  errorMessage: string | null;
  artifactUrl: string | null;
  commitSha: string | null;
}

interface DeploymentLogEntry {
  sequence: number;
  stream: "stdout" | "stderr" | "system";
  message: string;
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${init?.method ?? "GET"} ${input} failed: ${response.status} ${body}`);
  }

  return (await response.json()) as T;
}

const apiBaseUrl = requireEnv("API_BASE_URL").replace(/\/+$/, "");
const apiAuthToken = optionalEnv("API_AUTH_TOKEN");
const projectId = optionalEnv("SMOKE_PROJECT_ID");
const repoUrl = optionalEnv("SMOKE_REPO_URL");
const gitRef = optionalEnv("SMOKE_GIT_REF");
const pollIntervalMs = integerEnv("SMOKE_POLL_INTERVAL_MS", 3_000);
const timeoutMs = integerEnv("SMOKE_TIMEOUT_MS", 300_000);

if (!projectId && !repoUrl) {
  throw new Error("Either SMOKE_PROJECT_ID or SMOKE_REPO_URL is required");
}

const headers: Record<string, string> = {
  "content-type": "application/json",
};

if (apiAuthToken) {
  headers.authorization = `Bearer ${apiAuthToken}`;
}

const createUrl = projectId
  ? `${apiBaseUrl}/projects/${projectId}/deployments`
  : `${apiBaseUrl}/deployments`;
const createPayload = projectId
  ? { ...(gitRef ? { gitRef } : {}) }
  : { repoUrl, ...(gitRef ? { gitRef } : {}) };

const deployment = await requestJson<DeploymentResponse>(createUrl, {
  method: "POST",
  headers,
  body: JSON.stringify(createPayload),
});

console.log(`Created deployment ${deployment.id}`);

let afterSequence = 0;
const startTime = Date.now();

while (Date.now() - startTime < timeoutMs) {
  const currentDeployment = await requestJson<DeploymentResponse>(
    `${apiBaseUrl}/deployments/${deployment.id}`,
    { headers },
  );
  const logs = await requestJson<DeploymentLogEntry[]>(
    `${apiBaseUrl}/deployments/${deployment.id}/logs?afterSequence=${afterSequence}&limit=100`,
    { headers },
  );

  for (const entry of logs) {
    afterSequence = Math.max(afterSequence, entry.sequence);
    console.log(`[${entry.stream}] ${entry.message}`);
  }

  if (currentDeployment.status === "ready") {
    console.log(`Deployment ready: ${currentDeployment.artifactUrl ?? "no artifact URL"}`);
    console.log(`Commit SHA: ${currentDeployment.commitSha ?? "unknown"}`);
    process.exit(0);
  }

  if (currentDeployment.status === "failed" || currentDeployment.status === "cancelled") {
    throw new Error(
      `Deployment ${currentDeployment.id} ended in status ${currentDeployment.status}: ${currentDeployment.errorMessage ?? "no error message"}`,
    );
  }

  await Bun.sleep(pollIntervalMs);
}

throw new Error(`Timed out waiting for deployment ${deployment.id}`);
