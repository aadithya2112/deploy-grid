import "./setup.ts";
import { describe, expect, test } from "bun:test";
import type { ProjectEnvVar } from "../src/db/schema.ts";
import {
  decryptProjectEnvValue,
  encryptProjectEnvValue,
  isEncryptedProjectEnvValue,
} from "../src/infrastructure/project-env-crypto.ts";
import { resolveBuildEnvironment } from "../src/services/env-resolution.ts";

describe("project env crypto", () => {
  test("round-trips encrypted values", async () => {
    const encrypted = await encryptProjectEnvValue("super-secret");

    expect(isEncryptedProjectEnvValue(encrypted)).toBe(true);
    await expect(decryptProjectEnvValue(encrypted)).resolves.toBe("super-secret");
  });

  test("resolves preview env vars with preview overriding all", async () => {
    const allValue = await encryptProjectEnvValue("shared-value");
    const previewValue = await encryptProjectEnvValue("preview-value");

    const envVars: ProjectEnvVar[] = [
      {
        id: "env-1",
        projectId: "project-1",
        key: "SHARED",
        value: allValue,
        target: "all",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "env-2",
        projectId: "project-1",
        key: "SHARED",
        value: previewValue,
        target: "preview",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "env-3",
        projectId: "project-1",
        key: "ONLY_ALL",
        value: "plain-text",
        target: "all",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await expect(resolveBuildEnvironment(envVars, "preview")).resolves.toEqual({
      SHARED: "preview-value",
      ONLY_ALL: "plain-text",
    });
  });
});
