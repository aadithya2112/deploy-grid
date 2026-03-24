interface ErrorWithMessage {
  message?: unknown;
  code?: unknown;
  column?: unknown;
  column_name?: unknown;
}

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }

  if (!error || typeof error !== "object") {
    return null;
  }

  const message = (error as ErrorWithMessage).message;
  return typeof message === "string" ? message : null;
}

function isMissingProjectOwnershipColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const databaseError = error as ErrorWithMessage;
  const message = getErrorMessage(error) ?? "";
  const column =
    typeof databaseError.column_name === "string"
      ? databaseError.column_name
      : typeof databaseError.column === "string"
        ? databaseError.column
        : null;

  return (
    databaseError.code === "42703" &&
      (column === "clerk_user_id" || message.includes("clerk_user_id")) ||
    message.includes(`"projects"."clerk_user_id"`) ||
    message.includes(`column "clerk_user_id" does not exist`)
  );
}

export function getPublicErrorMessage(
  error: unknown,
  fallback = "Internal server error",
): string {
  if (isMissingProjectOwnershipColumnError(error)) {
    return "Database schema is out of date. Run the latest API migration with `bun run db:migrate`.";
  }

  return getErrorMessage(error) ?? fallback;
}
