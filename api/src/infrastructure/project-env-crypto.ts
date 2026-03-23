import { Buffer } from "node:buffer";
import { env } from "../config/env.ts";

const encryptedPrefix = "enc:v1:";

function toBase64Url(value: ArrayBuffer | Uint8Array): string {
  const buffer = value instanceof Uint8Array ? value : new Uint8Array(value);
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return new Uint8Array(Buffer.from(`${normalized}${padding}`, "base64"));
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;
}

let cachedKey: Promise<CryptoKey> | null = null;

async function getKey(): Promise<CryptoKey> {
  const encryptionKey = env.projectEnvEncryptionKey;

  if (!encryptionKey) {
    throw new Error("PROJECT_ENV_ENCRYPTION_KEY is required for env var encryption");
  }

  if (!cachedKey) {
    cachedKey = (async () => {
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(encryptionKey),
      );

      return crypto.subtle.importKey(
        "raw",
        digest,
        {
          name: "AES-GCM",
        },
        false,
        ["encrypt", "decrypt"],
      );
    })();
  }

  return cachedKey;
}

export async function encryptProjectEnvValue(value: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    new TextEncoder().encode(value),
  );

  return `${encryptedPrefix}${toBase64Url(iv)}:${toBase64Url(encrypted)}`;
}

export async function decryptProjectEnvValue(value: string): Promise<string> {
  if (!value.startsWith(encryptedPrefix)) {
    return value;
  }

  const key = await getKey();
  const parts = value.slice(encryptedPrefix.length).split(":");

  if (parts.length !== 2) {
    throw new Error("Invalid encrypted env var payload");
  }

  const [ivPart, encryptedPart] = parts;

  if (!ivPart || !encryptedPart) {
    throw new Error("Invalid encrypted env var payload");
  }

  const iv = fromBase64Url(ivPart);
  const encrypted = fromBase64Url(encryptedPart);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
    },
    key,
    toArrayBuffer(encrypted),
  );

  return new TextDecoder().decode(decrypted);
}

export function isEncryptedProjectEnvValue(value: string): boolean {
  return value.startsWith(encryptedPrefix);
}
