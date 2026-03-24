export class RequestContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestContextError";
  }
}

export interface RequestContext {
  clerkUserId: string;
}

export function requireRequestContext(request: Request): RequestContext {
  const clerkUserId = request.headers.get("x-clerk-user-id")?.trim();

  if (!clerkUserId) {
    throw new RequestContextError("x-clerk-user-id header is required");
  }

  return { clerkUserId };
}
