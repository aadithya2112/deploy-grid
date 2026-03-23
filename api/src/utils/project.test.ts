import { describe, expect, test } from "bun:test";
import { deriveProjectMetadata } from "./project.ts";

describe("deriveProjectMetadata", () => {
  test("derives a stable name and slug from a git URL", () => {
    const metadata = deriveProjectMetadata(
      "https://github.com/acme/My React App.git",
    );

    expect(metadata.name).toBe("My React App");
    expect(metadata.slug.startsWith("my-react-app-")).toBe(true);
    expect(metadata.slug.length).toBeGreaterThan("my-react-app-".length);
  });

  test("handles non-URL input by falling back to path parsing", () => {
    const metadata = deriveProjectMetadata("git@github.com:acme/deploy-grid.git");

    expect(metadata.name).toBe("deploy-grid");
    expect(metadata.slug.startsWith("deploy-grid-")).toBe(true);
  });

  test("normalizes punctuation-heavy repository names", () => {
    const metadata = deriveProjectMetadata(
      "https://github.com/acme/React___Admin!!!.git",
    );

    expect(metadata.name).toBe("React___Admin!!!");
    expect(metadata.slug.startsWith("react-admin-")).toBe(true);
  });

  test("falls back to a default base name when no path exists", () => {
    const metadata = deriveProjectMetadata("https://github.com");

    expect(metadata.name).toBe("react-app");
    expect(metadata.slug.startsWith("react-app-")).toBe(true);
  });

  test("returns the same slug for the same repo URL", () => {
    const first = deriveProjectMetadata("https://github.com/acme/react-app.git");
    const second = deriveProjectMetadata(
      "https://github.com/acme/react-app.git",
    );

    expect(first).toEqual(second);
  });
});
