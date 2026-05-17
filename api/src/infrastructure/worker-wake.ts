import { env } from "../config/env.ts";
import { logger } from "./logger.ts";

const WAKE_ATTEMPTS = 3;
const WAKE_RETRY_DELAY_MS = 1_000;
const WAKE_TIMEOUT_MS = 60_000;
const WORKER_WAKE_TOKEN_HEADER = "X-Worker-Wake-Token";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCloudRunIdentityToken(audience: string): Promise<string | null> {
  const metadataUrl = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}&format=full`;

  try {
    const response = await fetch(metadataUrl, {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(2_000),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.text()).trim() || null;
  } catch {
    return null;
  }
}

async function buildWakeHeaders(wakeUrl: string): Promise<HeadersInit> {
  const headers: Record<string, string> = {};

  if (env.workerWakeSecret) {
    headers[WORKER_WAKE_TOKEN_HEADER] = env.workerWakeSecret;
  }

  const audience = new URL(wakeUrl).origin;
  const identityToken = await getCloudRunIdentityToken(audience);

  if (identityToken) {
    headers.Authorization = `Bearer ${identityToken}`;
  }

  return headers;
}

export async function wakeDeploymentWorkerAsync(): Promise<void> {
  const wakeUrl = env.workerWakeUrl;

  if (!wakeUrl) {
    logger.info("WORKER_WAKE_URL is not set; deployment worker will not be notified");
    return;
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= WAKE_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(wakeUrl, {
        method: "POST",
        headers: await buildWakeHeaders(wakeUrl),
        signal: AbortSignal.timeout(WAKE_TIMEOUT_MS),
      });

      if (response.ok || response.status === 202) {
        logger.info("Deployment worker wake succeeded", {
          status: response.status,
          attempt,
        });
        return;
      }

      lastError = new Error(
        `Worker wake failed with status ${response.status}: ${await response.text()}`,
      );
    } catch (error) {
      lastError = error;
    }

    logger.info("Deployment worker wake attempt failed", {
      attempt,
      error: lastError instanceof Error ? lastError.message : "Unknown wake error",
    });

    if (attempt < WAKE_ATTEMPTS) {
      await sleep(WAKE_RETRY_DELAY_MS * attempt);
    }
  }

  logger.error("Deployment worker wake failed after retries", {
    wakeUrl,
    error: lastError instanceof Error ? lastError.message : "Unknown wake error",
  });
}

/** Wakes the worker and waits only until it accepts the job (HTTP 202). */
export async function wakeDeploymentWorker(): Promise<void> {
  await wakeDeploymentWorkerAsync();
}
