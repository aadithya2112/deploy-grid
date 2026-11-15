import "server-only"

// Opt in only after the API, schema, builder, and site router have been cut over.
// Read at request time so this is not exposed as a browser/build-time setting.
export function isStaticPlatformEnabled(): boolean {
  return process.env.STATIC_PLATFORM_ENABLED === "true"
}
