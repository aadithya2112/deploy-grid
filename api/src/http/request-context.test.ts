import { describe, expect, test } from "bun:test";
import {
  RequestContextError,
  requireRequestContext,
} from "./request-context.ts";

describe("requireRequestContext", () => {
  test("returns the authenticated clerk user id", () => {
    const context = requireRequestContext(
      new Request("http://localhost/projects", {
        headers: {
          "x-clerk-user-id": "user_123",
        },
      }),
    );

    expect(context).toEqual({ clerkUserId: "user_123" });
  });

  test("rejects requests without a clerk user id", () => {
    expect(() =>
      requireRequestContext(new Request("http://localhost/projects")),
    ).toThrow(new RequestContextError("x-clerk-user-id header is required"));
  });

  test("rejects blank clerk user ids", () => {
    expect(() =>
      requireRequestContext(
        new Request("http://localhost/projects", {
          headers: {
            "x-clerk-user-id": "   ",
          },
        }),
      ),
    ).toThrow(new RequestContextError("x-clerk-user-id header is required"));
  });
});
