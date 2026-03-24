export function isE2ETestMode(): boolean {
  return process.env.E2E_TEST_MODE === "1"
}

export function getE2ETestUserId(): string {
  return process.env.E2E_TEST_USER_ID ?? "e2e-user"
}
