import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55432/deploy_grid_test";
if (!["localhost", "127.0.0.1"].includes(new URL(testDatabaseUrl).hostname))
  throw new Error("Runtime smoke requires a disposable local database");
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: "deploy-grid-api",
        modules: true,
        script: readFileSync(path.join(root, "api/dist/cloudflare.js"), "utf8"),
        compatibilityDate: "2026-11-13",
        compatibilityFlags: ["nodejs_compat"],
        bindings: {
          DATABASE_URL: testDatabaseUrl,
          UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
          UPSTASH_REDIS_REST_TOKEN: "test",
          API_AUTH_TOKEN: "test-api-token",
          ROUTING_SECRET: "test-routing-token",
          PROJECT_ENV_ENCRYPTION_KEY: "test-key",
          SITES_DOMAIN: "sites.test",
        },
      },
      {
        name: "deploy-grid-sites",
        modules: true,
        script: readFileSync(path.join(root, "edge/dist/index.js"), "utf8"),
        compatibilityDate: "2026-11-13",
        compatibilityFlags: ["nodejs_compat"],
        bindings: {
          SITES_DOMAIN: "sites.test",
          ROUTING_SECRET: "test-routing-token",
        },
        r2Buckets: ["ARTIFACTS"],
        serviceBindings: { API: "deploy-grid-api" },
      },
    ],
  }),
);
try {
  const api = await mf.getWorker("deploy-grid-api");
  assert.equal((await api.fetch("https://api/projects")).status, 401);
  const health = await api.fetch("https://api/health");
  assert.equal(health.status, 200, await health.text());
  const created = await api.fetch("https://api/projects", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-api-token",
      "x-clerk-user-id": "runtime-smoke",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      repoUrl: `https://github.com/acme/runtime-${Date.now()}`,
    }),
  });
  assert.equal(created.status, 201, await created.clone().text());
  const project = await created.json();
  const denied = await api.fetch(`https://api/projects/${project.id}`, {
    headers: {
      Authorization: "Bearer test-api-token",
      "x-clerk-user-id": "other",
    },
  });
  assert.equal(denied.status, 404);
  console.log(
    "Workers runtime passed: API authentication, PostgreSQL health, project creation and cross-user denial.",
  );
  // Exercise router/R2 behavior with a service-binding stub to avoid mutating release rows.
  const fixture = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: readFileSync(path.join(root, "edge/dist/index.js"), "utf8"),
      compatibilityDate: "2026-11-13",
      bindings: { SITES_DOMAIN: "sites.test", ROUTING_SECRET: "secret" },
      r2Buckets: ["ARTIFACTS"],
      serviceBindings: {
        API: () =>
          Response.json({
            prefix: "deployments/fixture/attempt",
            routing: "spa",
          }),
      },
    }),
  );
  try {
    const bucket = await fixture.getR2Bucket("ARTIFACTS");
    await bucket.put(
      "deployments/fixture/attempt/index.html",
      "<h1>Fixture</h1>",
      { httpMetadata: { contentType: "text/html" } },
    );
    await bucket.put(
      "deployments/fixture/attempt/assets/app.js",
      "console.log('ok')",
      { httpMetadata: { contentType: "text/javascript" } },
    );
    const host = "https://d-12345678-1234-1234-1234-123456789012.sites.test";
    assert.equal(
      await (await fixture.dispatchFetch(host + "/nested/route")).text(),
      "<h1>Fixture</h1>",
    );
    assert.equal(
      (await fixture.dispatchFetch(host + "/assets/app.js")).status,
      200,
    );
    assert.equal(
      (await fixture.dispatchFetch(host + "/assets/missing.js")).status,
      404,
    );
    assert.equal((await fixture.dispatchFetch(host + "/.env")).status, 400);
    assert.equal(
      (await fixture.dispatchFetch(host + "/", { method: "HEAD" })).status,
      200,
    );
    console.log(
      "Workers runtime passed: R2 delivery, SPA nested routes, isolated assets, missing assets, hidden paths, HEAD.",
    );
  } finally {
    await fixture.dispose();
  }
} finally {
  await mf.dispose();
}
