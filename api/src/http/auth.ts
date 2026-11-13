import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env.ts";

interface AuthorizeRequestOptions {
  expectedToken?: string | null;
  publicPaths?: string[];
}

export function authorizeRequest(
  request: Request,
  options: AuthorizeRequestOptions = {},
): Response | null {
  const expectedToken =
    options.expectedToken === undefined
      ? env.apiAuthToken
      : options.expectedToken;
  const publicPaths = options.publicPaths ?? ["/health"];
  const path = new URL(request.url).pathname;

  if (publicPaths.includes(path)) {
    return null;
  }

  if (!expectedToken) {
    return Response.json({ error: "API authentication is not configured" }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");

  const expected = Buffer.from(`Bearer ${expectedToken}`);
  const supplied = Buffer.from(authorization ?? "");
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
