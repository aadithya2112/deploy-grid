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

  if (!expectedToken || publicPaths.includes(path)) {
    return null;
  }

  const authorization = request.headers.get("authorization");

  if (!authorization || authorization !== `Bearer ${expectedToken}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
