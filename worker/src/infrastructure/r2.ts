import {
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../config/env.ts";

export interface UploadArtifactInput {
  key: string;
  body: Uint8Array;
  contentType: string;
}

export interface ArtifactStorageLike {
  uploadObject(input: UploadArtifactInput): Promise<void>;
  buildArtifactUrl(deploymentId: string): string;
}

export class ArtifactStorage implements ArtifactStorageLike {
  private readonly client = new S3Client({
    region: "auto",
    endpoint: env.r2S3Endpoint,
    credentials: {
      accessKeyId: env.artifactAccessKey,
      secretAccessKey: env.artifactSecretKey,
    },
  });

  readonly bucket = env.artifactBucket;

  async uploadObject(input: UploadArtifactInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  async deletePrefix(prefix: string): Promise<void> {
    let continuation: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuation,
        }),
      );
      const objects = (page.Contents ?? []).flatMap((item) =>
        item.Key ? [{ Key: item.Key }] : [],
      );
      if (objects.length) {
        const result = await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: objects },
          }),
        );
        if (result.Errors?.length)
          throw new Error("Artifact deletion failed; maintenance will retry");
      }
      continuation = page.NextContinuationToken;
    } while (continuation);
  }

  buildArtifactUrl(deploymentId: string): string {
    const baseUrl = env.artifactBaseUrl ?? env.r2PublicBaseUrl;

    if (!baseUrl) {
      throw new Error("No artifact base URL is configured");
    }

    return `${baseUrl}/deployments/${deploymentId}/index.html`;
  }
}
