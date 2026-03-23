export class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

interface ParseJsonBodyOptions {
  allowEmpty?: boolean;
}

export async function parseJsonBody<T>(
  request: Request,
  options: ParseJsonBodyOptions = {},
): Promise<T> {
  const rawBody = await request.text();

  if (!rawBody.trim()) {
    if (options.allowEmpty) {
      return {} as T;
    }

    throw new RequestValidationError("Invalid request body");
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new RequestValidationError("Invalid request body");
  }
}

export function requireString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw new RequestValidationError(`${name} must be a string`);
  }

  return value;
}

export function optionalString(value: unknown, name: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new RequestValidationError(`${name} must be a string`);
  }

  return value;
}

export function optionalNullableString(
  value: unknown,
  name: string,
): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "string") {
    throw new RequestValidationError(`${name} must be a string or null`);
  }

  return value;
}

export function optionalEnum<T extends string>(
  value: unknown,
  name: string,
  allowedValues: readonly T[],
): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !allowedValues.includes(value as T)) {
    throw new RequestValidationError(
      `${name} must be one of: ${allowedValues.join(", ")}`,
    );
  }

  return value as T;
}

export function parsePagination(
  searchParams: URLSearchParams,
  options: {
    defaultLimit?: number;
    maxLimit?: number;
  } = {},
): { limit: number; offset: number } {
  const defaultLimit = options.defaultLimit ?? 50;
  const maxLimit = options.maxLimit ?? 100;
  const limit = Number(searchParams.get("limit") ?? String(defaultLimit));
  const offset = Number(searchParams.get("offset") ?? "0");

  if (!Number.isFinite(limit) || limit <= 0) {
    throw new RequestValidationError("limit must be a positive number");
  }

  if (limit > maxLimit) {
    throw new RequestValidationError(`limit must be less than or equal to ${maxLimit}`);
  }

  if (!Number.isFinite(offset) || offset < 0) {
    throw new RequestValidationError("offset must be a non-negative number");
  }

  return { limit, offset };
}

export function optionalNonNegativeIntParam(
  searchParams: URLSearchParams,
  name: string,
): number | undefined {
  const value = searchParams.get(name);

  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new RequestValidationError(`${name} must be a non-negative number`);
  }

  return parsed;
}
