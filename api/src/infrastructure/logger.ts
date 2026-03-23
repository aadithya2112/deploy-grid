export class Logger {
  info(message: string, meta?: Record<string, unknown>): void {
    this.log("INFO", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log("ERROR", message, meta);
  }

  private log(
    level: "INFO" | "ERROR",
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    const timestamp = new Date().toISOString();
    const payload = meta ? ` ${JSON.stringify(meta)}` : "";

    console.log(`[${timestamp}] ${level} ${message}${payload}`);
  }
}

export const logger = new Logger();
