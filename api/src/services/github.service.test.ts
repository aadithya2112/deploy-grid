import { test, expect } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyWebhook } from "./github.service.ts";
test("webhook verification rejects missing, malformed, and altered payloads", () => {
  const body = '{"action":"opened"}';
  const secret = "test-secret";
  const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  expect(verifyWebhook(body, signature, secret)).toBe(true);
  expect(verifyWebhook(body + " ", signature, secret)).toBe(false);
  expect(verifyWebhook(body, null, secret)).toBe(false);
  expect(verifyWebhook(body, "sha256=00", secret)).toBe(false);
  expect(verifyWebhook(body, signature, "")).toBe(false);
});
