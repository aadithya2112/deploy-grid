import type { LogStream } from "../db/schema.ts";

export interface DeploymentLogRepositoryLike {
  getNextSequence(deploymentId: string): Promise<number>;
  append(entry: {
    deploymentId: string;
    stream: LogStream;
    sequence: number;
    message: string;
  }): Promise<unknown>;
}

function redactSecrets(message: string, secrets: string[]): string {
  let redacted = message;

  for (const secret of secrets) {
    if (!secret) {
      continue;
    }

    redacted = redacted.split(secret).join("[REDACTED]");
  }

  return redacted;
}

function normalizeMessage(message: string): string {
  return message.replace(/\u0000/g, "").slice(0, 8_000);
}

export class DeploymentLogWriter {
  private nextSequence = 1;
  private writeChain: Promise<void>;

  constructor(
    private readonly repository: DeploymentLogRepositoryLike,
    private readonly deploymentId: string,
    private secretsToRedact: string[] = [],
  ) {
    this.writeChain = repository
      .getNextSequence(deploymentId)
      .then((nextSequence) => {
        this.nextSequence = nextSequence;
      });
  }

  private async append(stream: LogStream, message: string): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      await this.repository.append({
        deploymentId: this.deploymentId,
        stream,
        sequence: this.nextSequence,
        message: normalizeMessage(redactSecrets(message, this.secretsToRedact)),
      });

      this.nextSequence += 1;
    });

    await this.writeChain;
  }

  setSecretsToRedact(secretsToRedact: string[]): void {
    this.secretsToRedact = secretsToRedact;
  }

  async system(message: string): Promise<void> {
    await this.append("system", message);
  }

  async stdout(message: string): Promise<void> {
    await this.append("stdout", message);
  }

  async stderr(message: string): Promise<void> {
    await this.append("stderr", message);
  }
}
