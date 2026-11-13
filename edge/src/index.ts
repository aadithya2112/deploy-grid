import { routeCandidates, siteLabel } from "./routing.ts";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    const url = new URL(request.url);
    const label = siteLabel(url.hostname, env.SITES_DOMAIN);
    if (!label) return new Response("Site not found", { status: 404 });
    // Resolve production aliases on every request: rollback never depends on KV/cache propagation.
    const resolved = await env.API.fetch(new Request(`https://api/internal/sites/${label}`, { headers: { Authorization: `Bearer ${env.ROUTING_SECRET}` } }));
    if (!resolved.ok) return new Response(resolved.status === 404 ? "Deployment unavailable" : "Temporarily unavailable", { status: resolved.status === 404 ? 404 : 503 });
    const site = await resolved.json<{ prefix: string; routing: "spa" | "static" }>();
    let candidates: string[];
    try { candidates = routeCandidates(url.pathname, site.routing); } catch { return new Response("Invalid path", { status: 400 }); }
    let status = 200;
    let object: R2ObjectBody | null = null;
    for (const candidate of candidates) {
      object = await env.ARTIFACTS.get(`${site.prefix}/${candidate}`);
      if (object) break;
    }
    if (!object) { status = 404; object = await env.ARTIFACTS.get(`${site.prefix}/404.html`); }
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "Cache-Control": "no-cache" });
    object.writeHttpMetadata(headers);
    headers.set("ETag", object.httpEtag);
    headers.set("Cache-Control", "no-cache");
    if (status === 200 && request.headers.get("If-None-Match") === object.httpEtag) return new Response(null, { status: 304, headers });
    return new Response(request.method === "HEAD" ? null : object.body, { status, headers });
  },
} satisfies ExportedHandler<Env>;
