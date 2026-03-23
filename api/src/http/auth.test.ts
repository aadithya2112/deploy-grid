import { describe, expect, test } from "bun:test";
import { authorizeRequest } from "./auth.ts";

describe("authorizeRequest", () => {
  test("allows public health requests", () => {
    const response = authorizeRequest(
      new Request("http://localhost/health"),
      { expectedToken: "secret-token" },
    );

    expect(response).toBeNull();
  });

  test("allows requests when auth is disabled", () => {
    const response = authorizeRequest(
      new Request("http://localhost/projects"),
      { expectedToken: null },
    );

    expect(response).toBeNull();
  });

  test("rejects requests with missing bearer tokens", async () => {
    const response = authorizeRequest(
      new Request("http://localhost/projects"),
      { expectedToken: "secret-token" },
    );

    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({ error: "Unauthorized" });
  });

  test("accepts requests with the expected bearer token", () => {
    const response = authorizeRequest(
      new Request("http://localhost/projects", {
        headers: {
          authorization: "Bearer secret-token",
        },
      }),
      { expectedToken: "secret-token" },
    );

    expect(response).toBeNull();
  });
});
