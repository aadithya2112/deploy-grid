import { expect, test } from "bun:test";
import { routeCandidates, siteLabel } from "../src/routing.ts";
test("SPA navigation falls back but missing assets do not", () => {
  expect(routeCandidates("/settings/profile", "spa")).toEqual(["settings/profile", "settings/profile.html", "settings/profile/index.html", "index.html"]);
  expect(routeCandidates("/assets/missing.js", "spa")).toEqual(["assets/missing.js"]);
});
test("multipage exports preserve real 404s", () => {
  expect(routeCandidates("/about", "static")).toEqual(["about", "about.html", "about/index.html"]);
  expect(routeCandidates("/about/", "static")).toEqual(["about/index.html"]);
});
test("rejects encoded traversal, hidden files, and reserved manifest", () => {
  for (const value of ["/%2e%2e/secret", "/.env", "/%5csecret", "/_deploy-grid.json", "/%00"]) expect(() => routeCandidates(value, "spa")).toThrow();
});
test("only a single valid site label on the configured domain is accepted", () => {
  const id = "d-12345678-1234-1234-1234-123456789012";
  expect(siteLabel(`${id}.sites.example.com`, "sites.example.com")).toBe(id);
  expect(siteLabel(`${id}.evil.sites.example.com`, "sites.example.com")).toBeNull();
});
