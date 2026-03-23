type LoggerContext = Record<string, unknown>;

function write(level: "info" | "warn" | "error", message: string, context?: LoggerContext): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? { context } : {}),
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}

export const logger = {
  info(message: string, context?: LoggerContext): void {
    write("info", message, context);
  },
  warn(message: string, context?: LoggerContext): void {
    write("warn", message, context);
  },
  error(message: string, context?: LoggerContext): void {
    write("error", message, context);
  },
};
