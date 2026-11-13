import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export type Framework = "react-vite" | "vue-vite" | "vite" | "astro" | "next-static" | "static";
export interface FrameworkPlan {
  framework: Framework;
  routing: "spa" | "static";
  outputDirectory: string;
}

// Configuration is read as text, never imported into the privileged supervisor.
export async function detectFramework(directory: string): Promise<FrameworkPlan> {
  let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  try { pkg = JSON.parse(await readFile(path.join(directory, "package.json"), "utf8")); }
  catch { throw new Error("A valid package.json is required in the project root"); }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const names = await readdir(directory);
  const config = async (prefix: string) => {
    const files = names.filter(name => name.startsWith(prefix) && /\.[cm]?[jt]s$/.test(name));
    return (await Promise.all(files.map(name => readFile(path.join(directory, name), "utf8")))).join("\n");
  };
  if (deps.next) {
    if (!/output\s*:\s*["']export["']/.test(await config("next.config."))) {
      throw new Error('Next.js requires output: "export" in next.config. SSR, Server Actions and request-time routes are not supported.');
    }
    return { framework: "next-static", routing: "static", outputDirectory: "out" };
  }
  if (deps.astro) {
    if (/output\s*:\s*["'](?:server|hybrid)["']/.test(await config("astro.config."))) throw new Error("Astro must use static output; server/hybrid rendering is unsupported");
    return { framework: "astro", routing: "static", outputDirectory: "dist" };
  }
  if (deps["@sveltejs/kit"] || deps.nuxt || deps["@remix-run/node"]) throw new Error("This framework needs an explicit static adapter, which is not supported in this release");
  if (deps.vite) return { framework: deps.react ? "react-vite" : deps.vue ? "vue-vite" : "vite", routing: "spa", outputDirectory: "dist" };
  return { framework: "static", routing: "static", outputDirectory: "dist" };
}
