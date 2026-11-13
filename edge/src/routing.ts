export function routeCandidates(pathname: string, routing: "spa" | "static"): string[] {
  let decoded: string;
  try { decoded = decodeURIComponent(pathname); } catch { throw new Error("Invalid URL encoding"); }
  if (decoded.includes("\\") || /[\x00-\x1f]/.test(decoded) || decoded.split("/").some(part => part.startsWith(".")) || decoded.includes("_deploy-grid.json")) throw new Error("Invalid artifact path");
  const clean = decoded.replace(/^\/+/, "");
  if (!clean) return ["index.html"];
  if (clean.endsWith("/")) return [clean + "index.html", ...(routing === "spa" ? ["index.html"] : [])];
  const candidates = [clean];
  if (!clean.split("/").at(-1)?.includes(".")) candidates.push(`${clean}.html`, `${clean}/index.html`, ...(routing === "spa" ? ["index.html"] : []));
  return candidates;
}

export function siteLabel(host: string, domain: string): string | null {
  if (!host.endsWith(`.${domain}`)) return null;
  const label = host.slice(0, -(domain.length + 1));
  return /^(d|p)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(label) ? label : null;
}
